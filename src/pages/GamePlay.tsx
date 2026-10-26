import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trophy, Heart, Skull, RotateCcw, Timer } from 'lucide-react';
import { GAME_BY_ID, generateGameQuestions, scoreAnswer, newBoss, bossHit, type GameId, type GameQuestion, type BossState } from '@/lib/games';
import { GameQuestionView, MatchBoardView } from '@/components/games/GameQuestionView';
import { Segmented } from '@/components/ui/Tabs';
import { ErrorState, Notice } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { useGameHistory } from '@/store/history';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';
import { sessionHandle, useAccount } from '@/lib/account/accounts';
import { useTtsAvailable } from '@/hooks/useTts';
import { randomSeed } from '@/lib/util/random';
import { grade } from '@/lib/quiz/grading';
import type { Level } from '@/data/types';
import type { AnswerRecord, Question } from '@/lib/quiz/types';
import { cn } from '@/lib/cn';

interface Player {
  name: string;
  score: number;
  correct: number;
  streak: number;
}

type Phase = 'setup' | 'countdown' | 'question' | 'feedback' | 'handoff' | 'end';

export default function GamePlay() {
  const { gameId = '' } = useParams();
  const [params] = useSearchParams();
  const def = GAME_BY_ID[gameId as GameId];
  const isLocal = params.get('mode') === 'local';
  const settingsName = useSettings((s) => s.displayName);
  const accountHandle = useAccount((s) => sessionHandle(s.session));
  const [level, setLevel] = useState<Level>('A1');
  const [names, setNames] = useState<string[]>(isLocal ? ['ผู้เล่น 1', 'ผู้เล่น 2'] : [accountHandle || settingsName || 'ฉัน']);
  const [phase, setPhase] = useState<Phase>('setup');
  const [seed, setSeed] = useState(randomSeed);
  const [players, setPlayers] = useState<Player[]>([]);
  const [qi, setQi] = useState(0);
  const [count, setCount] = useState(3);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [lastGiven, setLastGiven] = useState<number | string | string[] | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);
  const [boss, setBoss] = useState<BossState | null>(null);
  const records = useRef<AnswerRecord[]>([]);
  const saved = useRef(false);
  const addResult = useGameHistory((s) => s.add);
  const logAnswers = useProgress((s) => s.logAnswers);
  const tts = useTtsAvailable();

  const perPlayer = def ? def.rounds : 0;
  const totalTurns = perPlayer * Math.max(1, players.length);
  const questions: GameQuestion[] = useMemo(
    () => (def && players.length ? generateGameQuestions(def.id, { maxLevel: level, seed, count: def.id === 'word-matching' ? def.rounds * players.length : totalTurns }) : []),
    [def, level, seed, players.length, totalTurns],
  );
  const current = questions[qi];
  const turnPlayer = players.length ? qi % players.length : 0;
  const limitMs = (def?.secondsPerQuestion ?? 10) * 1000;
  const remaining = Math.max(0, limitMs - (now - startAt));

  useEffect(() => {
    if (phase !== 'question' && phase !== 'countdown') return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      setPhase('question');
      setStartAt(Date.now());
      return;
    }
    const t = setTimeout(() => setCount(count - 1), 800);
    return () => clearTimeout(t);
  }, [phase, count]);

  useEffect(() => {
    if (phase === 'question' && remaining === 0 && current && current.kind !== 'match') answer(null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  useEffect(() => {
    if (phase !== 'end' || saved.current || !def) return;
    saved.current = true;
    addResult({ gameId: def.id, mode: isLocal ? 'local' : 'solo', level, players: players.map((p) => ({ name: p.name, score: p.score, correct: p.correct })), won: boss ? boss.defeated : undefined });
    if (!isLocal) logAnswers(records.current, `game:${def.id}`, questions.filter((q) => q.kind !== 'match') as Question[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!def) return <ErrorState title="ไม่พบเกม" action={<Link className="btn-primary" to="/games">Game Center</Link>} />;
  if (def.requiresTts && !tts)
    return <ErrorState title="อุปกรณ์นี้ไม่มีเสียงอ่านภาษาเกาหลี" message="Listening Challenge ต้องใช้ Text-to-Speech ภาษาเกาหลีในอุปกรณ์ (เช่น iOS, macOS, Android หรือ Windows ที่ติดตั้งภาษาเกาหลี)" action={<Link className="btn-primary" to="/games">กลับ</Link>} />;

  const start = () => {
    const ps = names.map((n, i) => ({ name: n.trim() || `ผู้เล่น ${i + 1}`, score: 0, correct: 0, streak: 0 }));
    setPlayers(ps);
    setQi(0);
    setSeed(randomSeed());
    setBoss(def.id === 'boss-battle' ? newBoss(ps.length, def.rounds) : null);
    records.current = [];
    saved.current = false;
    setCount(3);
    setPhase(ps.length > 1 ? 'handoff' : 'countdown');
  };

  function answer(given: number | string | string[] | null, correct: boolean, overridePoints?: number) {
    if (phase !== 'question' || !current) return;
    const elapsed = Date.now() - startAt;
    const p = players[turnPlayer];
    const pts = overridePoints ?? scoreAnswer(correct, elapsed, limitMs, p.streak);
    setPlayers(players.map((pl, i) => (i === turnPlayer ? { ...pl, score: pl.score + pts, correct: pl.correct + (correct ? 1 : 0), streak: correct ? pl.streak + 1 : 0 } : pl)));
    if (current.kind !== 'match') records.current.push({ questionId: current.id, correct, given: String(given ?? ''), section: current.section, level: current.level, ref: current.ref });
    if (boss) setBoss(bossHit(boss, correct, pts));
    setLastGiven(given);
    setLastCorrect(correct);
    setLastPoints(pts);
    setPhase('feedback');
  }

  const next = () => {
    const bossOver = boss && (boss.defeated || boss.lost);
    if (qi + 1 >= questions.length || bossOver) {
      setPhase('end');
      return;
    }
    setQi(qi + 1);
    setLastGiven(null);
    if (players.length > 1) setPhase('handoff');
    else {
      setPhase('question');
      setStartAt(Date.now());
    }
  };

  // ------------------------------------------------------------------ render
  if (phase === 'setup')
    return (
      <div className="mx-auto max-w-lg">
        <Link to="/games" className="btn-ghost btn-sm -ml-2 mb-3">
          <ArrowLeft className="h-4 w-4" /> Game Center
        </Link>
        <div className="card card-pad space-y-5">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-lavender to-sky text-white">
              <Icon name={def.icon} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="h2">{def.name}</h1>
              <p className="text-sm text-muted">{def.description}</p>
            </div>
          </div>
          <div>
            <div className="label">ระดับคำถาม</div>
            <Segmented<Level> value={level} onChange={setLevel} options={(['A1', 'A2', 'B1', 'B2'] as Level[]).map((l) => ({ id: l, label: l }))} />
          </div>
          <div>
            <div className="label">{isLocal ? `ผู้เล่น (2–8 คน ผลัดกันตอบบนเครื่องนี้)` : 'ชื่อผู้เล่น'}</div>
            <div className="space-y-2">
              {names.map((n, i) => (
                <div key={i} className="flex gap-2">
                  <input className="input" value={n} onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`ชื่อผู้เล่น ${i + 1}`} maxLength={20} />
                  {isLocal && names.length > 2 && (
                    <button className="btn-ghost px-2" onClick={() => setNames(names.filter((_, j) => j !== i))} aria-label="ลบผู้เล่น">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {isLocal && names.length < 8 && (
                <button className="btn-secondary btn-sm" onClick={() => setNames([...names, `ผู้เล่น ${names.length + 1}`])}>
                  <Plus className="h-4 w-4" /> เพิ่มผู้เล่น
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted">
            {def.id === 'word-matching' ? `${def.rounds} กระดานต่อคน` : `${def.rounds} ข้อต่อคน`} · {def.secondsPerQuestion} วินาทีต่อข้อ · คะแนน = 100 + โบนัสความเร็ว (สูงสุด 100) + โบนัสตอบถูกต่อเนื่อง
          </p>
          <button className="btn-primary w-full" onClick={start}>
            เริ่มเกม
          </button>
        </div>
      </div>
    );

  if (phase === 'end') {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card card-pad">
          {boss ? (
            boss.defeated ? (
              <Trophy className="mx-auto mb-2 h-12 w-12 text-warning" />
            ) : (
              <Skull className="mx-auto mb-2 h-12 w-12 text-muted" />
            )
          ) : (
            <Trophy className="mx-auto mb-2 h-12 w-12 text-warning" />
          )}
          <h1 className="h2">{boss ? (boss.defeated ? 'ชนะบอสแล้ว!' : 'บอสยังไม่ล้ม…') : 'จบเกม!'}</h1>
          <ol className="mt-4 space-y-2 text-left">
            {ranked.map((p, i) => (
              <li key={p.name + i} className={cn('flex items-center justify-between rounded-xl border px-4 py-3', i === 0 ? 'border-warning/50 bg-warning/5' : 'border-border')}>
                <span className="font-semibold">
                  {i + 1}. {p.name}
                </span>
                <span className="text-sm">
                  <b>{p.score}</b> คะแนน · ถูก {p.correct}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-center gap-2">
            <button className="btn-primary" onClick={start}>
              <RotateCcw className="h-4 w-4" /> เล่นอีกครั้ง
            </button>
            <Link to="/games" className="btn-secondary">
              กลับ Game Center
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progressText = def.id === 'word-matching' ? `กระดาน ${qi + 1}/${questions.length}` : `ข้อ ${qi + 1}/${questions.length}`;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/games" className="btn-ghost btn-sm -ml-2">
          <ArrowLeft className="h-4 w-4" /> ออก
        </Link>
        <div className="text-sm text-muted">{progressText}</div>
      </div>

      {/* Scoreboard */}
      <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto">
        {players.map((p, i) => (
          <div key={i} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm', i === turnPlayer ? 'border-lavender bg-lavender-soft' : 'border-border bg-surface')}>
            <div className="font-semibold">{p.name}</div>
            <div className="text-xs text-muted">
              {p.score} คะแนน{p.streak > 1 ? ` · 🔥${p.streak}` : ''}
            </div>
          </div>
        ))}
      </div>

      {boss && (
        <div className="card mb-3 p-3">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <Skull className="h-4 w-4" /> บอสไวยากรณ์ {boss.hp}/{boss.maxHp}
            </span>
            <span className="flex items-center gap-0.5 text-danger">
              {Array.from({ length: boss.teamLives }, (_, i) => (
                <Heart key={i} className="h-4 w-4 fill-current" />
              ))}
            </span>
          </div>
          <ProgressBar value={boss.hp / boss.maxHp} tone="warning" label="พลังชีวิตบอส" />
        </div>
      )}

      <div className="card card-pad">
        {phase === 'handoff' ? (
          <div className="py-10 text-center">
            <div className="text-sm text-muted">ส่งเครื่องให้</div>
            <div className="my-2 text-3xl font-bold">{players[turnPlayer]?.name}</div>
            <button
              className="btn-primary mt-4"
              onClick={() => {
                setCount(qi === 0 ? 3 : 0);
                setPhase(qi === 0 ? 'countdown' : 'question');
                setStartAt(Date.now());
              }}
            >
              พร้อมแล้ว
            </button>
          </div>
        ) : phase === 'countdown' ? (
          <div className="grid h-48 place-items-center text-6xl font-bold text-lavender">{count || 'เริ่ม!'}</div>
        ) : current ? (
          <>
            {current.kind !== 'match' && (
              <div className="mb-4 flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted" />
                <ProgressBar value={remaining / limitMs} tone={remaining < 3000 ? 'warning' : 'sky'} label="เวลาที่เหลือ" />
              </div>
            )}
            {current.kind === 'match' ? (
              phase === 'question' ? (
                <MatchBoardView
                  board={current}
                  onDone={(pairs, mistakes) => {
                    const secs = (Date.now() - startAt) / 1000;
                    const pts = Math.max(0, pairs * 50 - mistakes * 20 + Math.max(0, Math.round(def.secondsPerQuestion - secs)) * 5);
                    answer(null, mistakes === 0, pts);
                  }}
                />
              ) : (
                <div className="py-6 text-center text-lg font-semibold">ครบทุกคู่แล้ว! +{lastPoints} คะแนน</div>
              )
            ) : (
              <GameQuestionView q={current} onAnswer={(g, c) => answer(g, c)} disabled={phase !== 'question'} reveal={phase === 'feedback' ? lastGiven ?? -1 : null} />
            )}
            {phase === 'feedback' && (
              <div className={cn('mt-4 rounded-xl p-3 text-center animate-fade-up', lastCorrect ? 'bg-success/10' : 'bg-danger/10')} role="status">
                <div className="font-semibold">{lastCorrect ? `ถูกต้อง! +${lastPoints}` : lastGiven === null && current.kind !== 'match' ? 'หมดเวลา' : current.kind === 'match' ? `+${lastPoints}` : 'ยังไม่ถูก'}</div>
                {!lastCorrect && current.kind !== 'match' && (
                  <div className="text-sm">
                    คำตอบ: <span lang="ko" className="ko font-semibold">{grade(current, 0).expected}</span>
                  </div>
                )}
                <button className="btn-primary mt-3" onClick={next} autoFocus>
                  {qi + 1 >= questions.length ? 'ดูผล' : 'ต่อไป'}
                </button>
              </div>
            )}
          </>
        ) : (
          <Notice>ไม่มีคำถาม</Notice>
        )}
      </div>
    </div>
  );
}
