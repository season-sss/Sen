import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Copy, Crown, LogOut, Play, RefreshCw, UserPlus, Users, Wifi, WifiOff, Check, X, Heart, Skull, Trophy, Globe, Lock, Send } from 'lucide-react';
import { PageHeader, Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Notice } from '@/components/ui/States';
import { Segmented, Switch } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { toast } from '@/components/ui/Toast';
import { GameQuestionView } from '@/components/games/GameQuestionView';
import { backendConfigured } from '@/lib/backend/client';
import { useAuth } from '@/lib/backend/auth';
import {
  advanceQuestion,
  createRoom,
  fetchQuestion,
  fetchRoom,
  heartbeat,
  inviteFriend,
  joinRoom,
  leaveRoom,
  listFriends,
  listInvites,
  listPublicRooms,
  measureClockOffset,
  myFriendCode,
  payloadToQuestion,
  rematch,
  respondFriendRequest,
  sendFriendRequest,
  setReady,
  startGame,
  submitAnswer,
  subscribeRoom,
  type AnswerResult,
  type FriendRow,
  type QuestionPayload,
  type Room,
  type RoomPlayer,
} from '@/lib/backend/multiplayer';
import { GAMES, GAME_BY_ID, type GameId } from '@/lib/games';
import { useGameHistory } from '@/store/history';
import { cn } from '@/lib/cn';

const ONLINE_GAMES = GAMES.filter((g) => g.online);

