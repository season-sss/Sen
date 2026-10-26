/**
 * Translator service — provider abstraction kept separate from the UI.
 *
 * - `local` (always available): HANEUL's dictionary/sentence-bank analyzer. Honest about coverage.
 * - `remote` (optional): only enabled when VITE_TRANSLATE_ENDPOINT points at YOUR backend proxy.
 *   The proxy holds any third-party API key server-side; the browser never sees a secret.
 *   Contract: POST { text, source: 'ko'|'th', target: 'ko'|'th' } → { translation: string, provider: string }
 */
import { analyze, searchThai, type Analysis, type ThaiResult } from './analyzer';

export type Direction = 'ko-th' | 'th-ko';

export interface RemoteTranslation {
  translation: string;
  provider: string;
}

export const REMOTE_ENDPOINT: string | undefined = import.meta.env.VITE_TRANSLATE_ENDPOINT || undefined;

export function isRemoteAvailable(): boolean {
  return Boolean(REMOTE_ENDPOINT);
}

export function analyzeKorean(text: string): Analysis {
  return analyze(text);
}

export function lookupThai(text: string): ThaiResult {
  return searchThai(text);
}

export async function translateRemote(text: string, dir: Direction, signal?: AbortSignal): Promise<RemoteTranslation> {
  if (!REMOTE_ENDPOINT) throw new Error('ยังไม่ได้ตั้งค่า Translation backend');
  const [source, target] = dir === 'ko-th' ? ['ko', 'th'] : ['th', 'ko'];
  const res = await fetch(REMOTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, source, target }),
    signal,
  });
  if (!res.ok) throw new Error(`Translation backend error ${res.status}`);
  const data = (await res.json()) as Partial<RemoteTranslation>;
  if (typeof data.translation !== 'string') throw new Error('Translation backend returned an invalid response');
  return { translation: data.translation, provider: data.provider ?? 'remote' };
}
