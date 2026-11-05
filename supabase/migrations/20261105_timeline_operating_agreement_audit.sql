-- Company timeline (single source for admin + client portals), Operating Agreement module, protected audit log.
-- Reuses: companies, clients, client_users helpers (my_client_role, can_access_company, is_admin), envelopes/envelope_events
-- (e-signature), company_documents + client-docs (archive), doc_access_log, admin_events (bell).

/* ---------- timeline ---------- */
alter table public.companies
  add column if not exists stage text not null default 'onboarding'
    check (stage in ('onboarding','documents','filing_prep','filed','approved','operating_agreement')),
  add column if not exists stage_at timestamptz not null default now();

create table if not exists public.company_timeline (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  at timestamptz not null default now(),
  stage text not null,
  substatus text,
  note text check (char_length(note) <= 1000),
  visible_to_client boolean not null default true,
  actor_email text,
  actor_role text
);
create index if not exists company_timeline_co on public.company_timeline(company_id, at);
create index if not exists company_timeline_cl on public.company_timeline(client_id, at);

/* ---------- reviewers, settings ---------- */
alter table public.admins add column if not exists legal_reviewer boolean not null default false;

create or replace function public.is_legal_reviewer() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (select 1 from public.admins a where lower(a.email) = lower(coalesce(auth.jwt()->>'email','')) and a.legal_reviewer)
$$;

create table if not exists public.compliance_settings (
  id int primary key default 1 check (id = 1),
  capture_ip boolean not null default true,
  capture_user_agent boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.compliance_settings(id) values (1) on conflict do nothing;

/* ---------- Operating Agreement ---------- */
create table if not exists public.oa_rule_sets (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  version text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','retired')),
  content jsonb not null,
  content_sha256 text not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by text,
  approval_note text check (char_length(approval_note) <= 2000),
  unique (state, version)
);

create table if not exists public.operating_agreements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending_generation' check (status in ('pending_generation','questionnaire','drafting','in_review','client_review','approved','signing','signed','archived','cancelled')),
  status_actor text,
  state text,
  answers jsonb not null default '{}'::jsonb,
  prefill jsonb not null default '{}'::jsonb,
  prefill_sources jsonb not null default '{}'::jsonb,
  issues jsonb not null default '[]'::jsonb,
  review_required boolean not null default false,
  review_note text check (char_length(review_note) <= 4000),
  rule_set_id uuid references public.oa_rule_sets(id),
  rules_version text,
  version int not null default 0,
  current_version_id uuid,
  consents jsonb not null default '[]'::jsonb,
  signers jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  approved_by_email text,
  signed_at timestamptz,
  archived_at timestamptz,
  final_document_id uuid references public.company_documents(id) on delete set null,
  evidence_document_id uuid references public.company_documents(id) on delete set null,
  final_sha256 text,
  last_error text
);
create unique index if not exists oa_one_active on public.operating_agreements(company_id) where status <> 'cancelled';
create index if not exists oa_client on public.operating_agreements(client_id);

create table if not exists public.oa_versions (
  id uuid primary key default gen_random_uuid(),
  oa_id uuid not null references public.operating_agreements(id) on delete cascade,
  version int not null,
  final boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text,
  source text not null check (source in ('ai','template','edit')),
  content jsonb not null,
  pdf_path text,
  pdf_sha256 text,
  pages int,
  fields jsonb,
  ai_provider text,
  ai_model text,
  ai_request_id text,
  ai_usage jsonb,
  prompt_sha256 text,
  rules_version text,
  rule_set_id uuid references public.oa_rule_sets(id),
  validation jsonb not null default '[]'::jsonb,
  note text check (char_length(note) <= 4000),
  unique (oa_id, version, final)
);

create table if not exists public.oa_comments (
  id bigint generated always as identity primary key,
  oa_id uuid not null references public.operating_agreements(id) on delete cascade,
  version int,
  at timestamptz not null default now(),
  author_email text,
  author_role text,
  section text check (char_length(section) <= 40),
  body text not null check (char_length(body) between 1 and 2000),
  resolved_at timestamptz,
  resolved_by text,
  resolution text check (char_length(resolution) <= 2000)
);

alter table public.envelopes add column if not exists oa_id uuid references public.operating_agreements(id) on delete set null,
  add column if not exists signer_index int;

alter table public.admin_events drop constraint if exists admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check check (kind in ('proposal_accepted','payment_received','payment_failed','referral_new','oa_review','oa_client','oa_signature','oa_archived'));

