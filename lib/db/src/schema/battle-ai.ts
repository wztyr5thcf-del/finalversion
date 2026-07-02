import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";

// ── Battle AI Sessions ────────────────────────────────────────────────────────
export const battleAiSessionsTable = pgTable("battle_ai_sessions", {
  id:              text("id").primaryKey(),
  userId:          text("user_id").notNull(),
  status:          text("status").notNull().default("idle"), // idle | streaming | error
  avatarConfig:    text("avatar_config").notNull().default("{}"), // JSON stringified: { appearance, voice, gender, personality }
  tiktokUsername:  text("tiktok_username").notNull().default(""),
  rtmpUrl:         text("rtmp_url").notNull().default(""),
  heygenSessionId: text("heygen_session_id"),
  startedAt:       text("started_at"),
  endedAt:         text("ended_at"),
  createdAt:       text("created_at").notNull(),
  updatedAt:       text("updated_at").notNull(),
});

// ── Battle AI Config (single-row config) ──────────────────────────────────────
export const battleAiConfigTable = pgTable("battle_ai_config", {
  id:                 text("id").primaryKey().default("default"),
  availableAvatars:   text("available_avatars").notNull().default("[]"), // JSON stringified array
  pricePerSession:    integer("price_per_session").notNull().default(0),
  planRestrictions:   text("plan_restrictions").notNull().default("{}"), // JSON
  maxSessionDuration: integer("max_session_duration").notNull().default(30),
  enabled:            boolean("enabled").notNull().default(false),
  updatedAt:          text("updated_at").notNull().default(""),
});

// ── Type Exports ──────────────────────────────────────────────────────────────
export type BattleAiSessionRow = typeof battleAiSessionsTable.$inferSelect;
export type InsertBattleAiSessionRow = typeof battleAiSessionsTable.$inferInsert;
export type BattleAiConfigRow = typeof battleAiConfigTable.$inferSelect;
export type InsertBattleAiConfigRow = typeof battleAiConfigTable.$inferInsert;
