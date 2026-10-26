import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useFlashcards } from '@/store/flashcards';

/** Choose an existing deck or create a new one. */
export function DeckPicker({ open, onClose, onPick, title = 'เลือกชุด Flashcards' }: { open: boolean; onClose: () => void; onPick: (deckId: string) => void; title?: string }) {
  const { decks, createDeck } = useFlashcards();
  const [name, setName] = useState('');
  const list = Object.values(decks).sort((a, b) => b.createdAt - a.createdAt);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-3">
        {list.length > 0 && (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {list.map((d) => (
              <li key={d.id}>
                <button className="w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:bg-surface-2" onClick={() => (onPick(d.id), onClose())}>
                  {d.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const id = createDeck(name.trim());
            setName('');
            onPick(id);
            onClose();
          }}
        >
          <input className="input" placeholder="สร้างชุดใหม่…" value={name} onChange={(e) => setName(e.target.value)} aria-label="ชื่อชุดใหม่" />
          <button className="btn-primary" disabled={!name.trim()}>
            สร้าง
          </button>
        </form>
      </div>
    </Modal>
  );
}
