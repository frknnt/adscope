-- Competitor watch (P4.2): up to 10 Ad Library search terms per user, checked weekly by cron.
-- Users add and remove terms; only the server (service role) writes check results.
-- ad_snapshot_url is never stored (Meta embeds the access token in it).
create table public.competitor_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  term text not null check (char_length(term) between 2 and 100),
  country text not null check (country ~ '^[A-Z]{2}$'),
  -- Ad Library ids already seen, so "new this week" can be counted (capped by the app).
  seen_ids text[] not null default '{}' check (cardinality(seen_ids) <= 1000),
  last_checked_at timestamptz,
  -- { newCount, activeCount, longest: [{ id, pageName, title, body, deliveryStart, days, libraryUrl }] }
  last_summary jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, term, country)
);
create index competitor_watches_user_id_idx on public.competitor_watches (user_id);

alter table public.competitor_watches enable row level security;
revoke all on public.competitor_watches from anon, authenticated;
grant select (id, user_id, term, country, last_checked_at, last_summary, created_at), delete on public.competitor_watches to authenticated;
grant insert (user_id, term, country) on public.competitor_watches to authenticated;

create policy "competitor_watches: owner reads" on public.competitor_watches
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "competitor_watches: owner inserts" on public.competitor_watches
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "competitor_watches: owner deletes" on public.competitor_watches
  for delete to authenticated using ((select auth.uid()) = user_id);
