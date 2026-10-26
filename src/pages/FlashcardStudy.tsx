import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Shuffle, PartyPopper, RotateCw } from 'lucide-react';
import { useFlashcards, type Card } from '@/store/flashcards';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { usePlanner } from '@/store/planner';
import { buildQueue, previewIntervals, type Grade } from '@/lib/srs/scheduler';
import { Segmented } from '@/components/ui/Tabs';
import { KoreanText, SpeakButton } from '@/components/ui/Korean';
import { EmptyState } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/Progress';
import { today } from '@/lib/util/date';
import { shuffle } from '@/lib/util/random';
import { cn } from '@/lib/cn';

type Mode = 'ko-th' | 'th-ko' | 'example';

const GRADES: { g: Grade; label: string; key: string; cls: string }[] = [
  { g: 'again', label: 'ยังจำไม่ได้', key: '1', cls: 'border-danger/40 text-danger hover:bg-danger/10' },
  { g: 'hard', label: 'ยาก', key: '2', cls: 'border-warning/40 text-warning hover:bg-warning/10' },
  { g: 'good', label: 'จำได้', key: '3', cls: 'border-sky/40 text-sky hover:bg-sky/10' },
  { g: 'easy', label: 'ง่ายมาก', key: '4', cls: 'border-success/40 text-success hover:bg-success/10' },
];

