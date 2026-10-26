/**
 * Phonological primitives of Korean predicate conjugation.
 *
 * Every Korean ending attaches in one of four ways, and irregular classes behave
 * differently in each:
 *   1. aeo     — 아/어-initial endings (아요, 아서, 았어요 …): vowel harmony + contraction
 *   2. eu      — (으)-endings (으면, 으세요, 은/을 modifiers …): 으 inserted after consonants
 *   3. direct  — consonant-initial endings (고, 지만, 는 …): attach to the stem as is
 *   4. formal  — ㅂ니다/습니다
 * Each primitive appends human-readable steps to `trace` so the UI can explain the result.
 */
import { compose, decompose, lastChar, withFinal } from '../hangul/jamo';
import { IRREGULAR_INFO, type IrregularClass, type PartOfSpeech } from './classify';

export interface StemCtx {
  dict: string;
  stem: string;
  pos: PartOfSpeech;
  irr: IrregularClass;
  /** 있다/없다 and compounds (맛있다 …) take 는 like verbs in modifiers. */
  existence: boolean;
}

const BRIGHT = new Set(['ㅏ', 'ㅗ', 'ㅑ']);

function isBright(ch: string): boolean {
  const d = decompose(ch);
  return !!d && BRIGHT.has(d.medial);
}

function split(stem: string): { body: string; L: string; d: NonNullable<ReturnType<typeof decompose>> } {
  const L = lastChar(stem);
  const d = decompose(L);
  if (!d) throw new Error(`Invalid stem: ${stem}`);
  return { body: stem.slice(0, -1), L, d };
}

const CONTRACT: Record<string, string> = { ㅗ: 'ㅘ', ㅜ: 'ㅝ', ㅣ: 'ㅕ', ㅚ: 'ㅙ' };
const NO_CHANGE = new Set(['ㅏ', 'ㅓ', 'ㅕ', 'ㅐ', 'ㅔ', 'ㅒ', 'ㅖ', 'ㅑ']);

/** The 아/어 base ("infinitive"): 가, 먹어, 해, 들어, 추워, 몰라 … */
export function aeoBase(ctx: StemCtx, trace: string[]): string {
  const { stem, irr } = ctx;
  const { body, L, d } = split(stem);
  const info = IRREGULAR_INFO[irr];
  switch (irr) {
    case 'hada':
      trace.push('하다: 하 + 여 → 해');
      return body + '해';
    case 'u':
      trace.push(`${info.ko}: ${L} + 어 → ${compose(d.initial, 'ㅓ')}`);
      return body + compose(d.initial, 'ㅓ');
    case 'd': {
      const changed = withFinal(L, 'ㄹ');
      const v = isBright(L) ? '아' : '어';
      trace.push(`${info.ko}: ${L} → ${changed} เมื่อตามด้วยสระ`, `สระ ${d.medial} → ใช้ ${v}`);
      return body + changed + v;
    }
    case 'b': {
      const open = compose(d.initial, d.medial);
      trace.push(`${info.ko}: ㅂ → 우, 우 + 어 → 워`);
      return body + open + '워';
    }
    case 'b-o': {
      const open = compose(d.initial, d.medial);
      trace.push(`${info.ko}: ㅂ → 오, 오 + 아 → 와`);
      return body + open + '와';
    }
    case 's': {
      const open = compose(d.initial, d.medial);
      const v = isBright(L) ? '아' : '어';
      trace.push(`${info.ko}: ตัด ㅅ แต่ไม่หดรวมสระ → ${open} + ${v}`);
      return body + open + v;
    }
    case 'h': {
      const m = d.medial === 'ㅑ' || d.medial === 'ㅕ' ? 'ㅒ' : 'ㅐ';
      const res = compose(d.initial, m);
      trace.push(`${info.ko}: ตัด ㅎ และสระ ${d.medial} + 아/어 → ${m}`);
      return body + res;
    }
    case 'reu': {
      const prev = lastChar(body);
      const v = isBright(prev) ? '라' : '러';
      trace.push(`${info.ko}: ${prev}르 + 아/어 → ${withFinal(prev, 'ㄹ')}${v}`);
      return body.slice(0, -1) + withFinal(prev, 'ㄹ') + v;
    }
    case 'reo':
      trace.push(`${info.ko}: เติม 러`);
      return stem + '러';
    case 'eu': {
      if (!body) {
        trace.push(`ㅡ 탈락: ${L} + 어 → ${compose(d.initial, 'ㅓ')}`);
        return compose(d.initial, 'ㅓ');
      }
      const prev = lastChar(body);
      const m = isBright(prev) ? 'ㅏ' : 'ㅓ';
      trace.push(`ㅡ 탈락: ตัด ㅡ, พยางค์ก่อนหน้า (${prev}) ใช้สระ ${m === 'ㅏ' ? 'ㅏ' : 'ㅓ'}`);
      return body + compose(d.initial, m);
    }
    default: {
      if (d.final) {
        const v = isBright(L) ? '아' : '어';
        trace.push(`สระพยางค์สุดท้าย ${d.medial} → ใช้ ${v} (มีตัวสะกด จึงไม่หดเสียง)`);
        return stem + v;
      }
      if (NO_CHANGE.has(d.medial)) {
        trace.push(`สระ ${d.medial} + 아/어 รวมเป็นเสียงเดิม → ${L}`);
        return stem;
      }
      const c = CONTRACT[d.medial];
      if (c) {
        const res = compose(d.initial, c);
        trace.push(`หดเสียง: ${d.medial} + ${BRIGHT.has(d.medial) ? '아' : '어'} → ${c} (${L} → ${res})`);
        return body + res;
      }
      trace.push(`สระ ${d.medial} ไม่หดเสียง → เติม 어`);
      return stem + '어';
    }
  }
}

