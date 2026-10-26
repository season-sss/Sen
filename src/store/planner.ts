import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage } from './persist';
import { generatePlan, moveItem, reschedule, setItemDone, type Plan, type PlannerConfig } from '@/lib/planner/planner';
import { today } from '@/lib/util/date';

interface PlannerState {
  plan: Plan | null;
  create: (cfg: PlannerConfig, completed: Set<string>) => Plan;
  toggleDone: (itemId: string) => void;
  move: (itemId: string, date: string) => string | undefined;
  catchUp: (completed: Set<string>) => void;
  /** Called by other features so the plan reflects real activity */
  markActivity: (kind: 'lesson' | 'review' | 'mock' | 'assessment', refId?: string) => void;
  clear: () => void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set, get) => ({
      plan: null,
      create: (cfg, completed) => {
        const plan = generatePlan(cfg, completed);
        set({ plan });
        return plan;
      },
      toggleDone: (itemId) => {
        const p = get().plan;
        if (!p) return;
        const item = p.items.find((i) => i.id === itemId);
        if (item) set({ plan: setItemDone(p, itemId, !item.done) });
      },
      move: (itemId, date) => {
        const p = get().plan;
        if (!p) return;
        const r = moveItem(p, itemId, date);
        set({ plan: r.plan });
        return r.warning;
      },
      catchUp: (completed) => {
        const p = get().plan;
        if (p) set({ plan: reschedule(p, today(), completed) });
      },
      markActivity: (kind, refId) => {
        const p = get().plan;
        if (!p) return;
        const t = today();
        const candidates = p.items.filter(
          (i) => !i.done && i.type === kind && i.date <= t && (kind === 'lesson' ? i.lessonId === refId : kind === 'assessment' ? i.unitId === refId : true),
        );
        // Lessons: every part of the lesson scheduled up to today; others: the earliest open item.
        const ids = new Set((kind === 'lesson' ? candidates : candidates.slice(0, 1)).map((i) => i.id));
        if (kind === 'lesson') for (const i of p.items) if (!i.done && i.lessonId === refId && i.type === 'lesson') ids.add(i.id);
        if (!ids.size) return;
        const now = Date.now();
        set({ plan: { ...p, items: p.items.map((i) => (ids.has(i.id) ? { ...i, done: true, doneAt: now } : i)) } });
      },
      clear: () => set({ plan: null }),
    }),
    { name: 'haneul:planner', storage: jsonStorage, version: 1 },
  ),
);
