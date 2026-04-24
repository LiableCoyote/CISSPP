import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useToast, type Toast as ToastT } from "../state/toast";

function variantClasses(variant: ToastT["variant"]) {
  switch (variant) {
    case "success":
      return "border-high/50 bg-high/10 text-high";
    case "warn":
      return "border-warn/50 bg-warn/10 text-warn";
    case "achievement":
      return "border-xp/60 bg-xp/10 text-xp shadow-glow";
    case "levelup":
      return "border-accent/60 bg-accent/10 text-accent shadow-glow";
    case "info":
    default:
      return "border-border bg-panel text-ink";
  }
}

function ToastItem({ toast }: { toast: ToastT }) {
  const dismiss = useToast((s) => s.dismiss);
  useEffect(() => {
    if (!toast.durationMs) return;
    const t = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(t);
  }, [toast.id, toast.durationMs, dismiss]);

  const isAlert = toast.variant === "warn";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className={`pointer-events-auto card border ${variantClasses(toast.variant)} min-w-[260px] max-w-sm`}
    >
      <div className="flex items-start gap-3">
        {toast.icon && (
          <span className="text-2xl leading-none shrink-0" aria-hidden="true">
            {toast.icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.body && <p className="text-xs text-dim mt-0.5">{toast.body}</p>}
          {typeof toast.xp === "number" && toast.xp > 0 && (
            <p className="text-xs mt-1 font-mono text-xp">+{toast.xp} XP</p>
          )}
        </div>
        <button
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
          className="text-dim hover:text-ink shrink-0 text-lg leading-none -mt-1"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </motion.div>
  );
}

export default function Toast() {
  const toasts = useToast((s) => s.toasts);
  return (
    <div
      aria-label="Notifications"
      className="fixed z-50 top-4 right-4 flex flex-col gap-2 pointer-events-none safe-top"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
