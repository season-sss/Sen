/**
 * Low-level Hangul syllable composition / decomposition.
 * Unicode: syllable = 0xAC00 + (initial * 21 + medial) * 28 + final
 */

export const INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
export const MEDIALS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'] as const;
export const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;

const BASE = 0xac00;
const LAST = 0xd7a3;

export interface Syllable {
  initial: string;
  medial: string;
  final: string;
}

export function isHangulSyllable(ch: string): boolean {
  if (!ch) return false;
  const c = ch.charCodeAt(0);
  return c >= BASE && c <= LAST;
}

export function isHangulText(text: string): boolean {
  return /[가-힣]/.test(text);
}

export function decompose(ch: string): Syllable | null {
  if (!isHangulSyllable(ch)) return null;
  const code = ch.charCodeAt(0) - BASE;
  const final = code % 28;
  const medial = ((code - final) / 28) % 21;
  const initial = Math.floor(code / 28 / 21);
  return { initial: INITIALS[initial], medial: MEDIALS[medial], final: FINALS[final] };
}

export function compose(initial: string, medial: string, final = ''): string {
  const i = INITIALS.indexOf(initial as (typeof INITIALS)[number]);
  const m = MEDIALS.indexOf(medial as (typeof MEDIALS)[number]);
  const f = FINALS.indexOf(final as (typeof FINALS)[number]);
  if (i < 0 || m < 0 || f < 0) {
    throw new Error(`Cannot compose syllable from ${initial}+${medial}+${final}`);
  }
  return String.fromCharCode(BASE + (i * 21 + m) * 28 + f);
}

/** Replace the final consonant (batchim) of a syllable. */
export function withFinal(ch: string, final: string): string {
  const s = decompose(ch);
  if (!s) throw new Error(`Not a Hangul syllable: ${ch}`);
  return compose(s.initial, s.medial, final);
}

export function withMedial(ch: string, medial: string): string {
  const s = decompose(ch);
  if (!s) throw new Error(`Not a Hangul syllable: ${ch}`);
  return compose(s.initial, medial, s.final);
}

export function lastChar(word: string): string {
  return word.charAt(word.length - 1);
}

/** Final consonant of the last syllable, '' if none or not Hangul. */
export function finalOf(word: string): string {
  const s = decompose(lastChar(word));
  return s ? s.final : '';
}

export function medialOf(ch: string): string {
  return decompose(ch)?.medial ?? '';
}

/** True if the last syllable of `word` has a batchim. Numbers are read in Sino-Korean. */
export function hasBatchim(word: string): boolean {
  const trimmed = word.trim();
  const ch = lastChar(trimmed);
  if (/[0-9]/.test(ch)) {
    // 0 영, 1 일, 2 이, 3 삼, 4 사, 5 오, 6 육, 7 칠, 8 팔, 9 구
    return ['0', '1', '3', '6', '7', '8'].includes(ch);
  }
  return finalOf(trimmed) !== '';
}

/** Split text into individual jamo (useful for typing practice and spelling games). */
export function toJamo(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    const s = decompose(ch);
    if (!s) {
      out.push(ch);
      continue;
    }
    out.push(s.initial, s.medial);
    if (s.final) out.push(s.final);
  }
  return out;
}

export const COMPLEX_FINALS: Record<string, [string, string]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
};
