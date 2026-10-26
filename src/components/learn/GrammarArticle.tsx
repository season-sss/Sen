import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Layers, NotebookPen } from 'lucide-react';
import type { GrammarPoint } from '@/data/types';
import { GRAMMAR_BY_ID, GRAMMAR_CATEGORY_LABEL } from '@/data/grammar';
import { KoreanText } from '@/components/ui/Korean';
import { LevelBadge, Badge } from '@/components/ui/Badge';
import { useFlashcards } from '@/store/flashcards';
import { useNotes } from '@/store/notes';
import { toast } from '@/components/ui/Toast';
import { useNavigate } from 'react-router-dom';
import { FORM_BY_KEY } from '@/lib/conjugation';

export function GrammarArticle({ g, compact }: { g: GrammarPoint; compact?: boolean }) {
  const { decks, createDeck, addGrammar } = useFlashcards();
  const createNote = useNotes((s) => s.createNote);
  const navigate = useNavigate();

  const addToFlashcards = () => {
    const name = `ไวยากรณ์ ${g.level}`;
    const existing = Object.values(decks).find((d) => d.name === name);
    const id = existing?.id ?? createDeck(name, { level: g.level, description: 'การ์ดไวยากรณ์จาก Grammar Studio' });
    const ok = addGrammar(id, g);
    toast[ok ? 'success' : 'info'](ok ? `เพิ่ม "${g.pattern}" ลงชุด ${name} แล้ว` : 'มีการ์ดนี้อยู่ในชุดแล้ว');
  };

  const saveNote = () => {
    const id = createNote({
      title: g.pattern,
      category: 'ไวยากรณ์',
      tags: [g.level, GRAMMAR_CATEGORY_LABEL[g.category]],
      body: [g.meaning, '', 'วิธีสร้าง:', ...g.formation.map((f) => `• ${f}`), '', 'ตัวอย่าง:', ...g.examples.map((e) => `• ${e.ko} — ${e.th}`)].join('\n'),
    });
    toast.success('บันทึกลง Notes แล้ว');
    navigate(`/notes?id=${id}`);
  };

  return (
    <article className="space-y-5">
      <header>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LevelBadge level={g.level} />
          <Badge tone="lavender">{GRAMMAR_CATEGORY_LABEL[g.category]}</Badge>
          {g.formKey && FORM_BY_KEY[g.formKey] && <Badge tone="sky">ผันได้ใน Conjugation Lab</Badge>}
        </div>
        {compact ? (
          <h2 lang="ko" className="ko text-2xl font-bold">
            {g.pattern}
          </h2>
        ) : (
          <h1 lang="ko" className="ko text-2xl font-bold">
            {g.pattern}
          </h1>
        )}
        <p className="mt-1 text-[15px]">{g.meaning}</p>
      </header>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">วิธีสร้าง</h3>
        <ul className="space-y-1.5">
          {g.formation.map((f, i) => (
            <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {f}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">การใช้งาน</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {g.usage.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted">ตัวอย่างประโยค</h3>
        <ul className="space-y-2">
          {g.examples.map((e, i) => (
            <li key={i} className="rounded-xl border border-border p-3">
              <KoreanText text={e.ko} />
              <div className="mt-1 text-sm text-muted">{e.th}</div>
            </li>
          ))}
        </ul>
      </section>

      {g.mistakes && g.mistakes.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" /> ข้อผิดพลาดที่พบบ่อย
          </h3>
          <ul className="space-y-2">
            {g.mistakes.map((m, i) => (
              <li key={i} className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">
                <div>
                  <span className="text-danger line-through" lang="ko">
                    {m.wrong}
                  </span>{' '}
                  →{' '}
                  <span className="font-semibold text-success" lang="ko">
                    {m.right}
                  </span>
                </div>
                <div className="mt-1 text-muted">{m.why}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && g.related && g.related.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted">ไวยากรณ์ที่เกี่ยวข้อง / เปรียบเทียบ</h3>
          <div className="flex flex-wrap gap-2">
            {g.related.map((id) => (
              <Link key={id} to={`/grammar/${id}`} className="chip" lang="ko">
                {GRAMMAR_BY_ID[id]?.pattern} <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary btn-sm" onClick={addToFlashcards}>
          <Layers className="h-4 w-4" /> เพิ่มลง Flashcards
        </button>
        <button className="btn-secondary btn-sm" onClick={saveNote}>
          <NotebookPen className="h-4 w-4" /> บันทึกลง Notes
        </button>
        {g.formKey && FORM_BY_KEY[g.formKey] && (
          <Link className="btn-secondary btn-sm" to={`/conjugation?form=${g.formKey}`}>
            ทดลองผันคำ
          </Link>
        )}
      </div>
    </article>
  );
}
