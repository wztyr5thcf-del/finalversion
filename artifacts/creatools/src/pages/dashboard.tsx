import { useAuth } from "@/context/auth-context";
import { UpdateCarousel } from "@/components/dashboard/update-carousel";
import { FeaturedSlider } from "@/components/dashboard/featured-slider";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Monitor, Zap, Gamepad2, Radio, Layers, BarChart2, Crown,
  ExternalLink, ChevronRight, CheckCircle2, Wifi, WifiOff,
  Star, Users, Megaphone, BookOpen, Sparkles, ArrowRight,
  Shield, Target, Tv2, TrendingUp, Gift, Eye,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

// Feature pill data
const OVERLAY_PILLS = [
  { label: "Likes",         href: "/overlays/likes" },
  { label: "Battle",        href: "/overlays/battle",       badge: "PRO" },
  { label: "Coins",         href: "/overlays/coins" },
  { label: "MVP",           href: "/overlays/mvp" },
  { label: "Pote",          href: "/overlays/pote" },
  { label: "Gifts",         href: "/overlays/gifts" },
  { label: "WhatsApp",      href: "/overlays/whatsapp" },
  { label: "Notificacoes",  href: "/overlays/notificacoes" },
  { label: "Level Up",      href: "/overlays/level-up" },
  { label: "Gamer",         href: "/overlays/gamer",        badge: "PRO" },
  { label: "Share",         href: "/overlays/share" },
  { label: "Top Gifters",   href: "/overlays/top-gifters" },
];

const TOOL_CARDS = [
  { label: "Eventos",         icon: Zap,       href: "/events",        badge: "PRO",  color: "#f97316" },
  { label: "Alertas Sonoros", icon: Radio,     href: "/sound-alerts",  badge: null,   color: "#22d3ee" },
  { label: "Layout OBS",      icon: Monitor,   href: "/layout",        badge: "PRO",  color: "#a78bfa" },
  { label: "Effect Battle",   icon: Sparkles,  href: "/effect-battle", badge: "PRO",  color: "#ec4899" },
  { label: "Troll Gift",      icon: Target,    href: "/troll-gift",    badge: "APP",  color: "#22d3ee" },
  { label: "Album",           icon: Layers,    href: "/album",         badge: null,   color: "#34d399" },
];

const GAME_PILLS = [
  { label: "Roleta",        href: "/minigames/roleta" },
  { label: "Word Bomb",     href: "/minigames/word-bomb" },
  { label: "Verdade/Mito",  href: "/minigames/sentido" },
  { label: "Defender",      href: "/minigames/defender" },
  { label: "Bau",           href: "/minigames/bau" },
];

// Animated counter component
function AnimCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number;
    const duration = 1500;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{val.toLocaleString("pt-BR")}{suffix}</>;
}

