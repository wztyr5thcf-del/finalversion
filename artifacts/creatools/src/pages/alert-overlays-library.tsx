import { useState, useEffect, useCallback } from "react";
import { useAuth, authFetch } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Lock, Copy, CheckCircle2, Crown, Zap, ShoppingCart, Sparkles, Filter, Play,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type PlanLevel = "free" | "basic" | "pro";
const PLAN_ORDER: Record<PlanLevel, number> = { free: 0, basic: 1, pro: 2 };

const PLAN_LABELS: Record<PlanLevel, string> = { free: "Gratuito", basic: "Basic", pro: "PRO" };
const PLAN_COLORS: Record<PlanLevel, string> = { free: "#9ca3af", basic: "#22d3ee", pro: "#f97316" };

interface AlertOverlay {
  id: string;
  name: string;
  description: string;
  previewUrl: string;
  overlayUrl: string | null;
  thumbnailUrl: string | null;
  category: string;
  minPlan: string;
  price: number;
  hasAccess: boolean;
  purchased: boolean;
  order: number;
  createdAt: number;
}

export default function AlertOverlaysLibrary() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [overlays, setOverlays] = useState<AlertOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [purchaseDialog, setPurchaseDialog] = useState<AlertOverlay | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const userPlan = (user?.plan ?? "free") as PlanLevel;

  const fetchOverlays = useCallback(async () => {
    try {
      const data = await authFetch("/alert-overlays", token) as { items: AlertOverlay[] };
      setOverlays(data.items ?? []);
    } catch {
      toast({ title: "Erro", description: "Falha ao carregar overlays.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { void fetchOverlays(); }, [fetchOverlays]);

  const categories = ["Todos", ...Array.from(new Set(overlays.map((o) => o.category)))];

  const filtered = activeCategory === "Todos"
    ? overlays
    : overlays.filter((o) => o.category === activeCategory);

  const handleCopy = async (overlay: AlertOverlay) => {
    if (!overlay.overlayUrl) return;
    try {
      await navigator.clipboard.writeText(overlay.overlayUrl);
      setCopiedId(overlay.id);
      toast({ title: "Copiado!", description: "URL do overlay copiada para a area de transferencia." });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Erro", description: "Falha ao copiar.", variant: "destructive" });
    }
  };

  const handlePurchase = async (overlay: AlertOverlay) => {
    setPurchasing(true);
    try {
      await authFetch(`/alert-overlays/${overlay.id}/purchase`, token, { method: "POST" });
      toast({ title: "Compra realizada!", description: `Voce agora tem acesso ao overlay "${overlay.name}".` });
      setPurchaseDialog(null);
      void fetchOverlays();
    } catch (err: unknown) {
      toast({ title: "Erro", description: (err as Error).message ?? "Falha na compra.", variant: "destructive" });
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(236,72,153,0.1), rgba(34,211,238,0.08))",
          border: "1px solid rgba(124,58,237,0.2)",
        }}>
        <div className="absolute inset-0 opacity-30"
          style={{ background: "radial-gradient(ellipse at top right, rgba(124,58,237,0.3), transparent 70%)" }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Biblioteca de Alertas Overlay</h1>
              <p className="text-sm text-white/50">Overlays animados em .webm para usar no OBS e TikTok Studio</p>
            </div>
          </div>
          <p className="text-sm text-white/40 mt-3 max-w-2xl">
            Escolha entre nossos overlays profissionais para personalizar suas lives. Copie a URL e adicione como fonte de navegador no OBS ou TikTok Studio.
          </p>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-white/30 shrink-0" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
            style={{
              background: activeCategory === cat ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
              color: activeCategory === cat ? "#a78bfa" : "rgba(255,255,255,0.5)",
              border: `1px solid ${activeCategory === cat ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-white/40 mt-3">Carregando overlays...</p>
        </div>
      )}

      {/* Grid */}
      {!loading && filtered.length === 0 && (
        <div className="py-20 text-center">
          <Sparkles className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">Nenhum overlay encontrado nesta categoria.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map((overlay) => (
            <OverlayCard
              key={overlay.id}
              overlay={overlay}
              userPlan={userPlan}
              copiedId={copiedId}
              onCopy={handleCopy}
              onPurchase={() => setPurchaseDialog(overlay)}
            />
          ))}
        </div>
      )}

      {/* Purchase dialog */}
      {purchaseDialog && (
        <Dialog open={!!purchaseDialog} onOpenChange={() => setPurchaseDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Comprar Overlay</DialogTitle>
              <DialogDescription>
                Deseja comprar o overlay "{purchaseDialog.name}" por R$ {(purchaseDialog.price / 100).toFixed(2)}?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-xl overflow-hidden relative"
                style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ pointerEvents: "none" }}>
                  <video
                    src={purchaseDialog.previewUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-32 object-cover"
                    style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
                    controlsList="nodownload nofullscreen noremoteplayback"
                    disablePictureInPicture
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-white/70">{purchaseDialog.name}</span>
                <span className="text-lg font-bold text-white">
                  R$ {(purchaseDialog.price / 100).toFixed(2)}
                </span>
              </div>
              {userPlan === "free" && (
                <p className="text-xs text-red-400 mt-2">
                  Voce precisa ter um plano pago ativo (Basic ou PRO) para comprar itens individuais.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPurchaseDialog(null)}>Cancelar</Button>
              <Button
                onClick={() => handlePurchase(purchaseDialog)}
                disabled={purchasing || userPlan === "free"}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {purchasing ? "Processando..." : "Confirmar Compra"}
                <ShoppingCart className="w-4 h-4 ml-2" />
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function OverlayCard({
  overlay,
  userPlan,
  copiedId,
  onCopy,
  onPurchase,
}: {
  overlay: AlertOverlay;
  userPlan: PlanLevel;
  copiedId: string | null;
  onCopy: (overlay: AlertOverlay) => void;
  onPurchase: () => void;
}) {
  const minPlan = overlay.minPlan as PlanLevel;
  const planColor = PLAN_COLORS[minPlan] ?? "#9ca3af";

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: overlay.hasAccess
          ? "0 0 20px rgba(124,58,237,0.05)"
          : "none",
      }}
    >
      {/* Video preview area */}
      <div className="relative aspect-video overflow-hidden rounded-t-2xl"
        style={{ background: "rgba(0,0,0,0.4)" }}>
        <div style={{ pointerEvents: "none" }} className="w-full h-full">
          <video
            src={overlay.previewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
            controlsList="nodownload nofullscreen noremoteplayback"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* Locked overlay */}
        {!overlay.hasAccess && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}>
            <div className="text-center">
              <Lock className="w-8 h-8 mx-auto mb-2" style={{ color: planColor }} />
              <p className="text-xs font-semibold" style={{ color: planColor }}>
                Requer {PLAN_LABELS[minPlan]}
              </p>
            </div>
          </div>
        )}

        {/* Play indicator */}
        {overlay.hasAccess && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.8)" }}>
              <Play className="w-3 h-3 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)" }}>
            {overlay.category}
          </span>
        </div>
      </div>

      {/* Info area */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white leading-tight">{overlay.name}</h3>
          <span className="text-[9px] font-bold px-2 py-1 rounded-full shrink-0"
            style={{ background: `${planColor}20`, color: planColor, border: `1px solid ${planColor}30` }}>
            {PLAN_LABELS[minPlan]}
          </span>
        </div>

        {overlay.description && (
          <p className="text-xs text-white/40 line-clamp-2">{overlay.description}</p>
        )}

        {/* Action buttons */}
        <div className="pt-1">
          {overlay.hasAccess ? (
            <Button
              size="sm"
              className="w-full text-xs"
              variant={copiedId === overlay.id ? "default" : "outline"}
              onClick={() => onCopy(overlay)}
              style={copiedId === overlay.id ? { background: "#22c55e" } : undefined}
            >
              {copiedId === overlay.id ? (
                <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Copiado!</>
              ) : (
                <><Copy className="w-3.5 h-3.5 mr-1.5" />Copiar URL</>
              )}
            </Button>
          ) : overlay.price > 0 ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0"
                onClick={onPurchase}
              >
                <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
                R$ {(overlay.price / 100).toFixed(2)}
              </Button>
            </div>
          ) : (
            <Button size="sm" className="w-full text-xs" variant="outline" disabled>
              <Lock className="w-3.5 h-3.5 mr-1.5" />
              Requer plano {PLAN_LABELS[minPlan]}
            </Button>
          )}
        </div>

        {overlay.purchased && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            Comprado
          </div>
        )}
      </div>

      {/* Glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ boxShadow: "inset 0 0 30px rgba(124,58,237,0.08), 0 0 20px rgba(124,58,237,0.05)" }} />
    </div>
  );
}
