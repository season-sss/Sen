import type { Level, VocabEntry } from '@/data/types';
import { VOCABULARY, uniquePredicates } from '@/data/vocabulary';
import { GRAMMAR } from '@/data/grammar';
import { STRUCTURE_LESSONS } from '@/data/foundations';
import { conjugationQuestions, grammarExerciseQuestions, particleQuestions, vocabQuestion } from '@/lib/quiz/generators';
import type { McqQuestion, OrderQuestion, TextQuestion } from '@/lib/quiz/types';
import { createRng, sample, shuffle, type Rng } from '@/lib/util/random';

export type GameId =
  | 'vocab-race'
  | 'grammar-battle'
  | 'sentence-builder'
  | 'translation-duel'
  | 'word-matching'
  | 'listening'
  | 'spelling'
  | 'conjugation'
  | 'quiz-show'
  | 'boss-battle';

export interface GameDef {
  id: GameId;
  name: string;
  nameKo: string;
  description: string;
  icon: string;
  rounds: number;
  secondsPerQuestion: number;
  requiresTts?: boolean;
  coop?: boolean;
  /** Can be played online (server holds answers and validates scores) */
  online: boolean;
}

export const GAMES: GameDef[] = [
  { id: 'vocab-race', name: 'Vocabulary Race', nameKo: '단어 레이스', description: 'แข่งตอบความหมายคำศัพท์ให้เร็วที่สุด', icon: 'Zap', rounds: 10, secondsPerQuestion: 10, online: true },
  { id: 'grammar-battle', name: 'Grammar Battle', nameKo: '문법 배틀', description: 'แข่งเลือกคำตอบไวยากรณ์และคำช่วยที่ถูกต้อง', icon: 'Swords', rounds: 10, secondsPerQuestion: 15, online: true },
  { id: 'sentence-builder', name: 'Sentence Builder', nameKo: '문장 만들기', description: 'แข่งเรียงคำเป็นประโยคภาษาเกาหลี', icon: 'Blocks', rounds: 8, secondsPerQuestion: 25, online: true },
  { id: 'translation-duel', name: 'Translation Duel', nameKo: '번역 대결', description: 'แข่งแปลไทย ↔ เกาหลี จากประโยคจริง', icon: 'Languages', rounds: 8, secondsPerQuestion: 20, online: true },
  { id: 'word-matching', name: 'Word Matching', nameKo: '짝 맞추기', description: 'จับคู่คำศัพท์กับความหมายให้ครบเร็วที่สุด', icon: 'Shapes', rounds: 3, secondsPerQuestion: 60, online: false },
  { id: 'listening', name: 'Listening Challenge', nameKo: '듣기 챌린지', description: 'ฟังเสียงแล้วตอบคำถาม (ต้องมีเสียงภาษาเกาหลีในอุปกรณ์)', icon: 'Headphones', rounds: 10, secondsPerQuestion: 15, requiresTts: true, online: false },
  { id: 'spelling', name: 'Spelling Challenge', nameKo: '받아쓰기', description: 'แข่งสะกดคำเกาหลีให้ถูกต้องจากความหมาย', icon: 'Keyboard', rounds: 10, secondsPerQuestion: 20, online: true },
  { id: 'conjugation', name: 'Conjugation Challenge', nameKo: '활용 챌린지', description: 'แข่งผันคำกริยาและคำคุณศัพท์ ตรวจด้วย Conjugation Engine', icon: 'Wand2', rounds: 10, secondsPerQuestion: 20, online: true },
  { id: 'quiz-show', name: 'Korean Quiz Show', nameKo: '퀴즈쇼', description: 'ตอบคำถามหลายหมวดหลายรอบ', icon: 'Trophy', rounds: 15, secondsPerQuestion: 15, online: true },
  { id: 'boss-battle', name: 'Boss Battle', nameKo: '보스 배틀', description: 'ร่วมมือกันตอบคำถามเพื่อโค่นบอส', icon: 'Skull', rounds: 15, secondsPerQuestion: 15, coop: true, online: true },
];