export default function FlashcardStudy() {
  const [params] = useSearchParams();
  const deckId = params.get('deck');
  const { cards, decks, reviewCard, newIntroduced } = useFlashcards();
  const addMinutes = useProgress((s) => s.addMinutes);
  const newPerDay = useSettings((s) => s.newCardsPerDay);
  const [mode, setMode] = useState<Mode>('ko-th');
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [startedAt] = useState(Date.now());
  const [reviewed, setReviewed] = useState<{ id: string; grade: Grade }[]>([]);
  const markedRef = useRef(false);

  // Build the session queue once; later grades re-insert "again" cards at the end.
  const initial = useMemo(() => {
    const pool = Object.values(cards).filter((c) => !deckId || c.deckId === deckId);
    const t = today();
    return buildQueue(pool, { newPerDay, newIntroducedToday: newIntroduced.date === t ? newIntroduced.count : 0 }).map((c) => c.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);
  const [queue, setQueue] = useState<string[]>(initial);
  useEffect(() => setQueue(initial), [initial]);

  const current: Card | undefined = cards[queue[0]];

  const answer = (g: Grade) => {
    if (!current) return;
    reviewCard(current.id, g);
    setReviewed((r) => [...r, { id: current.id, grade: g }]);
    setFlipped(false);
    setQueue((q) => {
      const rest = q.slice(1);
      return g === 'again' ? [...rest, current.id] : rest;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped) {
        const gr = GRADES.find((x) => x.key === e.key);
        if (gr) answer(gr.g);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(
    () => () => {
      const mins = Math.round((Date.now() - startedAt) / 60000);
      if (mins > 0) addMinutes(mins, 'review');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const title = deckId ? decks[deckId]?.name ?? 'ชุดการ์ด' : 'Daily Review — ทุกชุด';
  const total = initial.length;
  const doneUnique = new Set(reviewed.filter((r) => r.grade !== 'again').map((r) => r.id)).size;

  if (!total)
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="sr-only">ทบทวน Flashcards</h1>
        <EmptyState
          title="ไม่มีการ์ดที่ต้องทบทวนตอนนี้"
          message="ยอดเยี่ยม! กลับมาใหม่เมื่อถึงกำหนด หรือเพิ่มการ์ดใหม่จากคลังคำศัพท์"
          action={
            <Link className="btn-primary" to="/flashcards">
              กลับไป Flashcards
            </Link>
          }
        />
      </div>
    );

  if (!current && reviewed.length > 0 && !markedRef.current) {
    markedRef.current = true;
    queueMicrotask(() => usePlanner.getState().markActivity('review'));
  }

  if (!current)
    return (
      <div className="mx-auto max-w-xl text-center">
        <div className="card card-pad">
          <PartyPopper className="mx-auto mb-3 h-10 w-10 text-lavender" />
          <h1 className="h2">ทบทวนครบแล้ว!</h1>
          <p className="mt-1 text-sm text-muted">
            ทบทวน {reviewed.length} ครั้ง · การ์ด {doneUnique} ใบ — ระบบคำนวณวันทบทวนครั้งถัดไปของแต่ละใบแล้ว
          </p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            {GRADES.map((g) => (
              <div key={g.g} className="rounded-xl bg-surface-2 p-2">
                <div className="text-lg font-bold">{reviewed.filter((r) => r.grade === g.g).length}</div>
                {g.label}
              </div>
            ))}
          </div>
          <Link className="btn-primary mt-5" to="/flashcards">
            กลับไป Flashcards
          </Link>
        </div>
      </div>
    );

  const preview = previewIntervals(current.srs);
  const front =
    mode === 'th-ko' ? (
      <div className="text-center text-2xl font-semibold">{current.back.split('\n')[0]}</div>
    ) : mode === 'example' && current.example ? (
      <div className="text-center">
        <KoreanText text={current.front} size="lg" />
        <div lang="ko" className="ko mt-4 text-lg text-muted">
          {current.example.replace(current.front.replace(/다$/, ''), '＿＿')}
        </div>
      </div>
    ) : (
      <div className="flex justify-center">
        <KoreanText text={current.front} size="xl" />
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link to="/flashcards" className="btn-ghost -ml-2 p-2" aria-label="กลับไป Flashcards">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-base font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setFlipped(false);
            }}
            options={[
              { id: 'ko-th', label: 'เกาหลี → ไทย' },
              { id: 'th-ko', label: 'ไทย → เกาหลี' },
              { id: 'example', label: 'ประโยคตัวอย่าง' },
            ]}
          />
          <button
            className={cn('chip', shuffled && 'chip-active')}
            onClick={() => {
              setQueue((q) => [q[0], ...shuffle(q.slice(1))]);
              setShuffled(true);
            }}
            aria-label="สลับลำดับการ์ด"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <ProgressBar value={doneUnique / total} className="mb-1" label="ความคืบหน้าการทบทวน" />
      <div className="mb-4 text-right text-xs text-muted">
        เหลือ {queue.length} ใบ · {current.srs.phase === 'new' ? 'การ์ดใหม่' : current.srs.phase === 'review' ? `ช่วงทบทวน ${current.srs.interval} วัน` : 'กำลังจำ'}
      </div>

      <div className="flip">
        <div className={cn('flip-inner relative min-h-[300px]', flipped && 'flipped')}>
          <button className="flip-face card absolute inset-0 grid w-full place-items-center p-6" onClick={() => setFlipped(true)} aria-label="พลิกการ์ด" aria-hidden={flipped}>
            {front}
            <span className="absolute bottom-3 left-0 right-0 text-center text-xs text-muted">แตะหรือกด Space เพื่อพลิก</span>
          </button>
          <div className="flip-face flip-back card absolute inset-0 overflow-y-auto p-6" aria-hidden={!flipped}>
            <div className="flex items-start justify-between gap-2">
              <KoreanText text={current.front} size="lg" />
              <button className="btn-ghost p-1.5" onClick={() => setFlipped(false)} aria-label="พลิกกลับ">
                <RotateCw className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 whitespace-pre-line text-lg font-medium">{current.back}</div>
            {current.example && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                <div lang="ko" className="ko flex items-center gap-2">
                  {current.example} <SpeakButton text={current.example} size="sm" />
                </div>
                {current.exampleTh && <div className="text-muted">{current.exampleTh}</div>}
              </div>
            )}
            {current.note && <div className="mt-3 text-sm text-muted">{current.note}</div>}
          </div>
        </div>
      </div>

      <div className={cn('mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4', !flipped && 'pointer-events-none opacity-40')} aria-hidden={!flipped}>
        {GRADES.map((g) => (
          <button key={g.g} className={cn('btn border bg-surface flex-col gap-0 py-2', g.cls)} onClick={() => answer(g.g)} disabled={!flipped}>
            <span>{g.label}</span>
            <span className="text-[11px] font-normal opacity-80">
              {preview[g.g]} · กด {g.key}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">"ยังจำไม่ได้" = Need Review (กลับมาในรอบนี้) · "ง่ายมาก" = Mark Known (เว้นระยะนานขึ้น)</p>
    </div>
  );
}
