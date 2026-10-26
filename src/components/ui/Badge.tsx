import { cn } from '@/lib/cn';
import type { Level } from '@/data/types';
import { LEVEL_INFO } from '@/data/types';
import type { LessonStatus } from '@/store/progress';
import { CheckCircle2, Circle, RotateCcw, Loader } from 'lucide-react';

const LEVEL_STYLE: Record<Level, string> = {
  L0: 'bg-sky-soft text-sky',
  A1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  A2: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  B1: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  B2: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  ADV: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

export function LevelBadge({ level, className, withTopik }: { level: Level; className?: string; withTopik?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold', LEVEL_STYLE[level], className)} title={LEVEL_INFO[level].topik}>
      {LEVEL_INFO[level].label}
      {withTopik && <span className="font-medium opacity-80">· {LEVEL_INFO[level].topik}</span>}
    </span>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: 'neutral' | 'lavender' | 'sky' | 'success' | 'warning' | 'danger'; className?: string }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    lavender: 'bg-lavender-soft text-lavender',
    sky: 'bg-sky-soft text-sky',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold', tones[tone], className)}>{children}</span>;
}

export const STATUS_INFO: Record<LessonStatus, { label: string; tone: 'neutral' | 'sky' | 'success' | 'warning' }> = {
  'not-started': { label: 'ยังไม่เริ่ม', tone: 'neutral' },
  learning: { label: 'กำลังเรียน', tone: 'sky' },
  completed: { label: 'เรียนจบแล้ว', tone: 'success' },
  'needs-review': { label: 'ควรทบทวน', tone: 'warning' },
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  const i = STATUS_INFO[status];
  const IconC = status === 'completed' ? CheckCircle2 : status === 'needs-review' ? RotateCcw : status === 'learning' ? Loader : Circle;
  return (
    <Badge tone={i.tone}>
      <IconC className="h-3 w-3" aria-hidden />
      {i.label}
    </Badge>
  );
}
