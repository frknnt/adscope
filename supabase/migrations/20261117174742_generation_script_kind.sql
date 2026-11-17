-- Video scripts (P3.2) are stored in the generic generations table like ad copy.
alter table public.generations drop constraint if exists generations_kind_check;
alter table public.generations
  add constraint generations_kind_check check (kind in ('copy', 'creative', 'photo', 'tool', 'script'));
-- record_generation inserts through this constraint, so it accepts 'script' too.
