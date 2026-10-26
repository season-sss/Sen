/**
 * name#tag handles and numeric PINs — pure helpers (no storage), shared by local profiles and
 * cloud accounts.
 */

export const NAME_MAX = 16;
export const TAG_MAX = 10;

const codepoints = (s: string) => [...s].length;

/** Letters/marks/digits of any script, plus inner spaces, dot, underscore and hyphen. */
const NAME_RE = /^[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N} ._-]*[\p{L}\p{M}\p{N}])?$/u;
const TAG_RE = /^[\p{L}\p{M}\p{N}]+$/u;

export function cleanName(name: string) {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function cleanTag(tag: string) {
  return tag.normalize('NFC').replace(/^#/, '').trim();
}

export function validateName(name: string): string | null {
  const n = cleanName(name);
  if (!n) return 'กรุณาตั้งชื่อ';
  if (codepoints(n) > NAME_MAX) return `ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`;
  if (n.includes('#')) return 'ชื่อห้ามมีเครื่องหมาย #';
  if (!NAME_RE.test(n)) return 'ชื่อใช้ได้เฉพาะตัวอักษร (ภาษาใดก็ได้) ตัวเลข เว้นวรรค . _ -';
  return null;
}

export function validateTag(tag: string): string | null {
  const t = cleanTag(tag);
  if (!t) return 'กรุณาตั้งแท็กหลัง #';
  if (codepoints(t) > TAG_MAX) return `แท็กยาวได้ไม่เกิน ${TAG_MAX} ตัวอักษร`;
  if (!TAG_RE.test(t)) return 'แท็กใช้ได้เฉพาะตัวอักษรหรือตัวเลข (ไม่มีเว้นวรรค)';
  return null;
}

export function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return 'PIN ต้องเป็นตัวเลข 4–6 หลัก';
  return null;
}

/** Easy-to-guess PINs get a warning (still allowed — the learner chose a short PIN on purpose). */
export function weakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const asc = '0123456789012345';
  const desc = '9876543210987654';
  return asc.includes(pin) || desc.includes(pin) || ['1212', '121212', '1122', '112233', '6969', '0852'].includes(pin);
}

export function formatHandle(name: string, tag: string) {
  return `${cleanName(name)}#${cleanTag(tag)}`;
}

/** Case/width-insensitive key used to keep handles unique. */
export function handleKey(name: string, tag: string) {
  return `${cleanName(name).normalize('NFKC').toLowerCase()}#${cleanTag(tag).normalize('NFKC').toLowerCase()}`;
}

/** Split "ชื่อ#แท็ก" typed in one box. The last # separates the tag. */
export function parseHandle(input: string): { name: string; tag: string } | null {
  const s = input.trim();
  const at = s.lastIndexOf('#');
  if (at <= 0 || at === s.length - 1) return null;
  return { name: cleanName(s.slice(0, at)), tag: cleanTag(s.slice(at + 1)) };
}

function randomInt(max: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

/** A random 4-digit tag not already used with this name (falls back to 6 digits when crowded). */
export function suggestTag(name: string, taken: (key: string) => boolean): string {
  for (let i = 0; i < 40; i++) {
    const tag = String(randomInt(10000)).padStart(4, '0');
    if (!taken(handleKey(name, tag))) return tag;
  }
  return String(randomInt(1_000_000)).padStart(6, '0');
}

// ------------------------------------------------------------------ PIN hashing (Web Crypto)

const enc = new TextEncoder();

function toB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function newSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toB64(a);
}

export const PIN_ITERATIONS = 210_000;

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export async function hashPin(pin: string, saltB64: string, iterations = PIN_ITERATIONS): Promise<string> {
  if (!cryptoAvailable()) throw new Error('เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน https)');
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations }, key, 256);
  return toB64(bits);
}

/** Compare without stopping at the first different character. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lockout after repeated wrong PINs: 5 free tries, then 30 s doubling up to 1 hour. */
export function lockoutMs(failed: number): number {
  if (failed < 5) return 0;
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** (failed - 5));
}
