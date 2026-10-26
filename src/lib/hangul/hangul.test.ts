import { describe, expect, it } from 'vitest';
import { compose, decompose, hasBatchim, toJamo } from './jamo';
import { attachParticle, copulaPolite } from './particles';
import { pronounce } from './pronunciation';
import { romanize, thaiReading } from './romanize';

describe('jamo', () => {
  it('composes and decomposes', () => {
    expect(compose('ㅎ', 'ㅏ', 'ㄴ')).toBe('한');
    expect(decompose('글')).toEqual({ initial: 'ㄱ', medial: 'ㅡ', final: 'ㄹ' });
    expect(toJamo('한글')).toEqual(['ㅎ', 'ㅏ', 'ㄴ', 'ㄱ', 'ㅡ', 'ㄹ']);
  });
  it('detects batchim incl. digits', () => {
    expect(hasBatchim('책')).toBe(true);
    expect(hasBatchim('사과')).toBe(false);
    expect(hasBatchim('1')).toBe(true);
    expect(hasBatchim('2')).toBe(false);
  });
});

describe('particles', () => {
  it.each([
    ['책', 'object', '책을'],
    ['사과', 'object', '사과를'],
    ['저', 'topic', '저는'],
    ['선생님', 'topic', '선생님은'],
    ['친구', 'subject', '친구가'],
    ['물', 'subject', '물이'],
    ['서울', 'direction', '서울로'],
    ['버스', 'direction', '버스로'],
    ['지하철', 'direction', '지하철로'],
    ['손', 'direction', '손으로'],
    ['빵', 'and', '빵과'],
    ['우유', 'and', '우유와'],
  ] as const)('%s + %s = %s', (noun, key, expected) => {
    expect(attachParticle(noun, key)).toBe(expected);
  });
  it('copula', () => {
    expect(copulaPolite('학생')).toBe('학생이에요');
    expect(copulaPolite('의사')).toBe('의사예요');
  });
});

describe('pronunciation', () => {
  it.each([
    ['한국어', '한구거'],
    ['음악', '으막'],
    ['맛있어요', '마시써요'],
    ['없어요', '업써요'],
    ['읽어요', '일거요'],
    ['앉아요', '안자요'],
    ['좋아요', '조아요'],
    ['많아요', '마나요'],
    ['괜찮아요', '괜차나요'],
    ['좋다', '조타'],
    ['좋습니다', '조씀니다'],
    ['좋네요', '존네요'],
    ['감사합니다', '감사함니다'],
    ['먹는', '멍는'],
    ['학교', '학꾜'],
    ['먹다', '먹따'],
    ['축하해요', '추카해요'],
    ['입학', '이팍'],
    ['못해요', '모태요'],
    ['같이', '가치'],
    ['굳이', '구지'],
    ['국립', '궁닙'],
    ['음료', '음뇨'],
    ['신라', '실라'],
    ['설날', '설랄'],
    ['꽃', '꼳'],
    ['앉다', '안따'],
    ['읽다', '익따'],
    ['읽고', '일꼬'],
    ['여덟', '여덜'],
    ['희망', '히망'],
    ['의사', '의사'],
    ['십만', '심만'],
    ['싫어요', '시러요'],
  ])('%s → [%s]', (word, expected) => {
    expect(pronounce(word).text).toBe(expected);
  });
});

describe('romanization', () => {
  it.each([
    ['한국어', 'hangugeo'],
    ['감사합니다', 'gamsahamnida'],
    ['학교', 'hakgyo'],
    ['서울', 'seoul'],
    ['신라', 'silla'],
    ['안녕하세요', 'annyeonghaseyo'],
    ['같이', 'gachi'],
    ['사랑해요', 'saranghaeyo'],
    ['좋아요', 'joayo'],
    ['김치', 'gimchi'],
  ])('%s → %s', (word, expected) => {
    expect(romanize(word)).toBe(expected);
  });
});

describe('thai reading', () => {
  it.each([
    ['안녕하세요', 'อันนยองฮาเซโย'],
    ['감사합니다', 'คัมซาฮัมนีดา'],
    ['사랑해요', 'ซารังแฮโย'],
    ['괜찮아요', 'แควนชานาโย'],
    ['물', 'มุล'],
    ['아버지', 'อาบอจี'],
    ['한국', 'ฮันกุก'],
  ])('%s → %s', (word, expected) => {
    expect(thaiReading(word)).toBe(expected);
  });
});
