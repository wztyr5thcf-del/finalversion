import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { requireAdminMiddleware } from "./auth";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
const rateLimitsFile = path.resolve(dataDir, "rate-limits.json");

interface RateLimitRule {
  id: string;
  name: string;
  path: string;
  method: string;
  windowMs: number;
  maxRequests: number;
  plan: "all" | "free" | "basic" | "pro";
  enabled: boolean;
  description?: string;
}

const DEFAULT_LIMITS: RateLimitRule[] = [
  { id: "global", name: "Global", path: "/api/*", method: "ALL", windowMs: 60000, maxRequests: 120, plan: "all", enabled: true, description: "Limite global por IP" },
  { id: "auth", name: "Autenticacao", path: "/api/auth/*", method: "POST", windowMs: 900000, maxRequests: 10, plan: "all", enabled: true, description: "Login/Register" },
  { id: "tiktok-free", name: "TikTok API (Free)", path: "/api/tiktok/*", method: "GET", windowMs: 60000, maxRequests: 10, plan: "free", enabled: true, description: "Requisicoes TikTok para plano gratuito" },
  { id: "tiktok-basic", name: "TikTok API (Basic)", path: "/api/tiktok/*", method: "GET", windowMs: 60000, maxRequests: 30, plan: "basic", enabled: true, description: "Requisicoes TikTok para plano Basic" },
  { id: "tiktok-pro", name: "TikTok API (Pro)", path: "/api/tiktok/*", method: "GET", windowMs: 60000, maxRequests: 60, plan: "pro", enabled: true, description: "Requisicoes TikTok para plano Pro" },
  { id: "ai-chat-free", name: "AI Chat (Free)", path: "/api/ai/chat", method: "POST", windowMs: 3600000, maxRequests: 5, plan: "free", enabled: true, description: "Mensagens IA por hora (Free)" },
  { id: "ai-chat-basic", name: "AI Chat (Basic)", path: "/api/ai/chat", method: "POST", windowMs: 3600000, maxRequests: 20, plan: "basic", enabled: true, description: "Mensagens IA por hora (Basic)" },
  { id: "ai-chat-pro", name: "AI Chat (Pro)", path: "/api/ai/chat", method: "POST", windowMs: 3600000, maxRequests: 100, plan: "pro", enabled: true, description: "Mensagens IA por hora (Pro)" },
  { id: "webhooks", name: "Webhooks", path: "/api/webhooks/*", method: "ALL", windowMs: 60000, maxRequests: 30, plan: "all", enabled: true, description: "Gerenciamento de webhooks" },
  { id: "media-upload", name: "Upload de Midia", path: "/api/media/upload", method: "POST", windowMs: 3600000, maxRequests: 20, plan: "all", enabled: true, description: "Upload de arquivos" },
];

function loadRateLimits(): RateLimitRule[] {
  try {
    if (fs.existsSync(rateLimitsFile)) return JSON.parse(fs.readFileSync(rateLimitsFile, "utf-8")) as RateLimitRule[];
  } catch { /* ignore */ }
  return DEFAULT_LIMITS;
}

function saveRateLimits(limits: RateLimitRule[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(rateLimitsFile, JSON.stringify(limits, null, 2));
}

// GET /api/admin/rate-limits - List rate limits
router.get("/admin/rate-limits", requireAdminMiddleware, (_req, res): void => {
  const limits = loadRateLimits();
  res.json({ limits });
});

// PUT /api/admin/rate-limits - Replace all rate limits
router.put("/admin/rate-limits", requireAdminMiddleware, (req, res): void => {
  const { limits } = req.body as { limits?: RateLimitRule[] };
  if (!Array.isArray(limits)) { res.status(400).json({ error: "limits array is required" }); return; }
  saveRateLimits(limits);
  req.log.info({ count: limits.length }, "Rate limits updated");
  res.json({ ok: true, limits });
});

// PATCH /api/admin/rate-limits/:id - Update a single rate limit
router.patch("/admin/rate-limits/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const body = req.body as Partial<RateLimitRule>;
  const limits = loadRateLimits();
  const idx = limits.findIndex((l) => l.id === id);
  if (idx === -1) { res.status(404).json({ error: "Rate limit not found" }); return; }
  if (body.maxRequests !== undefined) limits[idx].maxRequests = body.maxRequests;
  if (body.windowMs !== undefined) limits[idx].windowMs = body.windowMs;
  if (body.enabled !== undefined) limits[idx].enabled = body.enabled;
  if (body.name !== undefined) limits[idx].name = body.name;
  if (body.description !== undefined) limits[idx].description = body.description;
  saveRateLimits(limits);
  res.json({ ok: true, limit: limits[idx] });
});

// POST /api/admin/rate-limits - Add new rate limit
router.post("/admin/rate-limits", requireAdminMiddleware, (req, res): void => {
  const body = req.body as Partial<RateLimitRule>;
  if (!body.name?.trim() || !body.path?.trim()) {
    res.status(400).json({ error: "name and path are required" });
    return;
  }
  const newLimit: RateLimitRule = {
    id: `custom_${Date.now()}`,
    name: body.name.trim(),
    path: body.path.trim(),
    method: body.method ?? "ALL",
    windowMs: body.windowMs ?? 60000,
    maxRequests: body.maxRequests ?? 60,
    plan: body.plan ?? "all",
    enabled: body.enabled ?? true,
    description: body.description,
  };
  const limits = loadRateLimits();
  limits.push(newLimit);
  saveRateLimits(limits);
  req.log.info({ limitId: newLimit.id, name: newLimit.name }, "Rate limit created");
  res.json({ ok: true, limit: newLimit });
});

// DELETE /api/admin/rate-limits/:id - Delete rate limit
router.delete("/admin/rate-limits/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const limits = loadRateLimits();
  const filtered = limits.filter((l) => l.id !== id);
  if (filtered.length === limits.length) { res.status(404).json({ error: "Rate limit not found" }); return; }
  saveRateLimits(filtered);
  req.log.info({ limitId: id }, "Rate limit deleted");
  res.json({ ok: true });
});

export default router;
