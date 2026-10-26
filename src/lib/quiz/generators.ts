/**
 * Question generators: turn curriculum content into gradeable questions.
 * All answers come from reviewed data or the conjugation/pronunciation engines — never invented.
 */
import { BASIC_CONSONANTS, BASIC_VOWELS, BATCHIM_GROUPS, COMPLEX_BATCHIM, COMPOUND_VOWELS, DECODING_WORDS, DOUBLE_CONSONANTS, SOUND_RULE_PRACTICE, type JamoInfo } from '@/data/hangul';
import type { GrammarPoint, Level, VocabEntry } from '@/data/types';
import { POS_INFO } from '@/data/types';
import { VOCABULARY, uniquePredicates } from '@/data/vocabulary';
import { GRAMMAR_BY_ID } from '@/data/grammar';
import { DIALOGUES } from '@/data/dialogues';
import { READINGS } from '@/data/readings';
import { POS_LESSONS, STRUCTURE_LESSONS } from '@/data/foundations';
import { WRITING_BY_ID } from '@/data/writing';
import { LESSON_INDEX, lessonsOfLevel, lessonsOfUnit, type Lesson } from '@/data/curriculum';
import { conjugate, FORM_BY_KEY } from '@/lib/conjugation';
import { attachParticle, finalOf, hasBatchim, PARTICLES, pronounce, type ParticleKey } from '@/lib/hangul';
import { createRng, sample, shuffle, type Rng } from '@/lib/util/random';
import type { McqQuestion, OrderQuestion, Question, TextQuestion } from './types';

const uniq = <T,>(a: T[]) => [...new Set(a)];

