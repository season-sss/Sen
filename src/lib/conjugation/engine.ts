import { hasBatchim } from '../hangul/jamo';
import { classify, IRREGULAR_INFO, stemOf, type Confidence, type IrregularClass, type PartOfSpeech } from './classify';
import { FORMS, FORM_BY_KEY, type CefrLevel, type FormDef, type FormGroup } from './forms';
import { aeoBase, pastStem, type StemCtx } from './primitives';

export interface ConjugatedForm {
  key: string;
  pattern: string;
  th: string;
  group: FormGroup;
  level: CefrLevel;
  value: string | null;
  /** Why value is null, or extra usage info */
  note?: string;
  steps: string[];
}

export interface ConjugationResult {
  dictionaryForm: string;
  stem: string;
  pos: PartOfSpeech;
  irregular: IrregularClass;
  irregularLabel: string;
  irregularRule: string;
  confidence: Confidence;
  notes: string[];
  warnings: string[];
  forms: ConjugatedForm[];
}

export interface ConjugateOptions {
  pos: PartOfSpeech;
  /** Override classification (e.g. from a reviewed vocabulary entry). */
  irregular?: IrregularClass;
}

/** Lexical honorific verbs — the regular -(으)시- form exists but is not what Koreans say. */
export const LEXICAL_HONORIFIC: Record<string, string> = {
  먹다: '드시다 (드세요)',
  마시다: '드시다 (드세요)',
  자다: '주무시다 (주무세요)',
  있다: '계시다 (계세요) — เมื่อหมายถึง "อยู่" ของบุคคล',
  말하다: '말씀하시다 (말씀하세요)',
  죽다: '돌아가시다 (돌아가셨어요)',
  아프다: '편찮으시다 (편찮으세요) — เมื่อพูดถึงผู้ใหญ่ป่วย',
};

/** Words whose negation is a different word instead of 안 + verb. */
const SUPPLETIVE_NEGATION: Record<string, { word: string; reason: string }> = {
  알다: { word: '모르다', reason: '알다 ไม่ใช้กับ 안 — ใช้ 모르다 (ไม่รู้) แทน' },
  있다: { word: '없다', reason: '있다 (มี/อยู่) ใช้ 없다 แทน 안 있다' },
};

export function isExistence(dict: string): boolean {
  return /(있|없)다$/.test(dict);
}

/** 하다-verbs formed from a noun split for 안/못: 공부 안 해요, but 좋아하다 → 안 좋아해요. */
export function isSplittableHada(dict: string, pos: PartOfSpeech): boolean {
  if (pos !== 'verb' || !dict.endsWith('하다')) return false;
  const stem = stemOf(dict);
  if (stem.length < 2) return false;
  return !/(아|어|여)하$/.test(stem);
}

function makeCtx(dict: string, opts: ConjugateOptions): { ctx: StemCtx; confidence: Confidence; note?: string } {
  const stem = stemOf(dict);
  const c = classify(dict, opts.pos);
  const irr = opts.irregular ?? c.irregular;
  const confidence: Confidence = opts.irregular ? 'verified' : c.confidence;
  return { ctx: { dict, stem, pos: opts.pos, irr, existence: isExistence(dict) }, confidence, note: c.note };
}

function buildForm(ctx: StemCtx, def: FormDef): ConjugatedForm {
  const base = { key: def.key, pattern: def.pattern, th: def.th, group: def.group, level: def.level };
  if (def.appliesTo === 'verb' && ctx.pos === 'adjective') {
    return { ...base, value: null, note: 'รูปนี้ใช้กับคำกริยาเท่านั้น', steps: [] };
  }
  if (def.appliesTo === 'adjective' && ctx.pos === 'verb') {
    return { ...base, value: null, note: 'รูปนี้ใช้กับคำคุณศัพท์เท่านั้น', steps: [] };
  }
  const steps: string[] = [];
  const value = def.build(ctx, steps);
  return { ...base, value, steps: [`รากคำ: ${ctx.stem} (${ctx.dict} ตัด 다)`, ...steps, `ผลลัพธ์: ${value}`] };
}

