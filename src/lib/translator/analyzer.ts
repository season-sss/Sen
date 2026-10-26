/**
 * Korean Reading Assistant — a transparent, dictionary-based analyzer.
 *
 * It does NOT translate arbitrary sentences. It:
 *   1. finds exact matches in HANEUL's reviewed sentence bank (high confidence translation),
 *   2. otherwise segments the sentence into words, splits particles, and reverse-looks-up
 *      conjugated verbs/adjectives through the conjugation engine,
 *   3. reports coverage and a confidence level for every token, and a word-by-word gloss
 *      that is explicitly labelled as NOT a sentence translation.
 */
import { VOCABULARY, uniquePredicates } from '@/data/vocabulary';
import { GRAMMAR } from '@/data/grammar';
import { DIALOGUES } from '@/data/dialogues';
import { POS_LESSONS, STRUCTURE_LESSONS } from '@/data/foundations';
import type { Pos, VocabEntry } from '@/data/types';
import { conjugate, conjugateNoun } from '@/lib/conjugation';
import { finalOf, isHangulText, romanize, thaiReading } from '@/lib/hangul';

export type Confidence = 'high' | 'medium' | 'low';

export interface TokenAnalysis {
  surface: string;
  kind: 'word' | 'phrase' | 'unknown' | 'other';
  lemma?: string;
  pos?: Pos | 'particle';
  meaning?: string;
  vocabId?: string;
  stem?: string;
  particles?: { form: string; function: string }[];
  ending?: { formKey: string; pattern: string; th: string };
  roman: string;
  thai: string;
  confidence: Confidence;
  note?: string;
}

export interface SentenceMatch {
  ko: string;
  th: string;
  source: string;
}

