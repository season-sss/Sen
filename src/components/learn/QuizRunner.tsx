import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Clock, Eye, Layers, RotateCcw, Trophy, Headphones } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AnswerRecord, Question, WritingQuestion } from '@/lib/quiz/types';
import { grade, checkWriting, WRITING_RUBRIC, countChars } from '@/lib/quiz/grading';
import { buildReport, SECTION_LABEL, PASS_RATIO } from '@/lib/quiz/report';
import { useProgress } from '@/store/progress';
import { useFlashcards } from '@/store/flashcards';
import { useExams } from '@/store/history';
import { SpeakButton } from '@/components/ui/Korean';
import { useTtsAvailable } from '@/hooks/useTts';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { shuffle } from '@/lib/util/random';

export interface QuizResult {
  records: AnswerRecord[];
  correct: number;
  total: number;
  durationSec: number;
}

interface Props {
  questions: Question[];
  mode?: 'practice' | 'exam';
  title?: string;
  source: string;
  timeLimitSec?: number;
  onFinish?: (r: QuizResult) => void;
  onExit?: () => void;
  /** Hide the built-in result screen (caller renders its own) */
  hideResults?: boolean;
}

type Given = number | string | string[];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function QuizRunner({ questions, mode = 'practice', title, source, timeLimitSec, onFinish, onExit, hideResults }: Props) {
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<Record<string, Given>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [writingScores, setWritingScores] = useState<Record<string, number>>({});
  const [done, setDone] = useState<QuizResult | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const logAnswers = useProgress((s) => s.logAnswers);
  const addMinutes = useProgress((s) => s.addMinutes);

  const q = questions[index];
  const remaining = timeLimitSec ? Math.max(0, timeLimitSec - Math.floor((now - startedAt) / 1000)) : null;

  useEffect(() => {
    if (!timeLimitSec || done) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timeLimitSec, done]);

  const finish = () => {
    if (done) return;
    const records: AnswerRecord[] = questions.map((qq) => {
      const g = given[qq.id];
      if (qq.kind === 'writing') {
        const score = writingScores[qq.id] ?? 0;
        return { questionId: qq.id, correct: score >= PASS_RATIO, score, given: String(g ?? ''), section: qq.section, level: qq.level, ref: qq.ref, tags: qq.tags };
      }
      const r = g === undefined ? { correct: false } : grade(qq, g);
      return { questionId: qq.id, correct: r.correct, given: Array.isArray(g) ? g.join(' ') : String(g ?? ''), section: qq.section, level: qq.level, ref: qq.ref, tags: qq.tags };
    });
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    const result = { records, correct: records.filter((r) => r.correct).length, total: records.length, durationSec };
    logAnswers(records, source, questions);
    addMinutes(Math.max(1, Math.round(durationSec / 60)));
    setDone(result);
    onFinish?.(result);
  };

  useEffect(() => {
    if (remaining === 0 && !done) {
      toast.warning('หมดเวลา — ส่งคำตอบอัตโนมัติแล้ว');
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (!questions.length) return <Notice>ยังไม่มีคำถามสำหรับหัวข้อนี้</Notice>;
  if (done) return hideResults ? null : <QuizResults questions={questions} result={done} given={given} onRetry={onExit} />;

  const answered = given[q.id] !== undefined && (q.kind !== 'order' || (given[q.id] as string[]).length === q.tokens.length);
  const isChecked = checked[q.id];
  const last = index === questions.length - 1;

  const next = () => {
    if (last) finish();
    else setIndex(index + 1);
  };

  const onPrimary = () => {
    if (mode === 'practice' && q.kind !== 'writing' && !isChecked) {
      setChecked({ ...checked, [q.id]: true });
      return;
    }
    next();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {title && <div className="truncate text-sm font-semibold text-muted">{title}</div>}
          <div className="text-xs text-muted">
            ข้อ {index + 1} / {questions.length} · {SECTION_LABEL[q.section]}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums', remaining < 60 ? 'bg-danger/10 text-danger' : 'bg-surface-2')} aria-live="off">
              <Clock className="h-4 w-4" />
              {formatTime(remaining)}
            </span>
          )}
          {mode === 'exam' && (
            <button className="btn-secondary btn-sm" onClick={finish}>
              ส่งคำตอบ
            </button>
          )}
        </div>
      </div>
      <ProgressBar value={(index + (isChecked ? 1 : 0)) / questions.length} className="mb-5" label="ความคืบหน้าแบบทดสอบ" />

      <div className="card card-pad" key={q.id}>
        <QuestionView
          q={q}
          value={given[q.id]}
          onChange={(v) => !isChecked && setGiven({ ...given, [q.id]: v })}
          checked={Boolean(isChecked)}
          mode={mode}
          onSubmit={answered ? onPrimary : undefined}
          onWritingScore={(s) => setWritingScores({ ...writingScores, [q.id]: s })}
        />
        {isChecked && q.kind !== 'writing' && <Feedback q={q} value={given[q.id]} />}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button className="btn-ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0 || mode === 'practice'}>
          ย้อนกลับ
        </button>
        <div className="flex gap-2">
          {mode === 'practice' && !isChecked && q.kind !== 'writing' && (
            <button className="btn-ghost" onClick={next}>
              ข้าม
            </button>
          )}
          <button className="btn-primary" onClick={onPrimary} disabled={!answered && !(mode === 'exam' || q.kind === 'writing')}>
            {mode === 'practice' && !isChecked && q.kind !== 'writing' ? 'ตรวจคำตอบ' : last ? 'ดูผลลัพธ์' : 'ข้อต่อไป'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ListeningBlock({ audio, revealed }: { audio: string; revealed: boolean }) {
  const tts = useTtsAvailable();
  const [show, setShow] = useState(false);
  return (
    <div className="mb-4 rounded-xl bg-sky-soft p-4">
      <div className="flex items-center gap-3">
        <SpeakButton text={audio} size="lg" label="เล่นเสียง" />
        <div className="text-sm">
          <div className="flex items-center gap-1.5 font-semibold">
            <Headphones className="h-4 w-4" />
            ฟังเสียง
          </div>
          {!tts && <div className="text-xs text-muted">อุปกรณ์นี้ไม่มีเสียงอ่านภาษาเกาหลี — เปิดบทพูดเพื่ออ่านแทน</div>}
        </div>
        {!revealed && (
          <button className="btn-ghost btn-sm ml-auto" onClick={() => setShow(!show)}>
            <Eye className="h-4 w-4" />
            {show ? 'ซ่อนบทพูด' : 'แสดงบทพูด'}
          </button>
        )}
      </div>
      {(show || revealed) && (
        <p lang="ko" className="ko mt-3 whitespace-pre-line text-sm">
          {audio}
        </p>
      )}
    </div>
  );
}

function QuestionView({
  q,
  value,
  onChange,
  checked,
  mode,
  onSubmit,
  onWritingScore,
}: {
  q: Question;
  value: Given | undefined;
  onChange: (v: Given) => void;
  checked: boolean;
  mode: 'practice' | 'exam';
  onSubmit?: () => void;
  onWritingScore: (s: number) => void;
}) {
  const isKoPrompt = /[가-힣]/.test(q.prompt) && !/[฀-๿]/.test(q.prompt);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <LevelBadge level={q.level} />
        {q.promptTh && <span className="text-sm text-muted">{q.promptTh}</span>}
      </div>
      {q.audio && <ListeningBlock audio={q.audio} revealed={checked} />}
      {q.passage && (
        <div lang="ko" className="ko mb-4 max-h-72 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-surface-2 p-4 text-[15px] leading-relaxed">
          {q.passage}
        </div>
      )}
      <div className={cn('mb-4 whitespace-pre-line font-semibold', isKoPrompt ? 'ko text-2xl' : 'text-lg')} lang={isKoPrompt ? 'ko' : undefined}>
        {q.prompt}
      </div>

      {q.kind === 'mcq' && <McqView q={q} value={value as number | undefined} onChange={onChange} checked={checked} onSubmit={onSubmit} />}
      {q.kind === 'text' && <TextView value={(value as string) ?? ''} onChange={onChange} hint={q.hint} disabled={checked} onSubmit={onSubmit} />}
      {q.kind === 'order' && <OrderView tokens={q.tokens} value={(value as string[]) ?? []} onChange={onChange} disabled={checked} seed={q.id} />}
      {q.kind === 'writing' && <WritingView q={q} value={(value as string) ?? ''} onChange={onChange} mode={mode} onScore={onWritingScore} />}
    </div>
  );
}

function McqView({ q, value, onChange, checked, onSubmit }: { q: Extract<Question, { kind: 'mcq' }>; value?: number; onChange: (v: number) => void; checked: boolean; onSubmit?: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length && !checked) onChange(n - 1);
      if (e.key === 'Enter' && onSubmit) onSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, checked, onChange, onSubmit]);

  return (
    <div className="grid gap-2" role="radiogroup">
      {q.options.map((o, i) => {
        const selected = value === i;
        const correct = checked && i === q.answer;
        const wrong = checked && selected && i !== q.answer;
        return (
          <button
            key={i}
            role="radio"
            aria-checked={selected}
            onClick={() => !checked && onChange(i)}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
              selected && !checked && 'border-lavender bg-lavender-soft',
              !selected && !checked && 'border-border hover:border-lavender/50 hover:bg-surface-2',
              correct && 'border-success bg-success/10',
              wrong && 'border-danger bg-danger/10',
              checked && !correct && !wrong && 'border-border opacity-70',
            )}
          >
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold', selected ? 'bg-lavender text-white' : 'bg-surface-2 text-muted')}>{i + 1}</span>
            <span lang={/[가-힣]/.test(o) ? 'ko' : undefined} className="flex-1">
              {o}
            </span>
            {correct && <CheckCircle2 className="h-5 w-5 text-success" />}
            {wrong && <XCircle className="h-5 w-5 text-danger" />}
          </button>
        );
      })}
    </div>
  );
}

