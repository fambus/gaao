-- Song meanings cache: each song is explained once, then served to everyone.
create table public.songs (
  key text primary key,            -- "lrclib:<id>:<model>:<prompt_version>"
  title text,
  artist text,
  model text,
  data jsonb not null,             -- { language, summary, model, lines:[{text,r,m}] }
  hits integer not null default 0,
  created_at timestamptz not null default now()
);

-- Invite codes carried in share links. Revoke one by setting revoked = true.
create table public.invites (
  code text primary key,
  label text,
  recognize_per_day integer not null default 80,
  songs_per_day integer not null default 40,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Daily usage per invite, for caps.
create table public.usage (
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  code text not null references public.invites(code) on delete cascade,
  kind text not null,              -- 'recognize' | 'songs'
  n integer not null default 0,
  primary key (day, code, kind)
);

alter table public.songs enable row level security;
alter table public.invites enable row level security;
alter table public.usage enable row level security;
-- No policies: only the edge function (service role / direct DB URL) touches these tables.

create or replace function public.gaao_bump(p_code text, p_kind text)
returns integer language sql security definer set search_path = public as $$
  insert into public.usage (day, code, kind, n)
  values ((now() at time zone 'Asia/Kolkata')::date, p_code, p_kind, 1)
  on conflict (day, code, kind) do update set n = public.usage.n + 1
  returning n;
$$;
revoke all on function public.gaao_bump(text, text) from public, anon, authenticated;
