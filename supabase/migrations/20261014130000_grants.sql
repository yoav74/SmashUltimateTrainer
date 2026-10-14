-- Table privileges for signed-in users.
-- The project was created with "Automatically expose new tables" off, so new tables grant nothing to
-- the anon/authenticated roles. Row-level security (previous migration) still limits every grant below
-- to the user's own rows. Signed-out visitors (anon) get no access at all.
-- Safe to run more than once.

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;  -- only the name is user-editable

grant select, insert, update, delete on public.favorite_fighters to authenticated;

-- feedback.id is an identity column, so INSERT doesn't need a separate sequence grant.
grant select, insert on public.feedback to authenticated;
