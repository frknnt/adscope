-- Private bucket for uploaded ad creatives.
-- Object path convention: <user_id>/<analysis_id>/<random>.<ext>
-- The first folder segment must equal the caller's user id for every operation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creatives', 'creatives', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "creatives: owner can upload into own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'creatives'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "creatives: owner can read own files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'creatives'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "creatives: owner can update own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'creatives'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'creatives'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "creatives: owner can delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'creatives'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
