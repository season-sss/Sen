import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, Flame, Music2, Pencil, Play, Plus, RotateCcw, Trash2, Trophy, Upload, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Notice } from '@/components/ui/States';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Tabs';
import { SpeakButton } from '@/components/ui/Korean';
import { toast } from '@/components/ui/Toast';
import { BUILTIN_SONGS } from '@/data/lyrics/songs';
import { buildLyricQuestions, canPlay, exportSongs, importSongs, lyricPoints, parseLyrics, serializeLyrics, uniqueLines, type LyricQuestion } from '@/lib/lyrics/engine';
import type { Song } from '@/lib/lyrics/types';
import { useLyrics } from '@/store/lyrics';
import { useProgress } from '@/store/progress';
import { createRng, randomSeed } from '@/lib/util/random';
import type { AnswerRecord } from '@/lib/quiz/types';

const CIRCLED = ['①', '②', '③', '④'];

interface PlayConfig {
  song: Song;
  rounds: number | 'all';
  order: 'song' | 'random';
  seconds: number;
  only?: number[];
}

interface Answer {
  q: LyricQuestion;
  given: number | null;
  points: number;
}

export default function LyricsGame() {
  const userSongs = useLyrics((s) => s.songs);
  const songs = useMemo(() => [...userSongs, ...BUILTIN_SONGS], [userSongs]);
  const [play, setPlay] = useState<(PlayConfig & { seed: number }) | null>(null);
  const [result, setResult] = useState<{ cfg: PlayConfig; answers: Answer[] } | null>(null);

  if (play)
    return (
      <Round
        key={play.seed}
        cfg={play}
        pool={songs}
        seed={play.seed}
        onExit={() => setPlay(null)}
        onFinish={(answers) => {
          setResult({ cfg: play, answers });
          setPlay(null);
        }}
      />
    );

  if (result)
    return (
      <Result
        result={result}
        onAgain={(only) => {
          setPlay({ ...result.cfg, only, seed: randomSeed() });
          setResult(null);
        }}
        onDone={() => setResult(null)}
      />
    );

  return <Library songs={songs} onPlay={(cfg) => setPlay({ ...cfg, seed: randomSeed() })} />;
}

// ------------------------------------------------------------------ library

