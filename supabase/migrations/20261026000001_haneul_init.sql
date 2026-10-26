-- =============================================================================
-- HANEUL — Korean Learning Studio · initial schema
--   * profiles, cloud sync (user_data), friends
--   * multiplayer games: rooms, players, questions, answers, invites
--   * ALL game state changes go through SECURITY DEFINER functions:
--       - answers live in game_questions, which clients cannot read
--       - correctness, timing and points are computed on the server (anti-cheat)
--   * Row Level Security on every table
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'ผู้เล่น' check (char_length(display_name) between 1 and 30),
  friend_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Display names are visible to signed-in users (needed for lobbies, scoreboards, friends).
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'ผู้เล่น'), 30))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Cloud sync of local-first stores (one JSON document per store per user)
-- -----------------------------------------------------------------------------
create table public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key ~ '^haneul:[a-z]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key),
  constraint user_data_size check (pg_column_size(value) < 5 * 1024 * 1024)
);

alter table public.user_data enable row level security;

create policy "own data: select" on public.user_data for select to authenticated using (user_id = auth.uid());
create policy "own data: insert" on public.user_data for insert to authenticated with check (user_id = auth.uid());
create policy "own data: update" on public.user_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own data: delete" on public.user_data for delete to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Friends
-- -----------------------------------------------------------------------------
create table public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

alter table public.friendships enable row level security;

create policy "see own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));
create policy "remove own friendships" on public.friendships
  for delete to authenticated using (auth.uid() in (requester, addressee));
-- inserts/updates go through send_friend_request / respond_friend_request

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted' and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

create or replace function public.send_friend_request(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where friend_code = upper(trim(p_code));
  if target is null then raise exception 'ไม่พบรหัสเพื่อนนี้'; end if;
  if target = me then raise exception 'ไม่สามารถเพิ่มตัวเองเป็นเพื่อน'; end if;
  -- If they already asked us, accept instead of creating a second request.
  update public.friendships set status = 'accepted' where requester = target and addressee = me;
  if not found then
    insert into public.friendships (requester, addressee) values (me, target) on conflict do nothing;
  end if;
  return target;
end;
$$;

create or replace function public.respond_friend_request(p_requester uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_accept then
    update public.friendships set status = 'accepted' where requester = p_requester and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where requester = p_requester and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Game question bank — answers are server-only (no client policy)
-- -----------------------------------------------------------------------------
create table public.game_questions (
  id text primary key,
  game_id text not null,
  level text not null check (level in ('A1', 'A2', 'B1', 'B2')),
  kind text not null check (kind in ('mcq', 'text', 'order')),
  payload jsonb not null,   -- what clients may see (prompt, options, tokens shuffled, audio …)
  answer jsonb not null     -- mcq: index · text: ["accepted", …] · order: ["tok", …]
);
create index game_questions_pick on public.game_questions (game_id, level);

alter table public.game_questions enable row level security;
-- (intentionally no policies: clients can never select answers)

-- -----------------------------------------------------------------------------
-- Rooms
-- -----------------------------------------------------------------------------
create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (game_id in ('vocab-race', 'grammar-battle', 'sentence-builder', 'translation-duel', 'spelling', 'conjugation', 'quiz-show', 'boss-battle')),
  level text not null check (level in ('A1', 'A2', 'B1', 'B2')),
  is_public boolean not null default false,
  max_players int not null default 8 check (max_players between 2 and 8),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  current_index int not null default -1,
  question_started_at timestamptz,
  seconds_per_question int not null default 15 check (seconds_per_question between 5 and 60),
  total_questions int not null default 10 check (total_questions between 3 and 30),
  boss_hp int,
  boss_max_hp int,
  team_lives int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  ready boolean not null default false,
  score int not null default 0,
  correct int not null default 0,
  streak int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.room_questions (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  idx int not null,
  question_id text not null references public.game_questions (id),
  payload jsonb not null,
  primary key (room_id, idx)
);

create table public.room_answers (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  idx int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  given jsonb,
  correct boolean not null,
  points int not null,
  elapsed_ms int not null,
  answered_at timestamptz not null default now(),
  primary key (room_id, idx, user_id)
);

create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (room_id, to_user)
);

alter table public.game_rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_questions enable row level security;
alter table public.room_answers enable row level security;
alter table public.room_invites enable row level security;

create or replace function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_players where room_id = p_room and user_id = auth.uid());
$$;

create policy "rooms: members, invitees, or public lobbies" on public.game_rooms
  for select to authenticated using (
    public.is_room_member(game_rooms.id)
    or (is_public and status = 'lobby')
    or exists (select 1 from public.room_invites i where i.room_id = game_rooms.id and i.to_user = auth.uid())
  );

