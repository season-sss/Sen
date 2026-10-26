import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Copy, Star, Trash2, Layers, NotebookPen, ShieldCheck, AlertTriangle, Info, ArrowLeftRight, History, Cloud, FlaskConical, Plus } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { KoreanText, SpeakButton } from '@/components/ui/Korean';
import { Badge, LevelBadge } from '@/components/ui/Badge';
import { EmptyState, Notice } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/Progress';
import { toast } from '@/components/ui/Toast';
import { DeckPicker } from '@/components/learn/DeckPicker';
import { analyzeKorean, isRemoteAvailable, lookupThai, translateRemote, type Analysis, type TokenAnalysis } from '@/lib/translator';
import { POS_INFO } from '@/data/types';
import { VOCAB_BY_ID } from '@/data/vocabulary';
import { useTranslatorHistory } from '@/store/history';
import { useFlashcards } from '@/store/flashcards';
import { useNotes } from '@/store/notes';
import { isHangulText } from '@/lib/hangul';
import { cn } from '@/lib/cn';

type Dir = 'ko-th' | 'th-ko';

const CONF = {
  high: { label: 'ความมั่นใจสูง', tone: 'success' as const, icon: ShieldCheck },
  medium: { label: 'ความมั่นใจปานกลาง', tone: 'sky' as const, icon: Info },
  low: { label: 'ความมั่นใจต่ำ', tone: 'warning' as const, icon: AlertTriangle },
};

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success('คัดลอกแล้ว'),
    () => toast.error('คัดลอกไม่สำเร็จ'),
  );
}

