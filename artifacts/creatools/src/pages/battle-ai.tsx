import { useAuth, authFetch } from "@/context/auth-context";
import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, Play, Square, Radio, AlertCircle,
  Clock, User, Mic, Palette, Brain, Wifi,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";

interface AvatarOption {
  id: string;
  name: string;
  appearance: string;
  voice: string;
}

interface BattleAiPublicConfig {
  enabled: boolean;
  availableAvatars: AvatarOption[];
  pricePerSession: number;
  maxSessionDuration: number;
  planRestrictions: { minPlan?: string };
}

interface BattleAiSession {
  id: string;
  userId: string;
  status: "idle" | "streaming" | "error";
  avatarConfig: string;
  tiktokUsername: string;
  rtmpUrl: string;
  heygenSessionId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const GENDER_OPTIONS = [
  { value: "female", label: "Feminino" },
  { value: "male", label: "Masculino" },
  { value: "neutral", label: "Neutro" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { color: string; bg: string; label: string }> = {
    idle:      { color: "#9ca3af", bg: "rgba(156,163,175,0.15)", label: "Inativo" },
    streaming: { color: "#22c55e", bg: "rgba(34,197,94,0.15)",   label: "Ao Vivo" },
    error:     { color: "#ef4444", bg: "rgba(239,68,68,0.15)",   label: "Erro" },
  };
  const c = cfg[status] ?? cfg.idle;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
      style={{ background: c.bg, color: c.color }}
    >
      {status === "streaming" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
      {c.label}
    </span>
  );
}

export default function BattleAi() {
  const { user, token } = useAuth();
  const [config, setConfig] = useState<BattleAiPublicConfig | null>(null);
  const [sessions, setSessions] = useState<BattleAiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [gender, setGender] = useState("female");
  const [personality, setPersonality] = useState("");
  const [tiktokUsername, setTiktokUsername] = useState(user?.tiktokUsername ?? "");
  const [rtmpUrl, setRtmpUrl] = useState("");

  // Fetch config and sessions
  const fetchData = useCallback(async () => {
    try {
      const [cfgData, sessData] = await Promise.all([
        authFetch("/battle-ai/config", token) as Promise<BattleAiPublicConfig>,
        authFetch("/battle-ai/sessions", token) as Promise<{ sessions: BattleAiSession[] }>,
      ]);
      setConfig(cfgData);
      setSessions(sessData.sessions);
      if (cfgData.availableAvatars.length > 0 && !selectedAvatar) {
        setSelectedAvatar(cfgData.availableAvatars[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [token, selectedAvatar]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (user?.tiktokUsername && !tiktokUsername) {
      setTiktokUsername(user.tiktokUsername);
    }
  }, [user, tiktokUsername]);

  const handleStartSession = async () => {
    setError(null);
    setStarting(true);
    try {
      const avatarConfig = JSON.stringify({
        appearance: selectedAvatar,
        voice: config?.availableAvatars.find(a => a.id === selectedAvatar)?.voice ?? "",
        gender,
        personality,
      });

      // Create session
      const { session } = await authFetch("/battle-ai/sessions", token, {
        method: "POST",
        body: JSON.stringify({ avatarConfig, tiktokUsername, rtmpUrl }),
      }) as { session: BattleAiSession };

      // Start session
      const { session: started } = await authFetch(`/battle-ai/sessions/${session.id}/start`, token, {
        method: "POST",
      }) as { session: BattleAiSession };

      setSessions(prev => [started, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar sessao");
    } finally {
      setStarting(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      const { session: stopped } = await authFetch(`/battle-ai/sessions/${sessionId}/stop`, token, {
        method: "POST",
      }) as { session: BattleAiSession };
      setSessions(prev => prev.map(s => s.id === sessionId ? stopped : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao parar sessao");
    }
  };

  const activeSession = sessions.find(s => s.status === "streaming");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(34,197,94,0.04), rgba(139,92,246,0.06))",
          border: "1px solid rgba(6,182,212,0.15)",
        }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.3), transparent 70%)" }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(34,197,94,0.3), transparent 70%)" }} />
        </div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center breathe"
              style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)", boxShadow: "0 0 20px rgba(6,182,212,0.4)" }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold gradient-text">Battle AI</h1>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                  BETA
                </span>
              </div>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                Avatar IA na sua live do TikTok via HeyGen Streaming
              </p>
            </div>
          </div>

          {activeSession && (
            <div className="md:ml-auto flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <Wifi className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400">Transmitindo ao vivo</span>
            </div>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Disabled notice */}
      {config && !config.enabled && (
        <div className="flex items-center gap-2 p-4 rounded-xl"
          style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
          <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
          <p className="text-sm text-orange-400">Battle AI esta em fase de testes e ainda nao esta disponivel para uso geral. Fique atento para novidades!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Avatar Selection */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4" style={{ color: "#06b6d4" }} />
              <h2 className="text-sm font-semibold text-white">Configuracao do Avatar</h2>
            </div>

            <div className="space-y-4">
              {/* Avatar grid */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Aparencia
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {config?.availableAvatars.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setSelectedAvatar(avatar.id)}
                      className="flex items-center gap-2 p-3 rounded-xl transition-all"
                      style={{
                        background: selectedAvatar === avatar.id ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selectedAvatar === avatar.id ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(135deg, #06b6d4, #a78bfa)" }}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-white">{avatar.name}</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{avatar.appearance}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Mic className="w-3 h-3 inline mr-1" />
                  Genero da Voz
                </label>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setGender(opt.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: gender === opt.value ? "rgba(6,182,212,0.12)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${gender === opt.value ? "rgba(6,182,212,0.4)" : "rgba(255,255,255,0.06)"}`,
                        color: gender === opt.value ? "#06b6d4" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personality */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Brain className="w-3 h-3 inline mr-1" />
                  Personalidade
                </label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Descreva como o avatar deve se comportar na live... Ex: Animado, fala girias, interage com o chat"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl text-sm resize-none transition-all focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Connection Settings */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-4 h-4" style={{ color: "#22c55e" }} />
              <h2 className="text-sm font-semibold text-white">Conexao</h2>
            </div>

            <div className="space-y-4">
              {/* TikTok Username */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <SiTiktok className="w-3 h-3 inline mr-1" />
                  Username TikTok
                </label>
                <input
                  type="text"
                  value={tiktokUsername}
                  onChange={(e) => setTiktokUsername(e.target.value)}
                  placeholder="@seu_username"
                  className="w-full px-3 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                />
              </div>

              {/* RTMP URL */}
              <div>
                <label className="text-xs font-medium mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <Wifi className="w-3 h-3 inline mr-1" />
                  RTMP URL
                </label>
                <input
                  type="text"
                  value={rtmpUrl}
                  onChange={(e) => setRtmpUrl(e.target.value)}
                  placeholder="rtmp://push.tiktok.com/live/stream-key..."
                  className="w-full px-3 py-2 rounded-xl text-sm transition-all focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.8)",
                  }}
                />
                <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Encontre sua URL RTMP nas configuracoes de live do TikTok
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex gap-3">
            {activeSession ? (
              <button
                onClick={() => handleStopSession(activeSession.id)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02]"
                style={{
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                }}
              >
                <Square className="w-4 h-4" />
                Parar Transmissao
              </button>
            ) : (
              <button
                onClick={handleStartSession}
                disabled={starting || !tiktokUsername || !rtmpUrl || (config ? !config.enabled : true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #22c55e)",
                  color: "white",
                  boxShadow: "0 0 20px rgba(6,182,212,0.3)",
                }}
              >
                {starting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {starting ? "Iniciando..." : "Entrar na Live"}
              </button>
            )}
          </div>
        </div>

        {/* Session History Panel */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="stat-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: "#06b6d4" }} />
              <h3 className="text-sm font-semibold text-white">Historico</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-auto"
                style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>
                {sessions.length}
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Sparkles className="w-8 h-8" style={{ color: "rgba(255,255,255,0.1)" }} />
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Nenhuma sessao ainda. Inicie sua primeira transmissao!
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {sessions.map((session) => {
                  let avatarInfo = { appearance: "", personality: "" };
                  try { avatarInfo = JSON.parse(session.avatarConfig); } catch { /* ignore */ }
                  return (
                    <div
                      key={session.id}
                      className="p-3 rounded-xl transition-colors"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white/70 truncate">
                          @{session.tiktokUsername}
                        </span>
                        <StatusBadge status={session.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span>{new Date(session.createdAt).toLocaleDateString("pt-BR")}</span>
                        {session.startedAt && (
                          <>
                            <span>-</span>
                            <span>{new Date(session.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </>
                        )}
                      </div>
                      {session.status === "streaming" && (
                        <button
                          onClick={() => handleStopSession(session.id)}
                          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                          <Square className="w-3 h-3" />
                          Parar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Como funciona</h3>
            <ol className="space-y-2 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>1</span>
                <span>Configure a aparencia e personalidade do avatar</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>2</span>
                <span>Insira seu username TikTok e URL RTMP</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>3</span>
                <span>Clique em &quot;Entrar na Live&quot; e o avatar entra na transmissao</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}>4</span>
                <span>O avatar interage com o chat automaticamente</span>
              </li>
            </ol>
            {config && (
              <div className="mt-3 pt-3 text-[10px]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }}>
                Duracao maxima por sessao: {config.maxSessionDuration} min
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
