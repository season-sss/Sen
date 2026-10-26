/**
 * Catalog of conjugated forms. Each form is built from the primitives — never from a
 * hard-coded table — so every predicate in the lexicon gets correct forms automatically.
 */
import { aeoBase, attachDirect, attachEu, attachFormal, pastStem, plainPresent, type StemCtx } from './primitives';

export type FormGroup =
  | 'polite'
  | 'formal'
  | 'casual'
  | 'plain'
  | 'negative'
  | 'connective'
  | 'desire'
  | 'request'
  | 'ability'
  | 'experience'
  | 'future'
  | 'modifier'
  | 'honorific'
  | 'aspect'
  | 'quotation'
  | 'conjecture'
  | 'advanced';

export const GROUP_LABEL: Record<FormGroup, string> = {
  polite: 'สุภาพ (해요체)',
  formal: 'ทางการ (합쇼체)',
  casual: 'กันเอง (반말)',
  plain: 'ภาษาเขียน (한다체)',
  negative: 'ปฏิเสธ',
  connective: 'เชื่อมประโยค',
  desire: 'ความต้องการ / ความตั้งใจ',
  request: 'ขอร้อง / ชักชวน',
  ability: 'ความสามารถ / อนุญาต / หน้าที่',
  experience: 'ประสบการณ์ / ลองทำ',
  future: 'อนาคต / คาดการณ์',
  modifier: 'ขยายคำนาม (관형형)',
  honorific: 'ยกย่อง (높임)',
  aspect: 'กำลังทำ / สภาพ / การเปลี่ยนแปลง',
  quotation: 'อ้างคำพูด (간접 화법)',
  conjecture: 'คาดเดา',
  advanced: 'ระดับสูง',
};

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'ADV';

export interface FormDef {
  key: string;
  /** Pattern as taught, e.g. -(으)세요 */
  pattern: string;
  th: string;
  group: FormGroup;
  level: CefrLevel;
  appliesTo: 'verb' | 'adjective' | 'both';
  build: (ctx: StemCtx, trace: string[]) => string;
}

const isVerbLike = (ctx: StemCtx) => ctx.pos === 'verb' || ctx.existence;

