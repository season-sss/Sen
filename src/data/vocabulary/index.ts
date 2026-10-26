import type { VocabEntry, VocabLevel } from '../types';
import { A1 } from './a1';
import { A2 } from './a2';
import { B1 } from './b1';
import { B2 } from './b2';

export { TOPICS, TOPIC_BY_ID } from './topics';

export const VOCABULARY: VocabEntry[] = [...A1, ...A2, ...B1, ...B2];

export const VOCAB_BY_ID: Record<string, VocabEntry> = Object.fromEntries(VOCABULARY.map((v) => [v.id, v]));

export function vocabByLevel(level: VocabLevel): VocabEntry[] {
  return VOCABULARY.filter((v) => v.level === level);
}

export function vocabByTopic(topic: string, level?: VocabLevel): VocabEntry[] {
  return VOCABULARY.filter((v) => v.topic === topic && (!level || v.level === level));
}

/** Verbs and adjectives that can be fed to the conjugation engine. */
export function predicates(): VocabEntry[] {
  return VOCABULARY.filter((v) => (v.pos === 'verb' || v.pos === 'adjective') && /^[가-힣]+다$/.test(v.ko));
}

/** First entry per dictionary form + pos (removes homograph repeats across topics). */
export function uniquePredicates(): VocabEntry[] {
  const seen = new Set<string>();
  return predicates().filter((v) => {
    const k = `${v.ko}|${v.pos}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
