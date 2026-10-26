import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, Clock, Grid3x3, Headphones, FileText, Pause, Play, RotateCcw, Send, Trophy, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { REAL_EXAMS } from '@/data/topik/real/topik96';
import type { RealExam } from '@/data/topik/real/types';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ErrorState, Notice } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/Progress';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Tabs';
import { AnswerSheet, ExamAudio, RealQuestionView } from '@/components/topik/RealExamParts';
import { CIRCLED, formatClock, groupById, PART_LABEL, partMinutes, questionsFor, scoreExam, sectionOf, toRecords, type ExamPart, type ExamScore } from '@/lib/topik/real';
import { useExamDraft, useExams, type RealExamDraft } from '@/store/history';
import { useProgress } from '@/store/progress';
import { usePlanner } from '@/store/planner';
import { formatThaiDate, toISODate } from '@/lib/util/date';

type Mode = RealExamDraft['mode'];

interface Finished {
  part: ExamPart;
  mode: Mode;
  only?: number[];
  answers: Record<number, number>;
  score: ExamScore;
  durationSec: number;
}

export default function RealExamPage() {
  const { examId } = useParams();
  const exam = REAL_EXAMS.find((e) => e.id === examId);
  const draft = useExamDraft((s) => s.draft);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [review, setReview] = useState<{ index: number } | null>(null);

  if (!exam)
    return (
      <ErrorState
        title="ไม่พบข้อสอบนี้"
        message="ลิงก์อาจไม่ถูกต้อง"
        action={
          <Link className="btn-primary" to="/topik">
            กลับ TOPIK Center
          </Link>
        }
      />
    );

  if (finished && review)
    return (
      <Runner
        exam={exam}
        part={finished.part}
        only={finished.only}
        mode="review"
        answers={finished.answers}
        flags={[]}
        index={review.index}
        onIndex={(index) => setReview({ index })}
        startedAt={0}
        onExit={() => setReview(null)}
      />
    );

  if (finished) return <Result exam={exam} f={finished} onReview={(index) => setReview({ index })} onDone={() => setFinished(null)} />;

  if (draft && draft.examId === exam.id) return <DraftRunner exam={exam} draft={draft} onFinished={setFinished} />;

  return <Intro exam={exam} />;
}

// ------------------------------------------------------------------ intro

