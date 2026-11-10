-- The code a person hands out when they tap Share (owner shares the friends code; friends re-share it).
alter table public.invites add column share_code text;
-- Real invite codes live only in the live database. Never commit them: this repo is public.
