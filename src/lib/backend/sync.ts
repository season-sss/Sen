/**
 * Optional cloud sync for the local-first stores.
 * Each store (haneul:progress, haneul:flashcards, …) is one row in `user_data`
 * (user_id, key, value jsonb, updated_at). Conflict rule: last write wins per store,
 * compared by the local write timestamp kept in haneul:__meta.
 * RLS guarantees a user can only read and write their own rows.
 */
import { create } from 'zustand';
import { supabase } from './client';
import { useAuth } from './auth';
import { getNamespace, onStoreWrite, readMeta, safeStorage, setMeta, withoutTouch } from '@/store/persist';
import { PERSISTED_STORES as STORES, type StoreKey } from '@/store/registry';

/** Only sync while the local data namespace belongs to the signed-in cloud user. */
function syncUser() {
  const user = useAuth.getState().user;
  return user && getNamespace() === `c_${user.id}` ? user : null;
}

interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  error: string | null;
}

export const useSync = create<SyncState>(() => ({ status: 'off', lastSyncedAt: null, error: null }));

const dirty = new Set<StoreKey>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function push(keys: StoreKey[]) {
  const user = syncUser();
  if (!supabase || !user || !keys.length) return;
  useSync.setState({ status: 'syncing' });
  const meta = readMeta();
  const rows = keys.map((key) => ({
    user_id: user.id,
    key,
    value: JSON.parse(safeStorage.getItem(key) as string ?? 'null'),
    updated_at: new Date(meta[key] ?? Date.now()).toISOString(),
  }));
  const { error } = await supabase.from('user_data').upsert(rows, { onConflict: 'user_id,key' });
  if (error) useSync.setState({ status: 'error', error: error.message });
  else useSync.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null });
}

function schedulePush(key: string) {
  if (!(key in STORES) || !syncUser()) return;
  dirty.add(key as StoreKey);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const keys = [...dirty];
    dirty.clear();
    void push(keys);
  }, 2500);
}

/** Pull remote rows; newer remote copies replace local ones, newer local copies are pushed. */
export async function syncNow() {
  const user = syncUser();
  if (!supabase || !user) return;
  useSync.setState({ status: 'syncing', error: null });
  const { data, error } = await supabase.from('user_data').select('key, value, updated_at').eq('user_id', user.id);
  if (error) {
    useSync.setState({ status: 'error', error: error.message });
    return;
  }
  const meta = readMeta();
  const remote = new Map((data ?? []).map((r) => [r.key as string, r]));
  const toPush: StoreKey[] = [];
  for (const key of Object.keys(STORES) as StoreKey[]) {
    const r = remote.get(key);
    const localTs = meta[key] ?? 0;
    const remoteTs = r ? new Date(r.updated_at as string).getTime() : 0;
    if (r && remoteTs > localTs && r.value) {
      withoutTouch(() => {
        safeStorage.setItem(key, JSON.stringify(r.value));
      });
      setMeta(key, remoteTs);
      await STORES[key].persist.rehydrate();
    } else if (localTs > remoteTs && safeStorage.getItem(key)) {
      toPush.push(key);
    }
  }
  await push(toPush);
  useSync.setState({ status: 'idle', lastSyncedAt: Date.now() });
}

/** Push pending local changes now (before signing out). */
export async function flushSync() {
  if (timer) clearTimeout(timer);
  timer = null;
  const keys = [...dirty];
  dirty.clear();
  await push(keys);
}

let started = false;
export function initSync() {
  if (started || !supabase) return;
  started = true;
  onStoreWrite(schedulePush);
  let lastUser: string | null = null;
  useAuth.subscribe((s) => {
    const id = s.user?.id ?? null;
    if (id && id !== lastUser) {
      lastUser = id;
      void syncNow();
    }
    if (!id) {
      lastUser = null;
      useSync.setState({ status: 'off' });
    }
  });
}
