import type { Question, WritingQuestion } from './types';

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[.!?。,，"'“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface GradeResult {
  correct: boolean;
  expected: string;
  /** e.g. "ถูก แต่เว้นวรรคต่างจากรูปมาตรฐาน" */
  note?: string;
}

export function gradeText(answers: string[], given: string): GradeResult {
  const g = normalizeAnswer(given);
  for (const a of answers) {
    const n = normalizeAnswer(a);
    if (g === n) return { correct: true, expected: a };
  }
  for (const a of answers) {
    if (g.replace(/ /g, '') === normalizeAnswer(a).replace(/ /g, '')) {
      return { correct: true, expected: a, note: 'ถูกต้อง แต่การเว้นวรรคต่างจากรูปมาตรฐาน' };
    }
  }
  return { correct: false, expected: answers[0] };
}

export function grade(q: Question, given: string | number | string[]): GradeResult {
  switch (q.kind) {
    case 'mcq': {
      const idx = typeof given === 'number' ? given : q.options.indexOf(String(given));
      return { correct: idx === q.answer, expected: q.options[q.answer] };
    }
    case 'text':
      return gradeText(q.answers, String(given));
    case 'order': {
      const arr = Array.isArray(given) ? given : String(given).split(' ');
      const expected = q.tokens.join(' ');
      return { correct: normalizeAnswer(arr.join(' ')) === normalizeAnswer(expected), expected };
    }
    case 'writing':
      // Writing is never auto-marked as "correct" — see checkWriting for rule-based feedback.
      return { correct: false, expected: q.modelAnswer };
  }
}

// ---------------------------------------------------------------------------
// Writing: rule-based checks (NOT AI grading). Gives objective feedback the learner can act on.
// ---------------------------------------------------------------------------
export interface WritingCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface WritingFeedback {
  charCount: number;
  checks: WritingCheck[];
  /** Fraction of automatic checks passed (0..1). Not an exam score. */
  autoScore: number;
}

/** Count characters the way TOPIK manuscript paper does: every character incl. spaces, excluding line breaks. */
export function countChars(text: string): number {
  return text.replace(/\r?\n/g, '').length;
}

const POLITE_ENDING = /(요|니다|니까)[.?!]?$/;

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkWriting(q: WritingQuestion, text: string): WritingFeedback {
  const checks: WritingCheck[] = [];
  const n = countChars(text.trim());

  if (q.minChars || q.maxChars) {
    const okMin = !q.minChars || n >= q.minChars;
    const okMax = !q.maxChars || n <= q.maxChars;
    checks.push({
      id: 'length',
      label: 'ความยาว',
      passed: okMin && okMax,
      detail: `${n} ตัวอักษร (กำหนด ${q.minChars ?? 0}–${q.maxChars ?? '∞'})`,
    });
  }

  const sentences = splitSentences(text);
  if (q.requirePlain) {
    const polite = sentences.filter((s) => POLITE_ENDING.test(s));
    checks.push({
      id: 'register',
      label: 'ใช้ 한다체 สม่ำเสมอ',
      passed: polite.length === 0 && sentences.length > 0,
      detail: polite.length ? `พบประโยคที่ลงท้ายแบบสุภาพ ${polite.length} ประโยค เช่น "${polite[0].slice(-12)}"` : 'ไม่พบการลงท้ายแบบ -요/-니다',
    });
  }

  if (q.keywords?.length) {
    const plainKeywords = q.keywords.filter((k) => !k.startsWith('-'));
    const hits = plainKeywords.filter((k) => text.includes(k));
    const need = Math.min(2, plainKeywords.length);
    checks.push({
      id: 'keywords',
      label: 'ใช้สำนวน/คำสำคัญที่แนะนำ',
      passed: hits.length >= need,
      detail: hits.length ? `พบ: ${hits.join(', ')}` : `ลองใช้: ${plainKeywords.slice(0, 4).join(', ')}`,
    });
  }

  if (q.task === '54' || q.task === '53' || q.task === 'free') {
    const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => p.trim().length > 0).length;
    if (q.task === '54') {
      checks.push({
        id: 'structure',
        label: 'โครงสร้าง (บทนำ–เนื้อหา–สรุป)',
        passed: paragraphs >= 3,
        detail: `${paragraphs} ย่อหน้า (แนะนำอย่างน้อย 3)`,
      });
    }
    checks.push({
      id: 'sentences',
      label: 'จำนวนประโยค',
      passed: sentences.length >= (q.task === 'free' ? 3 : 4),
      detail: `${sentences.length} ประโยค`,
    });
  }

  const hangulRatio = text.length ? (text.match(/[가-힣]/g)?.length ?? 0) / text.replace(/\s/g, '').length : 0;
  checks.push({
    id: 'korean',
    label: 'เขียนเป็นภาษาเกาหลี',
    passed: hangulRatio > 0.6,
    detail: `${Math.round(hangulRatio * 100)}% เป็นตัวอักษรฮันกึล`,
  });

  const passed = checks.filter((c) => c.passed).length;
  return { charCount: n, checks, autoScore: checks.length ? passed / checks.length : 0 };
}

/** Self-assessment rubric modelled on the TOPIK II writing criteria (content, organisation, language use). */
export const WRITING_RUBRIC = [
  { id: 'content', label: 'เนื้อหาและการทำตามโจทย์', desc: 'ตอบครบทุกประเด็นที่โจทย์ถาม เนื้อหาเกี่ยวข้องและสมเหตุสมผล', max: 3 },
  { id: 'organization', label: 'การเรียบเรียง', desc: 'มีบทนำ เนื้อหา สรุป ใช้คำเชื่อมเชื่อมประโยคและย่อหน้าอย่างเหมาะสม', max: 3 },
  { id: 'language', label: 'การใช้ภาษา', desc: 'ไวยากรณ์และคำศัพท์หลากหลาย ถูกต้อง เหมาะกับระดับ และใช้ 한다체 สม่ำเสมอ', max: 4 },
] as const;
