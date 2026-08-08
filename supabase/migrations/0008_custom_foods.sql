-- Spec 0018 — custom foods: the user's own kitchen becomes loggable.
--
-- The gap this kills: there was NO way to log a food that is not in the
-- catalog. Home-cooked meals — the hardest food to log in the published
-- friction research the app itself cites (combos.ts) — were locked out
-- entirely. A custom food is an ordinary foods row owned by its creator:
-- it flows through the same search ranking, the same portion math, the same
-- go-tos/repeats/Easy Day engines, with zero new code paths downstream.

-- owner: NULL = catalog food (visible to everyone), set = one user's own food.
alter table public.foods
  add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
create index if not exists foods_owner_idx on public.foods (owner_id) where owner_id is not null;

-- 'user' joins the allowed sources, and user foods MUST have an owner while
-- catalog foods must NOT — the check makes the two states mutually exclusive.
alter table public.foods drop constraint if exists foods_source_check;
alter table public.foods
  add constraint foods_source_check
  check (source in ('usda','off','commercial','crowd','user'));
alter table public.foods drop constraint if exists foods_user_owner_check;
alter table public.foods
  add constraint foods_user_owner_check
  check ((source = 'user') = (owner_id is not null));

-- RLS: everyone sees the catalog; only you see (and manage) your kitchen.
drop policy if exists "foods readable by all signed-in" on public.foods;
create policy "foods readable by all signed-in" on public.foods
  for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
drop policy if exists "foods readable pre-auth" on public.foods;
create policy "foods readable pre-auth" on public.foods
  for select to anon
  using (owner_id is null);
drop policy if exists "own foods - insert" on public.foods;
create policy "own foods - insert" on public.foods
  for insert to authenticated
  with check (owner_id = auth.uid() and source = 'user');
drop policy if exists "own foods - update" on public.foods;
create policy "own foods - update" on public.foods
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and source = 'user');
drop policy if exists "own foods - delete" on public.foods;
create policy "own foods - delete" on public.foods
  for delete to authenticated
  using (owner_id = auth.uid());

-- Search: your kitchen outranks the catalog. An exact name match still wins
-- (typing the full name means you meant that thing), but on anything less,
-- the food YOU created beats a catalog row — you made it because you eat it.
create or replace function public.search_foods(q text, lim int default 20)
returns setof public.foods
language sql
stable
security invoker          -- keep RLS: callers still only see what policy allows
set search_path = public
as $$
  select f.*
  from public.foods f
  where f.name ilike '%' || q || '%'
  order by
    (lower(f.name) = lower(q)) desc,                       -- exact name
    (f.owner_id is not null) desc,                         -- your kitchen first
    (lower(f.name) like lower(q) || '%') desc,             -- starts with query
    (lower(f.name) ~ ('(^|[^a-z])' || lower(q))) desc,     -- query starts a word
    similarity(f.name, q) desc,                            -- trigram closeness
    length(f.name) asc,                                    -- "Bananas, raw" over a long compound
    f.name asc                                             -- stable tiebreak
  limit least(coalesce(lim, 20), 50);
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
