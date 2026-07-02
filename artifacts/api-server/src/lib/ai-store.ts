import { db } from "@workspace/db";
import {
  aiConfigTable,
  aiConversationsTable,
  aiMessagesTable,
  aiPlanLimitsTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export type AiConfig = typeof aiConfigTable.$inferSelect;
export type AiConversation = typeof aiConversationsTable.$inferSelect;
export type AiMessage = typeof aiMessagesTable.$inferSelect;
export type AiPlanLimit = typeof aiPlanLimitsTable.$inferSelect;

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Config ────────────────────────────────────────────────────────────────────
export async function getAiConfig(): Promise<AiConfig | null> {
  const rows = await db.select().from(aiConfigTable).where(eq(aiConfigTable.id, "default"));
  return rows[0] ?? null;
}

export async function upsertAiConfig(data: Partial<AiConfig>): Promise<AiConfig> {
  const existing = await getAiConfig();
  const now = new Date().toISOString();
  if (existing) {
    const rows = await db.update(aiConfigTable).set({ ...data, updatedAt: now }).where(eq(aiConfigTable.id, "default")).returning();
    return rows[0];
  }
  const rows = await db.insert(aiConfigTable).values({
    id: "default",
    systemPrompt: data.systemPrompt ?? "Voce e um assistente virtual da Creatools. Ajude os usuarios com duvidas sobre a plataforma, overlays, planos e configuracoes.",
    personalityName: data.personalityName ?? "Crea AI",
    maxContextMessages: data.maxContextMessages ?? 10,
    enabled: data.enabled ?? true,
    supportEscalationEnabled: data.supportEscalationEnabled ?? true,
    creativeModeEnabled: data.creativeModeEnabled ?? false,
    allowedTopics: data.allowedTopics ?? null,
    blockedTopics: data.blockedTopics ?? null,
    updatedAt: now,
  }).returning();
  return rows[0];
}

// ── Conversations ─────────────────────────────────────────────────────────────
export async function getConversationsByUser(userId: string): Promise<AiConversation[]> {
  return db.select().from(aiConversationsTable)
    .where(and(eq(aiConversationsTable.userId, userId), eq(aiConversationsTable.status, "active")))
    .orderBy(desc(aiConversationsTable.updatedAt));
}

export async function getAllConversations(limit = 50): Promise<AiConversation[]> {
  return db.select().from(aiConversationsTable)
    .orderBy(desc(aiConversationsTable.updatedAt))
    .limit(limit);
}

export async function getConversationById(id: string): Promise<AiConversation | null> {
  const rows = await db.select().from(aiConversationsTable).where(eq(aiConversationsTable.id, id));
  return rows[0] ?? null;
}

export async function createConversation(userId: string, title?: string): Promise<AiConversation> {
  const now = new Date().toISOString();
  const rows = await db.insert(aiConversationsTable).values({
    id: makeId(),
    userId,
    title: title ?? "Nova conversa",
    status: "active",
    createdAt: now,
    updatedAt: now,
  }).returning();
  return rows[0];
}

export async function updateConversation(id: string, data: Partial<AiConversation>): Promise<AiConversation | null> {
  const rows = await db.update(aiConversationsTable).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(aiConversationsTable.id, id)).returning();
  return rows[0] ?? null;
}

export async function archiveConversation(id: string): Promise<void> {
  await db.update(aiConversationsTable).set({ status: "archived", updatedAt: new Date().toISOString() }).where(eq(aiConversationsTable.id, id));
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function getMessagesByConversation(conversationId: string): Promise<AiMessage[]> {
  return db.select().from(aiMessagesTable)
    .where(eq(aiMessagesTable.conversationId, conversationId))
    .orderBy(aiMessagesTable.createdAt);
}

export async function addAiMessage(data: { conversationId: string; role: string; content: string; tokensUsed?: number }): Promise<AiMessage> {
  const rows = await db.insert(aiMessagesTable).values({
    id: makeId(),
    conversationId: data.conversationId,
    role: data.role,
    content: data.content,
    createdAt: new Date().toISOString(),
    tokensUsed: data.tokensUsed ?? 0,
  }).returning();
  // Update conversation updatedAt
  await db.update(aiConversationsTable).set({ updatedAt: new Date().toISOString() }).where(eq(aiConversationsTable.id, data.conversationId));
  return rows[0];
}

// ── Plan Limits ───────────────────────────────────────────────────────────────
export async function getAllPlanLimits(): Promise<AiPlanLimit[]> {
  return db.select().from(aiPlanLimitsTable);
}

export async function getPlanLimit(planId: string): Promise<AiPlanLimit | null> {
  const rows = await db.select().from(aiPlanLimitsTable).where(eq(aiPlanLimitsTable.planId, planId));
  return rows[0] ?? null;
}

export async function upsertPlanLimit(planId: string, data: { messagesPerMonth?: number; creativeRequestsPerMonth?: number; priority?: string }): Promise<AiPlanLimit> {
  const existing = await getPlanLimit(planId);
  if (existing) {
    const rows = await db.update(aiPlanLimitsTable).set(data).where(eq(aiPlanLimitsTable.id, existing.id)).returning();
    return rows[0];
  }
  const rows = await db.insert(aiPlanLimitsTable).values({
    id: makeId(),
    planId,
    messagesPerMonth: data.messagesPerMonth ?? 50,
    creativeRequestsPerMonth: data.creativeRequestsPerMonth ?? 0,
    priority: data.priority ?? "normal",
  }).returning();
  return rows[0];
}

// ── Usage Counting ────────────────────────────────────────────────────────────
export async function countUserMessagesThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startIso = startOfMonth.toISOString();

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiMessagesTable)
    .innerJoin(aiConversationsTable, eq(aiMessagesTable.conversationId, aiConversationsTable.id))
    .where(
      and(
        eq(aiConversationsTable.userId, userId),
        eq(aiMessagesTable.role, "user"),
        gte(aiMessagesTable.createdAt, startIso),
      )
    );
  return Number(rows[0]?.count ?? 0);
}
