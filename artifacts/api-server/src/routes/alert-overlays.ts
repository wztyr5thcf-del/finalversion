import { Router, type Request, type Response } from "express";
import { requireAuth, requireAdminMiddleware } from "./auth";
import { getUserById } from "../lib/users-store";
import { db } from "@workspace/db";
import { alertOverlaysTable, alertOverlayPurchasesTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

type PlanLevel = "free" | "basic" | "pro";
const PLAN_ORDER: Record<PlanLevel, number> = { free: 0, basic: 1, pro: 2 };
function planMeets(userPlan: PlanLevel, required: string): boolean {
  return PLAN_ORDER[userPlan] >= (PLAN_ORDER[required as PlanLevel] ?? 0);
}

// GET /alert-overlays - List all active alerts (authenticated)
router.get("/alert-overlays", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const user = await getUserById(userId);
  const userPlan = (user?.plan ?? "free") as PlanLevel;

  const overlays = await db
    .select()
    .from(alertOverlaysTable)
    .where(eq(alertOverlaysTable.isActive, true))
    .orderBy(alertOverlaysTable.order, alertOverlaysTable.createdAt);

  const purchases = await db
    .select()
    .from(alertOverlayPurchasesTable)
    .where(eq(alertOverlayPurchasesTable.userId, userId));

  const purchasedIds = new Set(purchases.map((p) => p.alertOverlayId));

  const items = overlays.map((o) => {
    const hasAccess = planMeets(userPlan, o.minPlan) || purchasedIds.has(o.id);
    return {
      id: o.id,
      name: o.name,
      description: o.description,
      previewUrl: o.previewUrl,
      overlayUrl: hasAccess ? o.overlayUrl : null,
      thumbnailUrl: o.thumbnailUrl,
      category: o.category,
      minPlan: o.minPlan,
      price: o.price,
      hasAccess,
      purchased: purchasedIds.has(o.id),
      order: o.order,
      createdAt: o.createdAt,
    };
  });

  res.json({ items });
});

// GET /alert-overlays/my-purchases - User's purchases
router.get("/alert-overlays/my-purchases", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  const purchases = await db
    .select()
    .from(alertOverlayPurchasesTable)
    .where(eq(alertOverlayPurchasesTable.userId, userId));

  res.json({ purchases });
});

// GET /alert-overlays/all - Admin: list all overlays (active and inactive)
router.get("/alert-overlays/all", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const overlays = await db
    .select()
    .from(alertOverlaysTable)
    .orderBy(alertOverlaysTable.order, alertOverlaysTable.createdAt);

  res.json({ items: overlays });
});

// GET /alert-overlays/:id - Single alert detail
router.get("/alert-overlays/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { id } = req.params as { id: string };

  const user = await getUserById(userId);
  const userPlan = (user?.plan ?? "free") as PlanLevel;
  const isAdmin = user?.isAdmin === true;

  const [overlay] = await db
    .select()
    .from(alertOverlaysTable)
    .where(
      isAdmin
        ? eq(alertOverlaysTable.id, id)
        : and(eq(alertOverlaysTable.id, id), eq(alertOverlaysTable.isActive, true))
    );

  if (!overlay) { res.status(404).json({ error: "Overlay nao encontrado." }); return; }

  const [purchase] = await db
    .select()
    .from(alertOverlayPurchasesTable)
    .where(and(
      eq(alertOverlayPurchasesTable.userId, userId),
      eq(alertOverlayPurchasesTable.alertOverlayId, id)
    ));

  const hasAccess = planMeets(userPlan, overlay.minPlan) || !!purchase;

  res.json({
    item: {
      ...overlay,
      overlayUrl: hasAccess ? overlay.overlayUrl : null,
      hasAccess,
      purchased: !!purchase,
    },
  });
});

// POST /alert-overlays - Admin: create overlay
router.post("/alert-overlays", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { name, description, previewUrl, overlayUrl, thumbnailUrl, category, minPlan, price, order } = req.body as {
    name?: string; description?: string; previewUrl?: string; overlayUrl?: string;
    thumbnailUrl?: string; category?: string; minPlan?: string; price?: number; order?: number;
  };

  if (!name?.trim() || !previewUrl?.trim() || !overlayUrl?.trim()) {
    res.status(400).json({ error: "Nome, previewUrl e overlayUrl sao obrigatorios." }); return;
  }

  const validPlans = ["free", "basic", "pro"];
  const resolvedMinPlan = minPlan || "free";
  if (!validPlans.includes(resolvedMinPlan)) {
    res.status(400).json({ error: "minPlan invalido. Valores aceitos: free, basic, pro." }); return;
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  const item = {
    id,
    name: name.trim(),
    description: description?.trim() ?? "",
    previewUrl: previewUrl.trim(),
    overlayUrl: overlayUrl.trim(),
    thumbnailUrl: thumbnailUrl?.trim() || null,
    category: category?.trim() || "Geral",
    minPlan: resolvedMinPlan,
    price: price ?? 0,
    isActive: true,
    order: order ?? 0,
    createdAt: now,
  };

  await db.insert(alertOverlaysTable).values(item);
  res.json({ item });
});