export const GAME_BY_ID: Record<GameId, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g])) as Record<GameId, GameDef>;

export interface MatchBoard {
  id: string;
  kind: 'match';
  pairs: { id: string; ko: string; th: string }[];
}

export type GameQuestion = McqQuestion | TextQuestion | OrderQuestion | MatchBoard;

const LEVEL_ORDER: Level[] = ['A1', 'A2', 'B1', 'B2'];

function allowedLevels(maxLevel: Level): Level[] {
  if (maxLevel === 'ADV') return LEVEL_ORDER;
  const i = LEVEL_ORDER.indexOf(maxLevel);
  return LEVEL_ORDER.slice(0, i < 0 ? 1 : i + 1);
}

function vocabPool(maxLevel: Level): VocabEntry[] {
  const allowed = allowedLevels(maxLevel);
  return VOCABULARY.filter((v) => allowed.includes(v.level));
}

function translationQuestion(entry: VocabEntry, rng: Rng, pool: VocabEntry[], dir: 'ko-th' | 'th-ko'): McqQuestion {
  const seen = new Set([entry.ex, entry.exTh]);
  const others = sample(pool, 40, rng)
    .filter((v) => (seen.has(v.ex) || seen.has(v.exTh) ? false : (seen.add(v.ex), seen.add(v.exTh), true)))
    .slice(0, 3);
  if (dir === 'ko-th') {
    const options = shuffle([entry.exTh, ...others.map((o) => o.exTh)], rng);
    return { id: `tr-${dir}-${entry.id}`, kind: 'mcq', section: 'reading', level: entry.level, prompt: entry.ex, promptTh: 'เลือกคำแปลภาษาไทยที่ถูกต้อง', options, answer: options.indexOf(entry.exTh), ref: { type: 'vocab', id: entry.id } };
  }
  const options = shuffle([entry.ex, ...others.map((o) => o.ex)], rng);
  return { id: `tr-${dir}-${entry.id}`, kind: 'mcq', section: 'reading', level: entry.level, prompt: entry.exTh, promptTh: 'เลือกประโยคภาษาเกาหลีที่ตรงกับคำแปล', options, answer: options.indexOf(entry.ex), ref: { type: 'vocab', id: entry.id } };
}

function grammarPool(maxLevel: Level): McqQuestion[] {
  const allowed = allowedLevels(maxLevel);
  return GRAMMAR.filter((g) => allowed.includes(g.level)).flatMap((g) => grammarExerciseQuestions(g).filter((q): q is McqQuestion => q.kind === 'mcq'));
}

function orderPool(maxLevel: Level, rng: Rng): OrderQuestion[] {
  const allowed = allowedLevels(maxLevel);
  const fromGrammar = GRAMMAR.filter((g) => allowed.includes(g.level)).flatMap((g) => grammarExerciseQuestions(g).filter((q): q is OrderQuestion => q.kind === 'order'));
  const fromStructure = STRUCTURE_LESSONS.flatMap((s) => s.build.map((b, i) => ({ id: `st-${s.id}-${i}`, kind: 'order' as const, section: 'ordering' as const, level: 'A1' as Level, prompt: b.th, tokens: b.tokens })));
  const fromVocab = vocabPool(maxLevel)
    .filter((v) => {
      const n = v.ex.split(' ').length;
      return n >= 3 && n <= 6;
    })
    .map((v) => vocabQuestion(v, 'sentence', rng) as OrderQuestion);
  return [...fromGrammar, ...fromStructure, ...fromVocab];
}

export interface GenerateOptions {
  maxLevel?: Level;
  count?: number;
  seed?: number;
}

