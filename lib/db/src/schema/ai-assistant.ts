import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

// ── AI Configuration (single-row config) ──────────────────────────────────────
export const aiConfigTable = pgTable("ai_config", {
  id:                      text("id").primaryKey().default("default"),
  systemPrompt:            text("system_prompt").notNull().default("Voce e um assistente virtual da Creatools. Ajude os usuarios com duvidas sobre a plataforma, overlays, planos e configuracoes."),
  personalityName:         text("personality_name").notNull().default("Crea AI"),
  maxContextMessages:      integer("max_context_messages").notNull().default(10),
  enabled:                 boolean("enabled").notNull().default(true),
  supportEscalationEnabled: boolean("support_escalation_enabled").notNull().default(true),
  creativeModeEnabled:     boolean("creative_mode_enabled").notNull().default(false),
  allowedTopics:           text("allowed_topics").array(),
  blockedTopics:           text("blocked_topics").array(),
  updatedAt:               text("updated_at").notNull().default(""),
});

// ── AI Conversations ──────────────────────────────────────────────────────────
export const aiConversationsTable = pgTable("ai_conversations", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull(),
  title:     text("title").notNull().default("Nova conversa"),
  status:    text("status").notNull().default("active"), // active | archived | escalated
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── AI Messages ───────────────────────────────────────────────────────────────
export const aiMessagesTable = pgTable("ai_messages", {
  id:             text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => aiConversationsTable.id),
  role:           text("role").notNull(), // user | assistant | system
  content:        text("content").notNull(),
  createdAt:      text("created_at").notNull(),
  tokensUsed:     integer("tokens_used").notNull().default(0),
});

// ── AI Plan Limits ────────────────────────────────────────────────────────────
export const aiPlanLimitsTable = pgTable("ai_plan_limits", {
  id:                       text("id").primaryKey(),
  planId:                   text("plan_id").notNull(),
  messagesPerMonth:         integer("messages_per_month").notNull().default(50),
  creativeRequestsPerMonth: integer("creative_requests_per_month").notNull().default(0),
  priority:                 text("priority").notNull().default("normal"), // low | normal | high
});

// ── Type Exports ──────────────────────────────────────────────────────────────
export type AiConfigRow = typeof aiConfigTable.$inferSelect;
export type InsertAiConfigRow = typeof aiConfigTable.$inferInsert;
export type AiConversationRow = typeof aiConversationsTable.$inferSelect;
export type InsertAiConversationRow = typeof aiConversationsTable.$inferInsert;
export type AiMessageRow = typeof aiMessagesTable.$inferSelect;
export type InsertAiMessageRow = typeof aiMessagesTable.$inferInsert;
export type AiPlanLimitRow = typeof aiPlanLimitsTable.$inferSelect;
export type InsertAiPlanLimitRow = typeof aiPlanLimitsTable.$inferInsert;