// Stat cards data
const STATS = [
  { label: "Seguidores", icon: Users, value: 1247, suffix: "", color: "#06b6d4", trend: "+12%" },
  { label: "Gifts Hoje", icon: Gift, value: 89, suffix: "", color: "#22c55e", trend: "+8%" },
  { label: "Viewers Pico", icon: Eye, value: 3420, suffix: "", color: "#a78bfa", trend: "+24%" },
  { label: "Engajamento", icon: TrendingUp, value: 94, suffix: "%", color: "#f97316", trend: "+5%" },
];

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    free:  { bg: "rgba(156,163,175,0.15)", text: "#9ca3af", label: "Gratuito" },
    basic: { bg: "rgba(34,211,238,0.15)",  text: "#22d3ee", label: "Basic" },
    pro:   { bg: "rgba(249,115,22,0.2)",   text: "#f97316", label: "PRO" },
  };
  const c = colors[plan] ?? colors.free;
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const displayName = user?.tiktokDisplayName ?? user?.name ?? "Criador";
  const handle = user?.tiktokUsername;

  return (
    <div className="space-y-6" style={{ animation: "fade-in-up 0.5s ease-out" }}>

      {/* Welcome header - full width banner with animated gradient */}
      <div className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(34,197,94,0.06) 50%, rgba(124,58,237,0.04) 100%)",
          border: "1px solid rgba(6,182,212,0.15)",
          boxShadow: "0 0 40px rgba(6,182,212,0.05)",
        }}>
        {/* Animated gradient orb */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)", animation: "float-up-down 4s ease-in-out infinite" }} />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.08), transparent 70%)", animation: "float-up-down 5s ease-in-out infinite 1s" }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user?.tiktokProfilePicture ? (
              <img src={user.tiktokProfilePicture} alt="" className="w-14 h-14 rounded-full object-cover"
                style={{ border: "2px solid rgba(6,182,212,0.4)", boxShadow: "0 0 16px rgba(6,182,212,0.3)" }} />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "rgba(6,182,212,0.12)", border: "2px solid rgba(6,182,212,0.3)", boxShadow: "0 0 16px rgba(6,182,212,0.2)" }}>
                <SiTiktok className="w-6 h-6 text-cyan-400" />
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{ color: "rgba(6,182,212,0.5)" }}>Bem-vindo de volta</p>
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              {handle && (
                <p className="text-sm font-mono mt-0.5" style={{ color: "rgba(6,182,212,0.6)" }}>@{handle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PlanBadge plan={user?.plan ?? "free"} />
            {user?.plan !== "pro" && (
              <button
                onClick={() => setLocation("/pricing")}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-full transition-all hover:scale-105"
                style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)", color: "white", boxShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
                <Sparkles className="w-3.5 h-3.5" />
                Fazer upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animated stat cards row - bento style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="stat-card p-4 rounded-2xl group cursor-default"
            style={{ "--stat-color": stat.color, animationDelay: `${i * 100}ms`, animation: "fade-in-up 0.5s ease-out backwards" } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                style={{ background: `${stat.color}15`, boxShadow: `0 0 12px ${stat.color}20` }}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                {stat.trend}
              </span>
            </div>
            <p className="text-2xl font-black text-white mb-0.5">
              <AnimCounter target={stat.value} suffix={stat.suffix} />
            </p>
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Main bento grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Left column - 2/3 width */}
        <div className="xl:col-span-2 space-y-4">

          {/* TikTok connected */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(6,182,212,0.5)" }}>Conta TikTok Conectada</p>
              <div className="flex items-center gap-1.5">
                {handle ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.5)" }} />
                    <span className="text-xs text-green-400 font-medium">Ativa</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs text-red-400 font-medium">Nao vinculada</span>
                  </>
                )}
              </div>
            </div>
            {handle ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
                  style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)", boxShadow: "0 0 12px rgba(6,182,212,0.1)" }}>
                  <SiTiktok className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{user?.tiktokDisplayName ?? handle}</p>
                  <p className="text-sm font-mono" style={{ color: "rgba(6,182,212,0.5)" }}>@{handle}</p>
                  {user?.tiktokFollowerCount && user.tiktokFollowerCount > 0 && (
                    <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <Users className="w-3 h-3" />
                      {user.tiktokFollowerCount.toLocaleString("pt-BR")} seguidores
                    </p>
                  )}
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" style={{ filter: "drop-shadow(0 0 4px rgba(34,197,94,0.5))" }} />
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <WifiOff className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-300">Nenhuma conta vinculada</p>
                  <p className="text-xs text-red-300/60">Seu @ do TikTok e necessario para as ferramentas funcionarem.</p>
                </div>
              </div>
            )}
          </div>

          {/* Update carousel */}
          <UpdateCarousel />

          {/* Overlays - bento card */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.1)" }}>
                  <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-sm font-semibold text-white">Sobreposicoes</p>
              </div>
              <button
                onClick={() => setLocation("/overlays")}
                className="text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-full transition-all hover:scale-105"
                style={{ color: "#06b6d4", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                Ver todas <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {OVERLAY_PILLS.map((p) => (
                <button
                  key={p.href}
                  onClick={() => setLocation(p.href)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105"
                  style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.12)", color: "#67e8f9" }}>
                  {p.label}
                  {p.badge && (
                    <span className="text-[9px] font-bold" style={{ color: "#f97316" }}>{p.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tools - bento grid */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(249,115,22,0.1)" }}>
                <Zap className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <p className="text-sm font-semibold text-white">Ferramentas</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {TOOL_CARDS.map((t) => (
                <button
                  key={t.href}
                  onClick={() => setLocation(t.href)}
                  className="group flex flex-col gap-2.5 p-3.5 rounded-xl text-left transition-all hover:scale-[1.03]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:shadow-lg"
                      style={{ background: `${t.color}12`, border: `1px solid ${t.color}20` }}>
                      <t.icon className="w-4 h-4" style={{ color: t.color }} />
                    </div>
                    {t.badge && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: t.badge === "PRO" ? "rgba(249,115,22,0.15)" : "rgba(34,211,238,0.12)",
                                 color: t.badge === "PRO" ? "#f97316" : "#22d3ee" }}>
                        {t.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white/70 group-hover:text-white transition-colors">{t.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Games */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.1)" }}>
                  <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-sm font-semibold text-white">Jogos / Minigames</p>
              </div>
              <button
                onClick={() => setLocation("/minigames")}
                className="text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-full transition-all hover:scale-105"
                style={{ color: "#06b6d4", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                Ver todos <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {GAME_PILLS.map((g) => (
                <button
                  key={g.href}
                  onClick={() => setLocation(g.href)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)", color: "#86efac" }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-4">
          {/* Featured slides */}
          <FeaturedSlider />

          {/* Quick access */}
          <div className="glass-card rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4" style={{ color: "rgba(6,182,212,0.5)" }}>Acesso Rapido</p>
            <div className="space-y-2">
              {[
                { label: "Monitor Live",   icon: Wifi,     href: handle ? `/monitor/${handle}` : "/monitor/example", color: "#22d3ee" },
                { label: "Rankings",       icon: Crown,    href: "/leaderboards",  color: "#f97316" },
                { label: "Gifters",        icon: Star,     href: "/gifters",       color: "#a78bfa" },
                { label: "Live Analytics", icon: BarChart2, href: "/live-analytics", color: "#34d399" },
                { label: "Integracoes",   icon: Tv2,      href: "/integracoes",   color: "#f472b6" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => setLocation(item.href)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.02] group"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all group-hover:shadow-lg"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}18` }}>
                    <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <span className="text-sm text-white/60 flex-1 group-hover:text-white/80 transition-colors">{item.label}</span>
                  <ArrowRight className="w-3 h-3 text-white/15 group-hover:text-cyan-400/50 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Blog / Updates */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.1)" }}>
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <p className="text-sm font-semibold text-white">Novidades</p>
              </div>
              <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>Em breve</span>
            </div>
            <div className="space-y-2.5">
              {[
                { title: "Novos overlays disponiveis para live", date: "1 jul." },
                { title: "Como usar o Effect Battle em sua live", date: "28 jun." },
                { title: "Guia completo de Gifters e Rankings", date: "20 jun." },
              ].map((post, i) => (
                <div key={i} className="flex gap-3 items-start p-2.5 rounded-xl transition-all hover:bg-white/[0.03] cursor-pointer group">
                  <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
                    style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.1)" }}>
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/70 line-clamp-2 leading-snug group-hover:text-white/90 transition-colors">{post.title}</p>
                    <p className="text-[10px] mt-1 font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>{post.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
