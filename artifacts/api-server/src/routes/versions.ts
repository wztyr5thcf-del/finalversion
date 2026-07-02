import { Router, type Request, type Response } from "express";
import { requireAuth, requireAdminMiddleware } from "./auth";
import { db } from "@workspace/db";
import { appVersionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

// GET /versions - list all versions (public, requires auth)
router.get("/versions", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(appVersionsTable).orderBy(desc(appVersionsTable.releasedAt));
  res.json({ versions: rows });
});

// GET /versions/current - return the most recent version
router.get("/versions/current", requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(appVersionsTable).orderBy(desc(appVersionsTable.releasedAt)).limit(1);
  if (!rows[0]) {
    res.json({ version: null });
    return;
  }
  res.json({ version: rows[0] });
});

// POST /versions - create new version (admin only)
router.post("/versions", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { version, title, description, releasedAt } = req.body as {
    version?: string;
    title?: string;
    description?: string;
    releasedAt?: string;
  };

  if (!version?.trim() || !title?.trim()) {
    res.status(400).json({ error: "version e title sao obrigatorios" });
    return;
  }

  const userId = (req as unknown as { userId: string }).userId;

  const rows = await db.insert(appVersionsTable).values({
    version: version.trim(),
    title: title.trim(),
    description: description?.trim() ?? "",
    releasedAt: releasedAt ? new Date(releasedAt) : new Date(),
    createdBy: userId,
  }).returning();

  res.status(201).json(rows[0]);
});

// PUT /versions/:id - update version (admin only)
router.put("/versions/:id", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const { version, title, description, releasedAt } = req.body as {
    version?: string;
    title?: string;
    description?: string;
    releasedAt?: string;
  };

  const existing = await db.select().from(appVersionsTable).where(eq(appVersionsTable.id, id));
  if (!existing[0]) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (version !== undefined) updates.version = version.trim();
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description.trim();
  if (releasedAt !== undefined) updates.releasedAt = new Date(releasedAt);

  const updated = await db.update(appVersionsTable).set(updates).where(eq(appVersionsTable.id, id)).returning();
  res.json(updated[0]);
});

// DELETE /versions/:id - delete version (admin only)
router.delete("/versions/:id", requireAdminMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as { id: string };
  const rows = await db.delete(appVersionsTable).where(eq(appVersionsTable.id, id)).returning();
  if (!rows.length) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
