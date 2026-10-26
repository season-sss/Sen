import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { CURRICULUM, lessonsOfLevel, lessonsOfUnit } from '@/data/curriculum';
import { LEVEL_INFO, type Level } from '@/data/types';
import { levelAssessment, unitAssessment } from '@/lib/quiz/generators';
import { QuizRunner } from '@/components/learn/QuizRunner';
import { ErrorState } from '@/components/ui/States';
import { PageHeader } from '@/components/ui/Card';
import { useProgress } from '@/store/progress';
import { usePlanner } from '@/store/planner';
import { PASS_RATIO } from '@/lib/quiz/report';
import { randomSeed } from '@/lib/util/random';

export default function AssessmentPage() {
  const { kind, targetId = '' } = useParams();
  const recordAssessment = useProgress((s) => s.recordAssessment);
  const [seed, setSeed] = useState(randomSeed);
  const [started, setStarted] = useState(false);

  const unit = kind === 'unit' ? CURRICULUM.flatMap((l) => l.modules.flatMap((m) => m.units)).find((u) => u.id === targetId) : undefined;
  const level = kind === 'level' ? CURRICULUM.find((l) => l.id === targetId) : undefined;
  const questions = useMemo(() => (unit ? unitAssessment(unit.id, seed) : level ? levelAssessment(level.id as Level, seed) : []), [unit, level, seed]);

  if (!unit && !level) return <ErrorState title="ไม่พบแบบทดสอบ" action={<Link className="btn-primary" to="/curriculum">กลับไป Curriculum</Link>} />;

  const title = unit ? `แบบทดสอบท้ายหน่วย: ${unit.title}` : `แบบทดสอบระดับ ${LEVEL_INFO[level!.id].label}`;
  const lessonIds = unit ? lessonsOfUnit(unit.id).map((l) => l.id) : lessonsOfLevel(level!.id).map((l) => l.id);
  const timeLimit = level ? Math.max(10, Math.round(questions.length * 1.2)) * 60 : undefined;

  if (!started)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={title} subtitle={unit ? 'สุ่มข้อสอบจากทุกบทในหน่วยนี้' : 'ครอบคลุมทุกโมดูลของระดับ พร้อมรายงานจุดแข็งและจุดอ่อน'} />
        <div className="card card-pad space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-lavender" /> {questions.length} ข้อ{timeLimit ? ` · จับเวลา ${Math.round(timeLimit / 60)} นาที` : ' · ไม่จับเวลา'}
          </div>
          <p className="text-muted">
            เกณฑ์ผ่าน {Math.round(PASS_RATIO * 100)}% — ถ้าผ่าน บทเรียนในหน่วยที่เรียนไว้จะถูกยืนยันว่า "เรียนจบแล้ว" ถ้าไม่ผ่าน บทที่เคยจบจะถูกทำเครื่องหมาย "ควรทบทวน"
          </p>
          <button className="btn-primary w-full" onClick={() => setStarted(true)}>
            เริ่มทำแบบทดสอบ
          </button>
        </div>
      </div>
    );

  return (
    <QuizRunner
      key={seed}
      questions={questions}
      mode={level ? 'exam' : 'practice'}
      timeLimitSec={timeLimit}
      title={title}
      source={`assessment:${kind}:${targetId}`}
      onExit={() => {
        setSeed(randomSeed());
        setStarted(false);
      }}
      onFinish={(r) => {
        const bySection = new Map<string, { correct: number; total: number }>();
        for (const rec of r.records) {
          const s = bySection.get(rec.section) ?? { correct: 0, total: 0 };
          s.total++;
          if (rec.correct) s.correct++;
          bySection.set(rec.section, s);
        }
        recordAssessment(
          {
            kind: unit ? 'unit' : 'level',
            targetId,
            score: r.correct,
            total: r.total,
            passed: r.total > 0 && r.correct / r.total >= PASS_RATIO,
            bySection: [...bySection.entries()].map(([section, v]) => ({ section: section as never, ...v })),
          },
          lessonIds,
        );
        if (unit && r.total > 0 && r.correct / r.total >= PASS_RATIO) usePlanner.getState().markActivity('assessment', unit.id);
      }}
    />
  );
}
