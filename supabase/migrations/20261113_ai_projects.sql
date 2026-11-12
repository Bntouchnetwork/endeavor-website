-- AI Projects: the client requests a platform, the AI Project Manager scopes it, Endeavor approves the proposal,
-- the client approves and pays, then development agents (GitHub Actions + Claude) build on staging; production only
-- after the client's explicit approval. Plus the connectors catalog, AI usage (Hub AI) and new companies with optional Bookkeeping.

-- ---------- projects ----------
create table if not exists public.ai_projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  status text not null default 'scoping' check (status in ('scoping', 'proposal_review', 'proposal_sent', 'changes_requested', 'awaiting_payment', 'provisioning', 'in_progress', 'staging_review', 'live', 'paused', 'cancelled')),
  brief text check (brief is null or char_length(brief) <= 8000),
  requirements jsonb not null default '{}'::jsonb,       -- features, integrations, instructions, users, references
  connectors text[] not null default '{}',                -- connector keys chosen by the client
  scope jsonb not null default '{}'::jsonb,               -- summary, phases [{name, weeks, tasks[{title, detail, hours}]}], out_of_scope[], assumptions[]
  price_cents int check (price_cents is null or price_cents >= 0),
  weeks int check (weeks is null or weeks between 1 and 104),
  update_price_cents int not null default 0 check (update_price_cents >= 0),
  updates_included int not null default 3 check (updates_included between 0 and 50),
  proposal_note text check (proposal_note is null or char_length(proposal_note) <= 4000),
  proposal_sent_at timestamptz,
  client_approved_at timestamptz, client_approved_name text, client_approved_ip text,
  change_request text check (change_request is null or char_length(change_request) <= 4000),
  invoice_id uuid references public.invoices(id) on delete set null,
  paid_at timestamptz,
  repo_full_name text, firebase_project_id text, staging_site text, prod_site text,
  staging_domain text, prod_domain text, staging_url text, prod_url text,
  provision jsonb not null default '{}'::jsonb,            -- GitHub/Firebase provisioning steps done
  ai_budget_cents int not null default 20000 check (ai_budget_cents >= 0),  -- monthly AI cost limit for the project's agents
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists ai_projects_client on public.ai_projects(client_id);

create table if not exists public.ai_project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  role text not null check (role in ('client', 'pm', 'admin', 'system')),
  content text not null check (char_length(content) <= 12000),
  author text, created_at timestamptz not null default now()
);
create index if not exists ai_project_messages_p on public.ai_project_messages(project_id, created_at);

create table if not exists public.ai_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null default 'document' check (kind in ('logo', 'document', 'design', 'other')),
  title text not null check (char_length(title) <= 200),
  path text not null, mime text, size_bytes int,
  uploaded_by uuid, created_at timestamptz not null default now()
);

-- releases: the first version, the 3 included updates, paid updates and out-of-scope work
create table if not exists public.ai_project_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  number int not null,
  kind text not null check (kind in ('initial', 'included_update', 'paid_update', 'out_of_scope')),
  title text not null check (char_length(title) <= 200),
  request text check (request is null or char_length(request) <= 8000),
  status text not null default 'requested' check (status in ('requested', 'quote_review', 'awaiting_payment', 'queued', 'building', 'staging', 'changes_requested', 'approved', 'publishing', 'published', 'rolled_back', 'failed', 'cancelled')),
  price_cents int not null default 0 check (price_cents >= 0),
  invoice_id uuid references public.invoices(id) on delete set null,
  staging_url text, staging_sha text, prod_sha text, tag text,
  feedback text check (feedback is null or char_length(feedback) <= 4000),
  approved_at timestamptz, approved_name text, approved_ip text,
  published_at timestamptz, run_url text, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (project_id, number)
);

create table if not exists public.ai_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  release_id uuid references public.ai_project_releases(id) on delete set null,
  phase text, position int not null default 0,
  title text not null check (char_length(title) <= 200),
  detail text check (detail is null or char_length(detail) <= 4000),
  hours numeric(6,1),
  status text not null default 'todo' check (status in ('todo', 'queued', 'running', 'done', 'failed', 'blocked', 'skipped')),
  due_date date, run_url text, pr_url text, started_at timestamptz, done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_project_tasks_p on public.ai_project_tasks(project_id, position);

create table if not exists public.ai_project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.ai_projects(id) on delete cascade,
  kind text not null, title text not null, detail text, actor text,
  created_at timestamptz not null default now()
);
create index if not exists ai_project_events_p on public.ai_project_events(project_id, created_at);

