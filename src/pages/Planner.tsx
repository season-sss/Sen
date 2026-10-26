import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Trash2, Check, MoveRight, Flame, Clock, Target, Plus, X, BellRing } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Tabs, Switch, Segmented } from '@/components/ui/Tabs';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { Notice } from '@/components/ui/States';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { toast } from '@/components/ui/Toast';
import { usePlanner } from '@/store/planner';
import { useProgress } from '@/store/progress';
import { DEFAULT_CONFIG, computeStreak, dayCapacity, effectiveMinutes, goalLessons, planStats, studyWeekdays, type PlanGoal, type PlanItem, type PlannerConfig } from '@/lib/planner/planner';
import { addDays, diffDays, formatThaiDate, fromISODate, MONTH_TH, startOfWeek, today, toISODate, WEEKDAY_TH, WEEKDAY_TH_FULL, weekday } from '@/lib/util/date';
import { LESSON_INDEX } from '@/data/curriculum';
import type { Level } from '@/data/types';
import { cn } from '@/lib/cn';

const ConfigSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    availability: z.array(z.number().min(0).max(600)).length(7),
    daysPerWeek: z.number().int().min(1).max(7),
    minutesPerDay: z.number().int().min(10, 'เวลาเรียนต่อวันอย่างน้อย 10 นาที').max(600),
  })
  .refine((c) => c.targetDate > c.startDate, { message: 'วันเป้าหมายต้องอยู่หลังวันเริ่มต้น', path: ['targetDate'] })
  .refine((c) => c.availability.filter((m) => m > 0).length >= 1, { message: 'ต้องมีเวลาว่างอย่างน้อย 1 วันต่อสัปดาห์', path: ['availability'] });

const TYPE_STYLE: Record<PlanItem['type'], string> = {
  lesson: 'border-l-lavender',
  review: 'border-l-sky',
  mock: 'border-l-warning',
  assessment: 'border-l-success',
};
const TYPE_LABEL: Record<PlanItem['type'], string> = { lesson: 'บทเรียน', review: 'ทบทวน', mock: 'Mock Test', assessment: 'แบบทดสอบหน่วย' };

function itemLink(i: PlanItem) {
  if (i.type === 'lesson' && i.lessonId) return `/learn/${i.lessonId}`;
  if (i.type === 'review') return '/flashcards/study';
  if (i.type === 'mock') return '/topik';
  if (i.type === 'assessment' && i.unitId) return `/assessment/unit/${i.unitId}`;
  return '/curriculum';
}

