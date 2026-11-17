-- Video costs 2 credits, speech transcript, landing page screenshot fallback, season reminder e-mails.
--
-- Credits: every analysis records its own cost (credit_cost). start_analysis checks the balance against it
-- and complete_analysis consumes exactly that amount, atomically with the results (same idempotency key).

-- analyses ------------------------------------------------------------------
alter table public.analyses
  add column credit_cost smallint not null default 1 check (credit_cost between 1 and 5),
  -- Text produced by the speech-to-text service from the video's audio (separate from what the user typed).
  add column speech_transcript text check (char_length(speech_transcript) <= 6000);

-- analysis_assets: a landing page screenshot (one per analysis) ----------------
alter table public.analysis_assets drop constraint analysis_assets_kind_check;
alter table public.analysis_assets
  add constraint analysis_assets_kind_check check (kind in ('creative', 'video_frame', 'landing_screenshot'));
alter table public.analysis_assets drop constraint analysis_assets_frame_fields;
alter table public.analysis_assets
  add constraint analysis_assets_frame_fields check (
    (kind in ('creative', 'landing_screenshot') and frame_index is null) or (kind = 'video_frame' and frame_index is not null)
  );
create unique index analysis_assets_one_screenshot_idx on public.analysis_assets (analysis_id) where kind = 'landing_screenshot';

-- profiles: opt-in season reminder e-mails -------------------------------------
alter table public.profiles add column season_reminders boolean not null default false;
grant update (season_reminders) on public.profiles to authenticated;

-- season_reminder_log: one e-mail per user per season event (idempotent cron) ---
create table public.season_reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null check (char_length(event_key) <= 80),
  sent_at timestamptz not null default now(),
  primary key (user_id, event_key)
);
alter table public.season_reminder_log enable row level security;
-- Users may see which reminders they were sent; only the server (service role) writes.
grant select on public.season_reminder_log to authenticated;
create policy "season_reminder_log: owner can read" on public.season_reminder_log
  for select to authenticated using ((select auth.uid()) = user_id);

-- start_analysis: now takes the analysis cost ---------------------------------------
drop function public.start_analysis(uuid, uuid, uuid, text, text, text, text, text, boolean, integer);

create function public.start_analysis(
  p_user_id uuid,
  p_client_request_id uuid,
  p_brand_id uuid,
  p_sector text,
  p_headline text,
  p_primary_text text,
  p_description text,
  p_rejection_message text,
  p_demo boolean,
  p_hourly_limit integer default 20,
  p_credit_cost integer default 1
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
  if p_credit_cost is null or p_credit_cost < 1 or p_credit_cost > 5 then
    raise exception 'invalid_cost' using errcode = 'P0001';
  end if;

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
  if v_balance < p_credit_cost then
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
    rejection_message, demo, expires_at, credit_cost
  ) values (
    p_user_id, p_brand_id, p_client_request_id, p_sector, coalesce(p_headline, ''), p_primary_text,
    coalesce(p_description, ''), nullif(p_rejection_message, ''), p_demo,
    now() + make_interval(days => v_retention), p_credit_cost
  )
  returning id into v_id;

  return query select v_id, 'processing'::text, true;
end;
$$;
revoke all on function public.start_analysis(uuid, uuid, uuid, text, text, text, text, text, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.start_analysis(uuid, uuid, uuid, text, text, text, text, text, boolean, integer, integer) to service_role;

-- complete_analysis: consume the analysis' own cost ---------------------------
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
  select a.id, a.user_id, a.status, a.credit_cost, a.media_type into v_analysis
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
  if v_balance < v_analysis.credit_cost then
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
  values (
    v_analysis.user_id, -v_analysis.credit_cost, 'analysis', 'analysis:' || p_analysis_id::text, p_analysis_id,
    case when v_analysis.media_type = 'video' then 'Video analizi tamamlandı' else 'Analiz tamamlandı' end
  );

  return 'completed';
end;
$$;
revoke all on function public.complete_analysis(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_analysis(uuid, jsonb) to service_role;

-- findings: speech-to-text transcript is a separate field ----------------------
alter table public.findings drop constraint findings_field_check;
alter table public.findings
  add constraint findings_field_check check (
    field in ('headline','primary_text','description','image','general','transcript','speech','landing_page','video')
  );
