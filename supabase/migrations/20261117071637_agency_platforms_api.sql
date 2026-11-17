-- Agency mode, platform rule sets, finding feedback, lawyer review links, regulation newsletter, API keys.
--
-- Access model stays the same: users read their own rows; anything that touches credits, scores or
-- another user's data is written by the server with the service role. New in this migration:
--   * team members (viewer role) can READ the owner's brands and analyses (and their files),
--   * a lawyer review link is a random token whose SHA-256 is stored; the page is served by the server.

-- brands: voice notes, banned words, preferred CTA, logo ----------------------------
alter table public.brands
  add column banned_words text[] not null default '{}'
    check (cardinality(banned_words) <= 50 and char_length(array_to_string(banned_words, ',')) <= 1500),
  add column voice_notes text check (char_length(voice_notes) <= 600),
  add column preferred_cta text check (char_length(preferred_cta) <= 140),
  -- Set only by the server after an upload into the owner's own storage folder.
  add column logo_path text check (char_length(logo_path) <= 300),
  add column logo_mime text check (logo_mime in ('image/png', 'image/jpeg', 'image/webp'));

-- Users may not point logo_path at an arbitrary object: column-level grants exclude it.
revoke insert, update on public.brands from authenticated;
grant insert (user_id, name, sector, tone, banned_words, voice_notes, preferred_cta) on public.brands to authenticated;
grant update (name, sector, tone, banned_words, voice_notes, preferred_cta) on public.brands to authenticated;

-- platforms: Meta (default), Google Ads, TikTok ----------------------------------------
alter table public.analyses
  add column platform text not null default 'meta' check (platform in ('meta', 'google_ads', 'tiktok'));
-- Which ad platform a rule card belongs to; Turkish law cards apply everywhere ('all').
alter table public.rule_cards
  add column platform text not null default 'all' check (platform in ('all', 'meta', 'google_ads', 'tiktok'));
create index rule_cards_platform_idx on public.rule_cards (platform);

-- team members (agency mode) ---------------------------------------------------------
create table public.team_members (
  owner_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer')),
  member_email text not null check (char_length(member_email) between 3 and 320),
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  constraint team_members_not_self check (owner_id <> member_id)
);
create index team_members_member_id_idx on public.team_members (member_id);
alter table public.team_members enable row level security;
grant select, delete on public.team_members to authenticated;
create policy "team_members: owner or member can read" on public.team_members
  for select to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = member_id);
create policy "team_members: owner removes, member leaves" on public.team_members
  for delete to authenticated
  using ((select auth.uid()) = owner_id or (select auth.uid()) = member_id);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320 and email = lower(email)),
  token_hash text not null unique check (char_length(token_hash) = 64),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint team_invites_ttl check (expires_at <= created_at + interval '15 days')
);
create index team_invites_owner_id_idx on public.team_invites (owner_id);
alter table public.team_invites enable row level security;
grant select, insert, delete on public.team_invites to authenticated;
create policy "team_invites: owner can read" on public.team_invites
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "team_invites: owner can create" on public.team_invites
  for insert to authenticated with check ((select auth.uid()) = owner_id and accepted_at is null);
create policy "team_invites: owner can delete" on public.team_invites
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- Read access for team members (viewer) on the owner's data ----------------------------
-- One select policy per table (owner or viewer), so Postgres evaluates a single permissive policy.
drop policy "brands: owner can read" on public.brands;
create policy "brands: owner or team can read" on public.brands
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = brands.user_id and m.member_id = (select auth.uid()))
  );
drop policy "analyses: owner can read" on public.analyses;
create policy "analyses: owner or team can read" on public.analyses
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = analyses.user_id and m.member_id = (select auth.uid()))
  );
drop policy "analysis_assets: owner can read" on public.analysis_assets;
create policy "analysis_assets: owner or team can read" on public.analysis_assets
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = analysis_assets.user_id and m.member_id = (select auth.uid()))
  );
drop policy "findings: owner can read" on public.findings;
create policy "findings: owner or team can read" on public.findings
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = findings.user_id and m.member_id = (select auth.uid()))
  );
drop policy "generated_variants: owner can read" on public.generated_variants;
create policy "generated_variants: owner or team can read" on public.generated_variants
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = generated_variants.user_id and m.member_id = (select auth.uid()))
  );
drop policy "appeal_drafts: owner can read" on public.appeal_drafts;
create policy "appeal_drafts: owner or team can read" on public.appeal_drafts
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.team_members m where m.owner_id = appeal_drafts.user_id and m.member_id = (select auth.uid()))
  );
create policy "creatives: team can read owner files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'creatives'
    and exists (
      select 1 from public.team_members m
      where m.owner_id::text = (storage.foldername(name))[1] and m.member_id = (select auth.uid())
    )
  );

