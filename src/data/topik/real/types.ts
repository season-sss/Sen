/**
 * Real past-paper TOPIK exams, transcribed from the PDF papers the site owner supplied.
 * Kept separate from the original HANEUL practice bank (topik1.ts / topik2.ts) so the UI can
 * label the source honestly and score them like the real test (points per question).
 */
export type RealSection = 'listening' | 'reading';

export interface RealExamImage {
  /** Path relative to the site root, e.g. `topik/96/q40.webp` (resolved with BASE_URL). */
  src: string;
  /** Full text alternative (the text printed in the figure, or a description of the picture). */
  alt: string;
}

export interface RealExamExample {
  lines: string[];
  options: string[];
  /** 0-based index of the example's answer */
  answer: number;
}

export interface RealExamGroup {
  id: string;
  section: RealSection;
  from: number;
  to: number;
  /** Instruction exactly as printed (Korean) */
  instruction: string;
  instructionTh: string;
  example?: RealExamExample;
  /** Shared passage for every question in the group (㉠ markers kept as printed) */
  passage?: string;
  image?: RealExamImage;
}

export interface RealExamQuestion {
  no: number;
  groupId: string;
  points: number;
  /** Per-question instruction, e.g. "㉠에 들어갈 말로 가장 알맞은 것을 고르십시오." */
  prompt?: string;
  /** Boxed text printed for this question only */
  stimulus?: string;
  image?: RealExamImage;
  options: string[];
  /** Pictures used as the four options (listening 15–16) */
  optionImages?: RealExamImage[];
  /** Thai translation of each option, shown in review */
  optionsTh: string[];
  /** 0-based index of the official answer */
  answer: number;
  /** Short Thai explanation shown in review */
  explainTh: string;
}

export interface RealExamAudio {
  /** Google Drive file id supplied by the site owner (played through Drive's embedded player) */
  driveFileId?: string;
  /** Optional self-hosted file path relative to the site root, used instead of Drive when present */
  src?: string;
}

export interface RealExam {
  id: string;
  round: number;
  level: 'TOPIK I' | 'TOPIK II';
  title: string;
  titleTh: string;
  /** Who publishes the paper — shown on every screen of the exam */
  source: string;
  sections: Record<RealSection, { minutes: number; maxScore: number }>;
  /** Pass marks for each grade (총점 기준) */
  grades: { grade: string; min: number }[];
  audio: RealExamAudio;
  groups: RealExamGroup[];
  questions: RealExamQuestion[];
}
