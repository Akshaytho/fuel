-- Spec 0016 — Easy Day. Entries logged as "my usual day" carry their own
-- source value, so the record keeps the truth that this was an
-- asserted-typical day rather than a weighed one. The foods and portions are
-- real (drawn from the user's own history); only the precision differs.
alter table public.log_entries
  drop constraint if exists log_entries_source_check;
alter table public.log_entries
  add constraint log_entries_source_check
  check (source in ('scan', 'describe', 'search', 'manual', 'easy'));
