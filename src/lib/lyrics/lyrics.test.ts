import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/util/random';
import { DEMO_SONG } from '@/data/lyrics/songs';
import { buildLyricQuestions, canPlay, checkKoreanLine, exportSongs, importSongs, lyricPoints, parseLyrics, serializeLyrics, uniqueLines } from './engine';
import type { Song } from './types';

const song = (lines: [string, string][], id = 's1'): Song => ({ id, title: 't', source: 'user', createdAt: 0, updatedAt: 0, lines: lines.map(([ko, th]) => ({ ko, th })) });

describe('checkKoreanLine', () => {
  it('accepts Hangul with spaces, digits and punctuation', () => {
    expect(checkKoreanLine('오늘도 1번 더, 괜찮아요!').ok).toBe(true);
    expect(checkKoreanLine('"사랑해" ~ 너를…').ok).toBe(true);
  });
  it('rejects Latin, Thai, kanji or empty lines', () => {
    expect(checkKoreanLine('baby 사랑해').ok).toBe(false);
    expect(checkKoreanLine('사랑 รัก').ok).toBe(false);
    expect(checkKoreanLine('愛 사랑').ok).toBe(false);
    expect(checkKoreanLine('   ').ok).toBe(false);
    expect(checkKoreanLine('...!').ok).toBe(false);
  });
});

describe('parseLyrics', () => {
  it('parses pipe-separated pairs', () => {
    const r = parseLyrics('하나 | หนึ่ง\n\n둘 | สอง\n');
    expect(r.errors).toEqual([]);
    expect(r.lines).toEqual([
      { ko: '하나', th: 'หนึ่ง' },
      { ko: '둘', th: 'สอง' },
    ]);
  });
  it('parses tab-separated pairs', () => {
    expect(parseLyrics('하나\tหนึ่ง\n둘\tสอง').lines).toHaveLength(2);
  });
  it('parses alternating Korean / Thai lines', () => {
    const r = parseLyrics('하나\nหนึ่ง\n\n둘\nสอง');
    expect(r.lines.map((l) => l.th)).toEqual(['หนึ่ง', 'สอง']);
  });
  it('reports non-Korean lyric lines and Korean in translations with line numbers', () => {
    const r = parseLyrics('hello | สวัสดี\n안녕 | 안녕');
    expect(r.lines).toHaveLength(0);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2]);
  });
  it('reports a dangling Korean line in alternating mode', () => {
    const r = parseLyrics('하나\nหนึ่ง\n둘');
    expect(r.lines).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });
  it('round-trips through serializeLyrics', () => {
    expect(parseLyrics(serializeLyrics(DEMO_SONG.lines)).lines).toEqual(DEMO_SONG.lines);
  });
});

describe('the demo song', () => {
  it('passes the same checks as user songs', () => {
    expect(parseLyrics(serializeLyrics(DEMO_SONG.lines)).errors).toEqual([]);
    expect(canPlay(DEMO_SONG)).toBe(true);
  });
});

describe('buildLyricQuestions', () => {
  it('makes one 4-choice question per distinct line with the right answer', () => {
    const qs = buildLyricQuestions(DEMO_SONG, createRng(3));
    expect(qs).toHaveLength(DEMO_SONG.lines.length);
    qs.forEach((q, i) => {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.answer]).toBe(DEMO_SONG.lines[q.lineIndex].th);
      expect(q.prompt).toBe(DEMO_SONG.lines[q.lineIndex].ko);
      if (i) expect(q.lineIndex).toBeGreaterThan(qs[i - 1].lineIndex);
    });
  });
  it('counts a repeated chorus line once', () => {
    const s = song([['가', 'ก'], ['나', 'ข'], ['가', 'ก'], ['다', 'ค'], ['라', 'ง']]);
    expect(uniqueLines(s).map((x) => x.index)).toEqual([0, 1, 3, 4]);
    expect(buildLyricQuestions(s, createRng(1))).toHaveLength(4);
  });
  it('borrows distractors from other songs when a song is short', () => {
    const short = song([['가', 'ก'], ['나', 'ข']], 'short');
    expect(canPlay(short)).toBe(false);
    expect(canPlay(short, [DEMO_SONG])).toBe(true);
    const qs = buildLyricQuestions(short, createRng(2), { pool: [DEMO_SONG] });
    for (const q of qs) expect(new Set(q.options).size).toBe(4);
  });
  it('prefers lines missed before when the round is shorter than the song', () => {
    const qs = buildLyricQuestions(DEMO_SONG, createRng(9), { count: 2, misses: { 5: 3, 6: 1 } });
    expect(qs.map((q) => q.lineIndex).sort()).toEqual([5, 6]);
  });
});

describe('lyricPoints', () => {
  it('rewards speed and streak, nothing for wrong answers', () => {
    expect(lyricPoints(false, 10, 15, 3)).toBe(0);
    expect(lyricPoints(true, 15, 15, 0)).toBe(200);
    expect(lyricPoints(true, 0, 15, 10)).toBe(200);
  });
});

describe('import / export', () => {
  it('round-trips and validates every line', () => {
    const file = exportSongs([DEMO_SONG]);
    const r = importSongs(JSON.parse(JSON.stringify(file)));
    expect(r.errors).toEqual([]);
    expect(r.songs[0].lines).toEqual(DEMO_SONG.lines);
    expect(importSongs({ format: 'x' }).songs).toHaveLength(0);
    const bad = importSongs({ format: 'haneul-lyrics', version: 1, songs: [{ title: 'x', lines: [{ ko: 'hi', th: 'สวัสดี' }] }] });
    expect(bad.songs).toHaveLength(0);
    expect(bad.errors.length).toBe(1);
  });
});
