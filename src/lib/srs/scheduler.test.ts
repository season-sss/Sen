import { describe, expect, it } from 'vitest';
import { buildQueue, isDue, memoryLevel, newSrsState, review, schedule, type SrsState } from './scheduler';

const NOW = new Date('2026-01-01T09:00:00').getTime();
const DAY = 86_400_000;

describe('SRS scheduler', () => {
  it('moves a new card through learning steps then graduates', () => {
    let s = newSrsState(NOW);
    s = schedule(s, 'good', NOW);
    expect(s.phase).toBe('learning');
    expect(s.due - NOW).toBe(10 * 60_000);
    s = schedule(s, 'good', NOW);
    expect(s.phase).toBe('review');
    expect(s.interval).toBe(1);
    expect(s.due - NOW).toBe(DAY);
  });
  it('easy on a new card graduates directly with a longer interval', () => {
    const s = schedule(newSrsState(NOW), 'easy', NOW);
    expect(s.phase).toBe('review');
    expect(s.interval).toBe(4);
  });
  it('grows intervals with ease on good', () => {
    let s: SrsState = { ...newSrsState(NOW), phase: 'review', interval: 10, ease: 2.5 };
    s = schedule(s, 'good', NOW);
    expect(s.interval).toBe(25);
  });
  it('lapses reduce ease and send the card to relearning', () => {
    const s = schedule({ ...newSrsState(NOW), phase: 'review', interval: 20, ease: 2.5 }, 'again', NOW);
    expect(s.phase).toBe('relearning');
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
    expect(s.interval).toBe(10);
  });
  it('never drops ease below 1.3', () => {
    let s: SrsState = { ...newSrsState(NOW), phase: 'review', interval: 5, ease: 1.35 };
    s = schedule(s, 'hard', NOW);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
  });
  it('logs reviews', () => {
    const { log } = review('c1', newSrsState(NOW), 'good', NOW);
    expect(log).toMatchObject({ cardId: 'c1', grade: 'good', phaseBefore: 'new' });
  });
  it('builds a queue of due cards plus limited new cards', () => {
    const cards = [
      { id: 'a', srs: { ...newSrsState(NOW), phase: 'review' as const, interval: 1, due: NOW - 1000 } },
      { id: 'b', srs: { ...newSrsState(NOW), phase: 'review' as const, interval: 3, due: NOW + DAY } },
      { id: 'c', srs: newSrsState(NOW) },
      { id: 'd', srs: newSrsState(NOW) },
    ];
    expect(buildQueue(cards, { newPerDay: 1, newIntroducedToday: 0, now: NOW }).map((c) => c.id)).toEqual(['a', 'c']);
    expect(isDue(cards[1].srs, NOW)).toBe(false);
    expect(memoryLevel(cards[0].srs)).toBe('young');
  });
});
