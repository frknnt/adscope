-- Admin panel (P4.3). Admin actions run on the server with the secret key (service role); there
-- are no SECURITY DEFINER functions. Admin status is app_metadata.role = 'admin' (set by the
-- operator in the Supabase dashboard); user_metadata is never trusted.

-- Audit log: written and read by the service role only. Append-only.
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  -- Plain ids (no foreign keys): the log is append-only and must survive account deletion.
  admin_id uuid not null,
  action text not null check (char_length(action) between 2 and 60),
  target_user_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_admin_id_idx on public.admin_audit_log (admin_id);
create index admin_audit_log_target_user_id_idx on public.admin_audit_log (target_user_id);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
-- No policies: client roles cannot read or write it.

create function app_private.protect_admin_audit_log() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'admin_audit_log is append-only';
end;
$$;
revoke all on function app_private.protect_admin_audit_log() from public, anon, authenticated;
create trigger admin_audit_log_immutable
  before update or delete on public.admin_audit_log
  for each row execute function app_private.protect_admin_audit_log();

-- Balances for the admin user list. Invoker rights: only the service role may call it, and the
-- ledger's RLS still applies to anyone else.
create function public.admin_user_balances(p_user_ids uuid[])
returns table (user_id uuid, balance bigint)
language sql stable security invoker set search_path = '' as $$
  select l.user_id, sum(l.delta)::bigint from public.credit_ledger l where l.user_id = any (p_user_ids) group by l.user_id
$$;
revoke all on function public.admin_user_balances(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_user_balances(uuid[]) to service_role;
