-- Growth (P5.1 invites and partner commissions, P5.2 coupons). Writes happen on the server with the
-- secret key; users only read their own rows. No SECURITY DEFINER functions.

-- New ledger reasons.
alter table public.credit_ledger drop constraint if exists credit_ledger_reason_check;
alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason in ('signup_bonus', 'analysis', 'purchase', 'refund', 'admin_adjustment', 'generation', 'coupon_bonus', 'referral_bonus', 'referral_clawback'));

-- Coupons ------------------------------------------------------------------------------------
-- kind: bonus_credits (value = credits), percent (value = 1..100), fixed (value = kuruş).
-- Shopier uses fixed payment links per package, so the price cannot be changed per order: only
-- bonus_credits coupons can be redeemed today (see docs/DURUM.md).
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'),
  kind text not null check (kind in ('bonus_credits', 'percent', 'fixed')),
  value integer not null check (value > 0),
  package_ids text[] not null default '{}',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions > 0),
  per_user_limit integer not null default 1 check (per_user_limit between 1 and 100),
  campaign_label text check (char_length(campaign_label) <= 120),
  active boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check (expires_at is null or expires_at > starts_at)
);
alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null,
  status text not null default 'reserved' check (status in ('reserved', 'applied', 'released')),
  purchase_ref text unique,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index coupon_redemptions_coupon_id_idx on public.coupon_redemptions (coupon_id);
create index coupon_redemptions_user_id_idx on public.coupon_redemptions (user_id, status);
alter table public.coupon_redemptions enable row level security;
revoke all on public.coupon_redemptions from anon, authenticated;
grant select on public.coupon_redemptions to authenticated;
create policy "coupon_redemptions: owner reads" on public.coupon_redemptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomic reservation: locks the coupon row so total and per-user limits hold under concurrency.
-- Invoker rights; only the service role may execute it.
create function public.reserve_coupon(p_code text, p_user_id uuid, p_package_id text)
returns table (status text, redemption_id uuid, kind text, value integer)
language plpgsql security invoker set search_path = '' as $$
declare
  c public.coupons%rowtype;
  v_total integer;
  v_mine integer;
  v_id uuid;
begin
  select * into c from public.coupons where code = upper(p_code) for update;
  if not found or not c.active or c.starts_at > now() or (c.expires_at is not null and c.expires_at <= now()) then
    return query select 'invalid'::text, null::uuid, null::text, null::integer; return;
  end if;
  if cardinality(c.package_ids) > 0 and not (p_package_id = any (c.package_ids)) then
    return query select 'wrong_package'::text, null::uuid, c.kind, c.value; return;
  end if;
  if c.kind <> 'bonus_credits' then
    return query select 'unsupported'::text, null::uuid, c.kind, c.value; return;
  end if;
  -- Stale reservations of this user for this coupon are released so they stop counting.
  update public.coupon_redemptions set status = 'released' where coupon_id = c.id and user_id = p_user_id and status = 'reserved' and created_at <= now() - interval '2 days';
  -- An open reservation of the same user for this coupon is reused (moved to the new package).
  -- Reservations older than two days no longer hold a place (the buyer did not complete the order).
  select r.id into v_id from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_user_id and r.status = 'reserved' and r.created_at > now() - interval '2 days' limit 1;
  if v_id is not null then
    update public.coupon_redemptions set package_id = p_package_id, created_at = now() where id = v_id;
    return query select 'ok'::text, v_id, c.kind, c.value; return;
  end if;
  select count(*) into v_mine from public.coupon_redemptions r where r.coupon_id = c.id and r.user_id = p_user_id and (r.status = 'applied' or (r.status = 'reserved' and r.created_at > now() - interval '2 days'));
  if v_mine >= c.per_user_limit then
    return query select 'used'::text, null::uuid, c.kind, c.value; return;
  end if;
  select count(*) into v_total from public.coupon_redemptions r where r.coupon_id = c.id and (r.status = 'applied' or (r.status = 'reserved' and r.created_at > now() - interval '2 days'));
  if c.max_redemptions is not null and v_total >= c.max_redemptions then
    return query select 'exhausted'::text, null::uuid, c.kind, c.value; return;
  end if;
  insert into public.coupon_redemptions (coupon_id, user_id, package_id) values (c.id, p_user_id, p_package_id) returning id into v_id;
  return query select 'ok'::text, v_id, c.kind, c.value;
end;
$$;
revoke all on function public.reserve_coupon(text, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_coupon(text, uuid, text) to service_role;

-- Invites and partner codes ---------------------------------------------------------------------
create table public.invite_codes (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invite', 'partner')),
  code text not null unique check (code ~ '^[A-Z0-9-]{6,16}$'),
  -- Partner commission in basis points (2000 = %20); null for invite codes.
  commission_bp integer check (commission_bp between 1 and 5000),
  created_at timestamptz not null default now(),
  primary key (user_id, kind),
  check ((kind = 'partner') = (commission_bp is not null))
);
alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;
grant select on public.invite_codes to authenticated;
create policy "invite_codes: owner reads" on public.invite_codes
  for select to authenticated using ((select auth.uid()) = user_id);

create table public.referrals (
  invitee_id uuid primary key references auth.users (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invite', 'partner')),
  rewarded_at timestamptz,
  reward_ref text,
  clawed_back_at timestamptz,
  created_at timestamptz not null default now(),
  check (invitee_id <> inviter_id)
);
create index referrals_inviter_id_idx on public.referrals (inviter_id);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;
create policy "referrals: inviter or invitee reads" on public.referrals
  for select to authenticated using ((select auth.uid()) = inviter_id or (select auth.uid()) = invitee_id);

-- SHA-256 of e-mail addresses that were already invited, so a deleted and re-created account
-- cannot be invited again. Service role only.
create table public.referral_email_claims (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_email_claims enable row level security;
revoke all on public.referral_email_claims from anon, authenticated;

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid references auth.users (id) on delete set null,
  purchase_ref text not null unique,
  amount_minor integer not null check (amount_minor >= 0),
  commission_bp integer not null check (commission_bp between 1 and 5000),
  commission_minor integer not null check (commission_minor >= 0),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'reversed')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index affiliate_commissions_partner_id_idx on public.affiliate_commissions (partner_id, created_at desc);
create index affiliate_commissions_invitee_id_idx on public.affiliate_commissions (invitee_id);
alter table public.affiliate_commissions enable row level security;
revoke all on public.affiliate_commissions from anon, authenticated;
grant select (id, partner_id, purchase_ref, amount_minor, commission_bp, commission_minor, currency, status, is_demo, created_at) on public.affiliate_commissions to authenticated;
create policy "affiliate_commissions: partner reads" on public.affiliate_commissions
  for select to authenticated using ((select auth.uid()) = partner_id);
