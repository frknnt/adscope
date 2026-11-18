-- Welcome e-mail series (P5.4). The server writes the log with the secret key; users read their own rows.
alter table public.profiles add column welcome_emails boolean not null default true;
grant update (welcome_emails) on public.profiles to authenticated;

create table public.welcome_email_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  step smallint not null check (step in (0, 1, 3, 7, 14)),
  sent_at timestamptz not null default now(),
  primary key (user_id, step)
);
alter table public.welcome_email_log enable row level security;
revoke all on public.welcome_email_log from anon, authenticated;
grant select on public.welcome_email_log to authenticated;
create policy "welcome_email_log: owner reads" on public.welcome_email_log
  for select to authenticated using ((select auth.uid()) = user_id);

-- Recipients are looked up by signup date.
create index if not exists profiles_created_at_idx on public.profiles (created_at);
