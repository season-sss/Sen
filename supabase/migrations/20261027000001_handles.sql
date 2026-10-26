-- HANEUL — name#tag accounts with a numeric PIN
--
-- The web app signs these accounts up through Supabase Auth with an email derived from the
-- normalized handle (sha-256, so the handle itself is not the login identifier) and stores the
-- handle in user metadata. This migration records the handle on the profile, keeps it unique,
-- and stops clients from renaming themselves, so nobody can pose as another name#tag in games.

alter table public.profiles add column if not exists handle text;

alter table public.profiles drop constraint if exists profiles_handle_format;
alter table public.profiles add constraint profiles_handle_format
  check (handle is null or (char_length(handle) between 3 and 30 and handle ~ '^[^#]+#[^#]+$'));

create unique index if not exists profiles_handle_unique on public.profiles (lower(handle)) where handle is not null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  h text := nullif(trim(new.raw_user_meta_data ->> 'handle'), '');
begin
  insert into public.profiles (id, display_name, handle)
  values (
    new.id,
    left(coalesce(h, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'ผู้เล่น'), 30),
    h
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Display names are the account handle; they can no longer be changed from the client.
revoke update (display_name) on public.profiles from authenticated;
