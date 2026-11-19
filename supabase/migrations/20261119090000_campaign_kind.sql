-- Campaign package (P9.1): one ZIP with the creatives, variant CSV and PDF check report is stored
-- like the other generations and charged once through record_generation. Only the kind list changes;
-- the table's RLS policies and grants stay as they are.
alter table public.generations drop constraint if exists generations_kind_check;
alter table public.generations
  add constraint generations_kind_check check (kind in ('copy', 'creative', 'photo', 'tool', 'script', 'ai_image', 'ai_video', 'campaign'));
