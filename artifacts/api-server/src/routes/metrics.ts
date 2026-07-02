import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { liveSessionsTable, liveSessionEventsTable, usersTable } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAuth } from "./auth";

const router = Router();

// GET /metrics/sessions - list current user's live sessions with pagination
router.get("/metrics/sessions", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const { page = "1", limit = "20" } = req.query as { page?: string; limit?: string };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    const [sessions, countResult] = await Promise.all([
      db.select().from(liveSessionsTable)
        .where(eq(liveSessionsTable.userId, userId))
        .orderBy(desc(liveSessionsTable.startedAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: sql<string>`count(*)` }).from(liveSessionsTable)
        .where(eq(liveSessionsTable.userId, userId)),
    ]);

    const total = parseInt(countResult[0]?.count ?? "0", 10);

    res.json({
      sessions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch sessions");
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// GET /metrics/sessions/:id - session detail with time-series events
router.get("/metrics/sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;
  const sessionId = String(req.params.id);

  try {
    const sessions = await db.select().from(liveSessionsTable)
      .where(and(eq(liveSessionsTable.id, sessionId), eq(liveSessionsTable.userId, userId)));

    const session = sessions[0];
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const events = await db.select().from(liveSessionEventsTable)
      .where(eq(liveSessionEventsTable.sessionId, sessionId))
      .orderBy(liveSessionEventsTable.timestamp);

    res.json({ session, events });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch session detail");
    res.status(500).json({ error: "Failed to fetch session detail" });
  }
});

// GET /metrics/leaderboard - global leaderboard (top users by diamonds, viewers, hours live)
router.get("/metrics/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const { sortBy = "diamonds", limit = "20" } = req.query as { sortBy?: string; limit?: string };
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  try {
    let orderColumn;
    switch (sortBy) {
      case "viewers":
        orderColumn = sql`sum(${liveSessionsTable.peakViewers})`;
        break;
      case "hours":
        orderColumn = sql`sum(${liveSessionsTable.durationSeconds})`;
        break;
      case "diamonds":
      default:
        orderColumn = sql`sum(${liveSessionsTable.totalDiamonds})`;
        break;
    }

    const leaderboard = await db
      .select({
        userId: liveSessionsTable.userId,
        tiktokUsername: liveSessionsTable.tiktokUsername,
        totalDiamonds: sql<number>`coalesce(sum(${liveSessionsTable.totalDiamonds}), 0)::int`,
        totalViewers: sql<number>`coalesce(max(${liveSessionsTable.peakViewers}), 0)::int`,
        totalHoursLive: sql<number>`coalesce(sum(${liveSessionsTable.durationSeconds}), 0)::int`,
        totalSessions: sql<number>`count(*)::int`,
        totalLikes: sql<number>`coalesce(sum(${liveSessionsTable.totalLikes}), 0)::int`,
        totalGifts: sql<number>`coalesce(sum(${liveSessionsTable.totalGifts}), 0)::int`,
      })
      .from(liveSessionsTable)
      .where(eq(liveSessionsTable.status, "ended"))
      .groupBy(liveSessionsTable.userId, liveSessionsTable.tiktokUsername)
      .orderBy(desc(orderColumn))
      .limit(limitNum);

    // Enrich with user profile data
    const enriched = await Promise.all(
      leaderboard.map(async (entry) => {
        const userRows = await db.select({
          tiktokProfilePicture: usersTable.tiktokProfilePicture,
          tiktokDisplayName: usersTable.tiktokDisplayName,
          tiktokFollowerCount: usersTable.tiktokFollowerCount,
        }).from(usersTable).where(eq(usersTable.id, entry.userId));
        const user = userRows[0];
        return {
          ...entry,
          totalHoursLive: Math.round(entry.totalHoursLive / 3600 * 100) / 100,
          profilePicture: user?.tiktokProfilePicture ?? null,
          displayName: user?.tiktokDisplayName ?? entry.tiktokUsername,
          followerCount: user?.tiktokFollowerCount ?? null,
        };
      })
    );

    res.json({ leaderboard: enriched, sortBy });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch leaderboard");
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /metrics/stats - current user's aggregate stats
router.get("/metrics/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as Request & { userId: string }).userId;

  try {
    const statsResult = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        totalDiamonds: sql<number>`coalesce(sum(${liveSessionsTable.totalDiamonds}), 0)::int`,
        totalLikes: sql<number>`coalesce(sum(${liveSessionsTable.totalLikes}), 0)::int`,
        totalGifts: sql<number>`coalesce(sum(${liveSessionsTable.totalGifts}), 0)::int`,
        totalComments: sql<number>`coalesce(sum(${liveSessionsTable.totalComments}), 0)::int`,
        totalShares: sql<number>`coalesce(sum(${liveSessionsTable.totalShares}), 0)::int`,
        totalFollows: sql<number>`coalesce(sum(${liveSessionsTable.totalFollows}), 0)::int`,
        peakViewers: sql<number>`coalesce(max(${liveSessionsTable.peakViewers}), 0)::int`,
        totalDurationSeconds: sql<number>`coalesce(sum(${liveSessionsTable.durationSeconds}), 0)::int`,
        avgDurationSeconds: sql<number>`coalesce(avg(${liveSessionsTable.durationSeconds}), 0)::int`,
      })
      .from(liveSessionsTable)
      .where(and(eq(liveSessionsTable.userId, userId), eq(liveSessionsTable.status, "ended")));

    const stats = statsResult[0] ?? {
      totalSessions: 0,
      totalDiamonds: 0,
      totalLikes: 0,
      totalGifts: 0,
      totalComments: 0,
      totalShares: 0,
      totalFollows: 0,
      peakViewers: 0,
      totalDurationSeconds: 0,
      avgDurationSeconds: 0,
    };

    // Check if user is currently live
    const activeSession = await db.select().from(liveSessionsTable)
      .where(and(eq(liveSessionsTable.userId, userId), eq(liveSessionsTable.status, "active")));

    res.json({
      ...stats,
      totalHoursLive: Math.round(stats.totalDurationSeconds / 3600 * 100) / 100,
      avgSessionMinutes: Math.round(stats.avgDurationSeconds / 60),
      isCurrentlyLive: activeSession.length > 0,
      currentSession: activeSession[0] ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user stats");
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

export default router;
