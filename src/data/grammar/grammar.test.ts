import { describe, expect, it } from 'vitest';
import { GRAMMAR, GRAMMAR_BY_ID } from './index';
import { FORM_BY_KEY } from '@/lib/conjugation';

const ENGINE_ONLY_KEYS = new Set(['negAn', 'negAnPast', 'negMot']);

describe('grammar content integrity', () => {
  it('ids are unique', () => {
    const ids = GRAMMAR.map((g) => g.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
  it('related ids exist', () => {
    const bad = GRAMMAR.flatMap((g) => (g.related ?? []).filter((r) => !GRAMMAR_BY_ID[r]).map((r) => `${g.id}→${r}`));
    expect(bad).toEqual([]);
  });
  it('formKeys refer to real engine forms', () => {
    const bad = GRAMMAR.filter((g) => g.formKey && !FORM_BY_KEY[g.formKey] && !ENGINE_ONLY_KEYS.has(g.formKey)).map((g) => g.id);
    expect(bad).toEqual([]);
  });
  it('every point has examples and at least one exercise', () => {
    const bad = GRAMMAR.filter((g) => g.examples.length < 2 || g.exercises.length < 1).map((g) => g.id);
    expect(bad).toEqual([]);
  });
  it('choice exercises have a valid answer index and unique options', () => {
    const bad: string[] = [];
    for (const g of GRAMMAR)
      for (const ex of g.exercises)
        if (ex.type === 'choice') {
          if (ex.answer < 0 || ex.answer >= ex.options.length) bad.push(`${g.id}: ${ex.prompt}`);
          if (new Set(ex.options).size !== ex.options.length) bad.push(`${g.id}: duplicate options`);
        }
    expect(bad).toEqual([]);
  });
  it('fill exercises contain a blank and at least one answer', () => {
    const bad = GRAMMAR.flatMap((g) =>
      g.exercises.filter((e) => e.type === 'fill' && (!e.prompt.includes('___') || e.answers.length === 0)).map(() => g.id),
    );
    expect(bad).toEqual([]);
  });
  it('order exercises have at least two tokens', () => {
    const bad = GRAMMAR.flatMap((g) => g.exercises.filter((e) => e.type === 'order' && e.tokens.length < 2).map(() => g.id));
    expect(bad).toEqual([]);
  });
});
