-- Spec 0015 — fibre as a first-class nutrient.
--
-- NULLABLE ON PURPOSE. A zero and an unknown are different facts and the app
-- must never conflate them: 0 means "this food genuinely has no fibre",
-- NULL means "our source did not report it". Cronometer is the only tracker
-- in the field that makes this distinction visible, and it is the difference
-- between "you are short on fibre" and "we don't know what you ate".

alter table public.foods
  add column if not exists fiber_g_per_100g numeric(6,1)
    check (fiber_g_per_100g is null or fiber_g_per_100g >= 0);

alter table public.log_entries
  add column if not exists fiber_g numeric(6,1)
    check (fiber_g is null or fiber_g >= 0);

comment on column public.foods.fiber_g_per_100g is
  'Dietary fibre per 100 g. NULL = not reported by the source, never assume 0.';
comment on column public.log_entries.fiber_g is
  'Fibre for this portion. NULL = the food had no fibre figure to scale.';
