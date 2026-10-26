import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, Clock, Lock, ClipboardCheck, GraduationCap, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { LevelBadge, StatusBadge, STATUS_INFO } from '@/components/ui/Badge';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { Notice } from '@/components/ui/States';
import { CURRICULUM, type Module } from '@/data/curriculum';
import { LEVEL_INFO, LEVEL_MAPPING_NOTE, type Level } from '@/data/types';
import { aggregateStatus, completionRatio, lessonStatus, useProgress, type LessonStatus } from '@/store/progress';
import { unmetPrerequisites } from '@/lib/learning';
import { cn } from '@/lib/cn';
import { useSettings } from '@/store/settings';

function ModuleBlock({ module, defaultOpen }: { module: Module; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { lessons, assessments } = useProgress();
  const all = module.units.flatMap((u) => u.lessons);
  const statuses = all.map((l) => lessonStatus(lessons, l.id));
  const agg = aggregateStatus(statuses);
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-center gap-4 p-4 text-left sm:p-5" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ProgressRing value={completionRatio(statuses)} size={44} stroke={5} center={<span className="text-[10px] font-bold">{Math.round(completionRatio(statuses) * 100)}%</span>} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{module.title}</div>
          <div className="truncate text-sm text-muted">{module.description}</div>
        </div>
        <span className="hidden sm:block">
          <StatusBadge status={agg} />
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border p-4 sm:p-5">
          {module.units.map((u) => {
            const us = u.lessons.map((l) => lessonStatus(lessons, l.id));
            const lastCheck = [...assessments].reverse().find((a) => a.kind === 'unit' && a.targetId === u.id);
            return (
              <section key={u.id} aria-label={u.title}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{u.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">
                      {us.filter((s) => s === 'completed').length}/{u.lessons.length} บท
                    </span>
                    <Link to={`/assessment/unit/${u.id}`} className="btn-ghost btn-sm">
                      <ClipboardCheck className="h-4 w-4" />
                      แบบทดสอบหน่วย{lastCheck ? ` (${Math.round((lastCheck.score / lastCheck.total) * 100)}%)` : ''}
                    </Link>
                  </div>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {u.lessons.map((l) => {
                    const st = lessonStatus(lessons, l.id);
                    const unmet = unmetPrerequisites(lessons, l);
                    return (
                      <li key={l.id}>
                        <Link to={`/learn/${l.id}`} className="flex items-center gap-3 px-3 py-3 transition hover:bg-surface-2 sm:px-4">
                          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', { 'not-started': 'bg-border', learning: 'bg-sky', completed: 'bg-success', 'needs-review': 'bg-warning' }[st])} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{l.title}</div>
                            <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {l.minutes} นาที
                              </span>
                              <span>ความยาก {'●'.repeat(l.difficulty)}{'○'.repeat(3 - l.difficulty)}</span>
                              {unmet.length > 0 && st === 'not-started' && (
                                <span className="inline-flex items-center gap-1 text-warning">
                                  <Lock className="h-3 w-3" /> ควรเรียน "{unmet[0].title}" ก่อน
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={st} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Curriculum() {
  const [params, setParams] = useSearchParams();
  const currentLevel = useSettings((s) => s.currentLevel);
  const level = (params.get('level') as Level) || currentLevel;
  const lv = CURRICULUM.find((l) => l.id === level) ?? CURRICULUM[0];
  const { lessons, assessments } = useProgress();
  const allLessons = lv.modules.flatMap((m) => m.units.flatMap((u) => u.lessons));
  const statuses = allLessons.map((l) => lessonStatus(lessons, l.id));
  const counts = (['not-started', 'learning', 'completed', 'needs-review'] as LessonStatus[]).map((s) => ({ s, n: statuses.filter((x) => x === s).length }));
  const lastLevel = [...assessments].reverse().find((a) => a.kind === 'level' && a.targetId === lv.id);
  const minutes = allLessons.reduce((s, l) => s + l.minutes, 0);

  return (
    <div>
      <PageHeader title="Curriculum Map" subtitle="ระดับ → โมดูล → หน่วย → บทเรียน → หัวข้อ → แบบฝึกหัด → แบบทดสอบ" />
      <Tabs
        className="mb-5"
        value={lv.id}
        onChange={(v) => setParams({ level: v })}
        tabs={CURRICULUM.map((l) => ({ id: l.id, label: <span className="inline-flex items-center gap-1.5">{LEVEL_INFO[l.id].label}</span> }))}
      />

      <div className="card card-pad mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <LevelBadge level={lv.id} withTopik />
            </div>
            <h2 className="text-xl font-bold">
              {LEVEL_INFO[lv.id].label} · {lv.title} <span className="text-base font-medium text-muted">({LEVEL_INFO[lv.id].th})</span>
            </h2>
            <p className="mt-1 text-sm text-muted">{lv.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {counts.map(({ s, n }) => (
                <span key={s} className="chip">
                  {STATUS_INFO[s].label}: <b>{n}</b>
                </span>
              ))}
              <span className="chip">
                <Clock className="h-3 w-3" /> ~{Math.round(minutes / 60)} ชั่วโมง
              </span>
            </div>
            <ProgressBar className="mt-3" value={completionRatio(statuses)} tone="success" label="ความคืบหน้าระดับนี้" />
          </div>
          <Link to={`/assessment/level/${lv.id}`} className="btn-primary shrink-0">
            <GraduationCap className="h-4 w-4" />
            แบบทดสอบระดับ {LEVEL_INFO[lv.id].label}
            {lastLevel && ` (${Math.round((lastLevel.score / lastLevel.total) * 100)}%)`}
          </Link>
        </div>
      </div>

      {lv.id === 'ADV' && (
        <Notice className="mb-4" tone="info">
          Advanced Track เป็นหัวข้อต่อยอดหลัง B2 — ไม่ได้เป็นข้อกำหนดของระดับ A1–B2
        </Notice>
      )}

      <div className="space-y-3">
        {lv.modules.map((m, i) => (
          <ModuleBlock key={m.id} module={m} defaultOpen={i === 0} />
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {LEVEL_MAPPING_NOTE}. สถานะ "เรียนจบแล้ว" ได้จากการทำแบบฝึกหัดท้ายบทได้ ≥ 70% หรือผ่านแบบทดสอบหน่วย
      </p>
    </div>
  );
}