export const FORMS: FormDef[] = [
  // ---- polite ---------------------------------------------------------------
  { key: 'present', pattern: '-아/어요', th: 'ปัจจุบัน (สุภาพ)', group: 'polite', level: 'A1', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '요' },
  { key: 'past', pattern: '-았/었어요', th: 'อดีต (สุภาพ)', group: 'polite', level: 'A1', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '어요' },
  { key: 'question', pattern: '-아/어요?', th: 'คำถาม (สุภาพ)', group: 'polite', level: 'A1', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '요?' },
  // ---- formal ---------------------------------------------------------------
  { key: 'formal', pattern: '-(스)ㅂ니다', th: 'ทางการ ปัจจุบัน', group: 'formal', level: 'A1', appliesTo: 'both', build: (c, t) => attachFormal(c, false, t) },
  { key: 'formalQuestion', pattern: '-(스)ㅂ니까?', th: 'ทางการ คำถาม', group: 'formal', level: 'A1', appliesTo: 'both', build: (c, t) => attachFormal(c, true, t) },
  { key: 'formalPast', pattern: '-았/었습니다', th: 'ทางการ อดีต', group: 'formal', level: 'A2', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '습니다' },
  { key: 'formalFuture', pattern: '-(으)ㄹ 겁니다', th: 'ทางการ อนาคต', group: 'formal', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄹ 겁니다', t) },
  // ---- casual ---------------------------------------------------------------
  { key: 'casual', pattern: '-아/어', th: 'กันเอง ปัจจุบัน', group: 'casual', level: 'A2', appliesTo: 'both', build: (c, t) => aeoBase(c, t) },
  { key: 'casualPast', pattern: '-았/었어', th: 'กันเอง อดีต', group: 'casual', level: 'A2', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '어' },
  // ---- plain ----------------------------------------------------------------
  { key: 'plain', pattern: '-(느)ㄴ다 / -다', th: 'ภาษาเขียน ปัจจุบัน', group: 'plain', level: 'B1', appliesTo: 'both', build: (c, t) => plainPresent(c, t) },
  { key: 'plainPast', pattern: '-았/었다', th: 'ภาษาเขียน อดีต', group: 'plain', level: 'B1', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '다' },
  // ---- negative ---------------------------------------------------------------
  { key: 'negLong', pattern: '-지 않아요', th: 'ปฏิเสธแบบยาว', group: 'negative', level: 'A1', appliesTo: 'both', build: (c, t) => attachDirect(c, '지 않아요', t) },
  { key: 'negMotLong', pattern: '-지 못해요', th: 'ทำไม่ได้ (แบบยาว)', group: 'negative', level: 'A2', appliesTo: 'verb', build: (c, t) => attachDirect(c, '지 못해요', t) },
  { key: 'prohibit', pattern: '-지 마세요', th: 'อย่า…', group: 'negative', level: 'A2', appliesTo: 'verb', build: (c, t) => attachDirect(c, '지 마세요', t) },
  // ---- connective ---------------------------------------------------------------
  { key: 'and', pattern: '-고', th: 'และ / แล้วก็', group: 'connective', level: 'A1', appliesTo: 'both', build: (c, t) => attachDirect(c, '고', t) },
  { key: 'so', pattern: '-아/어서', th: 'เพราะ… จึง / …แล้ว (ลำดับ)', group: 'connective', level: 'A1', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '서' },
  { key: 'but', pattern: '-지만', th: 'แต่', group: 'connective', level: 'A1', appliesTo: 'both', build: (c, t) => attachDirect(c, '지만', t) },
  { key: 'because', pattern: '-(으)니까', th: 'เพราะว่า (ใช้กับคำสั่ง/ชักชวนได้)', group: 'connective', level: 'A1', appliesTo: 'both', build: (c, t) => attachEu(c, '니까', t) },
  { key: 'if', pattern: '-(으)면', th: 'ถ้า', group: 'connective', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, '면', t) },
  { key: 'while', pattern: '-(으)면서', th: 'ในขณะที่ (ทำพร้อมกัน)', group: 'connective', level: 'B1', appliesTo: 'both', build: (c, t) => attachEu(c, '면서', t) },
  { key: 'even', pattern: '-아/어도', th: 'ถึงแม้ว่า', group: 'connective', level: 'A2', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '도' },
  { key: 'when', pattern: '-(으)ㄹ 때', th: 'เมื่อ / ตอนที่', group: 'connective', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ 때', t) },
  { key: 'before', pattern: '-기 전에', th: 'ก่อนที่จะ', group: 'connective', level: 'A2', appliesTo: 'verb', build: (c, t) => attachDirect(c, '기 전에', t) },
  { key: 'after', pattern: '-(으)ㄴ 후에', th: 'หลังจากที่', group: 'connective', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄴ 후에', t) },
  { key: 'or', pattern: '-거나', th: 'หรือ', group: 'connective', level: 'A2', appliesTo: 'both', build: (c, t) => attachDirect(c, '거나', t) },
  {
    key: 'background', pattern: '-(으)ㄴ/는데', th: 'ให้ข้อมูลพื้นหลัง / แต่ว่า', group: 'connective', level: 'B1', appliesTo: 'both',
    build: (c, t) => (isVerbLike(c) ? attachDirect(c, '는데', t) : attachEu(c, 'ㄴ데', t)),
  },
  { key: 'purpose', pattern: '-(으)려고', th: 'เพื่อจะ', group: 'connective', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, '려고', t) },
  // ---- desire / intention --------------------------------------------------------
  { key: 'want', pattern: '-고 싶어요', th: 'อยาก…', group: 'desire', level: 'A1', appliesTo: 'verb', build: (c, t) => attachDirect(c, '고 싶어요', t) },
  { key: 'intend', pattern: '-(으)려고 해요', th: 'ตั้งใจจะ…', group: 'desire', level: 'B1', appliesTo: 'verb', build: (c, t) => attachEu(c, '려고 해요', t) },
  { key: 'promise', pattern: '-(으)ㄹ게요', th: 'จะ… (สัญญา/ตัดสินใจ)', group: 'desire', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄹ게요', t) },
  // ---- request / suggestion ----------------------------------------------------
  { key: 'request', pattern: '-(으)세요', th: 'กรุณา… / เชิญ…', group: 'request', level: 'A1', appliesTo: 'verb', build: (c, t) => attachEu(c, '세요', t) },
  { key: 'formalRequest', pattern: '-(으)십시오', th: 'กรุณา… (ทางการ)', group: 'request', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, '십시오', t) },
  { key: 'pleaseDo', pattern: '-아/어 주세요', th: 'ช่วย…ให้หน่อย', group: 'request', level: 'A1', appliesTo: 'verb', build: (c, t) => aeoBase(c, t) + ' 주세요' },
  { key: 'letsFormal', pattern: '-(으)ㅂ시다', th: '…กันเถอะ (ทางการ)', group: 'request', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㅂ시다', t) },
  { key: 'shallWe', pattern: '-(으)ㄹ까요?', th: '…กันไหม / …ดีไหม', group: 'request', level: 'A1', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ까요?', t) },
  // ---- ability / permission / obligation -------------------------------------------
  { key: 'can', pattern: '-(으)ㄹ 수 있어요', th: 'สามารถ… ได้', group: 'ability', level: 'A1', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄹ 수 있어요', t) },
  { key: 'cannot', pattern: '-(으)ㄹ 수 없어요', th: '… ไม่ได้', group: 'ability', level: 'A1', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄹ 수 없어요', t) },
  { key: 'knowHow', pattern: '-(으)ㄹ 줄 알아요', th: 'รู้วิธี / ทำเป็น', group: 'ability', level: 'A1', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄹ 줄 알아요', t) },
  { key: 'mustDo', pattern: '-아/어야 해요', th: 'ต้อง…', group: 'ability', level: 'A2', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '야 해요' },
  { key: 'mayDo', pattern: '-아/어도 돼요', th: '… ได้ (อนุญาต)', group: 'ability', level: 'A2', appliesTo: 'both', build: (c, t) => aeoBase(c, t) + '도 돼요' },
  { key: 'mustNot', pattern: '-(으)면 안 돼요', th: 'ห้าม… / … ไม่ได้', group: 'ability', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, '면 안 돼요', t) },
  // ---- experience -------------------------------------------------------------
  { key: 'tried', pattern: '-아/어 봤어요', th: 'เคยลอง…', group: 'experience', level: 'A1', appliesTo: 'verb', build: (c, t) => aeoBase(c, t) + ' 봤어요' },
  { key: 'tryDo', pattern: '-아/어 보세요', th: 'ลอง… ดูสิ', group: 'experience', level: 'A2', appliesTo: 'verb', build: (c, t) => aeoBase(c, t) + ' 보세요' },
  { key: 'haveDone', pattern: '-(으)ㄴ 적이 있어요', th: 'เคย…', group: 'experience', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄴ 적이 있어요', t) },
  { key: 'haveTried', pattern: '-아/어 본 적이 있어요', th: 'เคยลอง…', group: 'experience', level: 'A2', appliesTo: 'verb', build: (c, t) => aeoBase(c, t) + ' 본 적이 있어요' },
  // ---- future / conjecture ------------------------------------------------------
  { key: 'future', pattern: '-(으)ㄹ 거예요', th: 'จะ… (อนาคต/คาดว่า)', group: 'future', level: 'A1', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ 거예요', t) },
  { key: 'will', pattern: '-겠어요', th: 'จะ… / คงจะ…', group: 'future', level: 'A2', appliesTo: 'both', build: (c, t) => attachDirect(c, '겠어요', t) },
  {
    key: 'seems', pattern: '-(으)ㄴ/는 것 같아요', th: 'ดูเหมือนว่า… (ปัจจุบัน)', group: 'conjecture', level: 'B1', appliesTo: 'both',
    build: (c, t) => (isVerbLike(c) ? attachDirect(c, '는 것 같아요', t) : attachEu(c, 'ㄴ 것 같아요', t)),
  },
  { key: 'seemsPast', pattern: '-(으)ㄴ 것 같아요', th: 'ดูเหมือนว่า… แล้ว (อดีต)', group: 'conjecture', level: 'B1', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄴ 것 같아요', t) },
  { key: 'seemsFuture', pattern: '-(으)ㄹ 것 같아요', th: 'น่าจะ… (คาดการณ์)', group: 'conjecture', level: 'B1', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ 것 같아요', t) },
  // ---- modifiers ----------------------------------------------------------------
  {
    key: 'modPresent', pattern: '-는 / -(으)ㄴ', th: 'ขยายคำนาม ปัจจุบัน', group: 'modifier', level: 'A2', appliesTo: 'both',
    build: (c, t) => (isVerbLike(c) ? attachDirect(c, '는', t) : attachEu(c, 'ㄴ', t)),
  },
  { key: 'modPast', pattern: '-(으)ㄴ', th: 'ขยายคำนาม อดีต (คำกริยา)', group: 'modifier', level: 'A2', appliesTo: 'verb', build: (c, t) => attachEu(c, 'ㄴ', t) },
  { key: 'modFuture', pattern: '-(으)ㄹ', th: 'ขยายคำนาม อนาคต', group: 'modifier', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ', t) },
  { key: 'modRetro', pattern: '-았/었던', th: 'ที่เคย… (ระลึกถึงอดีต)', group: 'modifier', level: 'B2', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '던' },
  { key: 'nominal', pattern: '-기', th: 'ทำให้เป็นคำนาม (การ…)', group: 'modifier', level: 'A2', appliesTo: 'both', build: (c, t) => attachDirect(c, '기', t) },
  // ---- honorific ----------------------------------------------------------------
  { key: 'honPresent', pattern: '-(으)세요', th: 'ยกย่องประธาน ปัจจุบัน', group: 'honorific', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, '세요', t) },
  { key: 'honPast', pattern: '-(으)셨어요', th: 'ยกย่องประธาน อดีต', group: 'honorific', level: 'A2', appliesTo: 'both', build: (c, t) => attachEu(c, '셨어요', t) },
  { key: 'honFormal', pattern: '-(으)십니다', th: 'ยกย่อง ทางการ', group: 'honorific', level: 'B1', appliesTo: 'both', build: (c, t) => attachEu(c, '십니다', t) },
  // ---- aspect ------------------------------------------------------------------
  { key: 'progressive', pattern: '-고 있어요', th: 'กำลัง…', group: 'aspect', level: 'A2', appliesTo: 'verb', build: (c, t) => attachDirect(c, '고 있어요', t) },
  { key: 'state', pattern: '-아/어 있어요', th: 'อยู่ในสภาพ… (ผลของการกระทำ)', group: 'aspect', level: 'B1', appliesTo: 'verb', build: (c, t) => aeoBase(c, t) + ' 있어요' },
  { key: 'become', pattern: '-아/어지다', th: 'กลายเป็น… (คำคุณศัพท์)', group: 'aspect', level: 'B1', appliesTo: 'adjective', build: (c, t) => aeoBase(c, t) + '져요' },
  { key: 'endUp', pattern: '-게 되다', th: 'ได้… / กลายเป็นว่า…', group: 'aspect', level: 'B1', appliesTo: 'both', build: (c, t) => attachDirect(c, '게 됐어요', t) },
  { key: 'make', pattern: '-게 하다', th: 'ทำให้… / ให้…', group: 'aspect', level: 'B1', appliesTo: 'both', build: (c, t) => attachDirect(c, '게 해요', t) },
  // ---- quotation ----------------------------------------------------------------
  { key: 'quoteStatement', pattern: '-(느)ㄴ다고 해요 / -다고 해요', th: 'ได้ยินว่า / เขาบอกว่า…', group: 'quotation', level: 'B1', appliesTo: 'both', build: (c, t) => plainPresent(c, t) + '고 해요' },
  { key: 'quotePast', pattern: '-았/었다고 해요', th: 'เขาบอกว่า… แล้ว', group: 'quotation', level: 'B1', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '다고 해요' },
  { key: 'quoteQuestion', pattern: '-냐고 해요', th: 'เขาถามว่า…', group: 'quotation', level: 'B1', appliesTo: 'both', build: (c, t) => attachDirect(c, '냐고 해요', t) },
  { key: 'quoteSuggest', pattern: '-자고 해요', th: 'เขาชวนว่า…กันเถอะ', group: 'quotation', level: 'B1', appliesTo: 'verb', build: (c, t) => attachDirect(c, '자고 해요', t) },
  { key: 'quoteCommand', pattern: '-(으)라고 해요', th: 'เขาบอกให้…', group: 'quotation', level: 'B1', appliesTo: 'verb', build: (c, t) => attachEu(c, '라고 해요', t) },
  // ---- advanced ----------------------------------------------------------------
  { key: 'evenIf', pattern: '-더라도', th: 'ถึงแม้ว่าจะ…ก็ตาม', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => attachDirect(c, '더라도', t) },
  { key: 'theMore', pattern: '-(으)ㄹ수록', th: 'ยิ่ง… ยิ่ง…', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ수록', t) },
  { key: 'notOnly', pattern: '-(으)ㄹ 뿐만 아니라', th: 'ไม่เพียงแต่… เท่านั้น', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => attachEu(c, 'ㄹ 뿐만 아니라', t) },
  {
    key: 'whereas', pattern: '-(으)ㄴ/는 반면에', th: 'ในทางกลับกัน', group: 'advanced', level: 'B2', appliesTo: 'both',
    build: (c, t) => (isVerbLike(c) ? attachDirect(c, '는 반면에', t) : attachEu(c, 'ㄴ 반면에', t)),
  },
  { key: 'admittedly', pattern: '-기는 하지만', th: '…ก็จริง แต่', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => attachDirect(c, '기는 하지만', t) },
  { key: 'ifHadPast', pattern: '-았/었더라면', th: 'ถ้าตอนนั้น… (สมมติย้อนอดีต)', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => pastStem(c, t) + '더라면' },
  { key: 'bound', pattern: '-게 마련이다', th: 'ย่อมจะ… เป็นธรรมดา', group: 'advanced', level: 'B2', appliesTo: 'both', build: (c, t) => attachDirect(c, '게 마련이에요', t) },
];

export const FORM_BY_KEY: Record<string, FormDef> = Object.fromEntries(FORMS.map((f) => [f.key, f]));