/* ---------- protected audit log (append-only, hash chained) ---------- */
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null check (char_length(action) <= 80),
  entity_type text,
  entity_id text,
  client_id uuid,
  company_id uuid,
  ip text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  prev_hash text,
  hash text
);
create index if not exists audit_at on public.audit_log(at desc);
create index if not exists audit_client on public.audit_log(client_id, at desc);
create index if not exists audit_company on public.audit_log(company_id, at desc);
create index if not exists audit_action on public.audit_log(action);
create index if not exists audit_entity on public.audit_log(entity_type, entity_id);

create or replace function public.audit_hash_row(r public.audit_log, prev text) returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(prev,'') || '|' || r.id || '|' || to_char(r.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|' || coalesce(r.actor_email,'') || '|' || coalesce(r.actor_role,'') || '|' ||
    r.action || '|' || coalesce(r.entity_type,'') || '|' || coalesce(r.entity_id,'') || '|' || coalesce(r.client_id::text,'') || '|' || coalesce(r.company_id::text,'') || '|' ||
    coalesce(r.ip,'') || '|' || coalesce(r.user_agent,'') || '|' || r.details::text, 'sha256'), 'hex')
$$;
create or replace function public.audit_chain() returns trigger language plpgsql security definer set search_path = public as $$
declare prev text;
begin
  perform pg_advisory_xact_lock(7314159);
  select a.hash into prev from public.audit_log a order by a.id desc limit 1;
  new.prev_hash := prev;
  new.hash := public.audit_hash_row(new, prev);
  return new;
end $$;
drop trigger if exists audit_chain on public.audit_log;
create trigger audit_chain before insert on public.audit_log for each row execute function public.audit_chain();
create or replace function public.audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
drop trigger if exists audit_no_update on public.audit_log;
create trigger audit_no_update before update or delete on public.audit_log for each row execute function public.audit_immutable();
drop trigger if exists audit_no_truncate on public.audit_log;
create trigger audit_no_truncate before truncate on public.audit_log for each statement execute function public.audit_immutable();

-- request metadata (IP / device) when the compliance settings allow it
create or replace function public.req_meta() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare h json; s public.compliance_settings; ip text; ua text;
begin
  select * into s from public.compliance_settings where id = 1;
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  if h is not null then
    ip := split_part(coalesce(h->>'x-forwarded-for', h->>'cf-connecting-ip', h->>'x-real-ip', ''), ',', 1);
    ua := left(coalesce(h->>'user-agent', ''), 400);
  end if;
  return jsonb_build_object('ip', case when coalesce(s.capture_ip, true) then nullif(trim(ip), '') end, 'ua', case when coalesce(s.capture_user_agent, true) then nullif(ua, '') end);
end $$;

