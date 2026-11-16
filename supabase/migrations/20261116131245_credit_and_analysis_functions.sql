-- Credit + analysis lifecycle functions.
--
-- Guarantees:
--  * Signup bonus (3 credits) is granted exactly once per user (unique idempotency key).
--  * The ledger is append-only: no updates (except FK nulling) and no deletes while the account exists.
--  * A credit is consumed only when an analysis completes, atomically with writing its results.
--  * Per-user row lock on profiles serialises concurrent credit operations (double click, parallel tabs).
--  * Purchase webhooks are idempotent on (provider, event id) AND on the order id.
--
-- Mutating functions live in `public` so the server can call them through the Data API with the
-- secret key, but EXECUTE is revoked from PUBLIC/anon/authenticated and granted to service_role only.
-- They are SECURITY INVOKER; service_role already bypasses RLS.

-- ---------------------------------------------------------------------------
-- New user bootstrap (profile + one-time signup bonus)
-- ---------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bonus integer := 3;
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason, idempotency_key, note)
  values (new.id, v_bonus, 'signup_bonus', 'signup_bonus:' || new.id::text, 'Kayıt hediyesi: 3 ücretsiz analiz')
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Ledger immutability
-- ---------------------------------------------------------------------------
create or replace function app_private.protect_credit_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- Only FK maintenance (ON DELETE SET NULL) may touch a ledger row.
    if new.user_id is distinct from old.user_id
       or new.delta is distinct from old.delta
       or new.reason is distinct from old.reason
       or new.idempotency_key is distinct from old.idempotency_key
       or new.note is distinct from old.note
       or new.created_at is distinct from old.created_at
       or (new.analysis_id is distinct from old.analysis_id and new.analysis_id is not null)
       or (new.purchase_event_id is distinct from old.purchase_event_id and new.purchase_event_id is not null)
    then
      raise exception 'credit_ledger is append-only' using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Rows disappear only together with the account (cascade from auth.users).
    if exists (select 1 from auth.users u where u.id = old.user_id) then
      raise exception 'credit_ledger is append-only' using errcode = '42501';
    end if;
    return old;
  end if;
  return null;
end;
$$;
revoke all on function app_private.protect_credit_ledger() from public, anon, authenticated;

create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function app_private.protect_credit_ledger();

-- ---------------------------------------------------------------------------
-- Balance (computed from the ledger; RLS limits rows to the caller)
-- ---------------------------------------------------------------------------
create or replace function public.get_credit_balance()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(l.delta), 0)::integer
  from public.credit_ledger l
  where l.user_id = (select auth.uid());
$$;
revoke all on function public.get_credit_balance() from public, anon;
grant execute on function public.get_credit_balance() to authenticated;

