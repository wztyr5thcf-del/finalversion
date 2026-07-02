import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, Clock, Diamond, Heart, Users2, Activity, Trophy, TrendingUp,
  Loader2, Radio, Award, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, authFetch } from "@/context/auth-context";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface UserStats {
  totalSessions: number;
  totalDiamonds: number;
  totalLikes: number;
  totalGifts: number;
  totalComments: number;
  totalShares: number;
  totalFollows: number;
  peakViewers: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  totalHoursLive: number;
  avgSessionMinutes: number;
  isCurrentlyLive: boolean;
  currentSession: unknown | null;
}

interface Session {
  id: string;
  tiktokUsername: string;
  startedAt: string;
  endedAt: string | null;
  peakViewers: number;
  totalViewers: number;
  totalDiamonds: number;
  totalLikes: number;
  totalGifts: number;
  totalComments: number;
  durationSeconds: number;
  status: string;
}

interface LeaderboardEntry {
  userId: string;
  tiktokUsername: string;
  totalDiamonds: number;
  totalViewers: number;
  totalHoursLive: number;
  totalSessions: number;
  totalLikes: number;
  totalGifts: number;
  profilePicture: string | null;
  displayName: string;
  followerCount: number | null;
}

export default function Analytics() {
  const { token } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [statsData, sessionsData, leaderboardData] = await Promise.all([
        authFetch("/metrics/stats", token) as Promise<UserStats>,
        authFetch("/metrics/sessions?limit=50", token) as Promise<{ sessions: Session[] }>,
        authFetch("/metrics/leaderboard?sortBy=diamonds&limit=10", token) as Promise<{ leaderboard: LeaderboardEntry[] }>,
      ]);
      setStats(statsData);
      setSessions(sessionsData.sessions ?? []);
      setLeaderboard(leaderboardData.leaderboard ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { void fetchData(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Prepare chart data from sessions
  const sessionChartData = sessions
    .filter((s) => s.status === "ended")
    .slice(0, 20)
    .reverse()
    .map((s, idx) => ({
      name: new Date(s.startedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      viewers: s.peakViewers,
      diamonds: s.totalDiamonds,
      likes: s.totalLikes,
      duration: Math.round(s.durationSeconds / 60),
      index: idx,
    }));

  const durationChartData = sessions
    .filter((s) => s.status === "ended")
    .slice(0, 20)
    .reverse()
    .map((s) => ({
      name: new Date(s.startedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      minutos: Math.round(s.durationSeconds / 60),
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-purple-400" />
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suas estatisticas de live, historico de sessoes e rankings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats?.isCurrentlyLive && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              <Radio className="w-3 h-3 mr-1" /> AO VIVO
            </Badge>
          )}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 font-medium">Auto-refresh 30s</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void fetchData(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Sessoes", value: stats.totalSessions, icon: Activity, color: "#a78bfa" },
            { label: "Horas Live", value: stats.totalHoursLive.toFixed(1), icon: Clock, color: "#22d3ee" },
            { label: "Pico Viewers", value: stats.peakViewers, icon: Users2, color: "#f59e0b" },
            { label: "Total Diamonds", value: stats.totalDiamonds.toLocaleString(), icon: Diamond, color: "#ec4899" },
            { label: "Total Likes", value: stats.totalLikes.toLocaleString(), icon: Heart, color: "#f97316" },
            { label: "Total Gifts", value: stats.totalGifts.toLocaleString(), icon: Award, color: "#8b5cf6" },
            { label: "Seguidores via Live", value: stats.totalFollows, icon: TrendingUp, color: "#22c55e" },
            { label: "Media/Sessao", value: `${stats.avgSessionMinutes}m`, icon: BarChart2, color: "#06b6d4" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 p-4" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {sessionChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Viewers chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users2 className="w-4 h-4 text-amber-400" />Pico de Viewers por Sessao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sessionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#1a1625", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Area type="monotone" dataKey="viewers" stroke="#f59e0b" fill="rgba(245,158,11,0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Diamonds chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Diamond className="w-4 h-4 text-pink-400" />Diamonds por Sessao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sessionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#1a1625", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Bar dataKey="diamonds" fill="#ec4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Duration chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />Duracao das Lives (minutos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={durationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#1a1625", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Line type="monotone" dataKey="minutos" stroke="#22d3ee" strokeWidth={2} dot={{ fill: "#22d3ee", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Likes chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Heart className="w-4 h-4 text-orange-400" />Likes por Sessao
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sessionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "#1a1625", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                  />
                  <Area type="monotone" dataKey="likes" stroke="#f97316" fill="rgba(249,115,22,0.15)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />Leaderboard Global
          </CardTitle>
          <CardDescription>Top streamers por total de diamonds recebidos.</CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de leaderboard ainda.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div key={entry.userId} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: idx < 3 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm"
                    style={{
                      background: idx === 0 ? "rgba(245,158,11,0.2)" : idx === 1 ? "rgba(156,163,175,0.2)" : idx === 2 ? "rgba(180,83,9,0.2)" : "rgba(255,255,255,0.05)",
                      color: idx === 0 ? "#f59e0b" : idx === 1 ? "#9ca3af" : idx === 2 ? "#b45309" : "rgba(255,255,255,0.4)",
                    }}>
                    {idx + 1}
                  </div>
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10">
                    {entry.profilePicture ? (
                      <img src={entry.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-500/20 text-purple-400 text-xs font-bold">
                        {entry.displayName[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{entry.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{entry.tiktokUsername}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-center">
                      <p className="font-bold text-pink-400">{entry.totalDiamonds.toLocaleString()}</p>
                      <p className="text-muted-foreground">diamonds</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-white">{entry.totalHoursLive.toFixed(1)}h</p>
                      <p className="text-muted-foreground">live</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-white">{entry.totalSessions}</p>
                      <p className="text-muted-foreground">sessoes</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent sessions table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historico de Sessoes</CardTitle>
          <CardDescription>Suas ultimas lives com metricas detalhadas.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma sessao registrada ainda. Inicie uma live no TikTok para comecar!</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 15).map((session) => (
                <div key={session.id} className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {new Date(session.startedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <Badge className={`text-xs ${session.status === "active" ? "bg-red-500/15 text-red-400 border-red-500/20" : "bg-muted/30 text-muted-foreground"}`}>
                        {session.status === "active" ? "Ao Vivo" : "Encerrada"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Duracao: {Math.round(session.durationSeconds / 60)}m
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0">
                    <div className="text-center">
                      <p className="font-bold text-amber-400">{session.peakViewers}</p>
                      <p className="text-muted-foreground">viewers</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-pink-400">{session.totalDiamonds}</p>
                      <p className="text-muted-foreground">diamonds</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-orange-400">{session.totalLikes}</p>
                      <p className="text-muted-foreground">likes</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-purple-400">{session.totalGifts}</p>
                      <p className="text-muted-foreground">gifts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
