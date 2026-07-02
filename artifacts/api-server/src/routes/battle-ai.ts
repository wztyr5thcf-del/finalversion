import { Router, type IRouter, type Request } from "express";
import { requireAuth, requireAdminMiddleware } from "./auth";
import {
  getBattleAiConfig,
  upsertBattleAiConfig,
  createSession,
  getSessionsByUser,
  getSessionById,
  updateSession,
  getAllSessions,
} from "../lib/battle-ai-store";

const router: IRouter = Router();
type AuthReq = Request & { userId: string };

// ── GET /battle-ai/config - Public config for users ───────────────────────────
router.get("/battle-ai/config", async (_req, res): Promise<void> => {
  let config = await getBattleAiConfig();
  if (!config) {
    config = await upsertBattleAiConfig({});
  }

  let availableAvatars: unknown = [];
  try {
    availableAvatars = JSON.parse(config.availableAvatars);
  } catch {
    availableAvatars = [];
  }

  let planRestrictions: unknown = { free: false, basic: false, pro: true };
  try {
    planRestrictions = JSON.parse(config.planRestrictions);
  } catch {
    planRestrictions = { free: false, basic: false, pro: true };
  }

  // Return public-facing config (exclude internal fields)
  res.json({
    enabled: config.enabled,
    availableAvatars,
    pricePerSession: config.pricePerSession,
    maxSessionDuration: config.maxSessionDuration,
    planRestrictions,
  });
});

// ── POST /battle-ai/sessions - Create a new session ───────────────────────────
router.post("/battle-ai/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { avatarConfig, tiktokUsername, rtmpUrl } = req.body as {
    avatarConfig?: string;
    tiktokUsername?: string;
    rtmpUrl?: string;
  };

  if (!avatarConfig || !tiktokUsername || !rtmpUrl) {
    res.status(400).json({ error: "avatarConfig, tiktokUsername and rtmpUrl are required" });
    return;
  }

  if (!rtmpUrl.startsWith("rtmp://") && !rtmpUrl.startsWith("rtmps://")) {
    res.status(400).json({ error: "rtmpUrl must start with rtmp:// or rtmps://" });
    return;
  }

  const config = await getBattleAiConfig();
  if (config && !config.enabled) {
    res.status(503).json({ error: "Battle AI esta desativado no momento." });
    return;
  }

  const session = await createSession({
    userId,
    avatarConfig,
    tiktokUsername,
    rtmpUrl,
  });

  res.status(201).json({ session });
});

// ── GET /battle-ai/sessions - List user's sessions ────────────────────────────
router.get("/battle-ai/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const sessions = await getSessionsByUser(userId);
  res.json({ sessions });
});

// ── POST /battle-ai/sessions/:id/start - Start streaming ─────────────────────
router.post("/battle-ai/sessions/:id/start", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { id } = req.params as { id: string };

  const session = await getSessionById(id);
  if (!session || session.userId !== userId) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status === "streaming") {
    res.status(400).json({ error: "Session already streaming" });
    return;
  }

  // Mock HeyGen API integration
  const heygenApiKey = process.env.HEYGEN_API_KEY;
  if (!heygenApiKey) {
    // In development/mock mode, simulate HeyGen session creation
    const mockHeygenSessionId = `heygen_mock_${Date.now().toString(36)}`;
    const updated = await updateSession(id, {
      status: "streaming",
      heygenSessionId: mockHeygenSessionId,
      startedAt: new Date().toISOString(),
    });
    res.json({ session: updated, mock: true, message: "Sessao iniciada (modo mock - HEYGEN_API_KEY nao configurada)" });
    return;
  }

  // Placeholder for real HeyGen Streaming Avatar API call
  // In production, this would call: POST https://api.heygen.com/v1/streaming.new
  // with the avatar config and RTMP URL
  const mockHeygenSessionId = `heygen_${Date.now().toString(36)}`;
  const updated = await updateSession(id, {
    status: "streaming",
    heygenSessionId: mockHeygenSessionId,
    startedAt: new Date().toISOString(),
  });

  res.json({ session: updated });
});

// ── POST /battle-ai/sessions/:id/stop - Stop streaming ───────────────────────
router.post("/battle-ai/sessions/:id/stop", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { id } = req.params as { id: string };

  const session = await getSessionById(id);
  if (!session || session.userId !== userId) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.status !== "streaming") {
    res.status(400).json({ error: "Session is not streaming" });
    return;
  }

  // In production, this would call: POST https://api.heygen.com/v1/streaming.stop
  const updated = await updateSession(id, {
    status: "idle",
    endedAt: new Date().toISOString(),
  });

  res.json({ session: updated });
});

// ── GET /battle-ai/admin/config - Admin get full config ───────────────────────
router.get("/battle-ai/admin/config", requireAdminMiddleware, async (_req, res): Promise<void> => {
  let config = await getBattleAiConfig();
  if (!config) {
    config = await upsertBattleAiConfig({});
  }
  res.json({ config });
});

// ── PUT /battle-ai/admin/config - Admin update config ─────────────────────────
router.put("/battle-ai/admin/config", requireAdminMiddleware, async (req, res): Promise<void> => {
  const body = req.body as Partial<{
    availableAvatars: string;
    pricePerSession: number;
    planRestrictions: string;
    maxSessionDuration: number;
    enabled: boolean;
  }>;
  const config = await upsertBattleAiConfig(body);
  res.json({ config });
});

// ── GET /battle-ai/admin/sessions - Admin list all sessions ───────────────────
router.get("/battle-ai/admin/sessions", requireAdminMiddleware, async (_req, res): Promise<void> => {
  const sessions = await getAllSessions();
  res.json({ sessions });
});

// ── POST /battle-ai/admin/sessions/:id/stop - Admin force-stop a session ──────
router.post("/battle-ai/admin/sessions/:id/stop", requireAdminMiddleware, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };

  const session = await getSessionById(id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const updated = await updateSession(id, {
    status: "stopped",
    endedAt: new Date().toISOString(),
  });

  res.json({ session: updated });
});

export default router;
