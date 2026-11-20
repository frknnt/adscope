-- Turkish voice-over (P11.1): synthetic voice files of a video script are stored like the other
-- generations (charged once through record_generation, removed with the record after 90 days by
-- the retention job). Only the kind list and the bucket's allowed types change; the table's RLS
-- policies, grants and the bucket's owner-folder policies stay as they are.
alter table public.generations drop constraint if exists generations_kind_check;
alter table public.generations
  add constraint generations_kind_check check (kind in ('copy', 'creative', 'photo', 'tool', 'script', 'ai_image', 'ai_video', 'campaign', 'voiceover'));

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/zip', 'video/mp4', 'audio/wav']
where id = 'creatives';