function negativeForms(ctx: StemCtx): ConjugatedForm[] {
  const out: ConjugatedForm[] = [];
  const sup = SUPPLETIVE_NEGATION[ctx.dict];
  const splittable = isSplittableHada(ctx.dict, ctx.pos);
  const noun = splittable ? ctx.dict.slice(0, -2) : '';

  const shortNeg = (marker: '안' | '못', past: boolean): ConjugatedForm => {
    const key = `neg${marker === '안' ? 'An' : 'Mot'}${past ? 'Past' : ''}`;
    const pattern = `${marker} + ${past ? '-았/었어요' : '-아/어요'}`;
    const th = marker === '안' ? (past ? 'ปฏิเสธ อดีต' : 'ปฏิเสธ (ไม่…)') : past ? 'ทำไม่ได้ อดีต' : 'ทำไม่ได้ (ไม่สามารถ)';
    const base = { key, pattern, th, group: 'negative' as const, level: (marker === '안' ? 'A1' : 'A1') as CefrLevel };
    if (marker === '못' && ctx.pos === 'adjective') {
      return { ...base, value: null, note: '못 ใช้กับคำกริยาเท่านั้น', steps: [] };
    }
    const steps: string[] = [];
    if (sup && marker === '안') {
      const supCtx = makeCtx(sup.word, { pos: ctx.pos }).ctx;
      const v = past ? pastStem(supCtx, steps) + '어요' : aeoBase(supCtx, steps) + '요';
      return { ...base, value: v, note: sup.reason, steps: [sup.reason, ...steps] };
    }
    if (splittable) {
      const v = `${noun} ${marker} ${past ? '했어요' : '해요'}`;
      return { ...base, value: v, steps: [`คำกริยา คำนาม+하다 วาง ${marker} ไว้หน้า 하다: ${noun} ${marker} 하다`, `ผลลัพธ์: ${v}`] };
    }
    const conj = past ? pastStem(ctx, steps) + '어요' : aeoBase(ctx, steps) + '요';
    const v = `${marker} ${conj}`;
    return { ...base, value: v, steps: [`วาง ${marker} ไว้หน้าคำกริยา/คำคุณศัพท์`, ...steps, `ผลลัพธ์: ${v}`] };
  };

  out.push(shortNeg('안', false), shortNeg('안', true), shortNeg('못', false));
  return out;
}

export function conjugate(dictionaryForm: string, opts: ConjugateOptions): ConjugationResult {
  const dict = dictionaryForm.trim();
  const warnings: string[] = [];
  const notes: string[] = [];
  if (!/^[가-힣 ]+다$/.test(dict)) {
    throw new Error('กรุณาใส่คำในรูปพจนานุกรมที่ลงท้ายด้วย 다 เช่น 가다, 먹다');
  }
  if (dict === '이다' || dict === '아니다') {
    throw new Error('이다 / 아니다 ผันกับคำนาม — ใช้ "รูปผันคำนาม" แทน');
  }
  const { ctx, confidence, note } = makeCtx(dict, opts);
  if (note) notes.push(note);
  if (confidence === 'uncertain') {
    warnings.push(note ?? 'ระบบไม่แน่ใจว่าคำนี้ผันแบบใด ผลลัพธ์อาจไม่ถูกต้อง โปรดตรวจสอบกับพจนานุกรม');
  } else if (confidence === 'inferred') {
    warnings.push('ประเภทการผันได้จากการอนุมานตามรูปคำ ไม่ได้อยู่ในรายการที่ตรวจสอบแล้ว');
  }
  if (LEXICAL_HONORIFIC[dict]) {
    notes.push(`รูปยกย่องที่ใช้จริง: ${LEXICAL_HONORIFIC[dict]}`);
  }
  if (ctx.existence) {
    notes.push('คำที่ลงท้าย 있다/없다 ใช้ -는 ในรูปขยายคำนามและ -는데 เหมือนคำกริยา (맛있는, 재미없는)');
  }
  if (opts.pos === 'adjective') {
    notes.push('คำคุณศัพท์เกาหลีผันเหมือนคำกริยา และทำหน้าที่เป็นภาคแสดงได้เลย ไม่ต้องใช้ 이다');
  }

  const forms = FORMS.map((f) => buildForm(ctx, f));
  const negIdx = forms.findIndex((f) => f.key === 'negLong');
  forms.splice(negIdx, 0, ...negativeForms(ctx));
  if (LEXICAL_HONORIFIC[dict]) {
    for (const f of forms) {
      if (f.group === 'honorific' && f.value) f.note = `ในชีวิตจริงใช้ ${LEXICAL_HONORIFIC[dict]}`;
    }
  }

  return {
    dictionaryForm: dict,
    stem: ctx.stem,
    pos: ctx.pos,
    irregular: ctx.irr,
    irregularLabel: IRREGULAR_INFO[ctx.irr].ko,
    irregularRule: IRREGULAR_INFO[ctx.irr].th,
    confidence,
    notes,
    warnings,
    forms,
  };
}