-- ---------------------------------------------------------------------------
-- start_analysis: idempotent creation with balance + rate-limit checks
-- ---------------------------------------------------------------------------
create or replace function public.start_analysis(
  p_user_id uuid,
  p_client_request_id uuid,
  p_brand_id uuid,
  p_sector text,
  p_headline text,
  p_primary_text text,
  p_description text,
  p_rejection_message text,
  p_demo boolean,
  p_hourly_limit integer default 20
)
returns table (analysis_id uuid, status text, created boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing record;
  v_balance integer;
  v_recent integer;
  v_retention integer;
  v_id uuid;
begin
  -- serialise per user
  select p.retention_days into v_retention
  from public.profiles p where p.id = p_user_id
  for update;
  if not found then
    raise exception 'profile_missing' using errcode = 'P0002';
  end if;

  select a.id, a.status into v_existing
  from public.analyses a
  where a.user_id = p_user_id and a.client_request_id = p_client_request_id;
  if found then
    return query select v_existing.id, v_existing.status, false;
    return;
  end if;

  select coalesce(sum(l.delta), 0) into v_balance
  from public.credit_ledger l where l.user_id = p_user_id;
  if v_balance < 1 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  select count(*) into v_recent
  from public.analyses a
  where a.user_id = p_user_id and a.created_at > now() - interval '1 hour';
  if v_recent >= p_hourly_limit then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_brand_id is not null and not exists (
    select 1 from public.brands b where b.id = p_brand_id and b.user_id = p_user_id
  ) then
    raise exception 'brand_not_found' using errcode = 'P0001';
  end if;

  insert into public.analyses (
    user_id, brand_id, client_request_id, sector, headline, primary_text, description,
    rejection_message, demo, expires_at
  ) values (
    p_user_id, p_brand_id, p_client_request_id, p_sector, coalesce(p_headline, ''), p_primary_text,
    coalesce(p_description, ''), nullif(p_rejection_message, ''), p_demo,
    now() + make_interval(days => v_retention)
  )
  returning id into v_id;

  return query select v_id, 'processing'::text, true;
end;
$$;
revoke all on function public.start_analysis(uuid, uuid, uuid, text, text, text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.start_analysis(uuid, uuid, uuid, text, text, text, text, text, boolean, integer) to service_role;

-- ---------------------------------------------------------------------------
-- complete_analysis: write results + consume exactly one credit, atomically
-- ---------------------------------------------------------------------------
create or replace function public.complete_analysis(p_analysis_id uuid, p_result jsonb)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_analysis record;
  v_status text;
  v_balance integer;
  v_finding jsonb;
  v_variant jsonb;
  v_pos integer := 0;
begin
  select a.id, a.user_id, a.status into v_analysis
  from public.analyses a where a.id = p_analysis_id;
  if not found then
    raise exception 'analysis_not_found' using errcode = 'P0002';
  end if;

  -- lock the owner's profile first (same order as start_analysis -> no deadlock)
  perform 1 from public.profiles p where p.id = v_analysis.user_id for update;

  select a.status into v_status from public.analyses a where a.id = p_analysis_id for update;
  if v_status = 'completed' then
    return 'already_completed';
  elsif v_status = 'failed' then
    return 'already_failed';
  end if;

  select coalesce(sum(l.delta), 0) into v_balance
  from public.credit_ledger l where l.user_id = v_analysis.user_id;
  if v_balance < 1 then
    update public.analyses set status = 'failed', failure_code = 'insufficient_credits', completed_at = now()
    where id = p_analysis_id;
    return 'insufficient_credits';
  end if;

  for v_finding in select * from jsonb_array_elements(coalesce(p_result -> 'findings', '[]'::jsonb)) loop
    insert into public.findings (
      analysis_id, user_id, rule_version_id, domain, severity, field, matched_text,
      title, explanation, suggestion, origin, position
    ) values (
      p_analysis_id, v_analysis.user_id,
      nullif(v_finding ->> 'rule_version_id', '')::uuid,
      v_finding ->> 'domain', v_finding ->> 'severity', v_finding ->> 'field',
      left(v_finding ->> 'matched_text', 500),
      v_finding ->> 'title', v_finding ->> 'explanation', v_finding ->> 'suggestion',
      coalesce(v_finding ->> 'origin', 'rule_engine'), v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  for v_variant in select * from jsonb_array_elements(coalesce(p_result -> 'variants', '[]'::jsonb)) loop
    insert into public.generated_variants (
      analysis_id, user_id, kind, position, tone, headline, primary_text, description,
      recheck_red, recheck_yellow
    ) values (
      p_analysis_id, v_analysis.user_id, v_variant ->> 'kind', (v_variant ->> 'position')::integer,
      v_variant ->> 'tone', v_variant ->> 'headline', v_variant ->> 'primary_text',
      coalesce(v_variant ->> 'description', ''),
      coalesce((v_variant ->> 'recheck_red')::integer, 0),
      coalesce((v_variant ->> 'recheck_yellow')::integer, 0)
    );
  end loop;

  if p_result ? 'appeal' and jsonb_typeof(p_result -> 'appeal') = 'object' then
    insert into public.appeal_drafts (
      analysis_id, user_id, rejection_message, detected_policies, recommendation,
      explanation_tr, draft_tr, draft_en, checklist
    ) values (
      p_analysis_id, v_analysis.user_id,
      p_result -> 'appeal' ->> 'rejection_message',
      coalesce(array(select jsonb_array_elements_text(p_result -> 'appeal' -> 'detected_policies')), '{}'),
      p_result -> 'appeal' ->> 'recommendation',
      p_result -> 'appeal' ->> 'explanation_tr',
      p_result -> 'appeal' ->> 'draft_tr',
      p_result -> 'appeal' ->> 'draft_en',
      coalesce(p_result -> 'appeal' -> 'checklist', '[]'::jsonb)
    );
  end if;

  update public.analyses set
    status = 'completed',
    meta_risk_score = (p_result ->> 'meta_risk_score')::integer,
    meta_risk_level = p_result ->> 'meta_risk_level',
    legal_risk_level = p_result ->> 'legal_risk_level',
    legal_finding_count = (p_result ->> 'legal_finding_count')::integer,
    creative_score = (p_result ->> 'creative_score')::integer,
    score_breakdown = p_result -> 'score_breakdown',
    safe_text = p_result ->> 'safe_text',
    engine_version = p_result ->> 'engine_version',
    ai_provider = p_result ->> 'ai_provider',
    completed_at = now()
  where id = p_analysis_id;

  insert into public.credit_ledger (user_id, delta, reason, idempotency_key, analysis_id, note)
  values (v_analysis.user_id, -1, 'analysis', 'analysis:' || p_analysis_id::text, p_analysis_id, 'Analiz tamamlandı');

  return 'completed';
end;
$$;
revoke all on function public.complete_analysis(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_analysis(uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- fail_analysis: mark failed; never touches credits
-- ---------------------------------------------------------------------------
create or replace function public.fail_analysis(p_analysis_id uuid, p_code text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.analyses
  set status = 'failed', failure_code = left(p_code, 64), completed_at = now()
  where id = p_analysis_id and status = 'processing';
$$;
revoke all on function public.fail_analysis(uuid, text) from public, anon, authenticated;
grant execute on function public.fail_analysis(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- upsert_appeal_draft: regenerate an appeal for an existing completed analysis (no credit)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_appeal_draft(p_analysis_id uuid, p_user_id uuid, p_appeal jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.analyses a
    where a.id = p_analysis_id and a.user_id = p_user_id and a.status = 'completed'
  ) then
    raise exception 'analysis_not_found' using errcode = 'P0002';
  end if;

  insert into public.appeal_drafts (
    analysis_id, user_id, rejection_message, detected_policies, recommendation,
    explanation_tr, draft_tr, draft_en, checklist
  ) values (
    p_analysis_id, p_user_id, p_appeal ->> 'rejection_message',
    coalesce(array(select jsonb_array_elements_text(p_appeal -> 'detected_policies')), '{}'),
    p_appeal ->> 'recommendation', p_appeal ->> 'explanation_tr',
    p_appeal ->> 'draft_tr', p_appeal ->> 'draft_en', coalesce(p_appeal -> 'checklist', '[]'::jsonb)
  )
  on conflict (analysis_id) do update set
    rejection_message = excluded.rejection_message,
    detected_policies = excluded.detected_policies,
    recommendation = excluded.recommendation,
    explanation_tr = excluded.explanation_tr,
    draft_tr = excluded.draft_tr,
    draft_en = excluded.draft_en,
    checklist = excluded.checklist,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.upsert_appeal_draft(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_appeal_draft(uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- apply_purchase_event: idempotent credit top-up from a verified webhook / demo purchase
-- ---------------------------------------------------------------------------
create or replace function public.apply_purchase_event(
  p_provider text,
  p_event_id text,
  p_order_id text,
  p_user_id uuid,
  p_package_id text,
  p_credits integer,
  p_amount_minor integer,
  p_currency text,
  p_is_demo boolean
)
returns table (applied boolean, purchase_event_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_ledger_id bigint;
begin
  -- profiles.id references auth.users(id) on delete cascade, so a profile row means a live user.
  -- (service_role has no privileges on auth.users; this function is SECURITY INVOKER.)
  perform 1 from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  insert into public.purchase_events (
    user_id, provider, provider_event_id, provider_order_id, package_id, credits,
    amount_minor, currency, status, is_demo
  ) values (
    p_user_id, p_provider, p_event_id, p_order_id, p_package_id, p_credits,
    p_amount_minor, upper(p_currency), 'paid', p_is_demo
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select pe.id into v_event_id from public.purchase_events pe
    where pe.provider = p_provider and pe.provider_event_id = p_event_id;
    return query select false, v_event_id;
    return;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, idempotency_key, purchase_event_id, note)
  values (
    p_user_id, p_credits, 'purchase',
    'purchase:' || p_provider || ':' || coalesce(nullif(p_order_id, ''), p_event_id),
    v_event_id,
    case when p_is_demo then 'Demo satın alma (gerçek ödeme alınmadı)' else 'Kredi paketi satın alımı' end
  )
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then
    update public.purchase_events set status = 'ignored' where id = v_event_id;
    return query select false, v_event_id;
    return;
  end if;

  return query select true, v_event_id;
end;
$$;
revoke all on function public.apply_purchase_event(text, text, text, uuid, text, integer, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_purchase_event(text, text, text, uuid, text, integer, integer, text, boolean) to service_role;
