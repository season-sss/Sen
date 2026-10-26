import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { McqQuestion, OrderQuestion, TextQuestion } from '@/lib/quiz/types';
import type { MatchBoard } from '@/lib/games';
import { grade } from '@/lib/quiz/grading';
import { SpeakButton } from '@/components/ui/Korean';
import { speak } from '@/lib/tts';
import { shuffle } from '@/lib/util/random';

type Answerable = McqQuestion | TextQuestion | OrderQuestion;

/** Fast answer UI for games. Calls onAnswer once with the raw answer and local correctness. */
export function GameQuestionView({ q, onAnswer, disabled, reveal }: { q: Answerable; onAnswer: (given: number | string | string[], correct: boolean) => void; disabled?: boolean; reveal?: number | string | string[] | null }) {
  const [text, setText] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bank = useMemo(() => (q.kind === 'order' ? shuffle(q.tokens.map((t, i) => ({ t, i }))) : []), [q]);

  useEffect(() => {
    setText('');
    setOrder([]);
    if (q.kind === 'text') inputRef.current?.focus();
    if (q.audio) speak(q.audio);
  }, [q]);

  const submit = (given: number | string | string[]) => {
    if (disabled) return;
    onAnswer(given, grade(q, given).correct);
  };

  const isKo = /[가-힣]/.test(q.prompt) && !/[฀-๿]/.test(q.prompt);
  return (
    <div>
      {q.promptTh && <div className="mb-1 text-center text-sm text-muted">{q.promptTh}</div>}
      {q.audio && (
        <div className="mb-3 flex justify-center">
          <SpeakButton text={q.audio} size="lg" label="ฟังอีกครั้ง" />
        </div>
      )}
      <div className={cn('mb-5 text-center font-bold', isKo ? 'ko text-3xl' : 'text-xl')} lang={isKo ? 'ko' : undefined}>
        {q.audio ? 'ฟังแล้วตอบ' : q.prompt}
      </div>
      {q.kind === 'mcq' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o, i) => {
            const show = reveal !== undefined && reveal !== null;
            return (
              <button
                key={i}
                disabled={disabled}
                onClick={() => submit(i)}
                lang={/[가-힣]/.test(o) ? 'ko' : undefined}
                className={cn(
                  'min-h-[56px] rounded-xl border-2 px-4 py-3 text-left font-medium transition active:scale-[0.98]',
                  !show && 'border-border bg-surface hover:border-lavender',
                  show && i === q.answer && 'border-success bg-success/10',
                  show && reveal === i && i !== q.answer && 'border-danger bg-danger/10',
                  show && i !== q.answer && reveal !== i && 'border-border opacity-60',
                )}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
      {q.kind === 'text' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) submit(text);
          }}
          className="flex gap-2"
        >
          <input ref={inputRef} lang="ko" className="input ko text-lg" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} placeholder="พิมพ์คำตอบ" aria-label="คำตอบ" autoComplete="off" />
          <button className="btn-primary" disabled={disabled || !text.trim()}>
            ส่ง
          </button>
        </form>
      )}
      {q.kind === 'order' && (
        <div>
          <div className="mb-3 flex min-h-[52px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-border p-2">
            {order.map((bi, k) => (
              <button key={k} disabled={disabled} lang="ko" className="ko rounded-lg bg-lavender px-3 py-2 text-white" onClick={() => setOrder(order.filter((_, j) => j !== k))}>
                {bank[bi].t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {bank.map((b, bi) => (
              <button key={bi} disabled={disabled || order.includes(bi)} lang="ko" className={cn('ko rounded-lg border border-border bg-surface px-3 py-2', order.includes(bi) && 'opacity-30')} onClick={() => setOrder([...order, bi])}>
                {b.t}
              </button>
            ))}
          </div>
          <button className="btn-primary mt-3 w-full" disabled={disabled || order.length !== q.tokens.length} onClick={() => submit(order.map((bi) => bank[bi].t))}>
            ส่งคำตอบ
          </button>
        </div>
      )}
    </div>
  );
}

/** Word matching board: tap a Korean word, then its meaning. */
export function MatchBoardView({ board, onDone }: { board: MatchBoard; onDone: (correctPairs: number, mistakes: number) => void }) {
  const left = useMemo(() => shuffle(board.pairs), [board]);
  const right = useMemo(() => shuffle(board.pairs), [board]);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    setMatched([]);
    setSel(null);
    setMistakes(0);
  }, [board]);

  useEffect(() => {
    if (matched.length === board.pairs.length) onDone(matched.length, mistakes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const pickRight = (id: string) => {
    if (!sel) return;
    if (sel === id) {
      setMatched([...matched, id]);
      setSel(null);
    } else {
      setWrong(id);
      setMistakes(mistakes + 1);
      setTimeout(() => setWrong(null), 400);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        {left.map((p) => (
          <button
            key={p.id}
            disabled={matched.includes(p.id)}
            lang="ko"
            onClick={() => setSel(p.id)}
            className={cn('ko w-full rounded-xl border-2 px-3 py-3 text-lg font-semibold transition', matched.includes(p.id) ? 'border-success/40 bg-success/10 opacity-50' : sel === p.id ? 'border-lavender bg-lavender-soft' : 'border-border bg-surface')}
          >
            {p.ko}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {right.map((p) => (
          <button
            key={p.id}
            disabled={matched.includes(p.id)}
            onClick={() => pickRight(p.id)}
            className={cn('w-full rounded-xl border-2 px-3 py-3 text-sm font-medium transition', matched.includes(p.id) ? 'border-success/40 bg-success/10 opacity-50' : wrong === p.id ? 'animate-pop border-danger bg-danger/10' : 'border-border bg-surface')}
          >
            {p.th}
          </button>
        ))}
      </div>
    </div>
  );
}
