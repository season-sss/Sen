import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, FileAudio, Flag, Trash2, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RealExam, RealExamGroup, RealExamQuestion } from '@/data/topik/real/types';
import { assetUrl, CIRCLED, driveEmbedUrl, driveViewUrl } from '@/lib/topik/real';
import { blobStore } from '@/lib/blobStore';
import { Notice } from '@/components/ui/States';
import { Segmented } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';

// ------------------------------------------------------------------ audio

/**
 * Listening audio. The owner's Google Drive file plays in Drive's own embedded player (we cannot
 * seek it from the page). A learner can also pick the same file from their device: it is kept in
 * this browser (IndexedDB) and plays in a normal <audio> element with seeking.
 */
export function ExamAudio({ exam }: { exam: RealExam }) {
  const key = `audio:${exam.id}`;
  const [src, setSrc] = useState<'drive' | 'local'>(exam.audio.src ? 'local' : 'drive');
  const [local, setLocal] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let url: string | null = null;
    void blobStore.get(key).then((f) => {
      if (!f) return;
      url = URL.createObjectURL(f.blob);
      setLocal({ url, name: f.name });
      setSrc('local');
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  const hosted = exam.audio.src ? assetUrl(exam.audio.src) : null;
  const driveId = exam.audio.driveFileId;

  return (
    <div className="card card-pad">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileAudio className="h-4 w-4 text-sky" /> ไฟล์เสียงการฟัง (듣기)
        </div>
        <Segmented<'drive' | 'local'>
          value={src}
          onChange={setSrc}
          options={[
            { id: 'drive', label: hosted ? 'ไฟล์ของเว็บ' : 'Google Drive' },
            { id: 'local', label: 'ไฟล์จากเครื่อง' },
          ]}
        />
      </div>

      {src === 'drive' &&
        (hosted ? (
          <audio controls preload="metadata" src={hosted} className="w-full" />
        ) : driveId ? (
          <>
            <iframe title="ไฟล์เสียงข้อสอบการฟังจาก Google Drive" src={driveEmbedUrl(driveId)} className="h-[92px] w-full rounded-xl border border-border bg-surface-2" allow="autoplay" />
            <p className="mt-2 text-xs text-muted">
              เล่นผ่านเครื่องเล่นของ Google Drive ·{' '}
              <a className="inline-flex items-center gap-1 text-lavender hover:underline" href={driveViewUrl(driveId)} target="_blank" rel="noreferrer">
                เปิดใน Google Drive <ExternalLink className="h-3 w-3" />
              </a>{' '}
              · ถ้าเล่นไม่ได้ ไฟล์ต้องแชร์แบบ “ทุกคนที่มีลิงก์” หรือดาวน์โหลดแล้วเลือก “ไฟล์จากเครื่อง”
            </p>
          </>
        ) : (
          <Notice tone="warning">ข้อสอบนี้ยังไม่มีไฟล์เสียง — เลือกไฟล์จากเครื่องแทน</Notice>
        ))}

      {src === 'local' && (
        <div>
          {local ? (
            <>
              <audio controls preload="metadata" src={local.url} className="w-full" />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="truncate">{local.name} · เก็บไว้ในเบราว์เซอร์นี้ ไม่ได้อัปโหลดไปที่ใด</span>
                <button
                  className="btn-ghost btn-sm text-danger"
                  onClick={async () => {
                    await blobStore.remove(key);
                    URL.revokeObjectURL(local.url);
                    setLocal(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> ลบไฟล์
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm">
              <p className="text-muted">ดาวน์โหลดไฟล์เสียงจาก Google Drive แล้วเลือกที่นี่ เพื่อเล่น/เลื่อนเวลาได้สะดวกและฟังแบบออฟไลน์</p>
              <button className="btn-secondary btn-sm mt-3" onClick={() => fileRef.current?.click()}>
                เลือกไฟล์เสียง (mp3 / m4a / wav)
              </button>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!f.type.startsWith('audio/')) {
                toast.error('ไฟล์นี้ไม่ใช่ไฟล์เสียง');
                return;
              }
              const url = URL.createObjectURL(f);
              if (local) URL.revokeObjectURL(local.url);
              setLocal({ url, name: f.name });
              const saved = await blobStore.put(key, f);
              if (saved === null) toast.info('เล่นได้ แต่บันทึกไฟล์ไว้ในเบราว์เซอร์ไม่สำเร็จ (ต้องเลือกใหม่เมื่อเปิดหน้าอีกครั้ง)');
            }}
          />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ question

function ExamImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return <img src={assetUrl(src)} alt={alt} loading="lazy" decoding="async" className={cn('w-full rounded-xl border border-border bg-white object-contain', className)} />;
}

export function GroupHeader({ group, showExample = true }: { group: RealExamGroup; showExample?: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-semibold leading-relaxed" lang="ko">
          ※ [{group.from}~{group.to}] {group.instruction}
        </p>
        <p className="text-xs text-muted">{group.instructionTh}</p>
      </div>
      {showExample && group.example && (
        <details className="rounded-xl border border-border bg-surface-2/60 px-4 py-2 text-sm">
          <summary className="cursor-pointer select-none font-medium text-muted">ดู &lt;보기&gt; (ตัวอย่าง)</summary>
          <div className="mt-2 space-y-1" lang="ko">
            {group.example.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
            <div className="grid gap-1 pt-1 sm:grid-cols-2">
              {group.example.options.map((o, i) => (
                <span key={o} className={i === group.example!.answer ? 'font-semibold text-success' : ''}>
                  {i === group.example!.answer ? '❶❷❸❹'[i] : CIRCLED[i]} {o}
                </span>
              ))}
            </div>
          </div>
        </details>
      )}
      {group.passage && (
        <div className="whitespace-pre-line rounded-xl border border-border bg-surface px-4 py-3 leading-8" lang="ko">
          {group.passage}
        </div>
      )}
      {group.image && <ExamImage src={group.image.src} alt={group.image.alt} className="max-h-[420px]" />}
    </div>
  );
}

export function RealQuestionView({
  q,
  group,
  selected,
  reveal,
  flagged,
  onSelect,
  onFlag,
  showGroup,
}: {
  q: RealExamQuestion;
  group: RealExamGroup;
  selected: number | undefined;
  /** Show the official answer, translations and explanation */
  reveal: boolean;
  flagged?: boolean;
  onSelect?: (i: number) => void;
  onFlag?: () => void;
  showGroup: boolean;
}) {
  const locked = reveal || !onSelect;
  return (
    <div className="space-y-4">
      {showGroup && <GroupHeader group={group} />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" lang="ko">
          <span className="mr-2 text-lg font-bold text-navy">{q.no}.</span>
          {q.prompt && <span className="leading-relaxed">{q.prompt}</span>}
          <span className="ml-1 text-sm text-muted">({q.points}점)</span>
        </div>
        {onFlag && (
          <button className={cn('btn-ghost btn-sm shrink-0', flagged && 'text-warning')} onClick={onFlag} aria-pressed={flagged} title="ทำเครื่องหมายไว้กลับมาดู">
            <Flag className={cn('h-4 w-4', flagged && 'fill-current')} /> {flagged ? 'ทำเครื่องหมายแล้ว' : 'กลับมาดู'}
          </button>
        )}
      </div>

      {q.stimulus && (
        <div className="whitespace-pre-line rounded-xl border border-border bg-surface px-4 py-3 leading-8" lang="ko">
          {q.stimulus}
        </div>
      )}
      {q.image && <ExamImage src={q.image.src} alt={q.image.alt} className="mx-auto max-h-[380px] sm:w-auto" />}

      {q.optionImages ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {q.optionImages.map((img, i) => (
            <OptionButton key={i} i={i} q={q} selected={selected} reveal={reveal} locked={locked} onSelect={onSelect}>
              <ExamImage src={img.src} alt={img.alt} className="border-0" />
            </OptionButton>
          ))}
        </div>
      ) : (
        <div className={cn('grid gap-2', q.options.every((o) => o.length <= 8) ? 'grid-cols-2 sm:grid-cols-4' : q.options.every((o) => o.length <= 22) ? 'sm:grid-cols-2' : '')}>
          {q.options.map((o, i) => (
            <OptionButton key={i} i={i} q={q} selected={selected} reveal={reveal} locked={locked} onSelect={onSelect}>
              <span lang="ko">{o}</span>
              {reveal && <span className="mt-0.5 block text-xs font-normal text-muted">{q.optionsTh[i]}</span>}
            </OptionButton>
          ))}
        </div>
      )}

      {reveal && (
        <div className={cn('rounded-xl border px-4 py-3 text-sm', selected === q.answer ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10')}>
          <div className="mb-1 flex items-center gap-2 font-semibold">
            {selected === q.answer ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-danger" />}
            {selected === undefined ? 'ไม่ได้ตอบ' : selected === q.answer ? 'ถูกต้อง' : `ตอบ ${CIRCLED[selected]} · ไม่ถูก`} — เฉลย {CIRCLED[q.answer]} ({q.points} คะแนน)
          </div>
          <p className="leading-relaxed">{q.explainTh}</p>
        </div>
      )}
    </div>
  );
}

function OptionButton({
  i,
  q,
  selected,
  reveal,
  locked,
  onSelect,
  children,
}: {
  i: number;
  q: RealExamQuestion;
  selected: number | undefined;
  reveal: boolean;
  locked: boolean;
  onSelect?: (i: number) => void;
  children: React.ReactNode;
}) {
  const isSel = selected === i;
  const isAns = reveal && q.answer === i;
  const isWrong = reveal && isSel && q.answer !== i;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onSelect?.(i)}
      aria-pressed={isSel}
      className={cn(
        'flex w-full items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-[15px] font-medium transition disabled:cursor-default',
        isAns ? 'border-success bg-success/10' : isWrong ? 'border-danger bg-danger/10' : isSel ? 'border-lavender bg-lavender-soft' : 'border-border bg-surface hover:bg-surface-2',
      )}
    >
      <span className={cn('mt-px shrink-0 font-bold', isAns ? 'text-success' : isWrong ? 'text-danger' : isSel ? 'text-lavender' : 'text-muted')}>{CIRCLED[i]}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

// ------------------------------------------------------------------ answer sheet

export function AnswerSheet({
  questions,
  answers,
  flags,
  current,
  reveal,
  onJump,
}: {
  questions: RealExamQuestion[];
  answers: Record<number, number>;
  flags: number[];
  current: number;
  reveal: boolean;
  onJump: (index: number) => void;
}) {
  const flagSet = new Set(flags);
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const a = answers[q.no];
          const state = reveal ? (a === q.answer ? 'right' : 'wrong') : a !== undefined ? 'done' : 'todo';
          return (
            <button
              key={q.no}
              onClick={() => onJump(i)}
              aria-label={`ข้อ ${q.no}${a !== undefined ? ` ตอบ ${CIRCLED[a]}` : ' ยังไม่ตอบ'}${flagSet.has(q.no) ? ' ทำเครื่องหมายไว้' : ''}`}
              aria-current={i === current}
              className={cn(
                'relative rounded-lg border py-1.5 text-xs font-semibold tabular-nums transition',
                state === 'right' && 'border-success/40 bg-success/15 text-success',
                state === 'wrong' && 'border-danger/40 bg-danger/10 text-danger',
                state === 'done' && 'border-lavender/40 bg-lavender-soft text-lavender',
                state === 'todo' && 'border-border bg-surface text-muted',
                i === current && 'ring-2 ring-navy ring-offset-1 ring-offset-surface dark:ring-lavender',
              )}
            >
              {q.no}
              {a !== undefined && <span className="block text-[10px] font-normal">{CIRCLED[a]}</span>}
              {flagSet.has(q.no) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {reveal ? (
          <>
            <span className="inline-flex items-center gap-1">
              <i className="h-2.5 w-2.5 rounded bg-success/40" /> ถูก
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2.5 w-2.5 rounded bg-danger/40" /> ผิด/ไม่ได้ตอบ
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <i className="h-2.5 w-2.5 rounded bg-lavender/50" /> ตอบแล้ว
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2.5 w-2.5 rounded-full bg-warning" /> กลับมาดู
            </span>
          </>
        )}
      </div>
    </div>
  );
}
