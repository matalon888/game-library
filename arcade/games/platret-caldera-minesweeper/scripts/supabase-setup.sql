-- Caldera Minesweeper — leaderboard schema + Row-Level Security.
-- Paste this into the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- and run it once. Safe to re-run.

create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(name) between 1 and 20),
  difficulty  text        not null check (difficulty in ('beginner','intermediate','expert')),
  time_ms     integer     not null check (time_ms > 0 and time_ms < 86400000),
  created_at  timestamptz not null default now()
);

create index if not exists scores_diff_time_idx on public.scores (difficulty, time_ms);

-- Lock the table down, then open exactly two doors for the public anon key.
alter table public.scores enable row level security;

drop policy if exists "public read scores" on public.scores;
create policy "public read scores"
  on public.scores for select
  using (true);

drop policy if exists "public insert scores" on public.scores;
create policy "public insert scores"
  on public.scores for insert
  with check (
    char_length(name) between 1 and 20
    and difficulty in ('beginner','intermediate','expert')
    and time_ms > 0 and time_ms < 86400000
  );

-- No UPDATE or DELETE policies exist, so anon clients cannot modify or remove
-- rows — they can only read the board and append their own score.
