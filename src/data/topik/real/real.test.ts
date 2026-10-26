import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REAL_EXAMS, TOPIK96 } from './topik96';

// Official 정답 및 배점표 (96th TOPIK I), typed in separately from the question data so a slip
// in either place fails this test.
const KEY_L = '3 4 4 3 3 1 2 3 2 4 3 1 2 1 1 2 4 1 3 4 1 2 2 4 3 4 1 2 3 4';
const PTS_L = '4 4 3 3 4 3 3 3 3 4 3 3 4 3 4 4 3 3 3 3 3 3 3 3 3 4 3 4 3 4';
const KEY_R = '3 4 2 3 3 4 3 4 4 2 2 3 2 1 2 2 1 3 4 4 1 3 1 3 3 1 2 1 1 1 2 4 4 2 4 1 2 4 1 3';
const PTS_R = '2 2 2 2 2 2 3 3 2 3 3 3 3 2 3 3 3 2 2 2 3 2 2 3 2 3 3 2 2 3 2 2 2 3 2 3 3 3 3 3';
const nums = (s: string) => s.split(' ').map(Number);

describe('96th TOPIK I transcription', () => {
  const qs = TOPIK96.questions;

  it('has questions 1–70 in order', () => {
    expect(qs.map((q) => q.no)).toEqual(Array.from({ length: 70 }, (_, i) => i + 1));
  });

  it('matches the official answer key and points', () => {
    expect(qs.map((q) => q.answer + 1)).toEqual([...nums(KEY_L), ...nums(KEY_R)]);
    expect(qs.map((q) => q.points)).toEqual([...nums(PTS_L), ...nums(PTS_R)]);
  });

  it('section maxima add up to 100 each', () => {
    for (const section of ['listening', 'reading'] as const) {
      const ids = new Set(TOPIK96.groups.filter((g) => g.section === section).map((g) => g.id));
      const sum = qs.filter((q) => ids.has(q.groupId)).reduce((s, q) => s + q.points, 0);
      expect(sum).toBe(TOPIK96.sections[section].maxScore);
    }
  });

  it('every question has four options, Thai translations and an explanation', () => {
    for (const q of qs) {
      expect(q.options, `Q${q.no}`).toHaveLength(4);
      expect(q.optionsTh, `Q${q.no}`).toHaveLength(4);
      expect(new Set(q.options).size, `Q${q.no} duplicate options`).toBe(4);
      expect(q.explainTh.length, `Q${q.no}`).toBeGreaterThan(5);
      if (q.optionImages) expect(q.optionImages).toHaveLength(4);
    }
  });

  it('groups cover every question exactly once and blank questions have a passage with ㉠', () => {
    for (const q of qs) {
      const g = TOPIK96.groups.find((x) => x.id === q.groupId)!;
      expect(q.no).toBeGreaterThanOrEqual(g.from);
      expect(q.no).toBeLessThanOrEqual(g.to);
      if (q.prompt?.startsWith('㉠')) expect(g.passage, `Q${q.no}`).toContain('㉠');
    }
  });

  it('every referenced image exists in public/', () => {
    const imgs = [...TOPIK96.groups.flatMap((g) => (g.image ? [g.image] : [])), ...qs.flatMap((q) => [...(q.image ? [q.image] : []), ...(q.optionImages ?? [])])];
    expect(imgs.length).toBe(12);
    for (const img of imgs) {
      expect(existsSync(resolve(__dirname, '../../../../public', img.src)), img.src).toBe(true);
      expect(img.alt.length).toBeGreaterThan(10);
    }
  });

  it('exam ids are unique', () => {
    expect(new Set(REAL_EXAMS.map((e) => e.id)).size).toBe(REAL_EXAMS.length);
  });
});