// PATCH /alert-overlays/:id - Admin: update overlay
router.patch("/alert-overlays/:id", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const body = req.body as Record<string, unknown>;

  const [existing] = await db
    .select()
    .from(alertOverlaysTable)
    .where(eq(alertOverlaysTable.id, id));

  if (!existing) { res.status(404).json({ error: "Overlay nao encontrado." }); return; }

  const updates: Partial<typeof alertOverlaysTable.$inferInsert> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim();
  if (typeof body.previewUrl === "string") updates.previewUrl = body.previewUrl.trim();
  if (typeof body.overlayUrl === "string") updates.overlayUrl = body.overlayUrl.trim();
  if (typeof body.thumbnailUrl === "string") updates.thumbnailUrl = body.thumbnailUrl.trim() || null;
  if (typeof body.category === "string") updates.category = body.category.trim();
  if (typeof body.minPlan === "string") {
    const validPlans = ["free", "basic", "pro"];
    if (!validPlans.includes(body.minPlan)) {
      res.status(400).json({ error: "minPlan invalido. Valores aceitos: free, basic, pro." }); return;
    }
    updates.minPlan = body.minPlan;
  }
  if (typeof body.price === "number") updates.price = body.price;
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body.order === "number") updates.order = body.order;

  if (Object.keys(updates).length === 0) {
    res.json({ item: existing }); return;
  }

  const [updated] = await db
    .update(alertOverlaysTable)
    .set(updates)
    .where(eq(alertOverlaysTable.id, id))
    .returning();

  res.json({ item: updated });
});

// DELETE /alert-overlays/:id - Admin: delete overlay
router.delete("/alert-overlays/:id", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };

  const [existing] = await db
    .select()
    .from(alertOverlaysTable)
    .where(eq(alertOverlaysTable.id, id));

  if (!existing) { res.status(404).json({ error: "Overlay nao encontrado." }); return; }

  await db.delete(alertOverlaysTable).where(eq(alertOverlaysTable.id, id));

  res.json({ ok: true });
});

// POST /alert-overlays/:id/purchase - User: purchase individual alert
router.post("/alert-overlays/:id/purchase", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { id } = req.params as { id: string };

  const user = await getUserById(userId);
  const userPlan = (user?.plan ?? "free") as PlanLevel;

  // Must have an active paid plan to purchase individual items
  if (userPlan === "free") {
    res.status(403).json({ error: "Voce precisa ter um plano pago ativo para comprar itens individuais." }); return;
  }

  const [overlay] = await db
    .select()
    .from(alertOverlaysTable)
    .where(eq(alertOverlaysTable.id, id));

  if (!overlay) { res.status(404).json({ error: "Overlay nao encontrado." }); return; }

  // Check if already has access via plan
  if (planMeets(userPlan, overlay.minPlan)) {
    res.status(400).json({ error: "Voce ja tem acesso a este overlay pelo seu plano." }); return;
  }

  // Check if already purchased
  const [existingPurchase] = await db
    .select()
    .from(alertOverlayPurchasesTable)
    .where(and(
      eq(alertOverlayPurchasesTable.userId, userId),
      eq(alertOverlayPurchasesTable.alertOverlayId, id)
    ));

  if (existingPurchase) {
    res.status(400).json({ error: "Voce ja comprou este overlay." }); return;
  }

  if (overlay.price <= 0) {
    res.status(400).json({ error: "Este overlay nao esta disponivel para compra individual." }); return;
  }

  const purchaseId = crypto.randomUUID();
  const now = Date.now();

  await db.insert(alertOverlayPurchasesTable).values({
    id: purchaseId,
    userId,
    alertOverlayId: id,
    purchasedAt: now,
  });

  res.json({ ok: true, purchaseId, overlayUrl: overlay.overlayUrl });
});

export default router;
