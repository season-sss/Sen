/**
 * Study-plan generator. Fills each study day up to the learner's own time limit — never beyond —
 * weighting lessons by difficulty, splitting lessons that are longer than a day's capacity,
 * and reserving time for flashcard review, unit checks and mock tests.
 */
import { ALL_LESSONS, LESSON_INDEX, type Lesson } from '@/data/curriculum';
import type { Level } from '@/data/types';
import { addDays, diffDays, weekday, type ISODate } from '@/lib/util/date';

export type PlanGoal =
  | { type: 'levels'; levels: Level[] }
  | { type: 'topik'; exam: 'TOPIK1' | 'TOPIK2' }
  | { type: 'custom'; lessonIds: string[] };

export interface PlannerConfig {
  goal: PlanGoal;
  startDate: ISODate;
  targetDate: ISODate;
  /** Free minutes per weekday, index 0 = Sunday */
  availability: number[];
  /** How many days per week to study (the days with most free time are chosen) */
  daysPerWeek: number;
  /** Hard cap of study minutes per day */
  minutesPerDay: number;
  restDates: ISODate[];
  includeReview: boolean;
  reviewMinutes: number;
  includeMockTests: boolean;
  includeUnitChecks: boolean;
}

export type PlanItemType = 'lesson' | 'review' | 'mock' | 'assessment';

export interface PlanItem {
  id: string;
  date: ISODate;
  type: PlanItemType;
  title: string;
  minutes: number;
  lessonId?: string;
  unitId?: string;
  part?: { index: number; total: number };
  done: boolean;
  doneAt?: number;
  /** Manually moved by the learner — rescheduling keeps it in place */
  pinned?: boolean;
}

export interface Plan {
  config: PlannerConfig;
  items: PlanItem[];
  createdAt: number;
  estimatedFinish: ISODate;
  /** True when the work does not fit before the target date with the given time */
  overflow: boolean;
}

export const DEFAULT_CONFIG = (start: ISODate): PlannerConfig => ({
  goal: { type: 'levels', levels: ['L0', 'A1'] },
  startDate: start,
  targetDate: addDays(start, 90),
  availability: [60, 45, 45, 45, 45, 45, 60],
  daysPerWeek: 5,
  minutesPerDay: 45,
  restDates: [],
  includeReview: true,
  reviewMinutes: 10,
  includeMockTests: true,
  includeUnitChecks: true,
});

const TOPIK_LEVELS: Record<'TOPIK1' | 'TOPIK2', Level[]> = { TOPIK1: ['L0', 'A1', 'A2'], TOPIK2: ['B1', 'B2'] };

export function goalLessons(goal: PlanGoal, completed: Set<string> = new Set()): Lesson[] {
  let lessons: Lesson[];
  if (goal.type === 'custom') {
    const ids = new Set(goal.lessonIds);
    lessons = ALL_LESSONS.filter((l) => ids.has(l.id));
  } else {
    const levels = goal.type === 'levels' ? goal.levels : TOPIK_LEVELS[goal.exam];
    lessons = ALL_LESSONS.filter((l) => levels.includes(LESSON_INDEX[l.id].level.id));
  }
  return lessons.filter((l) => !completed.has(l.id));
}

/** Difficulty-weighted study time: harder lessons need more time. */
export function effectiveMinutes(l: Lesson): number {
  return Math.round(l.minutes * (1 + 0.2 * (l.difficulty - 1)));
}

/** Weekdays used for study: the `daysPerWeek` days with the most free time (ties → earlier in week). */
export function studyWeekdays(cfg: PlannerConfig): Set<number> {
  const order = [1, 2, 3, 4, 5, 6, 0]
    .filter((d) => cfg.availability[d] > 0)
    .sort((a, b) => cfg.availability[b] - cfg.availability[a]);
  return new Set(order.slice(0, Math.max(0, Math.min(7, cfg.daysPerWeek))));
}

export function dayCapacity(cfg: PlannerConfig, date: ISODate, days = studyWeekdays(cfg)): number {
  if (cfg.restDates.includes(date)) return 0;
  const wd = weekday(date);
  if (!days.has(wd)) return 0;
  return Math.max(0, Math.min(cfg.availability[wd], cfg.minutesPerDay));
}

const MAX_DAYS = 730;
const MOCK_MINUTES = 60;
const UNIT_CHECK_MINUTES = 15;

interface Task {
  type: PlanItemType;
  title: string;
  minutes: number;
  lessonId?: string;
  unitId?: string;
}

