-- Audience profiles (P1.3): per brand, used by the copy generator. Owner writes; team viewers read.
-- Sensitive categories (health, religion, ethnicity, sexual orientation, financial hardship, politics)
-- are refused by the application before anything is stored.
create table public.audiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid not null references public.brands (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  age_min integer not null check (age_min between 18 and 80),
  age_max integer not null check (age_max between 18 and 80),
  need text not null check (char_length(need) between 2 and 300),
  objections text not null default '' check (char_length(objections) <= 300),
  tone text not null default '' check (char_length(tone) <= 120),
  created_at timestamptz not null default now(),
  check (age_min <= age_max)
);
create index audiences_user_id_idx on public.audiences (user_id);
create index audiences_brand_id_idx on public.audiences (brand_id);

alter table public.audiences enable row level security;
revoke all on public.audiences from anon, authenticated;
grant select, delete on public.audiences to authenticated;
grant insert (user_id, brand_id, name, age_min, age_max, need, objections, tone) on public.audiences to authenticated;
grant update (name, age_min, age_max, need, objections, tone) on public.audiences to authenticated;

create policy "audiences: owner or team can read" on public.audiences
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = audiences.user_id and m.member_id = (select auth.uid()))
  );
-- The brand must belong to the same user (no profile on someone else's brand).
create policy "audiences: owner can insert" on public.audiences
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.brands b where b.id = brand_id and b.user_id = (select auth.uid()))
  );
create policy "audiences: owner can update" on public.audiences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "audiences: owner can delete" on public.audiences
  for delete to authenticated
  using ((select auth.uid()) = user_id);
