import { create } from "zustand";

export type ToastVariant = "success" | "info" | "warn" | "achievement" | "levelup";

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
  icon?: string;
  xp?: number;
  durationMs?: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
}

let counter = 0;
const nextId = () => `t-${Date.now()}-${++counter}`;

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId();
    const toast: Toast = { id, durationMs: 4500, ...t };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function pushToast(t: Omit<Toast, "id">): string {
  return useToast.getState().push(t);
}
