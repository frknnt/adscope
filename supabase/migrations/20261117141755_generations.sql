-- Generations (P1.2 and Faz 2): paid outputs that are not analyses (ad copy, creative downloads,
-- product photos). One row per (user, client request id); the credit is charged in the same
-- transaction that stores the output, so a retried request never pays twice and a failed one never pays.

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_request_id uuid not null,
  kind text not null check (kind in ('copy', 'creative', 'photo', 'tool')),
  brand_id uuid references public.brands (id) on delete set null,
  platform text check (platform in ('meta', 'google_ads', 'tiktok')),
  credit_cost integer not null check (credit_cost between 0 and 20),
  output jsonb not null check (jsonb_typeof(output) = 'object' and pg_column_size(output) <= 200000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  unique (user_id, client_request_id)
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_brand_id_idx on public.generations (brand_id);
create index generations_expires_at_idx on public.generations (expires_at);

alter table public.generations enable row level security;
revoke all on public.generations from anon, authenticated;
grant select, delete on public.generations to authenticated;

create policy "generations: owner can read" on public.generations
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "generations: owner can delete" on public.generations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Ledger: a new reason and a link to the generation -----------------------------------------
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('signup_bonus', 'analysis', 'purchase', 'refund', 'admin_adjustment', 'generation'));
alter table public.credit_ledger add column generation_id uuid references public.generations (id) on delete set null;
create index credit_ledger_generation_id_idx on public.credit_ledger (generation_id);

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
       or (new.generation_id is distinct from old.generation_id and new.generation_id is not null)
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

-- record_generation: idempotent store-and-charge ----------------------------------------------
create or replace function public.record_generation(
  p_user_id uuid,
  p_client_request_id uuid,
  p_kind text,
  p_credit_cost integer,
  p_brand_id uuid,
  p_platform text,
  p_output jsonb
)
returns table (generation_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_balance integer;
begin
  if p_credit_cost < 0 or p_credit_cost > 20 then
    raise exception 'invalid_cost' using errcode = '22023';
  end if;
  -- Same lock order as start_analysis / complete_analysis: the owner's profile first.
  perform 1 from public.profiles p where p.id = p_user_id for update;

  select g.id into v_id from public.generations g
  where g.user_id = p_user_id and g.client_request_id = p_client_request_id;
  if found then
    return query select v_id, 'exists'::text;
    return;
  end if;

  if p_brand_id is not null and not exists (
    select 1 from public.brands b where b.id = p_brand_id and b.user_id = p_user_id
  ) then
    return query select null::uuid, 'brand_not_found'::text;
    return;
  end if;

  if p_credit_cost > 0 then
    select coalesce(sum(l.delta), 0) into v_balance from public.credit_ledger l where l.user_id = p_user_id;
    if v_balance < p_credit_cost then
      return query select null::uuid, 'insufficient_credits'::text;
      return;
    end if;
  end if;

  insert into public.generations (user_id, client_request_id, kind, brand_id, platform, credit_cost, output)
  values (p_user_id, p_client_request_id, p_kind, p_brand_id, p_platform, p_credit_cost, p_output)
  returning id into v_id;

  if p_credit_cost > 0 then
    insert into public.credit_ledger (user_id, delta, reason, idempotency_key, generation_id)
    values (p_user_id, -p_credit_cost, 'generation', 'generation:' || v_id::text, v_id);
  end if;

  return query select v_id, 'created'::text;
end;
$$;
revoke all on function public.record_generation(uuid, uuid, text, integer, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_generation(uuid, uuid, text, integer, uuid, text, jsonb) to service_role;
