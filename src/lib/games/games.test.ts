import { describe, expect, it } from 'vitest';
import { bossHit, GAMES, generateGameQuestions, newBoss, scoreAnswer } from './games';
import { grade } from '@/lib/quiz/grading';

describe('games', () => {
  it('every game generates a full, well-formed round set at each level', () => {
    for (const g of GAMES)
      for (const lv of ['A1', 'A2', 'B1', 'B2', 'ADV'] as const) {
        const qs = generateGameQuestions(g.id, { maxLevel: lv, seed: 3 });
        expect(qs.length, `${g.id} ${lv}`).toBe(g.rounds);
        for (const q of qs) {
          if (q.kind === 'mcq') {
            expect(new Set(q.options).size, `${q.id}`).toBe(q.options.length);
            expect(grade(q, q.answer).correct).toBe(true);
          }
          if (q.kind === 'text') expect(grade(q, q.answers[0]).correct).toBe(true);
          if (q.kind === 'order') expect(grade(q, q.tokens).correct).toBe(true);
          if (q.kind === 'match') expect(new Set(q.pairs.map((p) => p.th)).size).toBe(q.pairs.length);
        }
      }
  });
  it('scales to many players (8 players × rounds)', () => {
    for (const g of GAMES) {
      if (g.id === 'word-matching') continue;
      expect(generateGameQuestions(g.id, { maxLevel: 'A1', count: g.rounds * 8, seed: 5 }).length, g.id).toBe(g.rounds * 8);
    }
  });
  it('is reproducible from a seed (needed for synchronized rounds)', () => {
    const a = generateGameQuestions('vocab-race', { seed: 99 }).map((q) => q.id);
    const b = generateGameQuestions('vocab-race', { seed: 99 }).map((q) => q.id);
    expect(a).toEqual(b);
  });
  it('scores correct answers with speed and streak bonuses', () => {
    expect(scoreAnswer(false, 1000, 10000, 3)).toBe(0);
    expect(scoreAnswer(true, 0, 10000, 0)).toBe(200);
    expect(scoreAnswer(true, 10000, 10000, 0)).toBe(100);
    expect(scoreAnswer(true, 5000, 10000, 10)).toBe(100 + 50 + 50);
  });
  it('boss battle can be won and lost', () => {
    let b = newBoss(1, 3);
    for (let i = 0; i < 20 && !b.defeated; i++) b = bossHit(b, true, 200);
    expect(b.defeated).toBe(true);
    let c = newBoss(1, 3);
    for (let i = 0; i < 3; i++) c = bossHit(c, false, 0);
    expect(c.lost).toBe(true);
  });
});
