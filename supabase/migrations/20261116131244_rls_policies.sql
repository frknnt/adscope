-- Row Level Security for every table in the exposed `public` schema.
-- Model: a signed-in user can read only their own rows. Writes that affect scores,
-- credits or purchases happen only through server code using the secret key
-- (service_role) via the functions in the next migration, so clients get SELECT
-- (and narrowly scoped UPDATE/DELETE) only.
--
-- New tables are not auto-exposed to the Data API on current Supabase projects,
-- so grants are explicit and bundled with RLS here.

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.rule_cards enable row level security;
alter table public.rule_versions enable row level security;
alter table public.analyses enable row level security;
alter table public.analysis_assets enable row level security;
alter table public.findings enable row level security;
alter table public.generated_variants enable row level security;
alter table public.appeal_drafts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.purchase_events enable row level security;
alter table public.ai_runs enable row level security;
alter table public.user_consents enable row level security;

-- Start from zero, then grant exactly what is needed.
revoke all on all tables in schema public from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.brands to authenticated;
grant select on public.rule_cards, public.rule_versions to anon, authenticated;
grant select, delete on public.analyses to authenticated;
grant select on public.analysis_assets to authenticated;
grant select on public.findings to authenticated;
grant select on public.generated_variants to authenticated;
grant select on public.appeal_drafts to authenticated;
grant select on public.credit_ledger to authenticated;
grant select on public.purchase_events to authenticated;
grant select on public.ai_runs to authenticated;
grant select, insert on public.user_consents to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant usage on sequence public.user_consents_id_seq to authenticated;

-- profiles ------------------------------------------------------------------
create policy "profiles: owner can read" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Users may not change retention outside allowed range (check constraint) and
-- may only update a few columns.
revoke update on public.profiles from authenticated;
grant update (display_name, company_name, default_sector, onboarding_completed_at, retention_days)
  on public.profiles to authenticated;

-- brands --------------------------------------------------------------------
create policy "brands: owner can read" on public.brands
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "brands: owner can insert" on public.brands
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "brands: owner can update" on public.brands
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "brands: owner can delete" on public.brands
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- rule cards: public reference data, but only published (non-draft) versions
create policy "rule_cards: readable" on public.rule_cards
  for select to anon, authenticated
  using (true);

create policy "rule_versions: published readable" on public.rule_versions
  for select to anon, authenticated
  using (status in ('active', 'requires_review', 'retired'));

-- analyses ------------------------------------------------------------------
create policy "analyses: owner can read" on public.analyses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "analyses: owner can delete" on public.analyses
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- child tables: owner read-only ----------------------------------------------
create policy "analysis_assets: owner can read" on public.analysis_assets
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "findings: owner can read" on public.findings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "generated_variants: owner can read" on public.generated_variants
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "appeal_drafts: owner can read" on public.appeal_drafts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "credit_ledger: owner can read" on public.credit_ledger
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "purchase_events: owner can read" on public.purchase_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "ai_runs: owner can read" on public.ai_runs
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- consents: append-only by the owner -----------------------------------------
create policy "user_consents: owner can read" on public.user_consents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "user_consents: owner can insert" on public.user_consents
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
