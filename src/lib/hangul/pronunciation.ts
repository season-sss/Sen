/**
 * Rule-based Korean pronunciation (표준 발음) for common sound changes.
 *
 * Implemented rules (each reported back so lessons can explain *why*):
 *  - 연음 (liaison), including complex finals (앉아 → [안자])
 *  - ㅎ 탈락 / 격음화 (aspiration: 좋다 → [조타], 축하 → [추카])
 *  - 받침 대표음 (final neutralisation: 꽃 → [꼳])
 *  - 비음화 (nasalisation: 합니다 → [함니다], 먹는 → [멍는])
 *  - ㄹ의 비음화 (음료 → [음뇨], 국립 → [궁닙])
 *  - 유음화 (신라 → [실라], 설날 → [설랄])
 *  - 경음화 after obstruents (학교 → [학꾜])
 *  - 구개음화 (같이 → [가치])
 *  - 자음 + ㅢ → ㅣ (희망 → [히망])
 *
 * Not modelled (needs a dictionary): compound-noun tensing such as 물고기 [물꼬기],
 * ㄴ-insertion (꽃잎 [꼰닙]) and tensing after the ㄹ-modifier across a space (할 거예요 [할 꺼예요]).
 * Vocabulary entries can override with an explicit `pron` value for such words.
 */
import { COMPLEX_FINALS, decompose, isHangulSyllable } from './jamo';

export type SoundRule =
  | 'liaison'
  | 'h-drop'
  | 'aspiration'
  | 'neutralization'
  | 'nasalization'
  | 'r-nasalization'
  | 'lateralization'
  | 'tensification'
  | 'palatalization'
  | 'ui-simplification';

export const SOUND_RULE_INFO: Record<SoundRule, { ko: string; th: string }> = {
  liaison: { ko: '연음', th: 'การเชื่อมเสียง: ตัวสะกดย้ายไปเป็นเสียงต้นของพยางค์ถัดไปที่ขึ้นต้นด้วย ㅇ' },
  'h-drop': { ko: 'ㅎ 탈락', th: 'ㅎ ตัวสะกดหายไปเมื่อตามด้วยสระ' },
  aspiration: { ko: '격음화', th: 'ㄱ ㄷ ㅂ ㅈ เจอ ㅎ กลายเป็นเสียงพ่นลม ㅋ ㅌ ㅍ ㅊ' },
  neutralization: { ko: '받침 대표음', th: 'ตัวสะกดออกเสียงได้เพียง 7 เสียง: ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ' },
  nasalization: { ko: '비음화', th: 'ตัวสะกด ㄱ ㄷ ㅂ เจอ ㄴ หรือ ㅁ กลายเป็นเสียงนาสิก ㅇ ㄴ ㅁ' },
  'r-nasalization': { ko: 'ㄹ의 비음화', th: 'ㄹ ที่ตามหลัง ㅁ ㅇ ㄱ ㅂ ออกเสียงเป็น ㄴ' },
  lateralization: { ko: '유음화', th: 'ㄴ กับ ㄹ อยู่ติดกันออกเสียงเป็น ㄹㄹ' },
  tensification: { ko: '경음화', th: 'หลังตัวสะกด ㄱ ㄷ ㅂ เสียง ㄱ ㄷ ㅂ ㅅ ㅈ กลายเป็นเสียงหนัก ㄲ ㄸ ㅃ ㅆ ㅉ' },
  palatalization: { ko: '구개음화', th: 'ตัวสะกด ㄷ ㅌ เจอ 이 ออกเสียงเป็น 지 치' },
  'ui-simplification': { ko: 'ㅢ → ㅣ', th: 'ㅢ หลังพยัญชนะออกเสียงเป็น ㅣ' },
};

interface Syl {
  i: string;
  m: string;
  f: string;
}

const NEUTRAL: Record<string, string> = {
  ㄱ: 'ㄱ', ㄲ: 'ㄱ', ㅋ: 'ㄱ', ㄳ: 'ㄱ', ㄺ: 'ㄱ',
  ㄴ: 'ㄴ', ㄵ: 'ㄴ', ㄶ: 'ㄴ',
  ㄷ: 'ㄷ', ㅅ: 'ㄷ', ㅆ: 'ㄷ', ㅈ: 'ㄷ', ㅊ: 'ㄷ', ㅌ: 'ㄷ', ㅎ: 'ㄷ',
  ㄹ: 'ㄹ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㅀ: 'ㄹ',
  ㅁ: 'ㅁ', ㄻ: 'ㅁ',
  ㅂ: 'ㅂ', ㅍ: 'ㅂ', ㅄ: 'ㅂ', ㄿ: 'ㅂ',
  ㅇ: 'ㅇ',
};