alter table public.invoices add column if not exists ai_project_id uuid references public.ai_projects(id) on delete set null;
alter table public.invoices add column if not exists ai_release_id uuid references public.ai_project_releases(id) on delete set null;
alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('one_time', 'proposal', 'subscription', 'project'));

-- ---------- connectors catalog (admin) and per-company authorizations ----------
create table if not exists public.connectors (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) <= 80),
  category text not null default 'other' check (category in ('email', 'storage', 'messaging', 'marketing', 'payments', 'productivity', 'data', 'other')),
  description text check (description is null or char_length(description) <= 600),
  auth_type text not null default 'oauth' check (auth_type in ('oauth', 'api_key', 'none')),
  setup_note text check (setup_note is null or char_length(setup_note) <= 1000),
  active boolean not null default true,
  available_to text not null default 'all' check (available_to in ('all', 'selected')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.company_connectors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  connector_id uuid not null references public.connectors(id) on delete cascade,
  enabled boolean not null default true,                 -- for "selected" connectors: the admin enables it for this company
  status text not null default 'not_connected' check (status in ('not_connected', 'pending', 'connected', 'error')),
  account_label text check (account_label is null or char_length(account_label) <= 200),   -- e.g. the Gmail address, never a secret
  secret_id uuid,                                        -- vault.secrets id (credentials never stored in plain tables)
  updated_at timestamptz not null default now(),
  unique (company_id, connector_id)
);
insert into public.connectors (key, name, category, description, auth_type, setup_note, position) values
  ('gmail', 'Gmail', 'email', 'Send and read e-mail from the company''s Google Workspace account inside the platform.', 'oauth', 'Google OAuth consent of the company account.', 1),
  ('google_drive', 'Google Drive', 'storage', 'Store and read the company''s files in Google Drive.', 'oauth', 'Google OAuth consent of the company account.', 2),
  ('whatsapp_business', 'WhatsApp Business', 'messaging', 'Messages to customers through the WhatsApp Business Cloud API (approved templates).', 'api_key', 'Meta Business account, phone number ID and permanent token.', 3),
  ('aws_ses', 'AWS SES – e-mail campaigns', 'marketing', 'Transactional e-mail and campaigns through Amazon SES.', 'api_key', 'AWS SES SMTP credentials and verified domain.', 4)
on conflict (key) do nothing;

