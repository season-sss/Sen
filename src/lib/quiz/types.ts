import type { Level } from '@/data/types';

export type Section = 'vocabulary' | 'grammar' | 'reading' | 'listening' | 'writing' | 'conjugation' | 'hangul' | 'ordering';

interface Base {
  id: string;
  section: Section;
  level: Level;
  /** Instruction / question stem */
  prompt: string;
  promptTh?: string;
  /** Optional reading passage shown above the question */
  passage?: string;
  /** Text spoken by TTS for listening questions (hidden until revealed) */
  audio?: string;
  explain?: string;
  /** Source link for review, e.g. grammar id or vocab id */
  ref?: { type: 'grammar' | 'vocab' | 'lesson'; id: string };
  tags?: string[];
}

export interface McqQuestion extends Base {
  kind: 'mcq';
  options: string[];
  answer: number;
}

export interface TextQuestion extends Base {
  kind: 'text';
  answers: string[];
  /** Hint shown under the input, e.g. "รูปปัจจุบันสุภาพ" */
  hint?: string;
}

export interface OrderQuestion extends Base {
  kind: 'order';
  tokens: string[];
}

export interface WritingQuestion extends Base {
  kind: 'writing';
  task: '51' | '52' | '53' | '54' | 'free';
  minChars?: number;
  maxChars?: number;
  /** Expressions/keywords a good answer should contain (any form) */
  keywords?: string[];
  modelAnswer: string;
  /** Require 한다체 (plain written style) */
  requirePlain?: boolean;
}

export type Question = McqQuestion | TextQuestion | OrderQuestion | WritingQuestion;

export interface AnswerRecord {
  questionId: string;
  correct: boolean;
  /** For writing tasks: 0..1 self/auto score */
  score?: number;
  given: string;
  section: Section;
  level: Level;
  ref?: Question['ref'];
  tags?: string[];
}
