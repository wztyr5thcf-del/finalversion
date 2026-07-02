import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { SiTiktok } from "react-icons/si";
import {
  Eye, EyeOff, LogIn, UserPlus, Search, CheckCircle2,
  XCircle, Loader2, AlertCircle, Users, ArrowRight,
  Radio, Monitor, Trophy, Zap, TrendingUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";

type Mode = "login" | "register";
type RegStep = "account" | "tiktok";

interface TikProfile {
  exists: boolean | null;
  uniqueId: string;
  reason?: string;
  nickname?: string | null;
  profilePictureUrl?: string | null;
  followerCount?: number;
  verified?: boolean;
  error?: string;
}

// Animated counter
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const step = Math.ceil(target / 60);
    const timer = setInterval(() => {
      setVal((v) => {
        if (v + step >= target) { clearInterval(timer); return target; }
        return v + step;
      });
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <>{val.toLocaleString("pt-BR")}{suffix}</>;
}

// Mock top streamers
const TOP_STREAMERS = [
  { handle: "streamer1", followers: "5.9M", color: "from-pink-500 to-purple-600" },
  { handle: "streamer2", followers: "3.7M", color: "from-cyan-500 to-blue-600" },
  { handle: "streamer3", followers: "690K", color: "from-orange-500 to-red-600" },
  { handle: "streamer4", followers: "424K", color: "from-green-500 to-teal-600" },
  { handle: "streamer5", followers: "120K", color: "from-violet-500 to-indigo-600" },
];

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [regStep, setRegStep] = useState<RegStep>("account");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [tiktokHandle, setTiktokHandle] = useState("");
  const [tikProfile, setTikProfile] = useState<TikProfile | null>(null);
  const [tikLooking, setTikLooking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();

  // TikTok OAuth error from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (oauthError === "tiktok_denied") setError("Você cancelou o login com TikTok.");
    else if (oauthError) setError("Erro ao fazer login com TikTok. Tente novamente.");
    if (oauthError) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Debounced TikTok username lookup
  useEffect(() => {
    const handle = tiktokHandle.trim().replace(/^@/, "");
    if (!handle || handle.length < 2) { setTikProfile(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setTikLooking(true);
      try {
        const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
        const r = await fetch(`${BASE}/api/tiktok/verify-username?uniqueId=${encodeURIComponent(handle)}`);
        const data = await r.json() as TikProfile;
        setTikProfile({ ...data, uniqueId: handle });
      } catch {
        setTikProfile({ exists: null, uniqueId: handle, error: "lookup_failed" });
      } finally { setTikLooking(false); }
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [tiktokHandle]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado");
    } finally { setLoading(false); }
  }

  async function handleRegisterAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }
    setRegStep("tiktok");
  }

  async function handleRegisterFinish(skipTiktok = false) {
    setError(null);
    setLoading(true);
    try {
      const isHandleNotFound = tikProfile?.exists === false && tikProfile?.reason !== "no_api_key";
      const tiktok =
        !skipTiktok && tiktokHandle.trim().length > 1 && !isHandleNotFound
          ? {
              username: tikProfile?.uniqueId ?? tiktokHandle.trim().replace(/^@/, ""),
              profilePicture: tikProfile?.profilePictureUrl ?? undefined,
              displayName: tikProfile?.nickname ?? undefined,
              followerCount: tikProfile?.followerCount,
            }
          : undefined;
      await register(email, password, name, tiktok);
      setLocation("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado");
    } finally { setLoading(false); }
  }

  async function handleTiktokOAuth() {
    try {
      const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${BASE}/api/auth/tiktok/url`);
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "Login com TikTok não disponível");
        return;
      }
      const { url } = await r.json() as { url: string };
      window.location.href = url;
    } catch {
      setError("Erro ao iniciar login com TikTok");
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setRegStep("account");
    setError(null);
    setTiktokHandle("");
    setTikProfile(null);
    setEmail("");
    setPassword("");
  }

  const isHandleValid = tikProfile?.exists === true;
  const isHandleNotFound = tikProfile?.exists === false && tikProfile?.reason !== "no_api_key";
  const isUnverified = tikProfile?.reason === "no_api_key";

  return (
    <div className="min-h-screen w-full flex overflow-hidden" style={{ background: "#0a0a0c" }}>
      {/* Background animated mesh - MORE DRAMATIC */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.14), transparent 70%)", animation: "float-up-down 6s ease-in-out infinite" }} />
        <div className="absolute bottom-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full" style={{ background: "radial-gradient(circle, rgba(34,197,94,0.10), transparent 70%)", animation: "float-up-down 8s ease-in-out infinite 2s" }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08), transparent 70%)", animation: "float-up-down 7s ease-in-out infinite 1s" }} />
        <div className="absolute top-[10%] right-[30%] w-[300px] h-[300px] rounded-full" style={{ background: "radial-gradient(circle, rgba(124,58,237,0.06), transparent 70%)", animation: "float-up-down 9s ease-in-out infinite 3s" }} />
        <div className="absolute bottom-[30%] left-[20%] w-[250px] h-[250px] rounded-full" style={{ background: "radial-gradient(circle, rgba(236,72,153,0.05), transparent 70%)", animation: "float-up-down 10s ease-in-out infinite 4s" }} />
        {/* Floating particle dots */}
        <div className="absolute top-[25%] left-[12%] w-1.5 h-1.5 rounded-full" style={{ background: "rgba(6,182,212,0.6)", animation: "float-particle 6s ease-in-out infinite", boxShadow: "0 0 6px rgba(6,182,212,0.4)" }} />
        <div className="absolute top-[60%] right-[25%] w-1 h-1 rounded-full" style={{ background: "rgba(34,197,94,0.5)", animation: "float-particle 8s ease-in-out infinite 2s" }} />
        <div className="absolute top-[80%] left-[45%] w-1 h-1 rounded-full" style={{ background: "rgba(124,58,237,0.5)", animation: "float-particle 7s ease-in-out infinite 1s" }} />
        <div className="absolute top-[15%] right-[15%] w-1.5 h-1.5 rounded-full" style={{ background: "rgba(6,182,212,0.4)", animation: "float-particle 9s ease-in-out infinite 3s" }} />
        {/* Grid overlay - MORE visible */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "80px 80px" }} />
      </div>

      {/* LEFT: Auth panel - frosted glass */}
      <div className="relative z-10 w-full md:w-[440px] lg:w-[480px] flex flex-col items-center justify-center px-8 py-10 shrink-0"
        style={{ background: "rgba(10, 10, 12, 0.92)", backdropFilter: "blur(32px)", borderRight: "1px solid rgba(6,182,212,0.08)", boxShadow: "4px 0 32px rgba(0,0,0,0.4)" }}>

        {/* Logo with dramatic breathing animation and pulsing ring */}
        <div className="flex items-center gap-3 mb-8 self-start">
          <div className="relative w-12 h-12 rounded-xl flex items-center justify-center pulse-ring"
            style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)", boxShadow: "0 0 28px rgba(6,182,212,0.4), 0 0 56px rgba(6,182,212,0.15)", animation: "breathe 3s ease-in-out infinite" }}>
            <SiTiktok className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-bold text-xl tracking-tight text-white leading-none text-glow-cyan">Creatools</div>
            <div className="text-[10px] tracking-[0.15em] uppercase mt-0.5 font-mono" style={{ color: "rgba(6,182,212,0.6)" }}>Live Studio</div>
          </div>
        </div>

        {/* Title */}
        <div className="self-start mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === "login" ? "Bem-vindo de volta" : regStep === "account" ? "Criar conta" : "Vincular TikTok"}
          </h1>
          <p className="text-sm text-cyan-300/60">
            {mode === "login" ? "Entre para acessar seus overlays e rankings" :
             regStep === "account" ? "Comece a monitorar lives do TikTok" :
             "Informe seu @ do TikTok para vincular a conta"}
          </p>
        </div>

        {/* Entrar / Criar conta tabs — always visible */}
        <div className="grid grid-cols-2 gap-2 rounded-xl p-1 w-full" style={{ background: "rgba(255,255,255,0.05)" }}>
          <button
            onClick={() => switchMode("login")}
            className="py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: mode === "login" ? "#06b6d4" : "transparent", color: "white" }}
          >
            Entrar
          </button>
          <button
            onClick={() => switchMode("register")}
            className="py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: mode === "register" ? "#06b6d4" : "transparent", color: mode === "register" ? "white" : "rgba(255,255,255,0.4)" }}
          >
            Criar conta
          </button>
        </div>

        {/* ── LOGIN MODE ──────────────────────────────────────────────────── */}
        {mode === "login" && (
          <div className="w-full space-y-4">
            {/* TikTok OAuth */}
            <button
              type="button"
              onClick={handleTiktokOAuth}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "white", color: "#0d0d1a" }}
            >
              <SiTiktok className="w-5 h-5" style={{ color: "#ff004f" }} />
              Continuar com TikTok
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs text-cyan-400/50 uppercase tracking-widest">OU</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/50 text-xs">@</div>
                <input
                  type="email"
                  placeholder="Usuário ou email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-8 pr-4 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-cyan-400/30 input-neon-focus"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                  }}
                  autoComplete="username"
                />
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-8 pr-10 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-cyan-400/30 input-neon-focus"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "white",
                  }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/40 hover:text-cyan-300 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-cyan-500" />
                  <span className="text-xs text-cyan-300/50">Lembrar-me</span>
                </label>
                <button type="button" className="text-xs font-medium" style={{ color: "#06b6d4" }}>Esqueceu?</button>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
                style={{ background: "linear-gradient(90deg, #06b6d4, #22c55e)", backgroundSize: "200% 100%" }}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Entrando...</> : <><ArrowRight className="w-4 h-4" />Entrar</>}
              </button>
            </form>
          </div>
        )}

        {/* ── REGISTER: STEP 1 — ACCOUNT ──────────────────────────────────── */}
        {mode === "register" && regStep === "account" && (
          <div className="w-full space-y-4">
            <button type="button" onClick={handleTiktokOAuth}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
              style={{ background: "white", color: "#0d0d1a" }}>
              <SiTiktok className="w-5 h-5" style={{ color: "#ff004f" }} />
              Registrar com TikTok
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-xs text-cyan-400/50 uppercase tracking-widest">OU</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.05)" }}>
              <button onClick={() => switchMode("login")}
                className="py-2 rounded-lg text-sm font-semibold"
                style={{ color: "rgba(255,255,255,0.4)" }}>Entrar</button>
              <button onClick={() => switchMode("register")}
                className="py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#06b6d4", color: "white" }}>Criar conta</button>
            </div>

            <form onSubmit={handleRegisterAccount} className="space-y-3">
              {[
                { id: "name", type: "text", placeholder: "Seu nome", value: name, onChange: setName, autoComplete: "name" },
                { id: "email", type: "email", placeholder: "Usuário ou email", value: email, onChange: setEmail, autoComplete: "email" },
              ].map((field) => (
                <input key={field.id} type={field.type} placeholder={field.placeholder} value={field.value}
                  onChange={(e) => field.onChange(e.target.value)} required autoComplete={field.autoComplete}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none placeholder:text-cyan-400/30"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
              ))}
              <div className="relative">
                <input type={showPw ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={password}
                  onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                  className="w-full px-4 pr-10 py-3 rounded-xl text-sm outline-none placeholder:text-cyan-400/30"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400/40 hover:text-cyan-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <div className="flex items-start gap-2 text-sm rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}
              <button type="submit"
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:opacity-90"
                style={{ background: "linear-gradient(90deg, #06b6d4, #22c55e)" }}>
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ── REGISTER: STEP 2 — TIKTOK ──────────────────────────────────── */}
        {mode === "register" && regStep === "tiktok" && (
          <div className="w-full space-y-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400/50 text-sm font-mono">@</span>
              <input type="text" placeholder="seuusuario" value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value.replace(/^@/, ""))}
                autoComplete="off" autoFocus
                className="w-full pl-8 pr-10 py-3 rounded-xl text-sm outline-none placeholder:text-cyan-400/30"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {tikLooking && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
                {!tikLooking && isHandleValid && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                {!tikLooking && isHandleNotFound && <XCircle className="w-4 h-4 text-red-400" />}
                {!tikLooking && !tikProfile && <Search className="w-4 h-4 text-cyan-400/40" />}
              </div>
            </div>
            <p className="text-xs text-cyan-300/40">Vincule sua conta TikTok para acessar ferramentas personalizadas.</p>

            {isHandleValid && tikProfile && (
              <div className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                {tikProfile.profilePictureUrl ? (
                  <img src={tikProfile.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(6,182,212,0.2)" }}>
                    <SiTiktok className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">{tikProfile.nickname ?? tikProfile.uniqueId}</p>
                  <p className="text-xs text-cyan-300/50">@{tikProfile.uniqueId}</p>
                  {tikProfile.followerCount && tikProfile.followerCount > 0 && (
                    <p className="text-xs text-cyan-300/40 flex items-center gap-1"><Users className="w-3 h-3" />{tikProfile.followerCount.toLocaleString("pt-BR")} seguidores</p>
                  )}
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              </div>
            )}

            {isHandleNotFound && tiktokHandle.length > 1 && (
              <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                <XCircle className="w-4 h-4 shrink-0" />Usuário @{tiktokHandle} não encontrado
              </div>
            )}
            {isUnverified && tiktokHandle.trim().length > 1 && (
              <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#fcd34d" }}>
                <AlertCircle className="w-4 h-4 shrink-0" />Verificação indisponível — será salvo e você pode confirmar depois.
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm rounded-xl px-3 py-2"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}>
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            {tiktokHandle.trim().length > 0 && !tikLooking && !isHandleValid && !isHandleNotFound && (
              <div className="flex items-center gap-2 text-xs text-cyan-300/40">
                <Loader2 className="w-3 h-3 animate-spin" />Verificando…
              </div>
            )}
            <button onClick={() => void handleRegisterFinish(false)}
              disabled={loading || !tiktokHandle.trim() || isHandleNotFound || tikLooking}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
              style={{ background: "linear-gradient(90deg, #06b6d4, #22c55e)" }}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Criando conta…</> : <><UserPlus className="w-4 h-4" />Criar conta</>}
            </button>
            <p className="text-center text-xs text-cyan-300/30">O @ do TikTok é obrigatório e ficará vinculado à sua conta.</p>
          </div>
        )}

        {/* Toggle */}
        {mode === "login" && (
          <p className="mt-6 text-xs text-cyan-300/40">
            Não tem conta?{" "}
            <button onClick={() => switchMode("register")} className="font-semibold hover:underline" style={{ color: "#06b6d4" }}>
              Criar conta grátis
            </button>
          </p>
        )}
        {mode === "register" && (
          <p className="mt-6 text-xs text-cyan-300/40">
            Já tem conta?{" "}
            <button onClick={() => switchMode("login")} className="font-semibold hover:underline" style={{ color: "#06b6d4" }}>
              Entrar
            </button>
          </p>
        )}
      </div>

      {/* RIGHT: Marketing panel - animated visual */}
      <div className="hidden md:flex flex-1 flex-col justify-center px-12 lg:px-20 py-12 relative z-10">
        {/* Animated gradient mesh background on this side */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(6,182,212,0.08) 0%, transparent 50%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 70% 70%, rgba(34,197,94,0.06) 0%, transparent 50%)" }} />
        
        <div className="max-w-lg relative">
          <h2 className="text-4xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
            Engaje seus fas{" "}
            <span className="block gradient-text-shimmer text-glow-cyan">
              em tempo real.
            </span>
          </h2>
          <p className="text-white/40 text-base mb-10 leading-relaxed">
            Rankings, overlays e metricas que respondem a cada gift, like e comentario da sua live.
          </p>

          {/* Stats with glassmorphism */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-cyan-400/60" />
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "rgba(6,182,212,0.5)" }}>Ativos 24H</span>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                <Counter target={2847} />
              </div>
              <div className="flex items-center gap-1 text-xs text-green-400">
                <TrendingUp className="w-3 h-3" />+12% streamers
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-3.5 h-3.5 text-pink-400/60" />
                <span className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: "rgba(6,182,212,0.5)" }}>Likes/seg</span>
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse" style={{ background: "#ef4444", color: "white", boxShadow: "0 0 8px rgba(239,68,68,0.4)" }}>LIVE</span>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                <Counter target={4023} />
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "rgba(6,182,212,0.1)" }}>
                <div className="h-full rounded-full" style={{ width: "70%", background: "linear-gradient(90deg, #06b6d4, #22c55e)", animation: "pulse-glow 2s ease-in-out infinite" }} />
              </div>
            </div>
          </div>

          {/* Top streamers - glassmorphism */}
          <div className="glass-card rounded-2xl p-5 mb-8">
            <p className="text-[10px] uppercase tracking-[0.15em] font-bold mb-4 text-center" style={{ color: "rgba(6,182,212,0.5)" }}>
              Top streamers que usam Creatools
            </p>
            <div className="flex justify-between gap-3">
              {TOP_STREAMERS.map((s) => (
                <div key={s.handle} className="flex flex-col items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg, ${s.color.split(" ")[1]}, ${s.color.split(" ")[3]})` }}>
                    <SiTiktok className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-cyan-300/50 truncate w-14">@{s.handle}</p>
                    <p className="text-[10px] font-bold text-white">{s.followers}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature chips - glassmorphism */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: Trophy, label: "Rankings" },
              { icon: Monitor, label: "Overlays" },
              { icon: Zap, label: "Tempo real" },
              { icon: LogIn, label: "Analytics" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="glass-card flex flex-col items-center gap-2 py-4 rounded-xl text-center">
                <Icon className="w-5 h-5 text-cyan-400/70" />
                <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
