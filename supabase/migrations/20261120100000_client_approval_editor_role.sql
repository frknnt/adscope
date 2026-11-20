-- P12.1: client approval links and the team "editor" role.
--
-- * team_members.role gains 'editor': an editor may start analyses and generate in the owner's
--   workspace. The server checks the role and then acts as the owner with the service role, so the
--   owner's balance, idempotency and "charge only on success" rules stay in the existing functions.
--   Read access for editors is the same as for viewers (the existing team policies).
-- * created_by records which editor started an analysis or generation (server writes it).
-- * approval_links / approval_decisions: an unauthenticated, expiring, hashed-token link that lets the
--   customer approve, ask for changes or reject each item. Decisions are written only by the server
--   after the token is verified; signed-in users can only read them.

-- team roles ----------------------------------------------------------------------------------
alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check check (role in ('viewer', 'editor'));

alter table public.team_invites
  add column role text not null default 'viewer' check (role in ('viewer', 'editor'));

-- The owner may change a member's role (and nothing else). Members cannot promote themselves.
grant update (role) on public.team_members to authenticated;
create policy "team_members: owner changes role" on public.team_members
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- created_by ----------------------------------------------------------------------------------
alter table public.analyses add column created_by uuid references auth.users (id) on delete set null;
create index analyses_created_by_idx on public.analyses (created_by);
alter table public.generations add column created_by uuid references auth.users (id) on delete set null;
create index generations_created_by_idx on public.generations (created_by);

-- approval links --------------------------------------------------------------------------------
create table public.approval_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  note text check (char_length(note) <= 500),
  -- Items the customer decides on, fixed when the link is made (texts, then image or video).
  item_keys text[] not null
    check (cardinality(item_keys) between 1 and 120
      and array_to_string(item_keys, ',') ~ '^(text:(original|safe|v[0-9]{1,2})|image|video)(,(text:(original|safe|v[0-9]{1,2})|image|video))*$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approval_links_ttl check (expires_at <= created_at + interval '31 days')
);
create index approval_links_analysis_id_idx on public.approval_links (analysis_id);
create index approval_links_user_id_idx on public.approval_links (user_id);
alter table public.approval_links enable row level security;

create table public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.approval_links (id) on delete cascade,
  -- Owner of the analysis (copied from the link by the server) so RLS needs no join.
  user_id uuid not null references auth.users (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  item_key text not null check (item_key ~ '^(text:(original|safe|v[0-9]{1,2})|image|video)$'),
  decision text not null check (decision in ('approved', 'changes_requested', 'rejected')),
  -- Free text typed by the customer; no e-mail is asked.
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 80),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (link_id, item_key)
);
create index approval_decisions_analysis_id_idx on public.approval_decisions (analysis_id);
create index approval_decisions_user_id_idx on public.approval_decisions (user_id);
alter table public.approval_decisions enable row level security;

-- Start from zero (default privileges already revoke, this keeps the intent explicit).
revoke all on public.approval_links, public.approval_decisions from anon, authenticated;

grant select, insert on public.approval_links to authenticated;
grant update (revoked_at) on public.approval_links to authenticated;
grant select on public.approval_decisions to authenticated;
grant select, insert, update, delete on public.approval_links, public.approval_decisions to service_role;

create policy "approval_links: owner can read" on public.approval_links
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "approval_links: owner of the analysis can create" on public.approval_links
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and revoked_at is null
    and exists (select 1 from public.analyses a where a.id = analysis_id and a.user_id = (select auth.uid()) and a.status = 'completed')
  );
create policy "approval_links: owner can revoke" on public.approval_links
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "approval_decisions: owner can read" on public.approval_decisions
  for select to authenticated using ((select auth.uid()) = user_id);
