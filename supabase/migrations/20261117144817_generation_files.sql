-- Generated files (P2.1 creatives, P2.2 product photos, P2.3 tools) live in the existing private
-- 'creatives' bucket under <user_id>/generations/. The owner-folder policies of that bucket already
-- restrict every operation to the caller's own folder; this migration only lets the bucket hold
-- ZIP archives (all sizes in one download) and slightly larger files.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/zip']
where id = 'creatives';
