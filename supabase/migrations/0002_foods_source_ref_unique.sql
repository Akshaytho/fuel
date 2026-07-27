-- Unique identity for imported foods so seeding is idempotent.
create unique index if not exists foods_source_ref_uidx
  on public.foods (source, source_ref) where source_ref is not null;
