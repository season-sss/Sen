import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, Eye, EyeOff, Layers, Plus, Play } from 'lucide-react';
import type { Lesson } from '@/data/curriculum';
import { VOCABULARY } from '@/data/vocabulary';
import { GRAMMAR_BY_ID } from '@/data/grammar';
import { DIALOGUES } from '@/data/dialogues';
import { READINGS } from '@/data/readings';
import { WRITING_BY_ID } from '@/data/writing';
import { POS_LESSONS, STRUCTURE_LESSONS } from '@/data/foundations';
import { BATCHIM_GROUPS, COMPLEX_BATCHIM, DECODING_WORDS, KEYBOARD_ROWS, SOUND_RULE_PRACTICE, type JamoInfo } from '@/data/hangul';
import { POS_INFO } from '@/data/types';
import { JAMO_SETS } from '@/lib/quiz/generators';
import { compose, INITIALS, MEDIALS, FINALS, pronounce, SOUND_RULE_INFO, thaiReading, type SoundRule } from '@/lib/hangul';
import { conjugate, FORM_BY_KEY } from '@/lib/conjugation';
import { uniquePredicates } from '@/data/vocabulary';
import { KoreanText, SpeakButton } from '@/components/ui/Korean';
import { Segmented } from '@/components/ui/Tabs';
import { Notice } from '@/components/ui/States';
import { GrammarArticle } from './GrammarArticle';
import { useFlashcards } from '@/store/flashcards';
import { useNotes } from '@/store/notes';
import { useSettings, type ThaiReadingPref } from '@/store/settings';
import { speak } from '@/lib/tts';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { gradeText } from '@/lib/quiz/grading';

export interface Topic {
  id: string;
  title: string;
  content: ReactNode;
}

