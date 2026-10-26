import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { jsonStorage, uid } from './persist';
import type { Level, VocabEntry, GrammarPoint } from '@/data/types';
import { newSrsState, review as srsReview, type Grade, type ReviewLog, type SrsState } from '@/lib/srs/scheduler';
import { today } from '@/lib/util/date';

export type CardType = 'vocab' | 'grammar' | 'sentence' | 'custom';

export interface Card {
  id: string;
  deckId: string;
  type: CardType;
  /** Korean side (word, grammar pattern or sentence) */
  front: string;
  /** Thai meaning / usage */
  back: string;
  example?: string;
  exampleTh?: string;
  note?: string;
  ref?: { type: 'vocab' | 'grammar' | 'question'; id: string };
  srs: SrsState;
  createdAt: number;
  updatedAt: number;
}

export interface Deck {
  id: string;
  name: string;
  description?: string;
  level?: Level;
  /** Auto decks created by the system (e.g. wrong answers) */
  system?: 'mistakes';
  createdAt: number;
}

interface FlashcardState {
  decks: Record<string, Deck>;
  cards: Record<string, Card>;
  logs: ReviewLog[];
  newIntroduced: { date: string; count: number };
  createDeck: (name: string, opts?: Partial<Pick<Deck, 'description' | 'level' | 'system'>>) => string;
  updateDeck: (id: string, patch: Partial<Pick<Deck, 'name' | 'description' | 'level'>>) => void;
  deleteDeck: (id: string) => void;
  addCard: (deckId: string, card: Omit<Card, 'id' | 'deckId' | 'srs' | 'createdAt' | 'updatedAt'>) => string | null;
  updateCard: (id: string, patch: Partial<Pick<Card, 'front' | 'back' | 'example' | 'exampleTh' | 'note'>>) => void;
  deleteCard: (id: string) => void;
  resetCard: (id: string) => void;
  addVocab: (deckId: string, entries: VocabEntry[]) => number;
  addGrammar: (deckId: string, g: GrammarPoint) => boolean;
  ensureMistakesDeck: () => string;
  reviewCard: (id: string, grade: Grade) => void;
  importDeck: (data: unknown) => { deckId: string; count: number };
}

const MAX_LOGS = 8000;

function hasDuplicate(cards: Record<string, Card>, deckId: string, front: string, refId?: string) {
  return Object.values(cards).some((c) => c.deckId === deckId && (c.front === front || (refId && c.ref?.id === refId)));
}

export const DeckExportSchema = z.object({
  format: z.literal('haneul-deck'),
  version: z.literal(1),
  deck: z.object({ name: z.string().min(1).max(120), description: z.string().max(500).optional(), level: z.enum(['L0', 'A1', 'A2', 'B1', 'B2', 'ADV']).optional() }),
  cards: z
    .array(
      z.object({
        type: z.enum(['vocab', 'grammar', 'sentence', 'custom']).default('custom'),
        front: z.string().min(1).max(500),
        back: z.string().min(1).max(1000),
        example: z.string().max(500).optional(),
        exampleTh: z.string().max(500).optional(),
        note: z.string().max(1000).optional(),
      }),
    )
    .max(5000),
});

export type DeckExport = z.infer<typeof DeckExportSchema>;

