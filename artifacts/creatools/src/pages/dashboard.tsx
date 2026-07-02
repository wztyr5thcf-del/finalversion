import { useAuth } from "@/context/auth-context";
import { UpdateCarousel } from "@/components/dashboard/update-carousel";
import { FeaturedSlider } from "@/components/dashboard/featured-slider";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import {
  Monitor, Zap, Gamepad2, Radio, Layers, BarChart2, Crown,
  ExternalLink, ChevronRight, CheckCircle2, Wifi, WifiOff,
  Star, Users, Megaphone, BookOpen, Sparkles, ArrowRight,
  Shield, Target, Tv2, TrendingUp, Gift, Eye, Swords,
  Heart, UserPlus, MessageCircle,
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

// Stat cards data - LARGER with more dramatic values
const STATS = [
  { label: "Seguidores", icon: Users, value: 12470, suffix: "", color: "#06b6d4", trend: "+12%" },
  { label: "Gifts Hoje", icon: Gift, value: 892, suffix: "", color: "#22c55e", trend: "+38%" },
  { label: "Viewers Pico", icon: Eye, value: 34200, suffix: "", color: "#a78bfa", trend: "+24%" },
  { label: "Engajamento", icon: TrendingUp, value: 94, suffix: "%", color: "#f97316", trend: "+5%" },
];

// Quick Actions data
const QUICK_ACTIONS = [
  { label: "Monitor", icon: Monitor, href: "/monitor/example", color: "#06b6d4", glow: "rgba(6,182,212,0.2)" },
  { label: "Overlays", icon: Layers, href: "/overlays", color: "#a78bfa", glow: "rgba(167,139,250,0.2)" },
  { label: "Battle AI", icon: Swords, href: "/battle-ai", color: "#ef4444", glow: "rgba(239,68,68,0.2)" },
  { label: "Jogos", icon: Gamepad2, href: "/minigames", color: "#22c55e", glow: "rgba(34,197,94,0.2)" },
];

// Live Activity Feed mock data
const ACTIVITY_FEED = [
  { id: 1, type: "gift", user: "maria_star", text: "enviou Universe x3", icon: Gift, color: "#f59e0b", time: "agora" },
  { id: 2, type: "follow", user: "lucas_99", text: "comecou a seguir voce", icon: UserPlus, color: "#06b6d4", time: "2min" },
  { id: 3, type: "like", user: "ana_live", text: "curtiu sua live 2.4K vezes", icon: Heart, color: "#ef4444", time: "5min" },
  { id: 4, type: "comment", user: "joao_fogo", text: "comentou: voce e incrivel!", icon: MessageCircle, color: "#22c55e", time: "8min" },
  { id: 5, type: "gift", user: "top_gifter", text: "enviou Rose x50", icon: Gift, color: "#f59e0b", time: "12min" },
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
    <div className="space-y-7" style={{ animation: "fade-in-up 0.5s ease-out" }}>

      {/* Welcome header - DRAMATIC banner with floating particles */}
      <div className="relative overflow-hidden rounded-3xl p-8"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(34,197,94,0.08) 40%, rgba(124,58,237,0.06) 100%)",
          border: "1px solid rgba(6,182,212,0.2)",
          boxShadow: "0 0 60px rgba(6,182,212,0.08), inset 0 0 40px rgba(6,182,212,0.03)",
        }}>
        {/* Floating particle dots */}
        <div className="absolute top-[15%] left-[10%] w-1.5 h-1.5 rounded-full pointer-events-none" style={{ background: "rgba(6,182,212,0.7)", animation: "float-particle 5s ease-in-out infinite", boxShadow: "0 0 6px rgba(6,182,212,0.5)" }} />
        <div className="absolute top-[60%] left-[80%] w-1 h-1 rounded-full pointer-events-none" style={{ background: "rgba(34,197,94,0.6)", animation: "float-particle 7s ease-in-out infinite 1s" }} />
        <div className="absolute top-[30%] left-[60%] w-1.5 h-1.5 rounded-full pointer-events-none" style={{ background: "rgba(6,182,212,0.5)", animation: "float-particle 6s ease-in-out infinite 2s" }} />
        <div className="absolute top-[70%] left-[30%] w-1 h-1 rounded-full pointer-events-none" style={{ background: "rgba(124,58,237,0.5)", animation: "float-particle 8s ease-in-out infinite 3s" }} />
        <div className="absolute top-[20%] left-[90%] w-1 h-1 rounded-full pointer-events-none" style={{ background: "rgba(34,197,94,0.5)", animation: "float-particle 9s ease-in-out infinite 4s" }} />
        {/* Animated gradient orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15), transparent 70%)", animation: "float-up-down 4s ease-in-out infinite" }} />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.1), transparent 70%)", animation: "float-up-down 5s ease-in-out infinite 1s" }} />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            {user?.tiktokProfilePicture ? (
              <img src={user.tiktokProfilePicture} alt="" className="w-16 h-16 rounded-full object-cover"
                style={{ border: "3px solid rgba(6,182,212,0.5)", boxShadow: "0 0 24px rgba(6,182,212,0.4), 0 0 48px rgba(6,182,212,0.1)" }} />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 neon-pulse"
                style={{ background: "rgba(6,182,212,0.12)", border: "3px solid rgba(6,182,212,0.4)" }}>
                <SiTiktok className="w-7 h-7 text-cyan-400" />
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] font-bold mb-1.5 text-glow-cyan" style={{ color: "rgba(6,182,212,0.7)" }}>Bem-vindo de volta</p>
              <h1 className="text-3xl font-black text-white tracking-tight">{displayName}</h1>
              {handle && (
                <p className="text-sm font-mono mt-1" style={{ color: "rgba(6,182,212,0.6)" }}>@{handle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PlanBadge plan={user?.plan ?? "free"} />
            {user?.plan !== "pro" && (
              <button
                onClick={() => setLocation("/pricing")}
                className="flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-full transition-all hover:scale-110"
                style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)", color: "white", boxShadow: "0 0 24px rgba(6,182,212,0.4), 0 4px 16px rgba(0,0,0,0.3)" }}>
                <Sparkles className="w-3.5 h-3.5" />
                Fazer upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DRAMATIC stat cards row - LARGER with animated gradient backgrounds */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <div key={stat.label} className="relative overflow-hidden p-5 rounded-2xl group cursor-default card-hover-lift"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              animationDelay: `${i * 100}ms`,
              animation: "fade-in-up 0.5s ease-out backwards",
            } as React.CSSProperties}>
            {/* Animated gradient background */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 50%, ${stat.color}15, transparent 70%)` }} />
            {/* Top line */}
            <div className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, transparent, ${stat.color}, transparent)`, opacity: 0.7 }} />
            <div className="relative flex items-center justify-between mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-all group-hover:scale-125 group-hover:rotate-3"
                style={{ background: `${stat.color}15`, boxShadow: `0 0 16px ${stat.color}25` }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", boxShadow: "0 0 8px rgba(34,197,94,0.15)" }}>
                {stat.trend}
              </span>
            </div>
            <p className="text-3xl font-black text-white mb-1 tracking-tight">
              <AnimCounter target={stat.value} suffix={stat.suffix} />
            </p>
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions Row - LARGE iconic buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.href}
            onClick={() => setLocation(action.href)}
            className="group relative overflow-hidden flex flex-col items-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.05]"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: `radial-gradient(circle at 50% 50%, ${action.glow}, transparent 70%)` }} />
            <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-2xl"
              style={{ background: `${action.color}12`, border: `1px solid ${action.color}30`, boxShadow: `0 0 12px ${action.glow}` }}>
              <action.icon className="w-6 h-6" style={{ color: action.color }} />
            </div>
            <span className="relative text-sm font-bold text-white/70 group-hover:text-white transition-colors">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Battle AI BETA Promotion Card - ANIMATED gradient border */}
      <div className="relative rounded-2xl overflow-hidden card-hover-lift cursor-pointer"
        onClick={() => setLocation("/battle-ai")}
        style={{ background: "rgba(239,68,68,0.03)" }}>
        {/* Animated gradient border */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            padding: "2px",
            background: "linear-gradient(135deg, #ef4444, #f97316, #ef4444, #ec4899)",
            backgroundSize: "300% 300%",
            animation: "gradient-rotate 4s linear infinite",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }} />
        <div className="relative p-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 neon-pulse"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", boxShadow: "0 0 20px rgba(239,68,68,0.2)" }}>
            <Swords className="w-8 h-8 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-black text-white">Battle AI</h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>BETA</span>
            </div>
            <p className="text-sm text-white/40">IA que analisa e cria estrategias de battle em tempo real para dominar suas batalhas no TikTok LIVE.</p>
          </div>
          <ArrowRight className="w-5 h-5 text-red-400/60 shrink-0" />
        </div>
      </div>

      {/* Main bento grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Left column - 2/3 width */}
        <div className="xl:col-span-2 space-y-5">

          {/* TikTok connected */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(6,182,212,0.5)" }}>Conta TikTok Conectada</p>
              <div className="flex items-center gap-1.5">
                {handle ? (
                  <>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
                    <span className="text-xs text-green-400 font-semibold">Ativa</span>
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
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.6))" }} />
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105 hover:shadow-lg"
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
                  className="group flex flex-col gap-2.5 p-4 rounded-xl text-left transition-all hover:scale-[1.04] hover:shadow-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:shadow-lg group-hover:scale-110"
                      style={{ background: `${t.color}12`, border: `1px solid ${t.color}20` }}>
                      <t.icon className="w-4.5 h-4.5" style={{ color: t.color }} />
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
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-5">

          {/* Live Activity Feed - animated slide-in entries */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <Radio className="w-3.5 h-3.5 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-white">Atividade Recente</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.6)" }} />
                <span className="text-[10px] font-bold text-green-400/70">LIVE</span>
              </div>
            </div>
            <div className="space-y-2">
              {ACTIVITY_FEED.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-white/[0.03]"
                  style={{ animation: `activity-slide 0.4s ease-out forwards`, animationDelay: `${idx * 150}ms`, opacity: 0 }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
                    <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">
                      <span className="font-bold text-white/90">@{item.user}</span> {item.text}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{item.time}</span>
                </div>
              ))}
            </div>
          </div>

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
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.03] group"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all group-hover:shadow-lg group-hover:scale-110"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}20` }}>
                    <item.icon className="w-4 h-4" style={{ color: item.color }} />
                  </div>
                  <span className="text-sm text-white/60 flex-1 group-hover:text-white/90 transition-colors font-medium">{item.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white/15 group-hover:text-cyan-400/60 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Games */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                  <Gamepad2 className="w-3.5 h-3.5 text-green-400" />
                </div>
                <p className="text-sm font-semibold text-white">Jogos / Minigames</p>
              </div>
              <button
                onClick={() => setLocation("/minigames")}
                className="text-xs font-medium flex items-center gap-1 px-2.5 py-1 rounded-full transition-all hover:scale-105"
                style={{ color: "#22c55e", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                Ver todos <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {GAME_PILLS.map((g) => (
                <button
                  key={g.href}
                  onClick={() => setLocation(g.href)}
                  className="px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105 hover:shadow-lg"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)", color: "#86efac" }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
