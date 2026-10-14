-- Users: profiles, favorite fighters ("mains"), and feedback.
-- Accounts themselves live in Supabase Auth (auth.users): email/password, Google and Discord.
-- Every table has row-level security, so the public anon key in the browser can only reach a user's own rows.

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile for every new account, named from the provider's metadata (Google: full_name/name,
-- Discord: custom_claims.global_name/full_name/name) or the email's local part.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := coalesce(
    nullif(meta -> 'custom_claims' ->> 'global_name', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    nullif(meta ->> 'display_name', ''),
    split_part(coalesce(new.email, 'player'), '@', 1)
  );
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, left(name, 40), nullif(meta ->> 'avatar_url', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- favorite fighters ----------
-- A user's mains. position 0 is the primary main (shown on the home page).
create table public.favorite_fighters (
  user_id uuid not null references auth.users (id) on delete cascade,
  fighter_slug text not null check (fighter_slug ~ '^[a-z_]{2,40}$'),
  position smallint not null default 0 check (position between 0 and 20),
  created_at timestamptz not null default now(),
  primary key (user_id, fighter_slug)
);

alter table public.favorite_fighters enable row level security;

create policy "favorites: read own" on public.favorite_fighters
  for select using (auth.uid() = user_id);
create policy "favorites: insert own" on public.favorite_fighters
  for insert with check (auth.uid() = user_id);
create policy "favorites: update own" on public.favorite_fighters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "favorites: delete own" on public.favorite_fighters
  for delete using (auth.uid() = user_id);

-- ---------- feedback ----------
create table public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'data', 'other')),
  message text not null check (char_length(message) between 5 and 4000),
  page text check (char_length(page) <= 300),
  status text not null default 'new' check (status in ('new', 'seen', 'done', 'wontfix')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Users can submit and see their own feedback; only the project owner (via the dashboard / service role) sees everything
-- and changes status.
create policy "feedback: read own" on public.feedback
  for select using (auth.uid() = user_id);
create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id and status = 'new');

-- Light abuse guard: at most 20 feedback messages per user per day.
create function public.feedback_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Feedback limit reached for today';
  end if;
  return new;
end;
$$;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
