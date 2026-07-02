import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const appVersionsTable = pgTable("app_versions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  version:     text("version").notNull(),
  title:       text("title").notNull(),
  description: text("description").notNull().default(""),
  releasedAt:  timestamp("released_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy:   text("created_by").notNull(),
});

export type AppVersionRow = typeof appVersionsTable.$inferSelect;
export type InsertAppVersionRow = typeof appVersionsTable.$inferInsert;
