import type { IrregularClass } from '@/lib/conjugation/classify';

export type Level = 'L0' | 'A1' | 'A2' | 'B1' | 'B2' | 'ADV';
export type VocabLevel = Exclude<Level, 'L0' | 'ADV'>;

export const LEVEL_INFO: Record<Level, { label: string; th: string; topik: string; color: string }> = {
  L0: { label: 'Level 0', th: 'พื้นฐานฮันกึล', topik: '—', color: 'sky' },
  A1: { label: 'A1', th: 'เริ่มต้น', topik: '≈ TOPIK I ระดับ 1', color: 'emerald' },
  A2: { label: 'A2', th: 'พื้นฐาน', topik: '≈ TOPIK I ระดับ 2', color: 'teal' },
  B1: { label: 'B1', th: 'กลาง', topik: '≈ TOPIK II ระดับ 3–4', color: 'amber' },
  B2: { label: 'B2', th: 'กลางค่อนสูง', topik: '≈ TOPIK II ระดับ 4–5', color: 'orange' },
  ADV: { label: 'Advanced', th: 'ต่อยอดระดับสูง', topik: '≈ TOPIK II ระดับ 5–6', color: 'rose' },
};

/** The CEFR ↔ TOPIK mapping is an approximation used for study planning, not an official equivalence. */
export const LEVEL_MAPPING_NOTE =
  'การเทียบระดับ A1–B2 กับ TOPIK เป็นค่าประมาณเพื่อวางแผนการเรียน ไม่ใช่การเทียบอย่างเป็นทางการ';

export type Pos =
  | 'noun'
  | 'pronoun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'numeral'
  | 'determiner'
  | 'interjection'
  | 'conjunction'
  | 'expression';

export const POS_INFO: Record<Pos, { ko: string; th: string }> = {
  noun: { ko: '명사', th: 'คำนาม' },
  pronoun: { ko: '대명사', th: 'คำสรรพนาม' },
  verb: { ko: '동사', th: 'คำกริยา' },
  adjective: { ko: '형용사', th: 'คำคุณศัพท์' },
  adverb: { ko: '부사', th: 'คำวิเศษณ์' },
  numeral: { ko: '수사', th: 'คำบอกจำนวน' },
  determiner: { ko: '관형사', th: 'คำขยายหน้าคำนาม' },
  interjection: { ko: '감탄사', th: 'คำอุทาน' },
  conjunction: { ko: '접속 부사', th: 'คำเชื่อม' },
  expression: { ko: '표현', th: 'สำนวน/วลี' },
};

export interface VocabEntry {
  id: string;
  ko: string;
  th: string;
  pos: Pos;
  level: VocabLevel;
  topic: string;
  ex: string;
  exTh: string;
  /** Reviewed irregular class (verbs/adjectives) — overrides the engine's inference. */
  irr?: IrregularClass;
  /** Pronunciation override for words the rule engine cannot predict (e.g. 물고기 [물꼬기]). */
  pron?: string;
  note?: string;
}

export interface VocabTopic {
  id: string;
  th: string;
  ko: string;
  icon: string;
}

export interface Example {
  ko: string;
  th: string;
}

export interface GrammarPoint {
  id: string;
  pattern: string;
  level: Exclude<Level, 'L0'>;
  category: GrammarCategory;
  meaning: string;
  /** How to form it, Thai explanation */
  formation: string[];
  usage: string[];
  examples: Example[];
  /** Common mistakes Thai learners make */
  mistakes?: { wrong: string; right: string; why: string }[];
  /** Conjugation engine form key, enabling unlimited generated practice */
  formKey?: string;
  /** Related grammar ids (compare / contrast) */
  related?: string[];
  exercises: GrammarExercise[];
}

export type GrammarCategory =
  | 'copula'
  | 'particle'
  | 'tense'
  | 'negation'
  | 'connective'
  | 'desire'
  | 'request'
  | 'ability'
  | 'experience'
  | 'modifier'
  | 'honorific'
  | 'aspect'
  | 'comparison'
  | 'quotation'
  | 'conjecture'
  | 'passive-causative'
  | 'advanced'
  | 'register';

export type GrammarExercise =
  | { type: 'choice'; prompt: string; promptTh?: string; options: string[]; answer: number; explain: string }
  | { type: 'fill'; prompt: string; promptTh?: string; answers: string[]; explain: string }
  | { type: 'order'; th: string; tokens: string[]; explain?: string };

export interface Dialogue {
  id: string;
  title: string;
  level: VocabLevel;
  situation: string;
  lines: { speaker: string; ko: string; th: string }[];
  questions: { q: string; options: string[]; answer: number }[];
}

export interface ReadingPassage {
  id: string;
  title: string;
  level: VocabLevel;
  ko: string;
  th: string;
  questions: { q: string; options: string[]; answer: number; explain?: string }[];
}
