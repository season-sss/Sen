import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage, uid } from './persist';
import type { AnswerRecord } from '@/lib/quiz/types';
import type { GameId } from '@/lib/games';
import type { Level } from '@/data/types';

// ----------------------------------------------------------------- TOPIK attempts
export interface ExamAttempt {
  id: string;
  exam: 'TOPIK1' | 'TOPIK2' | 'TRACK3' | 'DRILL' | 'REAL';
  mode: string;
  /** Real past-paper attempts: exam id, part, official points and the answer sheet */
  real?: { examId: string; part: 'full' | 'listening' | 'reading'; score: number; max: number; answers: Record<number, number> };
  title: string;
  startedAt: number;
  finishedAt: number;
  timeLimitSec?: number;
  records: AnswerRecord[];
  correct: number;
  total: number;
}

export interface WritingSubmission {
  id: string;
  questionId: string;
  text: string;
  at: number;
  autoScore: number;
  selfScores: Record<string, number>;
}

interface ExamState {
  attempts: ExamAttempt[];
  writings: WritingSubmission[];
  addAttempt: (a: Omit<ExamAttempt, 'id'>) => string;
  saveWriting: (w: Omit<WritingSubmission, 'id' | 'at'>) => void;
}

export const useExams = create<ExamState>()(
  persist(
    (set) => ({
      attempts: [],
      writings: [],
      addAttempt: (a) => {
        const id = uid('exam');
        set((s) => ({ attempts: [...s.attempts, { ...a, id }].slice(-300) }));
        return id;
      },
      saveWriting: (w) => set((s) => ({ writings: [...s.writings, { ...w, id: uid('w'), at: Date.now() }].slice(-200) })),
    }),
    { name: 'haneul:exams', storage: jsonStorage, version: 1 },
  ),
);

// ----------------------------------------------------------------- Real exam draft (resume after reload)
export interface RealExamDraft {
  examId: string;
  part: 'full' | 'listening' | 'reading';
  mode: 'exam' | 'practice';
  only?: number[];
  startedAt: number;
  answers: Record<number, number>;
  flags: number[];
  index: number;
}

interface DraftState {
  draft: RealExamDraft | null;
  setDraft: (d: RealExamDraft | null) => void;
  patch: (p: Partial<RealExamDraft>) => void;
}

export const useExamDraft = create<DraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      patch: (p) => set((s) => (s.draft ? { draft: { ...s.draft, ...p } } : s)),
    }),
    { name: 'haneul:examdraft', storage: jsonStorage, version: 1 },
  ),
);

// ----------------------------------------------------------------- Translator history
export interface TranslationEntry {
  id: string;
  text: string;
  dir: 'ko-th' | 'th-ko';
  summary: string;
  at: number;
  favorite: boolean;
}

interface TranslatorState {
  history: TranslationEntry[];
  add: (e: Omit<TranslationEntry, 'id' | 'at' | 'favorite'>) => void;
  toggleFavorite: (id: string) => void;
  remove: (id: string) => void;
  clearHistory: () => void;
}

export const useTranslatorHistory = create<TranslatorState>()(
  persist(
    (set) => ({
      history: [],
      add: (e) =>
        set((s) => {
          const rest = s.history.filter((h) => !(h.text === e.text && h.dir === e.dir));
          const fav = s.history.find((h) => h.text === e.text && h.dir === e.dir)?.favorite ?? false;
          return { history: [{ ...e, id: uid('tr'), at: Date.now(), favorite: fav }, ...rest].slice(0, 150) };
        }),
      toggleFavorite: (id) => set((s) => ({ history: s.history.map((h) => (h.id === id ? { ...h, favorite: !h.favorite } : h)) })),
      remove: (id) => set((s) => ({ history: s.history.filter((h) => h.id !== id) })),
      clearHistory: () => set((s) => ({ history: s.history.filter((h) => h.favorite) })),
    }),
    { name: 'haneul:translator', storage: jsonStorage, version: 1 },
  ),
);

// ----------------------------------------------------------------- Game history
export interface GameResult {
  id: string;
  gameId: GameId;
  mode: 'solo' | 'local' | 'online';
  level: Level;
  players: { name: string; score: number; correct: number }[];
  at: number;
  won?: boolean;
}

interface GameHistoryState {
  results: GameResult[];
  add: (r: Omit<GameResult, 'id' | 'at'>) => void;
}

export const useGameHistory = create<GameHistoryState>()(
  persist(
    (set) => ({
      results: [],
      add: (r) => set((s) => ({ results: [...s.results, { ...r, id: uid('game'), at: Date.now() }].slice(-300) })),
    }),
    { name: 'haneul:games', storage: jsonStorage, version: 1 },
  ),
);