/** Past-tense stem: 갔, 먹었, 했, 들었 … */
export function pastStem(ctx: StemCtx, trace: string[]): string {
  const base = aeoBase(ctx, trace);
  const res = base.slice(0, -1) + withFinal(lastChar(base), 'ㅆ');
  trace.push(`อดีต: ${base} + ㅆ → ${res}`);
  return res;
}

const JAMO_START = new Set(['ㄴ', 'ㄹ', 'ㅂ']);

/**
 * Attach a (으)-ending. `suffix` is written without 으 and may start with a bare jamo
 * (ㄴ / ㄹ / ㅂ) that becomes the batchim: e.g. 'ㄴ', 'ㄹ 거예요', 'ㅂ시다', '면', '세요'.
 */
export function attachEu(ctx: StemCtx, suffix: string, trace: string[]): string {
  const { irr } = ctx;
  const { body, L, d } = split(ctx.stem);
  const first = suffix.charAt(0);
  const jamo = JAMO_START.has(first);
  const rest = jamo ? suffix.slice(1) : suffix;
  const info = IRREGULAR_INFO[irr];

  if (irr === 'l') {
    const firstInitial = jamo ? first : decompose(first)?.initial ?? '';
    if (jamo && first === 'ㄹ') {
      trace.push('ㄹ 탈락 group: ตัวสะกด ㄹ อยู่แล้ว ไม่เติม 으');
      return ctx.stem + rest;
    }
    if (['ㄴ', 'ㅂ', 'ㅅ'].includes(firstInitial)) {
      const dropped = body + compose(d.initial, d.medial);
      trace.push(`ㄹ 탈락: ㄹ หายไปเมื่อเจอ ${firstInitial} → ${dropped}`);
      return jamo ? dropped.slice(0, -1) + withFinal(lastChar(dropped), first) + rest : dropped + suffix;
    }
    trace.push('ㄹ 받침: ไม่เติม 으');
    return ctx.stem + suffix;
  }

  let base = ctx.stem;
  let consonant = !!d.final;
  switch (irr) {
    case 'd':
      base = body + withFinal(L, 'ㄹ');
      trace.push(`${info.ko}: ${L} → ${withFinal(L, 'ㄹ')} ก่อนสระ 으`);
      break;
    case 'b':
    case 'b-o':
      base = body + compose(d.initial, d.medial) + '우';
      consonant = false;
      trace.push(`${info.ko}: ㅂ → 우 (${base})`);
      break;
    case 's':
      base = body + compose(d.initial, d.medial);
      consonant = true; // 으 is still inserted: 지으면
      trace.push(`${info.ko}: ตัด ㅅ แต่ยังเติม 으`);
      break;
    case 'h':
      base = body + compose(d.initial, d.medial);
      consonant = false;
      trace.push(`${info.ko}: ตัด ㅎ และไม่เติม 으`);
      break;
  }

  if (consonant) {
    if (jamo) {
      const eu = compose('ㅇ', 'ㅡ', first);
      trace.push(`มีตัวสะกด → เติม 으: ${eu}`);
      return base + eu + rest;
    }
    trace.push('มีตัวสะกด → เติม 으');
    return base + '으' + suffix;
  }
  if (jamo) {
    const merged = withFinal(lastChar(base), first);
    trace.push(`ไม่มีตัวสะกด → ${first} เป็นตัวสะกด: ${merged}`);
    return base.slice(0, -1) + merged + rest;
  }
  trace.push('ไม่มีตัวสะกด → ต่อท้ายได้เลย');
  return base + suffix;
}

/** Attach a consonant-initial ending directly to the stem. */
export function attachDirect(ctx: StemCtx, suffix: string, trace: string[]): string {
  const { body, d } = split(ctx.stem);
  if (ctx.irr === 'l' && decompose(suffix.charAt(0))?.initial === 'ㄴ') {
    trace.push('ㄹ 탈락: ㄹ หายไปเมื่อเจอ ㄴ');
    return body + compose(d.initial, d.medial) + suffix;
  }
  trace.push(`ต่อ -${suffix.trim()} กับรากคำได้โดยตรง`);
  return ctx.stem + suffix;
}

/** Formal polite: ㅂ니다 / 습니다 (question: ㅂ니까 / 습니까). */
export function attachFormal(ctx: StemCtx, question: boolean, trace: string[]): string {
  const end = question ? '니까?' : '니다';
  const { body, L, d } = split(ctx.stem);
  if (ctx.irr === 'l') {
    trace.push('ㄹ 탈락: ㄹ หายไปเมื่อเจอ ㅂ');
    return body + compose(d.initial, d.medial, 'ㅂ') + end;
  }
  if (d.final) {
    trace.push('มีตัวสะกด → 습니다');
    return ctx.stem + '습' + end;
  }
  trace.push('ไม่มีตัวสะกด → ㅂ니다');
  return body + withFinal(L, 'ㅂ') + end;
}

/** Plain (한다체) present: 간다 / 먹는다 / 만든다 / 예쁘다 */
export function plainPresent(ctx: StemCtx, trace: string[]): string {
  if (ctx.pos === 'adjective') {
    trace.push('คำคุณศัพท์ในรูป 한다체 ใช้รูปพจนานุกรม');
    return ctx.dict;
  }
  const { body, L, d } = split(ctx.stem);
  if (ctx.irr === 'l') {
    trace.push('ㄹ 탈락 + ㄴ다');
    return body + compose(d.initial, d.medial, 'ㄴ') + '다';
  }
  if (d.final) {
    trace.push('มีตัวสะกด → 는다');
    return ctx.stem + '는다';
  }
  trace.push('ไม่มีตัวสะกด → ㄴ다');
  return body + withFinal(L, 'ㄴ') + '다';
}