create policy "players: visible to room members" on public.room_players
  for select to authenticated using (public.is_room_member(room_id));

-- Members only see questions that have already been released (no peeking ahead).
create policy "questions: released ones, members only" on public.room_questions
  for select to authenticated using (
    public.is_room_member(room_id)
    and idx <= (select r.current_index from public.game_rooms r where r.id = room_id)
  );

-- Own answers any time; others' only after the question has closed.
create policy "answers: own, or others after the question" on public.room_answers
  for select to authenticated using (
    user_id = auth.uid()
    or (public.is_room_member(room_id) and idx < (select r.current_index from public.game_rooms r where r.id = room_id))
    or (public.is_room_member(room_id) and (select r.status from public.game_rooms r where r.id = room_id) = 'finished')
  );

create policy "invites: sender or recipient" on public.room_invites
  for select to authenticated using (auth.uid() in (from_user, to_user));

-- -----------------------------------------------------------------------------
-- Scoring & answer checking — mirrors src/lib/games/games.ts and src/lib/quiz/grading.ts
-- -----------------------------------------------------------------------------
create or replace function public.haneul_score(p_correct boolean, p_elapsed_ms int, p_limit_ms int, p_streak int) returns int
language sql immutable as $$
  select case when not p_correct then 0
    else 100
      + round(100 * greatest(0, least(1, 1 - p_elapsed_ms::numeric / nullif(p_limit_ms, 0))))::int
      + least(p_streak, 5) * 10
  end;
$$;

create or replace function public.haneul_normalize(p text) returns text
language sql immutable as $$
  select lower(trim(regexp_replace(regexp_replace(coalesce(p, ''), '[.!?。,，"''“”‘’]', '', 'g'), '\s+', ' ', 'g')));
$$;

create or replace function public.haneul_check(p_kind text, p_answer jsonb, p_given jsonb) returns boolean
language plpgsql immutable as $$
declare
  g text;
  a text;
begin
  if p_given is null or p_given = 'null'::jsonb then return false; end if;
  if p_kind = 'mcq' then
    return jsonb_typeof(p_given) = 'number' and p_given = p_answer;
  elsif p_kind = 'text' then
    if jsonb_typeof(p_given) <> 'string' then return false; end if;
    g := public.haneul_normalize(p_given #>> '{}');
    for a in select value from jsonb_array_elements_text(p_answer) loop
      if g = public.haneul_normalize(a) or replace(g, ' ', '') = replace(public.haneul_normalize(a), ' ', '') then
        return true;
      end if;
    end loop;
    return false;
  elsif p_kind = 'order' then
    if jsonb_typeof(p_given) <> 'array' then return false; end if;
    return public.haneul_normalize((select string_agg(value, ' ' order by ord) from jsonb_array_elements_text(p_given) with ordinality as t(value, ord)))
         = public.haneul_normalize((select string_agg(value, ' ' order by ord) from jsonb_array_elements_text(p_answer) with ordinality as t(value, ord)));
  end if;
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- Room lifecycle (all checks server-side)
-- -----------------------------------------------------------------------------
create or replace function public.my_display_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from public.profiles where id = auth.uid()), 'ผู้เล่น');
$$;

create or replace function public.create_room(p_game text, p_level text, p_public boolean default false, p_max int default 8, p_questions int default 10, p_seconds int default 15)
returns public.game_rooms
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  c text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.game_rooms where code = c);
  end loop;
  insert into public.game_rooms (code, host_id, game_id, level, is_public, max_players, total_questions, seconds_per_question)
  values (c, me, p_game, p_level, p_public, p_max, p_questions, p_seconds)
  returning * into r;
  insert into public.room_players (room_id, user_id, display_name, ready) values (r.id, me, public.my_display_name(), true);
  return r;
end;
$$;

create or replace function public.join_room(p_code text) returns public.game_rooms
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  n int;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into r from public.game_rooms where code = upper(trim(p_code)) for update;
  if r.id is null then raise exception 'ไม่พบห้องนี้'; end if;
  -- Reconnect: an existing member may always come back.
  if exists (select 1 from public.room_players where room_id = r.id and user_id = me) then
    update public.room_players set last_seen = now() where room_id = r.id and user_id = me;
    return r;
  end if;
  if r.status <> 'lobby' then raise exception 'เกมเริ่มไปแล้ว'; end if;
  -- Private rooms are unlisted: knowing the code (or being invited) is the access grant.
  select count(*) into n from public.room_players where room_id = r.id;
  if n >= r.max_players then raise exception 'ห้องเต็มแล้ว'; end if;
  insert into public.room_players (room_id, user_id, display_name) values (r.id, me, public.my_display_name());
  update public.game_rooms set updated_at = now() where id = r.id;
  return r;
