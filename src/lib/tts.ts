/**
 * Korean text-to-speech via the browser's Web Speech API.
 * Availability depends on the device: many systems ship a Korean voice (iOS, macOS, Android,
 * Windows with Korean language pack). When none is found, `isKoreanTtsAvailable()` is false and
 * the UI disables audio features instead of failing silently.
 */
let cachedVoice: SpeechSynthesisVoice | null | undefined;
const listeners = new Set<() => void>();

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

function findVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  return voices.find((v) => v.lang === 'ko-KR') ?? voices.find((v) => v.lang.toLowerCase().startsWith('ko')) ?? null;
}

if (synth()) {
  synth()!.addEventListener?.('voiceschanged', () => {
    cachedVoice = findVoice();
    listeners.forEach((l) => l());
  });
}

export function koreanVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice === undefined || cachedVoice === null) cachedVoice = findVoice();
  return cachedVoice;
}

export function isKoreanTtsAvailable(): boolean {
  return Boolean(synth()) && Boolean(koreanVoice());
}

export function onVoicesChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export interface SpeakOptions {
  rate?: number;
  onEnd?: () => void;
}

export function speak(text: string, opts: SpeakOptions = {}): boolean {
  const s = synth();
  const voice = koreanVoice();
  if (!s || !voice) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/^[^:\n]{1,8}:\s*/gm, ''));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = opts.rate ?? 0.9;
  if (opts.onEnd) u.onend = opts.onEnd;
  s.speak(u);
  return true;
}

export function stopSpeaking() {
  synth()?.cancel();
}
