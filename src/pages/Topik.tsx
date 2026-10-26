import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Headphones, FileText, PenLine, Play, RotateCcw, ExternalLink, BookOpen, BookMarked, AlertTriangle } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Notice } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/Progress';
import { QuizRunner, type QuizResult } from '@/components/learn/QuizRunner';
import { TOPIK1_LISTENING, TOPIK1_READING } from '@/data/topik/topik1';
import { TOPIK2_LISTENING, TOPIK2_READING, TOPIK2_WRITING } from '@/data/topik/topik2';
import { TRACK3_DISCLAIMER, TRACK3_QUESTIONS } from '@/data/topik/track3';
import { GRAMMAR } from '@/data/grammar';
import { VOCABULARY } from '@/data/vocabulary';
import type { Question } from '@/lib/quiz/types';
import { SECTION_LABEL } from '@/lib/quiz/report';
import { grammarQuiz, vocabQuiz } from '@/lib/quiz/generators';
import { useExams, type ExamAttempt } from '@/store/history';
import { useProgress } from '@/store/progress';
import { usePlanner } from '@/store/planner';
import { createRng, randomSeed, sample, shuffle } from '@/lib/util/random';
import { formatThaiDate, toISODate } from '@/lib/util/date';

type Exam = 'TOPIK1' | 'TOPIK2' | 'TRACK3';

const INFO: Record<Exam, { title: string; structure: string[]; levels: string }> = {
  TOPIK1: {
    title: 'TOPIK I (ระดับ 1–2)',
    structure: ['การฟัง (듣기) 30 ข้อ · 40 นาที', 'การอ่าน (읽기) 40 ข้อ · 60 นาที', 'คะแนนเต็ม 200'],
    levels: 'ระดับ 1: 80 คะแนนขึ้นไป · ระดับ 2: 140 คะแนนขึ้นไป',
  },
  TOPIK2: {
    title: 'TOPIK II (ระดับ 3–6)',
    structure: ['การฟัง (듣기) 50 ข้อ · 60 นาที', 'การเขียน (쓰기) 4 ข้อ · 50 นาที', 'การอ่าน (읽기) 50 ข้อ · 70 นาที', 'คะแนนเต็ม 300'],
    levels: 'ระดับ 3: 120+ · ระดับ 4: 150+ · ระดับ 5: 190+ · ระดับ 6: 230+',
  },
  TRACK3: {
    title: 'TOPIK III Study Track',
    structure: ['หมวดฝึกระดับต่อยอดของ HANEUL', 'สำนวน 사자성어 ระบบยกย่อง น้ำเสียง ภาษาเขียนทางการ', 'บทความยาวและการฟังระดับสูง'],
    levels: 'มุ่งช่วงคะแนนบนของ TOPIK II (ระดับ 5–6)',
  },
};

function bank(exam: Exam) {
  if (exam === 'TOPIK1') return { listening: TOPIK1_LISTENING, reading: TOPIK1_READING, writing: [] as Question[] };
  if (exam === 'TOPIK2') return { listening: TOPIK2_LISTENING, reading: TOPIK2_READING, writing: TOPIK2_WRITING as Question[] };
  return { listening: TRACK3_QUESTIONS.filter((q) => q.section === 'listening'), reading: TRACK3_QUESTIONS.filter((q) => q.section !== 'listening'), writing: [] as Question[] };
}

interface RunConfig {
  questions: Question[];
  title: string;
  mode: 'practice' | 'exam';
  timeLimitSec?: number;
  modeId: string;
}