// ------------------------------------------------------------------ Hangul pieces
function JamoGrid({ items }: { items: JamoInfo[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((j) => (
        <div key={j.char} className="card p-4">
          <div className="flex items-start justify-between">
            <span lang="ko" className="ko text-5xl font-bold text-navy">
              {j.char}
            </span>
            {j.examples[0] && <SpeakButton text={j.examples[0].word} size="sm" />}
          </div>
          <div className="mt-2 text-sm font-semibold" lang="ko">
            {j.name}
          </div>
          <div className="text-xs text-muted">
            {j.roman} · ≈ {j.thai}
          </div>
          {j.note && <div className="mt-2 text-xs text-muted">{j.note}</div>}
          <div className="mt-2 flex flex-wrap gap-1">
            {j.examples.map((e) => (
              <button key={e.word} className="chip" onClick={() => speak(e.word)} title={e.th} lang="ko">
                {e.word}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Freehand tracing pad for handwriting practice (pointer & touch). */
export function TracePad({ chars }: { chars: string[] }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const clear = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
  };
  useEffect(clear, [i]);
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 300 };
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {chars.map((c, k) => (
          <button key={c} className={cn('chip ko text-base', k === i && 'chip-active')} onClick={() => setI(k)} lang="ko">
            {c}
          </button>
        ))}
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[300px] rounded-2xl border border-border bg-surface">
        <span lang="ko" className="ko pointer-events-none absolute inset-0 grid select-none place-items-center text-[200px] font-bold leading-none text-ink/10">
          {chars[i]}
        </span>
        <canvas
          ref={ref}
          width={300}
          height={300}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label={`พื้นที่ฝึกเขียน ${chars[i]}`}
          onPointerDown={(e) => {
            drawing.current = true;
            const ctx = ref.current!.getContext('2d')!;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ref.current!.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = ref.current!.getContext('2d')!;
            const p = pos(e);
            ctx.lineTo(p.x, p.y);
            const rgb = getComputedStyle(document.documentElement).getPropertyValue('--lavender').trim().replace(/\s+/g, ',');
            ctx.strokeStyle = rgb ? `rgb(${rgb})` : '#7c6fd6';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
          }}
          onPointerUp={() => (drawing.current = false)}
        />
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button className="btn-secondary btn-sm" onClick={clear}>
          <Eraser className="h-4 w-4" /> ล้าง
        </button>
        <button className="btn-secondary btn-sm" onClick={() => setI((i + 1) % chars.length)}>
          ตัวถัดไป
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">ลากนิ้วหรือเมาส์ตามตัวอักษรจาง ๆ เขียนจากซ้ายไปขวา บนลงล่าง</p>
    </div>
  );
}

function SyllableBuilder() {
  const [ini, setIni] = useState('ㅎ');
  const [med, setMed] = useState('ㅏ');
  const [fin, setFin] = useState('ㄴ');
  const syl = compose(ini, med, fin);
  const vertical = ['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'].includes(med);
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-lavender-soft to-sky-soft p-6">
        <span lang="ko" className="ko text-7xl font-bold text-navy">
          {syl}
        </span>
        <div className="flex items-center gap-2 text-sm text-muted">
          {ini} + {med} {fin && `+ ${fin}`} = <b className="ko text-ink">{syl}</b> · อ่านว่า {thaiReading(syl)}
          <SpeakButton text={syl} size="sm" />
        </div>
        <div className="text-xs text-muted">{vertical ? 'สระแนวนอน (ㅗ ㅜ ㅡ …) วางใต้พยัญชนะต้น' : 'สระแนวตั้ง (ㅏ ㅓ ㅣ …) วางด้านขวาของพยัญชนะต้น'}{fin && ' · ตัวสะกดอยู่ล่างสุด'}</div>
      </div>
      {[
        { label: 'พยัญชนะต้น (초성)', items: INITIALS as readonly string[], value: ini, set: setIni },
        { label: 'สระ (중성)', items: MEDIALS as readonly string[], value: med, set: setMed },
        { label: 'ตัวสะกด (종성) — เลือกว่างได้', items: FINALS as readonly string[], value: fin, set: setFin },
      ].map((row) => (
        <div key={row.label}>
          <div className="label">{row.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {row.items.map((x) => (
              <button key={x || 'none'} className={cn('chip ko min-w-[2.25rem] justify-center text-base', row.value === x && 'chip-active')} onClick={() => row.set(x)}>
                {x || '—'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TypingPractice() {
  const words = ['한국', '사랑', '안녕하세요', '감사합니다', '학교', '친구', '음식', '물'];
  const [i, setI] = useState(0);
  const [v, setV] = useState('');
  const ok = gradeText([words[i]], v).correct;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="mx-auto w-max space-y-1.5" aria-label="แผนผังแป้นพิมพ์เกาหลีแบบ 두벌식">
          {KEYBOARD_ROWS.map((row, r) => (
            <div key={r} className="flex gap-1.5" style={{ paddingLeft: r * 14 }}>
              {row.map((k) => (
                <div key={k.key} className="relative grid h-11 w-9 place-items-center rounded-lg border border-border bg-surface text-base shadow-card sm:h-12 sm:w-11">
                  <span className="absolute left-1 top-0.5 text-[9px] text-muted">{k.key}</span>
                  <span lang="ko" className="ko font-semibold">
                    {k.jamo}
                  </span>
                  {k.shift && <span className="absolute bottom-0.5 right-1 text-[9px] text-lavender">{k.shift}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Notice>
        เปิดแป้นพิมพ์เกาหลีในอุปกรณ์: iPhone/iPad — ตั้งค่า › ทั่วไป › แป้นพิมพ์ › เพิ่ม "เกาหลี (2-Set)" · Windows/macOS — เพิ่มภาษาเกาหลี (Korean 2-Set) ในการตั้งค่าภาษา
      </Notice>
      <div className="card p-4">
        <div className="mb-2 text-sm text-muted">ลองพิมพ์คำนี้</div>
        <KoreanText text={words[i]} size="lg" />
        <input className="input ko mt-3 text-lg" lang="ko" value={v} onChange={(e) => setV(e.target.value)} placeholder="พิมพ์ที่นี่" aria-label="ฝึกพิมพ์" />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className={ok ? 'font-semibold text-success' : 'text-muted'}>{ok ? 'ถูกต้อง!' : `${v.length}/${words[i].length} พยางค์`}</span>
          <button
            className="btn-secondary btn-sm"
            onClick={() => {
              setI((i + 1) % words.length);
              setV('');
            }}
          >
            คำถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}

function ReadingAidGuide() {
  const { thaiReading: pref, set } = useSettings();
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p>
        คำอ่านภาษาไทยช่วยให้เริ่มต้นได้เร็ว แต่ภาษาเกาหลีมีเสียงที่อักษรไทยแทนได้ไม่ตรง เช่น ㅓ กับ ㅗ (ทั้งคู่ใกล้ "ออ/โอ"), ㄱ ㅋ ㄲ (ค/ก) และเสียงตัวสะกด ㄹ ที่ไม่เหมือน ล ไทย
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>ช่วงแรก: เปิดคำอ่านไทยไว้ได้ แต่ให้อ่านฮันกึลก่อนเสมอ แล้วค่อยดูคำอ่าน</li>
        <li>เมื่ออ่านพยางค์ได้คล่อง: เปลี่ยนเป็น "แตะเพื่อดู" เพื่อลดการพึ่งพา</li>
        <li>เมื่อเริ่มระดับ A1: ปิดคำอ่านไทย ใช้การฟังเสียงแทน</li>
      </ul>
      <div className="card p-4">
        <div className="label">การแสดงคำอ่านไทยทั้งแอป</div>
        <Segmented<ThaiReadingPref>
          value={pref}
          onChange={(v) => set({ thaiReading: v })}
          options={[
            { id: 'always', label: 'แสดงเสมอ' },
            { id: 'tap', label: 'แตะเพื่อดู' },
            { id: 'never', label: 'ไม่แสดง' },
          ]}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['어머니', 'ไม่ใช่ "โอโมนี" — ㅓ เปิดปากกว้างกว่า ㅗ'],
          ['감사합니다', 'ㅂ+ㄴ ออกเสียง [ม] → [감사함니다]'],
          ['괜찮아요', 'ㄶ + 아 → ㅎ หาย [괜차나요]'],
          ['물', 'ㄹ ตัวสะกดลิ้นแตะเพดาน ไม่ใช่ น'],
        ].map(([w, n]) => (
          <div key={w} className="rounded-xl border border-border p-3">
            <KoreanText text={w} />
            <div className="mt-1 text-xs text-muted">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SoundRuleTopic({ rule }: { rule: SoundRule }) {
  const words = SOUND_RULE_PRACTICE.find((p) => p.rule === rule)?.words ?? [];
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-lavender-soft p-4">
        <div lang="ko" className="ko text-lg font-bold text-lavender">
          {SOUND_RULE_INFO[rule].ko}
        </div>
        <p className="mt-1 text-sm">{SOUND_RULE_INFO[rule].th}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {words.map((w) => {
          const p = pronounce(w);
          return (
            <div key={w} className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <span lang="ko" className="ko text-lg font-semibold">
                  {w}
                </span>
                <span className="mx-2 text-muted">→</span>
                <span lang="ko" className="ko text-lg font-semibold text-lavender">
                  [{p.text}]
                </span>
                <div className="text-xs text-muted">≈ {thaiReading(w)}</div>
              </div>
              <SpeakButton text={w} size="sm" />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">การออกเสียงในวงเล็บคำนวณจาก Pronunciation Engine ของ HANEUL ซึ่งครอบคลุมกฎที่พบบ่อย คำผสมบางคำอาจมีเสียงเพิ่มเติมที่กฎไม่ครอบคลุม</p>
    </div>
  );
}

// ------------------------------------------------------------------ Vocab
function VocabList({ entries, lessonTitle }: { entries: typeof VOCABULARY; lessonTitle: string }) {
  const { decks, createDeck, addVocab } = useFlashcards();
  const addToVocabList = useNotes((s) => s.addToVocabList);
  const addAll = () => {
    const name = `คำศัพท์: ${lessonTitle}`;
    const existing = Object.values(decks).find((d) => d.name === name);
    const id = existing?.id ?? createDeck(name, { level: entries[0]?.level, description: 'สร้างจากบทเรียน' });
    const n = addVocab(id, entries);
    toast.success(n ? `เพิ่ม ${n} คำลงชุด "${name}"` : 'คำทั้งหมดอยู่ในชุดแล้ว');
  };
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-secondary btn-sm" onClick={addAll}>
          <Layers className="h-4 w-4" /> เพิ่มทั้งหมดลง Flashcards
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((v) => (
          <div key={v.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <KoreanText text={v.ko} size="lg" pron={v.pron} />
              <button
                className="btn-ghost -m-1 p-1.5"
                title="เพิ่มลงรายการคำศัพท์ส่วนตัว (Notes)"
                aria-label={`บันทึก ${v.ko} ลงรายการคำศัพท์ส่วนตัว`}
                onClick={() => {
                  addToVocabList({ ko: v.ko, th: v.th });
                  toast.success(`บันทึก ${v.ko} ลงรายการคำศัพท์ส่วนตัวแล้ว`);
                }}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 text-[15px] font-medium">{v.th}</div>
            <div className="text-xs text-muted">{POS_INFO[v.pos].th} · {POS_INFO[v.pos].ko}</div>
            <div className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">
              <div lang="ko" className="ko flex items-center gap-2">
                {v.ex} <SpeakButton text={v.ex} size="sm" />
              </div>
              <div className="text-muted">{v.exTh}</div>
            </div>
            {v.note && <div className="mt-1.5 text-xs text-warning">{v.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Conjugation
function ConjugationTable({ words, formKeys, explain }: { words: string[]; formKeys: string[]; explain: string[] }) {
  const known = new Map(uniquePredicates().map((v) => [v.ko, v]));
  return (
    <div className="space-y-4">
      <ul className="space-y-1.5">
        {explain.map((e, i) => (
          <li key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            {e}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2">คำ</th>
              {formKeys.map((k) => (
                <th key={k} className="px-3 py-2" lang="ko">
                  {FORM_BY_KEY[k]?.pattern ?? { negAn: '안 + -아/어요', negMot: '못 + -아/어요', negAnPast: '안 + -았/었어요' }[k] ?? k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {words.map((w) => {
              const v = known.get(w);
              const r = conjugate(w, { pos: v?.pos === 'adjective' ? 'adjective' : 'verb', irregular: v?.irr });
              return (
                <tr key={w} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div lang="ko" className="ko font-semibold">
                      {w}
                    </div>
                    <div className="text-xs text-muted">{r.irregularLabel}</div>
                  </td>
                  {formKeys.map((k) => {
                    const f = r.forms.find((x) => x.key === k);
                    return (
                      <td key={k} className="px-3 py-2" lang="ko" title={f?.steps.join('\n')}>
                        {f?.value ? <span className="ko">{f.value}</span> : <span className="text-xs text-muted">{f?.note ?? '—'}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Link to={`/conjugation?word=${encodeURIComponent(words[0])}`} className="btn-secondary btn-sm">
        เปิด Conjugation Lab เพื่อดูขั้นตอนการผันทีละขั้น
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ Dialogue & reading
function DialogueView({ id }: { id: string }) {
  const d = DIALOGUES.find((x) => x.id === id)!;
  const [showTh, setShowTh] = useState(true);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">สถานการณ์: {d.situation}</p>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={() => speak(d.lines.map((l) => l.ko).join('\n'))}>
            <Play className="h-4 w-4" /> เล่นทั้งหมด
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowTh(!showTh)}>
            {showTh ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} คำแปล
          </button>
        </div>
      </div>
      {d.lines.map((l, i) => (
        <div key={i} className={cn('flex gap-3', i % 2 && 'flex-row-reverse text-right')}>
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white', i % 2 ? 'bg-sky' : 'bg-lavender')} lang="ko">
            {l.speaker.slice(0, 2)}
          </div>
          <div className={cn('max-w-[85%] rounded-2xl border border-border bg-surface p-3', i % 2 ? 'rounded-tr-sm' : 'rounded-tl-sm')}>
            <div className={cn('flex items-start gap-2', i % 2 && 'flex-row-reverse')}>
              <span lang="ko" className="ko text-[15px]">
                {l.ko}
              </span>
              <SpeakButton text={l.ko} size="sm" />
            </div>
            {showTh && <div className="mt-1 text-sm text-muted">{l.th}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReadingView({ id }: { id: string }) {
  const r = READINGS.find((x) => x.id === id)!;
  const [showTh, setShowTh] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <SpeakButton text={r.ko} />
        <button className="btn-secondary btn-sm" onClick={() => setShowTh(!showTh)}>
          {showTh ? 'ซ่อนคำแปล' : 'แสดงคำแปล'}
        </button>
      </div>
      <div lang="ko" className="ko whitespace-pre-line rounded-xl border border-border bg-surface-2 p-4 text-[16px] leading-loose">
        {r.ko}
      </div>
      {showTh && <div className="rounded-xl bg-lavender-soft p-4 text-sm leading-relaxed">{r.th}</div>}
      <Link to={`/translator?text=${encodeURIComponent(r.ko.split(/(?<=[.?!])\s/)[0])}`} className="btn-ghost btn-sm">
        วิเคราะห์ประโยคแรกใน Reading Assistant
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ Topic builder
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export function lessonTopics(lesson: Lesson): Topic[] {
  const s = lesson.source;
  const t = (i: number, title: string, content: ReactNode): Topic => ({ id: `${lesson.id}:t${i}`, title, content });
  switch (s.kind) {
    case 'hangul-jamo': {
      const set = JAMO_SETS[s.set];
      return [t(0, 'ตัวอักษรและเสียง', <JamoGrid items={set} />), t(1, 'ฝึกเขียน', <TracePad chars={set.map((j) => j.char)} />)];
    }
    case 'hangul-syllable':
      return [
        t(0, 'โครงสร้างพยางค์', (
          <div className="space-y-2 text-sm leading-relaxed">
            <p>ทุกพยางค์ในภาษาเกาหลีเขียนเป็น "บล็อก" ประกอบด้วย พยัญชนะต้น (초성) + สระ (중성) + ตัวสะกด (종성 ไม่บังคับ)</p>
            <p>ถ้าพยางค์ขึ้นต้นด้วยสระ ต้องใส่ ㅇ (ไม่มีเสียง) ไว้หน้าสระ เช่น 아, 오, 이</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {['가', '고', '각'].map((x) => (
                <div key={x} className="rounded-xl bg-surface-2 p-3">
                  <KoreanText text={x} size="lg" />
                </div>
              ))}
            </div>
          </div>
        )),
        t(1, 'ทดลองประกอบพยางค์', <SyllableBuilder />),
      ];
    case 'hangul-decoding':
      return [
        t(0, 'วิธีอ่านคำใหม่', (
          <div className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5">
              <li>แยกเป็นพยางค์ แต่ละบล็อกคือหนึ่งพยางค์</li>
              <li>อ่านพยัญชนะต้น → สระ → ตัวสะกด</li>
              <li>ดูว่าพยางค์ถัดไปขึ้นต้นด้วย ㅇ หรือไม่ (อาจมีการเชื่อมเสียง)</li>
            </ol>
            <div className="grid gap-2 sm:grid-cols-2">
              {DECODING_WORDS.slice(0, 8).map((w) => (
                <div key={w.word} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <KoreanText text={w.word} />
                  <span className="text-sm text-muted">{w.th}</span>
                </div>
              ))}
            </div>
          </div>
        )),
      ];
    case 'hangul-batchim':
      return s.set === 'simple'
        ? [
            t(0, 'ตัวสะกด 7 เสียง', (
              <div className="grid gap-2 sm:grid-cols-2">
                {BATCHIM_GROUPS.map((g) => (
                  <div key={g.sound} className="rounded-xl border border-border p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="ko text-lg font-bold" lang="ko">
                        {g.sound}
                      </span>
                      <span className="text-sm text-muted">≈ {g.thai}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted">ตัวอักษรที่ออกเสียงนี้: {g.letters.join(' ')}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {g.examples.map((e) => (
                        <button key={e.word} className="chip ko" lang="ko" onClick={() => speak(e.word)} title={e.th}>
                          {e.word} → [{pronounce(e.word).text}]
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )),
          ]
        : [
            t(0, 'ตัวสะกดซ้อน', (
              <div className="grid gap-2 sm:grid-cols-2">
                {COMPLEX_BATCHIM.map((c) => (
                  <div key={c.pair} className="rounded-xl border border-border p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="ko text-2xl font-bold" lang="ko">
                        {c.pair}
                      </span>
                      <span className="text-sm text-muted">อ่านเป็น {c.reads}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.examples.map((e) => (
                        <button key={e.word} className="chip ko" lang="ko" onClick={() => speak(e.word)}>
                          {e.word} [{pronounce(e.word).text}] · {e.th}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1 text-xs text-muted">{c.note}</div>
                  </div>
                ))}
              </div>
            )),
          ];
    case 'hangul-sound':
      return s.rules.map((r, i) => t(i, `${SOUND_RULE_INFO[r as SoundRule].ko}`, <SoundRuleTopic rule={r as SoundRule} />));
    case 'hangul-typing':
      return [t(0, 'แป้นพิมพ์และฝึกพิมพ์', <TypingPractice />)];
    case 'hangul-reading-aid':
      return [t(0, 'ใช้คำอ่านไทยอย่างเหมาะสม', <ReadingAidGuide />)];
    case 'vocab': {
      const entries = VOCABULARY.filter((v) => s.topics.includes(v.topic) && v.level === s.level);
      return chunk(entries, 8).map((c, i, all) => t(i, `คำศัพท์ ชุดที่ ${i + 1}/${all.length}`, <VocabList entries={c} lessonTitle={lesson.title} />));
    }
    case 'pos':
      return s.ids.map((id, i) => {
        const p = POS_LESSONS.find((x) => x.id === id)!;
        return t(i, p.th, (
          <div className="space-y-3">
            <h3 lang="ko" className="ko text-xl font-bold">
              {p.ko}
            </h3>
            <p className="text-sm">{p.role}</p>
            <ul className="space-y-1.5">
              {p.points.map((x, k) => (
                <li key={k} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  {x}
                </li>
              ))}
            </ul>
            {p.examples.map((e) => (
              <div key={e.ko} className="rounded-xl border border-border p-3">
                <KoreanText text={e.ko} />
                <div className="text-sm text-muted">{e.th}</div>
              </div>
            ))}
          </div>
        ));
      });
    case 'structure':
      return s.ids.map((id, i) => {
        const st = STRUCTURE_LESSONS.find((x) => x.id === id)!;
        return t(i, st.title, (
          <div className="space-y-3">
            <div lang="ko" className="ko rounded-xl bg-lavender-soft p-4 text-center text-lg font-bold text-lavender">
              {st.pattern}
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {st.points.map((x, k) => (
                <li key={k}>{x}</li>
              ))}
            </ul>
            {st.examples.map((e) => (
              <div key={e.ko} className="rounded-xl border border-border p-3">
                <KoreanText text={e.ko} />
                <div className="text-sm text-muted">{e.th}</div>
              </div>
            ))}
          </div>
        ));
      });
    case 'grammar':
      return s.ids.map((id, i) => t(i, GRAMMAR_BY_ID[id].pattern, <GrammarArticle g={GRAMMAR_BY_ID[id]} compact />));
    case 'conjugation':
      return [t(0, 'ตารางการผัน', <ConjugationTable words={s.words} formKeys={s.formKeys} explain={s.explain} />)];
    case 'dialogue':
      return s.ids.map((id, i) => t(i, DIALOGUES.find((d) => d.id === id)!.title, <DialogueView id={id} />));
    case 'reading':
      return s.ids.map((id, i) => t(i, READINGS.find((d) => d.id === id)!.title, <ReadingView id={id} />));
    case 'writing':
      return [
        t(0, 'โจทย์การเขียน', (
          <div className="space-y-3">
            {s.questionIds.map((id) => {
              const w = WRITING_BY_ID[id];
              return (
                <div key={id} className="rounded-xl border border-border p-4 text-sm">
                  <div lang="ko" className="ko whitespace-pre-line font-semibold">
                    {w.prompt}
                  </div>
                  {w.promptTh && <div className="mt-1 text-muted">{w.promptTh}</div>}
                </div>
              );
            })}
            <Notice>ในขั้นแบบฝึกหัด ระบบจะตรวจความยาว ระดับภาษา (한다체) และสำนวนที่แนะนำแบบอัตโนมัติด้วยกฎ แล้วให้คุณประเมินตนเองตาม Rubric</Notice>
          </div>
        )),
      ];
  }
}
