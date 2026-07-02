import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { requireAdminMiddleware } from "./auth";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
const webhooksFile = path.resolve(dataDir, "webhooks.json");

interface Webhook {
  id: string;
  userId: string;
  userName: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
  lastTriggered?: string;
  failCount: number;
  blocked: boolean;
  blockReason?: string;
}

function loadWebhooks(): Webhook[] {
  try {
    if (fs.existsSync(webhooksFile)) return JSON.parse(fs.readFileSync(webhooksFile, "utf-8")) as Webhook[];
  } catch { /* ignore */ }
  return [];
}

function saveWebhooks(webhooks: Webhook[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(webhooksFile, JSON.stringify(webhooks, null, 2));
}

// GET /api/admin/webhooks - List all webhooks
router.get("/admin/webhooks", requireAdminMiddleware, (_req, res): void => {
  const webhooks = loadWebhooks();
  res.json({ webhooks, total: webhooks.length });
});

// PATCH /api/admin/webhooks/:id - Update webhook (enable/disable/block)
router.patch("/admin/webhooks/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const { enabled, blocked, blockReason } = req.body as { enabled?: boolean; blocked?: boolean; blockReason?: string };
  const webhooks = loadWebhooks();
  const idx = webhooks.findIndex((w) => w.id === id);
  if (idx === -1) { res.status(404).json({ error: "Webhook not found" }); return; }
  if (enabled !== undefined) webhooks[idx].enabled = enabled;
  if (blocked !== undefined) {
    webhooks[idx].blocked = blocked;
    if (blocked && blockReason) webhooks[idx].blockReason = blockReason;
    if (blocked) webhooks[idx].enabled = false;
    if (!blocked) webhooks[idx].blockReason = undefined;
  }
  saveWebhooks(webhooks);
  req.log.info({ webhookId: id, blocked, enabled }, "Webhook updated by admin");
  res.json({ ok: true, webhook: webhooks[idx] });
});

// DELETE /api/admin/webhooks/:id - Delete webhook
router.delete("/admin/webhooks/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const webhooks = loadWebhooks();
  const filtered = webhooks.filter((w) => w.id !== id);
  if (filtered.length === webhooks.length) { res.status(404).json({ error: "Webhook not found" }); return; }
  saveWebhooks(filtered);
  req.log.info({ webhookId: id }, "Webhook deleted by admin");
  res.json({ ok: true });
});

export default router;
