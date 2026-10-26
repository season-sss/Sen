import type { RealExam, RealExamGroup, RealExamQuestion, RealSection } from '@/data/topik/real/types';
import type { AnswerRecord } from '@/lib/quiz/types';

export type ExamPart = 'full' | RealSection;

export const PART_LABEL: Record<ExamPart, string> = {
  full: 'ทั้งฉบับ (ฟัง + อ่าน)',
  listening: 'การฟัง 듣기',
  reading: 'การอ่าน 읽기',
};

export function groupById(exam: RealExam): Map<string, RealExamGroup> {
  return new Map(exam.groups.map((g) => [g.id, g]));
}

export function sectionOf(exam: RealExam, q: RealExamQuestion): RealSection {
  const g = exam.groups.find((x) => x.id === q.groupId);
  return g?.section ?? 'reading';
}

export function questionsFor(exam: RealExam, part: ExamPart, only?: number[]): RealExamQuestion[] {
  const pick = only ? new Set(only) : null;
  return exam.questions.filter((q) => (part === 'full' || sectionOf(exam, q) === part) && (!pick || pick.has(q.no)));
}

export function partMinutes(exam: RealExam, part: ExamPart): number {
  return part === 'full' ? exam.sections.listening.minutes + exam.sections.reading.minutes : exam.sections[part].minutes;
}

export interface SectionScore {
  section: RealSection;
  score: number;
  max: number;
  correct: number;
  total: number;
  answered: number;
}

export interface ExamScore {
  sections: SectionScore[];
  score: number;
  max: number;
  correct: number;
  total: number;
  /** Grade estimate — only for a complete paper (both sections, every question). */
  grade: string | null;
  wrong: number[];
}

/** Score a set of answers (question no → 0-based option) with the official points per question. */
export function scoreExam(exam: RealExam, questions: RealExamQuestion[], answers: Record<number, number>): ExamScore {
  const bySection = new Map<RealSection, SectionScore>();
  const wrong: number[] = [];
  for (const q of questions) {
    const section = sectionOf(exam, q);
    const s = bySection.get(section) ?? { section, score: 0, max: 0, correct: 0, total: 0, answered: 0 };
    const given = answers[q.no];
    s.max += q.points;
    s.total++;
    if (given !== undefined) s.answered++;
    if (given === q.answer) {
      s.correct++;
      s.score += q.points;
    } else wrong.push(q.no);
    bySection.set(section, s);
  }
  const sections = (['listening', 'reading'] as const).flatMap((k) => (bySection.has(k) ? [bySection.get(k)!] : []));
  const score = sections.reduce((a, s) => a + s.score, 0);
  const max = sections.reduce((a, s) => a + s.max, 0);
  const complete = questions.length === exam.questions.length;
  let grade: string | null = null;
  if (complete) {
    grade = 'ไม่ผ่านเกณฑ์';
    for (const g of exam.grades) if (score >= g.min) grade = g.grade;
  }
  return { sections, score, max, correct: sections.reduce((a, s) => a + s.correct, 0), total: questions.length, grade, wrong };
}

export function realQuestionId(exam: RealExam, no: number) {
  return `real:${exam.id}:${no}`;
}

/** AnswerRecords for the shared progress statistics (skill breakdown, activity). */
export function toRecords(exam: RealExam, questions: RealExamQuestion[], answers: Record<number, number>): AnswerRecord[] {
  return questions.map((q) => {
    const given = answers[q.no];
    return {
      questionId: realQuestionId(exam, q.no),
      correct: given === q.answer,
      given: given === undefined ? '' : String(given + 1),
      section: sectionOf(exam, q),
      level: exam.level === 'TOPIK I' ? 'A2' : 'B2',
      tags: ['topik-real', exam.id],
    };
  });
}

export const CIRCLED = ['①', '②', '③', '④'];

export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** Public asset path that works for both `/` and relative (`./`) builds. */
export function assetUrl(path: string) {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\//, '')}`;
}

export function driveEmbedUrl(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

export function driveViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}
