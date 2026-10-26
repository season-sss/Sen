/**
 * Online multiplayer via Supabase (Postgres RPC + Realtime).
 * The server owns all game state: question selection, timing, answer checking and scoring
 * (see supabase/migrations). Clients only call RPCs and listen for row changes.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';
import type { McqQuestion, OrderQuestion, TextQuestion } from '@/lib/quiz/types';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  game_id: string;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  is_public: boolean;
  max_players: number;
  status: 'lobby' | 'playing' | 'finished';
  current_index: number;
  question_started_at: string | null;
  seconds_per_question: number;
  total_questions: number;
  boss_hp: number | null;
  boss_max_hp: number | null;
  team_lives: number | null;
}

export interface RoomPlayer {
  room_id: string;
  user_id: string;
  display_name: string;
  ready: boolean;
  score: number;
  correct: number;
  streak: number;
  joined_at: string;
  last_seen: string;
}

export interface QuestionPayload {
  kind: 'mcq' | 'text' | 'order';
  prompt: string;
  promptTh: string | null;
  audio: string | null;
  section: McqQuestion['section'];
  level: McqQuestion['level'];
  options?: string[];
  tokens?: string[];
  hint?: string | null;
}

export interface AnswerResult {
  is_correct: boolean;
  points_awarded: number;
  correct_answer: unknown;
}

function db() {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Backend');
  return supabase;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const createRoom = (game: string, level: string, isPublic: boolean, maxPlayers: number, questions: number, seconds: number) =>
  rpc<Room>('create_room', { p_game: game, p_level: level, p_public: isPublic, p_max: maxPlayers, p_questions: questions, p_seconds: seconds });
export const joinRoom = (code: string) => rpc<Room>('join_room', { p_code: code });
export const setReady = (room: string, ready: boolean) => rpc<void>('set_ready', { p_room: room, p_ready: ready });
export const startGame = (room: string) => rpc<void>('start_game', { p_room: room });
export const advanceQuestion = (room: string) => rpc<void>('advance_question', { p_room: room });
export const leaveRoom = (room: string) => rpc<void>('leave_room', { p_room: room });
export const rematch = (room: string) => rpc<void>('rematch', { p_room: room });
export const heartbeat = (room: string) => rpc<void>('heartbeat', { p_room: room });
export const inviteFriend = (room: string, friend: string) => rpc<void>('invite_friend', { p_room: room, p_friend: friend });
export const sendFriendRequest = (code: string) => rpc<string>('send_friend_request', { p_code: code });
export const respondFriendRequest = (requester: string, accept: boolean) => rpc<void>('respond_friend_request', { p_requester: requester, p_accept: accept });

export async function submitAnswer(room: string, idx: number, given: unknown): Promise<AnswerResult> {
  const rows = await rpc<AnswerResult[]>('submit_answer', { p_room: room, p_idx: idx, p_given: given });
  return rows[0];
}

/** Server clock offset (ms) so countdowns are synchronized across devices. */
export async function measureClockOffset(): Promise<number> {
  const t0 = Date.now();
  const server = await rpc<string>('server_now');
  const t1 = Date.now();
  return new Date(server).getTime() - (t0 + t1) / 2;
}

export async function fetchRoom(roomId: string) {
  const c = db();
  const [{ data: room, error: e1 }, { data: players, error: e2 }] = await Promise.all([
    c.from('game_rooms').select('*').eq('id', roomId).maybeSingle(),
    c.from('room_players').select('*').eq('room_id', roomId).order('joined_at'),
  ]);
  if (e1 || e2) throw new Error((e1 ?? e2)!.message);
  return { room: room as Room | null, players: (players ?? []) as RoomPlayer[] };
}

export async function fetchQuestion(roomId: string, idx: number): Promise<QuestionPayload | null> {
  const { data, error } = await db().from('room_questions').select('payload').eq('room_id', roomId).eq('idx', idx).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as QuestionPayload) ?? null;
}

export async function listPublicRooms(): Promise<Room[]> {
  const { data, error } = await db().from('game_rooms').select('*').eq('is_public', true).eq('status', 'lobby').order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as Room[];
}

export interface FriendRow {
  userId: string;
  name: string;
  status: 'pending' | 'accepted';
  incoming: boolean;
}

export async function listFriends(me: string): Promise<FriendRow[]> {
  const c = db();
  const { data, error } = await c.from('friendships').select('requester, addressee, status');
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = rows.map((r) => (r.requester === me ? r.addressee : r.requester));
  if (!ids.length) return [];
  const { data: profiles } = await c.from('profiles').select('id, display_name').in('id', ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string]));
  return rows.map((r) => {
    const other = (r.requester === me ? r.addressee : r.requester) as string;
    return { userId: other, name: names.get(other) ?? '—', status: r.status as FriendRow['status'], incoming: r.addressee === me };
  });
}

export async function myFriendCode(me: string): Promise<string | null> {
  const { data } = await db().from('profiles').select('friend_code').eq('id', me).maybeSingle();
  return (data?.friend_code as string) ?? null;
}

export async function listInvites(me: string): Promise<{ room: Room; from: string }[]> {
  const c = db();
  const { data } = await c.from('room_invites').select('room_id, from_user').eq('to_user', me);
  if (!data?.length) return [];
  const { data: rooms } = await c.from('game_rooms').select('*').in('id', data.map((d) => d.room_id)).eq('status', 'lobby');
  const { data: profiles } = await c.from('profiles').select('id, display_name').in('id', data.map((d) => d.from_user));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  return (rooms ?? []).map((r) => ({ room: r as Room, from: (names.get(data.find((d) => d.room_id === r.id)!.from_user) as string) ?? '—' }));
}

/** Subscribe to live changes of a room; returns an unsubscribe function. Presence reports who is connected. */
export function subscribeRoom(roomId: string, me: { id: string; name: string }, onChange: () => void, onPresence: (online: Set<string>) => void): () => void {
  const c = db();
  const channel: RealtimeChannel = c
    .channel(`room:${roomId}`, { config: { presence: { key: me.id } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${roomId}` }, onChange)
    .on('presence', { event: 'sync' }, () => onPresence(new Set(Object.keys(channel.presenceState()))))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ name: me.name, at: Date.now() });
    });
  return () => {
    void c.removeChannel(channel);
  };
}

/** Convert a server payload into a question object the game UI can render (answer unknown client-side). */
export function payloadToQuestion(id: string, p: QuestionPayload): McqQuestion | TextQuestion | OrderQuestion {
  const base = { id, section: p.section, level: p.level, prompt: p.prompt, promptTh: p.promptTh ?? undefined, audio: p.audio ?? undefined };
  if (p.kind === 'mcq') return { ...base, kind: 'mcq', options: p.options ?? [], answer: -1 };
  if (p.kind === 'text') return { ...base, kind: 'text', answers: [], hint: p.hint ?? undefined };
  return { ...base, kind: 'order', tokens: p.tokens ?? [] };
}
