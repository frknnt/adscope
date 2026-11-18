-- Ads Manager report imports (P4.1). The uploaded file is never stored: only per-ad totals.
-- Owner-only. A matched analysis must be the user's own.
create table public.performance_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  period_start date,
  period_end date,
  ad_count integer not null default 0 check (ad_count between 0 and 2000),
  -- Opt-in, off by default: anonymous totals may be used to calibrate creative score weights.
  share_consent boolean not null default false,
  created_at timestamptz not null default now()
);
create index performance_imports_user_id_idx on public.performance_imports (user_id, created_at desc);

create table public.performance_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.performance_imports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ad_name text not null check (char_length(ad_name) between 1 and 200),
  analysis_id uuid references public.analyses (id) on delete set null,
  spend numeric(14, 2) not null default 0 check (spend >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions numeric(14, 2) not null default 0 check (conversions >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0)
);
create index performance_rows_import_id_idx on public.performance_rows (import_id);
create index performance_rows_user_id_idx on public.performance_rows (user_id);
create index performance_rows_analysis_id_idx on public.performance_rows (analysis_id);

alter table public.performance_imports enable row level security;
alter table public.performance_rows enable row level security;
revoke all on public.performance_imports from anon, authenticated;
revoke all on public.performance_rows from anon, authenticated;
grant select, delete on public.performance_imports to authenticated;
grant insert (user_id, label, currency, period_start, period_end, ad_count, share_consent) on public.performance_imports to authenticated;
grant update (share_consent) on public.performance_imports to authenticated;
grant select on public.performance_rows to authenticated;
grant insert (import_id, user_id, ad_name, analysis_id, spend, impressions, clicks, conversions, revenue) on public.performance_rows to authenticated;

create policy "performance_imports: owner reads" on public.performance_imports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "performance_imports: owner inserts" on public.performance_imports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "performance_imports: owner updates consent" on public.performance_imports
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "performance_imports: owner deletes" on public.performance_imports
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "performance_rows: owner reads" on public.performance_rows
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "performance_rows: owner inserts into own import" on public.performance_rows
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.performance_imports i where i.id = import_id and i.user_id = (select auth.uid()))
    and (analysis_id is null or exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid())))
  );
