import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { requireAdminMiddleware } from "./auth";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const dataDir = path.resolve(workspaceRoot, "artifacts/api-server/data");
const apiKeysFile = path.resolve(dataDir, "api-keys.json");

interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: string;
  lastUsed?: string;
  enabled: boolean;
  permissions: string[];
}

function loadApiKeys(): ApiKey[] {
  try {
    if (fs.existsSync(apiKeysFile)) return JSON.parse(fs.readFileSync(apiKeysFile, "utf-8")) as ApiKey[];
  } catch { /* ignore */ }
  return [];
}

function saveApiKeys(keys: ApiKey[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(apiKeysFile, JSON.stringify(keys, null, 2));
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

// GET /api/admin/api-keys - List API keys
router.get("/admin/api-keys", requireAdminMiddleware, (_req, res): void => {
  const keys = loadApiKeys().map((k) => ({ ...k, key: undefined, maskedKey: k.maskedKey }));
  res.json({ keys });
});

// POST /api/admin/api-keys - Create new API key
router.post("/admin/api-keys", requireAdminMiddleware, (req, res): void => {
  const { name, permissions } = req.body as { name?: string; permissions?: string[] };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const rawKey = `ct_${crypto.randomBytes(32).toString("hex")}`;
  const newKey: ApiKey = {
    id: crypto.randomUUID(),
    name: name.trim(),
    key: rawKey,
    maskedKey: maskApiKey(rawKey),
    createdAt: new Date().toISOString(),
    enabled: true,
    permissions: permissions ?? ["read"],
  };
  const keys = loadApiKeys();
  keys.push(newKey);
  saveApiKeys(keys);
  req.log.info({ keyId: newKey.id, name: newKey.name }, "API key created");
  // Return full key only on creation
  res.json({ ok: true, key: rawKey, id: newKey.id });
});

// DELETE /api/admin/api-keys/:id - Revoke API key
router.delete("/admin/api-keys/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const keys = loadApiKeys();
  const filtered = keys.filter((k) => k.id !== id);
  if (filtered.length === keys.length) { res.status(404).json({ error: "Key not found" }); return; }
  saveApiKeys(filtered);
  req.log.info({ keyId: id }, "API key revoked");
  res.json({ ok: true });
});

// PATCH /api/admin/api-keys/:id - Toggle API key
router.patch("/admin/api-keys/:id", requireAdminMiddleware, (req, res): void => {
  const { id } = req.params;
  const { enabled } = req.body as { enabled?: boolean };
  const keys = loadApiKeys();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx === -1) { res.status(404).json({ error: "Key not found" }); return; }
  if (enabled !== undefined) keys[idx].enabled = enabled;
  saveApiKeys(keys);
  res.json({ ok: true });
});

// GET /api/admin/jwt-config - Get JWT configuration info
router.get("/admin/jwt-config", requireAdminMiddleware, (_req, res): void => {
  const jwtSecret = process.env.JWT_SECRET;
  res.json({
    secretSet: !!jwtSecret,
    isDefault: !jwtSecret,
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  });
});

// GET /api/admin/system-logs - Get recent system logs
router.get("/admin/system-logs", requireAdminMiddleware, (_req, res): void => {
  const logsDir = path.resolve(dataDir, "logs");
  const logs: Array<{ timestamp: string; level: string; message: string; meta?: string }> = [];

  try {
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir).sort().reverse().slice(0, 5);
      for (const file of files) {
        const content = fs.readFileSync(path.join(logsDir, file), "utf-8");
        const lines = content.split("\n").filter(Boolean).slice(-50);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line) as { time?: string; level?: number; msg?: string };
            logs.push({
              timestamp: parsed.time ?? new Date().toISOString(),
              level: parsed.level === 50 ? "error" : parsed.level === 40 ? "warn" : "info",
              message: parsed.msg ?? line,
            });
          } catch {
            logs.push({ timestamp: new Date().toISOString(), level: "info", message: line });
          }
        }
      }
    }
  } catch { /* ignore */ }

  // If no log files, provide some runtime info
  if (logs.length === 0) {
    logs.push(
      { timestamp: new Date().toISOString(), level: "info", message: "Server running" },
      { timestamp: new Date(Date.now() - 60000).toISOString(), level: "info", message: `Node ${process.version} | PID ${process.pid}` },
      { timestamp: new Date(Date.now() - 120000).toISOString(), level: "info", message: `Uptime: ${Math.floor(process.uptime())}s | Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB` },
    );
  }

  res.json({ logs: logs.slice(-100) });
});

export default router;
