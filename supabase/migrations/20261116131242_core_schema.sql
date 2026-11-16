-- AdScope core schema
-- All user-owned tables carry user_id (FK to auth.users) so RLS can check row ownership
-- with a single indexed equality predicate.

create extension if not exists pgcrypto with schema extensions;

-- Private schema for helpers that must never be exposed through the Data API.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enum-like domains (text + check constraints keep migrations simple)
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  company_name text check (char_length(company_name) <= 120),
  default_sector text check (default_sector in ('genel','takviye_gida','estetik_klinik')),
  onboarding_completed_at timestamptz,
  retention_days integer not null default 90 check (retention_days between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- brands --------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sector text not null default 'genel' check (sector in ('genel','takviye_gida','estetik_klinik')),
  tone text not null default 'samimi' check (tone in ('samimi','kurumsal','genc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index brands_user_id_idx on public.brands (user_id);

-- rule_cards / rule_versions (shared, read-only reference data) -------------
create table public.rule_cards (
  id text primary key check (id ~ '^[A-Z0-9-]{3,64}$'),
  domain text not null check (domain in ('meta_policy','tr_law','creative_quality')),
  category text not null,
  sector text not null default 'genel' check (sector in ('genel','takviye_gida','estetik_klinik')),
  created_at timestamptz not null default now()
);
create index rule_cards_domain_sector_idx on public.rule_cards (domain, sector);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_card_id text not null references public.rule_cards (id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('active','draft','requires_review','retired')),
  risk_level text not null check (risk_level in ('high','medium','low')),
  title text not null,
  description text not null,
  risky_examples text[] not null default '{}',
  match_patterns text[] not null default '{}',
  safe_replacements jsonb not null default '[]'::jsonb,
  flag_trigger text check (flag_trigger in ('ai_human_character','ai_real_person_copy','influencer_post')),
  safe_fix text not null,
  source_org text not null,
  source_title text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_reference text,
  effective_date date,
  last_verified_at date,
  verification_note text,
  legal_review_status text not null default 'pending' check (legal_review_status in ('pending','reviewed','changes_requested')),
  created_at timestamptz not null default now(),
  unique (rule_card_id, version)
);
create index rule_versions_rule_card_id_idx on public.rule_versions (rule_card_id);
-- Only one active version per card.
create unique index rule_versions_one_active_idx on public.rule_versions (rule_card_id) where status = 'active';

-- analyses ------------------------------------------------------------------
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete set null,
  client_request_id uuid not null,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  failure_code text,
  sector text not null check (sector in ('genel','takviye_gida','estetik_klinik')),
  headline text not null default '' check (char_length(headline) <= 255),
  primary_text text not null check (char_length(primary_text) between 1 and 2200),
  description text not null default '' check (char_length(description) <= 255),
  rejection_message text check (char_length(rejection_message) <= 3000),
  meta_risk_score integer check (meta_risk_score between 0 and 100),
  meta_risk_level text check (meta_risk_level in ('low','medium','high')),
  legal_risk_level text check (legal_risk_level in ('low','medium','high')),
  legal_finding_count integer check (legal_finding_count >= 0),
  creative_score integer check (creative_score between 0 and 100),
  score_breakdown jsonb,
  safe_text text,
  engine_version text,
  ai_provider text,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  -- double-click / retry protection: one analysis per client request id
  unique (user_id, client_request_id),
  constraint analyses_completed_has_scores check (
    status <> 'completed' or (meta_risk_score is not null and creative_score is not null and legal_risk_level is not null)
  )
);
create index analyses_user_created_idx on public.analyses (user_id, created_at desc);
create index analyses_brand_id_idx on public.analyses (brand_id);
create index analyses_expires_at_idx on public.analyses (expires_at) where expires_at is not null;

-- analysis_assets -----------------------------------------------------------
create table public.analysis_assets (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  width integer check (width > 0),
  height integer check (height > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  -- storage path must live under the owner's folder
  constraint analysis_assets_path_owner check (split_part(storage_path, '/', 1) = user_id::text)
);
create index analysis_assets_analysis_id_idx on public.analysis_assets (analysis_id);
create index analysis_assets_user_id_idx on public.analysis_assets (user_id);

-- findings ------------------------------------------------------------------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_version_id uuid references public.rule_versions (id) on delete restrict,
  domain text not null check (domain in ('meta_policy','tr_law','creative_quality')),
  severity text not null check (severity in ('red','yellow','info')),
  field text check (field in ('headline','primary_text','description','image','general')),
  matched_text text check (char_length(matched_text) <= 500),
  title text not null,
  explanation text not null,
  suggestion text not null,
  origin text not null default 'rule_engine' check (origin in ('rule_engine','ai','heuristic')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- A policy / legal finding must always cite a rule version.
  constraint findings_rule_required check (domain = 'creative_quality' or rule_version_id is not null)
);
create index findings_analysis_id_idx on public.findings (analysis_id, position);
create index findings_user_id_idx on public.findings (user_id);
create index findings_rule_version_id_idx on public.findings (rule_version_id);

-- generated_variants --------------------------------------------------------
create table public.generated_variants (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('safe','variant')),
  position integer not null check (position between 0 and 9),
  tone text not null,
  headline text not null,
  primary_text text not null,
  description text not null default '',
  recheck_red integer not null default 0,
  recheck_yellow integer not null default 0,
  created_at timestamptz not null default now(),
  unique (analysis_id, kind, position)
);
create index generated_variants_user_id_idx on public.generated_variants (user_id);

-- appeal_drafts -------------------------------------------------------------
create table public.appeal_drafts (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rejection_message text not null check (char_length(rejection_message) between 1 and 3000),
  detected_policies text[] not null default '{}',
  recommendation text not null check (recommendation in ('appeal','new_ad')),
  explanation_tr text not null,
  draft_tr text not null,
  draft_en text not null,
  checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  -- one appeal draft per analysis; regenerating replaces it via upsert
  unique (analysis_id)
);
create index appeal_drafts_user_id_idx on public.appeal_drafts (user_id);

-- credit_ledger (append-only) ----------------------------------------------
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('signup_bonus','analysis','purchase','refund','admin_adjustment')),
  idempotency_key text not null unique,
  analysis_id uuid references public.analyses (id) on delete set null,
  purchase_event_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_created_idx on public.credit_ledger (user_id, created_at desc);
