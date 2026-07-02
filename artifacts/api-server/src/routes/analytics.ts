import { Router, type IRouter } from "express";
import { requireAdminMiddleware } from "./auth";
import { getAllUsers } from "../lib/users-store";

const router: IRouter = Router();

// GET /api/admin/analytics - Aggregated platform analytics
router.get("/admin/analytics", requireAdminMiddleware, async (_req, res): Promise<void> => {
  const users = await getAllUsers();
  const now = new Date();

  // User signups over time (last 30 days)
  const signupsByDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    signupsByDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const u of users) {
    const date = (u as { createdAt?: string }).createdAt;
    if (date) {
      const day = new Date(date).toISOString().slice(0, 10);
      if (signupsByDay[day] !== undefined) signupsByDay[day]++;
    }
  }

  // Plan distribution
  const planDistribution: Record<string, number> = { free: 0, basic: 0, pro: 0 };
  for (const u of users) {
    planDistribution[u.plan] = (planDistribution[u.plan] ?? 0) + 1;
  }

  // Active users (logged in within last 7 days) - approximate by checking if user has activity
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activeUsers = users.filter((u) => {
    const lastLogin = (u as { lastLoginAt?: string }).lastLoginAt;
    if (lastLogin) return new Date(lastLogin) > sevenDaysAgo;
    return false;
  }).length;

  // Revenue estimate (based on plan counts)
  const planPrices: Record<string, number> = { free: 0, basic: 1990, pro: 4990 };
  const monthlyRevenue = Object.entries(planDistribution).reduce(
    (sum, [plan, count]) => sum + (planPrices[plan] ?? 0) * count, 0
  );

  // Users with TikTok connected
  const connectedTiktok = users.filter((u) => !!(u as { tiktokUsername?: string }).tiktokUsername).length;

  res.json({
    signupsByDay,
    planDistribution,
    activeUsers,
    totalUsers: users.length,
    monthlyRevenue,
    connectedTiktok,
    newUsersToday: signupsByDay[now.toISOString().slice(0, 10)] ?? 0,
    newUsersThisWeek: Object.entries(signupsByDay)
      .filter(([day]) => new Date(day) > sevenDaysAgo)
      .reduce((sum, [, count]) => sum + count, 0),
  });
});

export default router;