function buildTasks(cfg: PlannerConfig, lessons: Lesson[]): Task[] {
  const tasks: Task[] = [];
  for (let i = 0; i < lessons.length; i++) {
    const l = lessons[i];
    tasks.push({ type: 'lesson', title: l.title, minutes: effectiveMinutes(l), lessonId: l.id, unitId: LESSON_INDEX[l.id].unit.id });
    const unit = LESSON_INDEX[l.id].unit;
    const nextUnit = lessons[i + 1] ? LESSON_INDEX[lessons[i + 1].id].unit.id : null;
    if (cfg.includeUnitChecks && nextUnit !== unit.id) {
      tasks.push({ type: 'assessment', title: `แบบทดสอบท้ายหน่วย: ${unit.title}`, minutes: UNIT_CHECK_MINUTES, unitId: unit.id });
    }
  }
  return tasks;
}

let idCounter = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/**
 * Lay tasks onto days starting at `from`. `fixed` items (done or pinned) already occupy capacity.
 */
function layout(cfg: PlannerConfig, tasks: Task[], from: ISODate, fixed: PlanItem[]): PlanItem[] {
  const days = studyWeekdays(cfg);
  const used = new Map<ISODate, number>();
  for (const f of fixed) used.set(f.date, (used.get(f.date) ?? 0) + f.minutes);

  const out: PlanItem[] = [];
  const maxCap = Math.max(0, ...[0, 1, 2, 3, 4, 5, 6].map((d) => (days.has(d) ? Math.min(cfg.availability[d], cfg.minutesPerDay) : 0)));
  if (maxCap === 0 || tasks.length === 0) return out;

  let date = from;
  let ti = 0;
  let remainingOfTask = tasks[0]?.minutes ?? 0;
  let partIndex = 1;
  let daysSinceMock = 0;
  let guard = 0;

  while (ti < tasks.length && guard++ < MAX_DAYS) {
    const cap = dayCapacity(cfg, date, days);
    let free = cap - (used.get(date) ?? 0);
    if (cap > 0) {
      daysSinceMock++;
      if (cfg.includeMockTests && daysSinceMock >= 28 && free >= Math.min(MOCK_MINUTES, cap)) {
        const m = Math.min(MOCK_MINUTES, free);
        out.push({ id: newId('mock'), date, type: 'mock', title: 'แบบทดสอบจับเวลา (Mock Test)', minutes: m, done: false });
        free -= m;
        daysSinceMock = 0;
      }
      if (cfg.includeReview && free >= cfg.reviewMinutes + 10) {
        out.push({ id: newId('rev'), date, type: 'review', title: 'ทบทวน Flashcards ประจำวัน', minutes: cfg.reviewMinutes, done: false });
        free -= cfg.reviewMinutes;
      }
      while (ti < tasks.length && free > 0) {
        const t = tasks[ti];
        const totalParts = Math.ceil(t.minutes / maxCap);
        if (totalParts === 1) {
          if (t.minutes > free) break; // try next day — never overfill
          out.push({ id: newId(t.type), date, type: t.type, title: t.title, minutes: t.minutes, lessonId: t.lessonId, unitId: t.unitId, done: false });
          free -= t.minutes;
          ti++;
          remainingOfTask = tasks[ti]?.minutes ?? 0;
          partIndex = 1;
        } else {
          // Long task: split into day-sized parts
          const chunk = Math.min(remainingOfTask, free);
          if (chunk < Math.min(15, remainingOfTask)) break;
          out.push({ id: newId(t.type), date, type: t.type, title: t.title, minutes: chunk, lessonId: t.lessonId, unitId: t.unitId, part: { index: partIndex, total: totalParts }, done: false });
          free -= chunk;
          remainingOfTask -= chunk;
          partIndex++;
          if (remainingOfTask <= 0) {
            ti++;
            remainingOfTask = tasks[ti]?.minutes ?? 0;
            partIndex = 1;
          }
        }
      }
    }
    date = addDays(date, 1);
  }
  // Final mock test before the target date if the plan has room
  if (cfg.includeMockTests && out.length) {
    const last = out[out.length - 1].date;
    for (let d = addDays(last, 1), i = 0; i < 14; i++, d = addDays(d, 1)) {
      const cap = dayCapacity(cfg, d, days);
      if (cap >= 30) {
        out.push({ id: newId('mock'), date: d, type: 'mock', title: 'แบบทดสอบรวมก่อนถึงเป้าหมาย', minutes: Math.min(MOCK_MINUTES, cap), done: false });
        break;
      }
    }
  }
  return out;
}

