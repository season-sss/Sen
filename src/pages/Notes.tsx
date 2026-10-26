import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, Pin, PinOff, Trash2, Download, ArrowLeft, Link2, X, CheckCircle2, NotebookPen, FolderPlus } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { SpeakButton } from '@/components/ui/Korean';
import { toast } from '@/components/ui/Toast';
import { noteToMarkdown, searchNotes, useNotes, type Note } from '@/store/notes';
import { ALL_LESSONS, LESSON_INDEX } from '@/data/curriculum';
import { cn } from '@/lib/cn';

function download(name: string, content: string, type = 'text/markdown') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 10) return 'เมื่อสักครู่';
  if (s < 60) return `${s} วินาทีที่แล้ว`;
  if (s < 3600) return `${Math.round(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงที่แล้ว`;
  return new Date(ts).toLocaleDateString('th-TH');
}

function Editor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { updateNote, deleteNote, togglePin, categories, addCategory } = useNotes();
  const [tagInput, setTagInput] = useState('');
  const [ko, setKo] = useState('');
  const [th, setTh] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [lessonQ, setLessonQ] = useState('');
  const [newCat, setNewCat] = useState('');
  const lesson = note.lessonId ? LESSON_INDEX[note.lessonId] : undefined;

  return (
    <div className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button className="btn-ghost btn-sm -ml-2 lg:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> โน้ตทั้งหมด
        </button>
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> บันทึกอัตโนมัติ · {timeAgo(note.updatedAt)}
        </span>
        <div className="flex gap-1">
          <button className="btn-ghost btn-sm" onClick={() => togglePin(note.id)} aria-pressed={note.pinned}>
            {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />} {note.pinned ? 'เลิกปักหมุด' : 'ปักหมุด'}
          </button>
          <button className="btn-ghost btn-sm" onClick={() => download(`${note.title || 'note'}.md`, noteToMarkdown(note))}>
            <Download className="h-4 w-4" />
          </button>
          <button className="btn-ghost btn-sm text-danger" onClick={() => setConfirm(true)} aria-label="ลบโน้ต">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted" placeholder="ชื่อโน้ต" value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value })} aria-label="ชื่อโน้ต" />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="note-cat">
            หมวดหมู่
          </label>
          <div className="flex gap-2">
            <select id="note-cat" className="input" value={note.category} onChange={(e) => updateNote(note.id, { category: e.target.value })}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <form
            className="mt-1.5 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (newCat.trim()) {
                addCategory(newCat.trim());
                updateNote(note.id, { category: newCat.trim() });
                setNewCat('');
              }
            }}
          >
            <input className="input py-1.5 text-xs" placeholder="หมวดใหม่" value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="สร้างหมวดหมู่ใหม่" />
            <button className="btn-secondary btn-sm" disabled={!newCat.trim()} aria-label="เพิ่มหมวดหมู่">
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
        <div>
          <div className="label">บทเรียนที่เชื่อม</div>
          {lesson ? (
            <div className="flex items-center gap-2">
              <Link to={`/learn/${note.lessonId}`} className="chip flex-1 truncate">
                <Link2 className="h-3 w-3" /> {lesson.lesson.title}
              </Link>
              <button className="btn-ghost p-1.5" onClick={() => updateNote(note.id, { lessonId: undefined })} aria-label="ยกเลิกการเชื่อม">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button className="btn-secondary btn-sm w-full" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4" /> เชื่อมกับบทเรียน
            </button>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="label">แท็ก</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {note.tags.map((t) => (
            <span key={t} className="chip">
              #{t}
              <button onClick={() => updateNote(note.id, { tags: note.tags.filter((x) => x !== t) })} aria-label={`ลบแท็ก ${t}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = tagInput.trim().replace(/^#/, '');
              if (t && !note.tags.includes(t)) updateNote(note.id, { tags: [...note.tags, t] });
              setTagInput('');
            }}
          >
            <input className="rounded-full border border-dashed border-border bg-transparent px-3 py-1 text-xs outline-none focus:border-lavender" placeholder="+ แท็ก" value={tagInput} onChange={(e) => setTagInput(e.target.value)} aria-label="เพิ่มแท็ก" />
          </form>
        </div>
      </div>

      <textarea
        className="input mt-4 min-h-[260px] leading-relaxed"
        placeholder="เขียนโน้ต กฎการผันคำ ตัวอย่างประโยค…"
        value={note.body}
        onChange={(e) => updateNote(note.id, { body: e.target.value })}
        aria-label="เนื้อหาโน้ต"
      />

      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold">รายการคำศัพท์ในโน้ต ({note.vocab.length})</div>
        {note.vocab.length > 0 && (
          <ul className="mb-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {note.vocab.map((v, i) => (
              <li key={`${v.ko}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span lang="ko" className="ko font-semibold">
                  {v.ko}
                </span>
                <SpeakButton text={v.ko} size="sm" />
                <span className="flex-1 text-muted">{v.th}</span>
                <button className="btn-ghost p-1" onClick={() => updateNote(note.id, { vocab: note.vocab.filter((_, j) => j !== i) })} aria-label={`ลบ ${v.ko}`}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ko.trim() || !th.trim()) return;
            updateNote(note.id, { vocab: [...note.vocab, { ko: ko.trim(), th: th.trim() }] });
            setKo('');
            setTh('');
          }}
        >
          <input className="input ko" lang="ko" placeholder="คำเกาหลี" value={ko} onChange={(e) => setKo(e.target.value)} aria-label="คำเกาหลี" />
          <input className="input" placeholder="ความหมายไทย" value={th} onChange={(e) => setTh(e.target.value)} aria-label="ความหมายไทย" />
          <button className="btn-secondary" disabled={!ko.trim() || !th.trim()}>
            <Plus className="h-4 w-4" /> เพิ่ม
          </button>
        </form>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="ลบโน้ตนี้?"
        message="ไม่สามารถกู้คืนได้"
        danger
        confirmLabel="ลบ"
        onConfirm={() => {
          deleteNote(note.id);
          onBack();
          toast.success('ลบโน้ตแล้ว');
        }}
      />
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="เลือกบทเรียน" size="md">
        <input className="input mb-3" placeholder="ค้นหาบทเรียน" value={lessonQ} onChange={(e) => setLessonQ(e.target.value)} aria-label="ค้นหาบทเรียน" />
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {ALL_LESSONS.filter((l) => !lessonQ || l.title.includes(lessonQ))
            .slice(0, 60)
            .map((l) => (
              <li key={l.id}>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onClick={() => {
                    updateNote(note.id, { lessonId: l.id });
                    setLinkOpen(false);
                  }}
                >
                  <span className="text-xs text-muted">{LESSON_INDEX[l.id].level.id} · </span>
                  {l.title}
                </button>
              </li>
            ))}
        </ul>
      </Modal>
    </div>
  );
}

export default function Notes() {
  const [params, setParams] = useSearchParams();
  const { notes, categories, createNote } = useNotes();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const openId = params.get('id');
  const all = useMemo(() => Object.values(notes), [notes]);
  const list = useMemo(
    () => searchNotes(all, q).filter((n) => cat === 'all' || n.category === cat).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt),
    [all, q, cat],
  );
  const open = openId ? notes[openId] : undefined;

  const newNote = () => {
    const id = createNote({ category: cat === 'all' ? 'ทั่วไป' : cat });
    setParams({ id });
  };

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="บันทึกส่วนตัว คำศัพท์ กฎการผันคำ และตัวอย่างประโยค — เชื่อมกับบทเรียนและ Translator ได้"
        action={
          <>
            <button
              className="btn-secondary"
              disabled={!all.length}
              onClick={() => download(`haneul-notes-${new Date().toISOString().slice(0, 10)}.md`, all.map(noteToMarkdown).join('\n\n---\n\n'))}
            >
              <Download className="h-4 w-4" /> Export ทั้งหมด
            </button>
            <button className="btn-primary" onClick={newNote}>
              <Plus className="h-4 w-4" /> โน้ตใหม่
            </button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className={cn('space-y-3', open && 'hidden lg:block')}>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="ค้นหา (ไทย / เกาหลี / แท็ก)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาโน้ต" />
          </label>
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
            {['all', ...categories].map((c) => (
              <button key={c} className={cn('chip whitespace-nowrap', cat === c && 'chip-active')} onClick={() => setCat(c)}>
                {c === 'all' ? 'ทั้งหมด' : c}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<NotebookPen className="h-6 w-6" />} title={all.length ? 'ไม่พบโน้ต' : 'ยังไม่มีโน้ต'} message={all.length ? 'ลองเปลี่ยนคำค้น' : 'สร้างโน้ตใหม่ หรือบันทึกจากบทเรียน คำศัพท์ และ Translator'} />
          ) : (
            <ul className="space-y-2">
              {list.map((n) => (
                <li key={n.id}>
                  <button onClick={() => setParams({ id: n.id })} className={cn('card w-full p-3 text-left transition hover:shadow-lift', openId === n.id && 'ring-2 ring-lavender')}>
                    <div className="flex items-center gap-1.5">
                      {n.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-lavender" />}
                      <span className="truncate font-semibold">{n.title || 'ไม่มีชื่อ'}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body || (n.vocab.length ? n.vocab.map((v) => v.ko).join(', ') : 'ว่าง')}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Badge>{n.category}</Badge>
                      {n.vocab.length > 0 && <Badge tone="sky">{n.vocab.length} คำ</Badge>}
                      {n.lessonId && <Badge tone="lavender">บทเรียน</Badge>}
                      <span className="ml-auto text-[11px] text-muted">{timeAgo(n.updatedAt)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={cn(!open && 'hidden lg:block')}>
          {open ? <Editor key={open.id} note={open} onBack={() => setParams({})} /> : <EmptyState title="เลือกโน้ตเพื่อแก้ไข" message="หรือสร้างโน้ตใหม่ ทุกการแก้ไขบันทึกอัตโนมัติ" action={<button className="btn-primary" onClick={newNote}>โน้ตใหม่</button>} />}
        </div>
      </div>
    </div>
  );
}