-- finding feedback ("bu uyarı yanlış") --------------------------------------------------
create table public.finding_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  finding_id uuid not null references public.findings (id) on delete cascade,
  -- Copied from the finding by a trigger so rule quality can be reviewed per rule version.
  rule_version_id uuid references public.rule_versions (id) on delete set null,
  verdict text not null check (verdict in ('wrong', 'unclear', 'helpful')),
  reason text check (reason in ('not_in_ad', 'context_ok', 'rule_outdated', 'other')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, finding_id)
);
create index finding_feedback_analysis_id_idx on public.finding_feedback (analysis_id);
create index finding_feedback_finding_id_idx on public.finding_feedback (finding_id);
create index finding_feedback_rule_version_id_idx on public.finding_feedback (rule_version_id);
alter table public.finding_feedback enable row level security;
grant select, insert, update on public.finding_feedback to authenticated;
revoke update on public.finding_feedback from authenticated;
grant update (verdict, reason, note, updated_at) on public.finding_feedback to authenticated;
create policy "finding_feedback: owner can read" on public.finding_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "finding_feedback: owner of the finding can create" on public.finding_feedback
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.findings f
      where f.id = finding_id and f.analysis_id = finding_feedback.analysis_id and f.user_id = (select auth.uid())
    )
  );
create policy "finding_feedback: owner can update" on public.finding_feedback
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function app_private.finding_feedback_fill()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  select f.rule_version_id into new.rule_version_id from public.findings f where f.id = new.finding_id;
  new.updated_at := now();
  return new;
end;
$$;
create trigger finding_feedback_fill
  before insert or update on public.finding_feedback
  for each row execute function app_private.finding_feedback_fill();

-- lawyer review links ("avukat incelemesine gönder") -------------------------------------
create table public.review_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  note text check (char_length(note) <= 500),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint review_shares_ttl check (expires_at <= created_at + interval '31 days')
);
create index review_shares_analysis_id_idx on public.review_shares (analysis_id);
create index review_shares_user_id_idx on public.review_shares (user_id);
alter table public.review_shares enable row level security;
grant select, insert on public.review_shares to authenticated;
grant update (revoked_at) on public.review_shares to authenticated;
create policy "review_shares: owner can read" on public.review_shares
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "review_shares: owner of the analysis can create" on public.review_shares
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and revoked_at is null
    and view_count = 0
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid()) and a.status = 'completed')
  );
create policy "review_shares: owner can revoke" on public.review_shares
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- monthly regulation newsletter ---------------------------------------------------------
create table public.newsletter_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  sent_at timestamptz not null default now(),
  primary key (user_id, period)
);
alter table public.newsletter_log enable row level security;
grant select on public.newsletter_log to authenticated;
create policy "newsletter_log: owner can read" on public.newsletter_log
  for select to authenticated using ((select auth.uid()) = user_id);

-- API keys (enterprise API) ---------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- First characters of the key, shown in the panel so a key can be recognised. Never the full key.
  key_prefix text not null check (char_length(key_prefix) between 8 and 16),
  key_hash text not null unique check (char_length(key_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_user_id_idx on public.api_keys (user_id);
alter table public.api_keys enable row level security;
grant select, insert on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
create policy "api_keys: owner can read" on public.api_keys
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "api_keys: owner can create" on public.api_keys
  for insert to authenticated
  with check ((select auth.uid()) = user_id and revoked_at is null and last_used_at is null);
create policy "api_keys: owner can revoke" on public.api_keys
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on
  public.team_members, public.team_invites, public.finding_feedback, public.review_shares,
  public.newsletter_log, public.api_keys
  to service_role;

-- Inspiration board: ads the user saved from the Meta Ad Library -------------------------
-- Only the public library fields the user chose to keep (page name, ad text). No snapshot URL,
-- because Meta's snapshot links carry the access token.
create table public.inspiration_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ad_archive_id text not null check (ad_archive_id ~ '^[0-9]{1,30}$'),
  page_name text not null default '' check (char_length(page_name) <= 200),
  title text not null default '' check (char_length(title) <= 300),
  body text not null default '' check (char_length(body) <= 2200),
  country text not null check (country ~ '^[A-Z]{2}$'),
  delivery_start date,
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (user_id, ad_archive_id)
);
alter table public.inspiration_pins enable row level security;
grant select, insert, delete on public.inspiration_pins to authenticated;
grant select, insert, update, delete on public.inspiration_pins to service_role;
create policy "inspiration_pins: owner can read" on public.inspiration_pins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "inspiration_pins: owner can save" on public.inspiration_pins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "inspiration_pins: owner can delete" on public.inspiration_pins
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Privilege hardening ------------------------------------------------------------------------
-- Supabase's default privileges give anon/authenticated every privilege on new public tables.
-- RLS still applies to rows, but column grants are what stop an owner from rewriting e.g. a key
-- hash or a view counter. Start these tables from zero and grant exactly what the app needs.
revoke all on
  public.season_reminder_log, public.team_members, public.team_invites, public.finding_feedback,
  public.review_shares, public.newsletter_log, public.api_keys, public.inspiration_pins
  from anon, authenticated;

grant select on public.season_reminder_log to authenticated;
grant select, delete on public.team_members to authenticated;
grant select, insert, delete on public.team_invites to authenticated;
grant select, insert on public.finding_feedback to authenticated;
grant update (verdict, reason, note, updated_at) on public.finding_feedback to authenticated;
grant select, insert on public.review_shares to authenticated;
grant update (revoked_at) on public.review_shares to authenticated;
grant select on public.newsletter_log to authenticated;
grant select, insert on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;
grant select, insert, delete on public.inspiration_pins to authenticated;

-- Future tables: no automatic grants for client roles; every migration grants explicitly.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
