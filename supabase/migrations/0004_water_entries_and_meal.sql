-- B-12 + B-16: make two fabricated/dead UI elements real.
--
-- 1. log_entries.meal — the PortionSheet meal picker was a dead control: the
--    user's choice was dropped on the floor (AppRoot.logIt took `_meal`).
-- 2. water_entries — the Today water card showed a hardcoded 0 L with a dead
--    "+ Add". Water is now append-only entries with the same offline
--    idempotency contract as log_entries (ADR-008): unique (user_id, client_id),
--    so a replayed sync is a no-op and a counter can never double-count.

alter table public.log_entries
  add column if not exists meal text
    check (meal is null or meal in ('breakfast','lunch','dinner','snack'));

create table if not exists public.water_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  ml int not null check (ml > 0 and ml <= 5000),
  logged_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists water_entries_user_day_idx on public.water_entries (user_id, day);

alter table public.water_entries enable row level security;
drop policy if exists "own water - select" on public.water_entries;
create policy "own water - select" on public.water_entries for select using (auth.uid() = user_id);
drop policy if exists "own water - insert" on public.water_entries;
create policy "own water - insert" on public.water_entries for insert with check (auth.uid() = user_id);
drop policy if exists "own water - delete" on public.water_entries;
create policy "own water - delete" on public.water_entries for delete using (auth.uid() = user_id);
