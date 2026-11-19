-- Brand templates (P10.3): layer layouts saved from the creative editor, at most 30 per brand.
-- `doc` is the editor's JSON (layers per size) without uploaded images. Owner writes; team viewers read.
create table public.brand_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  doc jsonb not null check (jsonb_typeof(doc) = 'object' and pg_column_size(doc) <= 262144),
  created_at timestamptz not null default now()
);
create index brand_templates_user_id_idx on public.brand_templates (user_id);
create index brand_templates_brand_id_idx on public.brand_templates (brand_id, created_at desc);

alter table public.brand_templates enable row level security;
revoke all on public.brand_templates from anon, authenticated;
grant select, delete on public.brand_templates to authenticated;
grant insert (user_id, brand_id, name, doc) on public.brand_templates to authenticated;

create policy "brand_templates: owner or team can read" on public.brand_templates
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = brand_templates.user_id and m.member_id = (select auth.uid()))
  );
-- The brand must belong to the same user (no template on someone else's brand).
create policy "brand_templates: owner can insert" on public.brand_templates
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.brands b where b.id = brand_id and b.user_id = (select auth.uid()))
  );
create policy "brand_templates: owner can delete" on public.brand_templates
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- At most 30 templates per brand, also when two saves race (the brand row is locked first).
create function public.brand_templates_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows the insert policy will refuse anyway (someone else's id or brand) are left to RLS, so the
  -- trigger neither locks a stranger's brand nor reveals how many templates it has.
  if new.user_id is distinct from (select auth.uid()) and (select auth.uid()) is not null then
    return new;
  end if;
  if not exists (select 1 from public.brands b where b.id = new.brand_id and b.user_id = new.user_id) then
    return new;
  end if;
  perform 1 from public.brands where id = new.brand_id for update;
  if (select count(*) from public.brand_templates where brand_id = new.brand_id) >= 30 then
    raise exception 'brand_templates_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.brand_templates_limit() from public, anon, authenticated;

create trigger brand_templates_limit
  before insert on public.brand_templates
  for each row execute function public.brand_templates_limit();
