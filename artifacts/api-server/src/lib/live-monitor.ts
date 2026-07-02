import { db } from "@workspace/db";
import { liveSessionsTable, liveSessionEventsTable, usersTable } from "@workspace/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

const TIKTOOLS_API = "https://api.tik.tools";

// Poll interval for checking live status (60 seconds)
const POLL_INTERVAL_MS = 60_000;
// Snapshot interval for recording events during a live session (30 seconds)
const SNAPSHOT_INTERVAL_MS = 30_000;
// Profile sync interval (6 hours)
const PROFILE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const configFile = path.resolve(workspaceRoot, "artifacts/api-server/data/config.json");

function loadPersistedApiKey(): string | undefined {
  try {
    if (fs.existsSync(configFile)) {
      const cfg = JSON.parse(fs.readFileSync(configFile, "utf-8")) as { apiKey?: string };
      return cfg.apiKey || undefined;
    }
  } catch { /* ignore */ }
  return undefined;
}

function getApiKey(): string | null {
  const key = process.env.TIKTOOLS_API_KEY || loadPersistedApiKey();
  return key || null;
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ActiveSession {
  sessionId: string;
  userId: string;
  tiktokUsername: string;
  roomId: string;
  startedAt: string;
  lastSnapshot: number;
  peakViewers: number;
  currentViewers: number;
  totalGifts: number;
  totalDiamonds: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalFollows: number;
  totalNewSubscribers: number;
}

// In-memory tracking of active sessions
const activeSessions = new Map<string, ActiveSession>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let profileSyncTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Fetch the live status for a specific TikTok user.
 */
async function checkLiveStatus(apiKey: string, uniqueId: string): Promise<{ isLive: boolean; roomId: string | null }> {
  try {
    const r = await fetch(
      `${TIKTOOLS_API}/webcast/live_status?apiKey=${encodeURIComponent(apiKey)}&unique_id=${encodeURIComponent(uniqueId)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!r.ok) return { isLive: false, roomId: null };
    const json = await r.json() as { data?: { is_live?: boolean; room_id?: string } };
    return {
      isLive: json.data?.is_live ?? false,
      roomId: json.data?.room_id ?? null,
    };
  } catch {
    return { isLive: false, roomId: null };
  }
}

/**
 * Fetch room info for metrics snapshot.
 */
async function fetchRoomMetrics(apiKey: string, roomId: string): Promise<{
  viewerCount: number;
  likeCount: number;
}> {
  try {
    const r = await fetch(`${TIKTOOLS_API}/webcast/room_info?apiKey=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { viewerCount: 0, likeCount: 0 };
    const json = await r.json() as { data?: { user_count?: number; like_count?: number } };
    return {
      viewerCount: json.data?.user_count ?? 0,
      likeCount: json.data?.like_count ?? 0,
    };
  } catch {
    return { viewerCount: 0, likeCount: 0 };
  }
}

/**
 * Start tracking a live session for a user.
 */
async function startSession(userId: string, tiktokUsername: string, roomId: string): Promise<void> {
  const sessionId = makeId();
  const now = new Date().toISOString();

  await db.insert(liveSessionsTable).values({
    id: sessionId,
    userId,
    tiktokUsername,
    roomId,
    startedAt: now,
    status: "active",
  });

  activeSessions.set(tiktokUsername.toLowerCase(), {
    sessionId,
    userId,
    tiktokUsername,
    roomId,
    startedAt: now,
    lastSnapshot: Date.now(),
    peakViewers: 0,
    currentViewers: 0,
    totalGifts: 0,
    totalDiamonds: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0,
    totalFollows: 0,
    totalNewSubscribers: 0,
  });

  logger.info({ userId, tiktokUsername, roomId, sessionId }, "Live session started");
}

/**
 * End a tracked live session.
 */
async function endSession(tiktokUsername: string): Promise<void> {
  const key = tiktokUsername.toLowerCase();
  const session = activeSessions.get(key);
  if (!session) return;

  const now = new Date().toISOString();
  const startTime = new Date(session.startedAt).getTime();
  const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

  await db.update(liveSessionsTable)
    .set({
      endedAt: now,
      peakViewers: session.peakViewers,
      currentViewers: session.currentViewers,
      totalGifts: session.totalGifts,
      totalDiamonds: session.totalDiamonds,
      totalLikes: session.totalLikes,
      totalComments: session.totalComments,
      totalShares: session.totalShares,
      totalFollows: session.totalFollows,
      totalNewSubscribers: session.totalNewSubscribers,
      durationSeconds,
      status: "ended",
    })
    .where(eq(liveSessionsTable.id, session.sessionId));

  // Update user's totalLiveSessions count
  try {
    const userRows = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    const user = userRows[0];
    if (user) {
      await db.update(usersTable)
        .set({ totalLiveSessions: (user.totalLiveSessions ?? 0) + 1 })
        .where(eq(usersTable.id, session.userId));
    }
  } catch { /* best effort */ }

  activeSessions.delete(key);
  logger.info({ tiktokUsername, sessionId: session.sessionId, durationSeconds }, "Live session ended");
}

/**
 * Record a periodic snapshot for an active session.
 */
async function recordSnapshot(apiKey: string, session: ActiveSession): Promise<void> {
  const now = Date.now();
  if (now - session.lastSnapshot < SNAPSHOT_INTERVAL_MS) return;

  const metrics = await fetchRoomMetrics(apiKey, session.roomId);

  // Update peak/total viewers
  if (metrics.viewerCount > session.peakViewers) {
    session.peakViewers = metrics.viewerCount;
  }
  session.currentViewers = metrics.viewerCount; // current viewers at last snapshot
  session.totalLikes = metrics.likeCount;

  // Save snapshot event
  await db.insert(liveSessionEventsTable).values({
    id: makeId(),
    sessionId: session.sessionId,
    timestamp: new Date().toISOString(),
    viewerCount: metrics.viewerCount,
    likesInWindow: metrics.likeCount,
    giftsInWindow: 0,
    diamondsInWindow: 0,
    commentsInWindow: 0,
  });

  // Update session in DB with latest metrics
  await db.update(liveSessionsTable)
    .set({
      peakViewers: session.peakViewers,
      currentViewers: session.currentViewers,
      totalLikes: session.totalLikes,
    })
    .where(eq(liveSessionsTable.id, session.sessionId));

  session.lastSnapshot = now;
}

/**
 * Process a batch of users concurrently for live status checks.
 */
async function processBatch(apiKey: string, users: Array<{ id: string; tiktokUsername: string | null }>): Promise<void> {
  await Promise.all(users.map(async (user) => {
    const handle = user.tiktokUsername!;
    const key = handle.toLowerCase();

    try {
      const { isLive, roomId } = await checkLiveStatus(apiKey, handle);

      if (isLive && roomId && !activeSessions.has(key)) {
        // User just went live - start tracking
        await startSession(user.id, handle, roomId);
      } else if (isLive && activeSessions.has(key)) {
        // Already tracking - record snapshot
        const session = activeSessions.get(key)!;
        await recordSnapshot(apiKey, session);
      } else if (!isLive && activeSessions.has(key)) {
        // User ended their stream
        await endSession(handle);
      }
    } catch (err) {
      logger.warn({ err, tiktokUsername: handle }, "Error checking live status for user");
    }
  }));
}

// Concurrency batch size for polling
const BATCH_SIZE = 5;
// Delay between batches (ms)
const BATCH_DELAY_MS = 1000;

/**
 * Main polling cycle: check all registered users for live status.
 * Filters by monitoringEnabled and uses batched concurrency to avoid rate-limiting.
 */
async function pollLiveStatus(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    // Get all users with a tiktokUsername AND monitoringEnabled = true
    const users = await db.select({
      id: usersTable.id,
      tiktokUsername: usersTable.tiktokUsername,
    }).from(usersTable).where(
      and(
        isNotNull(usersTable.tiktokUsername),
        eq(usersTable.monitoringEnabled, true),
      )
    );

    const usersWithTiktok = users.filter((u) => u.tiktokUsername && u.tiktokUsername.trim().length > 0);

    // Process in batches of BATCH_SIZE with a delay between batches
    for (let i = 0; i < usersWithTiktok.length; i += BATCH_SIZE) {
      const batch = usersWithTiktok.slice(i, i + BATCH_SIZE);
      await processBatch(apiKey, batch);

      // Add delay between batches to avoid rate-limiting (skip delay after last batch)
      if (i + BATCH_SIZE < usersWithTiktok.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in live status poll cycle");
  }
}

/**
 * Fetch TikTok profile data from tik.tools and update user record.
 */
export async function fetchAndUpdateTiktokProfile(userId: string, tiktokUsername: string): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const r = await fetch(
      `${TIKTOOLS_API}/api/user/profile?apiKey=${encodeURIComponent(apiKey)}&uniqueId=${encodeURIComponent(tiktokUsername)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!r.ok) return;

    const json = await r.json() as {
      uniqueId?: string;
      nickname?: string;
      profilePictureUrl?: string | null;
      followerCount?: number;
    };

    if (!json.uniqueId) return;

    const updates: Record<string, unknown> = {};
    if (json.profilePictureUrl) updates.tiktokProfilePicture = json.profilePictureUrl;
    if (json.nickname) updates.tiktokDisplayName = json.nickname;
    if (json.followerCount !== undefined) updates.tiktokFollowerCount = json.followerCount;

    if (Object.keys(updates).length > 0) {
      await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
    }
  } catch (err) {
    logger.warn({ err, userId, tiktokUsername }, "Failed to fetch TikTok profile data");
  }
}

/**
 * Periodic profile sync for all users - refreshes profile picture, display name, follower count.
 */
async function syncAllProfiles(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const users = await db.select({
      id: usersTable.id,
      tiktokUsername: usersTable.tiktokUsername,
    }).from(usersTable).where(isNotNull(usersTable.tiktokUsername));

    const usersWithTiktok = users.filter((u) => u.tiktokUsername && u.tiktokUsername.trim().length > 0);

    for (const user of usersWithTiktok) {
      await fetchAndUpdateTiktokProfile(user.id, user.tiktokUsername!);
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info({ count: usersWithTiktok.length }, "Profile sync completed");
  } catch (err) {
    logger.error({ err }, "Error in profile sync cycle");
  }
}

/**
 * Cleanup: mark any sessions still "active" in DB as ended (server restart recovery).
 */
async function recoverOrphanedSessions(): Promise<void> {
  try {
    const orphaned = await db.select().from(liveSessionsTable)
      .where(eq(liveSessionsTable.status, "active"));

    for (const session of orphaned) {
      const startTime = new Date(session.startedAt).getTime();
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

      await db.update(liveSessionsTable)
        .set({
          endedAt: new Date().toISOString(),
          durationSeconds,
          status: "ended",
        })
        .where(eq(liveSessionsTable.id, session.id));
    }

    if (orphaned.length > 0) {
      logger.info({ count: orphaned.length }, "Recovered orphaned live sessions from previous run");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to recover orphaned sessions");
  }
}

/**
 * Start the live monitoring service.
 * Should be called once on server startup.
 */
export async function startLiveMonitor(): Promise<void> {
  logger.info("Starting live monitor service");

  // Warn if API key is not configured
  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn("TIKTOOLS_API_KEY is not set and no config.json API key found. Live monitoring will be inert until an API key is configured.");
  }

  // Recover any orphaned sessions from previous server instance
  await recoverOrphanedSessions();

  // Start polling for live status
  pollTimer = setInterval(() => {
    void pollLiveStatus();
  }, POLL_INTERVAL_MS);

  // Run first poll immediately
  void pollLiveStatus();

  // Start periodic profile sync
  profileSyncTimer = setInterval(() => {
    void syncAllProfiles();
  }, PROFILE_SYNC_INTERVAL_MS);

  // Run initial profile sync after a short delay (give server time to fully start)
  setTimeout(() => {
    void syncAllProfiles();
  }, 30_000);

  logger.info("Live monitor service started successfully");
}

/**
 * Stop the live monitoring service (for graceful shutdown).
 */
export function stopLiveMonitor(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (profileSyncTimer) {
    clearInterval(profileSyncTimer);
    profileSyncTimer = null;
  }
  logger.info("Live monitor service stopped");
}
