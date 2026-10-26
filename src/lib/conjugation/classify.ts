/**
 * Stem classification for the conjugation engine.
 *
 * Several stem shapes are genuinely ambiguous in Korean (듣다 → 들어요 but 받다 → 받아요),
 * so classification for those shapes comes from an explicit, reviewed list. A stem whose shape
 * is ambiguous and is not on the list is reported as `uncertain` rather than guessed silently.
 */
import { decompose, finalOf, lastChar } from '../hangul/jamo';

export type PartOfSpeech = 'verb' | 'adjective';

export type IrregularClass =
  | 'regular'
  | 'hada' // 하다 → 해
  | 'eu' // ㅡ 탈락: 쓰다 → 써
  | 'l' // ㄹ 탈락: 만들다 → 만드세요 / 만듭니다
  | 'd' // ㄷ 불규칙: 듣다 → 들어
  | 'b' // ㅂ 불규칙: 춥다 → 추워
  | 'b-o' // ㅂ 불규칙 (돕다/곱다): 도와
  | 'reu' // 르 불규칙: 모르다 → 몰라
  | 'reo' // 러 불규칙: 이르다 → 이르러
  | 's' // ㅅ 불규칙: 짓다 → 지어
  | 'h' // ㅎ 불규칙: 빨갛다 → 빨개
  | 'u'; // 우 불규칙: 푸다 → 퍼

export type Confidence = 'verified' | 'inferred' | 'uncertain';

export interface Classification {
  irregular: IrregularClass;
  confidence: Confidence;
  note?: string;
}

/** Reviewed lists for ambiguous stem shapes. Keys are dictionary forms. */
const D_IRREGULAR = new Set(['듣다', '걷다', '묻다', '싣다', '깨닫다', '붇다', '일컫다', '긷다', '알아듣다', '엿듣다', '받아듣다']);
const D_REGULAR = new Set(['받다', '닫다', '믿다', '얻다', '쏟다', '뜯다', '돋다', '굳다', '곧다', '묻히다', '파묻다', '내딛다', '걷히다', '본받다']);

const B_IRREGULAR_O = new Set(['돕다', '곱다']);
const B_IRREGULAR = new Set([
  '춥다', '덥다', '쉽다', '어렵다', '가깝다', '무겁다', '가볍다', '맵다', '귀엽다', '아름답다', '반갑다', '고맙다',
  '즐겁다', '외롭다', '부럽다', '새롭다', '시끄럽다', '부드럽다', '더럽다', '두껍다', '차갑다', '뜨겁다', '싱겁다',
  '눕다', '굽다', '줍다', '밉다', '무섭다', '아깝다', '간지럽다', '그립다', '괴롭다', '가렵다', '서럽다', '날카롭다', '부끄럽다', '어둡다', '아쉽다', '어지럽다',
  '사납다', '까다롭다', '번거롭다', '해롭다', '이롭다', '안타깝다', '답답하다', '미덥다', '우습다', '징그럽다', '어지럽다',
]);
const B_REGULAR = new Set(['입다', '잡다', '좁다', '씹다', '뽑다', '업다', '접다', '집다', '수줍다', '꼽다', '붙잡다', '굽히다', '갈아입다', '뒤집다']);

const S_IRREGULAR = new Set(['짓다', '낫다', '붓다', '긋다', '잇다', '젓다']);
const S_REGULAR = new Set(['웃다', '씻다', '벗다', '빼앗다', '솟다', '빗다', '앗다']);

const REU_EU = new Set(['따르다', '치르다', '들르다', '우러르다', '다다르다']);
const REU_REO = new Set(['푸르다']);

const H_IRREGULAR = new Set(['빨갛다', '파랗다', '노랗다', '하얗다', '까맣다', '동그랗다', '그렇다', '어떻다', '이렇다', '저렇다', '커다랗다', '조그맣다', '말갛다', '누렇다', '시퍼렇다', '새빨갛다']);
const H_REGULAR = new Set(['좋다', '놓다', '넣다', '낳다', '닿다', '쌓다', '찧다', '빻다', '내놓다', '내려놓다']);

