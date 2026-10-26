import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Download, Upload, Trash2, Pencil, RotateCcw, Layers, Sparkles, Search } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, Notice } from '@/components/ui/States';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { exportDeck, parseCardsCsv, useFlashcards, type Card as FCard, type Deck } from '@/store/flashcards';
import { buildQueue, isDue, memoryLevel, type MemoryLevel } from '@/lib/srs/scheduler';
import { vocabByLevel } from '@/data/vocabulary';
import type { VocabLevel } from '@/data/types';
import { useSettings } from '@/store/settings';
import { today, addDays, toISODate } from '@/lib/util/date';
import { cn } from '@/lib/cn';

const MEM_COLORS: Record<MemoryLevel, string> = { new: 'bg-border', learning: 'bg-sky', young: 'bg-lavender', mature: 'bg-success' };
const MEM_LABEL: Record<MemoryLevel, string> = { new: 'ใหม่', learning: 'กำลังจำ', young: 'จำได้ (สั้น)', mature: 'จำได้ดี (≥21 วัน)' };

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function deckStats(cards: FCard[]) {
  const now = Date.now();
  const mem: Record<MemoryLevel, number> = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cards) mem[memoryLevel(c.srs)]++;
  return { total: cards.length, due: cards.filter((c) => isDue(c.srs, now)).length, mem };
}

