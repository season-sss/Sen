/**
 * Every persisted store, by logical storage key. Used by account switching (reset + rehydrate),
 * cloud sync, backup export/import and "clear data". Keys must match `^haneul:[a-z]+$`
 * (the user_data.key check in the database).
 */
import { useProgress } from './progress';
import { useFlashcards } from './flashcards';
import { useNotes } from './notes';
import { usePlanner } from './planner';
import { useExamDraft, useExams, useGameHistory, useTranslatorHistory } from './history';
import { useSettings } from './settings';
import { useLyrics } from './lyrics';

export const PERSISTED_STORES = {
  'haneul:progress': useProgress,
  'haneul:flashcards': useFlashcards,
  'haneul:notes': useNotes,
  'haneul:planner': usePlanner,
  'haneul:exams': useExams,
  'haneul:examdraft': useExamDraft,
  'haneul:games': useGameHistory,
  'haneul:translator': useTranslatorHistory,
  'haneul:settings': useSettings,
  'haneul:lyrics': useLyrics,
} as const;

export type StoreKey = keyof typeof PERSISTED_STORES;
export const STORE_KEYS = Object.keys(PERSISTED_STORES) as StoreKey[];
const stores = Object.values(PERSISTED_STORES);

/** Reset every store to its initial state (in memory). */
export function resetAllStores() {
  for (const s of stores) (s.setState as (v: unknown, replace: boolean) => void)(s.getInitialState(), true);
}

export async function rehydrateAllStores() {
  await Promise.all(stores.map((s) => s.persist.rehydrate()));
}
