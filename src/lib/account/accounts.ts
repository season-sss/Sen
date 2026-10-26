/**
 * Accounts: "name#tag" + numeric PIN.
 *
 * - Local profiles (always available): several people can share one device. The PIN is stored
 *   only as a salted PBKDF2 hash. Each profile's learning data lives in its own storage
 *   namespace (see store/persist.ts). This separates profiles on a shared device; it is not
 *   encryption — anyone with access to the browser's storage can still read the raw data.
 * - Cloud accounts (when Supabase is configured): the same name#tag + PIN signs in to Supabase
 *   Auth, data syncs across devices, and online games are available. Server-side RLS keeps each
 *   user's rows private.
 */
import { create } from 'zustand';
import { ACCOUNTS_KEY, SESSION_KEY, getNamespace, namespaceKeys, physicalKey, rawStorage, readMeta, setMeta, switchNamespace } from '@/store/persist';
import { rehydrateAllStores, resetAllStores, STORE_KEYS } from '@/store/registry';
import { backendConfigured, supabase } from '@/lib/backend/client';
import { useAuth } from '@/lib/backend/auth';
import { cleanName, cleanTag, cryptoAvailable, formatHandle, handleKey, hashPin, lockoutMs, newSalt, PIN_ITERATIONS, safeEqual, sha256Hex, validateName, validatePin, validateTag } from './handle';

export interface LocalProfile {
  id: string;
  name: string;
  tag: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: number;
  lastLoginAt?: number;
  failed: number;
  lockedUntil: number;
}

export interface AccountSession {
  kind: 'local' | 'cloud';
  /** local profile id, or Supabase user id */
  id: string;
  ns: string;
  name: string;
  tag: string;
  at: number;
}

