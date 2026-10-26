import { describe, expect, it } from 'vitest';
import { checkConjugation, conjugate, conjugateForm, conjugateNoun } from './engine';
import type { PartOfSpeech } from './classify';

type Row = [dict: string, pos: PartOfSpeech, form: string, expected: string | null];

const v = (dict: string, form: string, expected: string | null): Row => [dict, 'verb', form, expected];
const a = (dict: string, form: string, expected: string | null): Row => [dict, 'adjective', form, expected];

/** Expected values are written by hand from standard Korean grammar references. */
const CASES: Row[] = [
  // --- regular, vowel contraction -----------------------------------------
  v('가다', 'present', '가요'), v('가다', 'past', '갔어요'), v('가다', 'future', '갈 거예요'), v('가다', 'formal', '갑니다'),
  v('서다', 'present', '서요'), v('켜다', 'present', '켜요'), v('보내다', 'present', '보내요'), v('세다', 'present', '세요'),
  v('오다', 'present', '와요'), v('오다', 'past', '왔어요'), v('보다', 'present', '봐요'), v('보다', 'past', '봤어요'),
  v('주다', 'present', '줘요'), v('배우다', 'present', '배워요'), v('배우다', 'past', '배웠어요'), v('바꾸다', 'present', '바꿔요'),
  v('마시다', 'present', '마셔요'), v('마시다', 'past', '마셨어요'), v('기다리다', 'present', '기다려요'), v('가르치다', 'present', '가르쳐요'),
  v('되다', 'present', '돼요'), v('되다', 'past', '됐어요'), v('쉬다', 'present', '쉬어요'), v('쉬다', 'past', '쉬었어요'),
  v('띄다', 'present', '띄어요'),
  // --- regular, consonant stems --------------------------------------------
  v('먹다', 'present', '먹어요'), v('먹다', 'past', '먹었어요'), v('먹다', 'future', '먹을 거예요'), v('먹다', 'formal', '먹습니다'),
  v('먹다', 'formalQuestion', '먹습니까?'), v('먹다', 'request', '먹으세요'), v('먹다', 'want', '먹고 싶어요'), v('먹다', 'can', '먹을 수 있어요'),
  v('먹다', 'modPresent', '먹는'), v('먹다', 'modPast', '먹은'), v('먹다', 'modFuture', '먹을'), v('먹다', 'so', '먹어서'),
  v('먹다', 'because', '먹으니까'), v('먹다', 'if', '먹으면'), v('먹다', 'tried', '먹어 봤어요'), v('먹다', 'plain', '먹는다'),
  v('먹다', 'letsFormal', '먹읍시다'), v('먹다', 'shallWe', '먹을까요?'), v('먹다', 'quoteCommand', '먹으라고 해요'),
  v('앉다', 'present', '앉아요'), v('읽다', 'present', '읽어요'), v('읽다', 'request', '읽으세요'), v('찾다', 'past', '찾았어요'),
  v('받다', 'present', '받아요'), v('받다', 'if', '받으면'), v('입다', 'present', '입어요'), v('입다', 'request', '입으세요'),
  v('웃다', 'present', '웃어요'), v('웃다', 'if', '웃으면'), v('씻다', 'present', '씻어요'),
  v('놓다', 'present', '놓아요'), v('넣다', 'present', '넣어요'),
  a('좋다', 'present', '좋아요'), a('좋다', 'modPresent', '좋은'), a('좋다', 'formal', '좋습니다'),
  a('많다', 'present', '많아요'), a('많다', 'modPresent', '많은'), a('괜찮다', 'present', '괜찮아요'), a('작다', 'modPresent', '작은'),
  a('좁다', 'present', '좁아요'), a('얇다', 'present', '얇아요'),
  // --- 하다 ------------------------------------------------------------------
  v('하다', 'present', '해요'), v('하다', 'past', '했어요'), v('하다', 'formal', '합니다'), v('하다', 'future', '할 거예요'),
  v('공부하다', 'present', '공부해요'), v('공부하다', 'negAn', '공부 안 해요'), v('공부하다', 'negMot', '공부 못 해요'),
  v('좋아하다', 'negAn', '안 좋아해요'), v('운동하다', 'progressive', '운동하고 있어요'),
  a('깨끗하다', 'present', '깨끗해요'), a('깨끗하다', 'negAn', '안 깨끗해요'), a('깨끗하다', 'modPresent', '깨끗한'),
  // --- ㄷ irregular ----------------------------------------------------------
  v('듣다', 'present', '들어요'), v('듣다', 'past', '들었어요'), v('듣다', 'request', '들으세요'), v('듣다', 'if', '들으면'),
  v('듣다', 'future', '들을 거예요'), v('듣다', 'formal', '듣습니다'), v('듣다', 'and', '듣고'), v('듣다', 'modPresent', '듣는'),
  v('듣다', 'modPast', '들은'), v('듣다', 'plain', '듣는다'),
  v('걷다', 'present', '걸어요'), v('걷다', 'can', '걸을 수 있어요'), v('묻다', 'present', '물어요'), v('깨닫다', 'past', '깨달았어요'),
  // --- ㅂ irregular -----------------------------------------------------------
  a('춥다', 'present', '추워요'), a('춥다', 'past', '추웠어요'), a('춥다', 'if', '추우면'), a('춥다', 'modPresent', '추운'),
  a('춥다', 'formal', '춥습니다'), a('춥다', 'but', '춥지만'), a('춥다', 'so', '추워서'), a('춥다', 'future', '추울 거예요'),
  a('덥다', 'present', '더워요'), a('쉽다', 'present', '쉬워요'), a('어렵다', 'modPresent', '어려운'), a('가깝다', 'present', '가까워요'),
  a('아름답다', 'present', '아름다워요'), a('맵다', 'past', '매웠어요'), a('귀엽다', 'modPresent', '귀여운'), a('무겁다', 'present', '무거워요'),
  a('고맙다', 'present', '고마워요'),
  v('돕다', 'present', '도와요'), v('돕다', 'past', '도왔어요'), v('돕다', 'request', '도우세요'), v('돕다', 'pleaseDo', '도와 주세요'),
  v('돕다', 'formal', '돕습니다'), v('눕다', 'present', '누워요'), v('굽다', 'present', '구워요'),
  // --- 르 irregular ----------------------------------------------------------
  v('모르다', 'present', '몰라요'), v('모르다', 'past', '몰랐어요'), v('모르다', 'if', '모르면'), v('모르다', 'formal', '모릅니다'),
  v('부르다', 'present', '불러요'), v('부르다', 'past', '불렀어요'), a('빠르다', 'present', '빨라요'), a('다르다', 'present', '달라요'),
  v('고르다', 'present', '골라요'), v('자르다', 'present', '잘라요'), v('서두르다', 'present', '서둘러요'), a('게으르다', 'present', '게을러요'),
  v('따르다', 'present', '따라요'), v('들르다', 'present', '들러요'), a('푸르다', 'present', '푸르러요'),
  // --- ㅅ irregular -----------------------------------------------------------
  v('짓다', 'present', '지어요'), v('짓다', 'past', '지었어요'), v('짓다', 'if', '지으면'), v('짓다', 'modPast', '지은'),
  v('짓다', 'formal', '짓습니다'), v('짓다', 'and', '짓고'), v('낫다', 'present', '나아요'), v('붓다', 'present', '부어요'),
  v('긋다', 'present', '그어요'),
  // --- ㅎ irregular -----------------------------------------------------------
  a('빨갛다', 'present', '빨개요'), a('빨갛다', 'modPresent', '빨간'), a('빨갛다', 'if', '빨가면'), a('빨갛다', 'formal', '빨갛습니다'),
  a('하얗다', 'present', '하얘요'), a('노랗다', 'present', '노래요'), a('파랗다', 'modPresent', '파란'), a('까맣다', 'past', '까맸어요'),
  a('그렇다', 'present', '그래요'), a('어떻다', 'present', '어때요'), a('이렇다', 'modPresent', '이런'),
  // --- ㅡ elimination ---------------------------------------------------------
  v('쓰다', 'present', '써요'), v('쓰다', 'past', '썼어요'), a('크다', 'present', '커요'), v('끄다', 'present', '꺼요'),
  a('바쁘다', 'present', '바빠요'), a('바쁘다', 'past', '바빴어요'), a('예쁘다', 'present', '예뻐요'), a('예쁘다', 'modPresent', '예쁜'),
  a('아프다', 'present', '아파요'), a('슬프다', 'present', '슬퍼요'), a('기쁘다', 'present', '기뻐요'), a('배고프다', 'present', '배고파요'),
  a('나쁘다', 'present', '나빠요'),
  // --- ㄹ stems -------------------------------------------------------------
  v('만들다', 'present', '만들어요'), v('만들다', 'request', '만드세요'), v('만들다', 'formal', '만듭니다'), v('만들다', 'modPresent', '만드는'),
  v('만들다', 'modPast', '만든'), v('만들다', 'future', '만들 거예요'), v('만들다', 'if', '만들면'), v('만들다', 'because', '만드니까'),
  v('만들다', 'purpose', '만들려고'), v('만들다', 'letsFormal', '만듭시다'), v('만들다', 'plain', '만든다'), v('만들다', 'honPast', '만드셨어요'),
  v('살다', 'present', '살아요'), v('살다', 'modPresent', '사는'), v('살다', 'formal', '삽니다'), v('알다', 'present', '알아요'),
  v('알다', 'negAn', '몰라요'), v('놀다', 'request', '노세요'), v('열다', 'formal', '엽니다'), v('팔다', 'can', '팔 수 있어요'),
  a('길다', 'modPresent', '긴'), a('길다', 'present', '길어요'), a('멀다', 'present', '멀어요'), a('멀다', 'modPresent', '먼'),
  a('멀다', 'background', '먼데'),
  // --- 우 irregular ---------------------------------------------------------
  v('푸다', 'present', '퍼요'),
  // --- existence --------------------------------------------------------------
  a('있다', 'present', '있어요'), a('있다', 'modPresent', '있는'), a('맛있다', 'modPresent', '맛있는'), a('재미없다', 'background', '재미없는데'),
  a('있다', 'negAn', '없어요'), a('맛있다', 'present', '맛있어요'),
  // --- honorific, connectives, misc ---------------------------------------------
  v('가다', 'honPresent', '가세요'), v('가다', 'honPast', '가셨어요'), v('읽다', 'honPast', '읽으셨어요'), v('가다', 'honFormal', '가십니다'),
  v('가다', 'negAn', '안 가요'), v('가다', 'negMot', '못 가요'), v('가다', 'negAnPast', '안 갔어요'), v('가다', 'negLong', '가지 않아요'),
  v('가다', 'mustDo', '가야 해요'), v('가다', 'mayDo', '가도 돼요'), v('가다', 'mustNot', '가면 안 돼요'), v('가다', 'before', '가기 전에'),
  v('먹다', 'after', '먹은 후에'), v('가다', 'when', '갈 때'), v('가다', 'while', '가면서'), v('가다', 'even', '가도'),
  v('가다', 'knowHow', '갈 줄 알아요'), v('가다', 'haveDone', '간 적이 있어요'), v('가다', 'promise', '갈게요'), v('가다', 'intend', '가려고 해요'),
  v('가다', 'plain', '간다'), v('가다', 'quoteStatement', '간다고 해요'), v('먹다', 'quoteStatement', '먹는다고 해요'),
  a('예쁘다', 'quoteStatement', '예쁘다고 해요'), v('가다', 'quotePast', '갔다고 해요'), v('가다', 'quoteQuestion', '가냐고 해요'),
  v('가다', 'quoteSuggest', '가자고 해요'), v('가다', 'quoteCommand', '가라고 해요'), v('먹다', 'seems', '먹는 것 같아요'),
  a('바쁘다', 'seems', '바쁜 것 같아요'), v('오다', 'seemsFuture', '올 것 같아요'), a('예쁘다', 'become', '예뻐져요'), a('춥다', 'become', '추워져요'),
  v('먹다', 'endUp', '먹게 됐어요'), v('가다', 'theMore', '갈수록'), a('춥다', 'evenIf', '춥더라도'), v('가다', 'ifHadPast', '갔더라면'),
  v('앉다', 'state', '앉아 있어요'), v('먹다', 'prohibit', '먹지 마세요'), v('먹다', 'pleaseDo', '먹어 주세요'), v('먹다', 'casual', '먹어'),
  v('먹다', 'casualPast', '먹었어'), v('먹다', 'formalPast', '먹었습니다'), v('먹다', 'plainPast', '먹었다'),
  // --- forms that do not apply -------------------------------------------------
  a('예쁘다', 'want', null), a('예쁘다', 'request', null), a('예쁘다', 'negMot', null), v('가다', 'become', null),
];

