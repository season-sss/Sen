import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage } from './persist';
import type { Level } from '@/data/types';

export type ThemePref = 'system' | 'light' | 'dark';
export type ThaiReadingPref = 'always' | 'tap' | 'never';

export interface SettingsState {
  theme: ThemePref;
  thaiReading: ThaiReadingPref;
  showRomanization: boolean;
  ttsRate: number;
  displayName: string;
  currentLevel: Level;
  dailyGoalMinutes: number;
  newCardsPerDay: number;
  set: (patch: Partial<Omit<SettingsState, 'set'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      thaiReading: 'tap',
      showRomanization: true,
      ttsRate: 0.9,
      displayName: '',
      currentLevel: 'L0',
      dailyGoalMinutes: 30,
      newCardsPerDay: 15,
      set: (patch) => set(patch),
    }),
    { name: 'haneul:settings', storage: jsonStorage, version: 1 },
  ),
);
