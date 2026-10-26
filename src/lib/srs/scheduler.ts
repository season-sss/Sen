/**
 * Spaced-repetition scheduler (SM-2 family, Anki-style learning steps).
 * Pure functions: given a card state, a grade and "now", return the next state and a log entry.
 */
export type Grade = 'again' | 'hard' | 'good' | 'easy';
export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export interface SrsState {
  phase: CardPhase;
  /** Epoch ms when the card is next due */
  due: number;
  /** Interval in days (review phase) */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  /** Index into the learning steps */
  step: number;
}

export interface ReviewLog {
  cardId: string;
  at: number;
  grade: Grade;
  phaseBefore: CardPhase;
  intervalBefore: number;
  intervalAfter: number;
  easeAfter: number;
}

const MIN = 60_000;
const DAY = 86_400_000;
export const LEARNING_STEPS_MIN = [1, 10];
export const RELEARNING_STEPS_MIN = [10];
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;
const START_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_INTERVAL = 365;

export function newSrsState(now = Date.now()): SrsState {
  return { phase: 'new', due: now, interval: 0, ease: START_EASE, reps: 0, lapses: 0, step: 0 };
}

function clampInterval(d: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(d)));
}

export function schedule(state: SrsState, grade: Grade, now = Date.now()): SrsState {
  const s: SrsState = { ...state, reps: state.reps + 1 };

  if (state.phase === 'new' || state.phase === 'learning' || state.phase === 'relearning') {
    const steps = state.phase === 'relearning' ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;
    const phase: CardPhase = state.phase === 'new' ? 'learning' : state.phase;
    if (grade === 'easy') {
      const interval = state.phase === 'relearning' ? clampInterval(Math.max(state.interval, 1) + 1) : EASY_INTERVAL;
      return { ...s, phase: 'review', step: 0, interval, due: now + interval * DAY };
    }
    if (grade === 'again') {
      return { ...s, phase, step: 0, due: now + steps[0] * MIN };
    }
    if (grade === 'hard') {
      const current = steps[Math.min(state.step, steps.length - 1)];
      return { ...s, phase, due: now + Math.round(current * 1.5) * MIN };
    }
    // good: advance a step, or graduate
    const next = state.step + 1;
    if (next < steps.length) return { ...s, phase, step: next, due: now + steps[next] * MIN };
    const interval = state.phase === 'relearning' ? clampInterval(state.interval) : GRADUATING_INTERVAL;
    return { ...s, phase: 'review', step: 0, interval, due: now + interval * DAY };
  }

  // review phase
  if (grade === 'again') {
    const ease = Math.max(MIN_EASE, state.ease - 0.2);
    const interval = clampInterval(state.interval * 0.5);
    return { ...s, phase: 'relearning', step: 0, ease, interval, lapses: state.lapses + 1, due: now + RELEARNING_STEPS_MIN[0] * MIN };
  }
  if (grade === 'hard') {
    const ease = Math.max(MIN_EASE, state.ease - 0.15);
    const interval = clampInterval(Math.max(state.interval + 1, state.interval * 1.2));
    return { ...s, ease, interval, due: now + interval * DAY };
  }
  if (grade === 'good') {
    const interval = clampInterval(Math.max(state.interval + 1, state.interval * state.ease));
    return { ...s, interval, due: now + interval * DAY };
  }
  const ease = state.ease + 0.15;
  const interval = clampInterval(Math.max(state.interval + 2, state.interval * state.ease * 1.3));
  return { ...s, ease, interval, due: now + interval * DAY };
}

export function review(cardId: string, state: SrsState, grade: Grade, now = Date.now()): { state: SrsState; log: ReviewLog } {
  const next = schedule(state, grade, now);
  return {
    state: next,
    log: { cardId, at: now, grade, phaseBefore: state.phase, intervalBefore: state.interval, intervalAfter: next.interval, easeAfter: next.ease },
  };
}

export function isDue(state: SrsState, now = Date.now()): boolean {
  return state.phase !== 'new' && state.due <= now;
}

/** Human-readable preview of when each grade would show the card again. */
export function previewIntervals(state: SrsState, now = Date.now()): Record<Grade, string> {
  const fmt = (ms: number) => {
    const d = ms - now;
    if (d < 60 * MIN) return `${Math.max(1, Math.round(d / MIN))} นาที`;
    if (d < DAY) return `${Math.round(d / (60 * MIN))} ชม.`;
    const days = Math.round(d / DAY);
    return days >= 30 ? `${Math.round(days / 30)} เดือน` : `${days} วัน`;
  };
  return {
    again: fmt(schedule(state, 'again', now).due),
    hard: fmt(schedule(state, 'hard', now).due),
    good: fmt(schedule(state, 'good', now).due),
    easy: fmt(schedule(state, 'easy', now).due),
  };
}

export interface QueueOptions {
  newPerDay: number;
  newIntroducedToday: number;
  now?: number;
}

/** Build today's queue: due learning/review cards first (oldest due first), then new cards up to the daily limit. */
export function buildQueue<T extends { id: string; srs: SrsState }>(cards: T[], opts: QueueOptions): T[] {
  const now = opts.now ?? Date.now();
  const due = cards.filter((c) => isDue(c.srs, now)).sort((a, b) => a.srs.due - b.srs.due);
  const room = Math.max(0, opts.newPerDay - opts.newIntroducedToday);
  const fresh = cards.filter((c) => c.srs.phase === 'new').slice(0, room);
  return [...due, ...fresh];
}

export type MemoryLevel = 'new' | 'learning' | 'young' | 'mature';
export function memoryLevel(s: SrsState): MemoryLevel {
  if (s.phase === 'new') return 'new';
  if (s.phase !== 'review') return 'learning';
  return s.interval >= 21 ? 'mature' : 'young';
}
