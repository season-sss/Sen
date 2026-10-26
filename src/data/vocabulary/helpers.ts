import type { IrregularClass } from '@/lib/conjugation/classify';
import type { Pos, VocabEntry, VocabLevel } from '../types';

const POS_SHORT: Record<string, Pos> = {
  n: 'noun',
  pron: 'pronoun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  num: 'numeral',
  det: 'determiner',
  intj: 'interjection',
  conj: 'conjunction',
  expr: 'expression',
};

export type Row = [ko: string, th: string, pos: keyof typeof POS_SHORT, ex: string, exTh: string, extra?: { irr?: IrregularClass; pron?: string; note?: string; id?: string }];

/** Compact authoring helper: one topic + level per section. */
export function section(topic: string, level: VocabLevel, rows: Row[]): VocabEntry[] {
  return rows.map(([ko, th, pos, ex, exTh, extra]) => ({
    id: extra?.id ?? `${level}-${topic}-${ko}`,
    ko,
    th,
    pos: POS_SHORT[pos],
    level,
    topic,
    ex,
    exTh,
    ...(extra?.irr ? { irr: extra.irr } : {}),
    ...(extra?.pron ? { pron: extra.pron } : {}),
    ...(extra?.note ? { note: extra.note } : {}),
  }));
}
