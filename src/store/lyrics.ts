import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage, uid } from './persist';
import type { LyricLine, Song } from '@/lib/lyrics/types';

export interface SongStats {
  plays: number;
  best: number;
  lastAt: number;
  /** line index → times answered wrong (to repeat hard lines more often) */
  misses: Record<number, number>;
}

interface LyricsState {
  /** Songs this user added (their own lyrics and translations) */
  songs: Song[];
  stats: Record<string, SongStats>;
  addSong: (s: { title: string; artist?: string; lines: LyricLine[] }) => string;
  updateSong: (id: string, patch: Partial<Pick<Song, 'title' | 'artist' | 'lines'>>) => void;
  removeSong: (id: string) => void;
  recordPlay: (songId: string, scorePct: number, missedLines: number[]) => void;
}

export const useLyrics = create<LyricsState>()(
  persist(
    (set) => ({
      songs: [],
      stats: {},
      addSong: (s) => {
        const id = uid('song');
        const now = Date.now();
        set((st) => ({ songs: [...st.songs, { ...s, id, source: 'user', createdAt: now, updatedAt: now }] }));
        return id;
      },
      updateSong: (id, patch) => set((st) => ({ songs: st.songs.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x)) })),
      removeSong: (id) =>
        set((st) => {
          const { [id]: _removed, ...stats } = st.stats;
          return { songs: st.songs.filter((x) => x.id !== id), stats };
        }),
      recordPlay: (songId, scorePct, missedLines) =>
        set((st) => {
          const prev = st.stats[songId] ?? { plays: 0, best: 0, lastAt: 0, misses: {} };
          const misses = { ...prev.misses };
          for (const i of missedLines) misses[i] = (misses[i] ?? 0) + 1;
          return { stats: { ...st.stats, [songId]: { plays: prev.plays + 1, best: Math.max(prev.best, scorePct), lastAt: Date.now(), misses } } };
        }),
    }),
    { name: 'haneul:lyrics', storage: jsonStorage, version: 1 },
  ),
);
