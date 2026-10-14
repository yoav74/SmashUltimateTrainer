-- Profile pictures are opt-in: new accounts don't copy the Google/Discord picture. The account page
-- asks once (avatar_asked) and only stores the provider's picture if the user says yes.

alter table public.profiles add column avatar_asked boolean not null default false;

-- Start everyone fresh, including accounts created before this migration (they'll be asked).
update public.profiles set avatar_url = null, avatar_asked = false;

-- Only Google or Discord profile pictures (the user's own, from their sign-in provider).
alter table public.profiles add constraint profiles_avatar_url_host check (
  avatar_url is null
  or avatar_url ~ '^https://(lh[0-9]\.googleusercontent\.com|cdn\.discordapp\.com)/'
);

-- New accounts: name only, no picture.
create or replace function public.handle_new_user() returns trigger
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
  insert into public.profiles (id, display_name) values (new.id, left(name, 40));
  return new;
end;
$$;

-- Users may now also set their picture and record that they were asked.
grant update (display_name, avatar_url, avatar_asked) on public.profiles to authenticated;
