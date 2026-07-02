import { pgTable, text, integer, bigint, boolean, index } from "drizzle-orm/pg-core";

export const alertOverlaysTable = pgTable("alert_overlays", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  previewUrl: text("preview_url").notNull(),
  overlayUrl: text("overlay_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull().default("Geral"),
  minPlan: text("min_plan").notNull().default("free"),
  price: integer("price").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  order: integer("order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const alertOverlayPurchasesTable = pgTable("alert_overlay_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  alertOverlayId: text("alert_overlay_id").notNull(),
  purchasedAt: bigint("purchased_at", { mode: "number" }).notNull(),
}, (table) => [
  index("idx_purchases_user_overlay").on(table.userId, table.alertOverlayId),
]);