function Library({ songs, onPlay }: { songs: Song[]; onPlay: (cfg: PlayConfig) => void }) {
  const { stats, addSong, updateSong, removeSong } = useLyrics();
  const userSongs = songs.filter((s) => s.source === 'user');
  const [editing, setEditing] = useState<Song | 'new' | null>(null);
  const [setup, setSetup] = useState<Song | null>(null);
  const [removing, setRemoving] = useState<Song | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Link to="/games" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Game Center
      </Link>
      <PageHeader
        eyebrow="เกมใหม่"
        title={
          <>
            Lyrics Translation{' '}
            <span lang="ko" className="ko text-lg font-semibold text-muted">
              가사 번역
            </span>
          </>
        }
        subtitle="อ่านเนื้อเพลงภาษาเกาหลีทีละท่อน แล้วเลือกคำแปลที่ถูกต้องจาก 4 ตัวเลือก ตอบไวได้คะแนนมาก ตอบถูกต่อเนื่องได้โบนัส"
        action={
          <button className="btn-primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> เพิ่มเพลง
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {songs.map((s) => {
          const st = stats[s.id];
          const n = uniqueLines(s).length;
          const playable = canPlay(s, songs);
          return (
            <Card key={s.id} className="flex flex-col p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lavender to-sky text-white">
                  <Music2 className="h-5 w-5" />
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {s.source === 'builtin' ? <Badge>ตัวอย่าง</Badge> : <Badge tone="lavender">เพลงของฉัน</Badge>}
                  {st && <Badge tone="success">สูงสุด {st.best}%</Badge>}
                </div>
              </div>
              <div className="truncate font-semibold" lang="ko">
                {s.title}
              </div>
              <div className="truncate text-xs text-muted">
                {s.artist ? `${s.artist} · ` : ''}
                {n} ท่อน{st ? ` · เล่นแล้ว ${st.plays} ครั้ง` : ''}
              </div>
              {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
              <div className="mt-3 flex flex-1 items-end gap-2">
                <button className="btn-primary btn-sm flex-1" disabled={!playable} onClick={() => setSetup(s)} title={playable ? undefined : 'ต้องมีคำแปลอย่างน้อย 4 แบบ (รวมกับเพลงอื่น)'}>
                  <Play className="h-3.5 w-3.5" /> เล่น
                </button>
                {s.source === 'user' && (
                  <>
                    <button className="btn-secondary btn-sm" onClick={() => setEditing(s)} aria-label={`แก้ไข ${s.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="btn-ghost btn-sm text-danger" onClick={() => setRemoving(s)} aria-label={`ลบ ${s.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {userSongs.length === 0 && (
        <EmptyState
          className="mt-4"
          icon={<Music2 className="h-6 w-6" />}
          title="ยังไม่มีเพลงของคุณ"
          message="กด “เพิ่มเพลง” แล้ววางเนื้อเพลงภาษาเกาหลีพร้อมคำแปลไทยทีละท่อน — ระหว่างนี้ลองเล่นเพลงตัวอย่างได้"
        />
      )}

      <Card className="card-pad mt-5">
        <CardHeader title="นำเข้า / ส่งออกเพลง" subtitle="แชร์รายการเพลงเป็นไฟล์ .json ให้เพื่อน หรือย้ายไปอีกบัญชี" />
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            disabled={!userSongs.length}
            onClick={() => {
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([JSON.stringify(exportSongs(userSongs), null, 2)], { type: 'application/json' }));
              a.download = `haneul-lyrics-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Download className="h-4 w-4" /> ส่งออกเพลงของฉัน
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> นำเข้าไฟล์เพลง
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const r = importSongs(JSON.parse(await f.text()));
                r.songs.forEach((s) => addSong(s));
                if (r.songs.length) toast.success(`นำเข้า ${r.songs.length} เพลง`);
                if (r.errors.length) toast.error(`ข้ามบางรายการ: ${r.errors.slice(0, 2).join(' · ')}${r.errors.length > 2 ? ` (+${r.errors.length - 2})` : ''}`);
              } catch {
                toast.error('อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ .json ที่ส่งออกจาก HANEUL');
              }
            }}
          />
        </div>
        <p className="mt-3 text-xs text-muted">เพลงที่เพิ่มเก็บในบัญชีของคุณเท่านั้น ไม่ได้เผยแพร่ให้ผู้ใช้คนอื่น · โปรดใช้เนื้อเพลงที่คุณมีสิทธิ์ใช้ และคำแปลที่ตรวจแล้ว</p>
      </Card>

      {editing && (
        <SongEditor
          song={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(data) => {
            if (editing === 'new') addSong(data);
            else updateSong(editing.id, data);
            toast.success(editing === 'new' ? 'เพิ่มเพลงแล้ว' : 'บันทึกการแก้ไขแล้ว');
            setEditing(null);
          }}
        />
      )}
      {setup && <PlaySetup song={setup} onClose={() => setSetup(null)} onStart={(cfg) => (setSetup(null), onPlay(cfg))} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`ลบเพลง “${removing?.title}”?`}
        message="เนื้อเพลง คำแปล และสถิติของเพลงนี้จะถูกลบ"
        danger
        confirmLabel="ลบเพลง"
        onConfirm={() => {
          if (removing) removeSong(removing.id);
          setRemoving(null);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ editor

const EXAMPLE = `한국어 가사 첫 줄 | คำแปลบรรทัดแรก
한국어 가사 둘째 줄 | คำแปลบรรทัดที่สอง`;

function SongEditor({ song, onClose, onSave }: { song: Song | null; onClose: () => void; onSave: (s: { title: string; artist?: string; lines: Song['lines'] }) => void }) {
  const [title, setTitle] = useState(song?.title ?? '');
  const [artist, setArtist] = useState(song?.artist ?? '');
  const [text, setText] = useState(song ? serializeLyrics(song.lines) : '');
  const parsed = useMemo(() => parseLyrics(text), [text]);
  const ok = title.trim() && parsed.lines.length > 0 && parsed.errors.length === 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={song ? 'แก้ไขเพลง' : 'เพิ่มเพลง'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn-primary" disabled={!ok} onClick={() => onSave({ title: title.trim().slice(0, 80), artist: artist.trim().slice(0, 80) || undefined, lines: parsed.lines })}>
            บันทึกเพลง ({parsed.lines.length} ท่อน)
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="song-title">
              ชื่อเพลง
            </label>
            <input id="song-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="song-artist">
              ศิลปิน (ไม่บังคับ)
            </label>
            <input id="song-artist" className="input" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={80} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="song-lines">
            เนื้อเพลง + คำแปล (ท่อนละบรรทัด)
          </label>
          <textarea id="song-lines" className="input min-h-[220px] font-mono text-[13px] leading-6" value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} />
          <p className="mt-1 text-xs text-muted">
            วางได้ 2 แบบ: <code>เกาหลี | ไทย</code> บรรทัดละคู่ (หรือคั่นด้วย Tab จาก Excel/Google Sheets) — หรือบรรทัดเกาหลีสลับกับบรรทัดคำแปลไทย · เนื้อเพลงต้องเป็นภาษาเกาหลีล้วน (ไม่มีภาษาอังกฤษปน)
          </p>
        </div>
        {text.trim() && (
          <Notice tone={parsed.errors.length ? 'danger' : 'success'}>
            {parsed.errors.length ? (
              <>
                <div className="font-semibold">ต้องแก้ {parsed.errors.length} จุด</div>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {parsed.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      {e.line ? `บรรทัด ${e.line}: ` : ''}
                      {e.message}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>ใช้ได้ {parsed.lines.length} ท่อน ✓</>
            )}
          </Notice>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ setup

function PlaySetup({ song, onClose, onStart }: { song: Song; onClose: () => void; onStart: (cfg: PlayConfig) => void }) {
  const n = uniqueLines(song).length;
  const [rounds, setRounds] = useState<'all' | '10'>(n > 10 ? '10' : 'all');
  const [order, setOrder] = useState<'song' | 'random'>('song');
  const [timed, setTimed] = useState<'off' | '15'>('15');
  return (
    <Modal open onClose={onClose} title={song.title} size="sm">
      <div className="space-y-4">
        {n > 10 && (
          <div>
            <div className="label">จำนวนท่อน</div>
            <Segmented<'all' | '10'>
              value={rounds}
              onChange={setRounds}
              options={[
                { id: '10', label: '10 ท่อน' },
                { id: 'all', label: `ทั้งเพลง (${n})` },
              ]}
            />
            {rounds === '10' && <p className="mt-1 text-xs text-muted">เลือกท่อนที่เคยตอบผิดก่อน</p>}
          </div>
        )}
        <div>
          <div className="label">ลำดับ</div>
          <Segmented<'song' | 'random'>
            value={order}
            onChange={setOrder}
            options={[
              { id: 'song', label: 'ตามเพลง' },
              { id: 'random', label: 'สุ่ม' },
            ]}
          />
        </div>
        <div>
          <div className="label">เวลา</div>
          <Segmented<'off' | '15'>
            value={timed}
            onChange={setTimed}
            options={[
              { id: '15', label: '15 วินาที/ท่อน' },
              { id: 'off', label: 'ไม่จับเวลา' },
            ]}
          />
        </div>
        <button className="btn-primary w-full" onClick={() => onStart({ song, rounds: rounds === 'all' ? 'all' : 10, order, seconds: timed === 'off' ? 0 : 15 })}>
          <Play className="h-4 w-4" /> เริ่มเล่น
        </button>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ round

function Round({ cfg, pool, seed, onExit, onFinish }: { cfg: PlayConfig; pool: Song[]; seed: number; onExit: () => void; onFinish: (a: Answer[]) => void }) {
  const misses = useLyrics((s) => s.stats[cfg.song.id]?.misses);
  const questions = useMemo(() => {
    const all = buildLyricQuestions(cfg.song, createRng(seed), { count: cfg.only ? undefined : cfg.rounds === 'all' ? undefined : cfg.rounds, order: cfg.order, pool, misses });
    return cfg.only ? all.filter((q) => cfg.only!.includes(q.lineIndex)) : all;
  }, [seed]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [given, setGiven] = useState<number | null | undefined>(undefined);
  const [deadline, setDeadline] = useState(() => Date.now() + cfg.seconds * 1000);
  const [now, setNow] = useState(Date.now());
  const q = questions[i];
  const answered = given !== undefined;
  const streak = useMemo(() => {
    let n = 0;
    for (let k = answers.length - 1; k >= 0 && answers[k].given === answers[k].q.answer; k--) n++;
    return n;
  }, [answers]);
  const score = answers.reduce((a, x) => a + x.points, 0);
  const left = cfg.seconds ? Math.max(0, (deadline - now) / 1000) : 0;

  const choose = useCallback(
    (opt: number | null) => {
      if (answered || !q) return;
      const correct = opt === q.answer;
      const points = lyricPoints(correct, cfg.seconds ? (deadline - Date.now()) / 1000 : cfg.seconds, cfg.seconds, streak);
      setGiven(opt);
      setAnswers((a) => [...a, { q, given: opt, points }]);
    },
    [answered, q, cfg.seconds, deadline, streak],
  );

  const next = useCallback(() => {
    if (!answered) return;
    if (i + 1 >= questions.length) {
      onFinish(answers);
      return;
    }
    setI(i + 1);
    setGiven(undefined);
    setDeadline(Date.now() + cfg.seconds * 1000);
  }, [answered, i, questions.length, onFinish, answers, cfg.seconds]);

  useEffect(() => {
    if (!cfg.seconds || answered) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [cfg.seconds, answered]);

  useEffect(() => {
    if (cfg.seconds && !answered && left <= 0) choose(null);
  }, [left, answered, cfg.seconds, choose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (['1', '2', '3', '4'].includes(e.key)) choose(Number(e.key) - 1);
      else if (e.key === 'Enter' || e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, next]);

  if (!q)
    return (
      <EmptyState
        title="ไม่มีท่อนให้เล่น"
        action={
          <button className="btn-primary" onClick={onExit}>
            กลับ
          </button>
        }
      />
    );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button className="btn-ghost btn-sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4" /> ออก
        </button>
        <div className="min-w-0 truncate text-sm font-semibold" lang="ko">
          {cfg.song.title}
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold tabular-nums">
          <span className={cn('flex items-center gap-1', streak >= 2 ? 'text-orange-500' : 'text-muted')} title="ตอบถูกต่อเนื่อง">
            <Flame className="h-4 w-4" /> {streak}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-warning" /> {score}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="shrink-0">
          ท่อน {i + 1}/{questions.length}
        </span>
        <ProgressBar value={(i + (answered ? 1 : 0)) / questions.length} />
        {cfg.seconds > 0 && (
          <span className={cn('flex shrink-0 items-center gap-1 font-semibold tabular-nums', left < 5 && !answered && 'text-danger')}>
            <Clock className="h-3.5 w-3.5" /> {answered ? '—' : Math.ceil(left)}
          </span>
        )}
      </div>

      <Card className="card-pad text-center">
        <div className="mb-1 text-xs text-muted">{q.promptTh}</div>
        <div className="flex items-center justify-center gap-3">
          <p lang="ko" className="ko text-2xl font-bold leading-relaxed text-navy sm:text-3xl">
            {q.prompt}
          </p>
          <SpeakButton text={q.prompt} size="md" />
        </div>
        {cfg.seconds > 0 && !answered && (
          <div className="mx-auto mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-surface-2">
            <div className={cn('h-full rounded-full transition-[width] duration-200', left < 5 ? 'bg-danger' : 'bg-sky')} style={{ width: `${(left / cfg.seconds) * 100}%` }} />
          </div>
        )}
      </Card>

      <div className="grid gap-2">
        {q.options.map((o, k) => {
          const isAns = answered && k === q.answer;
          const isWrong = answered && k === given && k !== q.answer;
          return (
            <button
              key={k}
              disabled={answered}
              onClick={() => choose(k)}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-4 py-3 text-left font-medium transition disabled:cursor-default',
                isAns ? 'border-success bg-success/10' : isWrong ? 'border-danger bg-danger/10' : answered ? 'border-border bg-surface opacity-60' : 'border-border bg-surface hover:border-lavender hover:bg-lavender-soft',
              )}
            >
              <span className={cn('font-bold', isAns ? 'text-success' : isWrong ? 'text-danger' : 'text-muted')}>{CIRCLED[k]}</span>
              <span className="flex-1">{o}</span>
              {isAns && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
              {isWrong && <XCircle className="h-5 w-5 shrink-0 text-danger" />}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-sm font-semibold', given === q.answer ? 'text-success' : 'text-danger')}>
            {given === q.answer ? `ถูกต้อง +${answers[answers.length - 1]?.points ?? 0}` : given === null ? 'หมดเวลา' : 'ยังไม่ถูก'}
          </span>
          <button className="btn-primary" onClick={next} autoFocus>
            {i + 1 >= questions.length ? 'ดูผล' : 'ท่อนถัดไป'} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
      <p className="text-center text-xs text-muted">คีย์ลัด: 1–4 เลือกคำตอบ · Enter ท่อนถัดไป</p>
    </div>
  );
}

// ------------------------------------------------------------------ result

function Result({ result, onAgain, onDone }: { result: { cfg: PlayConfig; answers: Answer[] }; onAgain: (only?: number[]) => void; onDone: () => void }) {
  const { cfg, answers } = result;
  const recordPlay = useLyrics((s) => s.recordPlay);
  const logAnswers = useProgress((s) => s.logAnswers);
  const correct = answers.filter((a) => a.given === a.q.answer).length;
  const pct = answers.length ? Math.round((correct / answers.length) * 100) : 0;
  const score = answers.reduce((a, x) => a + x.points, 0);
  const missed = answers.filter((a) => a.given !== a.q.answer);
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    recordPlay(
      cfg.song.id,
      pct,
      missed.map((m) => m.q.lineIndex),
    );
    const records: AnswerRecord[] = answers.map((a) => ({ questionId: a.q.id, correct: a.given === a.q.answer, given: a.given === null ? '' : a.q.options[a.given], section: 'reading', level: 'A2', tags: ['lyrics'] }));
    logAnswers(records, `game:lyrics:${cfg.song.id}`);
  }, [answers, cfg.song.id, logAnswers, missed, pct, recordPlay]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="card-pad text-center">
        <Trophy className={cn('mx-auto mb-2 h-10 w-10', pct >= 80 ? 'text-warning' : 'text-muted')} />
        <div className="text-sm text-muted" lang="ko">
          {cfg.song.title}
        </div>
        <div className="text-4xl font-extrabold tabular-nums text-navy">{score}</div>
        <div className="text-sm text-muted">
          ถูก {correct}/{answers.length} ท่อน · {pct}%
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => onAgain()}>
            <RotateCcw className="h-4 w-4" /> เล่นอีกครั้ง
          </button>
          {missed.length > 0 && (
            <button className="btn-secondary" onClick={() => onAgain(missed.map((m) => m.q.lineIndex))}>
              ฝึกท่อนที่ผิด ({missed.length})
            </button>
          )}
          <button className="btn-ghost" onClick={onDone}>
            เลือกเพลงอื่น
          </button>
        </div>
      </Card>

      {missed.length > 0 && (
        <Card className="card-pad">
          <CardHeader title="ท่อนที่ควรทบทวน" />
          <ul className="divide-y divide-border">
            {missed.map((m) => (
              <li key={m.q.id} className="flex items-start gap-3 py-3">
                <SpeakButton text={m.q.prompt} size="sm" />
                <div className="min-w-0">
                  <div lang="ko" className="ko font-semibold">
                    {m.q.prompt}
                  </div>
                  <div className="text-sm text-success">{m.q.options[m.q.answer]}</div>
                  {m.given !== null && <div className="text-xs text-muted line-through">{m.q.options[m.given]}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
