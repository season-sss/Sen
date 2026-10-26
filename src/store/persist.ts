/**
 * Local-first persistence. Every store is saved under `haneul:<name>` in this browser.
 * `touch()` records a per-store updatedAt so the optional cloud sync (lib/backend/sync.ts)
 * can decide which copy is newer.
 */
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const STORE_PREFIX = 'haneul:';
const META_KEY = 'haneul:__meta';

const memory = new Map<string, string>();

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return memory.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      memory.set(name, value);
    }
    touch(name);
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      memory.delete(name);
    }
  },
};

export const jsonStorage = createJSONStorage(() => safeStorage);

type Meta = Record<string, number>;
let suppressTouch = false;
const listeners = new Set<(key: string) => void>();

export function readMeta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Meta;
  } catch {
    return {};
  }
}

function touch(name: string) {
  if (suppressTouch || name === META_KEY) return;
  const meta = readMeta();
  meta[name] = Date.now();
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l(name));
}

export function setMeta(name: string, ts: number) {
  const meta = readMeta();
  meta[name] = ts;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

/** Run a write without marking the store as locally changed (used when applying remote data). */
export function withoutTouch(fn: () => void) {
  suppressTouch = true;
  try {
    fn();
  } finally {
    suppressTouch = false;
  }
}

export function onStoreWrite(cb: (key: string) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function uid(prefix = 'id'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