const ASPIRATE: Record<string, string> = { ㄱ: 'ㅋ', ㄷ: 'ㅌ', ㅂ: 'ㅍ', ㅈ: 'ㅊ' };
const TENSE: Record<string, string> = { ㄱ: 'ㄲ', ㄷ: 'ㄸ', ㅂ: 'ㅃ', ㅅ: 'ㅆ', ㅈ: 'ㅉ' };
const NASAL: Record<string, string> = { ㄱ: 'ㅇ', ㄷ: 'ㄴ', ㅂ: 'ㅁ' };

/** Final + following ㅎ → (remaining final, aspirated initial) */
const BEFORE_H: Record<string, [string, string]> = {
  ㄱ: ['', 'ㅋ'], ㄲ: ['', 'ㅋ'], ㅋ: ['', 'ㅋ'],
  ㄷ: ['', 'ㅌ'], ㅅ: ['', 'ㅌ'], ㅆ: ['', 'ㅌ'], ㅌ: ['', 'ㅌ'],
  ㅈ: ['', 'ㅊ'], ㅊ: ['', 'ㅊ'],
  ㅂ: ['', 'ㅍ'], ㅍ: ['', 'ㅍ'],
  ㄺ: ['ㄹ', 'ㅋ'], ㄼ: ['ㄹ', 'ㅍ'], ㄵ: ['ㄴ', 'ㅊ'],
};

const OBSTRUENT = new Set(['ㄱ', 'ㄷ', 'ㅂ']);

export interface PronunciationResult {
  text: string;
  rules: SoundRule[];
}

function toSyls(word: string): (Syl | string)[] {
  return [...word].map((ch) => {
    const d = decompose(ch);
    return d ? { i: d.initial, m: d.medial, f: d.final } : ch;
  });
}

function fromSyls(syls: (Syl | string)[]): string {
  const INI = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const MED = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const FIN = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  return syls
    .map((s) =>
      typeof s === 'string'
        ? s
        : String.fromCharCode(0xac00 + (INI.indexOf(s.i) * 21 + MED.indexOf(s.m)) * 28 + FIN.indexOf(s.f)),
    )
    .join('');
}

export interface PronounceOptions {
  /** Revised Romanization does not write tensification, so romanizers turn this off. */
  tensification?: boolean;
}

