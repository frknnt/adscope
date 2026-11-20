-- P12.3 Ajans aylık paketi: ödenen her ay için bir dönem; kendiliğinden yenilenmez.
-- Shopier'in tekrarlayan ödeme desteği resmî belgede doğrulanamadı; yenileme hatırlatma e-postası ve
-- tek tıkla yeni ödeme ile yapılır. Krediler kredi defterine ayrı nedenle ("monthly_credits") yazılır.

alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('signup_bonus', 'analysis', 'purchase', 'monthly_credits', 'refund', 'admin_adjustment', 'generation', 'coupon_bonus', 'referral_bonus', 'referral_clawback'));

create table public.plan_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purchase_event_id uuid not null unique references public.purchase_events (id) on delete cascade,
  package_id text not null check (package_id in ('ajans_3', 'ajans_5', 'ajans_10')),
  brands integer not null check (brands in (3, 5, 10)),
  credits integer not null check (credits > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'refunded')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_periods_order check (ends_at > starts_at)
);
create index plan_periods_user_idx on public.plan_periods (user_id, ends_at desc);
create index plan_periods_due_idx on public.plan_periods (ends_at) where status = 'active' and reminder_sent_at is null;

alter table public.plan_periods enable row level security;
revoke all on public.plan_periods from anon, authenticated;
-- The owner reads their own periods; every write is the server's (apply_purchase_event, refunds, reminders).
grant select on public.plan_periods to authenticated;
grant select, insert, update, delete on public.plan_periods to service_role;
create policy "plan_periods: owner can read" on public.plan_periods
  for select to authenticated using ((select auth.uid()) = user_id);

-- apply_purchase_event: same idempotency as before; an agency package also opens one period in the same
-- transaction (the profile row lock serialises purchases of one user, so periods never overlap).
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
  v_plan boolean := p_package_id in ('ajans_3', 'ajans_5', 'ajans_10');
  v_brands integer;
  v_start timestamptz;
begin
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

  if v_plan then
    v_brands := split_part(p_package_id, '_', 2)::integer;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, idempotency_key, purchase_event_id, note)
  values (
    p_user_id, p_credits,
    case when v_plan then 'monthly_credits' else 'purchase' end,
    'purchase:' || p_provider || ':' || coalesce(nullif(p_order_id, ''), p_event_id),
    v_event_id,
    case
      when v_plan then 'Ajans aylık paketi (' || v_brands || ' marka)' || case when p_is_demo then ', demo (gerçek ödeme alınmadı)' else '' end
      when p_is_demo then 'Demo satın alma (gerçek ödeme alınmadı)'
      else 'Kredi paketi satın alımı'
    end
  )
  on conflict (idempotency_key) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is null then
    update public.purchase_events set status = 'ignored' where id = v_event_id;
    return query select false, v_event_id;
    return;
  end if;

  if v_plan then
    select greatest(now(), coalesce(max(pp.ends_at), now())) into v_start
    from public.plan_periods pp
    where pp.user_id = p_user_id and pp.status = 'active';
    insert into public.plan_periods (user_id, purchase_event_id, package_id, brands, credits, starts_at, ends_at)
    values (p_user_id, v_event_id, p_package_id, v_brands, p_credits, v_start, v_start + interval '1 month');
  end if;

  return query select true, v_event_id;
end;
$$;
revoke all on function public.apply_purchase_event(text, text, text, uuid, text, integer, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.apply_purchase_event(text, text, text, uuid, text, integer, integer, text, boolean) to service_role;
