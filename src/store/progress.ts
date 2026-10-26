import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage } from './persist';
import type { Level } from '@/data/types';
import type { AnswerRecord, Question, Section } from '@/lib/quiz/types';
import { PASS_RATIO } from '@/lib/quiz/report';
import { today, type ISODate } from '@/lib/util/date';

export type LessonStatus = 'not-started' | 'learning' | 'completed' | 'needs-review';

export interface LessonProgress {
  status: Exclude<LessonStatus, 'not-started'>;
  topicsSeen: string[];
  bestScore: number;
  lastScore: number;
  attempts: number;
  firstStudied: number;
  lastStudied: number;
  completedAt?: number;
}

export interface AssessmentResult {
  id: string;
  kind: 'unit' | 'level';
  targetId: string;
  score: number;
  total: number;
  passed: boolean;
  at: number;
  bySection: { section: Section; correct: number; total: number }[];
}

export interface DayActivity {
  minutes: number;
  answers: number;
  correct: number;
  lessons: number;
  reviews: number;
}

export interface LoggedAnswer extends AnswerRecord {
  at: number;
  source: string;
}

export interface Mistake {
  question: Question;
  count: number;
  lastAt: number;
  lastGiven: string;
  source: string;
}

interface ProgressState {
  lessons: Record<string, LessonProgress>;
  assessments: AssessmentResult[];
  activity: Record<ISODate, DayActivity>;
  answers: LoggedAnswer[];
  /** Questions answered wrongly and not yet corrected — keyed by question id */
  mistakes: Record<string, Mistake>;
  startLesson: (lessonId: string) => void;
  markTopicSeen: (lessonId: string, topicId: string) => void;
  finishLesson: (lessonId: string, correct: number, total: number) => LessonStatus;
  setLessonStatus: (lessonId: string, status: LessonStatus) => void;
  recordAssessment: (r: Omit<AssessmentResult, 'id' | 'at'>, lessonIds: string[]) => void;
  logAnswers: (records: AnswerRecord[], source: string, questions?: Question[]) => void;
  clearMistake: (questionId: string) => void;
  addMinutes: (minutes: number, kind?: 'lesson' | 'review') => void;
  reset: () => void;
}

const MAX_ANSWERS = 3000;

