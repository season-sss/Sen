import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { jsonStorage, uid } from './persist';

export interface NoteVocab {
  ko: string;
  th: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  pinned: boolean;
  lessonId?: string;
  vocab: NoteVocab[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_CATEGORIES = ['ทั่วไป', 'คำศัพท์', 'ไวยากรณ์', 'การผันคำ', 'ประโยคตัวอย่าง', 'TOPIK'];

interface NotesState {
  notes: Record<string, Note>;
  categories: string[];
  createNote: (init?: Partial<Omit<Note, 'id' | 'createdAt' | 'updatedAt'>>) => string;
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  addCategory: (name: string) => void;
  /** Append a word to the personal vocabulary note (created on first use) */
  addToVocabList: (item: NoteVocab) => string;
}

export const VOCAB_LIST_TITLE = 'รายการคำศัพท์ส่วนตัว';

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: {},
      categories: DEFAULT_CATEGORIES,
      createNote: (init = {}) => {
        const id = uid('note');
        const now = Date.now();
        const note: Note = { id, title: '', body: '', category: 'ทั่วไป', tags: [], pinned: false, vocab: [], ...init, createdAt: now, updatedAt: now };
        set((s) => ({ notes: { ...s.notes, [id]: note } }));
        return id;
      },
      updateNote: (id, patch) => set((s) => (s.notes[id] ? { notes: { ...s.notes, [id]: { ...s.notes[id], ...patch, updatedAt: Date.now() } } } : s)),
      deleteNote: (id) =>
        set((s) => {
          const { [id]: _n, ...notes } = s.notes;
          return { notes };
        }),
      togglePin: (id) => set((s) => (s.notes[id] ? { notes: { ...s.notes, [id]: { ...s.notes[id], pinned: !s.notes[id].pinned } } } : s)),
      addCategory: (name) => set((s) => (name.trim() && !s.categories.includes(name.trim()) ? { categories: [...s.categories, name.trim()] } : s)),
      addToVocabList: (item) => {
        let note = Object.values(get().notes).find((n) => n.title === VOCAB_LIST_TITLE && n.category === 'คำศัพท์');
        const id = note?.id ?? get().createNote({ title: VOCAB_LIST_TITLE, category: 'คำศัพท์', tags: ['vocabulary'] });
        note = get().notes[id];
        if (!note.vocab.some((v) => v.ko === item.ko)) get().updateNote(id, { vocab: [...note.vocab, item] });
        return id;
      },
    }),
    { name: 'haneul:notes', storage: jsonStorage, version: 1 },
  ),
);

export function searchNotes(notes: Note[], query: string): Note[] {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q)) ||
      n.vocab.some((v) => v.ko.includes(q) || v.th.toLowerCase().includes(q)),
  );
}

export function noteToMarkdown(n: Note): string {
  const lines = [`# ${n.title || 'ไม่มีชื่อ'}`, '', `หมวด: ${n.category}${n.tags.length ? ` · แท็ก: ${n.tags.join(', ')}` : ''}`, '', n.body];
  if (n.vocab.length) lines.push('', '## คำศัพท์', '', '| เกาหลี | ไทย |', '|---|---|', ...n.vocab.map((v) => `| ${v.ko} | ${v.th} |`));
  return lines.join('\n');
}
