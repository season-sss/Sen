import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, BookMarked, FlaskConical, Headphones, FileText, RotateCcw, Shapes, Layers3 } from 'lucide-react';
import { PageHeader } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Tabs';
import { EmptyState, Notice } from '@/components/ui/States';
import { QuizRunner } from '@/components/learn/QuizRunner';
import { VOCABULARY, TOPICS } from '@/data/vocabulary';
import { GRAMMAR, GRAMMAR_CATEGORY_LABEL } from '@/data/grammar';
import { READINGS } from '@/data/readings';
import { DIALOGUES } from '@/data/dialogues';
import { JAMO_SETS, conjugationQuestions, dialogueQuestions, grammarQuiz, jamoQuestions, readingQuestions, vocabQuestion, vocabQuiz, soundRuleQuestions } from '@/lib/quiz/generators';
import type { Question } from '@/lib/quiz/types';
import type { VocabLevel } from '@/data/types';
import { uniquePredicates } from '@/data/vocabulary';
import { useProgress } from '@/store/progress';
import { createRng, randomSeed, sample, shuffle } from '@/lib/util/random';
import { useTtsAvailable } from '@/hooks/useTts';
import { cn } from '@/lib/cn';

type Mode = 'mistakes' | 'topic' | 'vocab' | 'grammar' | 'conjugation' | 'reading' | 'listening' | 'hangul';

const MODES: { id: Mode; title: string; desc: string; icon: typeof BookOpen }[] = [
  { id: 'mistakes', title: 'ทบทวนข้อที่ตอบผิด', desc: 'Review Incorrect Answers — ตอบถูกแล้วจะหายจากรายการ', icon: RotateCcw },
  { id: 'topic', title: 'Topic-based Quiz', desc: 'เลือกหัวข้อคำศัพท์หรือหมวดไวยากรณ์', icon: Layers3 },
  { id: 'vocab', title: 'Vocabulary Drill', desc: 'ความหมาย ไทย→เกาหลี ฟัง และสะกด', icon: BookOpen },
  { id: 'grammar', title: 'Grammar Drill', desc: 'แบบฝึกหัดไวยากรณ์และคำช่วยตามระดับ', icon: BookMarked },
  { id: 'conjugation', title: 'Conjugation Drill', desc: 'ผันคำกริยา/คุณศัพท์ ตรวจด้วย Engine', icon: FlaskConical },
  { id: 'reading', title: 'Reading Practice', desc: 'อ่านบทความและข้อความสั้น', icon: FileText },
  { id: 'listening', title: 'Listening Practice', desc: 'ฟังบทสนทนาและคำศัพท์ (ใช้เสียงในอุปกรณ์)', icon: Headphones },
  { id: 'hangul', title: 'Hangul Drill', desc: 'ตัวอักษร เสียง และกฎการออกเสียง', icon: Shapes },
];

const LEVELS: VocabLevel[] = ['A1', 'A2', 'B1', 'B2'];