export function generatePlan(cfg: PlannerConfig, completed: Set<string> = new Set(), now = Date.now()): Plan {
  const lessons = goalLessons(cfg.goal, completed);
  const items = layout(cfg, buildTasks(cfg, lessons), cfg.startDate, []);
  return finalize(cfg, items, now);
}

function finalize(cfg: PlannerConfig, items: PlanItem[], createdAt: number): Plan {
  const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const estimatedFinish = sorted.length ? sorted[sorted.length - 1].date : cfg.startDate;
  return { config: cfg, items: sorted, createdAt, estimatedFinish, overflow: diffDays(cfg.targetDate, estimatedFinish) > 0 };
}

/**
 * Re-plan everything not yet done from `today`, keeping completed and pinned items in place.
 * Used when the learner falls behind ("เลื่อนแผนเมื่อเรียนไม่ทัน").
 */
export function reschedule(plan: Plan, today: ISODate, completedLessons: Set<string> = new Set()): Plan {
  const keep = plan.items.filter((i) => i.done || (i.pinned && i.date >= today));
  const keptLessonIds = new Set(keep.filter((i) => i.lessonId && (!i.part || i.part.index === i.part.total)).map((i) => i.lessonId!));
  const doneIds = new Set([...completedLessons, ...keptLessonIds]);
  const lessons = goalLessons(plan.config.goal, doneIds);
  const cfg = { ...plan.config };
  const fresh = layout(cfg, buildTasks(cfg, lessons), today, keep.filter((i) => i.date >= today));
  return finalize(cfg, [...keep, ...fresh], plan.createdAt);
}

export interface MoveResult {
  plan: Plan;
  warning?: string;
}

export function moveItem(plan: Plan, itemId: string, date: ISODate): MoveResult {
  const items = plan.items.map((i) => (i.id === itemId ? { ...i, date, pinned: true } : i));
  const cap = dayCapacity(plan.config, date);
  const load = items.filter((i) => i.date === date).reduce((s, i) => s + i.minutes, 0);
  let warning: string | undefined;
  if (cap === 0) warning = 'วันนี้เป็นวันพักหรือไม่ใช่วันเรียนตามที่ตั้งไว้';
  else if (load > cap) warning = `วันนั้นจะมีงาน ${load} นาที เกินเวลาที่ตั้งไว้ (${cap} นาที)`;
  return { plan: finalize(plan.config, items, plan.createdAt), warning };
}

export function setItemDone(plan: Plan, itemId: string, done: boolean, now = Date.now()): Plan {
  return { ...plan, items: plan.items.map((i) => (i.id === itemId ? { ...i, done, doneAt: done ? now : undefined } : i)) };
}

export interface PlanStats {
  totalMinutes: number;
  doneMinutes: number;
  progress: number;
  overdue: PlanItem[];
  todayItems: PlanItem[];
  remainingDays: number;
  remainingMinutes: number;
  lessonsTotal: number;
  lessonsDone: number;
}

export function planStats(plan: Plan, today: ISODate): PlanStats {
  const work = plan.items.filter((i) => i.type !== 'review');
  const totalMinutes = work.reduce((s, i) => s + i.minutes, 0);
  const doneMinutes = work.filter((i) => i.done).reduce((s, i) => s + i.minutes, 0);
  const lessonItems = plan.items.filter((i) => i.type === 'lesson' && (!i.part || i.part.index === i.part.total));
  return {
    totalMinutes,
    doneMinutes,
    progress: totalMinutes ? doneMinutes / totalMinutes : 0,
    overdue: plan.items.filter((i) => !i.done && i.date < today && i.type !== 'review'),
    todayItems: plan.items.filter((i) => i.date === today),
    remainingDays: Math.max(0, diffDays(today, plan.config.targetDate)),
    remainingMinutes: totalMinutes - doneMinutes,
    lessonsTotal: lessonItems.length,
    lessonsDone: lessonItems.filter((i) => i.done).length,
  };
}

/** Consecutive days (ending today or yesterday) with at least one study activity. */
export function computeStreak(activityDates: Iterable<ISODate>, today: ISODate): number {
  const set = new Set(activityDates);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Check that no day exceeds its capacity — used by tests and the UI. */
export function overloadedDays(plan: Plan): { date: ISODate; load: number; cap: number }[] {
  const days = studyWeekdays(plan.config);
  const load = new Map<ISODate, number>();
  for (const i of plan.items) load.set(i.date, (load.get(i.date) ?? 0) + i.minutes);
  return [...load.entries()]
    .map(([date, l]) => ({ date, load: l, cap: dayCapacity(plan.config, date, days) }))
    .filter((x) => x.load > x.cap);
}
