-- Fuel schema v1 (P0-10) — from docs/product/Fuel-SDLC-decision-lock.html DOC 04
-- RLS: default deny; users touch only their own rows (ADR-012).

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en',
  units text not null default 'metric' check (units in ('metric','imperial')),
  sex text check (sex in ('male','female')),
  age_years int check (age_years between 13 and 120),
  height_cm numeric(5,1) check (height_cm > 0),
  weight_kg numeric(5,1) check (weight_kg > 0),
  activity text check (activity in ('sedentary','light','moderate','active','very_active')),
  goal text check (goal in ('lose','maintain','gain')),
  target_kcal int,
  target_protein_g numeric(6,1),
  target_carbs_g numeric(6,1),
  target_fat_g numeric(6,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile - select" on public.profiles;
create policy "own profile - select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own profile - insert" on public.profiles;
create policy "own profile - insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "own profile - update" on public.profiles;
create policy "own profile - update" on public.profiles for update using (auth.uid() = id);

-- ============ foods (global, read-only to users) ============
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('usda','off','commercial','crowd')),
  source_ref text,                       -- e.g. USDA fdcId / OFF code
  barcode text,
  name text not null,
  brand text,
  locale text not null default 'en',
  kcal_per_100g numeric(7,1) not null check (kcal_per_100g >= 0),
  protein_g_per_100g numeric(6,1) not null check (protein_g_per_100g >= 0),
  carbs_g_per_100g numeric(6,1) not null check (carbs_g_per_100g >= 0),
  fat_g_per_100g numeric(6,1) not null check (fat_g_per_100g >= 0),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists foods_barcode_idx on public.foods (barcode) where barcode is not null;
create index if not exists foods_name_idx on public.foods using gin (to_tsvector('simple', name));
alter table public.foods enable row level security;
drop policy if exists "foods readable by all signed-in" on public.foods;
create policy "foods readable by all signed-in" on public.foods for select to authenticated using (true);
-- writes only via service role (edge functions) — no user write policy on purpose.

-- ============ log_entries ============
create table if not exists public.log_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,               -- offline idempotency (ADR-008)
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  food_id uuid references public.foods(id),
  food_name text not null,               -- denormalized: survives food edits
  grams numeric(7,1) not null check (grams >= 0),
  kcal numeric(7,1) not null check (kcal >= 0),
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  source text not null check (source in ('scan','describe','search','manual')),
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)            -- replayed sync writes dedupe
);
create index if not exists log_entries_user_day_idx on public.log_entries (user_id, day);
alter table public.log_entries enable row level security;
drop policy if exists "own entries - select" on public.log_entries;
create policy "own entries - select" on public.log_entries for select using (auth.uid() = user_id);
drop policy if exists "own entries - insert" on public.log_entries;
create policy "own entries - insert" on public.log_entries for insert with check (auth.uid() = user_id);
drop policy if exists "own entries - update" on public.log_entries;
create policy "own entries - update" on public.log_entries for update using (auth.uid() = user_id);
drop policy if exists "own entries - delete" on public.log_entries;
create policy "own entries - delete" on public.log_entries for delete using (auth.uid() = user_id);

-- ============ weigh_ins ============
create table if not exists public.weigh_ins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  weight_kg numeric(5,1) not null check (weight_kg > 0),
  energy_score int check (energy_score between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.weigh_ins enable row level security;
drop policy if exists "own weighins - all" on public.weigh_ins;
create policy "own weighins - all" on public.weigh_ins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ food_cache_misses (scan-miss recovery + coverage metrics) ============
create table if not exists public.food_cache_misses (
  barcode text primary key,
  attempts int not null default 1,
  resolved boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.food_cache_misses enable row level security;
-- service-role only; no user policies.

-- ============ entitlements (synced from RevenueCat webhook later) ============
create table if not exists public.entitlements (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  source text not null default 'revenuecat',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
drop policy if exists "own entitlement - select" on public.entitlements;
create policy "own entitlement - select" on public.entitlements for select using (auth.uid() = user_id);
-- writes only via service role webhook.

-- ============ auto-create profile on signup ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.entitlements (user_id) values (new.id) on conflict do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();
