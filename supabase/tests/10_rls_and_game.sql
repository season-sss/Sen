-- Integration test for RLS, anti-cheat and the multiplayer flow.
-- Run with scripts/test-db.sh. Any failed assertion raises and stops the script.
\set ON_ERROR_STOP on
\set QUIET on

-- --------------------------------------------------------------- fixtures
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"display_name":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000e', 'eve@example.com', '{}');

do $$ begin
  assert (select count(*) from public.profiles) = 3, 'profiles created by trigger';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000e') = 'eve', 'display name falls back to email local part';
end $$;

create or replace function pg_temp.expect_error(sql text, needle text default null) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED ERROR but statement succeeded: %', sql;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if needle is not null and position(needle in sqlerrm) = 0 then
    raise exception 'error "%" did not contain "%" for: %', sqlerrm, needle, sql;
  end if;
end $$;
grant execute on function pg_temp.expect_error(text, text) to authenticated;

-- --------------------------------------------------------------- user_data RLS
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.user_data (user_id, key, value) values ('00000000-0000-0000-0000-00000000000a', 'haneul:notes', '{"x":1}');
select pg_temp.expect_error($$insert into public.user_data (user_id, key, value) values ('00000000-0000-0000-0000-00000000000b', 'haneul:notes', '{}')$$, 'row-level security');
select pg_temp.expect_error($$insert into public.user_data (user_id, key, value) values ('00000000-0000-0000-0000-00000000000a', 'bad key', '{}')$$, 'check constraint');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.user_data) = 0, 'bob cannot read alice''s data';
end $$;
update public.user_data set value = '{"hacked":true}' where user_id = '00000000-0000-0000-0000-00000000000a';
reset role;
do $$ begin
  assert (select value from public.user_data where user_id = '00000000-0000-0000-0000-00000000000a') = '{"x":1}'::jsonb, 'bob cannot modify alice''s data';
end $$;

