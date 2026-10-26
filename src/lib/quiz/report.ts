import type { AnswerRecord, Section } from './types';

export const SECTION_LABEL: Record<Section, string> = {
  vocabulary: 'คำศัพท์',
  grammar: 'ไวยากรณ์',
  reading: 'การอ่าน',
  listening: 'การฟัง',
  writing: 'การเขียน',
  conjugation: 'การผันคำ',
  hangul: 'ฮันกึล',
  ordering: 'การเรียงประโยค',
};

export interface SectionStat {
  section: Section;
  total: number;
  correct: number;
  ratio: number;
}

export interface QuizReport {
  total: number;
  correct: number;
  ratio: number;
  bySection: SectionStat[];
  strengths: SectionStat[];
  weaknesses: SectionStat[];
  /** Grammar/vocab refs answered wrongly — fed into review & flashcards */
  missedRefs: NonNullable<AnswerRecord['ref']>[];
}

export function buildReport(records: AnswerRecord[]): QuizReport {
  const map = new Map<Section, SectionStat>();
  for (const r of records) {
    const s = map.get(r.section) ?? { section: r.section, total: 0, correct: 0, ratio: 0 };
    s.total++;
    if (r.correct) s.correct++;
    map.set(r.section, s);
  }
  const bySection = [...map.values()].map((s) => ({ ...s, ratio: s.total ? s.correct / s.total : 0 })).sort((a, b) => b.ratio - a.ratio);
  const correct = records.filter((r) => r.correct).length;
  const seen = new Set<string>();
  const missedRefs = records
    .filter((r) => !r.correct && r.ref)
    .map((r) => r.ref!)
    .filter((ref) => {
      const k = `${ref.type}:${ref.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return {
    total: records.length,
    correct,
    ratio: records.length ? correct / records.length : 0,
    bySection,
    strengths: bySection.filter((s) => s.total >= 2 && s.ratio >= 0.8),
    weaknesses: bySection.filter((s) => s.ratio < 0.6),
    missedRefs,
  };
}

export const PASS_RATIO = 0.7;
