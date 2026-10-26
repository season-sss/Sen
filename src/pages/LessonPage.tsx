import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Lock, BookOpen, NotebookPen } from 'lucide-react';
import { LESSON_INDEX, ALL_LESSONS } from '@/data/curriculum';
import { lessonTopics } from '@/components/learn/LessonContent';
import { QuizRunner, type QuizResult } from '@/components/learn/QuizRunner';
import { lessonQuestions } from '@/lib/quiz/generators';
import { LevelBadge, StatusBadge } from '@/components/ui/Badge';
import { ErrorState, Notice } from '@/components/ui/States';
import { useProgress, lessonStatus } from '@/store/progress';
import { unmetPrerequisites } from '@/lib/learning';
import { cn } from '@/lib/cn';
import { randomSeed } from '@/lib/util/random';
import { useNotes } from '@/store/notes';
import { usePlanner } from '@/store/planner';
import { toast } from '@/components/ui/Toast';

type Step = { kind: 'topic'; index: number } | { kind: 'quiz' } | { kind: 'done'; result: QuizResult };

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const loc = LESSON_INDEX[lessonId];
  const navigate = useNavigate();
  const { lessons, startLesson, markTopicSeen, finishLesson, setLessonStatus } = useProgress();
  const createNote = useNotes((s) => s.createNote);
  const [step, setStep] = useState<Step>({ kind: 'topic', index: 0 });
  const [seed, setSeed] = useState(randomSeed);
  const [ignoreLock, setIgnoreLock] = useState(false);

  const topics = useMemo(() => (loc ? lessonTopics(loc.lesson) : []), [loc]);
  const questions = useMemo(() => (loc ? lessonQuestions(loc.lesson, seed) : []), [loc, seed]);

  useEffect(() => {
    setStep({ kind: 'topic', index: 0 });
    setIgnoreLock(false);
    window.scrollTo({ top: 0 });
  }, [lessonId]);

  useEffect(() => {
    if (loc && step.kind === 'topic' && topics[step.index] && (ignoreLock || !unmetPrerequisites(useProgress.getState().lessons, loc.lesson).length || lessonStatus(useProgress.getState().lessons, lessonId) !== 'not-started')) {
      startLesson(lessonId);
      markTopicSeen(lessonId, topics[step.index].id);
    }
  }, [loc, step, topics, lessonId, startLesson, markTopicSeen, ignoreLock]);

  if (!loc) return <ErrorState title="ไม่พบบทเรียน" action={<Link to="/curriculum" className="btn-primary">กลับไป Curriculum</Link>} />;

  const { lesson, unit, module, level } = loc;
  const status = lessonStatus(lessons, lesson.id);
  const unmet = unmetPrerequisites(lessons, lesson);
  const locked = unmet.length > 0 && status === 'not-started' && !ignoreLock;
  const idx = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
  const nextLesson = ALL_LESSONS[idx + 1];
  const seen = new Set(lessons[lesson.id]?.topicsSeen ?? []);

  return (
    <div className="mx-auto max-w-4xl">
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted" aria-label="ตำแหน่งบทเรียน">
        <Link to={`/curriculum?level=${level.id}`} className="hover:text-ink">
          {level.id === 'L0' ? 'Level 0' : level.id}
        </Link>
        <span>/</span>
        <span>{module.title}</span>
        <span>/</span>
        <span>{unit.title}</span>
      </nav>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <LevelBadge level={level.id} />
            <StatusBadge status={status} />
          </div>
          <h1 className="h1">{lesson.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {topics.length} หัวข้อ · แบบฝึกหัด {questions.length} ข้อ · ~{lesson.minutes} นาที
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              const id = createNote({ title: lesson.title, lessonId: lesson.id, category: 'ทั่วไป', tags: [level.id] });
              toast.success('สร้างโน้ตที่เชื่อมกับบทเรียนนี้แล้ว');
              navigate(`/notes?id=${id}`);
            }}
          >
            <NotebookPen className="h-4 w-4" /> จดโน้ต
          </button>
          {status !== 'not-started' && (
            <button className="btn-ghost btn-sm" onClick={() => setLessonStatus(lesson.id, status === 'needs-review' ? 'completed' : 'needs-review')}>
              {status === 'needs-review' ? 'ทำเครื่องหมายว่าเข้าใจแล้ว' : 'ทำเครื่องหมายควรทบทวน'}
            </button>
          )}
        </div>
      </header>

      {locked ? (
        <div className="card card-pad text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-warning" />
          <h2 className="h2">แนะนำให้เรียนบทพื้นฐานก่อน</h2>
          <p className="mt-1 text-sm text-muted">บทนี้ต่อยอดจากหัวข้อต่อไปนี้ ซึ่งยังไม่ผ่านแบบฝึกหัด (≥ 70%)</p>
          <ul className="mx-auto mt-3 max-w-sm space-y-2 text-left">
            {unmet.map((u) => (
              <li key={u.id}>
                <Link to={`/learn/${u.id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
                  {u.title} <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
          <button className="btn-ghost btn-sm mt-4" onClick={() => setIgnoreLock(true)}>
            ฉันเข้าใจหัวข้อพื้นฐานแล้ว — เรียนบทนี้เลย
          </button>
        </div>
      ) : (
        <>
          {/* Step indicator */}
          <ol className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="ขั้นตอนบทเรียน">
            {topics.map((tp, i) => (
              <li key={tp.id}>
                <button
                  onClick={() => setStep({ kind: 'topic', index: i })}
                  className={cn('chip whitespace-nowrap', step.kind === 'topic' && step.index === i && 'chip-active')}
                  aria-current={step.kind === 'topic' && step.index === i ? 'step' : undefined}
                >
                  {seen.has(tp.id) ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <BookOpen className="h-3.5 w-3.5" />}
                  {tp.title}
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => setStep({ kind: 'quiz' })} className={cn('chip whitespace-nowrap', step.kind !== 'topic' && 'chip-active')}>
                <ClipboardList className="h-3.5 w-3.5" /> แบบฝึกหัด
              </button>
            </li>
          </ol>

          {step.kind === 'topic' && topics[step.index] && (
            <div>
              <div className="card card-pad">
                <h2 className="h2 mb-4">{topics[step.index].title}</h2>
                {topics[step.index].content}
              </div>
              <div className="mt-4 flex justify-between gap-2">
                <button className="btn-ghost" disabled={step.index === 0} onClick={() => setStep({ kind: 'topic', index: step.index - 1 })}>
                  <ArrowLeft className="h-4 w-4" /> ก่อนหน้า
                </button>
                {step.index < topics.length - 1 ? (
                  <button className="btn-primary" onClick={() => setStep({ kind: 'topic', index: step.index + 1 })}>
                    หัวข้อถัดไป <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => setStep({ kind: 'quiz' })}>
                    ทำแบบฝึกหัด <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {step.kind === 'quiz' && (
            <QuizRunner
              key={seed}
              questions={questions}
              title={`แบบฝึกหัด: ${lesson.title}`}
              source={`lesson:${lesson.id}`}
              onFinish={(r) => {
                const st = finishLesson(lesson.id, r.correct, r.total);
                if (st === 'completed') usePlanner.getState().markActivity('lesson', lesson.id);
                toast[st === 'completed' ? 'success' : 'warning'](st === 'completed' ? 'ผ่านแบบฝึกหัด — บทเรียนนี้เสร็จสมบูรณ์' : 'ยังไม่ถึง 70% — บทเรียนถูกทำเครื่องหมาย "ควรทบทวน"');
                setStep({ kind: 'done', result: r });
              }}
              hideResults
            />
          )}

          {step.kind === 'done' && (
            <div className="space-y-4">
              <QuizSummary result={step.result} />
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSeed(randomSeed());
                    setStep({ kind: 'quiz' });
                  }}
                >
                  ทำแบบฝึกหัดอีกครั้ง (ชุดใหม่)
                </button>
                <button className="btn-secondary" onClick={() => setStep({ kind: 'topic', index: 0 })}>
                  ทบทวนเนื้อหา
                </button>
                {nextLesson && (
                  <Link to={`/learn/${nextLesson.id}`} className="btn-primary">
                    บทถัดไป: {nextLesson.title} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
              {unit.lessons[unit.lessons.length - 1].id === lesson.id && (
                <Notice tone="info">
                  นี่คือบทสุดท้ายของหน่วย "{unit.title}" —{' '}
                  <Link className="font-semibold text-lavender underline" to={`/assessment/unit/${unit.id}`}>
                    ทำแบบทดสอบท้ายหน่วย
                  </Link>
                </Notice>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuizSummary({ result }: { result: QuizResult }) {
  const pct = result.total ? Math.round((result.correct / result.total) * 100) : 0;
  return (
    <div className="card card-pad text-center">
      <div className={cn('text-5xl font-bold', pct >= 70 ? 'text-success' : 'text-warning')}>{pct}%</div>
      <p className="mt-1 text-sm text-muted">
        ถูก {result.correct} จาก {result.total} ข้อ — {pct >= 70 ? 'บทเรียนเสร็จสมบูรณ์' : 'ทำเครื่องหมายว่าควรทบทวน'}
      </p>
      <p className="mt-2 text-xs text-muted">ข้อที่ตอบผิดถูกบันทึกไว้ใน Practice Zone › ทบทวนข้อที่ผิด</p>
    </div>
  );
}
