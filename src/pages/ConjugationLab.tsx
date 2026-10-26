import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, FlaskConical, Info, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { Tabs, Segmented } from '@/components/ui/Tabs';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { KoreanText, SpeakButton } from '@/components/ui/Korean';
import { ErrorState, Notice } from '@/components/ui/States';
import { QuizRunner } from '@/components/learn/QuizRunner';
import { conjugate, conjugateNoun, GROUP_LABEL, IRREGULAR_INFO, type ConjugationResult, type FormGroup, type PartOfSpeech } from '@/lib/conjugation';
import { uniquePredicates, VOCABULARY } from '@/data/vocabulary';
import { conjugationQuestions } from '@/lib/quiz/generators';
import { createRng, randomSeed } from '@/lib/util/random';
import { cn } from '@/lib/cn';

const EXAMPLES = ['가다', '먹다', '하다', '듣다', '걷다', '돕다', '모르다', '춥다', '예쁘다', '만들다', '짓다', '빨갛다', '쓰다', '살다'];

function FormRow({ f, highlight }: { f: ConjugationResult['forms'][number]; highlight: boolean }) {
  const [open, setOpen] = useState(highlight);
  return (
    <li className={cn('rounded-xl border p-3', highlight ? 'border-lavender bg-lavender-soft/50' : 'border-border')}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span lang="ko" className="ko text-sm font-semibold text-muted">
              {f.pattern}
            </span>
            <LevelBadge level={f.level === 'ADV' ? 'ADV' : f.level} />
          </div>
          <div className="text-xs text-muted">{f.th}</div>
        </div>
        {f.value ? (
          <div className="flex items-center gap-2">
            <span lang="ko" className="ko text-lg font-bold text-navy">
              {f.value}
            </span>
            <SpeakButton text={f.value} size="sm" />
          </div>
        ) : (
          <span className="text-xs text-muted">{f.note}</span>
        )}
        {f.steps.length > 0 && (
          <button className="btn-ghost -mr-2 p-1.5" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="ดูขั้นตอนการผัน">
            <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {f.value && f.note && <div className="mt-1 text-xs text-warning">{f.note}</div>}
      {open && f.steps.length > 0 && (
        <ol className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted">
          {f.steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-lavender">{i + 1}.</span>
              <span lang="ko">{s}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

export default function ConjugationLab() {
  const [params, setParams] = useSearchParams();
  const word = params.get('word') ?? '먹다';
  const highlight = params.get('form');
  const [input, setInput] = useState(word);
  const [manualPos, setManualPos] = useState<PartOfSpeech>('verb');
  const [tab, setTab] = useState<'table' | 'practice' | 'noun'>('table');
  const [noun, setNoun] = useState('학생');
  const [seed, setSeed] = useState(randomSeed);
  const [group, setGroup] = useState<FormGroup | 'all'>('all');

  const lexicon = useMemo(() => new Map(uniquePredicates().map((v) => [v.ko, v])), []);
  const entry = lexicon.get(word);
  const pos: PartOfSpeech = entry ? (entry.pos === 'adjective' ? 'adjective' : 'verb') : manualPos;

  const result = useMemo(() => {
    try {
      return { ok: true as const, r: conjugate(word, { pos, irregular: entry?.irr }) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [word, pos, entry]);

  const suggestions = useMemo(() => {
    const q = input.trim();
    if (!q || q === word) return [];
    return uniquePredicates()
      .filter((v) => v.ko.startsWith(q.replace(/다$/, '')) || v.th.includes(q))
      .slice(0, 8);
  }, [input, word]);

  const examples = VOCABULARY.filter((v) => v.ko === word);
  const practiceQs = useMemo(
    () => (result.ok ? conjugationQuestions([{ ko: word, pos, irr: entry?.irr, th: entry?.th }], result.r.forms.filter((f) => f.value && f.level !== 'B2').map((f) => f.key), createRng(seed), 8) : []),
    [result, word, pos, entry, seed],
  );

  const submit = (w: string) => {
    const v = w.trim();
    if (!v) return;
    setInput(v);
    setParams({ word: v.endsWith('다') ? v : `${v}다` });
  };

  const groups = result.ok ? ([...new Set(result.r.forms.map((f) => f.group))] as FormGroup[]) : [];

  return (
    <div>
      <PageHeader title="Conjugation Lab" subtitle="ผันคำกริยาและคำคุณศัพท์ด้วย Rule Engine จริง — แยกกฎตามชนิดคำและกลุ่มผันไม่ปกติ พร้อมแสดงขั้นตอน" />

      <div className="card mb-4 p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <div className="relative flex-1">
            <input className="input ko text-lg" lang="ko" value={input} onChange={(e) => setInput(e.target.value)} placeholder="พิมพ์รูปพจนานุกรม เช่น 듣다" aria-label="คำที่ต้องการผัน" />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lift">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2" onClick={() => submit(s.ko)}>
                      <span lang="ko" className="ko font-semibold">
                        {s.ko}
                      </span>
                      <span className="text-muted">{s.th}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn-primary">
            <FlaskConical className="h-4 w-4" /> ผันคำ
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((w) => (
            <button key={w} className={cn('chip ko', w === word && 'chip-active')} onClick={() => submit(w)} lang="ko">
              {w}
            </button>
          ))}
        </div>
        {!entry && result.ok && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">คำนี้ไม่อยู่ในคลังคำศัพท์ — เลือกประเภทคำ:</span>
            <Segmented<PartOfSpeech>
              value={manualPos}
              onChange={setManualPos}
              options={[
                { id: 'verb', label: '동사 คำกริยา' },
                { id: 'adjective', label: '형용사 คำคุณศัพท์' },
              ]}
            />
          </div>
        )}
      </div>

      {!result.ok ? (
        <ErrorState title="ผันคำนี้ไม่ได้" message={result.error} />
      ) : (
        <>
          <div className="card card-pad mb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex-1">
                <KoreanText text={result.r.dictionaryForm} size="xl" />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="lavender">{pos === 'verb' ? '동사 · คำกริยา' : '형용사 · คำคุณศัพท์'}</Badge>
                  {entry && <span className="font-medium">{entry.th}</span>}
                  {entry && <LevelBadge level={entry.level} />}
                </div>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">รากคำ (어간)</dt>
                  <dd lang="ko" className="ko text-lg font-bold">
                    {result.r.stem}-
                  </dd>
                </div>
                <div className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">กลุ่มการผัน</dt>
                  <dd lang="ko" className="ko font-bold">
                    {result.r.irregularLabel}
                  </dd>
                </div>
                <div className="col-span-2 rounded-xl bg-surface-2 p-3">
                  <dt className="text-xs text-muted">กฎที่ใช้</dt>
                  <dd>
                    {result.r.irregularRule} <span className="text-muted">— {IRREGULAR_INFO[result.r.irregular].example}</span>
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-4 space-y-2">
              <div className={cn('flex items-start gap-2 text-sm', result.r.confidence === 'verified' ? 'text-success' : 'text-warning')}>
                {result.r.confidence === 'verified' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                {result.r.confidence === 'verified'
                  ? 'กลุ่มการผันของคำนี้ตรวจสอบแล้วในรายการของระบบ'
                  : result.r.confidence === 'inferred'
                    ? 'ระบบอนุมานกลุ่มการผันจากรูปคำ — ควรตรวจสอบกับพจนานุกรม'
                    : 'ระบบไม่แน่ใจกลุ่มการผันของคำนี้ — ผลลัพธ์อาจไม่ถูกต้อง โปรดตรวจสอบ'}
              </div>
              {result.r.warnings.map((w, i) => (
                <Notice key={i} tone="warning">
                  {w}
                </Notice>
              ))}
              {result.r.notes.map((n, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" /> {n}
                </div>
              ))}
            </div>
            {examples.length > 0 && (
              <div className="mt-4 space-y-2">
                {examples.map((e) => (
                  <div key={e.id} className="rounded-xl border border-border p-3 text-sm">
                    <div lang="ko" className="ko flex items-center gap-2">
                      {e.ex} <SpeakButton text={e.ex} size="sm" />
                    </div>
                    <div className="text-muted">{e.exTh}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'table', label: 'ตารางการผัน' },
              { id: 'practice', label: 'ลองผันเอง' },
              { id: 'noun', label: 'รูปผันกับคำนาม (이다)' },
            ]}
          />

          {tab === 'table' && (
            <>
              <div className="scrollbar-none mb-3 flex gap-1.5 overflow-x-auto pb-1">
                <button className={cn('chip whitespace-nowrap', group === 'all' && 'chip-active')} onClick={() => setGroup('all')}>
                  ทั้งหมด
                </button>
                {groups.map((g) => (
                  <button key={g} className={cn('chip whitespace-nowrap', group === g && 'chip-active')} onClick={() => setGroup(g)}>
                    {GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
              <div className="space-y-5">
                {groups
                  .filter((g) => group === 'all' || g === group)
                  .map((g) => (
                    <section key={g}>
                      <h3 className="mb-2 text-sm font-semibold text-muted">{GROUP_LABEL[g]}</h3>
                      <ul className="grid gap-2 lg:grid-cols-2">
                        {result.r.forms
                          .filter((f) => f.group === g)
                          .map((f) => (
                            <FormRow key={f.key} f={f} highlight={f.key === highlight} />
                          ))}
                      </ul>
                    </section>
                  ))}
              </div>
              <p className="mt-4 text-xs text-muted">
                แตะ ⌄ เพื่อดูขั้นตอนการผันแต่ละรูป รูปที่แสดง "—" คือรูปที่ใช้กับชนิดคำนี้ไม่ได้ (เช่น คำคุณศัพท์ + -고 싶다) — ระบบไม่สร้างรูปที่ผิดหลักภาษา
              </p>
            </>
          )}

          {tab === 'practice' && (
            <div>
              <Notice className="mb-4">
                <Sparkles className="mr-1 inline h-4 w-4" />
                พิมพ์รูปผันของ <b lang="ko">{word}</b> แล้วระบบตรวจกับ Conjugation Engine
              </Notice>
              <QuizRunner key={`${word}-${seed}`} questions={practiceQs} title={`ฝึกผัน ${word}`} source={`conjugation:${word}`} onExit={() => setSeed(randomSeed())} />
            </div>
          )}

          {tab === 'noun' && (
            <div className="card card-pad">
              <label className="label" htmlFor="noun-input">
                คำนาม
              </label>
              <input id="noun-input" className="input ko mb-4 text-lg" lang="ko" value={noun} onChange={(e) => setNoun(e.target.value.trim())} />
              {/^[가-힣]+$/.test(noun) ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {conjugateNoun(noun).map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                      <div>
                        <div lang="ko" className="ko text-sm font-semibold text-muted">
                          N + {f.pattern}
                        </div>
                        <div className="text-xs text-muted">{f.th}</div>
                      </div>
                      <span lang="ko" className="ko text-lg font-bold text-navy">
                        {f.value}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">พิมพ์คำนามภาษาเกาหลี (ฮันกึลเท่านั้น)</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
