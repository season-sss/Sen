import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CURRICULUM } from '@/data/curriculum';
import { buildReport, checkWriting, grade, gradeText, lessonQuestions, levelAssessment, unitAssessment } from './index';
import { WRITING_BY_ID } from '@/data/writing';
import { TOPIK1_ALL } from '@/data/topik/topik1';
import { TOPIK2_ALL } from '@/data/topik/topik2';
import { TRACK3_QUESTIONS } from '@/data/topik/track3';

describe('lesson question generation', () => {
  it('every lesson produces gradeable questions', () => {
    const empty = ALL_LESSONS.filter((l) => lessonQuestions(l, 3).length < 2 && l.source.kind !== 'writing').map((l) => l.id);
    expect(empty).toEqual([]);
  });
  it('mcq questions are well-formed (answer in range, no duplicate options)', () => {
    const bad: string[] = [];
    const all = [...ALL_LESSONS.flatMap((l) => lessonQuestions(l, 5)), ...TOPIK1_ALL, ...TOPIK2_ALL, ...TRACK3_QUESTIONS];
    for (const q of all) {
      if (q.kind !== 'mcq') continue;
      if (q.answer < 0 || q.answer >= q.options.length) bad.push(`${q.id}: answer`);
      if (new Set(q.options).size !== q.options.length) bad.push(`${q.id}: dup options ${q.options.join('|')}`);
      if (q.options.length < 2) bad.push(`${q.id}: <2 options`);
    }
    expect(bad).toEqual([]);
  });
  it('generation is deterministic for a seed', () => {
    const l = ALL_LESSONS.find((x) => x.source.kind === 'vocab')!;
    expect(lessonQuestions(l, 42).map((q) => q.id)).toEqual(lessonQuestions(l, 42).map((q) => q.id));
  });
  it('builds unit and level assessments for every level', () => {
    for (const lv of CURRICULUM) {
      expect(levelAssessment(lv.id).length).toBeGreaterThan(5);
      expect(unitAssessment(lv.modules[0].units[0].id).length).toBeGreaterThan(2);
    }
  });
});

describe('grading', () => {
  it('grades mcq, text and order', () => {
    expect(grade({ id: 'x', kind: 'mcq', section: 'grammar', level: 'A1', prompt: '', options: ['a', 'b'], answer: 1 }, 1).correct).toBe(true);
    expect(gradeText(['먹어요'], '먹어요.').correct).toBe(true);
    expect(gradeText(['먹을 수 있어요'], '먹을수있어요').note).toBeTruthy();
    expect(gradeText(['먹어요'], '먹아요').correct).toBe(false);
    expect(grade({ id: 'o', kind: 'order', section: 'ordering', level: 'A1', prompt: '', tokens: ['저는', '학생이에요.'] }, ['저는', '학생이에요.']).correct).toBe(true);
  });
  it('checks writing with rule-based feedback', () => {
    const q = WRITING_BY_ID['w-b1-opinion'];
    const good = checkWriting(q, q.modelAnswer);
    expect(good.checks.find((c) => c.id === 'register')?.passed).toBe(true);
    expect(good.checks.find((c) => c.id === 'length')?.passed).toBe(true);
    const polite = checkWriting(q, '저는 좋다고 생각해요. 돈을 벌 수 있어요. 경험도 쌓을 수 있어요.');
    expect(polite.checks.find((c) => c.id === 'register')?.passed).toBe(false);
  });
  it('builds a report with strengths and weaknesses', () => {
    const r = buildReport([
      { questionId: '1', correct: true, given: '', section: 'vocabulary', level: 'A1' },
      { questionId: '2', correct: true, given: '', section: 'vocabulary', level: 'A1' },
      { questionId: '3', correct: false, given: '', section: 'grammar', level: 'A1', ref: { type: 'grammar', id: 'g-topic' } },
    ]);
    expect(r.strengths.map((s) => s.section)).toEqual(['vocabulary']);
    expect(r.weaknesses.map((s) => s.section)).toEqual(['grammar']);
    expect(r.missedRefs).toEqual([{ type: 'grammar', id: 'g-topic' }]);
  });
});