interface AccountState {
  profiles: LocalProfile[];
  session: AccountSession | null;
  switching: boolean;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(rawStorage.get(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export const useAccount = create<AccountState>(() => ({
  profiles: readJSON<LocalProfile[]>(ACCOUNTS_KEY, []).filter((p) => p && typeof p.id === 'string'),
  session: (() => {
    const s = readJSON<AccountSession | null>(SESSION_KEY, null);
    return s && s.ns === getNamespace() ? s : null;
  })(),
  switching: false,
}));

function saveProfiles(profiles: LocalProfile[]) {
  rawStorage.set(ACCOUNTS_KEY, JSON.stringify(profiles));
  useAccount.setState({ profiles });
}

function patchProfile(id: string, patch: Partial<LocalProfile>) {
  saveProfiles(useAccount.getState().profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function sessionHandle(s: AccountSession | null) {
  return s ? formatHandle(s.name, s.tag) : null;
}

function randomId() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function activate(session: AccountSession | null) {
  useAccount.setState({ switching: true });
  try {
    if (session) rawStorage.set(SESSION_KEY, JSON.stringify(session));
    else rawStorage.remove(SESSION_KEY);
    await switchNamespace(session?.ns ?? '', resetAllStores, rehydrateAllStores);
    useAccount.setState({ session });
  } finally {
    useAccount.setState({ switching: false });
  }
}

/** True when the signed-out (guest) space has anything saved worth moving into an account. */
export function guestHasData(): boolean {
  const meta = readMeta('');
  return STORE_KEYS.some((k) => k !== 'haneul:settings' && meta[k] && rawStorage.get(physicalKey(k, '')));
}

/** Move the guest space's data into a new account namespace (the guest space is emptied). */
function moveGuestData(toNs: string) {
  const meta = readMeta('');
  for (const k of STORE_KEYS) {
    const v = rawStorage.get(physicalKey(k, ''));
    if (v === null) continue;
    rawStorage.set(physicalKey(k, toNs), v);
    setMeta(k, meta[k] ?? Date.now(), toNs);
    rawStorage.remove(physicalKey(k, ''));
  }
  rawStorage.remove(physicalKey('haneul:__meta', ''));
}

export function localHandleTaken(key: string, exceptId?: string) {
  return useAccount.getState().profiles.some((p) => p.id !== exceptId && handleKey(p.name, p.tag) === key);
}

function check(name: string, tag: string, pin: string) {
  const err = validateName(name) ?? validateTag(tag) ?? validatePin(pin);
  if (err) throw new Error(err);
  if (!cryptoAvailable()) throw new Error('เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส PIN (ต้องเปิดเว็บผ่าน https)');
}

// ------------------------------------------------------------------ local profiles

export async function createLocalProfile(input: { name: string; tag: string; pin: string; moveGuest: boolean }) {
  const name = cleanName(input.name);
  const tag = cleanTag(input.tag);
  check(name, tag, input.pin);
  if (localHandleTaken(handleKey(name, tag))) throw new Error(`${formatHandle(name, tag)} มีอยู่แล้วในเครื่องนี้ — เปลี่ยนแท็กหลัง #`);
  const salt = newSalt();
  const profile: LocalProfile = { id: randomId(), name, tag, salt, hash: await hashPin(input.pin, salt), iterations: PIN_ITERATIONS, createdAt: Date.now(), lastLoginAt: Date.now(), failed: 0, lockedUntil: 0 };
  saveProfiles([...useAccount.getState().profiles, profile]);
  const ns = `l_${profile.id}`;
  if (input.moveGuest) moveGuestData(ns);
  await activate({ kind: 'local', id: profile.id, ns, name, tag, at: Date.now() });
  return profile;
}

async function verify(profile: LocalProfile, pin: string): Promise<void> {
  const now = Date.now();
  if (profile.lockedUntil > now) throw new Error(`ใส่ PIN ผิดหลายครั้ง — ลองใหม่ใน ${Math.ceil((profile.lockedUntil - now) / 1000)} วินาที`);
  const ok = !validatePin(pin) && safeEqual(await hashPin(pin, profile.salt, profile.iterations), profile.hash);
  if (!ok) {
    const failed = profile.failed + 1;
    patchProfile(profile.id, { failed, lockedUntil: now + lockoutMs(failed) });
    const left = 5 - failed;
    throw new Error(left > 0 ? `PIN ไม่ถูกต้อง (เหลืออีก ${left} ครั้งก่อนถูกพักชั่วคราว)` : `PIN ไม่ถูกต้อง — พักการเข้าสู่ระบบ ${Math.round(lockoutMs(failed) / 1000)} วินาที`);
  }
  patchProfile(profile.id, { failed: 0, lockedUntil: 0 });
}

export async function loginLocal(profileId: string, pin: string) {
  const p = useAccount.getState().profiles.find((x) => x.id === profileId);
  if (!p) throw new Error('ไม่พบบัญชีนี้ในเครื่อง');
  await verify(p, pin);
  patchProfile(p.id, { lastLoginAt: Date.now() });
  await activate({ kind: 'local', id: p.id, ns: `l_${p.id}`, name: p.name, tag: p.tag, at: Date.now() });
}

export function findLocalProfile(name: string, tag: string) {
  const key = handleKey(name, tag);
  return useAccount.getState().profiles.find((p) => handleKey(p.name, p.tag) === key) ?? null;
}

export async function changeLocalPin(profileId: string, oldPin: string, newPin: string) {
  const p = useAccount.getState().profiles.find((x) => x.id === profileId);
  if (!p) throw new Error('ไม่พบบัญชีนี้');
  const err = validatePin(newPin);
  if (err) throw new Error(err);
  await verify(p, oldPin);
  const salt = newSalt();
  patchProfile(p.id, { salt, hash: await hashPin(newPin, salt), iterations: PIN_ITERATIONS });
}

export async function deleteLocalProfile(profileId: string, pin: string) {
  const p = useAccount.getState().profiles.find((x) => x.id === profileId);
  if (!p) throw new Error('ไม่พบบัญชีนี้');
  await verify(p, pin);
  const ns = `l_${p.id}`;
  if (useAccount.getState().session?.ns === ns) await activate(null);
  for (const k of namespaceKeys(ns)) rawStorage.remove(k);
  saveProfiles(useAccount.getState().profiles.filter((x) => x.id !== p.id));
}

// ------------------------------------------------------------------ cloud accounts (Supabase)

export const cloudAvailable = backendConfigured;
const EMAIL_DOMAIN = (import.meta.env.VITE_HANDLE_EMAIL_DOMAIN as string | undefined) || 'users.haneul.invalid';

/** Supabase Auth needs an email; derive a stable, non-reversible one from the handle. */
export async function handleEmail(name: string, tag: string) {
  return `h${(await sha256Hex(`haneul-handle:${handleKey(name, tag)}`)).slice(0, 40)}@${EMAIL_DOMAIN}`;
}
/** Supabase's minimum password length is 6; the PIN is the secret, the prefix only satisfies that rule. */
const cloudPassword = (pin: string) => `haneul-pin:${pin}`;

function cloudError(e: { message?: string } | null): Error {
  const m = e?.message ?? '';
  if (/already registered|already exists/i.test(m)) return new Error('ชื่อ#แท็กนี้มีคนใช้แล้ว — ลองเปลี่ยนแท็ก');
  if (/invalid login credentials/i.test(m)) return new Error('ชื่อ#แท็ก หรือ PIN ไม่ถูกต้อง');
  if (/rate limit|too many/i.test(m)) return new Error('ลองเข้าสู่ระบบบ่อยเกินไป — รอสักครู่แล้วลองใหม่');
  return new Error(m || 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
}

export async function cloudRegister(input: { name: string; tag: string; pin: string; moveGuest: boolean }) {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (Supabase)');
  const name = cleanName(input.name);
  const tag = cleanTag(input.tag);
  check(name, tag, input.pin);
  const handle = formatHandle(name, tag);
  const { data, error } = await supabase.auth.signUp({
    email: await handleEmail(name, tag),
    password: cloudPassword(input.pin),
    options: { data: { handle, display_name: handle } },
  });
  if (error) throw cloudError(error);
  if (!data.session || !data.user) throw new Error('สมัครแล้วแต่ยังเข้าสู่ระบบไม่ได้ — ผู้ดูแลต้องปิด “Confirm email” ใน Supabase');
  const ns = `c_${data.user.id}`;
  if (input.moveGuest) moveGuestData(ns);
  await activate({ kind: 'cloud', id: data.user.id, ns, name, tag, at: Date.now() });
  await syncAfterLogin();
}

export async function cloudLogin(input: { name: string; tag: string; pin: string }) {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (Supabase)');
  const name = cleanName(input.name);
  const tag = cleanTag(input.tag);
  check(name, tag, input.pin);
  const { data, error } = await supabase.auth.signInWithPassword({ email: await handleEmail(name, tag), password: cloudPassword(input.pin) });
  if (error || !data.user) throw cloudError(error);
  const meta = (data.user.user_metadata ?? {}) as { handle?: string };
  const [mName, mTag] = (meta.handle ?? '').split('#');
  await activate({ kind: 'cloud', id: data.user.id, ns: `c_${data.user.id}`, name: mName || name, tag: mTag || tag, at: Date.now() });
  await syncAfterLogin();
}

async function syncAfterLogin() {
  const { syncNow } = await import('@/lib/backend/sync');
  await syncNow();
}

export async function logout() {
  const s = useAccount.getState().session;
  if (s?.kind === 'cloud' && supabase) {
    const { flushSync } = await import('@/lib/backend/sync');
    await flushSync();
    await supabase.auth.signOut();
  }
  await activate(null);
}

let started = false;
/** Keep the account session consistent with the Supabase auth session. */
export function initAccounts() {
  if (started || !supabase) return;
  started = true;
  const apply = (s: ReturnType<typeof useAuth.getState>) => {
    if (!s.ready) return;
    const session = useAccount.getState().session;
    if (!s.user && session?.kind === 'cloud') void activate(null);
    if (s.user && session?.kind !== 'cloud' && !useAccount.getState().switching) {
      // A Supabase session exists without a matching account session (e.g. restored on reload).
      const meta = (s.user.user_metadata ?? {}) as { handle?: string };
      const [name, tag] = (meta.handle ?? '').split('#');
      if (name && tag && !session) void activate({ kind: 'cloud', id: s.user.id, ns: `c_${s.user.id}`, name, tag, at: Date.now() }).then(syncAfterLogin);
    }
  };
  apply(useAuth.getState());
  useAuth.subscribe(apply);
}
