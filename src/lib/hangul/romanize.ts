/**
 * Revised Romanization of Korean (국어의 로마자 표기법) and an approximate Thai reading aid.
 * Both are generated from the *pronounced* form (see pronunciation.ts), as the official
 * romanization rules require. Thai readings are only a learning crutch — Korean has sounds
 * Thai script cannot represent exactly — and the UI lets learners hide them.
 */
import { decompose, isHangulSyllable } from './jamo';
import { pronounce } from './pronunciation';

const RR_INITIAL: Record<string, string> = {
  ㄱ: 'g', ㄲ: 'kk', ㄴ: 'n', ㄷ: 'd', ㄸ: 'tt', ㄹ: 'r', ㅁ: 'm', ㅂ: 'b', ㅃ: 'pp', ㅅ: 's', ㅆ: 'ss',
  ㅇ: '', ㅈ: 'j', ㅉ: 'jj', ㅊ: 'ch', ㅋ: 'k', ㅌ: 't', ㅍ: 'p', ㅎ: 'h',
};
const RR_MEDIAL: Record<string, string> = {
  ㅏ: 'a', ㅐ: 'ae', ㅑ: 'ya', ㅒ: 'yae', ㅓ: 'eo', ㅔ: 'e', ㅕ: 'yeo', ㅖ: 'ye', ㅗ: 'o', ㅘ: 'wa', ㅙ: 'wae',
  ㅚ: 'oe', ㅛ: 'yo', ㅜ: 'u', ㅝ: 'wo', ㅞ: 'we', ㅟ: 'wi', ㅠ: 'yu', ㅡ: 'eu', ㅢ: 'ui', ㅣ: 'i',
};
const RR_FINAL: Record<string, string> = { ㄱ: 'k', ㄴ: 'n', ㄷ: 't', ㄹ: 'l', ㅁ: 'm', ㅂ: 'p', ㅇ: 'ng' };

export function romanize(text: string): string {
  const pron = pronounce(text, { tensification: false }).text;
  let out = '';
  let prevFinal = '';
  for (const ch of pron) {
    const d = decompose(ch);
    if (!d) {
      out += ch;
      prevFinal = '';
      continue;
    }
    let ini = RR_INITIAL[d.initial];
    if (d.initial === 'ㄹ' && prevFinal === 'ㄹ') ini = 'l';
    out += ini + RR_MEDIAL[d.medial] + (d.final ? RR_FINAL[d.final] ?? '' : '');
    prevFinal = d.final;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Thai reading aid
// ---------------------------------------------------------------------------
const TH_INITIAL: Record<string, string> = {
  ㄱ: 'ค', ㄲ: 'ก', ㄴ: 'น', ㄷ: 'ท', ㄸ: 'ต', ㄹ: 'ร', ㅁ: 'ม', ㅂ: 'พ', ㅃ: 'ป', ㅅ: 'ซ', ㅆ: 'ซ',
  ㅇ: 'อ', ㅈ: 'ช', ㅉ: 'จ', ㅊ: 'ช', ㅋ: 'ค', ㅌ: 'ท', ㅍ: 'พ', ㅎ: 'ฮ',
};
const TH_FINAL: Record<string, string> = { ㄱ: 'ก', ㄴ: 'น', ㄷ: 'ด', ㄹ: 'ล', ㅁ: 'ม', ㅂ: 'บ', ㅇ: 'ง' };

/** Vowel templates: C = consonant cluster, F = final. [open, closed] */
type Tpl = [string, string];
const BASE_VOWEL: Record<string, Tpl> = {
  a: ['Cา', 'CัF'],
  ae: ['แC', 'แCF'],
  eo: ['Cอ', 'CอF'],
  e: ['เC', 'เCF'],
  o: ['โC', 'โCF'],
  u: ['Cู', 'CุF'],
  eu: ['Cึ', 'CึF'],
  i: ['Cี', 'CิF'],
  ui: ['Cึย', 'Cึย'],
};
const VOWELS: Record<string, { glide: '' | 'w' | 'y'; base: string }> = {
  ㅏ: { glide: '', base: 'a' }, ㅐ: { glide: '', base: 'ae' }, ㅑ: { glide: 'y', base: 'a' }, ㅒ: { glide: 'y', base: 'ae' },
  ㅓ: { glide: '', base: 'eo' }, ㅔ: { glide: '', base: 'e' }, ㅕ: { glide: 'y', base: 'eo' }, ㅖ: { glide: 'y', base: 'e' },
  ㅗ: { glide: '', base: 'o' }, ㅘ: { glide: 'w', base: 'a' }, ㅙ: { glide: 'w', base: 'ae' }, ㅚ: { glide: 'w', base: 'e' },
  ㅛ: { glide: 'y', base: 'o' }, ㅜ: { glide: '', base: 'u' }, ㅝ: { glide: 'w', base: 'eo' }, ㅞ: { glide: 'w', base: 'e' },
  ㅟ: { glide: 'w', base: 'i' }, ㅠ: { glide: 'y', base: 'u' }, ㅡ: { glide: '', base: 'eu' }, ㅢ: { glide: '', base: 'ui' },
  ㅣ: { glide: '', base: 'i' },
};
/** Consonants that form a true Thai cluster with ว (กว คว ขว). */
const W_CLUSTER = new Set(['ก', 'ค']);

function applyTpl(tpl: string, cons: string, fin: string): string {
  return tpl.replace('C', cons).replace('F', fin);
}

/** Lenis stops are voiced between voiced sounds (아버지 → อาบอจี, 합니다 → ฮัมนีดา). */
const TH_VOICED: Record<string, string> = { ㄱ: 'ก', ㄷ: 'ด', ㅂ: 'บ', ㅈ: 'จ' };

function thaiSyllable(initial: string, medial: string, final: string, voiced: boolean): string {
  const v = VOWELS[medial];
  const tpl = BASE_VOWEL[v.base];
  const fin = final ? TH_FINAL[final] ?? '' : '';
  const t = fin ? tpl[1] : tpl[0];
  const nullInitial = initial === 'ㅇ';
  const c = (voiced && TH_VOICED[initial]) || TH_INITIAL[initial];
  if (!v.glide) return applyTpl(t, c, fin);
  const g = v.glide === 'w' ? 'ว' : 'ย';
  if (nullInitial) return applyTpl(t, g, fin);
  if (v.glide === 'w' && W_CLUSTER.has(c)) return applyTpl(t, c + g, fin);
  // Non-cluster: write the consonant, then the glide syllable (e.g. 려 → รยอ, 돼 → ทแว)
  return c + applyTpl(t, g, fin);
}

export function thaiReading(text: string): string {
  const pron = pronounce(text, { tensification: true }).text;
  let out = '';
  let prevFinal: string | null = null; // null = word start
  for (const ch of pron) {
    if (!isHangulSyllable(ch)) {
      out += ch;
      prevFinal = null;
      continue;
    }
    const d = decompose(ch)!;
    const voiced = prevFinal !== null && ['', 'ㄴ', 'ㄹ', 'ㅁ', 'ㅇ'].includes(prevFinal);
    out += thaiSyllable(d.initial, d.medial, d.final, voiced);
    prevFinal = d.final;
  }
  return out;
}