end;
$$;

create or replace function public.set_ready(p_room uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.room_players set ready = p_ready, last_seen = now() where room_id = p_room and user_id = auth.uid();
  if not found then raise exception 'not a member'; end if;
  update public.game_rooms set updated_at = now() where id = p_room;
end;
$$;

create or replace function public.heartbeat(p_room uuid) returns void
language sql security definer set search_path = public as $$
  update public.room_players set last_seen = now() where room_id = p_room and user_id = auth.uid();
$$;

create or replace function public.start_game(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  n_players int;
  n_ready int;
  n_q int;
  levels text[];
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then raise exception 'room not found'; end if;
  if r.host_id <> auth.uid() then raise exception 'เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้'; end if;
  if r.status <> 'lobby' then raise exception 'เกมเริ่มไปแล้ว'; end if;
  select count(*), count(*) filter (where ready or user_id = r.host_id) into n_players, n_ready from public.room_players where room_id = p_room;
  if n_players < 2 then raise exception 'ต้องมีผู้เล่นอย่างน้อย 2 คน'; end if;
  if n_ready < n_players then raise exception 'ผู้เล่นยังไม่พร้อมทุกคน'; end if;

  levels := (array['A1', 'A2', 'B1', 'B2'])[1:array_position(array['A1', 'A2', 'B1', 'B2'], r.level)];
  delete from public.room_answers where room_id = p_room;
  delete from public.room_questions where room_id = p_room;
  insert into public.room_questions (room_id, idx, question_id, payload)
  select p_room, (row_number() over ()) - 1, q.id, q.payload
  from (
    select id, payload from public.game_questions
    where game_id = r.game_id and level = any (levels)
    order by random()
    limit r.total_questions
  ) q;
  if not found then raise exception 'ยังไม่มีคลังคำถามสำหรับเกมนี้ (ต้อง seed game_questions)'; end if;

  select count(*) into n_q from public.room_questions where room_id = p_room;
  update public.room_players set score = 0, correct = 0, streak = 0 where room_id = p_room;
  update public.game_rooms set
    status = 'playing',
    total_questions = n_q,
    current_index = 0,
    question_started_at = now() + interval '3 seconds',   -- synchronized countdown
    boss_max_hp = case when game_id = 'boss-battle' then n_players * n_q * 10 else null end,
    boss_hp = case when game_id = 'boss-battle' then n_players * n_q * 10 else null end,
    team_lives = case when game_id = 'boss-battle' then 3 + n_players - 1 else null end,
    updated_at = now()
  where id = p_room;
end;
$$;

create or replace function public.submit_answer(p_room uuid, p_idx int, p_given jsonb)
returns table (is_correct boolean, points_awarded int, correct_answer jsonb)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  q public.game_questions;
  p public.room_players;
  elapsed int;
  limit_ms int;
  ok boolean;
  pts int;
begin
  select * into r from public.game_rooms where id = p_room;
  if r.id is null or r.status <> 'playing' then raise exception 'เกมไม่ได้กำลังเล่น'; end if;
  select * into p from public.room_players where room_id = p_room and user_id = me for update;
  if p.user_id is null then raise exception 'not a member'; end if;
  if p_idx <> r.current_index then raise exception 'คำถามนี้ปิดแล้ว'; end if;
  if exists (select 1 from public.room_answers a where a.room_id = p_room and a.idx = p_idx and a.user_id = me) then
    raise exception 'ตอบข้อนี้ไปแล้ว';
  end if;

  limit_ms := r.seconds_per_question * 1000;
  elapsed := floor(extract(epoch from (now() - r.question_started_at)) * 1000)::int;
  if elapsed < 0 then raise exception 'คำถามยังไม่เริ่ม'; end if;

  select g.* into q from public.room_questions rq join public.game_questions g on g.id = rq.question_id where rq.room_id = p_room and rq.idx = p_idx;
  -- 1 s grace for network latency; later answers count as wrong.
  ok := elapsed <= limit_ms + 1000 and public.haneul_check(q.kind, q.answer, p_given);
  pts := public.haneul_score(ok, least(elapsed, limit_ms), limit_ms, p.streak);

  insert into public.room_answers (room_id, idx, user_id, given, correct, points, elapsed_ms) values (p_room, p_idx, me, p_given, ok, pts, elapsed);
  update public.room_players set
    score = score + pts,
    correct = correct + case when ok then 1 else 0 end,
    streak = case when ok then streak + 1 else 0 end,
    last_seen = now()
  where room_id = p_room and user_id = me;

  if r.game_id = 'boss-battle' then
    update public.game_rooms set
      boss_hp = case when ok then greatest(0, boss_hp - (10 + pts / 40)) else boss_hp end,
      team_lives = case when ok then team_lives else team_lives - 1 end,
      updated_at = now()
    where id = p_room;
  end if;

  return query select ok, pts, q.answer;
end;
$$;

-- Host advances; if the host is gone, any member may advance once the timer + 3 s has passed.
create or replace function public.advance_question(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  n_players int;
  n_answered int;
  timed_out boolean;
  boss_over boolean;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null or r.status <> 'playing' then return; end if;
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;
  select count(*) into n_players from public.room_players where room_id = p_room;
  select count(*) into n_answered from public.room_answers where room_id = p_room and idx = r.current_index;
  timed_out := now() > r.question_started_at + make_interval(secs => r.seconds_per_question + 3);
  if not (r.host_id = auth.uid() and (n_answered >= n_players or now() > r.question_started_at + make_interval(secs => r.seconds_per_question)))
     and not timed_out then
    raise exception 'ยังไม่ถึงเวลาข้อถัดไป';
  end if;
  boss_over := r.game_id = 'boss-battle' and (r.boss_hp <= 0 or r.team_lives <= 0);
  if r.current_index + 1 >= r.total_questions or boss_over then
    update public.game_rooms set status = 'finished', updated_at = now() where id = p_room;
  else
    update public.game_rooms set current_index = current_index + 1, question_started_at = now() + interval '1 second', updated_at = now() where id = p_room;
  end if;
end;
$$;

create or replace function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.game_rooms;
  next_host uuid;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.id is null then return; end if;
  delete from public.room_players where room_id = p_room and user_id = auth.uid();
  if r.host_id = auth.uid() then
    select user_id into next_host from public.room_players where room_id = p_room order by joined_at limit 1;
    if next_host is null then
      delete from public.game_rooms where id = p_room;
      return;
    end if;
    update public.game_rooms set host_id = next_host, updated_at = now() where id = p_room;
    update public.room_players set ready = true where room_id = p_room and user_id = next_host;
  end if;
  update public.game_rooms set updated_at = now() where id = p_room;
end;
$$;

create or replace function public.rematch(p_room uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_rooms where id = p_room and host_id = auth.uid() and status = 'finished') then
    raise exception 'เฉพาะเจ้าของห้องหลังจบเกม';
  end if;
  delete from public.room_answers where room_id = p_room;
  delete from public.room_questions where room_id = p_room;
  update public.room_players set ready = (user_id = auth.uid()), score = 0, correct = 0, streak = 0 where room_id = p_room;
  update public.game_rooms set status = 'lobby', current_index = -1, question_started_at = null, boss_hp = null, boss_max_hp = null, team_lives = null, updated_at = now() where id = p_room;
end;
$$;

create or replace function public.invite_friend(p_room uuid, p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_member(p_room) then raise exception 'not a member'; end if;
  if not public.are_friends(auth.uid(), p_friend) then raise exception 'เชิญได้เฉพาะเพื่อน'; end if;
  insert into public.room_invites (room_id, from_user, to_user) values (p_room, auth.uid(), p_friend) on conflict do nothing;
end;
$$;

-- Server time for client clock-offset correction (synchronised timers).
create or replace function public.server_now() returns timestamptz language sql stable as $$ select now(); $$;

-- -----------------------------------------------------------------------------
-- Grants: clients use RPCs; direct table writes are not granted.
-- -----------------------------------------------------------------------------
revoke all on public.game_questions from anon, authenticated;
revoke insert, update, delete on public.game_rooms, public.room_players, public.room_questions, public.room_answers, public.room_invites, public.friendships from anon, authenticated;
grant select on public.profiles, public.game_rooms, public.room_players, public.room_questions, public.room_answers, public.room_invites, public.friendships to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;

revoke execute on all functions in schema public from anon, public;
grant execute on function
  public.send_friend_request(text), public.respond_friend_request(uuid, boolean),
  public.create_room(text, text, boolean, int, int, int), public.join_room(text), public.set_ready(uuid, boolean),
  public.heartbeat(uuid), public.start_game(uuid), public.submit_answer(uuid, int, jsonb), public.advance_question(uuid),
  public.leave_room(uuid), public.rematch(uuid), public.invite_friend(uuid, uuid), public.server_now(),
  public.is_room_member(uuid), public.are_friends(uuid, uuid), public.my_display_name(),
  public.haneul_score(boolean, int, int, int), public.haneul_normalize(text), public.haneul_check(text, jsonb, jsonb)
to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime (Supabase): broadcast row changes for live lobbies and scoreboards.
-- RLS is enforced for postgres_changes subscribers.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.game_rooms, public.room_players, public.room_invites;
  end if;
end;
$$;