export interface Analysis {
  input: string;
  tokens: TokenAnalysis[];
  coverage: number;
  confidence: Confidence;
  sentenceMatch?: SentenceMatch;
  gloss: string;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Particles (longest first). `cons`/`vowel` restrict to the allomorph's environment.
// ---------------------------------------------------------------------------
interface ParticleDef {
  form: string;
  fn: string;
  env?: 'cons' | 'vowel';
}

const PARTICLES: ParticleDef[] = [
  { form: '에서는', fn: 'ที่… (เน้นหัวข้อ)' },
  { form: '에게서', fn: 'จาก (บุคคล)' },
  { form: '한테서', fn: 'จาก (บุคคล)' },
  { form: '에서도', fn: 'ที่… ก็' },
  { form: '에게는', fn: 'สำหรับ… (หัวข้อ)' },
  { form: '에서', fn: 'ที่ (สถานที่ทำกิจกรรม) / จาก' },
  { form: '에게', fn: 'ให้ / ถึง (บุคคล)' },
  { form: '한테', fn: 'ให้ / ถึง (บุคคล ภาษาพูด)' },
  { form: '께서', fn: 'ประธาน (ยกย่อง)' },
  { form: '부터', fn: 'ตั้งแต่' },
  { form: '까지', fn: 'ถึง / จนถึง' },
  { form: '으로', fn: 'ไปทาง / ด้วย (วิธีการ)', env: 'cons' },
  { form: '하고', fn: 'กับ / และ' },
  { form: '이랑', fn: 'กับ / และ (ภาษาพูด)', env: 'cons' },
  { form: '보다', fn: 'กว่า' },
  { form: '처럼', fn: 'เหมือน' },
  { form: '마다', fn: 'ทุกๆ' },
  { form: '이나', fn: 'หรือ', env: 'cons' },
  { form: '이요', fn: '(สุภาพ) คำตอบสั้น', env: 'cons' },
  { form: '께', fn: 'ให้ (ยกย่อง)' },
  { form: '로', fn: 'ไปทาง / ด้วย (วิธีการ)', env: 'vowel' },
  { form: '랑', fn: 'กับ / และ (ภาษาพูด)', env: 'vowel' },
  { form: '나', fn: 'หรือ', env: 'vowel' },
  { form: '은', fn: 'หัวข้อ / เปรียบเทียบ', env: 'cons' },
  { form: '는', fn: 'หัวข้อ / เปรียบเทียบ', env: 'vowel' },
  { form: '이', fn: 'ประธาน', env: 'cons' },
  { form: '가', fn: 'ประธาน', env: 'vowel' },
  { form: '을', fn: 'กรรม', env: 'cons' },
  { form: '를', fn: 'กรรม', env: 'vowel' },
  { form: '의', fn: 'ของ' },
  { form: '와', fn: 'และ / กับ', env: 'vowel' },
  { form: '과', fn: 'และ / กับ', env: 'cons' },
  { form: '도', fn: 'ด้วย / ก็' },
  { form: '만', fn: 'เท่านั้น / แค่' },
  { form: '에', fn: 'ที่ / ไปยัง / ตอน (เวลา)' },
  { form: '요', fn: '(สุภาพ)' },
];

const CONTRACTED: Record<string, { lemma: string; particle: string; fn: string }> = {
  제가: { lemma: '저', particle: '가', fn: 'ประธาน' },
  내가: { lemma: '나', particle: '가', fn: 'ประธาน' },
  누가: { lemma: '누구', particle: '가', fn: 'ประธาน' },
  제: { lemma: '저', particle: '의', fn: 'ของ (저의 → 제)' },
  내: { lemma: '나', particle: '의', fn: 'ของ (나의 → 내)' },
};

// ---------------------------------------------------------------------------
// Lazy indexes
// ---------------------------------------------------------------------------
interface FormHit {
  entry: VocabEntry;
  formKey: string;
  pattern: string;
  th: string;
}

let indexes: {
  byKo: Map<string, VocabEntry[]>;
  forms: Map<string, FormHit[]>;
  phrases: Map<string, FormHit[]>;
  maxPhraseWords: number;
  bank: Map<string, SentenceMatch>;
  thBank: { ko: string; th: string; source: string; norm: string }[];
} | null = null;

const strip = (s: string) => s.replace(/[.,!?~…"'“”‘’()[\]{}:;]/g, '');
const normKo = (s: string) => strip(s).replace(/\s+/g, '');
const normTh = (s: string) => s.replace(/[\s.,!?~"'“”‘’()]/g, '');

function buildIndexes() {
  const byKo = new Map<string, VocabEntry[]>();
  for (const v of VOCABULARY) byKo.set(v.ko, [...(byKo.get(v.ko) ?? []), v]);

  const forms = new Map<string, FormHit[]>();
  const phrases = new Map<string, FormHit[]>();
  let maxPhraseWords = 1;
  for (const v of uniquePredicates()) {
    const r = conjugate(v.ko, { pos: v.pos === 'adjective' ? 'adjective' : 'verb', irregular: v.irr });
    for (const f of r.forms) {
      // Skip suppletive forms (알다 → 몰라요) — they belong to another dictionary word.
      if (!f.value || (f.group === 'negative' && f.note)) continue;
      const surface = strip(f.value);
      const hit = { entry: v, formKey: f.key, pattern: f.pattern, th: f.th };
      if (surface.includes(' ')) {
        maxPhraseWords = Math.max(maxPhraseWords, surface.split(' ').length);
        phrases.set(surface, [...(phrases.get(surface) ?? []), hit]);
      } else {
        forms.set(surface, [...(forms.get(surface) ?? []), hit]);
      }
    }
  }

  const bank = new Map<string, SentenceMatch>();
  const thBank: { ko: string; th: string; source: string; norm: string }[] = [];
  const add = (ko: string, th: string, source: string) => {
    const k = normKo(ko);
    if (!k || bank.has(k)) return;
    bank.set(k, { ko, th, source });
    thBank.push({ ko, th, source, norm: normTh(th) });
  };
  for (const v of VOCABULARY) add(v.ex, v.exTh, `คำศัพท์: ${v.ko}`);
  for (const g of GRAMMAR) for (const e of g.examples) add(e.ko, e.th, `ไวยากรณ์: ${g.pattern}`);
  for (const d of DIALOGUES) for (const l of d.lines) add(l.ko, l.th, `บทสนทนา: ${d.title}`);
  for (const p of POS_LESSONS) for (const e of p.examples) add(e.ko, e.th.replace(/\s*\(.*\)$/, ''), 'ประเภทของคำ');
  for (const s of STRUCTURE_LESSONS) for (const e of s.examples) add(e.ko, e.th, 'โครงสร้างประโยค');
  for (const v of VOCABULARY) if (v.pos === 'expression' || v.pos === 'interjection') add(v.ko, v.th, 'คำศัพท์');

  indexes = { byKo, forms, phrases, maxPhraseWords, bank, thBank };
  return indexes;
}

function idx() {
  return indexes ?? buildIndexes();
}

// ---------------------------------------------------------------------------
// Token analysis
// ---------------------------------------------------------------------------
function readings(s: string) {
  return { roman: romanize(s), thai: thaiReading(s) };
}

function preferEntry(list: VocabEntry[]): VocabEntry {
  return [...list].sort((a, b) => ['A1', 'A2', 'B1', 'B2'].indexOf(a.level) - ['A1', 'A2', 'B1', 'B2'].indexOf(b.level))[0];
}

function nounLike(e: VocabEntry) {
  return ['noun', 'pronoun', 'numeral'].includes(e.pos);
}

function lookupNoun(word: string): VocabEntry | undefined {
  const list = idx().byKo.get(word)?.filter(nounLike);
  return list?.length ? preferEntry(list) : undefined;
}

function particleFits(noun: string, p: ParticleDef): boolean {
  if (!p.env) return true;
  const fin = finalOf(noun);
  if (p.form === '으로') return fin !== '' && fin !== 'ㄹ';
  if (p.form === '로') return fin === '' || fin === 'ㄹ';
  return p.env === 'cons' ? fin !== '' : fin === '';
}

/** Split trailing particles (up to two stacked, e.g. 학교에서도). */
function splitParticles(word: string): { base: string; particles: ParticleDef[] } | null {
  for (const p1 of PARTICLES) {
    if (!word.endsWith(p1.form) || word.length <= p1.form.length) continue;
    const rest = word.slice(0, -p1.form.length);
    if (lookupNoun(rest) && particleFits(rest, p1)) return { base: rest, particles: [p1] };
    for (const p2 of PARTICLES) {
      if (!rest.endsWith(p2.form) || rest.length <= p2.form.length) continue;
      const base = rest.slice(0, -p2.form.length);
      if (lookupNoun(base) && particleFits(base, p2)) return { base, particles: [p2, p1] };
    }
  }
  return null;
}

function analyzeWord(raw: string): TokenAnalysis {
  const word = strip(raw);
  const r = readings(word);
  if (!word || !isHangulText(word)) return { surface: raw, kind: 'other', ...r, confidence: 'high' };

  const { byKo, forms } = idx();

  const exact = byKo.get(word);
  if (exact?.length && !exact.every((e) => e.pos === 'verb' || e.pos === 'adjective')) {
    const e = preferEntry(exact.filter((x) => x.pos !== 'verb' && x.pos !== 'adjective'));
    return { surface: raw, kind: 'word', lemma: e.ko, pos: e.pos, meaning: e.th, vocabId: e.id, ...r, confidence: 'high' };
  }

  const c = CONTRACTED[word];
  if (c) {
    const e = lookupNoun(c.lemma);
    return { surface: raw, kind: 'word', lemma: c.lemma, pos: 'pronoun', meaning: e?.th, vocabId: e?.id, particles: [{ form: c.particle, function: c.fn }], ...r, confidence: 'high' };
  }

  const fh = forms.get(word);
  if (fh?.length) {
    const h = fh[0];
    const ambiguous = new Set(fh.map((x) => x.entry.ko)).size > 1;
    return {
      surface: raw,
      kind: 'word',
      lemma: h.entry.ko,
      pos: h.entry.pos,
      meaning: h.entry.th,
      vocabId: h.entry.id,
      stem: h.entry.ko.slice(0, -1),
      ending: { formKey: h.formKey, pattern: h.pattern, th: h.th },
      ...r,
      confidence: ambiguous ? 'medium' : 'high',
      note: ambiguous ? `อาจมาจาก: ${[...new Set(fh.map((x) => x.entry.ko))].join(', ')}` : fh.length > 1 ? `รูปนี้ตรงกับหลายรูปแบบ: ${[...new Set(fh.map((x) => x.pattern))].join(' / ')}` : undefined,
    };
  }

  // noun + copula (학생이에요, 의사예요 …)
  for (let cut = word.length - 1; cut >= 1; cut--) {
    const noun = word.slice(0, cut);
    const e = lookupNoun(noun);
    if (!e) continue;
    const nf = conjugateNoun(noun).find((f) => strip(f.value) === word);
    if (nf) {
      return { surface: raw, kind: 'word', lemma: noun, pos: e.pos, meaning: e.th, vocabId: e.id, ending: { formKey: nf.key, pattern: nf.pattern, th: nf.th }, ...r, confidence: 'high' };
    }
  }

  const sp = splitParticles(word);
  if (sp) {
    const e = lookupNoun(sp.base)!;
    const ambiguousParticle = sp.particles.some((p) => ['이', '나', '요'].includes(p.form));
    return {
      surface: raw,
      kind: 'word',
      lemma: sp.base,
      pos: e.pos,
      meaning: e.th,
      vocabId: e.id,
      particles: sp.particles.map((p) => ({ form: p.form, function: p.fn })),
      ...r,
      confidence: ambiguousParticle ? 'medium' : 'high',
    };
  }

  if (exact?.length) {
    const e = preferEntry(exact);
    return { surface: raw, kind: 'word', lemma: e.ko, pos: e.pos, meaning: e.th, vocabId: e.id, stem: e.ko.slice(0, -1), ...r, confidence: 'high', note: 'รูปพจนานุกรม' };
  }

  return { surface: raw, kind: 'unknown', ...r, confidence: 'low', note: 'ไม่พบในคลังคำศัพท์ของ HANEUL' };
}

export function analyze(input: string): Analysis {
  const { phrases, maxPhraseWords, bank, byKo } = idx();
  const text = input.trim();
  const warnings: string[] = [];
  const sentenceMatch = bank.get(normKo(text));

  const words = text.split(/\s+/).filter(Boolean);
  const tokens: TokenAnalysis[] = [];
  for (let i = 0; i < words.length; ) {
    let matched = false;
    for (let len = Math.min(maxPhraseWords + 1, words.length - i); len >= 2 && !matched; len--) {
      const span = words.slice(i, i + len).join(' ');
      const s = strip(span);
      const ph = phrases.get(s);
      const ex = byKo.get(s);
      if (ph?.length) {
        const h = ph[0];
        tokens.push({ surface: span, kind: 'phrase', lemma: h.entry.ko, pos: h.entry.pos, meaning: h.entry.th, vocabId: h.entry.id, stem: h.entry.ko.slice(0, -1), ending: { formKey: h.formKey, pattern: h.pattern, th: h.th }, ...readings(s), confidence: 'high' });
        i += len;
        matched = true;
      } else if (ex?.length) {
        const e = preferEntry(ex);
        tokens.push({ surface: span, kind: 'phrase', lemma: e.ko, pos: e.pos, meaning: e.th, vocabId: e.id, ...readings(s), confidence: 'high' });
        i += len;
        matched = true;
      }
    }
    if (!matched) {
      tokens.push(analyzeWord(words[i]));
      i++;
    }
  }

  const content = tokens.filter((t) => t.kind !== 'other');
  const known = content.filter((t) => t.kind !== 'unknown');
  const coverage = content.length ? known.length / content.length : 0;
  const unknown = content.filter((t) => t.kind === 'unknown').map((t) => t.surface);
  if (unknown.length) warnings.push(`ไม่รู้จักคำ: ${unknown.join(', ')} — ผลวิเคราะห์ไม่ครบ`);
  if (content.some((t) => t.confidence === 'medium')) warnings.push('บางคำมีได้หลายความหมาย/หลายรูป โปรดดูหมายเหตุของแต่ละคำ');
  if (!sentenceMatch && content.length > 1) warnings.push('ไม่พบประโยคนี้ในคลังประโยคที่ตรวจสอบแล้ว — แสดงเฉพาะความหมายแยกคำ ไม่ใช่คำแปลทั้งประโยค');

  const gloss = tokens
    .map((t) => {
      if (t.kind === 'other') return t.surface;
      if (t.kind === 'unknown') return `[${t.surface}?]`;
      const parts = [t.meaning?.split(' / ')[0]];
      if (t.particles?.length) parts.push(`(${t.particles.map((p) => p.function.split(' / ')[0]).join(', ')})`);
      if (t.ending) parts.push(`[${t.ending.th}]`);
      return parts.filter(Boolean).join(' ');
    })
    .join(' · ');

  const confidence: Confidence = sentenceMatch ? 'high' : coverage === 1 && !content.some((t) => t.confidence !== 'high') ? 'medium' : 'low';
  return { input: text, tokens, coverage, confidence, sentenceMatch, gloss, warnings };
}

// ---------------------------------------------------------------------------
// Thai → Korean (bank + dictionary search)
// ---------------------------------------------------------------------------
export interface ThaiResult {
  sentences: (SentenceMatch & { exact: boolean })[];
  words: VocabEntry[];
}

export function searchThai(query: string, limit = 12): ThaiResult {
  const { thBank } = idx();
  const q = normTh(query);
  if (!q) return { sentences: [], words: [] };
  const exact = thBank.filter((b) => b.norm === q).map((b) => ({ ko: b.ko, th: b.th, source: b.source, exact: true }));
  const partial = q.length >= 2 ? thBank.filter((b) => b.norm !== q && b.norm.includes(q)).slice(0, limit).map((b) => ({ ko: b.ko, th: b.th, source: b.source, exact: false })) : [];
  const words = VOCABULARY.filter((v) => v.th.split(/\s*\/\s*|\s*\(|\)/).some((m) => m && normTh(m) === q)).concat(
    VOCABULARY.filter((v) => q.length >= 2 && normTh(v.th).includes(q) && !v.th.split(/\s*\/\s*/).some((m) => normTh(m) === q)),
  );
  const seen = new Set<string>();
  return {
    sentences: [...exact, ...partial].slice(0, limit),
    words: words.filter((w) => (seen.has(w.ko) ? false : (seen.add(w.ko), true))).slice(0, limit),
  };
}

/** Exposed for tests / warm-up. */
export function warmUpAnalyzer() {
  idx();
}