function Home({ onEnter }: { onEnter: (roomId: string) => void }) {
  const user = useAuth((s) => s.user)!;
  const [game, setGame] = useState<GameId>('vocab-race');
  const [level, setLevel] = useState<'A1' | 'A2' | 'B1' | 'B2'>('A1');
  const [isPublic, setIsPublic] = useState(false);
  const [max, setMax] = useState(8);
  const [questions, setQuestions] = useState(10);
  const [seconds, setSeconds] = useState(15);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [invites, setInvites] = useState<{ room: Room; from: string }[]>([]);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [r, f, i, c] = await Promise.all([listPublicRooms(), listFriends(user.id), listInvites(user.id), myFriendCode(user.id)]);
      setRooms(r);
      setFriends(f);
      setInvites(i);
      setMyCode(c);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [user.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (fn: () => Promise<Room>) => {
    setBusy(true);
    try {
      const r = await fn();
      onEnter(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="card-pad space-y-4">
        <CardHeader title="สร้างห้อง" subtitle="ผู้เล่น 2–8 คน · ระบบตรวจคำตอบและให้คะแนนฝั่งเซิร์ฟเวอร์" />
        <div>
          <label className="label" htmlFor="og-game">
            เกม
          </label>
          <select id="og-game" className="input" value={game} onChange={(e) => setGame(e.target.value as GameId)}>
            {ONLINE_GAMES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">ระดับ</div>
          <Segmented value={level} onChange={setLevel} options={(['A1', 'A2', 'B1', 'B2'] as const).map((l) => ({ id: l, label: l }))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="label">ผู้เล่นสูงสุด</span>
            <input type="number" min={2} max={8} className="input" value={max} onChange={(e) => setMax(Math.max(2, Math.min(8, Number(e.target.value))))} />
          </label>
          <label className="text-sm">
            <span className="label">จำนวนข้อ</span>
            <input type="number" min={3} max={30} className="input" value={questions} onChange={(e) => setQuestions(Math.max(3, Math.min(30, Number(e.target.value))))} />
          </label>
          <label className="text-sm">
            <span className="label">วินาที/ข้อ</span>
            <input type="number" min={5} max={60} className="input" value={seconds} onChange={(e) => setSeconds(Math.max(5, Math.min(60, Number(e.target.value))))} />
          </label>
        </div>
        <Switch checked={isPublic} onChange={setIsPublic} label={isPublic ? 'ห้องสาธารณะ (แสดงในรายการ)' : 'ห้องส่วนตัว (เข้าด้วยรหัสหรือคำเชิญ)'} />
        <button className="btn-primary w-full" disabled={busy} onClick={() => act(() => createRoom(game, level, isPublic, max, questions, seconds))}>
          สร้างห้อง
        </button>
      </Card>

      <div className="space-y-4">
        <Card className="card-pad">
          <CardHeader title="เข้าห้องด้วยรหัส" />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) void act(() => joinRoom(code.trim()));
            }}
          >
            <input className="input font-mono uppercase tracking-widest" maxLength={6} placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="รหัสห้อง" />
            <button className="btn-primary" disabled={busy || code.trim().length < 6}>
              เข้าห้อง
            </button>
          </form>
        </Card>

        {invites.length > 0 && (
          <Card className="card-pad">
            <CardHeader title="คำเชิญ" />
            <ul className="space-y-2">
              {invites.map((i) => (
                <li key={i.room.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                  <span>
                    {i.from} เชิญเล่น <b>{GAME_BY_ID[i.room.game_id as GameId]?.name}</b>
                  </span>
                  <button className="btn-primary btn-sm" onClick={() => act(() => joinRoom(i.room.code))}>
                    เข้าร่วม
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="card-pad">
          <CardHeader
            title="ห้องสาธารณะ"
            action={
              <button className="btn-ghost btn-sm" onClick={() => void refresh()} aria-label="รีเฟรช">
                <RefreshCw className="h-4 w-4" />
              </button>
            }
          />
          {rooms.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีห้องสาธารณะที่รอผู้เล่น</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                  <span>
                    {GAME_BY_ID[r.game_id as GameId]?.name} · {r.level}
                  </span>
                  <button className="btn-secondary btn-sm" onClick={() => act(() => joinRoom(r.code))}>
                    เข้าร่วม
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="card-pad">
          <CardHeader title="เพื่อน" subtitle={myCode ? `รหัสเพื่อนของคุณ: ${myCode}` : undefined} icon={<Users className="h-5 w-5" />} />
          <form
            className="mb-3 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await sendFriendRequest(friendCode);
                toast.success('ส่งคำขอเป็นเพื่อนแล้ว');
                setFriendCode('');
                void refresh();
              } catch (err) {
                toast.error((err as Error).message);
              }
            }}
          >
            <input className="input font-mono uppercase" placeholder="รหัสเพื่อน" value={friendCode} onChange={(e) => setFriendCode(e.target.value.toUpperCase())} aria-label="รหัสเพื่อน" />
            <button className="btn-secondary" disabled={!friendCode.trim()}>
              <UserPlus className="h-4 w-4" />
            </button>
          </form>
          {friends.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีเพื่อน — แลกรหัสเพื่อนกันเพื่อเชิญเข้าห้อง</p>
          ) : (
            <ul className="space-y-1.5">
              {friends.map((f) => (
                <li key={f.userId} className="flex items-center justify-between gap-2 text-sm">
                  <span>{f.name}</span>
                  {f.status === 'accepted' ? (
                    <Badge tone="success">เพื่อน</Badge>
                  ) : f.incoming ? (
                    <span className="flex gap-1">
                      <button className="btn-secondary btn-sm" onClick={() => respondFriendRequest(f.userId, true).then(refresh)}>
                        <Check className="h-3.5 w-3.5" /> รับ
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => respondFriendRequest(f.userId, false).then(refresh)} aria-label="ปฏิเสธ">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <Badge>รอการตอบรับ</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function RoomView({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
  const user = useAuth((s) => s.user)!;
  const myName = useAuth((s) => s.displayName) ?? user.email ?? 'ฉัน';
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState<{ idx: number; payload: QuestionPayload } | null>(null);
  const [result, setResult] = useState<{ idx: number; given: unknown; res: AnswerResult } | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const saved = useRef(false);
  const advancing = useRef(-1);
  const addResult = useGameHistory((s) => s.add);

  const load = useCallback(async () => {
    try {
      const s = await fetchRoom(roomId);
      if (!s.room) {
        setError('ห้องนี้ไม่มีแล้ว');
        return;
      }
      setRoom(s.room);
      setPlayers(s.players);
      if (s.room.status === 'playing' && s.room.current_index >= 0) {
        setQuestion((q) => (q?.idx === s.room!.current_index ? q : null));
        const p = await fetchQuestion(roomId, s.room.current_index);
        if (p) setQuestion({ idx: s.room.current_index, payload: p });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
    void measureClockOffset().then(setOffset).catch(() => setOffset(0));
    const unsub = subscribeRoom(roomId, { id: user.id, name: myName }, () => void load(), setOnline);
    const hb = setInterval(() => void heartbeat(roomId).catch(() => {}), 15000);
    void listFriends(user.id).then(setFriends).catch(() => {});
    return () => {
      unsub();
      clearInterval(hb);
    };
  }, [roomId, user.id, myName, load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const serverNow = now + offset;
  const startedAt = room?.question_started_at ? new Date(room.question_started_at).getTime() : 0;
  const limitMs = (room?.seconds_per_question ?? 15) * 1000;
  const countdown = startedAt > serverNow ? Math.ceil((startedAt - serverNow) / 1000) : 0;
  const remaining = Math.max(0, startedAt + limitMs - serverNow);
  const isHost = room?.host_id === user.id;
  const answeredMine = result?.idx === room?.current_index;

  // Advance: host after everyone answered or timer ended; anyone after timer + 3 s (host disconnected).
  useEffect(() => {
    if (!room || room.status !== 'playing' || advancing.current === room.current_index || countdown > 0) return;
    const elapsedOver = serverNow > startedAt + limitMs;
    const hostCan = isHost && elapsedOver;
    const anyoneCan = serverNow > startedAt + limitMs + 3500;
    if (hostCan || anyoneCan) {
      advancing.current = room.current_index;
      setTimeout(() => void advanceQuestion(roomId).catch(() => (advancing.current = -1)), isHost ? 1500 : 0);
    }
  }, [room, serverNow, startedAt, limitMs, isHost, countdown, roomId]);

  useEffect(() => {
    if (room?.status === 'finished' && !saved.current) {
      saved.current = true;
      addResult({
        gameId: room.game_id as GameId,
        mode: 'online',
        level: room.level,
        players: players.map((p) => ({ name: p.display_name, score: p.score, correct: p.correct })),
        won: room.game_id === 'boss-battle' ? (room.boss_hp ?? 1) <= 0 : undefined,
      });
    }
    if (room?.status === 'lobby') saved.current = false;
  }, [room, players, addResult]);

  if (error) return <ErrorState message={error} action={<button className="btn-primary" onClick={onLeave}>กลับ</button>} />;
  if (!room) return <p className="text-sm text-muted">กำลังโหลดห้อง…</p>;

  const def = GAME_BY_ID[room.game_id as GameId];
  const me = players.find((p) => p.user_id === user.id);
  const ranked = [...players].sort((a, b) => b.score - a.score);
  const allReady = players.length >= 2 && players.every((p) => p.ready || p.user_id === room.host_id);
  const link = `${location.origin}/games/online?code=${room.code}`;

  const leave = async () => {
    await leaveRoom(roomId).catch(() => {});
    onLeave();
  };

  const Scoreboard = (
    <ul className="space-y-1.5">
      {ranked.map((p, i) => (
        <li key={p.user_id} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm', p.user_id === user.id ? 'border-lavender bg-lavender-soft/50' : 'border-border')}>
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', online.has(p.user_id) ? 'bg-success' : 'bg-border')} title={online.has(p.user_id) ? 'ออนไลน์' : 'ขาดการเชื่อมต่อ'} />
            {room.status !== 'lobby' && <span className="text-muted">{i + 1}.</span>}
            <span className="truncate">{p.display_name}</span>
            {p.user_id === room.host_id && <Crown className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="เจ้าของห้อง" />}
          </span>
          {room.status === 'lobby' ? (
            <Badge tone={p.ready || p.user_id === room.host_id ? 'success' : 'neutral'}>{p.ready || p.user_id === room.host_id ? 'พร้อม' : 'ยังไม่พร้อม'}</Badge>
          ) : (
            <span className="tabular-nums">
              <b>{p.score}</b> <span className="text-xs text-muted">({p.correct} ถูก)</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <Card className="card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">
                {def?.name} · {room.level}
              </div>
              <div className="text-xs text-muted">
                {room.is_public ? <Globe className="mr-1 inline h-3 w-3" /> : <Lock className="mr-1 inline h-3 w-3" />}
                {room.is_public ? 'ห้องสาธารณะ' : 'ห้องส่วนตัว'} · {players.length}/{room.max_players} คน · {room.total_questions} ข้อ · {room.seconds_per_question} วินาที/ข้อ
              </div>
            </div>
            <button className="btn-ghost btn-sm" onClick={leave}>
              <LogOut className="h-4 w-4" /> ออกจากห้อง
            </button>
          </div>
        </Card>

        {room.status === 'lobby' && (
          <Card className="card-pad text-center">
            <div className="text-sm text-muted">รหัสห้อง</div>
            <div className="my-2 font-mono text-4xl font-bold tracking-[0.3em]">{room.code}</div>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success('คัดลอกลิงก์เชิญแล้ว'))}>
                <Copy className="h-4 w-4" /> คัดลอกลิงก์เชิญ
              </button>
              {me && me.user_id !== room.host_id && (
                <button className={me.ready ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={() => setReady(roomId, !me.ready).catch((e) => toast.error(e.message))}>
                  {me.ready ? 'ยกเลิกพร้อม' : 'ฉันพร้อมแล้ว'}
                </button>
              )}
              {isHost && (
                <button className="btn-primary btn-sm" disabled={!allReady} onClick={() => startGame(roomId).catch((e) => toast.error(e.message))}>
                  <Play className="h-4 w-4" /> เริ่มเกม
                </button>
              )}
            </div>
            {isHost && !allReady && <p className="mt-2 text-xs text-muted">ต้องมีผู้เล่นอย่างน้อย 2 คน และทุกคนกด "พร้อม"</p>}
            {friends.filter((f) => f.status === 'accepted').length > 0 && (
              <div className="mt-4 border-t border-border pt-3 text-left">
                <div className="mb-2 text-sm font-semibold">เชิญเพื่อน</div>
                <div className="flex flex-wrap gap-1.5">
                  {friends
                    .filter((f) => f.status === 'accepted' && !players.some((p) => p.user_id === f.userId))
                    .map((f) => (
                      <button key={f.userId} className="chip" onClick={() => inviteFriend(roomId, f.userId).then(() => toast.success(`เชิญ ${f.name} แล้ว`), (e) => toast.error(e.message))}>
                        <Send className="h-3 w-3" /> {f.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {room.status === 'playing' && (
          <Card className="card-pad">
            {room.game_id === 'boss-battle' && room.boss_max_hp && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="flex items-center gap-1 font-semibold">
                    <Skull className="h-4 w-4" /> บอส {room.boss_hp}/{room.boss_max_hp}
                  </span>
                  <span className="flex text-danger">
                    {Array.from({ length: Math.max(0, room.team_lives ?? 0) }, (_, i) => (
                      <Heart key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </span>
                </div>
                <ProgressBar value={(room.boss_hp ?? 0) / room.boss_max_hp} tone="warning" label="พลังชีวิตบอส" />
              </div>
            )}
            <div className="mb-3 flex items-center justify-between text-sm text-muted">
              <span>
                ข้อ {room.current_index + 1}/{room.total_questions}
              </span>
              {countdown === 0 && <span className="tabular-nums">{Math.ceil(remaining / 1000)} วินาที</span>}
            </div>
            {countdown > 0 ? (
              <div className="grid h-48 place-items-center text-6xl font-bold text-lavender" aria-live="assertive">
                {countdown}
              </div>
            ) : question && question.idx === room.current_index ? (
              <>
                <ProgressBar value={remaining / limitMs} tone={remaining < 3000 ? 'warning' : 'sky'} className="mb-4" label="เวลาที่เหลือ" />
                <GameQuestionView
                  q={(() => {
                    const q = payloadToQuestion(`${room.id}-${question.idx}`, question.payload);
                    if (answeredMine && q.kind === 'mcq' && typeof result!.res.correct_answer === 'number') return { ...q, answer: result!.res.correct_answer };
                    return q;
                  })()}
                  disabled={answeredMine || remaining === 0}
                  reveal={answeredMine && question.payload.kind === 'mcq' ? (result!.given as number) : null}
                  onAnswer={async (given) => {
                    try {
                      const res = await submitAnswer(roomId, question.idx, given);
                      setResult({ idx: question.idx, given, res });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                />
                {answeredMine && (
                  <div className={cn('mt-4 rounded-xl p-3 text-center', result!.res.is_correct ? 'bg-success/10' : 'bg-danger/10')} role="status">
                    <div className="font-semibold">{result!.res.is_correct ? `ถูกต้อง! +${result!.res.points_awarded}` : 'ยังไม่ถูก'}</div>
                    {!result!.res.is_correct && question.payload.kind !== 'mcq' && (
                      <div className="text-sm">
                        คำตอบ:{' '}
                        <span lang="ko" className="ko font-semibold">
                          {Array.isArray(result!.res.correct_answer) ? (question.payload.kind === 'order' ? (result!.res.correct_answer as string[]).join(' ') : (result!.res.correct_answer as string[])[0]) : String(result!.res.correct_answer)}
                        </span>
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted">รอผู้เล่นคนอื่น…</div>
                  </div>
                )}
                {!answeredMine && remaining === 0 && <p className="mt-3 text-center text-sm text-muted">หมดเวลา — รอข้อถัดไป</p>}
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted">กำลังโหลดคำถาม…</p>
            )}
          </Card>
        )}

        {room.status === 'finished' && (
          <Card className="card-pad text-center">
            <Trophy className="mx-auto mb-2 h-10 w-10 text-warning" />
            <h2 className="h2">{room.game_id === 'boss-battle' ? ((room.boss_hp ?? 1) <= 0 ? 'ทีมชนะบอสแล้ว!' : 'บอสยังไม่ล้ม') : `${ranked[0]?.display_name} ชนะ!`}</h2>
            <p className="mt-1 text-sm text-muted">คะแนนคำนวณและตรวจสอบโดยเซิร์ฟเวอร์</p>
            <div className="mt-4 flex justify-center gap-2">
              {isHost ? (
                <button className="btn-primary" onClick={() => rematch(roomId).catch((e) => toast.error(e.message))}>
                  <RefreshCw className="h-4 w-4" /> Rematch
                </button>
              ) : (
                <p className="text-sm text-muted">รอเจ้าของห้องกด Rematch</p>
              )}
              <button className="btn-secondary" onClick={leave}>
                ออกจากห้อง
              </button>
            </div>
          </Card>
        )}
      </div>

      <Card className="card-pad h-fit">
        <CardHeader title={room.status === 'lobby' ? 'ผู้เล่นในห้อง' : 'Scoreboard'} subtitle="จุดสีเขียว = เชื่อมต่ออยู่" />
        {Scoreboard}
        <p className="mt-3 text-xs text-muted">หลุดการเชื่อมต่อ? เปิดหน้านี้อีกครั้งหรือใส่รหัสห้องเดิม ระบบจะพากลับเข้าห้องให้</p>
      </Card>
    </div>
  );
}

export default function OnlineGame() {
  const [params, setParams] = useSearchParams();
  const { user, configured, ready } = useAuth();
  const roomId = params.get('room');
  const joinCode = params.get('code');
  const [autoJoining, setAutoJoining] = useState(false);

  useEffect(() => {
    if (!user || !joinCode || roomId || autoJoining) return;
    setAutoJoining(true);
    joinRoom(joinCode)
      .then((r) => setParams({ room: r.id }))
      .catch((e) => {
        toast.error((e as Error).message);
        setParams({});
      })
      .finally(() => setAutoJoining(false));
  }, [user, joinCode, roomId, autoJoining, setParams]);

  return (
    <div>
      <Link to="/games" className="btn-ghost btn-sm -ml-2 mb-3">
        <ArrowLeft className="h-4 w-4" /> Game Center
      </Link>
      <PageHeader title="เล่นออนไลน์" subtitle="สร้างห้อง เชิญเพื่อน และแข่งแบบเรียลไทม์ — คำถาม เวลา และคะแนนควบคุมโดยเซิร์ฟเวอร์" />
      {!configured ? (
        <EmptyState
          icon={<WifiOff className="h-6 w-6" />}
          title="โหมดออนไลน์ยังไม่ได้ตั้งค่า"
          message="ต้องตั้งค่า Supabase (Auth + Database + Realtime) และรัน migration/seed ตาม docs/BACKEND_SETUP.md — ระหว่างนี้เล่นแบบคนเดียวหรือหลายคนบนเครื่องเดียวกันได้ใน Game Center"
          action={
            <Link to="/games" className="btn-primary">
              เล่นแบบออฟไลน์
            </Link>
          }
        />
      ) : !ready ? (
        <p className="text-sm text-muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
      ) : !user ? (
        <EmptyState
          icon={<Wifi className="h-6 w-6" />}
          title="เข้าสู่ระบบเพื่อเล่นออนไลน์"
          message="ใช้บัญชีเพื่อเข้าห้อง ส่งคำเชิญ และบันทึกผล"
          action={
            <Link to="/settings" className="btn-primary">
              เข้าสู่ระบบ / สมัคร
            </Link>
          }
        />
      ) : roomId ? (
        <RoomView roomId={roomId} onLeave={() => setParams({})} />
      ) : (
        <>
          {autoJoining && <Notice className="mb-4">กำลังเข้าห้อง {joinCode}…</Notice>}
          <Home onEnter={(id) => setParams({ room: id })} />
        </>
      )}
      {backendConfigured && <p className="mt-6 text-xs text-muted">ไม่มีผู้เล่นจำลอง — ทุกคนในห้องคือบัญชีผู้ใช้จริงที่เชื่อมต่อผ่านเซิร์ฟเวอร์</p>}
    </div>
  );
}
