import { Router, type IRouter, type Request } from "express";
import { requireAuth, requireAdminMiddleware } from "./auth";
import {
  getAiConfig,
  upsertAiConfig,
  getConversationsByUser,
  getAllConversations,
  getConversationById,
  createConversation,
  updateConversation,
  archiveConversation,
  getMessagesByConversation,
  addAiMessage,
  getAllPlanLimits,
  getPlanLimit,
  upsertPlanLimit,
  countUserMessagesThisMonth,
} from "../lib/ai-store";
import { getUserById } from "../lib/users-store";

const router: IRouter = Router();
type AuthReq = Request & { userId: string };

// ── Mock AI Response Generator ────────────────────────────────────────────────
// This is a placeholder that generates contextual responses based on keywords.
// Replace this function with actual LLM API call (OpenAI, Anthropic, etc.) when ready.
function generateMockAiResponse(userMessage: string, systemPrompt: string): string {
  const msg = userMessage.toLowerCase();

  // Support-related
  if (msg.includes("problema") || msg.includes("erro") || msg.includes("bug") || msg.includes("nao funciona") || msg.includes("quebrado")) {
    return "Entendi que voce esta enfrentando um problema. Pode me dar mais detalhes sobre o que aconteceu? Informacoes como qual pagina estava usando, qual navegador e o que fez antes do erro vao me ajudar a entender melhor. Se eu nao conseguir resolver, posso escalar para nosso time de suporte humano.";
  }

  // Plans
  if (msg.includes("plano") || msg.includes("upgrade") || msg.includes("preco") || msg.includes("pagar") || msg.includes("assinatura")) {
    return "Temos tres planos disponiveis: Free (gratuito com funcionalidades basicas), Basic (com overlays avancados e live counts) e PRO (acesso completo com todas as ferramentas, jogos e analytics). Voce pode comparar os planos na pagina /pricing. Quer que eu explique as diferencas em mais detalhes?";
  }

  // Overlays
  if (msg.includes("overlay") || msg.includes("sobreposicao") || msg.includes("obs") || msg.includes("stream")) {
    return "Os overlays sao elementos visuais que voce adiciona na sua live via OBS. Temos overlays de likes, moedas, battle, gifts, MVP e muito mais! Para usar, va em Sobreposicoes no menu lateral, configure o overlay desejado e copie o link para adicionar como Browser Source no OBS. Precisa de ajuda com algum overlay especifico?";
  }

  // Games/Minigames
  if (msg.includes("jogo") || msg.includes("game") || msg.includes("roleta") || msg.includes("minigame")) {
    return "Temos varios minigames para animar sua live: Roleta, Word Bomb, Verdade ou Mito, Defender e Bau. Cada jogo tem configuracoes proprias. Va em Jogos no menu lateral para configurar. Alguns jogos estao disponiveis apenas no plano PRO. Quer saber mais sobre algum jogo especifico?";
  }

  // TikTok/Connection
  if (msg.includes("tiktok") || msg.includes("conexao") || msg.includes("conectar") || msg.includes("live")) {
    return "Para usar as ferramentas da Creatools, voce precisa estar com sua live do TikTok ativa. A conexao e feita automaticamente quando voce inicia o monitoramento. Va em Conexao no menu lateral e siga as instrucoes. Se estiver tendo problemas de conexao, verifique se seu username do TikTok esta correto nas configuracoes.";
  }

  // Alerts
  if (msg.includes("alerta") || msg.includes("som") || msg.includes("notificacao") || msg.includes("sound")) {
    return "Os alertas sonoros tocam durante sua live quando eventos acontecem (likes, gifts, shares, etc). Configure em Ferramentas > Alertas Sonoros. Voce pode personalizar sons, volumes e condicoes de ativacao. Para alertas visuais, use os Alertas Overlay com animacoes customizaveis.";
  }

  // Greeting
  if (msg.includes("ola") || msg.includes("oi") || msg.includes("hey") || msg.includes("bom dia") || msg.includes("boa tarde") || msg.includes("boa noite")) {
    return "Ola! Eu sou a assistente IA da Creatools. Posso te ajudar com duvidas sobre overlays, planos, configuracoes, jogos, alertas e muito mais. Como posso te ajudar hoje?";
  }

  // Thank you
  if (msg.includes("obrigad") || msg.includes("valeu") || msg.includes("thanks")) {
    return "De nada! Fico feliz em ajudar. Se tiver mais alguma duvida, estou por aqui. Boa live!";
  }

  // Creative mode
  if (msg.includes("criar") || msg.includes("gerar") || msg.includes("sugerir") || msg.includes("ideia") || msg.includes("criativo")) {
    return "Posso te ajudar com ideias criativas! Para overlays, posso sugerir combinacoes de cores, layouts e animacoes que funcionam bem para diferentes tipos de live. Me conte qual tipo de conteudo voce faz (gameplay, just chatting, danca, etc) e vou te dar sugestoes personalizadas.";
  }

  // Default
  return "Obrigado pela mensagem! Como assistente da Creatools, posso te ajudar com: configuracao de overlays, duvidas sobre planos, problemas tecnicos, jogos interativos, alertas sonoros e visuais, e dicas para melhorar suas lives. Me diga como posso te ajudar!";
}

