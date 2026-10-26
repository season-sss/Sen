/**
 * Tiny IndexedDB key → Blob store (for audio files the learner picks from their own device).
 * Files never leave the browser. Every call fails soft: callers treat `null` as "not stored".
 */
const DB = 'haneul-files';
const STORE = 'blobs';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export interface StoredFile {
  name: string;
  type: string;
  blob: Blob;
}

export const blobStore = {
  get: (key: string) => run<StoredFile | undefined>('readonly', (s) => s.get(key) as IDBRequest<StoredFile | undefined>),
  put: (key: string, file: File) => run('readwrite', (s) => s.put({ name: file.name, type: file.type, blob: file } satisfies StoredFile, key)),
  remove: (key: string) => run('readwrite', (s) => s.delete(key)),
};
