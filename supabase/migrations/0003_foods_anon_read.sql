-- Foods are generic public data; allow anon read so search works pre-auth.
-- Revisit at launch (backlog B-08): restrict to authenticated if desired.
drop policy if exists "foods readable pre-auth" on public.foods;
create policy "foods readable pre-auth" on public.foods for select to anon using (true);