create or replace function public.audit_write(p_action text, p_entity_type text, p_entity_id text, p_client uuid, p_company uuid, p_details jsonb,
  p_actor_email text default null, p_actor_role text default null, p_ip text default null, p_ua text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare m jsonb := public.req_meta(); r public.compliance_settings; nid bigint;
begin
  select * into r from public.compliance_settings where id = 1;
  insert into public.audit_log(actor_id, actor_email, actor_role, action, entity_type, entity_id, client_id, company_id, ip, user_agent, details)
  values (auth.uid(), coalesce(p_actor_email, auth.jwt()->>'email'), coalesce(p_actor_role, case when public.is_admin() then 'admin' when auth.uid() is null then 'system' else 'user' end),
    p_action, p_entity_type, p_entity_id, p_client, p_company,
    case when coalesce(r.capture_ip, true) then coalesce(p_ip, m->>'ip') end, case when coalesce(r.capture_user_agent, true) then coalesce(p_ua, m->>'ua') end, coalesce(p_details, '{}'::jsonb))
  returning id into nid;
  return nid;
end $$;
revoke all on function public.audit_write(text, text, text, uuid, uuid, jsonb, text, text, text, text) from public, anon, authenticated;

-- events the portals may record themselves (views); everything else is written by triggers or the server
create or replace function public.audit_event(p_action text, p_entity_type text default null, p_entity_id text default null, p_company uuid default null, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare cl uuid; role text;
begin
  if auth.uid() is null or not public.is_aal2() then raise exception 'forbidden'; end if;
  if p_action not in ('portal.access','timeline.view','oa.view','oa.pdf_view','audit.view','audit.export','audit.verify') then raise exception 'action_not_allowed'; end if;
  if p_company is not null then select client_id into cl from public.companies where id = p_company; end if;
  if public.is_admin() then role := 'admin';
  elsif p_action like 'audit.%' then raise exception 'forbidden';
  else
    if cl is not null and not public.can_access_company(cl, p_company) then raise exception 'forbidden'; end if;
    role := coalesce(public.my_client_role(cl), case when public.my_partner_id() is not null then 'partner' end, 'user');
    if role = 'collaborator' and p_action like 'oa.%' then raise exception 'forbidden'; end if;
  end if;
  perform public.audit_write(p_action, p_entity_type, left(p_entity_id, 80), cl, p_company, coalesce(p_details, '{}'::jsonb) - 'ip' - 'email', null, case role when 'owner' then 'client_owner' else role end);
end $$;
revoke all on function public.audit_event(text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.audit_event(text, text, text, uuid, jsonb) to authenticated;

create or replace function public.audit_verify() returns table(ok boolean, checked bigint, first_bad bigint) language plpgsql security definer set search_path = public as $$
declare r public.audit_log; prev text := null; n bigint := 0;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for r in select * from public.audit_log order by id loop
    n := n + 1;
    if r.prev_hash is distinct from prev or r.hash <> public.audit_hash_row(r, prev) then ok := false; checked := n; first_bad := r.id; return next; return; end if;
    prev := r.hash;
  end loop;
  ok := true; checked := n; first_bad := null; return next;
end $$;
revoke all on function public.audit_verify() from public, anon;
grant execute on function public.audit_verify() to authenticated;

/* ---------- triggers: timeline + audit ---------- */
create or replace function public.company_stage_tl() returns trigger language plpgsql security definer set search_path = public as $$
declare who text := auth.jwt()->>'email';
begin
  if tg_op = 'INSERT' then
    insert into public.company_timeline(company_id, client_id, stage, actor_email, actor_role) values (new.id, new.client_id, new.stage, who, case when public.is_admin() then 'admin' else 'system' end);
  elsif new.stage is distinct from old.stage then
    insert into public.company_timeline(company_id, client_id, stage, actor_email, actor_role) values (new.id, new.client_id, new.stage, who, case when public.is_admin() then 'admin' else 'system' end);
    perform public.audit_write('timeline.stage', 'company', new.id::text, new.client_id, new.id, jsonb_build_object('from', old.stage, 'to', new.stage));
    if new.stage = 'approved' then
      update public.companies set stage = 'operating_agreement', stage_at = now() where id = new.id;
    end if;
  end if;
  if new.stage = 'operating_agreement' and not exists (select 1 from public.operating_agreements o where o.company_id = new.id and o.status <> 'cancelled') then
    insert into public.operating_agreements(company_id, client_id, state, status, status_actor) values (new.id, new.client_id, new.state, 'pending_generation', 'system');
  end if;
  return null;
end $$;
drop trigger if exists company_stage_tl on public.companies;
create trigger company_stage_tl after insert or update of stage on public.companies for each row execute function public.company_stage_tl();

create or replace function public.company_stage_at() returns trigger language plpgsql as $$
begin if new.stage is distinct from old.stage then new.stage_at := now(); end if; return new; end $$;
drop trigger if exists company_stage_at on public.companies;
create trigger company_stage_at before update of stage on public.companies for each row execute function public.company_stage_at();

create or replace function public.oa_status_tl() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.company_timeline(company_id, client_id, stage, substatus, actor_email, actor_role, note)
    values (new.company_id, new.client_id, 'operating_agreement', new.status, coalesce(new.status_actor, auth.jwt()->>'email', 'system'),
      case when new.status_actor = 'system' or new.status_actor is null then 'system' when public.is_admin() then 'admin' else 'user' end,
      case when new.status = 'in_review' and new.review_required then 'review_required' end);
  end if;
  return new;
end $$;
drop trigger if exists oa_status_tl on public.operating_agreements;
create trigger oa_status_tl before insert or update on public.operating_agreements for each row execute function public.oa_status_tl();

-- document views/downloads (existing access log) are mirrored into the audit log
create or replace function public.doc_access_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare d public.company_documents;
begin
  select * into d from public.company_documents where id = new.document_id;
  perform public.audit_write('doc.' || new.action, 'document', new.document_id::text, d.client_id, d.company_id, jsonb_build_object('title', d.title, 'category', d.category), new.email,
    case when public.is_admin() then 'admin' else coalesce(case public.my_client_role(d.client_id) when 'owner' then 'client_owner' else public.my_client_role(d.client_id) end, 'user') end);
  return null;
end $$;
drop trigger if exists doc_access_audit on public.doc_access_log;
create trigger doc_access_audit after insert on public.doc_access_log for each row execute function public.doc_access_audit();

-- e-signature events of Operating Agreement envelopes are mirrored into the audit log (signer IP/device come from the e-sign module)
create or replace function public.envelope_event_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare e public.envelopes; o public.operating_agreements;
begin
  select * into e from public.envelopes where id = new.envelope_id;
  if e.oa_id is null then return null; end if;
  select * into o from public.operating_agreements where id = e.oa_id;
  perform public.audit_write('esign.' || new.event, 'envelope', e.id::text, o.client_id, o.company_id,
    coalesce(new.details, '{}'::jsonb) || jsonb_build_object('oa_id', o.id, 'signer_index', e.signer_index, 'signer_name', e.signer_name), e.signer_email,
    case when new.event in ('viewed','consented','signed','completed','downloaded') then 'signer' else 'system' end, new.ip, new.user_agent);
  return null;
end $$;
drop trigger if exists envelope_event_audit on public.envelope_events;
create trigger envelope_event_audit after insert on public.envelope_events for each row execute function public.envelope_event_audit();

create or replace function public.admins_reviewer_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.legal_reviewer is distinct from old.legal_reviewer then
    perform public.audit_write('compliance.reviewer', 'admin', new.email, null, null, jsonb_build_object('legal_reviewer', new.legal_reviewer));
  end if;
  return null;
end $$;
drop trigger if exists admins_reviewer_audit on public.admins;
create trigger admins_reviewer_audit after update on public.admins for each row execute function public.admins_reviewer_audit();

create or replace function public.compliance_settings_audit() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now(); new.updated_by := auth.jwt()->>'email';
  perform public.audit_write('compliance.settings', 'settings', '1', null, null, jsonb_build_object('capture_ip', new.capture_ip, 'capture_user_agent', new.capture_user_agent));
  return new;
end $$;
drop trigger if exists compliance_settings_audit on public.compliance_settings;
create trigger compliance_settings_audit before update on public.compliance_settings for each row execute function public.compliance_settings_audit();

/* ---------- RLS ---------- */
alter table public.company_timeline enable row level security;
alter table public.operating_agreements enable row level security;
alter table public.oa_versions enable row level security;
alter table public.oa_comments enable row level security;
alter table public.oa_rule_sets enable row level security;
alter table public.audit_log enable row level security;
alter table public.compliance_settings enable row level security;

create policy tl_admin on public.company_timeline for all using (public.is_admin()) with check (public.is_admin());
create policy tl_member_read on public.company_timeline for select using (visible_to_client and public.can_access_company(client_id, company_id));
create policy oa_admin_read on public.operating_agreements for select using (public.is_admin());
create policy oa_owner_read on public.operating_agreements for select using (public.my_client_role(client_id) = 'owner');
create policy oav_admin_read on public.oa_versions for select using (public.is_admin());
create policy oav_owner_read on public.oa_versions for select using (exists (select 1 from public.operating_agreements o where o.id = oa_id and public.my_client_role(o.client_id) = 'owner'));
create policy oac_admin_read on public.oa_comments for select using (public.is_admin());
create policy oac_owner_read on public.oa_comments for select using (exists (select 1 from public.operating_agreements o where o.id = oa_id and public.my_client_role(o.client_id) = 'owner'));
create policy rules_admin_read on public.oa_rule_sets for select using (public.is_admin());
create policy rules_approved_read on public.oa_rule_sets for select using (status = 'approved' and auth.uid() is not null);
create policy audit_admin_read on public.audit_log for select using (public.is_admin());
create policy cs_admin_read on public.compliance_settings for select using (public.is_admin());
create policy cs_admin_update on public.compliance_settings for update using (public.is_admin()) with check (public.is_admin());
-- writes to OA tables go through the `oa` edge function (service role), which validates and audits every action

/* ---------- realtime (RLS applies to subscribers) ---------- */
do $$ begin
  begin alter publication supabase_realtime add table public.company_timeline; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.operating_agreements; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.companies; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.oa_comments; exception when duplicate_object then null; end;
end $$;
