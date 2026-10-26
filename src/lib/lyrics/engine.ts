import type { McqQuestion } from '@/lib/quiz/types';
import { shuffle, type Rng } from '@/lib/util/random';
import type { LyricLine, Song } from './types';

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
/** Anything that is not Hangul, a digit, whitespace or common punctuation. */
const NOT_ALLOWED = /[^가-힣ᄀ-ᇿ㄰-㆏0-9\s.,!?~…·'"“”‘’()\-–—:;♪]/u;

export const MAX_LINE = 120;
export const MAX_LINES_PER_SONG = 200;

/** Lyric lines must be Korean only (Hangul, digits, spaces and punctuation). */
export function checkKoreanLine(line: string): { ok: true } | { ok: false; reason: string } {
  const t = line.trim();
  if (!t) return { ok: false, reason: 'บรรทัดว่าง' };
  if (t.length > MAX_LINE) return { ok: false, reason: `ยาวเกิน ${MAX_LINE} ตัวอักษร` };
  if (!HANGUL.test(t)) return { ok: false, reason: 'ไม่มีอักษรเกาหลี' };
  const bad = t.match(NOT_ALLOWED);
  if (bad) return { ok: false, reason: `มีตัวอักษรที่ไม่ใช่ภาษาเกาหลี: “${bad[0]}”` };
  return { ok: true };
}

export function checkThaiLine(line: string): { ok: true } | { ok: false; reason: string } {
  const t = line.trim();
  if (!t) return { ok: false, reason: 'ไม่มีคำแปล' };
  if (t.length > MAX_LINE * 2) return { ok: false, reason: 'คำแปลยาวเกินไป' };
  if (HANGUL.test(t)) return { ok: false, reason: 'คำแปลมีอักษรเกาหลีปนอยู่' };
  return { ok: true };
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  lines: LyricLine[];
  errors: ParseError[];
}

const SEPARATORS = ['\t', ' | ', '|', ' = '];

/**
 * Paste formats:
 *   1) one pair per line: `한국어 가사 | คำแปลไทย` (also tab or ` = `)
 *   2) alternating lines: Korean line, then its Thai translation on the next line
 * Blank lines are ignored.
 */
export function parseLyrics(text: string): ParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), no: i + 1 }))
    .filter((r) => r.raw);
  const lines: LyricLine[] = [];
  const errors: ParseError[] = [];
  const sep = SEPARATORS.find((s) => rows.length > 0 && rows.every((r) => r.raw.includes(s.trim() || s)));

  if (sep) {
    const token = sep.trim() || sep;
    for (const r of rows) {
      const at = r.raw.indexOf(token);
      const ko = r.raw.slice(0, at).trim();
      const th = r.raw.slice(at + token.length).trim();
      pushPair(lines, errors, ko, th, r.no);
    }
  } else {
    for (let i = 0; i < rows.length; i += 2) {
      const ko = rows[i];
      const th = rows[i + 1];
      if (!th) {
        errors.push({ line: ko.no, message: 'บรรทัดเกาหลีนี้ไม่มีคำแปลบรรทัดถัดไป' });
        break;
      }
      pushPair(lines, errors, ko.raw, th.raw, ko.no);
    }
  }
  if (lines.length > MAX_LINES_PER_SONG) errors.push({ line: 0, message: `เพลงหนึ่งใส่ได้ไม่เกิน ${MAX_LINES_PER_SONG} บรรทัด` });
  return { lines: lines.slice(0, MAX_LINES_PER_SONG), errors };
}

function pushPair(lines: LyricLine[], errors: ParseError[], ko: string, th: string, no: number) {
  const k = checkKoreanLine(ko);
  const t = checkThaiLine(th);
  if (!k.ok) errors.push({ line: no, message: `เนื้อเพลง: ${k.reason}` });
  else if (!t.ok) errors.push({ line: no, message: t.reason });
  else lines.push({ ko: ko.replace(/\s+/g, ' '), th: th.replace(/\s+/g, ' ') });
}

export function serializeLyrics(lines: LyricLine[]): string {
  return lines.map((l) => `${l.ko} | ${l.th}`).join('\n');
}