const emptyDay = (): DayActivity => ({ minutes: 0, answers: 0, correct: 0, lessons: 0, reviews: 0 });

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      lessons: {},
      assessments: [],
      activity: {},
      answers: [],
      mistakes: {},

      startLesson: (lessonId) =>
        set((s) => {
          if (s.lessons[lessonId]) return { lessons: { ...s.lessons, [lessonId]: { ...s.lessons[lessonId], lastStudied: Date.now() } } };
          const now = Date.now();
          return { lessons: { ...s.lessons, [lessonId]: { status: 'learning', topicsSeen: [], bestScore: 0, lastScore: 0, attempts: 0, firstStudied: now, lastStudied: now } } };
        }),

      markTopicSeen: (lessonId, topicId) =>
        set((s) => {
          const lp = s.lessons[lessonId];
          if (!lp || lp.topicsSeen.includes(topicId)) return s;
          return { lessons: { ...s.lessons, [lessonId]: { ...lp, topicsSeen: [...lp.topicsSeen, topicId], lastStudied: Date.now() } } };
        }),

      finishLesson: (lessonId, correct, total) => {
        const ratio = total ? correct / total : 1;
        const passed = ratio >= PASS_RATIO;
        const now = Date.now();
        const prev = get().lessons[lessonId];
        const status: LessonProgress['status'] = passed ? 'completed' : 'needs-review';
        set((s) => {
          const d = today();
          const day = s.activity[d] ?? emptyDay();
          return {
            lessons: {
              ...s.lessons,
              [lessonId]: {
                topicsSeen: prev?.topicsSeen ?? [],
                firstStudied: prev?.firstStudied ?? now,
                status,
                bestScore: Math.max(prev?.bestScore ?? 0, ratio),
                lastScore: ratio,
                attempts: (prev?.attempts ?? 0) + 1,
                lastStudied: now,
                completedAt: passed ? prev?.completedAt ?? now : prev?.completedAt,
              },
            },
            activity: { ...s.activity, [d]: { ...day, lessons: day.lessons + (passed ? 1 : 0) } },
          };
        });
        return status;
      },

      setLessonStatus: (lessonId, status) =>
        set((s) => {
          if (status === 'not-started') {
            const { [lessonId]: _removed, ...rest } = s.lessons;
            return { lessons: rest };
          }
          const now = Date.now();
          const prev = s.lessons[lessonId];
          return {
            lessons: {
              ...s.lessons,
              [lessonId]: {
                topicsSeen: prev?.topicsSeen ?? [],
                bestScore: prev?.bestScore ?? 0,
                lastScore: prev?.lastScore ?? 0,
                attempts: prev?.attempts ?? 0,
                firstStudied: prev?.firstStudied ?? now,
                lastStudied: now,
                status,
                completedAt: status === 'completed' ? prev?.completedAt ?? now : prev?.completedAt,
              },
            },
          };
        }),

      recordAssessment: (r, lessonIds) =>
        set((s) => {
          const result: AssessmentResult = { ...r, id: `${r.kind}-${r.targetId}-${Date.now()}`, at: Date.now() };
          const lessons = { ...s.lessons };
          // A passed unit check confirms its lessons; a failed one flags completed lessons for review.
          for (const id of lessonIds) {
            const lp = lessons[id];
            if (r.passed && lp && lp.status !== 'completed') lessons[id] = { ...lp, status: 'completed', completedAt: Date.now() };
            if (!r.passed && lp?.status === 'completed') lessons[id] = { ...lp, status: 'needs-review' };
          }
          return { assessments: [...s.assessments, result].slice(-200), lessons };
        }),

      logAnswers: (records, source, questions = []) =>
        set((s) => {
          const at = Date.now();
          const d = today();
          const day = s.activity[d] ?? emptyDay();
          const byId = new Map(questions.map((q) => [q.id, q]));
          const mistakes = { ...s.mistakes };
          for (const r of records) {
            if (r.correct) delete mistakes[r.questionId];
            else {
              const q = byId.get(r.questionId) ?? mistakes[r.questionId]?.question;
              if (q && q.kind !== 'writing') mistakes[r.questionId] = { question: q, count: (mistakes[r.questionId]?.count ?? 0) + 1, lastAt: at, lastGiven: r.given, source };
            }
          }
          return {
            mistakes,
            answers: [...s.answers, ...records.map((r) => ({ ...r, at, source }))].slice(-MAX_ANSWERS),
            activity: { ...s.activity, [d]: { ...day, answers: day.answers + records.length, correct: day.correct + records.filter((r) => r.correct).length } },
          };
        }),

      clearMistake: (questionId) =>
        set((s) => {
          const { [questionId]: _removed, ...rest } = s.mistakes;
          return { mistakes: rest };
        }),

      addMinutes: (minutes, kind = 'lesson') =>
        set((s) => {
          const d = today();
          const day = s.activity[d] ?? emptyDay();
          return { activity: { ...s.activity, [d]: { ...day, minutes: day.minutes + minutes, reviews: day.reviews + (kind === 'review' ? 1 : 0) } } };
        }),

      reset: () => set({ lessons: {}, assessments: [], activity: {}, answers: [], mistakes: {} }),
    }),
    { name: 'haneul:progress', storage: jsonStorage, version: 1 },
  ),
);

export function lessonStatus(lessons: Record<string, LessonProgress>, id: string): LessonStatus {
  return lessons[id]?.status ?? 'not-started';
}

export function aggregateStatus(statuses: LessonStatus[]): LessonStatus {
  if (!statuses.length || statuses.every((s) => s === 'not-started')) return 'not-started';
  if (statuses.some((s) => s === 'needs-review')) return 'needs-review';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  return 'learning';
}

export function completionRatio(statuses: LessonStatus[]): number {
  return statuses.length ? statuses.filter((s) => s === 'completed').length / statuses.length : 0;
}

/** Wrong answers not yet answered correctly later — for "Review Incorrect Answers". */
export function outstandingMistakes(answers: LoggedAnswer[]): LoggedAnswer[] {
  const latest = new Map<string, LoggedAnswer>();
  for (const a of answers) latest.set(a.questionId, a);
  return [...latest.values()].filter((a) => !a.correct);
}

export function levelOfAnswers(answers: LoggedAnswer[], level: Level) {
  return answers.filter((a) => a.level === level);
}