function MemoryBar({ mem, total }: { mem: Record<MemoryLevel, number>; total: number }) {
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={(Object.keys(mem) as MemoryLevel[]).map((k) => `${MEM_LABEL[k]} ${mem[k]}`).join(', ')}>
        {(Object.keys(mem) as MemoryLevel[]).map((k) => (
          <div key={k} className={MEM_COLORS[k]} style={{ width: total ? `${(mem[k] / total) * 100}%` : 0 }} title={`${MEM_LABEL[k]}: ${mem[k]}`} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {(Object.keys(mem) as MemoryLevel[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', MEM_COLORS[k])} />
            {MEM_LABEL[k]} {mem[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

function CardEditor({ open, onClose, deckId, card }: { open: boolean; onClose: () => void; deckId: string; card?: FCard }) {
  const { addCard, updateCard } = useFlashcards();
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
  const [example, setExample] = useState(card?.example ?? '');
  const [exampleTh, setExampleTh] = useState(card?.exampleTh ?? '');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={card ? 'แก้ไขการ์ด' : 'เพิ่มการ์ด'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            className="btn-primary"
            disabled={!front.trim() || !back.trim()}
            onClick={() => {
              if (card) updateCard(card.id, { front, back, example: example || undefined, exampleTh: exampleTh || undefined });
              else if (!addCard(deckId, { type: 'custom', front: front.trim(), back: back.trim(), example: example || undefined, exampleTh: exampleTh || undefined })) {
                toast.warning('มีการ์ดด้านหน้านี้ในชุดแล้ว');
                return;
              }
              toast.success('บันทึกการ์ดแล้ว');
              onClose();
            }}
          >
            บันทึก
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="fc-front">
            ด้านหน้า (ภาษาเกาหลี / รูปไวยากรณ์)
          </label>
          <input id="fc-front" className="input ko" lang="ko" value={front} onChange={(e) => setFront(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fc-back">
            ด้านหลัง (ความหมาย / วิธีใช้)
          </label>
          <textarea id="fc-back" className="input min-h-[80px]" value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fc-ex">
              ประโยคตัวอย่าง (ไม่บังคับ)
            </label>
            <input id="fc-ex" className="input ko" lang="ko" value={example} onChange={(e) => setExample(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="fc-exth">
              คำแปลตัวอย่าง
            </label>
            <input id="fc-exth" className="input" value={exampleTh} onChange={(e) => setExampleTh(e.target.value)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function DeckDetail({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const { cards, deleteCard, resetCard, deleteDeck, updateDeck } = useFlashcards();
  const list = Object.values(cards).filter((c) => c.deckId === deck.id);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<FCard | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rename, setRename] = useState(deck.name);
  const filtered = list.filter((c) => !q || c.front.includes(q) || c.back.includes(q)).sort((a, b) => b.createdAt - a.createdAt);
  const s = deckStats(list);

  return (
    <Card className="card-pad">
      <CardHeader
        title={deck.name}
        subtitle={deck.description}
        action={
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ปิด
          </button>
        }
      />
      <MemoryBar mem={s.mem} total={s.total} />
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/flashcards/study?deck=${deck.id}`} className="btn-primary btn-sm">
          <Play className="h-4 w-4" /> ทบทวน ({s.due + s.mem.new})
        </Link>
        <button className="btn-secondary btn-sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> เพิ่มการ์ด
        </button>
        <button className="btn-secondary btn-sm" onClick={() => download(`${deck.name}.haneul.json`, JSON.stringify(exportDeck(deck, list), null, 2), 'application/json')}>
          <Download className="h-4 w-4" /> Export JSON
        </button>
        <button
          className="btn-secondary btn-sm"
          onClick={() => download(`${deck.name}.csv`, ['front,back,example,exampleTh', ...list.map((c) => [c.front, c.back, c.example ?? '', c.exampleTh ?? ''].map((x) => `"${x.replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(','))].join('\n'), 'text/csv')}
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> ลบชุด
        </button>
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (rename.trim()) {
            updateDeck(deck.id, { name: rename.trim() });
            toast.success('เปลี่ยนชื่อชุดแล้ว');
          }
        }}
      >
        <input className="input" value={rename} onChange={(e) => setRename(e.target.value)} aria-label="ชื่อชุด" />
        <button className="btn-secondary" disabled={rename.trim() === deck.name}>
          <Pencil className="h-4 w-4" /> เปลี่ยนชื่อ
        </button>
      </form>

      <label className="relative mt-4 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="ค้นหาการ์ดในชุด" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาการ์ด" />
      </label>
      {filtered.length === 0 ? (
        <EmptyState className="mt-4" title="ยังไม่มีการ์ด" message="เพิ่มเอง หรือเพิ่มจากหน้าคำศัพท์ ไวยากรณ์ บทเรียน หรือคำที่ตอบผิด" />
      ) : (
        <ul className="mt-3 max-h-[480px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {filtered.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', MEM_COLORS[memoryLevel(c.srs)])} title={MEM_LABEL[memoryLevel(c.srs)]} />
              <div className="min-w-0 flex-1">
                <div lang="ko" className="ko truncate font-semibold">
                  {c.front}
                </div>
                <div className="truncate text-xs text-muted">{c.back.split('\n')[0]}</div>
              </div>
              <span className="hidden text-[11px] text-muted sm:block">{c.srs.phase === 'new' ? 'ใหม่' : `ทบทวน ${toISODate(new Date(c.srs.due))}`}</span>
              <button className="btn-ghost p-1.5" onClick={() => setEditing(c)} aria-label={`แก้ไข ${c.front}`}>
                <Pencil className="h-4 w-4" />
              </button>
              <button
                className="btn-ghost p-1.5"
                onClick={() => {
                  resetCard(c.id);
                  toast.info('รีเซ็ตความจำการ์ดแล้ว');
                }}
                aria-label={`รีเซ็ต ${c.front}`}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button className="btn-ghost p-1.5 text-danger" onClick={() => deleteCard(c.id)} aria-label={`ลบ ${c.front}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <CardEditor open onClose={() => setEditing(null)} deckId={deck.id} card={editing === 'new' ? undefined : editing} />}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="ลบชุดการ์ด?"
        message={`การ์ดทั้งหมด ${list.length} ใบและประวัติความจำในชุด "${deck.name}" จะถูกลบ`}
        danger
        confirmLabel="ลบ"
        onConfirm={() => {
          deleteDeck(deck.id);
          onClose();
        }}
      />
    </Card>
  );
}

export default function Flashcards() {
  const { decks, cards, logs, createDeck, addVocab, importDeck, newIntroduced } = useFlashcards();
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvName, setCsvName] = useState('');
  const [levelTab, setLevelTab] = useState<'all' | VocabLevel>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const all = Object.values(cards);
  const t = today();
  const dailyQueue = buildQueue(all, { newPerDay, newIntroducedToday: newIntroduced.date === t ? newIntroduced.count : 0 });
  const deckList = Object.values(decks)
    .filter((d) => levelTab === 'all' || d.level === levelTab)
    .sort((a, b) => b.createdAt - a.createdAt);
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      const d = toISODate(new Date(l.at));
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [logs]);
  const accuracy = logs.length ? logs.filter((l) => l.grade !== 'again').length / logs.length : 0;

  const createLevelDeck = (level: VocabLevel) => {
    const nm = `คำศัพท์ระดับ ${level}`;
    const existing = Object.values(decks).find((d) => d.name === nm);
    const id = existing?.id ?? createDeck(nm, { level, description: `คำศัพท์ทั้งหมดของระดับ ${level} จากคลังคำศัพท์ HANEUL` });
    const n = addVocab(id, vocabByLevel(level));
    toast.success(n ? `สร้างชุด ${nm} (${n} คำ) — การ์ดใหม่จะถูกแนะนำวันละ ${newPerDay} ใบ` : 'ชุดนี้มีครบแล้ว');
    setOpen(id);
  };

  return (
    <div>
      <PageHeader
        title="Flashcard Studio"
        subtitle="ทบทวนด้วยระบบ Spaced Repetition — ระบบคำนวณวันทบทวนครั้งถัดไปจากผลการตอบจริงของคุณ"
        action={
          <>
            <button className="btn-secondary" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Import
            </button>
            <button className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> สร้างชุดใหม่
            </button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-2">
          <CardHeader title="Daily Review" subtitle={`การ์ดถึงกำหนด + การ์ดใหม่ไม่เกิน ${newPerDay} ใบ/วัน (ปรับได้ในตั้งค่า)`} icon={<Sparkles className="h-5 w-5" />} />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-4xl font-bold">{dailyQueue.length}</div>
              <div className="text-sm text-muted">การ์ดที่ต้องทบทวนวันนี้ จาก {all.length} ใบ</div>
            </div>
            <Link to="/flashcards/study" className={cn('btn-primary', !dailyQueue.length && 'pointer-events-none opacity-50')} aria-disabled={!dailyQueue.length}>
              <Play className="h-4 w-4" /> เริ่มทบทวน
            </Link>
          </div>
          {all.length > 0 && (
            <div className="mt-4">
              <MemoryBar mem={deckStats(all).mem} total={all.length} />
            </div>
          )}
        </Card>
        <Card className="card-pad">
          <CardHeader title="สถิติการทบทวน" subtitle={logs.length ? `ตอบจำได้ ${Math.round(accuracy * 100)}% จาก ${logs.length} ครั้ง` : 'ยังไม่มีประวัติ'} />
          <div className="flex h-24 items-end gap-1.5" role="img" aria-label="จำนวนการทบทวน 7 วัน">
            {week.map((d) => {
              const n = perDay.get(d) ?? 0;
              const max = Math.max(1, ...week.map((x) => perDay.get(x) ?? 0));
              return <div key={d} className="flex-1 rounded-t bg-lavender/70" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 3 : 0 }} title={`${d}: ${n} ครั้ง`} />;
            })}
          </div>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={levelTab}
          onChange={setLevelTab}
          tabs={[{ id: 'all' as const, label: 'ทุกชุด' }, ...(['A1', 'A2', 'B1', 'B2'] as const).map((l) => ({ id: l, label: l }))]}
        />
        <div className="flex flex-wrap gap-1.5">
          {(['A1', 'A2', 'B1', 'B2'] as VocabLevel[]).map((l) => (
            <button key={l} className="chip" onClick={() => createLevelDeck(l)}>
              <Plus className="h-3 w-3" /> ชุดคำศัพท์ {l}
            </button>
          ))}
        </div>
      </div>

      {open && decks[open] && (
        <div className="mb-4">
          <DeckDetail deck={decks[open]} onClose={() => setOpen(null)} />
        </div>
      )}

      {deckList.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="ยังไม่มีชุดการ์ด"
          message="สร้างชุดเอง สร้างชุดคำศัพท์ตามระดับ หรือเพิ่มการ์ดจากบทเรียน คำศัพท์ ไวยากรณ์ และคำที่ตอบผิด"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deckList.map((d) => {
            const list = all.filter((c) => c.deckId === d.id);
            const st = deckStats(list);
            return (
              <div key={d.id} className={cn('card flex flex-col p-4', open === d.id && 'ring-2 ring-lavender')}>
                <div className="mb-1 flex items-center gap-2">
                  {d.level && <LevelBadge level={d.level} />}
                  {d.system === 'mistakes' && <Badge tone="warning">อัตโนมัติ</Badge>}
                </div>
                <button className="text-left font-semibold hover:text-lavender" onClick={() => setOpen(d.id)}>
                  {d.name}
                </button>
                <div className="mb-3 text-xs text-muted">
                  {st.total} ใบ · ถึงกำหนด {st.due} · ใหม่ {st.mem.new}
                </div>
                <MemoryBar mem={st.mem} total={st.total} />
                <div className="mt-3 flex gap-2">
                  <Link to={`/flashcards/study?deck=${d.id}`} className={cn('btn-primary btn-sm flex-1', !(st.due + st.mem.new) && 'pointer-events-none opacity-50')}>
                    <Play className="h-3.5 w-3.5" /> ทบทวน
                  </Link>
                  <button className="btn-secondary btn-sm flex-1" onClick={() => setOpen(d.id)}>
                    จัดการ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="สร้างชุดการ์ดใหม่"
        size="sm"
        footer={
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={() => {
              const id = createDeck(name.trim());
              setName('');
              setCreating(false);
              setOpen(id);
            }}
          >
            สร้าง
          </button>
        }
      >
        <input className="input" placeholder="ชื่อชุด เช่น คำศัพท์จากซีรีส์" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อชุด" autoFocus />
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="นำเข้าชุดการ์ด" size="md">
        <div className="space-y-4">
          <div>
            <div className="label">ไฟล์ JSON ที่ export จาก HANEUL</div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="block w-full text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const r = importDeck(JSON.parse(await f.text()));
                  toast.success(`นำเข้า ${r.count} การ์ดแล้ว`);
                  setImportOpen(false);
                  setOpen(r.deckId);
                } catch (err) {
                  toast.error(`ไฟล์ไม่ถูกต้อง: ${(err as Error).message.slice(0, 120)}`);
                } finally {
                  if (fileRef.current) fileRef.current.value = '';
                }
              }}
            />
          </div>
          <div>
            <div className="label">หรือวาง CSV / TSV (ด้านหน้า, ด้านหลัง, ตัวอย่าง, คำแปลตัวอย่าง)</div>
            <input className="input mb-2" placeholder="ชื่อชุด" value={csvName} onChange={(e) => setCsvName(e.target.value)} aria-label="ชื่อชุดสำหรับ CSV" />
            <textarea className="input ko min-h-[120px] font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'사과,แอปเปิล\n학교,โรงเรียน,학교에 가요.,ไปโรงเรียน'} aria-label="ข้อมูล CSV" />
            <Notice className="mt-2">บรรทัดละหนึ่งการ์ด คั่นด้วยจุลภาคหรือแท็บ — ส่งออกจาก Excel/Google Sheets หรือ Anki (Notes in Plain Text) ได้</Notice>
            <button
              className="btn-primary mt-2"
              disabled={!csv.trim() || !csvName.trim()}
              onClick={() => {
                try {
                  const r = importDeck({ format: 'haneul-deck', version: 1, deck: { name: csvName.trim() }, cards: parseCardsCsv(csv) });
                  toast.success(`นำเข้า ${r.count} การ์ดแล้ว`);
                  setCsv('');
                  setImportOpen(false);
                  setOpen(r.deckId);
                } catch (err) {
                  toast.error(`ข้อมูลไม่ถูกต้อง: ${(err as Error).message.slice(0, 120)}`);
                }
              }}
            >
              นำเข้า CSV
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