export default function Topik() {
  const [exam, setExam] = useState<Exam>('TOPIK1');
  const [run, setRun] = useState<(RunConfig & { seed: number }) | null>(null);
  const { attempts, addAttempt } = useExams();
  const mistakes = useProgress((s) => s.mistakes);
  const b = bank(exam);

  const topikMistakes = useMemo(() => Object.values(mistakes).filter((m) => m.source.startsWith(`topik:${exam}`)).map((m) => m.question), [mistakes, exam]);
  const myAttempts = attempts.filter((a) => a.exam === exam).slice().reverse();

  const start = (cfg: RunConfig) => setRun({ ...cfg, seed: randomSeed() });

  if (run)
    return (
      <QuizRunner
        key={run.seed}
        questions={run.questions}
        title={run.title}
        mode={run.mode}
        timeLimitSec={run.timeLimitSec}
        source={`topik:${exam}:${run.modeId}`}
        onExit={() => setRun(null)}
        onFinish={(r: QuizResult) => {
          if (run.modeId === 'mock') usePlanner.getState().markActivity('mock');
          addAttempt({
            exam,
            mode: run.modeId,
            title: run.title,
            startedAt: Date.now() - r.durationSec * 1000,
            finishedAt: Date.now(),
            timeLimitSec: run.timeLimitSec,
            records: r.records,
            correct: r.correct,
            total: r.total,
          });
        }}
      />
    );

  const rng = () => createRng(randomSeed());
  const modes: { id: string; title: string; desc: string; icon: typeof Clock; disabled?: boolean; go: () => RunConfig }[] = [
    {
      id: 'practice',
      title: 'Practice Mode',
      desc: 'ไม่จับเวลา เฉลยทันทีพร้อมคำอธิบาย',
      icon: Play,
      go: () => ({ questions: shuffle([...b.listening, ...b.reading], rng()).slice(0, 15), title: `${INFO[exam].title} · Practice`, mode: 'practice', modeId: 'practice' }),
    },
    {
      id: 'mock',
      title: 'Timed Mock Test',
      desc: 'จับเวลาตามสัดส่วนข้อสอบจริง ส่งอัตโนมัติเมื่อหมดเวลา',
      icon: Clock,
      go: () => {
        const qs = [...b.listening, ...shuffle(b.reading, rng())];
        const perQ = exam === 'TOPIK1' ? 100 / 70 : 1.3;
        return { questions: qs, title: `${INFO[exam].title} · Mock Test`, mode: 'exam', timeLimitSec: Math.round(qs.length * perQ * 60), modeId: 'mock' };
      },
    },
    {
      id: 'listening',
      title: 'Listening Practice',
      desc: 'ฟังด้วยเสียงอ่านในอุปกรณ์ หรือเปิดบทพูดเมื่อไม่มีเสียง',
      icon: Headphones,
      disabled: !b.listening.length,
      go: () => ({ questions: b.listening, title: `${INFO[exam].title} · Listening`, mode: 'practice', modeId: 'listening' }),
    },
    {
      id: 'reading',
      title: 'Reading Practice',
      desc: 'ประกาศ บทความ และการเรียงลำดับ',
      icon: FileText,
      go: () => ({ questions: shuffle(b.reading, rng()), title: `${INFO[exam].title} · Reading`, mode: 'practice', modeId: 'reading' }),
    },
    {
      id: 'vocab',
      title: 'Vocabulary Drill',
      desc: exam === 'TOPIK1' ? 'คำศัพท์ A1–A2' : 'คำศัพท์ B1–B2',
      icon: BookOpen,
      go: () => ({ questions: vocabQuiz(VOCABULARY.filter((v) => (exam === 'TOPIK1' ? ['A1', 'A2'] : ['B1', 'B2']).includes(v.level)), rng(), 15), title: `${INFO[exam].title} · Vocabulary`, mode: 'practice', modeId: 'vocab' }),
    },
    {
      id: 'grammar',
      title: 'Grammar Drill',
      desc: exam === 'TOPIK1' ? 'ไวยากรณ์ A1–A2' : exam === 'TOPIK2' ? 'ไวยากรณ์ B1–B2' : 'ไวยากรณ์ขั้นสูง',
      icon: BookMarked,
      go: () => {
        const r = rng();
        const levels = exam === 'TOPIK1' ? ['A1', 'A2'] : exam === 'TOPIK2' ? ['B1', 'B2'] : ['ADV', 'B2'];
        return { questions: sample(GRAMMAR.filter((g) => levels.includes(g.level)).flatMap((g) => grammarQuiz(g, r)), 15, r), title: `${INFO[exam].title} · Grammar`, mode: 'practice', modeId: 'grammar' };
      },
    },
    {
      id: 'writing',
      title: 'Writing Practice',
      desc: 'ข้อ 51–54 พร้อม Rubric และการตรวจด้วยกฎ',
      icon: PenLine,
      disabled: exam !== 'TOPIK2',
      go: () => ({ questions: b.writing, title: 'TOPIK II · Writing 51–54', mode: 'practice', modeId: 'writing' }),
    },
    {
      id: 'review',
      title: 'Review Incorrect Answers',
      desc: `ข้อที่ผิดใน ${exam === 'TRACK3' ? 'Study Track' : exam} ที่ยังไม่ได้แก้ (${topikMistakes.length})`,
      icon: RotateCcw,
      disabled: !topikMistakes.length,
      go: () => ({ questions: topikMistakes, title: 'ทบทวนข้อที่ผิด', mode: 'practice', modeId: 'review' }),
    },
  ];

  const sectionTotals = (list: ExamAttempt[]) => {
    const m = new Map<string, { c: number; t: number }>();
    for (const a of list)
      for (const r of a.records) {
        const s = m.get(r.section) ?? { c: 0, t: 0 };
        s.t++;
        if (r.correct) s.c++;
        m.set(r.section, s);
      }
    return [...m.entries()];
  };

  return (
    <div>
      <PageHeader title="TOPIK Center" subtitle="ฝึกข้อสอบรูปแบบ TOPIK ด้วยข้อสอบที่เขียนขึ้นใหม่ — ไม่ใช่ข้อสอบจริงจากการสอบที่ผ่านมา" />
      <Tabs
        className="mb-5"
        value={exam}
        onChange={setExam}
        tabs={[
          { id: 'TOPIK1', label: 'TOPIK I' },
          { id: 'TOPIK2', label: 'TOPIK II' },
          { id: 'TRACK3', label: 'TOPIK III Study Track' },
        ]}
      />

      {exam === 'TRACK3' && (
        <Notice tone="warning" className="mb-4">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {TRACK3_DISCLAIMER}
        </Notice>
      )}

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader title={INFO[exam].title} subtitle={INFO[exam].levels} />
          <ul className="grid gap-2 sm:grid-cols-2">
            {INFO[exam].structure.map((s) => (
              <li key={s} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <Badge>คลังข้อสอบ: ฟัง {b.listening.length} · อ่าน {b.reading.length}{b.writing.length ? ` · เขียน ${b.writing.length}` : ''} ข้อ</Badge>
            {exam !== 'TRACK3' && (
              <a className="inline-flex items-center gap-1 text-lavender hover:underline" href="https://www.topik.go.kr" target="_blank" rel="noreferrer">
                ตรวจสอบข้อมูลการสอบล่าสุดที่เว็บไซต์ทางการ <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </Card>
        <Card className="card-pad">
          <CardHeader title="ผลการฝึกล่าสุด" subtitle={myAttempts.length ? `${myAttempts.length} ครั้ง` : 'ยังไม่มีประวัติ'} />
          {myAttempts.length ? (
            <div className="space-y-2">
              {sectionTotals(myAttempts.slice(0, 10)).map(([sec, v]) => (
                <div key={sec}>
                  <div className="flex justify-between text-sm">
                    <span>{SECTION_LABEL[sec as keyof typeof SECTION_LABEL]}</span>
                    <span className="text-muted">{Math.round((v.c / v.t) * 100)}%</span>
                  </div>
                  <ProgressBar value={v.c / v.t} tone={v.c / v.t >= 0.7 ? 'success' : 'warning'} />
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">จาก 10 ครั้งล่าสุด — ส่วนที่ต่ำกว่า 70% ควรฝึกเพิ่ม</p>
            </div>
          ) : (
            <p className="text-sm text-muted">เริ่มฝึกเพื่อดูจุดแข็งและจุดอ่อนแยกตามทักษะ</p>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((m) => (
          <button key={m.id} disabled={m.disabled} onClick={() => start(m.go())} className="card flex flex-col items-start p-4 text-left transition hover:shadow-lift disabled:opacity-50">
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-sky-soft text-sky">
              <m.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold">{m.title}</div>
            <div className="mt-0.5 text-xs text-muted">{m.disabled && m.id === 'writing' ? 'การเขียนมีเฉพาะ TOPIK II' : m.desc}</div>
          </button>
        ))}
      </div>

      <Card className="card-pad mt-5">
        <CardHeader title="ประวัติการฝึก" />
        {myAttempts.length === 0 ? (
          <EmptyState title="ยังไม่มีประวัติการทำข้อสอบ" />
        ) : (
          <ul className="divide-y divide-border">
            {myAttempts.slice(0, 15).map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.title}</div>
                  <div className="text-xs text-muted">
                    {formatThaiDate(toISODate(new Date(a.finishedAt)))} · {Math.round((a.finishedAt - a.startedAt) / 60000)} นาที
                  </div>
                </div>
                <span className={a.correct / a.total >= 0.7 ? 'font-semibold text-success' : 'font-semibold text-warning'}>
                  {a.correct}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-4 text-xs text-muted">
        โครงสร้างข้อสอบและเกณฑ์คะแนนเป็นข้อมูลอ้างอิงทั่วไปของ TOPIK (Test of Proficiency in Korean) อาจมีการเปลี่ยนแปลง โปรดตรวจสอบจากหน่วยงานผู้จัดสอบ ·{' '}
        <Link to="/practice" className="text-lavender hover:underline">
          ฝึกแยกทักษะเพิ่มเติมใน Practice Zone
        </Link>
      </p>
    </div>
  );
}
