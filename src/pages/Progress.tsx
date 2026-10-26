import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { BookCheck, Clock, Target, Flame, Layers, Table2, BarChart3 } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { LevelBadge } from '@/components/ui/Badge';
import { useProgress } from '@/store/progress';
import { useFlashcards } from '@/store/flashcards';
import { useExams } from '@/store/history';
import { CURRICULUM } from '@/data/curriculum';
import { LEVEL_INFO } from '@/data/types';
import { GRAMMAR_BY_ID } from '@/data/grammar';
import { VOCAB_BY_ID } from '@/data/vocabulary';
import { levelProgress } from '@/lib/learning';
import { SECTION_LABEL } from '@/lib/quiz/report';
import { computeStreak } from '@/lib/planner/planner';
import { memoryLevel } from '@/lib/srs/scheduler';
import { addDays, fromISODate, today, toISODate, formatThaiDate } from '@/lib/util/date';
import type { Section } from '@/lib/quiz/types';
import { cn } from '@/lib/cn';

const axis = { fontSize: 11, fill: 'rgb(var(--muted))' };
const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--border))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--ink))' },
  labelStyle: { color: 'rgb(var(--ink))', fontWeight: 600 },
  cursor: { fill: 'rgb(var(--surface-2))' },
};

function Stat({ icon: I, label, value, sub }: { icon: typeof Clock; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <I className="mb-1.5 h-5 w-5 text-lavender" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export default function Progress() {
  const { lessons, activity, answers, assessments, mistakes } = useProgress();
  const { cards, logs } = useFlashcards();
  const attempts = useExams((s) => s.attempts);
  const [tableView, setTableView] = useState(false);
  const t = today();

  const days30 = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29));
  const minutesData = days30.map((d) => ({ date: d, label: `${fromISODate(d).getDate()}/${fromISODate(d).getMonth() + 1}`, minutes: activity[d]?.minutes ?? 0 }));
  const totalMinutes = Object.values(activity).reduce((s, a) => s + a.minutes, 0);
  const totalAnswers = answers.length;
  const correctAnswers = answers.filter((a) => a.correct).length;
  const streak = computeStreak(Object.entries(activity).filter(([, a]) => a.answers || a.minutes || a.lessons || a.reviews).map(([d]) => d), t);
  const completed = Object.values(lessons).filter((l) => l.status === 'completed').length;

  const bySection = useMemo(() => {
    const m = new Map<Section, { c: number; t: number }>();
    for (const a of answers) {
      const s = m.get(a.section) ?? { c: 0, t: 0 };
      s.t++;
      if (a.correct) s.c++;
      m.set(a.section, s);
    }
    return [...m.entries()].map(([section, v]) => ({ section, label: SECTION_LABEL[section], accuracy: Math.round((v.c / v.t) * 100), total: v.t })).sort((a, b) => b.accuracy - a.accuracy);
  }, [answers]);

  const levelRows = CURRICULUM.map((l) => ({ id: l.id, label: LEVEL_INFO[l.id].label, ...levelProgress(lessons, l.id) }));

  const reviewsPerDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const d = toISODate(new Date(l.at));
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return days30.slice(-14).map((d) => ({ label: `${fromISODate(d).getDate()}/${fromISODate(d).getMonth() + 1}`, reviews: m.get(d) ?? 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, t]);

  const mem = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of Object.values(cards)) mem[memoryLevel(c.srs)]++;

  const weakRefs = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of Object.values(mistakes)) if (x.question.ref) m.set(`${x.question.ref.type}:${x.question.ref.id}`, (m.get(`${x.question.ref.type}:${x.question.ref.id}`) ?? 0) + x.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [mistakes]);

  const hasAny = totalAnswers > 0 || totalMinutes > 0 || completed > 0 || logs.length > 0;

  return (
    <div>
      <PageHeader
        title="ความก้าวหน้าและสถิติ"
        subtitle="ทุกตัวเลขมาจากกิจกรรมจริงของคุณในเครื่องนี้ (หรือที่ซิงก์จากบัญชี)"
        action={
          <button className="btn-secondary btn-sm" onClick={() => setTableView(!tableView)} aria-pressed={tableView}>
            {tableView ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />} {tableView ? 'ดูแบบกราฟ' : 'ดูแบบตาราง'}
          </button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat icon={BookCheck} label="บทเรียนที่จบ" value={completed} sub={`จาก ${CURRICULUM.reduce((s, l) => s + levelProgress(lessons, l.id).total, 0)} บท`} />
        <Stat icon={Clock} label="เวลาเรียนรวม" value={`${Math.floor(totalMinutes / 60)} ชม. ${totalMinutes % 60} น.`} />
        <Stat icon={Target} label="ความแม่นยำ" value={totalAnswers ? `${Math.round((correctAnswers / totalAnswers) * 100)}%` : '—'} sub={`${totalAnswers} คำตอบ`} />
        <Stat icon={Flame} label="Study Streak" value={`${streak} วัน`} />
        <Stat icon={Layers} label="การ์ดที่จำได้ดี" value={mem.mature} sub={`จำได้ระยะสั้น ${mem.young} · กำลังจำ ${mem.learning}`} />
      </div>

      {!hasAny ? (
        <EmptyState title="ยังไม่มีข้อมูลความก้าวหน้า" message="เริ่มเรียนบทแรก ทำแบบฝึกหัด หรือทบทวน Flashcards แล้วสถิติจะปรากฏที่นี่" action={<Link className="btn-primary" to="/curriculum">ไปที่หลักสูตร</Link>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="card-pad lg:col-span-2">
            <CardHeader title="นาทีที่เรียนต่อวัน" subtitle="30 วันล่าสุด" />
            {tableView ? (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1">วันที่</th>
                      <th className="py-1 text-right">นาที</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minutesData
                      .filter((d) => d.minutes)
                      .reverse()
                      .map((d) => (
                        <tr key={d.date} className="border-t border-border">
                          <td className="py-1">{formatThaiDate(d.date)}</td>
                          <td className="py-1 text-right tabular-nums">{d.minutes}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={minutesData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={4} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} นาที`, 'เวลาเรียน']} />
                    <Bar dataKey="minutes" fill="rgb(var(--lavender))" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <CardHeader title="ความแม่นยำแยกตามทักษะ" subtitle="จากทุกคำตอบที่บันทึก" />
            {bySection.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีคำตอบ</p>
            ) : tableView ? (
              <table className="w-full text-sm">
                <tbody>
                  {bySection.map((s) => (
                    <tr key={s.section} className="border-t border-border">
                      <td className="py-1.5">{s.label}</td>
                      <td className="py-1.5 text-right tabular-nums">{s.accuracy}%</td>
                      <td className="py-1.5 text-right text-xs text-muted">{s.total} ข้อ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ height: Math.max(140, bySection.length * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySection} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis type="category" dataKey="label" tick={axis} tickLine={false} axisLine={false} width={96} />
                    <Tooltip {...tooltipStyle} formatter={(v: number, _n, p) => [`${v}% (${(p.payload as { total: number }).total} ข้อ)`, 'ความแม่นยำ']} />
                    <Bar dataKey="accuracy" fill="rgb(var(--sky))" radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
                      <LabelList dataKey="accuracy" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: 'rgb(var(--ink))' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <CardHeader title="ความคืบหน้าแต่ละระดับ" subtitle="จำนวนบทเรียนที่จบ / ทั้งหมด" />
            <ul className="space-y-3">
              {levelRows.map((r) => (
                <li key={r.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--lv-${r.id})` }} aria-hidden />
                      {r.label}
                    </span>
                    <span className="tabular-nums text-muted">
                      {r.completed}/{r.total}
                      {r.review ? ` · ทบทวน ${r.review}` : ''}
                    </span>
                  </div>
                  <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${r.label}: จบ ${r.completed}, กำลังเรียน ${r.learning}, ควรทบทวน ${r.review}, ทั้งหมด ${r.total}`}>
                    <div style={{ width: `${(r.completed / r.total) * 100}%`, background: `var(--lv-${r.id})` }} />
                    <div className="bg-border" style={{ width: `${((r.learning + r.review) / r.total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">แถบสี = เรียนจบ · แถบเทา = กำลังเรียน/ควรทบทวน</p>
          </Card>

          <Card className="card-pad">
            <CardHeader title="การทบทวน Flashcards" subtitle="14 วันล่าสุด" />
            {logs.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีการทบทวน</p>
            ) : (
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reviewsPerDay} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgb(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={2} />
                    <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} ครั้ง`, 'ทบทวน']} />
                    <Bar dataKey="reviews" fill="rgb(var(--lavender))" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="card-pad">
            <CardHeader title="หัวข้อที่ตอบผิดบ่อย" subtitle="จากข้อที่ยังไม่ได้แก้ — แตะเพื่อทบทวน" />
            {weakRefs.length === 0 ? (
              <p className="text-sm text-muted">ไม่มีหัวข้อที่ตอบผิดค้างอยู่</p>
            ) : (
              <ul className="space-y-1.5">
                {weakRefs.map(([key, n]) => {
                  const [type, id] = key.split(':');
                  const g = type === 'grammar' ? GRAMMAR_BY_ID[id] : undefined;
                  const v = type === 'vocab' ? VOCAB_BY_ID[id] : undefined;
                  return (
                    <li key={key}>
                      <Link to={g ? `/grammar/${id}` : `/vocabulary`} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm hover:bg-surface-2">
                        <span lang="ko" className="ko truncate">
                          {g ? g.pattern : v ? `${v.ko} — ${v.th}` : id}
                        </span>
                        <span className="text-xs text-warning">ผิด {n} ครั้ง</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="card-pad lg:col-span-2">
            <CardHeader title="ผลแบบทดสอบ" subtitle="แบบทดสอบหน่วย ระดับ และ TOPIK" />
            {assessments.length + attempts.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีผลแบบทดสอบ</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1.5">แบบทดสอบ</th>
                      <th className="py-1.5">วันที่</th>
                      <th className="py-1.5 text-right">คะแนน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...assessments.map((a) => ({ id: a.id, title: a.kind === 'level' ? `ระดับ ${LEVEL_INFO[a.targetId as keyof typeof LEVEL_INFO]?.label ?? a.targetId}` : `หน่วย ${CURRICULUM.flatMap((l) => l.modules.flatMap((m) => m.units)).find((u) => u.id === a.targetId)?.title ?? a.targetId}`, at: a.at, score: a.score, total: a.total, level: a.kind === 'level' ? a.targetId : undefined })),
                      ...attempts.map((a) => ({ id: a.id, title: a.title, at: a.finishedAt, score: a.correct, total: a.total, level: undefined })),
                    ]
                      .sort((a, b) => b.at - a.at)
                      .slice(0, 20)
                      .map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="py-1.5">
                            <span className="flex items-center gap-2">
                              {r.level && <LevelBadge level={r.level as keyof typeof LEVEL_INFO} />}
                              {r.title}
                            </span>
                          </td>
                          <td className="py-1.5 text-muted">{formatThaiDate(toISODate(new Date(r.at)))}</td>
                          <td className={cn('py-1.5 text-right font-semibold tabular-nums', r.score / r.total >= 0.7 ? 'text-success' : 'text-warning')}>
                            {r.score}/{r.total}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
