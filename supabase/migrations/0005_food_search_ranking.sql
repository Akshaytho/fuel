-- B-20: search ranked by RELEVANCE, in the database.
--
-- Before: `name=ilike.*banana*&order=name.asc` — alphabetical, so searching
-- "banana" surfaced "Babyfood, apple-banana juice" above "Bananas, raw".
-- Client-side re-ranking cannot fix this: with a million foods the right rows
-- are not even in the alphabetical first page. Ranking must happen where the
-- data is, and it must use an index.

create extension if not exists pg_trgm;

create index if not exists foods_name_trgm_idx
  on public.foods using gin (name gin_trgm_ops);

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
    (lower(f.name) like lower(q) || '%') desc,             -- starts with query
    (lower(f.name) ~ ('(^|[^a-z])' || lower(q))) desc,     -- query starts a word
    similarity(f.name, q) desc,                            -- trigram closeness
    length(f.name) asc,                                    -- "Bananas, raw" over a long compound
    f.name asc                                             -- stable tiebreak
  limit least(coalesce(lim, 20), 50);
$$;

grant execute on function public.search_foods(text, int) to anon, authenticated;