-- ---------- Hub AI: usage, cost and limits ----------
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  agent text not null,                          -- site-chat, crm, ig-agent, marketing, oa, books, project-manager, dev-agent ...
  model text, input_tokens int not null default 0, output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  client_id uuid references public.clients(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  project_id uuid references public.ai_projects(id) on delete set null,
  billable boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_time on public.ai_usage(created_at);
create index if not exists ai_usage_project on public.ai_usage(project_id);
create table if not exists public.ai_limits (
  id int primary key default 1 check (id = 1),
  monthly_cap_usd numeric(10,2) not null default 300,
  alert_pct int not null default 80 check (alert_pct between 10 and 100),
  markup_pct int not null default 30 check (markup_pct between 0 and 500),  -- when billing AI usage to a company
  project_hour_usd numeric(8,2) not null default 85,      -- AI Project Manager estimate: hours x rate (admin reviews before the client sees it)
  project_min_usd numeric(10,2) not null default 1500,
  update_price_usd numeric(10,2) not null default 450,    -- price of each update after the 3 included ones
  updated_at timestamptz not null default now()
);
insert into public.ai_limits (id) values (1) on conflict do nothing;

-- ---------- new companies requested by the client, optional Bookkeeping service ----------
alter table public.companies add column if not exists books_service text not null default 'none' check (books_service in ('none', 'requested', 'proposal_sent', 'active', 'cancelled'));
alter table public.companies add column if not exists requested_by uuid;

alter table public.admin_events drop constraint if exists admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check check (char_length(kind) between 2 and 40);

-- ---------- RLS ----------
alter table public.ai_projects enable row level security;
alter table public.ai_project_messages enable row level security;
alter table public.ai_project_files enable row level security;
alter table public.ai_project_releases enable row level security;
alter table public.ai_project_tasks enable row level security;
alter table public.ai_project_events enable row level security;
alter table public.connectors enable row level security;
alter table public.company_connectors enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_limits enable row level security;

create policy ai_projects_admin on public.ai_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_projects_owner on public.ai_projects for select to authenticated using (public.my_client_role(client_id) = 'owner');
create policy ai_msgs_admin on public.ai_project_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_msgs_owner on public.ai_project_messages for select to authenticated using (exists (select 1 from public.ai_projects p where p.id = project_id and public.my_client_role(p.client_id) = 'owner'));
create policy ai_files_admin on public.ai_project_files for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_files_owner on public.ai_project_files for select to authenticated using (public.my_client_role(client_id) = 'owner');
create policy ai_rel_admin on public.ai_project_releases for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_rel_owner on public.ai_project_releases for select to authenticated using (exists (select 1 from public.ai_projects p where p.id = project_id and public.my_client_role(p.client_id) = 'owner'));
create policy ai_tasks_admin on public.ai_project_tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_tasks_owner on public.ai_project_tasks for select to authenticated using (exists (select 1 from public.ai_projects p where p.id = project_id and public.my_client_role(p.client_id) = 'owner'));
create policy ai_ev_admin on public.ai_project_events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ai_ev_owner on public.ai_project_events for select to authenticated using (exists (select 1 from public.ai_projects p where p.id = project_id and public.my_client_role(p.client_id) = 'owner'));
create policy connectors_admin on public.connectors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy connectors_read on public.connectors for select to authenticated using (active);
create policy cc_admin on public.company_connectors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy cc_owner on public.company_connectors for select to authenticated using (exists (select 1 from public.companies c where c.id = company_id and public.my_client_role(c.client_id) = 'owner'));
create policy ai_usage_admin on public.ai_usage for select to authenticated using (public.is_admin());
create policy ai_limits_admin on public.ai_limits for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- connectors a company can pick in New Project: active, and either open to all or enabled for that company
create or replace function public.project_connectors(p_company uuid) returns table (key text, name text, category text, description text, auth_type text, status text)
language sql stable security definer set search_path = public as $$
  select c.key, c.name, c.category, c.description, c.auth_type, coalesce(cc.status, 'not_connected')
  from public.connectors c
  left join public.company_connectors cc on cc.connector_id = c.id and cc.company_id = p_company
  join public.companies co on co.id = p_company
  where c.active and (c.available_to = 'all' or coalesce(cc.enabled, false))
    and (public.is_admin() or public.my_client_role(co.client_id) = 'owner')
  order by c.position, c.name
$$;
grant execute on function public.project_connectors(uuid) to authenticated;

-- connector credentials go to Supabase Vault; tables keep only the secret id
create or replace function public.connector_set_secret(p_company uuid, p_connector uuid, p_secret text, p_label text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare cur uuid; sid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select secret_id into cur from public.company_connectors where company_id = p_company and connector_id = p_connector;
  if p_secret is null or btrim(p_secret) = '' then
    if cur is not null then delete from vault.secrets where id = cur; end if;
    insert into public.company_connectors (company_id, connector_id, status, account_label, secret_id, updated_at)
      values (p_company, p_connector, 'not_connected', left(p_label, 200), null, now())
      on conflict (company_id, connector_id) do update set status = 'not_connected', secret_id = null, account_label = left(p_label, 200), updated_at = now();
    return;
  end if;
  if cur is not null then perform vault.update_secret(cur, p_secret); sid := cur;
  else sid := vault.create_secret(p_secret, 'connector_' || p_company || '_' || p_connector, 'Connector credential'); end if;
  insert into public.company_connectors (company_id, connector_id, status, account_label, secret_id, updated_at)
    values (p_company, p_connector, 'connected', left(p_label, 200), sid, now())
    on conflict (company_id, connector_id) do update set status = 'connected', secret_id = sid, account_label = left(p_label, 200), updated_at = now();
end $$;
revoke all on function public.connector_set_secret(uuid, uuid, text, text) from public, anon;
grant execute on function public.connector_set_secret(uuid, uuid, text, text) to authenticated;

-- internal key for function-to-function calls (service role only)
create or replace function public.internal_hook_key() returns text
language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'booking_hook_key' limit 1
$$;
revoke all on function public.internal_hook_key() from public, anon, authenticated;
grant execute on function public.internal_hook_key() to service_role;

-- same list for the AI Project Manager (service role, no user context)
create or replace function public.project_connectors_internal(p_company uuid) returns table (key text, name text)
language sql stable security definer set search_path = public as $$
  select c.key, c.name from public.connectors c
  left join public.company_connectors cc on cc.connector_id = c.id and cc.company_id = p_company
  where c.active and (c.available_to = 'all' or coalesce(cc.enabled, false))
  order by c.position, c.name
$$;
revoke all on function public.project_connectors_internal(uuid) from public, anon, authenticated;
grant execute on function public.project_connectors_internal(uuid) to service_role;