/** Words whose meaning differs by conjugation class. */
export const HOMOGRAPH_NOTES: Record<string, string> = {
  묻다: '묻다 (ถาม) เป็น ㄷ 불규칙 → 물어요 แต่ 묻다 (ฝัง) เป็นคำปกติ → 묻어요',
  걷다: '걷다 (เดิน) เป็น ㄷ 불규칙 → 걸어요 แต่ 걷다 (ม้วน/เก็บ) เป็นคำปกติ → 걷어요',
  굽다: '굽다 (ย่าง/อบ) เป็น ㅂ 불규칙 → 구워요 แต่ 굽다 (โค้ง) เป็นคำปกติ → 굽어요',
  이르다: '이르다 (ถึง/ไปถึง) เป็น 러 불규칙 → 이르러요 แต่ 이르다 (บอก/เร็ว) เป็น 르 불규칙 → 일러요',
};

export function stemOf(dictionaryForm: string): string {
  return dictionaryForm.endsWith('다') ? dictionaryForm.slice(0, -1) : dictionaryForm;
}

export function classify(dictionaryForm: string, pos: PartOfSpeech): Classification {
  const stem = stemOf(dictionaryForm);
  const last = lastChar(stem);
  const syl = decompose(last);
  const fin = finalOf(stem);
  const note = HOMOGRAPH_NOTES[dictionaryForm];

  if (!syl) return { irregular: 'regular', confidence: 'uncertain', note: 'ไม่ใช่คำภาษาเกาหลีที่ระบบรู้จัก' };

  if (stem.endsWith('하')) return { irregular: 'hada', confidence: 'verified', note };
  if (dictionaryForm === '푸다') return { irregular: 'u', confidence: 'verified', note };

  if (last === '르') {
    if (REU_EU.has(dictionaryForm)) return { irregular: 'eu', confidence: 'verified', note };
    if (REU_REO.has(dictionaryForm)) return { irregular: 'reo', confidence: 'verified', note };
    // 르 불규칙 is the overwhelmingly common pattern, but exceptions exist.
    const known = ['모르다', '부르다', '빠르다', '고르다', '다르다', '자르다', '마르다', '오르다', '흐르다', '기르다', '서두르다', '누르다', '배부르다', '목마르다', '머무르다', '가르다', '짓누르다', '게으르다', '바르다', '구르다', '나르다', '조르다', '찌르다', '들어오르다', '이르다'];
    return { irregular: 'reu', confidence: known.includes(dictionaryForm) ? 'verified' : 'inferred', note };
  }

  if (!fin) {
    if (syl.medial === 'ㅡ') return { irregular: 'eu', confidence: 'verified', note };
    return { irregular: 'regular', confidence: 'verified', note };
  }

  switch (fin) {
    case 'ㄹ':
      return { irregular: 'l', confidence: 'verified', note };
    case 'ㄷ':
      if (D_IRREGULAR.has(dictionaryForm)) return { irregular: 'd', confidence: 'verified', note };
      if (D_REGULAR.has(dictionaryForm)) return { irregular: 'regular', confidence: 'verified', note };
      return { irregular: 'regular', confidence: 'uncertain', note: 'คำที่ลงท้าย ㄷ อาจผันแบบปกติ (받아요) หรือ ㄷ 불규칙 (들어요) — โปรดตรวจสอบกับพจนานุกรม' };
    case 'ㅂ':
      if (B_IRREGULAR_O.has(dictionaryForm)) return { irregular: 'b-o', confidence: 'verified', note };
      if (B_IRREGULAR.has(dictionaryForm)) return { irregular: 'b', confidence: 'verified', note };
      if (B_REGULAR.has(dictionaryForm)) return { irregular: 'regular', confidence: 'verified', note };
      if (/(스럽|롭|답)$/.test(stem)) return { irregular: 'b', confidence: 'inferred', note: 'คำคุณศัพท์ที่ลงท้าย -스럽다/-롭다/-답다 ผันแบบ ㅂ 불규칙' };
      if (pos === 'adjective') return { irregular: 'b', confidence: 'inferred', note: 'คำคุณศัพท์ที่ลงท้าย ㅂ ส่วนใหญ่เป็น ㅂ 불규칙 แต่มีข้อยกเว้น (좁다 → 좁아요)' };
      return { irregular: 'regular', confidence: 'uncertain', note: 'คำกริยาที่ลงท้าย ㅂ อาจผันแบบปกติ (입어요) หรือ ㅂ 불규칙 (누워요) — โปรดตรวจสอบ' };
    case 'ㅅ':
      if (S_IRREGULAR.has(dictionaryForm)) return { irregular: 's', confidence: 'verified', note };
      if (S_REGULAR.has(dictionaryForm)) return { irregular: 'regular', confidence: 'verified', note };
      return { irregular: 'regular', confidence: 'uncertain', note: 'คำที่ลงท้าย ㅅ อาจผันแบบปกติ (웃어요) หรือ ㅅ 불규칙 (지어요) — โปรดตรวจสอบ' };
    case 'ㅎ':
      if (H_REGULAR.has(dictionaryForm)) return { irregular: 'regular', confidence: 'verified', note };
      if (H_IRREGULAR.has(dictionaryForm)) return { irregular: 'h', confidence: 'verified', note };
      if (pos === 'adjective') return { irregular: 'h', confidence: 'inferred', note };
      return { irregular: 'regular', confidence: 'inferred', note };
    default:
      return { irregular: 'regular', confidence: 'verified', note };
  }
}

