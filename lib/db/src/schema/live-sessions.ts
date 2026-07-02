import { pgTable, text, integer, boolean, index } from "drizzle-orm/pg-core";

export const liveSessionsTable = pgTable("live_sessions", {
  id:                   text("id").primaryKey(),
  userId:               text("user_id").notNull(),
  tiktokUsername:       text("tiktok_username").notNull(),
  roomId:               text("room_id"),
  startedAt:            text("started_at").notNull(),
  endedAt:              text("ended_at"),
  peakViewers:          integer("peak_viewers").notNull().default(0),
  currentViewers:       integer("current_viewers").notNull().default(0),
  totalGifts:           integer("total_gifts").notNull().default(0),
  totalDiamonds:        integer("total_diamonds").notNull().default(0),
  totalLikes:           integer("total_likes").notNull().default(0),
  totalComments:        integer("total_comments").notNull().default(0),
  totalShares:          integer("total_shares").notNull().default(0),
  totalFollows:         integer("total_follows").notNull().default(0),
  totalNewSubscribers:  integer("total_new_subscribers").notNull().default(0),
  durationSeconds:      integer("duration_seconds").notNull().default(0),
  status:               text("status").notNull().default("active"), // 'active' | 'ended'
}, (table) => [
  index("live_sessions_user_id_idx").on(table.userId),
  index("live_sessions_status_idx").on(table.status),
  index("live_sessions_started_at_idx").on(table.startedAt),
]);

export const liveSessionEventsTable = pgTable("live_session_events", {
  id:               text("id").primaryKey(),
  sessionId:        text("session_id").notNull(),
  timestamp:        text("timestamp").notNull(),
  viewerCount:      integer("viewer_count").notNull().default(0),
  likesInWindow:    integer("likes_in_window").notNull().default(0),
  giftsInWindow:    integer("gifts_in_window").notNull().default(0),
  diamondsInWindow: integer("diamonds_in_window").notNull().default(0),
  commentsInWindow: integer("comments_in_window").notNull().default(0),
}, (table) => [
  index("live_session_events_session_id_idx").on(table.sessionId),
  index("live_session_events_timestamp_idx").on(table.timestamp),
]);

export type LiveSessionRow = typeof liveSessionsTable.$inferSelect;
export type InsertLiveSessionRow = typeof liveSessionsTable.$inferInsert;
export type LiveSessionEventRow = typeof liveSessionEventsTable.$inferSelect;
export type InsertLiveSessionEventRow = typeof liveSessionEventsTable.$inferInsert;
