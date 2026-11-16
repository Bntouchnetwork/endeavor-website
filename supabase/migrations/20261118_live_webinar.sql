-- Endeavor Live Webinar: webinars agendados com a apresentação do Studio, inscrição pública, chat com assistente de IA
-- (identificado como IA), caixa privada para lead e agendamento, presença real e relatório.
-- Escrita só pela função webinar (service role). Leitura no painel conforme a empresa (RLS).

create table if not exists public.lw_webinars (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,     -- null = Endeavor
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{6,60}$'),
  title text not null,
  description text not null default '',
  studio_id uuid references public.meet_studio(id) on delete set null,
  studio_version int,
  content jsonb,                                                      -- cópia da versão publicada do Studio (slides)
  narration jsonb not null default '{}'::jsonb,                       -- slide_id -> {path, duracao_ms} no momento de agendar
  ritmo text not null default 'normal',
  starts_at timestamptz not null,
  timezone text not null default 'America/New_York',
  status text not null default 'draft' check (status in ('draft','scheduled','cancelled')),
  settings jsonb not null default '{}'::jsonb,                        -- contador_minimo, chat_ia, faq, convites, agendamento, textos
  ai_plan jsonb not null default '{}'::jsonb,                         -- perguntas frequentes revisadas pelo organizador
  playback jsonb not null default '{}'::jsonb,                        -- pausado_em, pausa_total_ms, encerrado_em
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists lw_webinars_client on public.lw_webinars(client_id, starts_at desc) where deleted_at is null;
alter table public.lw_webinars enable row level security;
create policy lww_admin_read on public.lw_webinars for select to authenticated using (public.is_admin());
create policy lww_member_read on public.lw_webinars for select to authenticated using (client_id is not null and public.my_client_role(client_id) is not null and deleted_at is null);

create table if not exists public.lw_registrations (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.lw_webinars(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (char_length(phone) <= 40),
  token uuid not null unique default gen_random_uuid(),
  marketing_consent boolean not null default false,
  lead_id uuid,
  contact_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists lw_reg_email on public.lw_registrations(webinar_id, lower(email));
alter table public.lw_registrations enable row level security;
create policy lwr_admin_read on public.lw_registrations for select to authenticated using (public.is_admin());
create policy lwr_member_read on public.lw_registrations for select to authenticated using (exists (select 1 from public.lw_webinars w where w.id = webinar_id and w.client_id is not null and public.my_client_role(w.client_id) is not null));

-- presença real: um registro por janela aberta, atualizado a cada ~15 s
create table if not exists public.lw_attendance (
  id uuid primary key default gen_random_uuid(),
  webinar_id uuid not null references public.lw_webinars(id) on delete cascade,
  registration_id uuid not null references public.lw_registrations(id) on delete cascade,
  session_id text not null check (char_length(session_id) between 8 and 64),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  seconds int not null default 0,
  first_pos_ms int not null default 0,
  last_pos_ms int not null default 0,
  unique (webinar_id, registration_id, session_id)
);
create index if not exists lw_att_live on public.lw_attendance(webinar_id, last_seen desc);
alter table public.lw_attendance enable row level security;
create policy lwa_admin_read on public.lw_attendance for select to authenticated using (public.is_admin());

-- chat: público (todos veem) e privado (só a pessoa e a equipe). autor: participante, ia, faq, anfitriao, sistema
create table if not exists public.lw_messages (
  id bigint generated always as identity primary key,
  webinar_id uuid not null references public.lw_webinars(id) on delete cascade,
  registration_id uuid references public.lw_registrations(id) on delete cascade,
  canal text not null check (canal in ('publico','privado')),
  autor text not null check (autor in ('participante','ia','faq','anfitriao','sistema')),
  nome text not null default '',
  texto text not null check (char_length(texto) <= 2000),
  extra jsonb not null default '{}'::jsonb,
  chave text,                                                         -- mensagens programadas não se repetem
  responde_a bigint,
  oculto boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists lw_msg_chave on public.lw_messages(webinar_id, chave) where chave is not null;
create index if not exists lw_msg_feed on public.lw_messages(webinar_id, id);
alter table public.lw_messages enable row level security;
create policy lwm_admin_read on public.lw_messages for select to authenticated using (public.is_admin());

-- ações do assistente e da equipe (lead, agendamento, link, escalar, moderação): trilha de auditoria
create table if not exists public.lw_actions (
  id bigint generated always as identity primary key,
  webinar_id uuid not null references public.lw_webinars(id) on delete cascade,
  registration_id uuid references public.lw_registrations(id) on delete set null,
  tipo text not null,
  status text not null default 'ok',
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists lw_actions_w on public.lw_actions(webinar_id, created_at desc);
alter table public.lw_actions enable row level security;
create policy lwact_admin_read on public.lw_actions for select to authenticated using (public.is_admin());

-- leads vindos do webinar aparecem no CRM com a origem "webinar"
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['contact_form','booking','manual','partner','chat','instagram','webinar']));
