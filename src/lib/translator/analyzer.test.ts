import { describe, expect, it } from 'vitest';
import { analyze, searchThai } from './analyzer';

describe('reading assistant', () => {
  it('translates sentences found in the reviewed bank with high confidence', () => {
    const a = analyze('저는 학생이에요.');
    expect(a.sentenceMatch?.th).toBe('ฉันเป็นนักเรียน');
    expect(a.confidence).toBe('high');
  });

  it('splits particles and identifies their function', () => {
    const a = analyze('친구가 도서관에서 책을 읽어요');
    const [friend, lib, book, read] = a.tokens;
    expect(friend).toMatchObject({ lemma: '친구', particles: [{ form: '가' }] });
    expect(lib).toMatchObject({ lemma: '도서관', particles: [{ form: '에서' }] });
    expect(book).toMatchObject({ lemma: '책', particles: [{ form: '을' }] });
    expect(read).toMatchObject({ lemma: '읽다', ending: { formKey: 'present' } });
    expect(a.coverage).toBe(1);
  });

  it('reverse-looks-up irregular conjugations to their dictionary form', () => {
    expect(analyze('들었어요').tokens[0]).toMatchObject({ lemma: '듣다', ending: { formKey: 'past' } });
    expect(analyze('추워요').tokens[0]).toMatchObject({ lemma: '춥다' });
    expect(analyze('몰라요').tokens[0].lemma).toBe('모르다');
    expect(analyze('만드세요').tokens[0].lemma).toBe('만들다');
  });

  it('matches multi-word forms and expressions', () => {
    const a = analyze('한국어를 배우고 싶어요');
    expect(a.tokens[1]).toMatchObject({ kind: 'phrase', lemma: '배우다', ending: { formKey: 'want' } });
    expect(analyze('안녕히 가세요').tokens[0]).toMatchObject({ kind: 'phrase', lemma: '안녕히 가세요' });
  });

  it('handles copula and contracted pronouns', () => {
    expect(analyze('의사예요').tokens[0]).toMatchObject({ lemma: '의사', ending: { formKey: 'copula' } });
    expect(analyze('제가').tokens[0]).toMatchObject({ lemma: '저', particles: [{ form: '가' }] });
  });

  it('respects particle allomorphs (서울로 vs 손으로)', () => {
    expect(analyze('지하철로').tokens[0]).toMatchObject({ lemma: '지하철', particles: [{ form: '로' }] });
  });

  it('flags unknown words and does not pretend to translate', () => {
    const a = analyze('저는 블록체인을 좋아해요');
    expect(a.tokens[1].kind).toBe('unknown');
    expect(a.coverage).toBeLessThan(1);
    expect(a.confidence).toBe('low');
    expect(a.sentenceMatch).toBeUndefined();
    expect(a.warnings.join(' ')).toContain('ไม่รู้จักคำ');
  });

  it('searches Thai → Korean in the bank and dictionary', () => {
    const r = searchThai('ห้องน้ำอยู่ที่ไหน');
    expect(r.sentences[0]).toMatchObject({ ko: '화장실이 어디예요?', exact: true });
    expect(searchThai('แมว').words.map((w) => w.ko)).toContain('고양이');
  });
});
