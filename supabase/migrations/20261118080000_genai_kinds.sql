-- Generative creatives (Google Gemini API): AI images and short AI videos are stored like the other
-- generations. The private 'creatives' bucket learns MP4 and a 25 MB limit for videos; its owner-folder
-- policies are unchanged.
alter table public.generations drop constraint if exists generations_kind_check;
alter table public.generations
  add constraint generations_kind_check check (kind in ('copy', 'creative', 'photo', 'tool', 'script', 'ai_image', 'ai_video'));

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/zip', 'video/mp4']
where id = 'creatives';