export const IRREGULAR_INFO: Record<IrregularClass, { ko: string; th: string; example: string }> = {
  regular: { ko: '규칙', th: 'ผันตามกฎปกติ', example: '먹다 → 먹어요, 가다 → 가요' },
  hada: { ko: '하다', th: 'คำที่ลงท้าย 하다: 하 + 여 → 해', example: '공부하다 → 공부해요' },
  eu: { ko: 'ㅡ 탈락', th: 'สระ ㅡ หายไปเมื่อเจอ 아/어', example: '쓰다 → 써요, 바쁘다 → 바빠요' },
  l: { ko: 'ㄹ 탈락', th: 'ㄹ ตัวสะกดหายไปเมื่อเจอ ㄴ ㅂ ㅅ และไม่เติม 으', example: '만들다 → 만드세요, 만듭니다' },
  d: { ko: 'ㄷ 불규칙', th: 'ㄷ กลายเป็น ㄹ เมื่อตามด้วยสระ', example: '듣다 → 들어요, 들으세요' },
  b: { ko: 'ㅂ 불규칙', th: 'ㅂ กลายเป็น 우 เมื่อตามด้วยสระ', example: '춥다 → 추워요, 추우면' },
  'b-o': { ko: 'ㅂ 불규칙 (오)', th: 'ㅂ กลายเป็น 오 เมื่อเจอ 아 (เฉพาะ 돕다 곱다)', example: '돕다 → 도와요, 도우면' },
  reu: { ko: '르 불규칙', th: '르 + 아/어 → ㄹ라/ㄹ러', example: '모르다 → 몰라요, 부르다 → 불러요' },
  reo: { ko: '러 불규칙', th: 'เติม 러 แทน 어', example: '푸르다 → 푸르러요' },
  s: { ko: 'ㅅ 불규칙', th: 'ㅅ หายไปเมื่อตามด้วยสระ (ไม่หดรวมสระ)', example: '짓다 → 지어요, 지으면' },
  h: { ko: 'ㅎ 불규칙', th: 'ㅎ หายไป; เมื่อเจอ 아/어 สระเปลี่ยนเป็น ㅐ', example: '빨갛다 → 빨개요, 빨간' },
  u: { ko: '우 불규칙', th: 'ㅜ หายไปเมื่อเจอ 어', example: '푸다 → 퍼요' },
};