export const useFlashcards = create<FlashcardState>()(
  persist(
    (set, get) => ({
      decks: {},
      cards: {},
      logs: [],
      newIntroduced: { date: '', count: 0 },

      createDeck: (name, opts = {}) => {
        const id = uid('deck');
        set((s) => ({ decks: { ...s.decks, [id]: { id, name, createdAt: Date.now(), ...opts } } }));
        return id;
      },
      updateDeck: (id, patch) => set((s) => (s.decks[id] ? { decks: { ...s.decks, [id]: { ...s.decks[id], ...patch } } } : s)),
      deleteDeck: (id) =>
        set((s) => {
          const { [id]: _d, ...decks } = s.decks;
          const cards = Object.fromEntries(Object.entries(s.cards).filter(([, c]) => c.deckId !== id));
          return { decks, cards };
        }),

      addCard: (deckId, card) => {
        if (!get().decks[deckId] || hasDuplicate(get().cards, deckId, card.front, card.ref?.id)) return null;
        const id = uid('card');
        const now = Date.now();
        set((s) => ({ cards: { ...s.cards, [id]: { ...card, id, deckId, srs: newSrsState(now), createdAt: now, updatedAt: now } } }));
        return id;
      },
      updateCard: (id, patch) => set((s) => (s.cards[id] ? { cards: { ...s.cards, [id]: { ...s.cards[id], ...patch, updatedAt: Date.now() } } } : s)),
      deleteCard: (id) =>
        set((s) => {
          const { [id]: _c, ...cards } = s.cards;
          return { cards };
        }),
      resetCard: (id) => set((s) => (s.cards[id] ? { cards: { ...s.cards, [id]: { ...s.cards[id], srs: newSrsState() } } } : s)),

      addVocab: (deckId, entries) => {
        let n = 0;
        for (const e of entries) {
          const id = get().addCard(deckId, { type: 'vocab', front: e.ko, back: e.th, example: e.ex, exampleTh: e.exTh, ref: { type: 'vocab', id: e.id } });
          if (id) n++;
        }
        return n;
      },
      addGrammar: (deckId, g) =>
        Boolean(
          get().addCard(deckId, {
            type: 'grammar',
            front: g.pattern,
            back: `${g.meaning}\n${g.formation.slice(0, 2).join('\n')}`,
            example: g.examples[0]?.ko,
            exampleTh: g.examples[0]?.th,
            ref: { type: 'grammar', id: g.id },
          }),
        ),

      ensureMistakesDeck: () => {
        const existing = Object.values(get().decks).find((d) => d.system === 'mistakes');
        if (existing) return existing.id;
        return get().createDeck('คำที่ตอบผิด', { system: 'mistakes', description: 'สร้างอัตโนมัติจากคำตอบที่ผิดในแบบฝึกหัดและข้อสอบ' });
      },

      reviewCard: (id, grade) => {
        const card = get().cards[id];
        if (!card) return;
        const wasNew = card.srs.phase === 'new';
        const { state, log } = srsReview(id, card.srs, grade);
        const d = today();
        set((s) => ({
          cards: { ...s.cards, [id]: { ...card, srs: state } },
          logs: [...s.logs, log].slice(-MAX_LOGS),
          newIntroduced: wasNew ? { date: d, count: (s.newIntroduced.date === d ? s.newIntroduced.count : 0) + 1 } : s.newIntroduced,
        }));
      },

      importDeck: (data) => {
        const parsed = DeckExportSchema.parse(data);
        const deckId = get().createDeck(parsed.deck.name, { description: parsed.deck.description, level: parsed.deck.level });
        let count = 0;
        for (const c of parsed.cards) if (get().addCard(deckId, c)) count++;
        return { deckId, count };
      },
    }),
    { name: 'haneul:flashcards', storage: jsonStorage, version: 1 },
  ),
);

export function exportDeck(deck: Deck, cards: Card[]): DeckExport {
  return {
    format: 'haneul-deck',
    version: 1,
    deck: { name: deck.name, description: deck.description, level: deck.level },
    cards: cards.map((c) => ({ type: c.type, front: c.front, back: c.back, example: c.example, exampleTh: c.exampleTh, note: c.note })),
  };
}

/** Parse a simple CSV / TSV (front,back[,example,exampleTh]) — e.g. from a spreadsheet or Anki export. */
export function parseCardsCsv(text: string): DeckExport['cards'] {
  const sep = text.includes('\t') ? '\t' : ',';
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, '')))
    .filter((cols) => cols[0] && cols[1])
    .map(([front, back, example, exampleTh]) => ({ type: 'custom' as const, front, back, example: example || undefined, exampleTh: exampleTh || undefined }));
}