function TokenCard({ t, onAddCard }: { t: TokenAnalysis; onAddCard: (t: TokenAnalysis) => void }) {
  const addToVocabList = useNotes((s) => s.addToVocabList);
  if (t.kind === 'other') return null;
  const v = t.vocabId ? VOCAB_BY_ID[t.vocabId] : undefined;
  return (
    <div className={cn('rounded-xl border p-3', t.kind === 'unknown' ? 'border-warning/40 bg-warning/5' : 'border-border bg-surface')}>
      <div className="flex items-start justify-between gap-2">
        <KoreanText text={t.surface.replace(/[.,!?]/g, '')} size="lg" />
        <Badge tone={CONF[t.confidence].tone}>{CONF[t.confidence].label}</Badge>
      </div>
      {t.kind === 'unknown' ? (
        <p className="mt-2 text-sm text-muted">{t.note}</p>
      ) : (
        <div className="mt-2 space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{t.meaning}</span>
            {t.pos && t.pos !== 'particle' && <Badge>{POS_INFO[t.pos].th} · {POS_INFO[t.pos].ko}</Badge>}
            {v && <LevelBadge level={v.level} />}
          </div>
          {t.lemma && t.lemma !== t.surface.replace(/[.,!?]/g, '') && (
            <div className="text-muted">
              รูปพจนานุกรม: <span lang="ko" className="ko font-semibold text-ink">{t.lemma}</span>
            </div>
          )}
          {t.particles?.map((p) => (
            <div key={p.form} className="text-muted">
              คำช่วย <span lang="ko" className="ko font-semibold text-lavender">-{p.form}</span>: {p.function}
            </div>
          ))}
          {t.ending && (
            <div className="text-muted">
              รูปผัน <span lang="ko" className="ko font-semibold text-sky">{t.ending.pattern}</span>: {t.ending.th}
            </div>
          )}
          {t.note && <div className="text-xs text-warning">{t.note}</div>}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {t.lemma && (t.pos === 'verb' || t.pos === 'adjective') && (
              <Link to={`/conjugation?word=${encodeURIComponent(t.lemma)}${t.ending ? `&form=${t.ending.formKey}` : ''}`} className="chip">
                <FlaskConical className="h-3 w-3" /> ดูการผัน
              </Link>
            )}
            <button className="chip" onClick={() => onAddCard(t)}>
              <Layers className="h-3 w-3" /> Flashcard
            </button>
            {t.lemma && t.meaning && (
              <button
                className="chip"
                onClick={() => {
                  addToVocabList({ ko: t.lemma!, th: t.meaning! });
                  toast.success(`บันทึก ${t.lemma} ลง Notes แล้ว`);
                }}
              >
                <Plus className="h-3 w-3" /> รายการคำศัพท์
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Translator() {
  const [params, setParams] = useSearchParams();
  const [dir, setDir] = useState<Dir>(params.get('dir') === 'th-ko' ? 'th-ko' : 'ko-th');
  const [text, setText] = useState(params.get('text') ?? '');
  const [submitted, setSubmitted] = useState(params.get('text') ?? '');
  const [picker, setPicker] = useState<{ front: string; back: string; example?: string; exampleTh?: string } | null>(null);
  const [remote, setRemote] = useState<{ text: string; provider: string } | null>(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const { history, add, toggleFavorite, remove, clearHistory } = useTranslatorHistory();
  const addCard = useFlashcards((s) => s.addCard);
  const createNote = useNotes((s) => s.createNote);

  const analysis: Analysis | null = useMemo(() => (dir === 'ko-th' && submitted.trim() && isHangulText(submitted) ? analyzeKorean(submitted) : null), [dir, submitted]);
  const thai = useMemo(() => (dir === 'th-ko' && submitted.trim() ? lookupThai(submitted) : null), [dir, submitted]);

  useEffect(() => {
    if (!submitted.trim()) return;
    const summary = analysis ? analysis.sentenceMatch?.th ?? analysis.gloss : thai ? thai.sentences[0]?.ko ?? thai.words.map((w) => w.ko).slice(0, 3).join(', ') : '';
    add({ text: submitted.trim(), dir, summary: summary.slice(0, 160) });
    setRemote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, dir]);

  const run = (t = text) => {
    setSubmitted(t);
    setParams(t ? { text: t, dir } : {});
  };
  const current = history.find((h) => h.text === submitted.trim() && h.dir === dir);

  return (
    <div>
      <PageHeader
        title="แปลและช่วยอ่าน"
        subtitle="Reading Assistant แยกคำ คำช่วย และรูปผัน จากคลังข้อมูลที่ตรวจสอบแล้วของ HANEUL — แสดงระดับความมั่นใจทุกครั้ง"
      />
      <Notice className="mb-4" tone="info">
        เครื่องมือนี้ <b>ไม่ใช่ AI และไม่ได้แปลได้ทุกประโยค</b> — แปลทั้งประโยคได้เฉพาะประโยคที่อยู่ในคลังประโยคที่ตรวจสอบแล้ว (ประโยคตัวอย่าง บทสนทนา ไวยากรณ์) ประโยคอื่นจะแสดงความหมายแยกคำพร้อมคำเตือน
        {isRemoteAvailable() ? ' · เปิดใช้การแปลผ่าน Translation backend แล้ว' : ''}
      </Notice>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Tabs
                value={dir}
                onChange={(d) => {
                  setDir(d);
                  setSubmitted('');
                }}
                tabs={[
                  { id: 'ko-th', label: 'เกาหลี → ไทย' },
                  { id: 'th-ko', label: 'ไทย → เกาหลี' },
                ]}
              />
              <button className="btn-ghost btn-sm" onClick={() => setDir(dir === 'ko-th' ? 'th-ko' : 'ko-th')} aria-label="สลับทิศทาง">
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <textarea
                className={cn('input min-h-[110px] text-lg', dir === 'ko-th' && 'ko')}
                lang={dir === 'ko-th' ? 'ko' : 'th'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={dir === 'ko-th' ? '예: 친구가 도서관에서 책을 읽어요.' : 'เช่น ห้องน้ำอยู่ที่ไหน, แมว'}
                aria-label="ข้อความที่ต้องการแปล"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    run();
                  }
                }}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(dir === 'ko-th' ? ['저는 학생이에요.', '어제 친구를 만났어요', '한국어를 배우고 싶어요', '날씨가 추워서 집에 있었어요'] : ['ขอบคุณ', 'ห้องน้ำอยู่ที่ไหน', 'อร่อย', 'แพงเกินไป']).map((x) => (
                    <button
                      type="button"
                      key={x}
                      className="chip"
                      lang={dir === 'ko-th' ? 'ko' : undefined}
                      onClick={() => {
                        setText(x);
                        run(x);
                      }}
                    >
                      {x}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {text && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => copy(text)}>
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                  <button className="btn-primary" disabled={!text.trim()}>
                    {dir === 'ko-th' ? 'วิเคราะห์' : 'ค้นหา'}
                  </button>
                </div>
              </div>
            </form>
          </Card>

          {dir === 'ko-th' && submitted && !analysis && <Notice tone="warning">กรุณาพิมพ์ข้อความภาษาเกาหลี (ฮันกึล) — หรือสลับเป็น ไทย → เกาหลี</Notice>}

          {analysis && (
            <div className="space-y-4">
              <Card className="card-pad">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {(() => {
                    const C = CONF[analysis.confidence];
                    return (
                      <Badge tone={C.tone}>
                        <C.icon className="h-3 w-3" /> {C.label}
                      </Badge>
                    );
                  })()}
                  <span className="text-xs text-muted">รู้จักคำ {Math.round(analysis.coverage * 100)}%</span>
                  {current && (
                    <button className="btn-ghost btn-sm ml-auto" onClick={() => toggleFavorite(current.id)} aria-pressed={current.favorite}>
                      <Star className={cn('h-4 w-4', current.favorite && 'fill-warning text-warning')} /> Favorite
                    </button>
                  )}
                </div>
                <ProgressBar value={analysis.coverage} tone={analysis.coverage === 1 ? 'success' : 'warning'} className="mb-4" label="สัดส่วนคำที่รู้จัก" />
                <div className="flex items-start gap-2">
                  <KoreanText text={analysis.input} size="lg" speakable={false} />
                  <SpeakButton text={analysis.input} />
                </div>
                {analysis.sentenceMatch ? (
                  <div className="mt-4 rounded-xl bg-success/5 p-4">
                    <div className="text-xs font-semibold text-success">คำแปล (จากคลังประโยคที่ตรวจสอบแล้ว)</div>
                    <div className="mt-1 text-xl font-semibold">{analysis.sentenceMatch.th}</div>
                    <div className="mt-1 text-xs text-muted">แหล่งที่มา: {analysis.sentenceMatch.source}</div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-surface-2 p-4">
                    <div className="text-xs font-semibold text-muted">ความหมายแยกคำ (ไม่ใช่คำแปลทั้งประโยค)</div>
                    <div className="mt-1 text-[15px]">{analysis.gloss}</div>
                  </div>
                )}
                {analysis.warnings.map((w, i) => (
                  <div key={i} className="mt-2 flex items-start gap-2 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
                  </div>
                ))}
                {remote && (
                  <div className="mt-4 rounded-xl border border-sky/40 bg-sky-soft p-4">
                    <div className="text-xs font-semibold text-sky">คำแปลจาก Translation backend ({remote.provider}) — ตรวจสอบความถูกต้องเสมอ</div>
                    <div className="mt-1 text-lg">{remote.text}</div>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => copy(`${analysis.input}\n${analysis.sentenceMatch?.th ?? analysis.gloss}`)}>
                    <Copy className="h-4 w-4" /> คัดลอกผล
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setPicker({ front: analysis.input, back: analysis.sentenceMatch?.th ?? analysis.gloss, example: undefined })}
                  >
                    <Layers className="h-4 w-4" /> บันทึกเป็น Flashcard
                  </button>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      createNote({
                        title: analysis.input.slice(0, 60),
                        category: 'ประโยคตัวอย่าง',
                        tags: ['translator'],
                        body: [analysis.input, analysis.sentenceMatch ? `คำแปล: ${analysis.sentenceMatch.th}` : `ความหมายแยกคำ: ${analysis.gloss}`, '', ...analysis.tokens.filter((t) => t.kind !== 'other').map((t) => `• ${t.surface} → ${t.lemma ?? '?'} (${t.meaning ?? 'ไม่รู้จัก'})${t.ending ? ` [${t.ending.pattern}]` : ''}`)].join('\n'),
                        vocab: analysis.tokens.filter((t) => t.lemma && t.meaning).map((t) => ({ ko: t.lemma!, th: t.meaning! })),
                      });
                      toast.success('บันทึกลง Notes แล้ว');
                    }}
                  >
                    <NotebookPen className="h-4 w-4" /> บันทึกลง Notes
                  </button>
                  {isRemoteAvailable() && !analysis.sentenceMatch && (
                    <button
                      className="btn-secondary btn-sm"
                      disabled={remoteLoading}
                      onClick={async () => {
                        setRemoteLoading(true);
                        try {
                          const r = await translateRemote(analysis.input, 'ko-th');
                          setRemote({ text: r.translation, provider: r.provider });
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setRemoteLoading(false);
                        }
                      }}
                    >
                      <Cloud className="h-4 w-4" /> แปลทั้งประโยคผ่าน backend
                    </button>
                  )}
                </div>
              </Card>

              <div>
                <h2 className="mb-2 text-sm font-semibold text-muted">แยกคำและหน้าที่ของคำ</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {analysis.tokens.map((t, i) => (
                    <TokenCard
                      key={i}
                      t={t}
                      onAddCard={(tk) => setPicker({ front: tk.lemma ?? tk.surface, back: tk.meaning ?? '', example: analysis.input, exampleTh: analysis.sentenceMatch?.th })}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {thai && (
            <div className="space-y-4">
              {thai.sentences.length === 0 && thai.words.length === 0 ? (
                <EmptyState title="ไม่พบในคลังข้อมูล" message="ลองพิมพ์คำหรือประโยคที่สั้นลง หรือใช้คำที่พบบ่อย ระบบค้นหาจากประโยคตัวอย่างและคลังคำศัพท์ที่ตรวจสอบแล้วเท่านั้น" />
              ) : null}
              {thai.sentences.length > 0 && (
                <Card className="card-pad">
                  <CardHeader title="ประโยคที่ตรงกัน" subtitle="จากคลังประโยคที่ตรวจสอบแล้ว" />
                  <ul className="space-y-2">
                    {thai.sentences.map((s) => (
                      <li key={s.ko} className="rounded-xl border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <KoreanText text={s.ko} />
                          <Badge tone={s.exact ? 'success' : 'neutral'}>{s.exact ? 'ตรงทั้งประโยค' : 'บางส่วน'}</Badge>
                        </div>
                        <div className="mt-1 text-sm">{s.th}</div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted">
                          <span>{s.source}</span>
                          <span className="flex gap-1">
                            <button className="chip" onClick={() => copy(s.ko)}>
                              <Copy className="h-3 w-3" />
                            </button>
                            <button className="chip" onClick={() => setPicker({ front: s.ko, back: s.th })}>
                              <Layers className="h-3 w-3" />
                            </button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {thai.words.length > 0 && (
                <Card className="card-pad">
                  <CardHeader title="คำศัพท์ที่เกี่ยวข้อง" />
                  <div className="grid gap-2 sm:grid-cols-2">
                    {thai.words.map((w) => (
                      <div key={w.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                        <div>
                          <KoreanText text={w.ko} />
                          <div className="text-sm text-muted">{w.th}</div>
                        </div>
                        <button className="chip" onClick={() => setPicker({ front: w.ko, back: w.th, example: w.ex, exampleTh: w.exTh })} aria-label={`เพิ่ม ${w.ko} เป็น Flashcard`}>
                          <Layers className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {!submitted && (
            <EmptyState
              title="พิมพ์ประโยคเพื่อเริ่มวิเคราะห์"
              message="ระบบจะแยกคำ บอกคำช่วยและหน้าที่ รูปพจนานุกรมของคำกริยา รูปผัน romanization และคำอ่านไทย"
            />
          )}
        </div>

        <aside>
          <Card className="p-4">
            <CardHeader
              title="ประวัติการแปล"
              icon={<History className="h-5 w-5" />}
              action={
                history.some((h) => !h.favorite) ? (
                  <button className="btn-ghost btn-sm" onClick={clearHistory}>
                    ล้าง
                  </button>
                ) : undefined
              }
            />
            {history.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีประวัติ</p>
            ) : (
              <ul className="max-h-[520px] space-y-1.5 overflow-y-auto">
                {[...history].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.at - a.at).map((h) => (
                  <li key={h.id} className="group flex items-start gap-2 rounded-xl p-2 hover:bg-surface-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setDir(h.dir);
                        setText(h.text);
                        setSubmitted(h.text);
                      }}
                    >
                      <div className={cn('truncate text-sm font-medium', h.dir === 'ko-th' && 'ko')}>{h.text}</div>
                      <div className="truncate text-xs text-muted">{h.summary}</div>
                    </button>
                    <button onClick={() => toggleFavorite(h.id)} aria-label="Favorite" className="p-1">
                      <Star className={cn('h-4 w-4', h.favorite ? 'fill-warning text-warning' : 'text-muted')} />
                    </button>
                    <button onClick={() => remove(h.id)} aria-label="ลบ" className="p-1 text-muted opacity-60 hover:opacity-100">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <DeckPicker
        open={Boolean(picker)}
        onClose={() => setPicker(null)}
        onPick={(deckId) => {
          if (!picker) return;
          const ok = addCard(deckId, { type: picker.front.includes(' ') ? 'sentence' : 'custom', front: picker.front, back: picker.back || '—', example: picker.example !== picker.front ? picker.example : undefined, exampleTh: picker.exampleTh });
          toast[ok ? 'success' : 'info'](ok ? 'บันทึกเป็น Flashcard แล้ว' : 'มีการ์ดนี้ในชุดแล้ว');
        }}
      />
    </div>
  );
}
