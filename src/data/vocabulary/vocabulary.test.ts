import { describe, expect, it } from 'vitest';
import { VOCABULARY, TOPIC_BY_ID, predicates } from './index';
import { conjugate } from '@/lib/conjugation';
import { pronounce } from '@/lib/hangul';

describe('vocabulary integrity', () => {
  it('has unique ids', () => {
    const ids = VOCABULARY.map((v) => v.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
  });
  it('uses known topics', () => {
    const bad = VOCABULARY.filter((v) => !TOPIC_BY_ID[v.topic]).map((v) => `${v.id}:${v.topic}`);
    expect(bad).toEqual([]);
  });
  it('has no empty fields and sentences end with punctuation', () => {
    const bad = VOCABULARY.filter((v) => !v.ko || !v.th || !v.ex || !v.exTh || !/[.?!]$/.test(v.ex)).map((v) => v.id);
    expect(bad).toEqual([]);
  });
  it('has no accidental duplicates (same word, pos and level)', () => {
    const keys = VOCABULARY.map((v) => `${v.ko}|${v.pos}|${v.level}|${v.th}`);
    const dups = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dups).toEqual([]);
  });
  it('pronunciation overrides are only used where the rule engine differs', () => {
    const redundant = VOCABULARY.filter((v) => v.pron && pronounce(v.ko).text === v.pron).map((v) => v.ko);
    expect(redundant).toEqual([]);
  });
});

describe('vocabulary ↔ conjugation engine', () => {
  it('every verb/adjective conjugates with a verified or reviewed class', () => {
    const problems: string[] = [];
    for (const v of predicates()) {
      const r = conjugate(v.ko, { pos: v.pos === 'verb' ? 'verb' : 'adjective', irregular: v.irr });
      if (r.confidence !== 'verified') problems.push(`${v.ko} (${r.confidence})`);
      if (!r.forms.find((f) => f.key === 'present')?.value) problems.push(`${v.ko}: no present form`);
    }
    expect(problems).toEqual([]);
  });
});