/** Conjugate a single form. Returns null if the form does not apply. */
export function conjugateForm(dictionaryForm: string, formKey: string, opts: ConjugateOptions): string | null {
  const r = conjugate(dictionaryForm, opts);
  return r.forms.find((f) => f.key === formKey)?.value ?? null;
}

export function getForm(key: string): FormDef | undefined {
  return FORM_BY_KEY[key];
}

// ---------------------------------------------------------------------------
// Copula (이다 / 아니다) — forms used with nouns
// ---------------------------------------------------------------------------
export interface NounForm {
  key: string;
  pattern: string;
  th: string;
  value: string;
  level: CefrLevel;
}

export function conjugateNoun(noun: string): NounForm[] {
  const n = noun.trim();
  const b = hasBatchim(n);
  return [
    { key: 'copula', pattern: '이에요/예요', th: 'เป็น… (สุภาพ)', value: n + (b ? '이에요' : '예요'), level: 'A1' },
    { key: 'copulaFormal', pattern: '입니다', th: 'เป็น… (ทางการ)', value: n + '입니다', level: 'A1' },
    { key: 'copulaQuestion', pattern: '입니까?', th: 'เป็น… ไหม (ทางการ)', value: n + '입니까?', level: 'A1' },
    { key: 'copulaPast', pattern: '이었어요/였어요', th: 'เคยเป็น… (อดีต)', value: n + (b ? '이었어요' : '였어요'), level: 'A2' },
    { key: 'copulaNeg', pattern: '이/가 아니에요', th: 'ไม่ใช่…', value: n + (b ? '이' : '가') + ' 아니에요', level: 'A1' },
    { key: 'copulaNegFormal', pattern: '이/가 아닙니다', th: 'ไม่ใช่… (ทางการ)', value: n + (b ? '이' : '가') + ' 아닙니다', level: 'A1' },
    { key: 'copulaAnd', pattern: '(이)고', th: 'เป็น… และ', value: n + (b ? '이고' : '고'), level: 'A1' },
    { key: 'copulaBut', pattern: '(이)지만', th: 'เป็น… แต่', value: n + (b ? '이지만' : '지만'), level: 'A1' },
    { key: 'copulaSo', pattern: '(이)라서', th: 'เพราะเป็น…', value: n + (b ? '이라서' : '라서'), level: 'A2' },
    { key: 'copulaIf', pattern: '(이)면', th: 'ถ้าเป็น…', value: n + (b ? '이면' : '면'), level: 'A2' },
    { key: 'copulaMod', pattern: '인', th: 'ที่เป็น… (ขยายคำนาม)', value: n + '인', level: 'B1' },
    { key: 'copulaFuture', pattern: '일 거예요', th: 'น่าจะเป็น…', value: n + '일 거예요', level: 'A2' },
    { key: 'copulaQuote', pattern: '(이)라고 해요', th: 'เขาบอกว่าเป็น…', value: n + (b ? '이라고 해요' : '라고 해요'), level: 'B1' },
  ];
}

// ---------------------------------------------------------------------------
// Answer checking for exercises
// ---------------------------------------------------------------------------
export function normalizeKorean(s: string): string {
  return s.normalize('NFC').replace(/[.!?。]/g, '').replace(/\s+/g, ' ').trim();
}

export function checkConjugation(
  dictionaryForm: string,
  formKey: string,
  answer: string,
  opts: ConjugateOptions,
): { correct: boolean; expected: string | null } {
  const expected = conjugateForm(dictionaryForm, formKey, opts);
  if (!expected) return { correct: false, expected: null };
  const a = normalizeKorean(answer);
  const e = normalizeKorean(expected);
  return { correct: a === e || a.replace(/ /g, '') === e.replace(/ /g, ''), expected };
}
