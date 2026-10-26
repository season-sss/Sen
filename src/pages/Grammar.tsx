import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { GRAMMAR, GRAMMAR_CATEGORY_LABEL } from '@/data/grammar';
import { LEVEL_INFO, type GrammarPoint } from '@/data/types';

type LevelTab = 'all' | GrammarPoint['level'];

export default function Grammar() {
  const [level, setLevel] = useState<LevelTab>('all');
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      GRAMMAR.filter(
        (g) =>
          (level === 'all' || g.level === level) &&
          (cat === 'all' || g.category === cat) &&
          (!q.trim() || g.pattern.includes(q.trim()) || g.meaning.includes(q.trim()) || g.examples.some((e) => e.ko.includes(q.trim()))),
      ),
    [level, cat, q],
  );
  const cats = [...new Set(GRAMMAR.filter((g) => level === 'all' || g.level === level).map((g) => g.category))];

  return (
    <div>
      <PageHeader title="Grammar Studio" subtitle={`${GRAMMAR.length} หัวข้อไวยากรณ์ เรียงจากง่ายไปยาก พร้อมตัวอย่าง ข้อผิดพลาดที่พบบ่อย และแบบฝึกหัด`} />
      <Tabs
        className="mb-4"
        value={level}
        onChange={(v) => {
          setLevel(v);
          setCat('all');
        }}
        tabs={[{ id: 'all' as LevelTab, label: 'ทั้งหมด' }, ...(['A1', 'A2', 'B1', 'B2', 'ADV'] as const).map((l) => ({ id: l as LevelTab, label: LEVEL_INFO[l].label }))]}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="ค้นหารูปไวยากรณ์ เช่น 아서, ถ้า" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาไวยากรณ์" />
        </label>
        <select className="input sm:w-56" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="หมวดไวยากรณ์">
          <option value="all">ทุกหมวด</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {GRAMMAR_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      {list.length === 0 ? (
        <EmptyState title="ไม่พบหัวข้อไวยากรณ์" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => (
            <Link key={g.id} to={`/grammar/${g.id}`} className="card group flex flex-col p-4 transition hover:shadow-lift">
              <div className="mb-2 flex items-center gap-2">
                <LevelBadge level={g.level} />
                <Badge>{GRAMMAR_CATEGORY_LABEL[g.category]}</Badge>
              </div>
              <div lang="ko" className="ko text-lg font-bold">
                {g.pattern}
              </div>
              <p className="mt-1 flex-1 text-sm text-muted">{g.meaning}</p>
              <div lang="ko" className="ko mt-3 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm">
                {g.examples[0].ko}
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-lavender">
                เรียน · {g.exercises.length} แบบฝึกหัด <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