/** Distinct (by translation) lines, keeping the first occurrence — repeated chorus lines count once. */
export function uniqueLines(song: Song): { line: LyricLine; index: number }[] {
  const seen = new Set<string>();
  const out: { line: LyricLine; index: number }[] = [];
  song.lines.forEach((line, index) => {
    const key = `${line.ko}\u0000${line.th}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ line, index });
  });
  return out;
}

export function canPlay(song: Song, pool: Song[] = []): boolean {
  const th = new Set([...song.lines, ...pool.flatMap((s) => s.lines)].map((l) => l.th));
  return uniqueLines(song).length >= 1 && th.size >= 4;
}

export interface LyricQuestion extends McqQuestion {
  songId: string;
  lineIndex: number;
}

/**
 * One 4-choice question per lyric line: the line's Thai translation plus three other translations,
 * taken first from the same song (so the choices sound alike) and then from the other songs.
 * Lines answered wrong before (`misses`) are picked first when the round is shorter than the song.
 */
export function buildLyricQuestions(
  song: Song,
  rng: Rng,
  opts: { count?: number; order?: 'song' | 'random'; pool?: Song[]; misses?: Record<number, number> } = {},
): LyricQuestion[] {
  const items = uniqueLines(song);
  const count = Math.min(opts.count ?? items.length, items.length);
  let chosen = items;
  if (count < items.length) {
    const ranked = shuffle(items, rng).sort((a, b) => (opts.misses?.[b.index] ?? 0) - (opts.misses?.[a.index] ?? 0));
    chosen = ranked.slice(0, count);
  }
  if (opts.order === 'random') chosen = shuffle(chosen, rng);
  else chosen = [...chosen].sort((a, b) => a.index - b.index);

  const sameSong = [...new Set(song.lines.map((l) => l.th))];
  const others = [...new Set((opts.pool ?? []).filter((s) => s.id !== song.id).flatMap((s) => s.lines.map((l) => l.th)))];

  return chosen.map(({ line, index }) => {
    const distractors = [...shuffle(sameSong.filter((t) => t !== line.th), rng), ...shuffle(others.filter((t) => t !== line.th && !sameSong.includes(t)), rng)].slice(0, 3);
    const options = shuffle([line.th, ...distractors], rng);
    return {
      id: `lyric-${song.id}-${index}`,
      kind: 'mcq',
      section: 'reading',
      level: 'A2',
      prompt: line.ko,
      promptTh: 'เลือกคำแปลที่ถูกต้องของเนื้อเพลงท่อนนี้',
      options,
      answer: options.indexOf(line.th),
      songId: song.id,
      lineIndex: index,
    };
  });
}

/** Points for a correct answer: base 100 + up to 100 for speed + streak bonus (capped). */
export function lyricPoints(correct: boolean, secondsLeft: number, secondsTotal: number, streak: number): number {
  if (!correct) return 0;
  const speed = secondsTotal > 0 ? Math.round((Math.max(0, secondsLeft) / secondsTotal) * 100) : 0;
  return 100 + speed + Math.min(streak, 5) * 20;
}

export interface SongFile {
  format: 'haneul-lyrics';
  version: 1;
  songs: { title: string; artist?: string; lines: LyricLine[] }[];
}

export function exportSongs(songs: Song[]): SongFile {
  return { format: 'haneul-lyrics', version: 1, songs: songs.map((s) => ({ title: s.title, artist: s.artist, lines: s.lines })) };
}

/** Validate an imported lyrics file; every line goes through the same Korean/Thai checks. */
export function importSongs(json: unknown): { songs: { title: string; artist?: string; lines: LyricLine[] }[]; errors: string[] } {
  const errors: string[] = [];
  const f = json as Partial<SongFile>;
  if (!f || f.format !== 'haneul-lyrics' || !Array.isArray(f.songs)) return { songs: [], errors: ['ไม่ใช่ไฟล์เพลงของ HANEUL'] };
  const songs: { title: string; artist?: string; lines: LyricLine[] }[] = [];
  for (const s of f.songs.slice(0, 100)) {
    const title = String(s?.title ?? '').trim().slice(0, 80);
    if (!title || !Array.isArray(s?.lines)) {
      errors.push('ข้ามเพลงที่ไม่มีชื่อหรือไม่มีเนื้อเพลง');
      continue;
    }
    const parsed = parseLyrics(serializeLyrics(s.lines.map((l) => ({ ko: String(l?.ko ?? ''), th: String(l?.th ?? '') }))));
    parsed.errors.forEach((e) => errors.push(`${title} บรรทัด ${e.line}: ${e.message}`));
    if (parsed.lines.length) songs.push({ title, artist: s.artist ? String(s.artist).slice(0, 80) : undefined, lines: parsed.lines });
  }
  return { songs, errors };
}