export default function Practice() {
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode) || null;
  const [level, setLevel] = useState<VocabLevel>('A1');
  const [count, setCount] = useState(10);
  const [topicKind, setTopicKind] = useState<'vocab' | 'grammar'>('vocab');
  const [topic, setTopic] = useState('food');
  const [category, setCategory] = useState('particle');
  const [running, setRunning] = useState<{ qs: Question[]; title: string; seed: number } | null>(null);
  const mistakes = useProgress((s) => s.mistakes);
  const tts = useTtsAvailable();

  const mistakeQs = useMemo(() => Object.values(mistakes).sort((a, b) => b.count - a.count).map((m) => m.question), [mistakes]);

  const build = (): { qs: Question[]; title: string } => {
    const seed = randomSeed();
    const rng = createRng(seed);
    switch (mode) {
      case 'mistakes':
        return { qs: shuffle(mistakeQs, rng).slice(0, count), title: 'ทบทวนข้อที่ตอบผิด' };
      case 'topic':
        if (topicKind === 'vocab') {
          const entries = VOCABULARY.filter((v) => v.topic === topic && v.level === level);
          return { qs: vocabQuiz(entries.length ? entries : VOCABULARY.filter((v) => v.topic === topic), rng, count), title: `หัวข้อ: ${TOPICS.find((t) => t.id === topic)?.th}` };
        }
        return { qs: sample(GRAMMAR.filter((g) => g.category === category).flatMap((g) => grammarQuiz(g, rng)), count, rng), title: `หมวด: ${GRAMMAR_CATEGORY_LABEL[category as keyof typeof GRAMMAR_CATEGORY_LABEL]}` };
      case 'vocab':
        return { qs: vocabQuiz(VOCABULARY.filter((v) => v.level === level), rng, count), title: `Vocabulary Drill ${level}` };
      case 'grammar':
        return { qs: sample(GRAMMAR.filter((g) => g.level === level).flatMap((g) => grammarQuiz(g, rng)), count, rng), title: `Grammar Drill ${level}` };
      case 'conjugation': {
        const order = LEVELS.slice(0, LEVELS.indexOf(level) + 1);
        const words = uniquePredicates()
          .filter((v) => order.includes(v.level))
          .map((v) => ({ ko: v.ko, pos: (v.pos === 'adjective' ? 'adjective' : 'verb') as 'verb' | 'adjective', irr: v.irr, th: v.th }));
        const keys = { A1: ['present', 'past', 'future', 'negLong', 'want', 'request', 'and', 'so'], A2: ['if', 'mustDo', 'mayDo', 'modPresent', 'modPast', 'when', 'honPresent'], B1: ['seems', 'background', 'quoteStatement', 'plain', 'while', 'intend'], B2: ['evenIf', 'theMore', 'notOnly', 'whereas', 'ifHadPast', 'modRetro'] }[level];
        return { qs: conjugationQuestions(sample(words, count * 3, rng), keys, rng, count), title: `Conjugation Drill ${level}` };
      }
      case 'reading':
        return { qs: shuffle(readingQuestions(READINGS.filter((r) => r.level === level || (level === 'A1' && r.level === 'A2')).map((r) => r.id)), rng).slice(0, count), title: `Reading Practice ${level}` };
      case 'listening': {
        const dq = dialogueQuestions(DIALOGUES.filter((d) => d.level === level || (level === 'B2' && d.level === 'B1')).map((d) => d.id));
        const vq = sample(VOCABULARY.filter((v) => v.level === level && !v.ko.includes(' ')), Math.max(3, count - dq.length), rng).map((v) => vocabQuestion(v, 'listen', rng));
        return { qs: shuffle([...dq, ...vq], rng).slice(0, count), title: `Listening Practice ${level}` };
      }
      case 'hangul':
        return { qs: shuffle([...Object.values(JAMO_SETS).flatMap((s) => jamoQuestions(s, rng)), ...soundRuleQuestions(['liaison', 'nasalization', 'tensification', 'aspiration'], rng)], rng).slice(0, count), title: 'Hangul Drill' };
      default:
        return { qs: [], title: '' };
    }
  };

  if (running)
    return (
      <QuizRunner
        key={running.seed}
        questions={running.qs}
        title={running.title}
        source={`practice:${mode}`}
        onExit={() => setRunning(null)}
      />
    );

  return (
    <div>
      <PageHeader title="Practice Zone" subtitle="ฝึกแยกทักษะ ทุกข้อตรวจคำตอบได้จริงและบันทึกผลลงความก้าวหน้า" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setParams({ mode: m.id })}
            className={cn('card flex flex-col items-start p-4 text-left transition hover:shadow-lift', mode === m.id && 'ring-2 ring-lavender')}
            aria-pressed={mode === m.id}
          >
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-lavender-soft text-lavender">
              <m.icon className="h-5 w-5" />
            </div>
            <div className="font-semibold">
              {m.title}
              {m.id === 'mistakes' && mistakeQs.length > 0 && <span className="ml-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">{mistakeQs.length}</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted">{m.desc}</div>
          </button>
        ))}
      </div>

      {mode && (
        <div className="card card-pad mt-5 space-y-4">
          <h2 className="h2">{MODES.find((m) => m.id === mode)?.title}</h2>
          {mode === 'mistakes' && mistakeQs.length === 0 ? (
            <EmptyState title="ไม่มีข้อที่ตอบผิดค้างอยู่" message="ข้อที่ตอบผิดจากบทเรียน แบบทดสอบ และ TOPIK จะมาอยู่ที่นี่ จนกว่าคุณจะตอบถูก" />
          ) : (
            <>
              {mode !== 'mistakes' && mode !== 'hangul' && (
                <div>
                  <div className="label">ระดับ</div>
                  <Segmented<VocabLevel> value={level} onChange={setLevel} options={LEVELS.map((l) => ({ id: l, label: l }))} />
                </div>
              )}
              {mode === 'topic' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="label">ประเภทหัวข้อ</div>
                    <Segmented<'vocab' | 'grammar'>
                      value={topicKind}
                      onChange={setTopicKind}
                      options={[
                        { id: 'vocab', label: 'หัวข้อคำศัพท์' },
                        { id: 'grammar', label: 'หมวดไวยากรณ์' },
                      ]}
                    />
                  </div>
                  {topicKind === 'vocab' ? (
                    <select className="input self-end" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="หัวข้อคำศัพท์">
                      {TOPICS.filter((t) => VOCABULARY.some((v) => v.topic === t.id)).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.th} ({VOCABULARY.filter((v) => v.topic === t.id && v.level === level).length} คำใน {level})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select className="input self-end" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="หมวดไวยากรณ์">
                      {[...new Set(GRAMMAR.map((g) => g.category))].map((c) => (
                        <option key={c} value={c}>
                          {GRAMMAR_CATEGORY_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
              <div>
                <div className="label">จำนวนข้อ</div>
                <Segmented<string> value={String(count)} onChange={(v) => setCount(Number(v))} options={[5, 10, 20, 30].map((n) => ({ id: String(n), label: `${n} ข้อ` }))} />
              </div>
              {mode === 'listening' && !tts && <Notice tone="warning">อุปกรณ์นี้ไม่มีเสียงอ่านภาษาเกาหลี — ยังฝึกได้โดยกด "แสดงบทพูด" แต่จะเป็นการอ่านแทนการฟัง</Notice>}
              <button
                className="btn-primary"
                onClick={() => {
                  const r = build();
                  if (!r.qs.length) return;
                  setRunning({ ...r, seed: randomSeed() });
                }}
              >
                เริ่มฝึก
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
