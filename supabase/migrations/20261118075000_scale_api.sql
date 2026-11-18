-- Scale and enterprise API (P7.1, P7.2). Service-role writes only; users read their own rows.
-- No SECURITY DEFINER functions: the server calls them with the secret key.

-- Shared fixed-window rate limiter -------------------------------------------------------------
-- Keys are hashes (never raw e-mail addresses or IPs).
create table public.rate_limit_buckets (
  key text primary key check (char_length(key) <= 120),
  window_start timestamptz not null,
  count integer not null check (count >= 0)
);
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from anon, authenticated;

create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, retry_after integer)
language sql security invoker set search_path = '' as $$
  insert into public.rate_limit_buckets as b (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    window_start = case when b.window_start <= now() - make_interval(secs => p_window_seconds) then now() else b.window_start end,
    count = case when b.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else b.count + 1 end
  returning b.count <= p_limit,
    greatest(0, ceil(extract(epoch from (b.window_start + make_interval(secs => p_window_seconds) - now()))))::integer;
$$;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- Job queue ---------------------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null check (kind in ('webhook_delivery')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  progress smallint not null default 0 check (progress between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  last_error text check (char_length(last_error) <= 120),
  dedupe_key text unique check (char_length(dedupe_key) <= 200),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_due_idx on public.jobs (run_after) where status in ('queued', 'running');
create index jobs_user_id_idx on public.jobs (user_id, created_at desc);
alter table public.jobs enable row level security;
revoke all on public.jobs from anon, authenticated;
-- Users see the progress of their own jobs, never the payload.
grant select (id, user_id, kind, status, attempts, progress, last_error, created_at, finished_at) on public.jobs to authenticated;
create policy "jobs: owner reads" on public.jobs for select to authenticated using ((select auth.uid()) = user_id);

-- Claims due jobs (queued, or running with an expired lock after a crash). skip locked lets
-- several workers run at once without taking the same job.
create function public.claim_jobs(p_limit integer, p_lock_seconds integer)
returns setof public.jobs
language sql security invoker set search_path = '' as $$
  update public.jobs j set status = 'running', attempts = j.attempts + 1, locked_until = now() + make_interval(secs => p_lock_seconds)
  where j.id in (
    select id from public.jobs
    where (status = 'queued' and run_after <= now()) or (status = 'running' and locked_until < now())
    order by run_after
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;
revoke all on function public.claim_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_jobs(integer, integer) to service_role;

-- Customer webhooks ---------------------------------------------------------------------------------
create table public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  secret text not null check (char_length(secret) between 32 and 128),
  active boolean not null default true,
  last_status text check (char_length(last_status) <= 40),
  last_delivery_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_webhooks_user_id_idx on public.api_webhooks (user_id);
alter table public.api_webhooks enable row level security;
revoke all on public.api_webhooks from anon, authenticated;
-- The signing secret is shown once at creation and is never readable by the client.
grant select (id, user_id, url, active, last_status, last_delivery_at, created_at) on public.api_webhooks to authenticated;
create policy "api_webhooks: owner reads" on public.api_webhooks for select to authenticated using ((select auth.uid()) = user_id);

-- API usage per key and day -------------------------------------------------------------------------
create table public.api_usage (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (key_id, day)
);
create index api_usage_user_id_idx on public.api_usage (user_id, day desc);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;
grant select on public.api_usage to authenticated;
create policy "api_usage: owner reads" on public.api_usage for select to authenticated using ((select auth.uid()) = user_id);

create function public.api_usage_hit(p_key_id uuid, p_user_id uuid)
returns void
language sql security invoker set search_path = '' as $$
  insert into public.api_usage (key_id, user_id, day, count)
  values (p_key_id, p_user_id, (now() at time zone 'Europe/Istanbul')::date, 1)
  on conflict (key_id, day) do update set count = public.api_usage.count + 1;
$$;
revoke all on function public.api_usage_hit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.api_usage_hit(uuid, uuid) to service_role;