create index credit_ledger_analysis_id_idx on public.credit_ledger (analysis_id);

-- purchase_events (webhook inbox, idempotent) -------------------------------
create table public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  provider text not null check (provider in ('demo','lemonsqueezy','shopier')),
  provider_event_id text not null,
  provider_order_id text,
  package_id text not null,
  credits integer not null check (credits > 0),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('paid','refunded','ignored')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index purchase_events_user_id_idx on public.purchase_events (user_id, created_at desc);

alter table public.credit_ledger
  add constraint credit_ledger_purchase_event_fk
  foreign key (purchase_event_id) references public.purchase_events (id) on delete set null;
create index credit_ledger_purchase_event_id_idx on public.credit_ledger (purchase_event_id);

-- ai_runs (metadata only: never prompts, creatives or personal data) --------
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  model text,
  purpose text not null check (purpose in ('analysis','appeal')),
  status text not null check (status in ('succeeded','failed','schema_invalid','fallback')),
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_runs_analysis_id_idx on public.ai_runs (analysis_id);
create index ai_runs_user_id_idx on public.ai_runs (user_id, created_at desc);

-- user_consents (append-only) ----------------------------------------------
create table public.user_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in ('terms','kvkk_notice','privacy_policy','marketing_email')),
  document_version text not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index user_consents_user_id_idx on public.user_consents (user_id, consent_type, created_at desc);

-- updated_at helper ----------------------------------------------------------
create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated_at();
create trigger brands_touch before update on public.brands
  for each row execute function app_private.touch_updated_at();