export function generateGameQuestions(id: GameId, opts: GenerateOptions = {}): GameQuestion[] {
  const def = GAME_BY_ID[id];
  const maxLevel = opts.maxLevel ?? 'A1';
  const count = opts.count ?? def.rounds;
  const rng = createRng(opts.seed ?? 1);
  const pool = vocabPool(maxLevel);

  switch (id) {
    case 'vocab-race':
      return sample(pool.filter((v) => !v.ko.includes(' ')), count, rng).map((v, i) => vocabQuestion(v, i % 2 ? 'th-ko' : 'ko-th', rng, pool) as McqQuestion);
    case 'grammar-battle':
      return sample([...grammarPool(maxLevel), ...particleQuestions(rng, 10)], count, rng);
    case 'sentence-builder':
      return sample(orderPool(maxLevel, rng), count, rng);
    case 'translation-duel':
      return sample(pool, count, rng).map((v, i) => translationQuestion(v, rng, pool, i % 2 ? 'th-ko' : 'ko-th'));
    case 'word-matching':
      return Array.from({ length: count }, (_, r) => ({
        id: `match-${r}`,
        kind: 'match' as const,
        pairs: sample(pool.filter((v) => !v.ko.includes(' ') && v.th.length < 28), 6, rng).map((v) => ({ id: v.id, ko: v.ko, th: v.th.split(' / ')[0] })),
      }));
    case 'listening':
      return sample(pool.filter((v) => !v.ko.includes(' ')), count, rng).map((v) => vocabQuestion(v, 'listen', rng, pool) as McqQuestion);
    case 'spelling':
      return sample(pool.filter((v) => /^[가-힣]{1,4}$/.test(v.ko) && v.pos !== 'verb' && v.pos !== 'adjective'), count, rng).map((v) => vocabQuestion(v, 'spell', rng) as TextQuestion);
    case 'conjugation': {
      const preds = uniquePredicates()
        .filter((v) => allowedLevels(maxLevel).includes(v.level))
        .map((v) => ({ ko: v.ko, pos: (v.pos === 'adjective' ? 'adjective' : 'verb') as 'verb' | 'adjective', irr: v.irr, th: v.th }));
      const keys = maxLevel === 'A1' ? ['present', 'past', 'future', 'request', 'want'] : ['present', 'past', 'future', 'request', 'if', 'modPresent', 'so', 'because'];
      return conjugationQuestions(sample(preds, count * 2, rng), keys, rng, count);
    }
    case 'quiz-show':
    case 'boss-battle': {
      const mixed: GameQuestion[] = [
        ...sample(pool.filter((v) => !v.ko.includes(' ')), 6, rng).map((v) => vocabQuestion(v, 'ko-th', rng, pool) as McqQuestion),
        ...sample(grammarPool(maxLevel), 5, rng),
        ...sample(pool, 4, rng).map((v) => translationQuestion(v, rng, pool, 'ko-th')),
      ];
      return shuffle(mixed, rng).slice(0, count);
    }
  }
}

// ---------------------------------------------------------------------------
// Scoring — mirrored server-side in supabase/migrations (function haneul_score)
// ---------------------------------------------------------------------------
export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;
export const STREAK_BONUS = 10;
export const MAX_STREAK_BONUS_STEPS = 5;

export function scoreAnswer(correct: boolean, elapsedMs: number, limitMs: number, streakBefore: number): number {
  if (!correct) return 0;
  const speed = Math.max(0, Math.min(1, 1 - elapsedMs / limitMs));
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * speed) + Math.min(streakBefore, MAX_STREAK_BONUS_STEPS) * STREAK_BONUS;
}

// ---------------------------------------------------------------------------
// Boss battle (co-op)
// ---------------------------------------------------------------------------
export interface BossState {
  hp: number;
  maxHp: number;
  teamLives: number;
  defeated: boolean;
  lost: boolean;
}

export function newBoss(players: number, rounds: number): BossState {
  // Requires roughly 70% accuracy across the team to win.
  const maxHp = Math.round(players * rounds * 0.7 * 15);
  return { hp: maxHp, maxHp, teamLives: 3 + Math.max(0, players - 1), defeated: false, lost: false };
}

export function bossHit(state: BossState, correct: boolean, points: number): BossState {
  if (state.defeated || state.lost) return state;
  if (correct) {
    const hp = Math.max(0, state.hp - Math.round(10 + points / 40));
    return { ...state, hp, defeated: hp === 0 };
  }
  const teamLives = state.teamLives - 1;
  return { ...state, teamLives, lost: teamLives <= 0 };
}