function Setup({ onDone, initial }: { onDone: () => void; initial?: PlannerConfig }) {
  const create = usePlanner((s) => s.create);
  const lessons = useProgress((s) => s.lessons);
  const [cfg, setCfg] = useState<PlannerConfig>(initial ?? DEFAULT_CONFIG(today()));
  const [rest, setRest] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const completed = useMemo(() => new Set(Object.entries(lessons).filter(([, l]) => l.status === 'completed').map(([id]) => id)), [lessons]);
  const goalType = cfg.goal.type === 'topik' ? cfg.goal.exam : 'levels';
  const levels = cfg.goal.type === 'levels' ? cfg.goal.levels : [];
  const work = goalLessons(cfg.goal, completed);
  const needMin = work.reduce((s, l) => s + effectiveMinutes(l), 0);
  const days = studyWeekdays(cfg);
  let available = 0;
  for (let d = cfg.startDate, n = 0; d <= cfg.targetDate && n < 800; d = addDays(d, 1), n++) available += dayCapacity(cfg, d, days);
  const ratio = available ? needMin / available : Infinity;

  const set = (patch: Partial<PlannerConfig>) => setCfg({ ...cfg, ...patch });
  const setGoal = (g: PlanGoal) => set({ goal: g });

  return (
    <div className="card card-pad space-y-5">
      <CardHeader title="ตั้งค่าแผนการเรียน" subtitle="ระบบจะจัดตารางไม่เกินเวลาที่คุณกำหนดในแต่ละวัน และพิจารณาความยากของบทเรียน" icon={<Target className="h-5 w-5" />} />
      <div>
        <div className="label">เป้าหมาย</div>
        <Segmented<string>
          value={goalType}
          onChange={(v) => setGoal(v === 'levels' ? { type: 'levels', levels: ['L0', 'A1'] } : { type: 'topik', exam: v as 'TOPIK1' | 'TOPIK2' })}
          options={[
            { id: 'levels', label: 'เรียนจบระดับ' },
            { id: 'TOPIK1', label: 'เตรียมสอบ TOPIK I' },
            { id: 'TOPIK2', label: 'เตรียมสอบ TOPIK II' },
          ]}
        />
        {goalType === 'levels' && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(['L0', 'A1', 'A2', 'B1', 'B2', 'ADV'] as Level[]).map((l) => (
              <button
                key={l}
                className={cn('chip', levels.includes(l) && 'chip-active')}
                aria-pressed={levels.includes(l)}
                onClick={() => setGoal({ type: 'levels', levels: levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l] })}
              >
                {l === 'L0' ? 'Level 0 ฮันกึล' : l}
              </button>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-xs text-muted">
          {work.length} บทเรียนที่ยังไม่จบ · ประมาณ {Math.round(needMin / 60)} ชั่วโมง (ปรับตามความยากแล้ว){completed.size ? ` · ข้ามบทที่เรียนจบแล้ว ${completed.size} บท` : ''}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pl-start">
            วันเริ่มต้น
          </label>
          <input id="pl-start" type="date" className="input" value={cfg.startDate} onChange={(e) => set({ startDate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="pl-target">
            วันเป้าหมาย
          </label>
          <input id="pl-target" type="date" className="input" value={cfg.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
        </div>
      </div>

      <div>
        <div className="label">เวลาว่างในแต่ละวัน (นาที)</div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => (
            <label key={d} className={cn('rounded-xl border p-2 text-center', days.has(d) ? 'border-lavender bg-lavender-soft/50' : 'border-border')}>
              <span className="block text-xs font-semibold">{WEEKDAY_TH[d]}</span>
              <input
                type="number"
                min={0}
                max={600}
                step={5}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-1 py-1 text-center text-sm"
                value={cfg.availability[d]}
                onChange={(e) => {
                  const a = [...cfg.availability];
                  a[d] = Math.max(0, Math.min(600, Number(e.target.value) || 0));
                  set({ availability: a });
                }}
                aria-label={`เวลาว่างวัน${WEEKDAY_TH_FULL[d]}`}
              />
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">กรอบสีม่วง = วันที่ระบบเลือกให้เรียน (วันที่มีเวลาว่างมากที่สุดตามจำนวนวันต่อสัปดาห์)</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pl-days">
            จำนวนวันเรียนต่อสัปดาห์: {cfg.daysPerWeek} วัน
          </label>
          <input id="pl-days" type="range" min={1} max={7} value={cfg.daysPerWeek} onChange={(e) => set({ daysPerWeek: Number(e.target.value) })} className="w-full accent-[rgb(var(--lavender))]" />
        </div>
        <div>
          <label className="label" htmlFor="pl-min">
            เวลาเรียนสูงสุดต่อวัน: {cfg.minutesPerDay} นาที
          </label>
          <input id="pl-min" type="range" min={10} max={240} step={5} value={cfg.minutesPerDay} onChange={(e) => set({ minutesPerDay: Number(e.target.value) })} className="w-full accent-[rgb(var(--lavender))]" />
        </div>
      </div>

      <div>
        <div className="label">วันพัก / วันที่ไม่ว่าง</div>
        <div className="flex gap-2">
          <input type="date" className="input" value={rest} onChange={(e) => setRest(e.target.value)} aria-label="เพิ่มวันพัก" />
          <button
            className="btn-secondary"
            disabled={!rest}
            onClick={() => {
              if (!cfg.restDates.includes(rest)) set({ restDates: [...cfg.restDates, rest].sort() });
              setRest('');
            }}
          >
            <Plus className="h-4 w-4" /> เพิ่ม
          </button>
        </div>
        {cfg.restDates.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cfg.restDates.map((d) => (
              <span key={d} className="chip">
                {formatThaiDate(d)}
                <button onClick={() => set({ restDates: cfg.restDates.filter((x) => x !== d) })} aria-label={`ลบวันพัก ${d}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Switch checked={cfg.includeReview} onChange={(v) => set({ includeReview: v })} label={`จองเวลาทบทวน Flashcards วันละ ${cfg.reviewMinutes} นาที`} />
        <Switch checked={cfg.includeUnitChecks} onChange={(v) => set({ includeUnitChecks: v })} label="ใส่แบบทดสอบท้ายหน่วย" />
        <Switch checked={cfg.includeMockTests} onChange={(v) => set({ includeMockTests: v })} label="ใส่ Mock Test ทุก ~4 สัปดาห์และก่อนวันเป้าหมาย" />
      </div>

      <div className={cn('rounded-xl p-4 text-sm', ratio <= 1 ? 'bg-success/10' : 'bg-warning/10')}>
        <div className="font-semibold">{ratio <= 1 ? 'แผนนี้ทำได้ทันวันเป้าหมาย' : 'เวลาไม่พอสำหรับเป้าหมายนี้'}</div>
        <div className="text-muted">
          ต้องใช้ ~{Math.round(needMin / 60)} ชม. · มีเวลาเรียนก่อนวันเป้าหมาย ~{Math.round(available / 60)} ชม.
          {ratio > 1 && ' — ระบบจะจัดตารางต่อเลยวันเป้าหมายและแสดงวันที่คาดว่าจะจบ ลองเพิ่มเวลา/วันเรียน หรือเลื่อนวันเป้าหมาย'}
        </div>
      </div>

      {errors.length > 0 && (
        <Notice tone="danger">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </Notice>
      )}
      <div className="flex justify-end gap-2">
        {initial && (
          <button className="btn-secondary" onClick={onDone}>
            ยกเลิก
          </button>
        )}
        <button
          className="btn-primary"
          onClick={() => {
            const parsed = ConfigSchema.safeParse(cfg);
            if (!parsed.success) {
              setErrors(parsed.error.issues.map((i) => i.message));
              return;
            }
            if (cfg.goal.type === 'levels' && cfg.goal.levels.length === 0) {
              setErrors(['เลือกอย่างน้อยหนึ่งระดับ']);
              return;
            }
            if (work.length === 0) {
              setErrors(['บทเรียนตามเป้าหมายนี้เรียนจบหมดแล้ว']);
              return;
            }
            setErrors([]);
            const plan = create(cfg, completed);
            toast.success(`สร้างแผนแล้ว — ${plan.items.length} รายการ คาดว่าจะจบ ${formatThaiDate(plan.estimatedFinish)}`);
            onDone();
          }}
        >
          สร้างตารางเรียน
        </button>
      </div>
    </div>
  );
}

function ItemRow({ item, onToggle, onMove, draggable }: { item: PlanItem; onToggle: () => void; onMove: () => void; draggable?: boolean }) {
  const t = today();
  const overdue = !item.done && item.date < t && item.type !== 'review';
  const lessonLevel = item.lessonId ? LESSON_INDEX[item.lessonId]?.level.id : undefined;
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', item.id)}
      className={cn('group flex items-center gap-2 rounded-lg border border-l-4 border-border bg-surface px-2.5 py-2 text-sm', TYPE_STYLE[item.type], item.done && 'opacity-60', overdue && 'bg-warning/5', draggable && 'cursor-grab active:cursor-grabbing')}
    >
      <button
        onClick={onToggle}
        className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border', item.done ? 'border-success bg-success text-white' : 'border-border')}
        aria-label={item.done ? `ยกเลิกทำเครื่องหมายเสร็จ: ${item.title}` : `ทำเครื่องหมายเสร็จ: ${item.title}`}
        aria-pressed={item.done}
      >
        {item.done && <Check className="h-3.5 w-3.5" />}
      </button>
      <Link to={itemLink(item)} className={cn('min-w-0 flex-1 hover:text-lavender', item.done && 'line-through')}>
        <div className="truncate">
          {item.title}
          {item.part && <span className="text-xs text-muted"> ({item.part.index}/{item.part.total})</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {TYPE_LABEL[item.type]} · {item.minutes} นาที {lessonLevel && <LevelBadge level={lessonLevel} className="scale-90" />}
          {overdue && <span className="text-warning">· ค้าง</span>}
        </div>
      </Link>
      <button className="btn-ghost p-1 opacity-70 group-hover:opacity-100" onClick={onMove} aria-label={`ย้าย ${item.title} ไปวันอื่น`}>
        <MoveRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Planner() {
  const { plan, toggleDone, move, catchUp, clear } = usePlanner();
  const { lessons, activity } = useProgress();
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<'week' | 'month' | 'timeline'>('week');
  const [anchor, setAnchor] = useState(today());
  const [moving, setMoving] = useState<PlanItem | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const t = today();

  const completed = useMemo(() => new Set(Object.entries(lessons).filter(([, l]) => l.status === 'completed').map(([id]) => id)), [lessons]);
  const streak = computeStreak(
    Object.entries(activity)
      .filter(([, a]) => a.answers || a.minutes || a.lessons || a.reviews)
      .map(([d]) => d),
    t,
  );

  if (!plan || editing)
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Student Planner" subtitle="วางแผนการเรียนล่วงหน้าตามเป้าหมาย เวลาว่าง และวันพักของคุณ" />
        <Setup onDone={() => setEditing(false)} initial={editing ? plan?.config : undefined} />
      </div>
    );

  const stats = planStats(plan, t);
  const byDate = new Map<string, PlanItem[]>();
  for (const i of plan.items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
  const doMove = (id: string, date: string) => {
    const w = move(id, date);
    if (w) toast.warning(w);
    else toast.success(`ย้ายไป ${formatThaiDate(date)} แล้ว`);
  };

  const weekStart = startOfWeek(anchor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = toISODate(new Date(fromISODate(anchor).getFullYear(), fromISODate(anchor).getMonth(), 1));
  const gridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const anchorMonth = fromISODate(anchor).getMonth();

  const weekMap = new Map<string, PlanItem[]>();
  for (const i of plan.items) {
    const w = startOfWeek(i.date);
    weekMap.set(w, [...(weekMap.get(w) ?? []), i]);
  }
  const weeks = [...weekMap.entries()].sort(([a], [b]) => (a < b ? -1 : 1));

  return (
    <div>
      <PageHeader
        title="Student Planner"
        subtitle={`เป้าหมาย: ${plan.config.goal.type === 'topik' ? `เตรียมสอบ ${plan.config.goal.exam === 'TOPIK1' ? 'TOPIK I' : 'TOPIK II'}` : plan.config.goal.type === 'levels' ? `เรียนจบ ${plan.config.goal.levels.join(', ')}` : 'กำหนดเอง'} · ภายใน ${formatThaiDate(plan.config.targetDate)}`}
        action={
          <>
            <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>
              ปรับแผนใหม่
            </button>
            <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" /> ลบแผน
            </button>
          </>
        }
      />

      {stats.overdue.length > 0 && (
        <Notice tone="warning" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>
            <BellRing className="mr-1 inline h-4 w-4" />
            มีงานค้าง {stats.overdue.length} รายการ ({stats.overdue.reduce((s, i) => s + i.minutes, 0)} นาที)
          </span>
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              catchUp(completed);
              toast.success('เลื่อนแผนแล้ว — งานที่ค้างถูกจัดใหม่ตั้งแต่วันนี้ โดยไม่เกินเวลาต่อวันที่ตั้งไว้');
            }}
          >
            <RefreshCw className="h-4 w-4" /> เลื่อนแผนให้ทัน
          </button>
        </Notice>
      )}
      {plan.overflow && (
        <Notice tone="warning" className="mb-4">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          ด้วยเวลาที่ตั้งไว้ คาดว่าจะจบ {formatThaiDate(plan.estimatedFinish)} ซึ่งช้ากว่าวันเป้าหมาย {diffDays(plan.config.targetDate, plan.estimatedFinish)} วัน — ลองเพิ่มเวลาเรียนในหน้า "ปรับแผนใหม่"
        </Notice>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <ProgressRing value={stats.progress} size={56} stroke={6} center={<span className="text-xs font-bold">{Math.round(stats.progress * 100)}%</span>} />
          <div className="text-sm">
            <div className="font-semibold">ความคืบหน้าจริง</div>
            <div className="text-muted">
              บทเรียน {stats.lessonsDone}/{stats.lessonsTotal}
            </div>
          </div>
        </Card>
        <Card className="p-4 text-sm">
          <Clock className="mb-1 h-5 w-5 text-sky" />
          <div className="font-semibold">เหลือ {Math.round(stats.remainingMinutes / 60)} ชม.</div>
          <div className="text-muted">{stats.remainingDays} วันก่อนถึงเป้าหมาย</div>
        </Card>
        <Card className="p-4 text-sm">
          <CalendarDays className="mb-1 h-5 w-5 text-lavender" />
          <div className="font-semibold">คาดว่าจะจบ</div>
          <div className="text-muted">{formatThaiDate(plan.estimatedFinish)}</div>
        </Card>
        <Card className="p-4 text-sm">
          <Flame className={cn('mb-1 h-5 w-5', streak ? 'text-orange-500' : 'text-muted')} />
          <div className="font-semibold">{streak} วันติดต่อกัน</div>
          <div className="text-muted">Study Streak</div>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={view}
          onChange={setView}
          tabs={[
            { id: 'week', label: 'รายสัปดาห์' },
            { id: 'month', label: 'ปฏิทิน' },
            { id: 'timeline', label: 'Timeline' },
          ]}
        />
        {view !== 'timeline' && (
          <div className="flex items-center gap-1">
            <button className="btn-ghost p-2" onClick={() => setAnchor(view === 'week' ? addDays(anchor, -7) : toISODate(new Date(fromISODate(anchor).getFullYear(), anchorMonth - 1, 1)))} aria-label="ก่อนหน้า">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="btn-secondary btn-sm" onClick={() => setAnchor(t)}>
              วันนี้
            </button>
            <button className="btn-ghost p-2" onClick={() => setAnchor(view === 'week' ? addDays(anchor, 7) : toISODate(new Date(fromISODate(anchor).getFullYear(), anchorMonth + 1, 1)))} aria-label="ถัดไป">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {view === 'week' && (
        <div className="grid gap-3 md:grid-cols-7">
          {weekDays.map((d) => {
            const items = byDate.get(d) ?? [];
            const cap = dayCapacity(plan.config, d);
            const load = items.reduce((s, i) => s + i.minutes, 0);
            return (
              <div
                key={d}
                className={cn('min-h-[120px] rounded-2xl border p-2', d === t ? 'border-lavender bg-lavender-soft/40' : 'border-border bg-surface/60')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) doMove(id, d);
                }}
                aria-label={`${WEEKDAY_TH_FULL[weekday(d)]} ${formatThaiDate(d)}`}
              >
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <span className="text-sm font-semibold">
                    {WEEKDAY_TH[weekday(d)]} {fromISODate(d).getDate()}
                  </span>
                  <span className={cn('text-[11px]', load > cap ? 'text-danger' : 'text-muted')}>{cap ? `${load}/${cap} น.` : 'พัก'}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((i) => (
                    <ItemRow key={i.id} item={i} draggable onToggle={() => toggleDone(i.id)} onMove={() => (setMoving(i), setMoveDate(i.date))} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'month' && (
        <div className="card p-3">
          <div className="mb-2 text-center font-semibold">
            {MONTH_TH[anchorMonth]} {fromISODate(anchor).getFullYear() + 543}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d}>{WEEKDAY_TH[d]}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((d) => {
              const items = byDate.get(d) ?? [];
              const done = items.filter((i) => i.done).length;
              const inMonth = fromISODate(d).getMonth() === anchorMonth;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={cn('flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-xs transition sm:aspect-auto sm:h-20', inMonth ? 'bg-surface-2/60 hover:bg-surface-2' : 'opacity-40', d === t && 'ring-2 ring-lavender', selectedDay === d && 'bg-lavender-soft')}
                  aria-label={`${formatThaiDate(d)} ${items.length} รายการ`}
                >
                  <span className="font-semibold">{fromISODate(d).getDate()}</span>
                  {items.length > 0 && (
                    <span className={cn('mt-auto rounded-full px-1.5 text-[10px] font-semibold', done === items.length ? 'bg-success/15 text-success' : d < t ? 'bg-warning/15 text-warning' : 'bg-lavender/15 text-lavender')}>
                      {done}/{items.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedDay && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-sm font-semibold">{formatThaiDate(selectedDay)}</div>
              {(byDate.get(selectedDay) ?? []).length === 0 ? (
                <p className="text-sm text-muted">ไม่มีรายการ</p>
              ) : (
                <div className="space-y-1.5">
                  {(byDate.get(selectedDay) ?? []).map((i) => (
                    <ItemRow key={i.id} item={i} onToggle={() => toggleDone(i.id)} onMove={() => (setMoving(i), setMoveDate(i.date))} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'timeline' && (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {weeks.map(([w, items]) => {
            const done = items.filter((i) => i.done).length;
            const lessonsInWeek = [...new Set(items.filter((i) => i.lessonId).map((i) => LESSON_INDEX[i.lessonId!]?.unit.title))];
            return (
              <li key={w} className="relative">
                <span className={cn('absolute -left-[27px] top-3 h-3 w-3 rounded-full border-2 border-bg', done === items.length ? 'bg-success' : w <= t ? 'bg-lavender' : 'bg-border')} />
                <div className="card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">สัปดาห์ของ {formatThaiDate(w)}</span>
                    <Badge tone={done === items.length ? 'success' : 'neutral'}>
                      {done}/{items.length} รายการ · {items.reduce((s, i) => s + i.minutes, 0)} นาที
                    </Badge>
                  </div>
                  <ProgressBar className="my-2" value={items.length ? done / items.length : 0} tone="success" label="ความคืบหน้าสัปดาห์" />
                  <div className="text-xs text-muted">{lessonsInWeek.slice(0, 4).join(' · ')}{lessonsInWeek.length > 4 ? ' …' : ''}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-4 text-xs text-muted">
        ลากรายการไปวางวันอื่นได้ (บนมือถือแตะ <MoveRight className="inline h-3 w-3" />) · บทเรียน แบบทดสอบ และการทบทวนที่ทำเสร็จจริงจะถูกติ๊กอัตโนมัติ · การแจ้งเตือนแสดงในแอปเมื่อเปิดใช้งาน (การแจ้งเตือนทางอีเมล/Push ต้องตั้งค่าบริการเพิ่ม ดู docs/BACKEND_SETUP.md)
      </p>

      <Modal
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        title="ย้ายไปวันอื่น"
        size="sm"
        footer={
          <button
            className="btn-primary"
            disabled={!moveDate}
            onClick={() => {
              if (moving) doMove(moving.id, moveDate);
              setMoving(null);
            }}
          >
            ย้าย
          </button>
        }
      >
        <p className="mb-2 text-sm">{moving?.title}</p>
        <input type="date" className="input" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} aria-label="วันที่ใหม่" />
        {moveDate && <p className="mt-2 text-xs text-muted">เวลาเรียนวันนั้น: {(byDate.get(moveDate) ?? []).reduce((s, i) => s + i.minutes, 0)} / {dayCapacity(plan.config, moveDate)} นาที</p>}
      </Modal>
      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} title="ลบแผนการเรียน?" message="ตารางและการติ๊กเสร็จในแผนนี้จะถูกลบ (ความคืบหน้าของบทเรียนยังอยู่)" danger confirmLabel="ลบแผน" onConfirm={clear} />
    </div>
  );
}
