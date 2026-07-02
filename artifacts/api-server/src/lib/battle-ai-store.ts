import crypto from "node:crypto";
import { db } from "@workspace/db";
import {
  battleAiSessionsTable,
  battleAiConfigTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

export type BattleAiConfig = typeof battleAiConfigTable.$inferSelect;
export type BattleAiSession = typeof battleAiSessionsTable.$inferSelect;

// ── Config ────────────────────────────────────────────────────────────────────
export async function getBattleAiConfig(): Promise<BattleAiConfig | null> {
  const rows = await db.select().from(battleAiConfigTable).where(eq(battleAiConfigTable.id, "default"));
  return rows[0] ?? null;
}

export async function upsertBattleAiConfig(data: Partial<BattleAiConfig>): Promise<BattleAiConfig> {
  const existing = await getBattleAiConfig();
  const now = new Date().toISOString();
  if (existing) {
    const rows = await db.update(battleAiConfigTable).set({ ...data, updatedAt: now }).where(eq(battleAiConfigTable.id, "default")).returning();
    return rows[0];
  }
  const rows = await db.insert(battleAiConfigTable).values({
    id: "default",
    availableAvatars: data.availableAvatars ?? JSON.stringify([
      { id: "avatar-1", name: "Ana", appearance: "female-1", voice: "pt-BR-female-1" },
      { id: "avatar-2", name: "Carlos", appearance: "male-1", voice: "pt-BR-male-1" },
      { id: "avatar-3", name: "Luna", appearance: "female-2", voice: "pt-BR-female-2" },
    ]),
    pricePerSession: data.pricePerSession ?? 0,
    planRestrictions: data.planRestrictions ?? JSON.stringify({ minPlan: "free" }),
    maxSessionDuration: data.maxSessionDuration ?? 30,
    enabled: data.enabled ?? false,
    updatedAt: now,
  }).returning();
  return rows[0];
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function createSession(data: {
  userId: string;
  avatarConfig: string;
  tiktokUsername: string;
  rtmpUrl: string;
}): Promise<BattleAiSession> {
  const now = new Date().toISOString();
  const rows = await db.insert(battleAiSessionsTable).values({
    id: crypto.randomUUID(),
    userId: data.userId,
    status: "idle",
    avatarConfig: data.avatarConfig,
    tiktokUsername: data.tiktokUsername,
    rtmpUrl: data.rtmpUrl,
    heygenSessionId: null,
    startedAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return rows[0];
}

export async function getSessionsByUser(userId: string): Promise<BattleAiSession[]> {
  return db.select().from(battleAiSessionsTable)
    .where(eq(battleAiSessionsTable.userId, userId))
    .orderBy(desc(battleAiSessionsTable.createdAt));
}

export async function getSessionById(id: string): Promise<BattleAiSession | null> {
  const rows = await db.select().from(battleAiSessionsTable).where(eq(battleAiSessionsTable.id, id));
  return rows[0] ?? null;
}

export async function updateSession(id: string, data: Partial<BattleAiSession>): Promise<BattleAiSession | null> {
  const rows = await db.update(battleAiSessionsTable).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(battleAiSessionsTable.id, id)).returning();
  return rows[0] ?? null;
}

export async function getAllSessions(): Promise<BattleAiSession[]> {
  return db.select().from(battleAiSessionsTable)
    .orderBy(desc(battleAiSessionsTable.createdAt));
}