function Intro({ exam }: { exam: RealExam }) {
  const [part, setPart] = useState<ExamPart>('full');
  const [mode, setMode] = useState<Mode>('exam');
  const setDraft = useExamDraft((s) => s.setDraft);
  const attempts = useExams((s) => s.attempts).filter((a) => a.real?.examId === exam.id).slice().reverse();
  const best = attempts.filter((a) => a.real?.part === 'full').reduce<number | null>((m, a) => Math.max(m ?? 0, a.real!.score), null);

  const parts: { id: ExamPart; icon: typeof Clock; n: number }[] = [
    { id: 'full', icon: BookOpenCheck, n: exam.questions.length },
    { id: 'listening', icon: Headphones, n: questionsFor(exam, 'listening').length },
    { id: 'reading', icon: FileText, n: questionsFor(exam, 'reading').length },
  ];

  return (
    <div>
      <Link to="/topik" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> TOPIK Center
      </Link>
      <PageHeader eyebrow="ข้อสอบจริง · Past paper" title={exam.titleTh} subtitle={<span lang="ko">{exam.title} — 듣기 1–30 · 읽기 31–70</span>} />

      <Notice className="mb-5">
        <ShieldCheck className="mr-1 inline h-4 w-4 text-sky" />
        คำถามคัดลอกจากเอกสารข้อสอบจริงที่ผู้ดูแลเว็บจัดเตรียม และตรวจเฉลย/คะแนนรายข้อกับ 정답 및 배점표 ทางการแล้ว · ที่มา: {exam.source} · ลิขสิทธิ์ข้อสอบเป็นของหน่วยงานผู้จัดสอบ
        คำแปลและคำอธิบายภาษาไทยเป็นบันทึกการเรียนของ HANEUL
      </Notice>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader title="เลือกชุดที่จะทำ" subtitle="เวลาตามข้อสอบจริง: ฟัง 40 นาที · อ่าน 60 นาที" />
          <div className="grid gap-2 sm:grid-cols-3">
            {parts.map((p) => (
              <button
                key={p.id}
                onClick={() => setPart(p.id)}
                aria-pressed={part === p.id}
                className={cn('rounded-xl border p-3 text-left transition', part === p.id ? 'border-lavender bg-lavender-soft' : 'border-border bg-surface hover:bg-surface-2')}
              >
                <p.icon className={cn('mb-1.5 h-5 w-5', part === p.id ? 'text-lavender' : 'text-muted')} />
                <div className="text-sm font-semibold">{PART_LABEL[p.id]}</div>
                <div className="text-xs text-muted">
                  {p.n} ข้อ · {partMinutes(exam, p.id)} นาที
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="label">รูปแบบ</div>
            <Segmented<Mode>
              value={mode}
              onChange={setMode}
              options={[
                { id: 'exam', label: 'สอบเสมือนจริง' },
                { id: 'practice', label: 'ฝึกทีละข้อ' },
              ]}
            />
            <p className="mt-1.5 text-xs text-muted">
              {mode === 'exam' ? 'จับเวลา ส่งอัตโนมัติเมื่อหมดเวลา เปลี่ยนคำตอบได้จนกว่าจะส่ง เฉลยหลังส่ง' : 'ไม่จับเวลา เห็นเฉลย คำแปลไทย และคำอธิบายทันทีหลังตอบแต่ละข้อ'}
            </p>
          </div>

          {part !== 'reading' && (
            <Notice className="mt-4" tone="warning">
              <Headphones className="mr-1 inline h-4 w-4" /> ส่วนการฟังต้องเปิดไฟล์เสียงของข้อสอบ (มีเครื่องเล่นอยู่บนหน้าข้อสอบ) — ใส่หูฟังและเตรียมอินเทอร์เน็ตให้พร้อม
            </Notice>
          )}

          <button
            className="btn-primary mt-4 w-full sm:w-auto"
            onClick={() => setDraft({ examId: exam.id, part, mode, startedAt: Date.now(), answers: {}, flags: [], index: 0 })}
          >
            <Play className="h-4 w-4" /> เริ่มทำข้อสอบ
          </button>
        </Card>

        <Card className="card-pad">
          <CardHeader title="ผลที่ผ่านมา" subtitle={attempts.length ? `${attempts.length} ครั้ง${best !== null ? ` · ทั้งฉบับสูงสุด ${best}/200` : ''}` : 'ยังไม่เคยทำ'} />
          {attempts.length ? (
            <ul className="divide-y divide-border">
              {attempts.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{PART_LABEL[a.real!.part]}</div>
                    <div className="text-xs text-muted">
                      {formatThaiDate(toISODate(new Date(a.finishedAt)))} · {a.mode === 'exam' ? 'สอบเสมือนจริง' : a.mode === 'practice' ? 'ฝึก' : 'ฝึกข้อที่ผิด'}
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {a.real!.score}/{a.real!.max}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">ทำครั้งแรกเพื่อดูคะแนนแยกการฟัง/การอ่าน และเกณฑ์ระดับโดยประมาณ</p>
          )}
          <div className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">
            เกณฑ์ TOPIK I (คะแนนรวม 200): {exam.grades.map((g) => `${g.grade} ≥ ${g.min}`).join(' · ')}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ runner bound to the persisted draft

function DraftRunner({ exam, draft, onFinished }: { exam: RealExam; draft: RealExamDraft; onFinished: (f: Finished) => void }) {
  const { patch, setDraft } = useExamDraft();
  const addAttempt = useExams((s) => s.addAttempt);
  const logAnswers = useProgress((s) => s.logAnswers);
  const addMinutes = useProgress((s) => s.addMinutes);
  const submitted = useRef(false);

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    const qs = questionsFor(exam, draft.part, draft.only);
    const score = scoreExam(exam, qs, draft.answers);
    const finishedAt = Date.now();
    const durationSec = Math.round((finishedAt - draft.startedAt) / 1000);
    const records = toRecords(exam, qs, draft.answers);
    addAttempt({
      exam: 'REAL',
      mode: draft.only ? 'retry' : draft.mode,
      title: `${exam.titleTh} · ${PART_LABEL[draft.part]}`,
      startedAt: draft.startedAt,
      finishedAt,
      timeLimitSec: draft.mode === 'exam' ? partMinutes(exam, draft.part) * 60 : undefined,
      records,
      correct: score.correct,
      total: score.total,
      real: { examId: exam.id, part: draft.part, score: score.score, max: score.max, answers: draft.answers },
    });
    logAnswers(records, `topik:REAL:${exam.id}`);
    addMinutes(Math.max(1, Math.min(180, Math.round(durationSec / 60))));
    if (draft.mode === 'exam' && !draft.only) usePlanner.getState().markActivity('mock');
    setDraft(null);
    onFinished({ part: draft.part, mode: draft.mode, only: draft.only, answers: draft.answers, score, durationSec });
  }, [exam, draft, addAttempt, logAnswers, addMinutes, setDraft, onFinished]);

  return (
    <Runner
      exam={exam}
      part={draft.part}
      only={draft.only}
      mode={draft.mode}
      answers={draft.answers}
      flags={draft.flags}
      index={draft.index}
      startedAt={draft.startedAt}
      onIndex={(index) => patch({ index })}
      onAnswer={(no, i) => patch({ answers: { ...draft.answers, [no]: i } })}
      onFlag={(no) => patch({ flags: draft.flags.includes(no) ? draft.flags.filter((x) => x !== no) : [...draft.flags, no] })}
      onSubmit={submit}
      onDiscard={() => setDraft(null)}
    />
  );
}

// ------------------------------------------------------------------ runner (exam / practice / review)

function Runner({
  exam,
  part,
  only,
  mode,
  answers,
  flags,
  index,
  startedAt,
  onIndex,
  onAnswer,
  onFlag,
  onSubmit,
  onDiscard,
  onExit,
}: {
  exam: RealExam;
  part: ExamPart;
  only?: number[];
  mode: Mode | 'review';
  answers: Record<number, number>;
  flags: number[];
  index: number;
  startedAt: number;
  onIndex: (i: number) => void;
  onAnswer?: (no: number, option: number) => void;
  onFlag?: (no: number) => void;
  onSubmit?: () => void;
  onDiscard?: () => void;
  onExit?: () => void;
}) {
  const navigate = useNavigate();
  const questions = useMemo(() => questionsFor(exam, part, only), [exam, part, only]);
  const groups = useMemo(() => groupById(exam), [exam]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<'submit' | 'discard' | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const i = Math.min(index, questions.length - 1);
  const q = questions[i];
  const group = groups.get(q.groupId)!;
  const reviewing = mode === 'review';
  const reveal = reviewing || (mode === 'practice' && answers[q.no] !== undefined);
  const hasListening = questions.some((x) => sectionOf(exam, x) === 'listening');
  const isListening = sectionOf(exam, q) === 'listening';
  const answered = questions.filter((x) => answers[x.no] !== undefined).length;

  const limitSec = mode === 'exam' && !only ? partMinutes(exam, part) * 60 : null;
  const elapsed = Math.floor((now - startedAt) / 1000);
  const remaining = limitSec !== null ? limitSec - elapsed : null;

  useEffect(() => {
    if (reviewing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [reviewing]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0) onSubmit?.();
  }, [remaining, onSubmit]);

  const go = useCallback((n: number) => onIndex(Math.max(0, Math.min(questions.length - 1, n))), [onIndex, questions.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;
      if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (['1', '2', '3', '4'].includes(e.key) && onAnswer && !reveal) onAnswer(q.no, Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, i, onAnswer, q.no, reveal]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [i]);

  const sheet = <AnswerSheet questions={questions} answers={answers} flags={flags} current={i} reveal={reviewing} onJump={(n) => (go(n), setSheetOpen(false))} />;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-5">
      <div className="min-w-0 space-y-4">
        {/* toolbar */}
        <div className="sticky top-[56px] z-20 -mx-4 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:mx-0 lg:rounded-2xl lg:border lg:bg-surface/90 lg:px-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {reviewing ? 'เฉลยและคำอธิบาย' : mode === 'exam' ? 'สอบเสมือนจริง' : 'ฝึกทีละข้อ'} · {PART_LABEL[part]}
                {only ? ' · ข้อที่ผิด' : ''}
              </div>
              <div className="text-xs text-muted">
                ข้อ {q.no} ({i + 1}/{questions.length}) · ตอบแล้ว {answered}
              </div>
            </div>
            {!reviewing && (
              <div className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums', remaining !== null && remaining < 300 ? 'bg-danger/10 text-danger' : 'bg-surface-2')} aria-live="off">
                <Clock className="h-4 w-4" /> {remaining !== null ? formatClock(remaining) : formatClock(elapsed)}
              </div>
            )}
            <button className="btn-secondary btn-sm lg:hidden" onClick={() => setSheetOpen(true)} aria-label="กระดาษคำตอบ">
              <Grid3x3 className="h-4 w-4" />
            </button>
            {reviewing ? (
              <button className="btn-secondary btn-sm" onClick={onExit}>
                สรุปผล
              </button>
            ) : (
              <button className="btn-primary btn-sm" onClick={() => setConfirm('submit')}>
                <Send className="h-4 w-4" /> ส่ง
              </button>
            )}
          </div>
          <ProgressBar className="mt-2 h-1" value={answered / questions.length} />
        </div>

        {hasListening && (
          <div className={cn(!isListening && 'hidden')}>
            <ExamAudio exam={exam} />
          </div>
        )}

        <Card className="card-pad">
          <RealQuestionView
            q={q}
            group={group}
            selected={answers[q.no]}
            reveal={reveal}
            flagged={flags.includes(q.no)}
            showGroup
            onSelect={onAnswer && !reveal ? (o) => onAnswer(q.no, o) : undefined}
            onFlag={onFlag && !reviewing ? () => onFlag(q.no) : undefined}
          />
        </Card>

        <div className="flex items-center justify-between gap-2">
          <button className="btn-secondary" onClick={() => go(i - 1)} disabled={i === 0}>
            <ArrowLeft className="h-4 w-4" /> ก่อนหน้า
          </button>
          <span className="hidden text-xs text-muted sm:block">คีย์ลัด: 1–4 เลือกคำตอบ · ←/→ เปลี่ยนข้อ</span>
          {i < questions.length - 1 ? (
            <button className="btn-primary" onClick={() => go(i + 1)}>
              ข้อถัดไป <ArrowRight className="h-4 w-4" />
            </button>
          ) : reviewing ? (
            <button className="btn-primary" onClick={onExit}>
              ดูสรุปผล
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setConfirm('submit')}>
              <Send className="h-4 w-4" /> ส่งคำตอบ
            </button>
          )}
        </div>

        {!reviewing && (
          <div className="flex flex-wrap justify-center gap-2 pt-2 text-sm">
            <button className="btn-ghost btn-sm" onClick={() => navigate('/topik')}>
              <Pause className="h-4 w-4" /> พักไว้ก่อน
            </button>
            <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm('discard')}>
              ยกเลิกการสอบครั้งนี้
            </button>
          </div>
        )}
        {!reviewing && mode === 'exam' && <p className="text-center text-xs text-muted">พักไว้ได้ คำตอบถูกบันทึกในเครื่อง แต่เวลายังเดินต่อเหมือนห้องสอบจริง</p>}
      </div>

      <aside className="hidden lg:block">
        <div className="card card-pad sticky top-4">
          <div className="mb-3 text-sm font-semibold">กระดาษคำตอบ</div>
          {sheet}
        </div>
      </aside>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="กระดาษคำตอบ">
        {sheet}
      </Modal>

      <ConfirmDialog
        open={confirm === 'submit'}
        onClose={() => setConfirm(null)}
        title="ส่งคำตอบ?"
        message={answered < questions.length ? `ยังไม่ได้ตอบ ${questions.length - answered} ข้อ — ข้อที่ไม่ได้ตอบจะนับเป็น 0 คะแนน` : 'ตอบครบทุกข้อแล้ว'}
        confirmLabel="ส่งคำตอบ"
        onConfirm={() => {
          setConfirm(null);
          onSubmit?.();
        }}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title="ยกเลิกการสอบครั้งนี้?"
        message="คำตอบที่ทำไว้ในครั้งนี้จะถูกลบ และไม่บันทึกผล"
        danger
        confirmLabel="ยกเลิกการสอบ"
        onConfirm={() => {
          setConfirm(null);
          onDiscard?.();
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ result

function Result({ exam, f, onReview, onDone }: { exam: RealExam; f: Finished; onReview: (index: number) => void; onDone: () => void }) {
  const setDraft = useExamDraft((s) => s.setDraft);
  const questions = questionsFor(exam, f.part, f.only);
  const { score } = f;
  const pct = score.max ? score.score / score.max : 0;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="ผลการสอบ" title={`${exam.titleTh} · ${PART_LABEL[f.part]}`} subtitle={`ใช้เวลา ${formatClock(f.durationSec)} · ถูก ${score.correct}/${score.total} ข้อ`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-pad flex flex-col items-center justify-center text-center">
          <Trophy className={cn('mb-2 h-8 w-8', pct >= 0.7 ? 'text-warning' : 'text-muted')} />
          <div className="text-4xl font-extrabold tabular-nums text-navy">
            {score.score}
            <span className="text-lg font-semibold text-muted">/{score.max}</span>
          </div>
          <div className="text-sm text-muted">คะแนนตามน้ำหนักข้อของข้อสอบจริง</div>
          {score.grade && (
            <Badge tone={score.grade === 'ไม่ผ่านเกณฑ์' ? 'warning' : 'success'} className="mt-3">
              ระดับโดยประมาณ: {score.grade}
            </Badge>
          )}
          {!score.grade && f.part !== 'full' && <p className="mt-2 text-xs text-muted">ระดับ (급) คิดจากคะแนนรวมทั้งฉบับ — ทำทั้งฉบับเพื่อดูระดับโดยประมาณ</p>}
        </Card>

        <Card className="card-pad lg:col-span-2">
          <CardHeader title="คะแนนแยกส่วน" />
          <div className="space-y-4">
            {score.sections.map((s) => (
              <div key={s.section}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{s.section === 'listening' ? 'การฟัง 듣기' : 'การอ่าน 읽기'}</span>
                  <span className="tabular-nums text-muted">
                    {s.score}/{s.max} คะแนน · ถูก {s.correct}/{s.total}
                    {s.answered < s.total ? ` · ไม่ได้ตอบ ${s.total - s.answered}` : ''}
                  </span>
                </div>
                <ProgressBar value={s.max ? s.score / s.max : 0} tone={s.max && s.score / s.max >= 0.7 ? 'success' : 'warning'} />
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            เกณฑ์จริง: TOPIK I คะแนนรวม 200 · {exam.grades.map((g) => `${g.grade} ≥ ${g.min}`).join(' · ')} — เป็นการประเมินจากข้อสอบฉบับนี้ฉบับเดียว ไม่ใช่ผลสอบทางการ
          </p>
        </Card>
      </div>

      <Card className="card-pad">
        <CardHeader title={score.wrong.length ? `ข้อที่ผิดหรือไม่ได้ตอบ (${score.wrong.length})` : 'ถูกทุกข้อ 🎉'} subtitle="แตะเลขข้อเพื่อดูเฉลย คำแปล และคำอธิบาย" />
        {score.wrong.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {score.wrong.map((no) => {
              const qi = questions.findIndex((q) => q.no === no);
              const a = f.answers[no];
              return (
                <button key={no} className="chip" onClick={() => onReview(qi)}>
                  <span className="font-semibold">{no}</span>
                  <span className="text-muted">
                    {a === undefined ? '—' : CIRCLED[a]} → {CIRCLED[questions[qi].answer]}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => onReview(0)}>
            <BookOpenCheck className="h-4 w-4" /> ดูเฉลยทั้งชุด
          </button>
          {score.wrong.length > 0 && (
            <button
              className="btn-secondary"
              onClick={() => {
                onDone();
                setDraft({ examId: exam.id, part: f.part, mode: 'practice', only: score.wrong, startedAt: Date.now(), answers: {}, flags: [], index: 0 });
              }}
            >
              <RotateCcw className="h-4 w-4" /> ฝึกเฉพาะข้อที่ผิด
            </button>
          )}
          <button className="btn-ghost" onClick={onDone}>
            ทำชุดใหม่
          </button>
          <Link className="btn-ghost" to="/topik">
            กลับ TOPIK Center
          </Link>
        </div>
      </Card>
    </div>
  );
}
