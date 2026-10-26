import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Layers, Target, RotateCcw, Sparkles, BookOpen, Languages, FlaskConical, GraduationCap } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { ProgressRing, ProgressBar } from '@/components/ui/Progress';
import { LevelBadge, StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { useFlashcards } from '@/store/flashcards';
import { usePlanner } from '@/store/planner';
import { CURRICULUM, LESSON_INDEX } from '@/data/curriculum';
import { LEVEL_INFO } from '@/data/types';
import { levelProgress, lessonsWithStatus, nextLesson } from '@/lib/learning';
import { buildQueue } from '@/lib/srs/scheduler';
import { addDays, today, WEEKDAY_TH, weekday } from '@/lib/util/date';
import { planStats } from '@/lib/planner/planner';
import { useAccount } from '@/lib/account/accounts';

const LEVEL_COLORS: Record<string, string> = {
  L0: 'var(--lv-L0)',
  A1: 'var(--lv-A1)',
  A2: 'var(--lv-A2)',
  B1: 'var(--lv-B1)',
  B2: 'var(--lv-B2)',
  ADV: 'var(--lv-ADV)',
};

export default function Dashboard() {
  const { lessons, activity, mistakes } = useProgress();
  const { currentLevel, displayName, dailyGoalMinutes, newCardsPerDay } = useSettings();
  const { cards, newIntroduced } = useFlashcards();
  const plan = usePlanner((s) => s.plan);
  const accountName = useAccount((s) => s.session?.name);
  const t = today();

  const next = nextLesson(lessons, currentLevel);
  const reviewLessons = lessonsWithStatus(lessons, 'needs-review').slice(0, 4);
  const dueCount = useMemo(
    () => buildQueue(Object.values(cards), { newPerDay: newCardsPerDay, newIntroducedToday: newIntroduced.date === t ? newIntroduced.count : 0 }).length,
    [cards, newCardsPerDay, newIntroduced, t],
  );
  const totalLessons = CURRICULUM.reduce((s, l) => s + levelProgress(lessons, l.id).total, 0);
  const segments = CURRICULUM.map((l) => {
    const p = levelProgress(lessons, l.id);
    return { value: p.completed / totalLessons, color: LEVEL_COLORS[l.id], label: `${LEVEL_INFO[l.id].label}: ${p.completed}/${p.total} บทเรียน` };
  });
  const completedAll = Object.values(lessons).filter((l) => l.status === 'completed').length;
  const todayMin = activity[t]?.minutes ?? 0;
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const maxWeek = Math.max(dailyGoalMinutes, ...week.map((d) => activity[d]?.minutes ?? 0));
  const stats = plan ? planStats(plan, t) : null;
  const mistakeCount = Object.keys(mistakes).length;
  const name = displayName || accountName;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="하늘 · HANEUL"
        title={name ? `안녕하세요, ${name} 👋` : '안녕하세요! 👋'}
        subtitle="เรียนภาษาเกาหลีวันละนิด ทบทวนสม่ำเสมอ แล้วจะเห็นความก้าวหน้า"
        action={
          <Link to="/settings" className="btn-secondary btn-sm">
            ระดับปัจจุบัน: <LevelBadge level={currentLevel} />
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader title="เรียนต่อ" subtitle="บทเรียนถัดไปตาม Curriculum Map" icon={<Sparkles className="h-5 w-5" />} />
          {next ? (
            <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-br from-lavender-soft to-sky-soft p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <LevelBadge level={LESSON_INDEX[next.id].level.id} />
                  <span>{LESSON_INDEX[next.id].module.title}</span>
                  <span>·</span>
                  <span>{LESSON_INDEX[next.id].unit.title}</span>
                </div>
                <div className="text-lg font-bold">{next.title}</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                  <StatusBadge status={lessons[next.id]?.status ?? 'not-started'} /> ประมาณ {next.minutes} นาที
                </div>
              </div>
              <Link to={`/learn/${next.id}`} className="btn-primary">
                เริ่มเรียน <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <EmptyState title="เรียนครบทุกบทแล้ว!" message="ลองทำแบบทดสอบระดับ หรือฝึก TOPIK ต่อ" action={<Link to="/topik" className="btn-primary">ไป TOPIK Center</Link>} />
          )}
        </Card>

        <Card className="card-pad flex flex-col items-center justify-center text-center">
          <ProgressRing
            size={140}
            stroke={12}
            segments={segments}
            caption="ความคืบหน้าทั้งหลักสูตร"
            center={
              <div>
                <div className="text-2xl font-bold">{completedAll}</div>
                <div className="text-[11px] text-muted">/ {totalLessons} บท</div>
              </div>
            }
          />
          <ul className="mt-3 grid w-full grid-cols-3 gap-x-2 gap-y-1 text-left text-[11px] text-muted" aria-label="ความคืบหน้าแต่ละระดับ">
            {CURRICULUM.map((l) => {
              const p = levelProgress(lessons, l.id);
              return (
                <li key={l.id} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: LEVEL_COLORS[l.id] }} aria-hidden />
                  <span className="truncate">
                    {LEVEL_INFO[l.id].label} {p.completed}/{p.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/flashcards/study" className="card card-pad transition hover:shadow-lift">
          <Layers className="mb-2 h-5 w-5 text-lavender" />
          <div className="text-2xl font-bold">{dueCount}</div>
          <div className="text-sm text-muted">การ์ดที่ต้องทบทวนวันนี้</div>
        </Link>
        <Link to="/practice?mode=mistakes" className="card card-pad transition hover:shadow-lift">
          <RotateCcw className="mb-2 h-5 w-5 text-warning" />
          <div className="text-2xl font-bold">{mistakeCount}</div>
          <div className="text-sm text-muted">ข้อที่ตอบผิดและยังไม่ได้แก้</div>
        </Link>
        <Link to="/planner" className="card card-pad transition hover:shadow-lift">
          <CalendarDays className="mb-2 h-5 w-5 text-sky" />
          <div className="text-2xl font-bold">{stats ? `${stats.todayItems.filter((i) => i.done).length}/${stats.todayItems.length}` : '—'}</div>
          <div className="text-sm text-muted">{stats ? 'งานตามแผนวันนี้' : 'ยังไม่มีแผนการเรียน'}</div>
        </Link>
        <div className="card card-pad">
          <Target className="mb-2 h-5 w-5 text-success" />
          <div className="text-2xl font-bold">
            {todayMin}
            <span className="text-sm font-normal text-muted"> / {dailyGoalMinutes} นาที</span>
          </div>
          <ProgressBar value={todayMin / dailyGoalMinutes} tone="success" className="mt-2" label="เป้าหมายรายวัน" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader title="แผนวันนี้" subtitle={stats ? `ความคืบหน้าแผน ${Math.round(stats.progress * 100)}%` : undefined} icon={<CalendarDays className="h-5 w-5" />} action={<Link to="/planner" className="btn-ghost btn-sm">ดูแผน</Link>} />
          {!plan ? (
            <EmptyState title="ยังไม่ได้สร้างแผนการเรียน" message="ตั้งเป้าหมาย เวลาว่าง และวันพัก แล้วระบบจะจัดตารางที่ไม่หนักเกินเวลาที่คุณกำหนด" action={<Link to="/planner" className="btn-primary">สร้างแผน</Link>} />
          ) : stats && stats.todayItems.length ? (
            <ul className="space-y-2">
              {stats.todayItems.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className={i.done ? 'text-muted line-through' : ''}>
                    {i.title}
                    {i.part && ` (ส่วนที่ ${i.part.index}/${i.part.total})`}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{i.minutes} นาที</span>
                </li>
              ))}
              {stats.overdue.length > 0 && <li className="text-sm text-warning">มีงานค้าง {stats.overdue.length} รายการ — ไปที่ Planner เพื่อเลื่อนแผน</li>}
            </ul>
          ) : (
            <p className="text-sm text-muted">วันนี้เป็นวันพักตามแผน{stats?.overdue.length ? ` · มีงานค้าง ${stats.overdue.length} รายการ` : ''}</p>
          )}
        </Card>

        <Card className="card-pad">
          <CardHeader title="7 วันที่ผ่านมา" subtitle="นาทีที่เรียน (บันทึกจากกิจกรรมจริง)" />
          <div className="flex h-32 items-end justify-between gap-2" role="img" aria-label="กราฟเวลาเรียน 7 วัน">
            {week.map((d) => {
              const m = activity[d]?.minutes ?? 0;
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-24 w-full items-end">
                    <div className={`w-full rounded-t-md ${d === t ? 'bg-lavender' : 'bg-lavender/40'}`} style={{ height: `${maxWeek ? (m / maxWeek) * 100 : 0}%`, minHeight: m ? 4 : 0 }} title={`${m} นาที`} />
                  </div>
                  <span className="text-[11px] text-muted">{WEEKDAY_TH[weekday(d)]}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {reviewLessons.length > 0 && (
        <Card className="card-pad">
          <CardHeader title="บทเรียนที่ควรทบทวน" subtitle="คะแนนล่าสุดต่ำกว่า 70% หรือแบบทดสอบหน่วยไม่ผ่าน" icon={<RotateCcw className="h-5 w-5" />} />
          <div className="grid gap-2 sm:grid-cols-2">
            {reviewLessons.map((l) => (
              <Link key={l.id} to={`/learn/${l.id}`} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-surface-2">
                <span className="truncate">{l.title}</span>
                <span className="shrink-0 text-xs text-muted">{Math.round((lessons[l.id]?.lastScore ?? 0) * 100)}%</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/vocabulary', icon: BookOpen, label: 'คลังคำศัพท์' },
          { to: '/conjugation', icon: FlaskConical, label: 'ทดลองผันคำ' },
          { to: '/translator', icon: Languages, label: 'ช่วยอ่าน/แปล' },
          { to: '/topik', icon: GraduationCap, label: 'ฝึก TOPIK' },
        ].map((x) => (
          <Link key={x.to} to={x.to} className="card flex items-center gap-3 p-3 text-sm font-medium hover:shadow-lift">
            <x.icon className="h-5 w-5 text-lavender" />
            {x.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