-- --------------------------------------------------------------- answers are hidden
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select pg_temp.expect_error('select * from public.game_questions', 'permission denied');
select pg_temp.expect_error($$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-00000000000a'$$, 'permission denied');
reset role;
do $$ begin
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'cannot rename others';
end $$;

-- --------------------------------------------------------------- name#tag handles
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'h1@handles.invalid', '{"handle":"สมชาย#1234","display_name":"สมชาย#1234"}');
do $$ begin
  assert (select handle from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'สมชาย#1234', 'handle stored on profile';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-0000000000c1') = 'สมชาย#1234', 'display name is the handle';
end $$;
select pg_temp.expect_error($$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c2', 'h2@handles.invalid', '{"handle":"สมชาย#1234"}')$$, 'duplicate key');
select pg_temp.expect_error($$insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c3', 'h3@handles.invalid', '{"handle":"no-tag"}')$$, 'profiles_handle_format');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select pg_temp.expect_error($$update public.profiles set display_name = 'Alice' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
select pg_temp.expect_error($$update public.profiles set handle = 'Alice#1' where id = '00000000-0000-0000-0000-0000000000c1'$$, 'permission denied');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c1';

-- --------------------------------------------------------------- room lifecycle
create temp table t (k text primary key, v text);
grant all on t to authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into t select 'room', id::text from public.create_room('vocab-race', 'A1', false, 4, 5, 10);
insert into t select 'code', code from public.game_rooms where id = (select v::uuid from t where k = 'room');
reset role;

-- eve (not invited, private room) cannot see it
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
do $$ begin assert (select count(*) from public.game_rooms) = 0, 'private room hidden from strangers'; end $$;
reset role;

-- bob joins with the code
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select public.join_room((select v from t where k = 'code'));
select public.join_room((select v from t where k = 'code')); -- reconnect is idempotent
do $$ begin
  assert (select count(*) from public.room_players where room_id = (select v::uuid from t where k = 'room')) = 2, 'two players';
end $$;
select pg_temp.expect_error($$update public.room_players set score = 9999$$, 'permission denied');
select pg_temp.expect_error($$select public.start_game((select v::uuid from t where k = 'room'))$$, 'เจ้าของห้อง');
reset role;

-- host cannot start before everyone is ready
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect_error($$select public.start_game((select v::uuid from t where k = 'room'))$$, 'ยังไม่พร้อม');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select public.set_ready((select v::uuid from t where k = 'room'), true);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.start_game((select v::uuid from t where k = 'room'));
reset role;

do $$ begin
  assert (select status from public.game_rooms where id = (select v::uuid from t where k = 'room')) = 'playing', 'playing';
  assert (select count(*) from public.room_questions where room_id = (select v::uuid from t where k = 'room')) = 5, '5 questions drawn';
end $$;

-- clients only see released questions
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.room_questions) = 1, 'only question 0 released';
  assert (select payload ? 'options' from public.room_questions where idx = 0), 'payload has options';
end $$;
-- answering before the synchronized countdown ends is rejected
select pg_temp.expect_error($$select * from public.submit_answer((select v::uuid from t where k = 'room'), 0, '0')$$, 'ยังไม่เริ่ม');
reset role;

-- fast-forward the countdown (test only), then bob answers correctly, alice wrongly
update public.game_rooms set question_started_at = now() - interval '2 seconds' where id = (select v::uuid from t where k = 'room');
insert into t select 'answer', g.answer::text from public.room_questions rq join public.game_questions g on g.id = rq.question_id
  where rq.room_id = (select v::uuid from t where k = 'room') and rq.idx = 0;
insert into t select 'wrong', ((g.answer::text::int + 1) % jsonb_array_length(g.payload -> 'options'))::text from public.room_questions rq join public.game_questions g on g.id = rq.question_id
  where rq.room_id = (select v::uuid from t where k = 'room') and rq.idx = 0;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$
declare r record;
begin
  select * into r from public.submit_answer((select v::uuid from t where k = 'room'), 0, (select v from t where k = 'answer')::jsonb);
  assert r.is_correct, 'bob correct';
  assert r.points_awarded between 100 and 200, format('speed-based points, got %s', r.points_awarded);
end $$;
select pg_temp.expect_error($$select * from public.submit_answer((select v::uuid from t where k = 'room'), 0, '0')$$, 'ตอบข้อนี้ไปแล้ว');
select pg_temp.expect_error($$select * from public.submit_answer((select v::uuid from t where k = 'room'), 1, '0')$$, 'ปิดแล้ว');
-- bob (not host, timer not expired) cannot skip ahead
select pg_temp.expect_error($$select public.advance_question((select v::uuid from t where k = 'room'))$$, 'ยังไม่ถึงเวลา');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$
declare r record;
begin
  select * into r from public.submit_answer((select v::uuid from t where k = 'room'), 0, (select v from t where k = 'wrong')::jsonb);
  assert not r.is_correct and r.points_awarded = 0, 'alice wrong → 0';
end $$;
-- everyone answered → host may advance
select public.advance_question((select v::uuid from t where k = 'room'));
do $$ begin
  assert (select current_index from public.game_rooms) = 1, 'advanced to question 1';
  assert (select count(*) from public.room_questions) = 2, 'question 1 released';
  assert (select count(*) from public.room_answers where idx = 0) = 2, 'answers to closed question visible';
end $$;
reset role;

do $$ begin
  assert (select score from public.room_players where user_id = '00000000-0000-0000-0000-00000000000b') >= 100, 'server-side score saved';
  assert (select streak from public.room_players where user_id = '00000000-0000-0000-0000-00000000000b') = 1, 'streak tracked';
end $$;

-- late answers count as wrong (timer is enforced on the server)
update public.game_rooms set question_started_at = now() - interval '30 seconds' where id = (select v::uuid from t where k = 'room');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$
declare r record; correct_ans jsonb;
begin
  select * into r from public.submit_answer((select v::uuid from t where k = 'room'), 1, '0'::jsonb);
  assert r.points_awarded = 0 and not r.is_correct, 'late answer scores 0';
end $$;
-- the host is "gone": a member may advance once the timer + grace has elapsed
select public.advance_question((select v::uuid from t where k = 'room'));
do $$ begin assert (select current_index from public.game_rooms) = 2, 'member advanced after timeout'; end $$;
reset role;

-- finish the game
update public.game_rooms set current_index = total_questions - 1, question_started_at = now() - interval '30 seconds' where id = (select v::uuid from t where k = 'room');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.advance_question((select v::uuid from t where k = 'room'));
do $$ begin assert (select status from public.game_rooms) = 'finished', 'finished'; end $$;
select public.rematch((select v::uuid from t where k = 'room'));
do $$ begin
  assert (select status from public.game_rooms) = 'lobby', 'rematch → lobby';
  assert (select sum(score) from public.room_players) = 0, 'scores reset';
end $$;
reset role;

-- --------------------------------------------------------------- friends & invites
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select pg_temp.expect_error($$select public.invite_friend((select v::uuid from t where k = 'room'), '00000000-0000-0000-0000-00000000000a')$$, 'not a member');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect_error($$select public.invite_friend((select v::uuid from t where k = 'room'), '00000000-0000-0000-0000-00000000000e')$$, 'เฉพาะเพื่อน');
select public.send_friend_request((select friend_code from public.profiles where id = '00000000-0000-0000-0000-00000000000e'));
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select public.respond_friend_request('00000000-0000-0000-0000-00000000000a', true);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.invite_friend((select v::uuid from t where k = 'room'), '00000000-0000-0000-0000-00000000000e');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
do $$ begin assert (select count(*) from public.game_rooms) = 1, 'invitee can see the room'; end $$;
reset role;

-- --------------------------------------------------------------- host leaves → host transfers
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.leave_room((select v::uuid from t where k = 'room'));
reset role;
do $$ begin
  assert (select host_id from public.game_rooms) = '00000000-0000-0000-0000-00000000000b', 'host transferred to bob';
end $$;

-- --------------------------------------------------------------- scoring parity with the TypeScript implementation
do $$ begin
  assert public.haneul_score(false, 1000, 10000, 3) = 0;
  assert public.haneul_score(true, 0, 10000, 0) = 200;
  assert public.haneul_score(true, 10000, 10000, 0) = 100;
  assert public.haneul_score(true, 5000, 10000, 10) = 200;
  assert public.haneul_check('text', '["먹을 수 있어요"]', '"먹을수 있어요."');
  assert not public.haneul_check('text', '["먹어요"]', '"먹아요"');
  assert public.haneul_check('order', '["저는","학생이에요."]', '["저는","학생이에요."]');
  assert not public.haneul_check('order', '["저는","학생이에요."]', '["학생이에요.","저는"]');
  assert public.haneul_check('mcq', '2', '2') and not public.haneul_check('mcq', '2', '"2"');
end $$;

\echo 'ALL DATABASE TESTS PASSED'