describe('conjugation engine — hand-verified forms', () => {
  it.each(CASES)('%s (%s) %s → %s', (dict, pos, form, expected) => {
    expect(conjugateForm(dict, form, { pos })).toBe(expected);
  });
});

describe('classification confidence', () => {
  it('flags ambiguous unknown stems instead of guessing silently', () => {
    const r = conjugate('갇다', { pos: 'verb' });
    expect(r.confidence).toBe('uncertain');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('accepts explicit override from reviewed data', () => {
    const r = conjugate('갇다', { pos: 'verb', irregular: 'regular' });
    expect(r.confidence).toBe('verified');
  });
  it('rejects non-dictionary input', () => {
    expect(() => conjugate('먹어요', { pos: 'verb' })).toThrow();
    expect(() => conjugate('이다', { pos: 'verb' })).toThrow();
  });
  it('explains each form with steps', () => {
    const r = conjugate('듣다', { pos: 'verb' });
    const present = r.forms.find((f) => f.key === 'present')!;
    expect(present.steps.join(' ')).toContain('ㄷ 불규칙');
    expect(r.irregular).toBe('d');
  });
  it('mentions lexical honorifics', () => {
    expect(conjugate('먹다', { pos: 'verb' }).notes.join(' ')).toContain('드시다');
  });
});

describe('noun (copula) forms', () => {
  it('handles batchim', () => {
    const f = (n: string, k: string) => conjugateNoun(n).find((x) => x.key === k)!.value;
    expect(f('학생', 'copula')).toBe('학생이에요');
    expect(f('의사', 'copula')).toBe('의사예요');
    expect(f('학생', 'copulaPast')).toBe('학생이었어요');
    expect(f('의사', 'copulaPast')).toBe('의사였어요');
    expect(f('학생', 'copulaNeg')).toBe('학생이 아니에요');
    expect(f('의사', 'copulaNeg')).toBe('의사가 아니에요');
    expect(f('학생', 'copulaSo')).toBe('학생이라서');
  });
});

describe('answer checking', () => {
  it('accepts correct answers ignoring punctuation and spacing differences', () => {
    expect(checkConjugation('먹다', 'can', '먹을 수 있어요.', { pos: 'verb' }).correct).toBe(true);
    expect(checkConjugation('먹다', 'can', '먹을수 있어요', { pos: 'verb' }).correct).toBe(true);
    expect(checkConjugation('듣다', 'present', '듣어요', { pos: 'verb' })).toEqual({ correct: false, expected: '들어요' });
  });
});
