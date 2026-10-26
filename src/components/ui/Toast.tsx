import { create } from 'zustand';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'info' | 'warning' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const useToasts = create<{ items: ToastItem[]; push: (m: string, t: Tone) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (message, tone) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items.slice(-3), { id, message, tone }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3800);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToasts.getState().push(m, 'success'),
  info: (m: string) => useToasts.getState().push(m, 'info'),
  warning: (m: string) => useToasts.getState().push(m, 'warning'),
  error: (m: string) => useToasts.getState().push(m, 'error'),
};

export function Toaster() {
  const { items, remove } = useToasts();
  const icons = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle };
  const colors = { success: 'text-success', info: 'text-sky', warning: 'text-warning', error: 'text-danger' };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {items.map((t) => {
        const I = icons[t.tone];
        return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-lift animate-fade-up" role="status">
            <I className={cn('mt-0.5 h-5 w-5 shrink-0', colors[t.tone])} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button className="text-muted hover:text-ink" onClick={() => remove(t.id)} aria-label="ปิดการแจ้งเตือน">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
