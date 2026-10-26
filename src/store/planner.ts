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
      clear: () => set({ plan: null }),
    }),
    { name: 'haneul:planner', storage: jsonStorage, version: 1 },
  ),
);
