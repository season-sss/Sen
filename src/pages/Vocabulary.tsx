import { useMemo, useState } from 'react';
import { Search, Layers, Plus, Info } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { KoreanText, SpeakButton } from '@/components/ui/Korean';
import { LevelBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { DeckPicker } from '@/components/learn/DeckPicker';
import { toast } from '@/components/ui/Toast';
import { VOCABULARY, TOPICS, TOPIC_BY_ID } from '@/data/vocabulary';
import { LEVEL_INFO, LEVEL_MAPPING_NOTE, POS_INFO, type Pos, type VocabLevel } from '@/data/types';
import { romanize } from '@/lib/hangul';
import { useFlashcards } from '@/store/flashcards';
import { useNotes } from '@/store/notes';
import { cn } from '@/lib/cn';

const LEVELS: VocabLevel[] = ['A1', 'A2', 'B1', 'B2'];
const PAGE = 48;

export default function Vocabulary() {
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<VocabLevel | 'all'>('all');
  const [topic, setTopic] = useState<string>('all');
  const [pos, setPos] = useState<Pos | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);
  const [picker, setPicker] = useState<{ ids: string[] } | null>(null);
  const addVocab = useFlashcards((s) => s.addVocab);
  const addToVocabList = useNotes((s) => s.addToVocabList);

  const counts = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, VOCABULARY.filter((v) => v.level === l).length])), []);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return VOCABULARY.filter(
      (v) =>
        (level === 'all' || v.level === level) &&
        (topic === 'all' || v.topic === topic) &&
        (pos === 'all' || v.pos === pos) &&
        (!qq || v.ko.includes(qq) || v.th.toLowerCase().includes(qq) || romanize(v.ko).includes(qq.replace(/\s/g, '')) || v.ex.includes(qq)),
    );
  }, [q, level, topic, pos]);
  const topicsAvailable = TOPICS.filter((t) => VOCABULARY.some((v) => v.topic === t.id && (level === 'all' || v.level === level)));

  return (
    <div>
      <PageHeader
        title="คลังคำศัพท์"
        subtitle={`${VOCABULARY.length.toLocaleString()} คำที่ใช้ในชีวิตประจำวัน พร้อมประโยคตัวอย่างและคำแปล แบ่งระดับ A1–B2`}
        action={
          <button className="btn-secondary" disabled={!filtered.length} onClick={() => setPicker({ ids: filtered.map((v) => v.id) })}>
            <Layers className="h-4 w-4" /> เพิ่มที่กรองไว้ ({filtered.length}) ลง Flashcards
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVELS.map((l) => (
          <button key={l} onClick={() => setLevel(level === l ? 'all' : l)} className={cn('card p-3 text-left transition', level === l && 'ring-2 ring-lavender')}>
            <LevelBadge level={l} />
            <div className="mt-1 text-xl font-bold">{counts[l]}</div>
            <div className="text-[11px] text-muted">{LEVEL_INFO[l].topik}</div>
          </button>
        ))}
      </div>

      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="ค้นหา: เกาหลี / ไทย / romanization" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="ค้นหาคำศัพท์" />
        </label>
        <select className="input" value={topic} onChange={(e) => (setTopic(e.target.value), setLimit(PAGE))} aria-label="หมวด">
          <option value="all">ทุกหมวด</option>
          {topicsAvailable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.th}
            </option>
          ))}
        </select>
        <select className="input" value={pos} onChange={(e) => (setPos(e.target.value as Pos | 'all'), setLimit(PAGE))} aria-label="ประเภทคำ">
          <option value="all">ทุกประเภทคำ</option>
          {(Object.keys(POS_INFO) as Pos[]).map((p) => (
            <option key={p} value={p}>
              {POS_INFO[p].th} ({POS_INFO[p].ko})
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 text-sm text-muted">พบ {filtered.length} คำ</div>
      {filtered.length === 0 ? (
        <EmptyState icon={<Search className="h-6 w-6" />} title="ไม่พบคำศัพท์" message="ลองเปลี่ยนคำค้นหรือตัวกรอง" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.slice(0, limit).map((v) => (
            <div key={v.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <KoreanText text={v.ko} size="lg" pron={v.pron} />
                <LevelBadge level={v.level} />
              </div>
              <div className="mt-1 font-medium">{v.th}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Icon name={TOPIC_BY_ID[v.topic].icon} className="h-3.5 w-3.5" />
                {TOPIC_BY_ID[v.topic].th} · {POS_INFO[v.pos].th}
              </div>
              <div className="mt-2 flex-1 rounded-lg bg-surface-2 p-2.5 text-sm">
                <div lang="ko" className="ko flex items-start gap-1.5">
                  <span className="flex-1">{v.ex}</span>
                  <SpeakButton text={v.ex} size="sm" />
                </div>
                <div className="text-muted">{v.exTh}</div>
              </div>
              {v.note && <div className="mt-2 text-xs text-warning">{v.note}</div>}
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary btn-sm flex-1" onClick={() => setPicker({ ids: [v.id] })}>
                  <Layers className="h-3.5 w-3.5" /> Flashcard
                </button>
                <button
                  className="btn-secondary btn-sm flex-1"
                  onClick={() => {
                    addToVocabList({ ko: v.ko, th: v.th });
                    toast.success(`บันทึก ${v.ko} ลง Notes แล้ว`);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> รายการส่วนตัว
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {limit < filtered.length && (
        <div className="mt-5 text-center">
          <button className="btn-secondary" onClick={() => setLimit(limit + PAGE)}>
            แสดงเพิ่ม ({filtered.length - limit} คำ)
          </button>
        </div>
      )}
      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {LEVEL_MAPPING_NOTE}
      </p>

      <DeckPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        onPick={(deckId) => {
          const entries = VOCABULARY.filter((v) => picker?.ids.includes(v.id));
          const n = addVocab(deckId, entries);
          toast.success(n ? `เพิ่ม ${n} การ์ดแล้ว` : 'การ์ดทั้งหมดอยู่ในชุดนี้แล้ว');
        }}
      />
    </div>
  );
}