// ── POST /ai/chat - Send message and get AI response ──────────────────────────
router.post("/ai/chat", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { message, conversationId } = req.body as { message?: string; conversationId?: string };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Check if AI is enabled
  const config = await getAiConfig();
  if (config && !config.enabled) {
    res.status(503).json({ error: "Assistente IA esta desativada no momento." });
    return;
  }

  // Check user plan limits
  const user = await getUserById(userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const userPlan = user.plan ?? "free";
  const planLimit = await getPlanLimit(userPlan);
  const maxMessages = planLimit?.messagesPerMonth ?? 50;

  if (maxMessages !== -1) {
    const usedMessages = await countUserMessagesThisMonth(userId);
    if (usedMessages >= maxMessages) {
      res.status(429).json({
        error: "Limite de mensagens atingido para seu plano este mes.",
        limit: maxMessages,
        used: usedMessages,
      });
      return;
    }
  }

  // Get or create conversation
  let conversation;
  if (conversationId) {
    conversation = await getConversationById(conversationId);
    if (!conversation || conversation.userId !== userId) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }
  } else {
    const title = message.trim().slice(0, 50) + (message.trim().length > 50 ? "..." : "");
    conversation = await createConversation(userId, title);
  }

  // Save user message
  await addAiMessage({
    conversationId: conversation.id,
    role: "user",
    content: message.trim(),
  });

  // Generate AI response (mock)
  const systemPrompt = config?.systemPrompt ?? "";
  const aiResponse = generateMockAiResponse(message.trim(), systemPrompt);

  // Save AI response
  const aiMsg = await addAiMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: aiResponse,
    tokensUsed: Math.floor(aiResponse.length / 4),
  });

  res.json({
    conversationId: conversation.id,
    message: aiMsg,
  });
});

// ── GET /ai/conversations - List user conversations ───────────────────────────
router.get("/ai/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const conversations = await getConversationsByUser(userId);
  res.json({ conversations });
});

// ── GET /ai/conversations/:id/messages - Get messages for conversation ────────
router.get("/ai/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { id } = req.params as { id: string };
  const conversation = await getConversationById(id);
  if (!conversation || conversation.userId !== userId) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await getMessagesByConversation(id);
  res.json({ messages, conversation });
});

// ── DELETE /ai/conversations/:id - Archive conversation ───────────────────────
router.delete("/ai/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { id } = req.params as { id: string };
  const conversation = await getConversationById(id);
  if (!conversation || conversation.userId !== userId) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await archiveConversation(id);
  res.json({ success: true });
});

// ── GET /ai/limits - Get user's usage vs limits ───────────────────────────────
router.get("/ai/limits", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const user = await getUserById(userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const userPlan = user.plan ?? "free";
  const planLimit = await getPlanLimit(userPlan);
  const usedMessages = await countUserMessagesThisMonth(userId);
  const maxMessages = planLimit?.messagesPerMonth ?? 50;
  const creativeLimit = planLimit?.creativeRequestsPerMonth ?? 0;

  res.json({
    plan: userPlan,
    messagesUsed: usedMessages,
    messagesLimit: maxMessages,
    messagesRemaining: maxMessages === -1 ? -1 : Math.max(0, maxMessages - usedMessages),
    creativeRequestsLimit: creativeLimit,
    priority: planLimit?.priority ?? "normal",
  });
});

// ── POST /ai/escalate/:conversationId - Escalate to human support ─────────────
router.post("/ai/escalate/:conversationId", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as AuthReq).userId;
  const { conversationId } = req.params as { conversationId: string };
  const conversation = await getConversationById(conversationId);
  if (!conversation || conversation.userId !== userId) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await updateConversation(conversationId, { status: "escalated" });
  await addAiMessage({
    conversationId,
    role: "system",
    content: "Conversa escalada para suporte humano. Um atendente ira responder em breve.",
  });

  res.json({ success: true, message: "Conversa escalada para suporte humano." });
});

// ── GET /ai/config - Admin only, get AI config ────────────────────────────────
router.get("/ai/config", requireAdminMiddleware, async (_req, res): Promise<void> => {
  let config = await getAiConfig();
  if (!config) {
    config = await upsertAiConfig({});
  }
  const planLimits = await getAllPlanLimits();
  res.json({ config, planLimits });
});

// ── PUT /ai/config - Admin only, update AI config ─────────────────────────────
router.put("/ai/config", requireAdminMiddleware, async (req, res): Promise<void> => {
  const body = req.body as Partial<{
    systemPrompt: string;
    personalityName: string;
    maxContextMessages: number;
    enabled: boolean;
    supportEscalationEnabled: boolean;
    creativeModeEnabled: boolean;
    allowedTopics: string[];
    blockedTopics: string[];
  }>;
  const config = await upsertAiConfig(body);
  res.json({ config });
});

// ── PUT /ai/plan-limits/:planId - Admin only, update plan limits ──────────────
router.put("/ai/plan-limits/:planId", requireAdminMiddleware, async (req, res): Promise<void> => {
  const { planId } = req.params as { planId: string };
  const body = req.body as { messagesPerMonth?: number; creativeRequestsPerMonth?: number; priority?: string };
  const limit = await upsertPlanLimit(planId, body);
  res.json({ limit });
});

// ── GET /ai/admin/conversations - Admin view all conversations ────────────────
router.get("/ai/admin/conversations", requireAdminMiddleware, async (req, res): Promise<void> => {
  const limit = Number(req.query.limit as string) || 50;
  const conversations = await getAllConversations(limit);
  res.json({ conversations });
});

// ── GET /ai/admin/conversations/:id/messages - Admin view conversation messages
router.get("/ai/admin/conversations/:id/messages", requireAdminMiddleware, async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const conversation = await getConversationById(id);
  if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
  const messages = await getMessagesByConversation(id);
  res.json({ messages, conversation });
});

export default router;
