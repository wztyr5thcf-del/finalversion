import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, X, Send, Loader2, MessageSquare, ChevronDown,
  Sparkles, AlertTriangle, History, ArrowLeft, Trash2,
} from "lucide-react";
import { useAuth, authFetch } from "@/context/auth-context";

interface AiMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  tokensUsed: number;
}

interface AiConversation {
  id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface AiLimits {
  plan: string;
  messagesUsed: number;
  messagesLimit: number;
  messagesRemaining: number;
  creativeRequestsLimit: number;
  priority: string;
}

export default function AiChatWidget() {
  const { user, token } = useAuth();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [limits, setLimits] = useState<AiLimits | null>(null);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch limits ──────────────────────────────────────────────────────────
  const fetchLimits = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authFetch("/ai/limits", token) as AiLimits;
      setLimits(data);
    } catch { /* silent */ }
  }, [token]);

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authFetch("/ai/conversations", token) as { conversations: AiConversation[] };
      setConversations(data.conversations ?? []);
    } catch { /* silent */ }
  }, [token]);

  // ── Fetch messages for a conversation ─────────────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    if (!token) return;
    try {
      const data = await authFetch(`/ai/conversations/${convId}/messages`, token) as { messages: AiMessage[] };
      setMessages(data.messages ?? []);
    } catch { /* silent */ }
  }, [token]);

  // ── On open ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      void fetchLimits();
      void fetchConversations();
    }
  }, [open, fetchLimits, fetchConversations]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    if (!inputText.trim() || sending || !token) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    setTyping(true);

    // Optimistic add user message
    const tempUserMsg: AiMessage = {
      id: "temp-" + Date.now(),
      conversationId: currentConversationId ?? "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
      tokensUsed: 0,
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const data = await authFetch("/ai/chat", token, {
        method: "POST",
        body: JSON.stringify({ message: text, conversationId: currentConversationId }),
      }) as { conversationId: string; message: AiMessage };

      if (!currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Replace temp and add AI response
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
        return [
          ...withoutTemp,
          { ...tempUserMsg, id: "user-" + Date.now(), conversationId: data.conversationId },
          data.message,
        ];
      });

      void fetchLimits();
      void fetchConversations();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setMessages((prev) => [
        ...prev,
        {
          id: "error-" + Date.now(),
          conversationId: currentConversationId ?? "",
          role: "system",
          content: errorMsg,
          createdAt: new Date().toISOString(),
          tokensUsed: 0,
        },
      ]);
    } finally {
      setSending(false);
      setTyping(false);
    }
  }

  // ── Start new conversation ────────────────────────────────────────────────
  function startNewConversation() {
    setCurrentConversationId(null);
    setMessages([]);
    setShowHistory(false);
  }

  // ── Load conversation ─────────────────────────────────────────────────────
  function loadConversation(conv: AiConversation) {
    setCurrentConversationId(conv.id);
    void fetchMessages(conv.id);
    setShowHistory(false);
  }

  // ── Delete conversation ───────────────────────────────────────────────────
  async function deleteConversation(convId: string) {
    if (!token) return;
    try {
      await authFetch(`/ai/conversations/${convId}`, token, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversationId === convId) {
        startNewConversation();
      }
    } catch { /* silent */ }
  }

  // ── Escalate ──────────────────────────────────────────────────────────────
  async function handleEscalate() {
    if (!currentConversationId || !token) return;
    try {
      await authFetch(`/ai/escalate/${currentConversationId}`, token, { method: "POST" });
      setMessages((prev) => [
        ...prev,
        {
          id: "esc-" + Date.now(),
          conversationId: currentConversationId,
          role: "system",
          content: "Conversa escalada para suporte humano. Um atendente ira responder em breve.",
          createdAt: new Date().toISOString(),
          tokensUsed: 0,
        },
      ]);
    } catch { /* silent */ }
  }

  if (!user || !token) return null;

  return (
    <>
      {/* ── Chat Panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-20 right-4 z-[60] w-[360px] max-h-[560px] flex flex-col rounded-2xl overflow-hidden"
            style={{
              background: "rgba(10,10,14,0.95)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(6,182,212,0.2)",
              boxShadow: "0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.08), 0 0 32px rgba(6,182,212,0.06)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(6,182,212,0.12)", background: "rgba(6,182,212,0.04)" }}>
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)", boxShadow: "0 0 12px rgba(6,182,212,0.4)" }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2"
                  style={{ borderColor: "rgba(10,10,14,0.95)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Crea AI</p>
                <p className="text-[10px]" style={{ color: "rgba(6,182,212,0.7)" }}>Assistente inteligente</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: showHistory ? "#06b6d4" : "rgba(255,255,255,0.3)" }}
                  title="Historico"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  onClick={startNewConversation}
                  className="p-1.5 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  title="Nova conversa"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* History sidebar */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div className="p-3 max-h-48 overflow-y-auto space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(6,182,212,0.5)" }}>
                        Conversas recentes
                      </span>
                      <button onClick={() => setShowHistory(false)} className="text-white/20 hover:text-white/50 transition-colors">
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {conversations.length === 0 ? (
                      <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.2)" }}>
                        Nenhuma conversa ainda
                      </p>
                    ) : (
                      conversations.slice(0, 10).map((conv) => (
                        <div key={conv.id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all hover:bg-white/[0.04] group"
                          style={{
                            background: currentConversationId === conv.id ? "rgba(6,182,212,0.08)" : undefined,
                            border: currentConversationId === conv.id ? "1px solid rgba(6,182,212,0.15)" : "1px solid transparent",
                          }}
                          onClick={() => loadConversation(conv)}
                        >
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(6,182,212,0.4)" }} />
                          <span className="flex-1 text-xs truncate text-white/60">{conv.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); void deleteConversation(conv.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                            style={{ color: "rgba(255,255,255,0.2)" }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0" style={{ scrollbarWidth: "thin" }}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.15)" }}>
                    <Sparkles className="w-7 h-7" style={{ color: "#06b6d4" }} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-white/80">Ola! Como posso ajudar?</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Pergunte sobre overlays, planos, configuracoes ou qualquer duvida.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                    {["Como usar overlays?", "Quais planos existem?", "Ajuda com conexao"].map((q) => (
                      <button key={q}
                        onClick={() => { setInputText(q); }}
                        className="text-[11px] px-3 py-1.5 rounded-full transition-all hover:scale-105"
                        style={{
                          background: "rgba(6,182,212,0.08)",
                          border: "1px solid rgba(6,182,212,0.15)",
                          color: "#06b6d4",
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)" }}>
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? ""
                      : msg.role === "system"
                        ? ""
                        : ""
                  }`}
                    style={{
                      background: msg.role === "user"
                        ? "rgba(6,182,212,0.12)"
                        : msg.role === "system"
                          ? "rgba(249,115,22,0.08)"
                          : "rgba(255,255,255,0.04)",
                      border: msg.role === "user"
                        ? "1px solid rgba(6,182,212,0.2)"
                        : msg.role === "system"
                          ? "1px solid rgba(249,115,22,0.2)"
                          : "1px solid rgba(255,255,255,0.06)",
                      color: msg.role === "system" ? "#f97316" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {msg.role === "system" && (
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
                    )}
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                    <p className="text-[9px] mt-1.5 opacity-40 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              <AnimatePresence>
                {typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #06b6d4, #22c55e)" }}>
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex items-center gap-1 px-3.5 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Footer - limits + escalation */}
            <div className="shrink-0 px-3 py-2 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2">
                {limits && limits.messagesLimit !== -1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: limits.messagesRemaining <= 5 ? "rgba(239,68,68,0.1)" : "rgba(6,182,212,0.08)",
                      color: limits.messagesRemaining <= 5 ? "#ef4444" : "rgba(6,182,212,0.6)",
                      border: `1px solid ${limits.messagesRemaining <= 5 ? "rgba(239,68,68,0.2)" : "rgba(6,182,212,0.12)"}`,
                    }}
                  >
                    {limits.messagesRemaining} msgs restantes
                  </span>
                )}
              </div>
              {currentConversationId && messages.length >= 3 && (
                <button
                  onClick={() => void handleEscalate()}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-all hover:scale-105"
                  style={{
                    background: "rgba(249,115,22,0.08)",
                    color: "#f97316",
                    border: "1px solid rgba(249,115,22,0.2)",
                  }}
                >
                  Falar com humano
                </button>
              )}
            </div>

            {/* Input area */}
            <div className="shrink-0 px-3 pb-3 pt-1">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                    placeholder="Digite sua mensagem..."
                    disabled={sending}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all placeholder:text-white/20"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(6,182,212,0.12)",
                      color: "white",
                    }}
                    autoFocus
                  />
                  {inputText.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px]"
                      style={{ color: inputText.length > 500 ? "#ef4444" : "rgba(255,255,255,0.15)" }}>
                      {inputText.length}/500
                    </span>
                  )}
                </div>
                <button
                  onClick={() => void handleSend()}
                  disabled={sending || !inputText.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
                  style={{
                    background: inputText.trim() ? "linear-gradient(135deg, #06b6d4, #22c55e)" : "rgba(255,255,255,0.04)",
                    boxShadow: inputText.trim() ? "0 0 12px rgba(6,182,212,0.3)" : "none",
                  }}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating Button ───────────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[60] flex items-center justify-center rounded-full transition-all"
        style={{
          width: 54,
          height: 54,
          background: open ? "rgba(6,182,212,0.9)" : "linear-gradient(135deg, #06b6d4, #22c55e)",
          boxShadow: "0 4px 24px rgba(6,182,212,0.4), 0 0 0 3px rgba(6,182,212,0.1)",
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        animate={open ? {} : { boxShadow: ["0 4px 24px rgba(6,182,212,0.4), 0 0 0 3px rgba(6,182,212,0.1)", "0 4px 24px rgba(6,182,212,0.6), 0 0 0 6px rgba(6,182,212,0.05)", "0 4px 24px rgba(6,182,212,0.4), 0 0 0 3px rgba(6,182,212,0.1)"] }}
        transition={open ? {} : { boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
        title="Assistente IA"
      >
        {open ? (
          <ChevronDown className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </motion.button>
    </>
  );
}
