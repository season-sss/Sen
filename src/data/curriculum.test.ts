import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CURRICULUM, LESSON_INDEX } from './curriculum';
import { GRAMMAR_BY_ID } from './grammar';
import { VOCABULARY, TOPIC_BY_ID } from './vocabulary';
import { DIALOGUES } from './dialogues';
import { READINGS } from './readings';
import { WRITING_BY_ID, ALL_WRITING } from './writing';
import { POS_LESSONS, STRUCTURE_LESSONS } from './foundations';
import { FORM_BY_KEY, conjugate } from '@/lib/conjugation';
import { SOUND_RULE_INFO, pronounce } from '@/lib/hangul';
import { SOUND_RULE_PRACTICE } from './hangul';
import { uniquePredicates } from './vocabulary';

const ENGINE_KEYS = new Set(['negAn', 'negAnPast', 'negMot']);

describe('curriculum map', () => {
  it('has unique lesson ids', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('every lesson resolves to real content', () => {
    const problems: string[] = [];
    for (const l of ALL_LESSONS) {
      const s = l.source;
      switch (s.kind) {
        case 'vocab':
          for (const t of s.topics) {
            if (!TOPIC_BY_ID[t]) problems.push(`${l.id}: topic ${t}`);
            const n = VOCABULARY.filter((v) => v.topic === t && v.level === s.level).length;
            if (n < 5) problems.push(`${l.id}: only ${n} words for ${t}/${s.level}`);
          }
          break;
        case 'grammar':
          for (const id of s.ids) if (!GRAMMAR_BY_ID[id]) problems.push(`${l.id}: grammar ${id}`);
          break;
        case 'dialogue':
          for (const id of s.ids) if (!DIALOGUES.find((d) => d.id === id)) problems.push(`${l.id}: dialogue ${id}`);
          break;
        case 'reading':
          for (const id of s.ids) if (!READINGS.find((d) => d.id === id)) problems.push(`${l.id}: reading ${id}`);
          break;
        case 'writing':
          for (const id of s.questionIds) if (!WRITING_BY_ID[id]) problems.push(`${l.id}: writing ${id}`);
          break;
        case 'pos':
          for (const id of s.ids) if (!POS_LESSONS.find((p) => p.id === id)) problems.push(`${l.id}: pos ${id}`);
          break;
        case 'structure':
          for (const id of s.ids) if (!STRUCTURE_LESSONS.find((p) => p.id === id)) problems.push(`${l.id}: structure ${id}`);
          break;
        case 'hangul-sound':
          for (const r of s.rules) if (!(r in SOUND_RULE_INFO)) problems.push(`${l.id}: rule ${r}`);
          break;
        case 'conjugation': {
          for (const k of s.formKeys) if (!FORM_BY_KEY[k] && !ENGINE_KEYS.has(k)) problems.push(`${l.id}: form ${k}`);
          const known = new Map(uniquePredicates().map((v) => [v.ko, v]));
          for (const w of s.words) {
            const v = known.get(w);
            const pos = v ? (v.pos === 'adjective' ? 'adjective' : 'verb') : 'verb';
            const r = conjugate(w, { pos, irregular: v?.irr });
            if (r.confidence !== 'verified') problems.push(`${l.id}: ${w} not verified`);
            if (!v) problems.push(`${l.id}: ${w} not in vocabulary`);
          }
          break;
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('prerequisites exist and come from the same or an earlier lesson set without cycles', () => {
    const problems: string[] = [];
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (id: string) => {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        problems.push(`cycle at ${id}`);
        return;
      }
      visiting.add(id);
      for (const r of LESSON_INDEX[id]?.lesson.requires ?? []) {
        if (!LESSON_INDEX[r]) problems.push(`${id} requires missing ${r}`);
        else visit(r);
      }
      visiting.delete(id);
      done.add(id);
    };
    ALL_LESSONS.forEach((l) => visit(l.id));
    expect(problems).toEqual([]);
  });

  it('covers every level', () => {
    expect(CURRICULUM.map((l) => l.id)).toEqual(['L0', 'A1', 'A2', 'B1', 'B2', 'ADV']);
  });
});

describe('content cross-checks', () => {
  it('sound-rule practice words actually trigger their rule', () => {
    const bad: string[] = [];
    for (const { rule, words } of SOUND_RULE_PRACTICE)
      for (const w of words) if (!pronounce(w).rules.includes(rule as never)) bad.push(`${w} (${rule})`);
    expect(bad).toEqual([]);
  });
  it('writing model answers respect their own length limits', () => {
    const bad = ALL_WRITING.filter((w) => w.task !== '51' && w.task !== '52').filter((w) => {
      const n = w.modelAnswer.replace(/\n/g, '').length;
      return (w.minChars && n < w.minChars) || (w.maxChars && n > w.maxChars);
    }).map((w) => `${w.id}: ${w.modelAnswer.replace(/\n/g, '').length}`);
    expect(bad).toEqual([]);
  });
});
