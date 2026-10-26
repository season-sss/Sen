import { describe, expect, it } from 'vitest';
import { computeStreak, DEFAULT_CONFIG, generatePlan, goalLessons, moveItem, overloadedDays, planStats, reschedule, setItemDone, studyWeekdays } from './planner';
import { weekday } from '@/lib/util/date';

const START = '2026-01-05'; // Monday

describe('planner', () => {
  it('never schedules more than the daily limit or on rest days', () => {
    const cfg = { ...DEFAULT_CONFIG(START), restDates: ['2026-01-07'], minutesPerDay: 40 };
    const plan = generatePlan(cfg);
    expect(plan.items.length).toBeGreaterThan(10);
    expect(overloadedDays(plan)).toEqual([]);
    expect(plan.items.some((i) => i.date === '2026-01-07')).toBe(false);
  });

  it('uses only the chosen number of study days, preferring days with most free time', () => {
    const cfg = { ...DEFAULT_CONFIG(START), availability: [120, 30, 0, 30, 30, 30, 90], daysPerWeek: 3 };
    const days = studyWeekdays(cfg);
    expect([...days].sort()).toEqual([0, 1, 6]);
    const plan = generatePlan(cfg);
    expect(plan.items.every((i) => days.has(weekday(i.date)))).toBe(true);
  });

  it('schedules every goal lesson exactly once (splitting long lessons into parts)', () => {
    const cfg = { ...DEFAULT_CONFIG(START), minutesPerDay: 20, includeReview: false };
    const plan = generatePlan(cfg);
    const lessons = goalLessons(cfg.goal);
    for (const l of lessons) {
      const parts = plan.items.filter((i) => i.lessonId === l.id && i.type === 'lesson');
      expect(parts.length).toBeGreaterThan(0);
      expect(parts.reduce((s, p) => s + p.minutes, 0)).toBeGreaterThanOrEqual(l.minutes);
    }
    expect(overloadedDays(plan)).toEqual([]);
  });

  it('keeps curriculum order', () => {
    const plan = generatePlan(DEFAULT_CONFIG(START));
    const order = goalLessons(plan.config.goal).map((l) => l.id);
    const seen = plan.items.filter((i) => i.type === 'lesson').map((i) => i.lessonId!);
    const firstSeen = order.filter((id) => seen.includes(id));
    expect([...new Set(seen)]).toEqual(firstSeen);
  });

  it('flags overflow when the goal cannot fit before the target date', () => {
    const plan = generatePlan({ ...DEFAULT_CONFIG(START), goal: { type: 'levels', levels: ['A1', 'A2', 'B1'] }, targetDate: '2026-02-01' });
    expect(plan.overflow).toBe(true);
  });

  it('reschedules overdue work from today, keeping completed items', () => {
    let plan = generatePlan(DEFAULT_CONFIG(START));
    const first = plan.items.find((i) => i.type === 'lesson')!;
    plan = setItemDone(plan, first.id, true);
    const re = reschedule(plan, '2026-02-01', new Set([first.lessonId!]));
    expect(re.items.find((i) => i.id === first.id)?.done).toBe(true);
    const undone = re.items.filter((i) => !i.done);
    expect(undone.every((i) => i.date >= '2026-02-01')).toBe(true);
    expect(re.items.filter((i) => i.lessonId === first.lessonId && i.type === 'lesson').length).toBe(1);
    expect(overloadedDays({ ...re, items: undone })).toEqual([]);
  });

  it('moves items and warns when a day becomes overloaded', () => {
    const plan = generatePlan(DEFAULT_CONFIG(START));
    const [a] = plan.items.filter((i) => i.type === 'lesson');
    const busy = plan.items.find((i) => i.date !== a.date && i.type === 'lesson')!.date;
    const { plan: moved } = moveItem(plan, a.id, busy);
    expect(moved.items.find((i) => i.id === a.id)?.date).toBe(busy);
    expect(moved.items.find((i) => i.id === a.id)?.pinned).toBe(true);
  });

  it('computes stats and streaks', () => {
    const plan = generatePlan(DEFAULT_CONFIG(START));
    const s = planStats(plan, START);
    expect(s.progress).toBe(0);
    expect(s.todayItems.length).toBeGreaterThan(0);
    expect(computeStreak(['2026-01-03', '2026-01-04', '2026-01-05'], '2026-01-05')).toBe(3);
    expect(computeStreak(['2026-01-03', '2026-01-04'], '2026-01-05')).toBe(2);
    expect(computeStreak(['2026-01-02'], '2026-01-05')).toBe(0);
  });
});
