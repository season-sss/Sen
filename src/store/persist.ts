/**
 * Local-first persistence. Every store is saved under a logical key `haneul:<name>`.
 *
 * Accounts: each signed-in profile gets its own namespace, so the same logical key maps to
 * `haneul:u:<ns>:<name>` in localStorage. The guest (signed-out) namespace keeps the plain
 * `haneul:<name>` keys. The active namespace is read from `haneul:session` before any store is
 * created, and switched at runtime by lib/account (which rehydrates every store afterwards).
 *
 * `touch()` records a per-store updatedAt so the optional cloud sync (lib/backend/sync.ts)
 * can decide which copy is newer.
 */
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

export const STORE_PREFIX = 'haneul:';
const META_KEY = 'haneul:__meta';
/** Device-level keys that never belong to a profile namespace. */
export const SESSION_KEY = 'haneul:session';
export const ACCOUNTS_KEY = 'haneul:accounts';

const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}
function rawSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}
function rawRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}
export const rawStorage = { get: rawGet, set: rawSet, remove: rawRemove };

function initialNamespace(): string {
  try {
    const s = JSON.parse(rawGet(SESSION_KEY) ?? 'null') as { ns?: unknown } | null;
    return typeof s?.ns === 'string' && /^[a-z0-9_-]{1,64}$/i.test(s.ns) ? s.ns : '';
  } catch {
    return '';
  }
}

let namespace = initialNamespace();
let writesBlocked = false;

export function getNamespace() {
  return namespace;
}

/** Physical localStorage key for a logical store key in a namespace ('' = guest). */
export function physicalKey(name: string, ns = namespace): string {
  if (!ns || !name.startsWith(STORE_PREFIX) || name === SESSION_KEY || name === ACCOUNTS_KEY) return name;
  return `${STORE_PREFIX}u:${ns}:${name.slice(STORE_PREFIX.length)}`;
}

/** All physical keys that belong to a namespace (for deleting a profile). */
export function namespaceKeys(ns: string): string[] {
  const prefix = `${STORE_PREFIX}u:${ns}:`;
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(prefix)) out.push(k);
    }
  } catch {
    for (const k of memory.keys()) if (k.startsWith(prefix)) out.push(k);
  }
  return out;
}

/**
 * Point the stores at another namespace. Writes are dropped while `reset` runs so that resetting
 * stores to their initial state cannot overwrite the target profile's saved data.
 */
export async function switchNamespace(ns: string, reset: () => void, rehydrate: () => Promise<void>) {
  writesBlocked = true;
  try {
    namespace = ns;
    reset();
  } finally {
    writesBlocked = false;
  }
  await rehydrate();
}

export const safeStorage: StateStorage = {
  getItem: (name) => rawGet(physicalKey(name)),
  setItem: (name, value) => {
    if (writesBlocked) return;
    rawSet(physicalKey(name), value);
    touch(name);
  },
  removeItem: (name) => {
    if (writesBlocked) return;
    rawRemove(physicalKey(name));
  },
};

export const jsonStorage = createJSONStorage(() => safeStorage);

type Meta = Record<string, number>;
let suppressTouch = false;
const listeners = new Set<(key: string) => void>();

export function readMeta(ns = namespace): Meta {
  try {
    return JSON.parse(rawGet(physicalKey(META_KEY, ns)) ?? '{}') as Meta;
  } catch {
    return {};
  }
}

function touch(name: string) {
  if (suppressTouch || name === META_KEY) return;
  setMeta(name, Date.now());
  listeners.forEach((l) => l(name));
}

export function setMeta(name: string, ts: number, ns = namespace) {
  const meta = readMeta(ns);
  meta[name] = ts;
  rawSet(physicalKey(META_KEY, ns), JSON.stringify(meta));
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