function TextView({ value, onChange, hint, disabled, onSubmit }: { value: string; onChange: (v: string) => void; hint?: string; disabled: boolean; onSubmit?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div>
      <input
        ref={ref}
        lang="ko"
        className="input ko text-lg"
        value={value}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="พิมพ์คำตอบภาษาเกาหลี"
        aria-label="คำตอบ"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && onSubmit) onSubmit();
        }}
      />
      {hint && <p className="mt-1.5 text-xs text-muted">คำใบ้: {hint}</p>}
    </div>
  );
}

function OrderView({ tokens, value, onChange, disabled, seed }: { tokens: string[]; value: string[]; onChange: (v: string[]) => void; disabled: boolean; seed: string }) {
  const bank = useMemo(() => {
    let s = shuffle(tokens.map((t, i) => ({ t, i })));
    if (tokens.length > 1 && s.every((x, i) => x.i === i)) s = [...s.slice(1), s[0]];
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);
  const usedIdx = new Set<number>();
  const placed = value.map((v) => {
    const b = bank.find((x) => x.t === v && !usedIdx.has(x.i));
    if (b) usedIdx.add(b.i);
    return b!;
  });
  return (
    <div>
      <div className="mb-3 flex min-h-[56px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-border p-2" aria-label="ประโยคที่เรียงแล้ว">
        {placed.length === 0 && <span className="px-2 py-2 text-sm text-muted">แตะคำด้านล่างเพื่อเรียงประโยค</span>}
        {placed.map((p, k) => (
          <button key={k} disabled={disabled} lang="ko" className="ko rounded-lg bg-lavender px-3 py-2 font-medium text-white" onClick={() => onChange(value.filter((_, j) => j !== k))}>
            {p?.t}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {bank.map((b) => (
          <button key={b.i} disabled={disabled || usedIdx.has(b.i)} lang="ko" className={cn('ko rounded-lg border border-border bg-surface px-3 py-2 font-medium', usedIdx.has(b.i) && 'opacity-30')} onClick={() => onChange([...value, b.t])}>
            {b.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function WritingView({ q, value, onChange, mode, onScore }: { q: WritingQuestion; value: string; onChange: (v: string) => void; mode: 'practice' | 'exam'; onScore: (s: number) => void }) {
  const [showModel, setShowModel] = useState(false);
  const [self, setSelf] = useState<Record<string, number>>({});
  const saveWriting = useExams((s) => s.saveWriting);
  const fb = checkWriting(q, value);
  const selfTotal = WRITING_RUBRIC.reduce((s, r) => s + (self[r.id] ?? 0), 0);
  const selfMax = WRITING_RUBRIC.reduce((s, r) => s + r.max, 0);
  const rubricDone = WRITING_RUBRIC.every((r) => self[r.id] !== undefined);

  useEffect(() => {
    // Combined score: half automatic checks, half self-assessment against the rubric.
    onScore(rubricDone ? fb.autoScore * 0.5 + (selfTotal / selfMax) * 0.5 : fb.autoScore * 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb.autoScore, selfTotal, rubricDone]);

  return (
    <div>
      <textarea
        lang="ko"
        className="input ko min-h-[220px] text-[15px] leading-relaxed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="เขียนคำตอบภาษาเกาหลีที่นี่"
        aria-label="คำตอบการเขียน"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {countChars(value)} ตัวอักษร (นับรวมช่องว่าง)
          {q.minChars || q.maxChars ? ` · กำหนด ${q.minChars ?? 0}–${q.maxChars ?? '∞'}` : ''}
        </span>
        <span>ตรวจอัตโนมัติด้วยกฎ (ไม่ใช่ AI) — โปรดประเมินตนเองตาม Rubric ด้วย</span>
      </div>

      {value.trim().length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {fb.checks.map((c) => (
            <div key={c.id} className={cn('flex items-start gap-2 rounded-xl border p-3 text-sm', c.passed ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5')}>
              {c.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
              <div>
                <div className="font-semibold">{c.label}</div>
                <div className="text-xs text-muted">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="mb-3 text-sm font-semibold">ประเมินตนเองตาม Rubric (อ้างอิงเกณฑ์ TOPIK II)</div>
        <div className="space-y-3">
          {WRITING_RUBRIC.map((r) => (
            <div key={r.id}>
              <div className="text-sm font-medium">{r.label}</div>
              <div className="mb-1.5 text-xs text-muted">{r.desc}</div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: r.max + 1 }, (_, n) => (
                  <button key={n} className={cn('chip', self[r.id] === n && 'chip-active')} onClick={() => setSelf({ ...self, [r.id]: n })} aria-pressed={self[r.id] === n}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-secondary btn-sm" onClick={() => setShowModel(!showModel)}>
          <Eye className="h-4 w-4" />
          {showModel ? 'ซ่อนคำตอบตัวอย่าง' : 'ดูคำตอบตัวอย่าง'}
        </button>
        {mode === 'practice' && (
          <button
            className="btn-secondary btn-sm"
            disabled={!value.trim()}
            onClick={() => {
              saveWriting({ questionId: q.id, text: value, autoScore: fb.autoScore, selfScores: self });
              toast.success('บันทึกงานเขียนแล้ว');
            }}
          >
            บันทึกงานเขียน
          </button>
        )}
      </div>
      {showModel && (
        <div lang="ko" className="ko mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-4 text-sm leading-relaxed">
          {q.modelAnswer}
        </div>
      )}
    </div>
  );
}

function Feedback({ q, value }: { q: Question; value: Given | undefined }) {
  if (value === undefined) return null;
  const r = grade(q, value);
  return (
    <div className={cn('mt-4 rounded-xl border p-4 text-sm animate-fade-up', r.correct ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5')} role="status">
      <div className="flex items-center gap-2 font-semibold">
        {r.correct ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-danger" />}
        {r.correct ? 'ถูกต้อง!' : 'ยังไม่ถูก'}
      </div>
      {!r.correct && (
        <div className="mt-1">
          คำตอบที่ถูก:{' '}
          <span lang="ko" className="ko font-semibold">
            {r.expected}
          </span>
        </div>
      )}
      {r.note && <div className="mt-1 text-muted">{r.note}</div>}
      {'explain' in q && q.explain && <div className="mt-2 whitespace-pre-line text-muted">{q.explain}</div>}
    </div>
  );
}

export function QuizResults({ questions, result, given, onRetry }: { questions: Question[]; result: QuizResult; given: Record<string, Given>; onRetry?: () => void }) {
  const report = buildReport(result.records);
  const ensureMistakesDeck = useFlashcards((s) => s.ensureMistakesDeck);
  const addCard = useFlashcards((s) => s.addCard);
  const wrong = questions.filter((qq) => result.records.find((r) => r.questionId === qq.id && !r.correct) && qq.kind !== 'writing');
  const passed = report.ratio >= PASS_RATIO;

  const addWrongToDeck = () => {
    const deckId = ensureMistakesDeck();
    let n = 0;
    for (const qq of wrong) {
      const expected = grade(qq, 0).expected;
      const front = qq.kind === 'mcq' && /[가-힣]/.test(qq.prompt) ? qq.prompt : qq.kind === 'order' ? qq.prompt : `${qq.prompt}`;
      const back = qq.kind === 'mcq' && /[가-힣]/.test(qq.prompt) ? expected : `${expected}${'explain' in qq && qq.explain ? `\n${qq.explain}` : ''}`;
      if (addCard(deckId, { type: 'custom', front: front.slice(0, 480), back: back.slice(0, 980), ref: { type: 'question', id: qq.id } })) n++;
    }
    toast.success(n ? `เพิ่ม ${n} การ์ดลงชุด "คำที่ตอบผิด" แล้ว` : 'การ์ดเหล่านี้อยู่ในชุดแล้ว');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card card-pad flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <ProgressRing value={report.ratio} size={112} center={<span className="text-2xl font-bold">{Math.round(report.ratio * 100)}%</span>} />
        <div className="flex-1">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <Trophy className={cn('h-5 w-5', passed ? 'text-warning' : 'text-muted')} />
            <h2 className="h2">{passed ? 'ผ่านแล้ว เยี่ยมมาก!' : 'ยังไม่ผ่านเกณฑ์ 70%'}</h2>
          </div>
          <p className="mt-1 text-sm text-muted">
            ถูก {result.correct} จาก {result.total} ข้อ · ใช้เวลา {formatTime(result.durationSec)}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            {onRetry && (
              <button className="btn-secondary btn-sm" onClick={onRetry}>
                <RotateCcw className="h-4 w-4" />
                ทำอีกครั้ง
              </button>
            )}
            {wrong.length > 0 && (
              <button className="btn-secondary btn-sm" onClick={addWrongToDeck}>
                <Layers className="h-4 w-4" />
                เพิ่มข้อที่ผิดลง Flashcards
              </button>
            )}
          </div>
        </div>
      </div>

      {report.bySection.length > 0 && (
        <div className="card card-pad">
          <h3 className="mb-3 font-semibold">ผลแยกตามทักษะ</h3>
          <div className="space-y-3">
            {report.bySection.map((s) => (
              <div key={s.section}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{SECTION_LABEL[s.section]}</span>
                  <span className="text-muted">
                    {s.correct}/{s.total}
                  </span>
                </div>
                <ProgressBar value={s.ratio} tone={s.ratio >= 0.8 ? 'success' : s.ratio >= 0.6 ? 'sky' : 'warning'} />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-success/5 p-3">
              <div className="font-semibold text-success">จุดแข็ง</div>
              <div className="text-muted">{report.strengths.length ? report.strengths.map((s) => SECTION_LABEL[s.section]).join(', ') : 'ทำต่อไปเพื่อดูจุดแข็ง'}</div>
            </div>
            <div className="rounded-xl bg-warning/5 p-3">
              <div className="font-semibold text-warning">ควรฝึกเพิ่ม</div>
              <div className="text-muted">{report.weaknesses.length ? report.weaknesses.map((s) => SECTION_LABEL[s.section]).join(', ') : 'ไม่มีส่วนที่ต่ำกว่า 60%'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card card-pad">
        <h3 className="mb-3 font-semibold">ทบทวนคำตอบ</h3>
        <ol className="space-y-3">
          {questions.map((qq, i) => {
            const rec = result.records.find((r) => r.questionId === qq.id)!;
            const g = given[qq.id];
            const shown = qq.kind === 'mcq' && typeof g === 'number' ? qq.options[g] : Array.isArray(g) ? g.join(' ') : g;
            return (
              <li key={qq.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-start gap-2">
                  {rec.correct ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
                  <div className="min-w-0 flex-1">
                    <div className="whitespace-pre-line font-medium">
                      {i + 1}. {qq.prompt}
                    </div>
                    {qq.kind !== 'writing' ? (
                      <>
                        <div className="mt-1 text-muted">
                          คำตอบของคุณ: <span lang="ko">{shown ?? '—'}</span>
                        </div>
                        {!rec.correct && (
                          <div className="mt-0.5">
                            คำตอบที่ถูก: <span lang="ko" className="ko font-semibold">{grade(qq, 0).expected}</span>
                          </div>
                        )}
                        {'explain' in qq && qq.explain && !rec.correct && <div className="mt-1 whitespace-pre-line text-xs text-muted">{qq.explain}</div>}
                      </>
                    ) : (
                      <Badge tone="lavender">คะแนนประเมิน {Math.round((rec.score ?? 0) * 100)}%</Badge>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