/** Pronounce one space-free word. */
function pronounceWord(word: string, opts: Required<PronounceOptions>, rules: Set<SoundRule>): string {
  const syls = toSyls(word);
  for (let k = 0; k < syls.length; k++) {
    const cur = syls[k];
    if (typeof cur === 'string') continue;

    // 자음 + ㅢ → ㅣ (but not for initial ㅇ: 의사 keeps ㅢ)
    if (cur.m === 'ㅢ' && cur.i !== 'ㅇ') {
      cur.m = 'ㅣ';
      rules.add('ui-simplification');
    }

    const nextRaw = syls[k + 1];
    const next = typeof nextRaw === 'object' ? nextRaw : null;
    const F = cur.f;
    if (!F) continue;

    if (!next) {
      const n = NEUTRAL[F] ?? F;
      if (n !== F) rules.add('neutralization');
      cur.f = n;
      continue;
    }

    // --- ㅎ-final rules -------------------------------------------------
    if (F === 'ㅎ' || F === 'ㄶ' || F === 'ㅀ') {
      const keep = F === 'ㅎ' ? '' : F === 'ㄶ' ? 'ㄴ' : 'ㄹ';
      if (ASPIRATE[next.i] && next.i !== 'ㅂ') {
        next.i = ASPIRATE[next.i];
        cur.f = keep;
        rules.add('aspiration');
        continue;
      }
      if (next.i === 'ㅅ') {
        next.i = 'ㅆ';
        cur.f = keep;
        rules.add('tensification');
        continue;
      }
      if (next.i === 'ㄴ') {
        cur.f = keep || 'ㄴ';
        if (keep === 'ㄹ') {
          next.i = 'ㄹ';
          rules.add('lateralization');
        } else {
          rules.add('nasalization');
        }
        continue;
      }
      if (next.i === 'ㅇ') {
        cur.f = keep;
        rules.add('h-drop');
        if (keep) {
          next.i = keep;
          cur.f = '';
          rules.add('liaison');
        }
        continue;
      }
    }

    // --- aspiration with following ㅎ ---------------------------------------
    if (next.i === 'ㅎ' && BEFORE_H[F]) {
      const [keep, asp] = BEFORE_H[F];
      cur.f = keep;
      next.i = asp;
      rules.add('aspiration');
      continue;
    }

    // --- liaison --------------------------------------------------------------
    if (next.i === 'ㅇ' && F !== 'ㅇ') {
      const complex = COMPLEX_FINALS[F];
      let moving = complex ? complex[1] : F;
      cur.f = complex ? complex[0] : '';
      if (next.m === 'ㅣ' && (moving === 'ㄷ' || moving === 'ㅌ')) {
        moving = moving === 'ㄷ' ? 'ㅈ' : 'ㅊ';
        rules.add('palatalization');
      }
      next.i = moving;
      rules.add('liaison');
      // 없어 → 업써 : remaining obstruent final tenses the moved ㅅ
      if (cur.f && OBSTRUENT.has(NEUTRAL[cur.f] ?? '') && TENSE[next.i] && opts.tensification) {
        next.i = TENSE[next.i];
        rules.add('tensification');
      }
      continue;
    }

    // --- neutralisation ---------------------------------------------------
    let n = NEUTRAL[F] ?? F;
    if (F === 'ㄺ' && next.i === 'ㄱ') n = 'ㄹ'; // 읽고 [일꼬]
    if (F === 'ㄼ' && word.startsWith('밟')) n = 'ㅂ'; // 밟다 [밥따]
    if (n !== F) rules.add('neutralization');
    const stemTense = ['ㄵ', 'ㄻ', 'ㄼ', 'ㄾ'].includes(F) && TENSE[next.i]; // 앉다 [안따], 젊다 [점따], 짧다 [짤따]
    const lFromComplex = F === 'ㄺ' && next.i === 'ㄱ';
    cur.f = n;

    // --- nasalisation ---------------------------------------------------
    if (NASAL[n] && (next.i === 'ㄴ' || next.i === 'ㅁ')) {
      cur.f = NASAL[n];
      rules.add('nasalization');
      continue;
    }
    // --- ㄹ after non-ㄹ consonants ------------------------------------------
    if (next.i === 'ㄹ' && n !== 'ㄹ') {
      if (n === 'ㄴ') {
        cur.f = 'ㄹ';
        rules.add('lateralization');
        continue;
      }
      next.i = 'ㄴ';
      rules.add('r-nasalization');
      if (NASAL[n]) {
        cur.f = NASAL[n];
        rules.add('nasalization');
      }
      continue;
    }
    if (n === 'ㄹ' && next.i === 'ㄴ') {
      next.i = 'ㄹ';
      rules.add('lateralization');
      continue;
    }
    // --- tensification ------------------------------------------------------
    if (opts.tensification && TENSE[next.i] && (OBSTRUENT.has(n) || stemTense || lFromComplex)) {
      next.i = TENSE[next.i];
      rules.add('tensification');
    }
  }
  return fromSyls(syls);
}

export function pronounce(text: string, options: PronounceOptions = {}): PronunciationResult {
  const opts: Required<PronounceOptions> = { tensification: true, ...options };
  const rules = new Set<SoundRule>();
  const out = text
    .split(/(\s+)/)
    .map((chunk) => (/\s/.test(chunk) || !chunk ? chunk : pronounceSegmented(chunk, opts, rules)))
    .join('');
  return { text: out, rules: [...rules] };
}

/** Punctuation splits words but stays in place. */
function pronounceSegmented(chunk: string, opts: Required<PronounceOptions>, rules: Set<SoundRule>): string {
  let out = '';
  let buf = '';
  for (const ch of chunk) {
    if (isHangulSyllable(ch)) {
      buf += ch;
    } else {
      if (buf) out += pronounceWord(buf, opts, rules);
      buf = '';
      out += ch;
    }
  }
  if (buf) out += pronounceWord(buf, opts, rules);
  return out;
}