function mcqFrom(correct: string, distractorPool: string[], rng: Rng, n = 3): { options: string[]; answer: number } {
  const ds = sample(uniq(distractorPool.filter((d) => d !== correct)), n, rng);
  const options = shuffle([correct, ...ds], rng);
  return { options, answer: options.indexOf(correct) };
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
export type VocabDirection = 'ko-th' | 'th-ko' | 'listen' | 'spell' | 'sentence';

export function vocabQuestion(entry: VocabEntry, direction: VocabDirection, rng: Rng, pool: VocabEntry[] = VOCABULARY): Question {
  const similar = pool.filter((v) => v.id !== entry.id && v.pos === entry.pos && v.ko !== entry.ko);
  const base = { id: `v-${direction}-${entry.id}`, section: 'vocabulary' as const, level: entry.level as Level, ref: { type: 'vocab' as const, id: entry.id } };
  switch (direction) {
    case 'ko-th': {
      const { options, answer } = mcqFrom(entry.th, (similar.length >= 3 ? similar : pool).map((v) => v.th), rng);
      return { ...base, kind: 'mcq', prompt: entry.ko, promptTh: 'เลือกความหมายที่ถูกต้อง', options, answer, explain: `${entry.ko} = ${entry.th}\n${entry.ex} — ${entry.exTh}` };
    }
    case 'th-ko': {
      const { options, answer } = mcqFrom(entry.ko, (similar.length >= 3 ? similar : pool).map((v) => v.ko), rng);
      return { ...base, kind: 'mcq', prompt: entry.th, promptTh: 'เลือกคำภาษาเกาหลีที่ตรงกับความหมาย', options, answer, explain: `${entry.th} = ${entry.ko}` };
    }
    case 'listen': {
      const { options, answer } = mcqFrom(entry.th, (similar.length >= 3 ? similar : pool).map((v) => v.th), rng);
      return { ...base, section: 'listening', kind: 'mcq', prompt: 'ฟังแล้วเลือกความหมาย', audio: entry.ko, options, answer, explain: `${entry.ko} = ${entry.th}` };
    }
    case 'spell':
      return { ...base, kind: 'text', prompt: entry.th, promptTh: 'พิมพ์คำภาษาเกาหลี', answers: [entry.ko], hint: `${entry.ko.length} พยางค์` };
    case 'sentence': {
      const tokens = entry.ex.split(' ');
      return { ...base, section: 'ordering', kind: 'order', prompt: entry.exTh, promptTh: 'เรียงคำให้เป็นประโยค', tokens, explain: entry.ex };
    }
  }
}

export function vocabQuiz(entries: VocabEntry[], rng: Rng, count = 10): Question[] {
  const picked = sample(entries, Math.min(count, entries.length), rng);
  const dirs: VocabDirection[] = ['ko-th', 'th-ko', 'ko-th', 'listen', 'spell'];
  return picked.map((e, i) => {
    let d = dirs[i % dirs.length];
    if (d === 'sentence' && e.ex.split(' ').length < 2) d = 'ko-th';
    return vocabQuestion(e, d, rng);
  });
}

// ---------------------------------------------------------------------------
// Grammar
// ---------------------------------------------------------------------------
export function grammarExerciseQuestions(g: GrammarPoint): Question[] {
  return g.exercises.map((ex, i): Question => {
    const base = { id: `g-${g.id}-${i}`, section: 'grammar' as const, level: g.level as Level, ref: { type: 'grammar' as const, id: g.id } };
    switch (ex.type) {
      case 'choice':
        return { ...base, kind: 'mcq', prompt: ex.prompt, promptTh: ex.promptTh, options: ex.options, answer: ex.answer, explain: ex.explain };
      case 'fill':
        return { ...base, kind: 'text', prompt: ex.prompt, promptTh: ex.promptTh, answers: ex.answers, explain: ex.explain };
      case 'order':
        return { ...base, section: 'ordering', kind: 'order', prompt: ex.th, promptTh: 'เรียงคำให้เป็นประโยค', tokens: ex.tokens, explain: ex.explain };
    }
  });
}

/** Unlimited practice: conjugate real vocabulary with the form a grammar point teaches. */
export function conjugationQuestions(words: { ko: string; pos: 'verb' | 'adjective'; irr?: VocabEntry['irr']; th?: string }[], formKeys: string[], rng: Rng, count = 6): TextQuestion[] {
  const out: TextQuestion[] = [];
  const pairs = shuffle(words.flatMap((w) => formKeys.map((k) => ({ w, k }))), rng);
  for (const { w, k } of pairs) {
    if (out.length >= count) break;
    const r = conjugate(w.ko, { pos: w.pos, irregular: w.irr });
    if (r.confidence !== 'verified') continue;
    const f = r.forms.find((x) => x.key === k);
    if (!f?.value) continue;
    out.push({
      id: `c-${w.ko}-${k}`,
      section: 'conjugation',
      level: f.level === 'ADV' ? 'ADV' : (f.level as Level),
      kind: 'text',
      prompt: `${w.ko} → ${f.pattern}`,
      promptTh: `${w.th ? w.th + ' · ' : ''}${f.th}`,
      answers: [f.value],
      hint: f.pattern,
      explain: f.steps.join('\n'),
    });
  }
  return out;
}

function predicatesFor(level?: Level) {
  const order: Level[] = ['A1', 'A2', 'B1', 'B2'];
  const allowed = level && order.includes(level) ? order.slice(0, order.indexOf(level) + 1) : order;
  return uniquePredicates()
    .filter((v) => allowed.includes(v.level))
    .map((v) => ({ ko: v.ko, pos: (v.pos === 'adjective' ? 'adjective' : 'verb') as 'verb' | 'adjective', irr: v.irr, th: v.th }));
}

export function grammarQuiz(g: GrammarPoint, rng: Rng): Question[] {
  const qs = grammarExerciseQuestions(g);
  const form = g.formKey ? FORM_BY_KEY[g.formKey] : undefined;
  if (g.formKey) {
    const words = predicatesFor(g.level).filter((w) => !form || form.appliesTo === 'both' || form.appliesTo === w.pos);
    qs.push(...conjugationQuestions(sample(words, 12, rng), [g.formKey], rng, 3));
  }
  if (g.category === 'particle') qs.push(...particleQuestions(rng, 3));
  return qs;
}

const PARTICLE_KEYS: ParticleKey[] = ['topic', 'subject', 'object', 'and', 'direction'];
export function particleQuestions(rng: Rng, count = 5): McqQuestion[] {
  const nouns = sample(VOCABULARY.filter((v) => v.pos === 'noun' && v.level === 'A1' && !v.ko.includes(' ')), count, rng);
  return nouns.map((n, i) => {
    const key = PARTICLE_KEYS[i % PARTICLE_KEYS.length];
    const p = PARTICLES[key];
    const correct = attachParticle(n.ko, key);
    const wrong = key === 'direction' ? n.ko + (correct.endsWith('으로') ? '로' : '으로') : n.ko + (correct.endsWith(p.afterConsonant) ? p.afterVowel : p.afterConsonant);
    const options = shuffle([correct, wrong], rng);
    return {
      id: `p-${n.id}-${key}`,
      kind: 'mcq',
      section: 'grammar',
      level: 'A1',
      prompt: `${n.ko} + ${p.label}`,
      promptTh: `${n.th} — ${p.thai}`,
      options,
      answer: options.indexOf(correct),
      explain:
        key === 'direction' && finalOf(n.ko) === 'ㄹ'
          ? `${n.ko} ลงท้ายด้วยตัวสะกด ㄹ จึงใช้ 로 → ${correct}`
          : `${n.ko} ${hasBatchim(n.ko) ? 'มีตัวสะกด' : 'ไม่มีตัวสะกด'} → ${correct}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Hangul
// ---------------------------------------------------------------------------
export const JAMO_SETS: Record<string, JamoInfo[]> = {
  'basic-consonants-1': BASIC_CONSONANTS.slice(0, 7),
  'basic-consonants-2': BASIC_CONSONANTS.slice(7),
  'double-consonants': DOUBLE_CONSONANTS,
  'basic-vowels': BASIC_VOWELS,
  'compound-vowels-1': COMPOUND_VOWELS.slice(0, 4),
  'compound-vowels-2': COMPOUND_VOWELS.slice(4),
};
const ALL_JAMO = [...BASIC_CONSONANTS, ...DOUBLE_CONSONANTS, ...BASIC_VOWELS, ...COMPOUND_VOWELS];

export function jamoQuestions(set: JamoInfo[], rng: Rng): Question[] {
  const qs: Question[] = [];
  for (const j of set) {
    const pool = ALL_JAMO.filter((x) => x.char !== j.char);
    const a = mcqFrom(j.roman, pool.map((x) => x.roman), rng);
    qs.push({ id: `h-roman-${j.char}`, kind: 'mcq', section: 'hangul', level: 'L0', prompt: j.char, promptTh: 'ตัวอักษรนี้ออกเสียงอย่างไร', ...a, explain: `${j.char} (${j.name}) = ${j.roman} ≈ ${j.thai}` });
    const b = mcqFrom(j.char, set.filter((x) => x.char !== j.char).map((x) => x.char).concat(pool.map((x) => x.char)), rng);
    const word = j.examples[0]?.word;
    if (word) qs.push({ id: `h-listen-${j.char}`, kind: 'mcq', section: 'listening', level: 'L0', prompt: 'ฟังคำแล้วเลือกตัวอักษรที่ได้ยิน', audio: word, ...b, explain: `${word} (${j.examples[0].th}) มี ${j.char}` });
  }
  return shuffle(qs, rng);
}

export function syllableQuestions(rng: Rng): Question[] {
  const words = sample(VOCABULARY.filter((v) => v.level === 'A1' && /^[가-힣]{2,3}$/.test(v.ko)), 6, rng);
  return words.map((w) => ({ id: `h-spell-${w.id}`, kind: 'text', section: 'hangul', level: 'L0', prompt: 'ฟังแล้วพิมพ์คำที่ได้ยิน', audio: w.ko, answers: [w.ko], hint: `${w.th} · ${w.ko.length} พยางค์`, explain: w.ko }) as TextQuestion);
}

export function decodingQuestions(rng: Rng): Question[] {
  return sample(DECODING_WORDS, 6, rng).map((w) => {
    const a = mcqFrom(w.th, DECODING_WORDS.map((x) => x.th), rng);
    return { id: `h-decode-${w.word}`, kind: 'mcq', section: 'hangul', level: 'L0', prompt: w.word, promptTh: 'อ่านคำนี้แล้วเดาความหมาย (คำทับศัพท์)', ...a, explain: `${w.word} = ${w.th}` };
  });
}

export function batchimQuestions(set: 'simple' | 'complex', rng: Rng): Question[] {
  if (set === 'simple') {
    const items = BATCHIM_GROUPS.flatMap((g) => g.examples.map((e) => ({ word: e.word, sound: g.sound, th: e.th })));
    return sample(items, 8, rng).map((it) => {
      const a = mcqFrom(it.sound, BATCHIM_GROUPS.map((g) => g.sound), rng);
      return { id: `h-batchim-${it.word}`, kind: 'mcq', section: 'hangul', level: 'L0', prompt: it.word, promptTh: `${it.th} — ตัวสะกดออกเสียงอะไร`, ...a, explain: `${it.word} → [${pronounce(it.word).text}]` };
    });
  }
  return COMPLEX_BATCHIM.flatMap((c) =>
    c.examples.map((e) => {
      const correct = `[${pronounce(e.word).text}]`;
      const wrongs = uniq([`[${e.word}]`, `[${pronounce(e.word, { tensification: false }).text}]`].filter((x) => x !== correct));
      const options = shuffle([correct, ...wrongs], rng);
      return { id: `h-complex-${e.word}`, kind: 'mcq' as const, section: 'hangul' as const, level: 'L0' as Level, prompt: e.word, promptTh: `${e.th} — อ่านออกเสียงอย่างไร`, options, answer: options.indexOf(correct), explain: c.note };
    }),
  ).filter((q) => q.options.length >= 2);
}

export function soundRuleQuestions(rules: string[], rng: Rng): Question[] {
  const words = SOUND_RULE_PRACTICE.filter((p) => rules.includes(p.rule)).flatMap((p) => p.words);
  return shuffle(words, rng).map((w) => {
    const correct = `[${pronounce(w).text}]`;
    const distractors = uniq([`[${w}]`, `[${pronounce(w, { tensification: false }).text}]`]).filter((x) => x !== correct);
    const options = shuffle([correct, ...distractors], rng);
    return { id: `h-sound-${w}`, kind: 'mcq', section: 'hangul', level: 'L0', prompt: w, promptTh: 'คำนี้ออกเสียงอย่างไร', audio: w, options, answer: options.indexOf(correct), explain: `${w} → ${correct}` };
  });
}

// ---------------------------------------------------------------------------
// Foundations, dialogues, readings
// ---------------------------------------------------------------------------
export function posQuestions(ids: string[], rng: Rng): Question[] {
  return POS_LESSONS.filter((p) => ids.includes(p.id)).flatMap((p) =>
    p.quiz.map((qz, i) => {
      const options = shuffle(qz.options, rng);
      return { id: `pos-${p.id}-${i}`, kind: 'mcq' as const, section: 'grammar' as const, level: 'A1' as Level, prompt: `${qz.sentence}\n"${qz.word}" เป็นคำประเภทใด`, options, answer: options.indexOf(qz.answer), explain: `${qz.word} = ${qz.answer} (${Object.values(POS_INFO).find((x) => x.ko === qz.answer)?.th ?? ''})` };
    }),
  );
}

export function structureQuestions(ids: string[]): OrderQuestion[] {
  return STRUCTURE_LESSONS.filter((s) => ids.includes(s.id)).flatMap((s) =>
    s.build.map((b, i) => ({ id: `st-${s.id}-${i}`, kind: 'order' as const, section: 'ordering' as const, level: 'A1' as Level, prompt: b.th, promptTh: 'เรียงคำให้เป็นประโยค', tokens: b.tokens, explain: b.tokens.join(' ') })),
  );
}

export function dialogueQuestions(ids: string[]): Question[] {
  return DIALOGUES.filter((d) => ids.includes(d.id)).flatMap((d) => {
    const transcript = d.lines.map((l) => `${l.speaker}: ${l.ko}`).join('\n');
    return d.questions.map((qz, i) => ({ id: `d-${d.id}-${i}`, kind: 'mcq' as const, section: 'listening' as const, level: d.level as Level, prompt: qz.q, audio: transcript, options: qz.options, answer: qz.answer }));
  });
}

export function readingQuestions(ids: string[]): Question[] {
  return READINGS.filter((r) => ids.includes(r.id)).flatMap((r) =>
    r.questions.map((qz, i) => ({ id: `r-${r.id}-${i}`, kind: 'mcq' as const, section: 'reading' as const, level: r.level as Level, prompt: qz.q, passage: r.ko, options: qz.options, answer: qz.answer, explain: qz.explain })),
  );
}

// ---------------------------------------------------------------------------
// Lesson & assessment builders
// ---------------------------------------------------------------------------
export function lessonQuestions(lesson: Lesson, seed = 1): Question[] {
  const rng = createRng(seed);
  const s = lesson.source;
  switch (s.kind) {
    case 'hangul-jamo':
      return jamoQuestions(JAMO_SETS[s.set], rng);
    case 'hangul-syllable':
      return syllableQuestions(rng);
    case 'hangul-decoding':
      return decodingQuestions(rng);
    case 'hangul-batchim':
      return batchimQuestions(s.set, rng);
    case 'hangul-sound':
      return soundRuleQuestions(s.rules, rng);
    case 'hangul-typing':
      return syllableQuestions(rng);
    case 'hangul-reading-aid':
      return decodingQuestions(rng);
    case 'vocab': {
      const entries = VOCABULARY.filter((v) => s.topics.includes(v.topic) && v.level === s.level);
      return vocabQuiz(entries, rng, Math.min(10, entries.length));
    }
    case 'pos':
      return posQuestions(s.ids, rng);
    case 'structure':
      return structureQuestions(s.ids);
    case 'grammar':
      return s.ids.flatMap((id) => grammarQuiz(GRAMMAR_BY_ID[id], rng));
    case 'conjugation': {
      const known = new Map(uniquePredicates().map((v) => [v.ko, v]));
      const words = s.words.map((w) => {
        const v = known.get(w);
        return { ko: w, pos: (v?.pos === 'adjective' ? 'adjective' : 'verb') as 'verb' | 'adjective', irr: v?.irr, th: v?.th };
      });
      return conjugationQuestions(words, s.formKeys, rng, 8);
    }
    case 'dialogue':
      return dialogueQuestions(s.ids);
    case 'reading':
      return readingQuestions(s.ids);
    case 'writing':
      return s.questionIds.map((id) => WRITING_BY_ID[id]).filter(Boolean);
  }
}

/** Unit check: a sample from every lesson in the unit (writing excluded). */
export function unitAssessment(unitId: string, seed = 7): Question[] {
  const rng = createRng(seed);
  return lessonsOfUnit(unitId).flatMap((l) => sample(lessonQuestions(l, seed).filter((q) => q.kind !== 'writing'), 3, rng));
}

/** Level assessment covering every module, reported by section. */
export function levelAssessment(level: Level, seed = 11, perLesson = 1, max = 40): Question[] {
  const rng = createRng(seed);
  const qs = lessonsOfLevel(level).flatMap((l) => sample(lessonQuestions(l, seed).filter((q) => q.kind !== 'writing'), perLesson, rng));
  return shuffle(qs, rng).slice(0, max);
}

export function lessonLevel(lessonId: string): Level | undefined {
  return LESSON_INDEX[lessonId]?.level.id;
}
