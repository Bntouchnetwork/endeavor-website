-- My WhatsApp Manager por empresa: a Endeavor (conta 'endeavor') e cada empresa cliente liberada pela Endeavor
-- (conta = id do cliente) têm os próprios ajustes, perfil do negócio, regras, fluxos, modelos de documentos,
-- conversas e registro. Pedidos que a IA passa para o CRM (documentos, proposta) ficam em crm_requests.

-- liberar para a empresa (ficha do cliente no admin), como o Web Meeting
create table if not exists public.wa_access (
  client_id uuid primary key references public.clients(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.wa_access enable row level security;
drop policy if exists wa_access_admin on public.wa_access;
create policy wa_access_admin on public.wa_access for all using (is_admin()) with check (is_admin());
drop policy if exists wa_access_member_read on public.wa_access;
create policy wa_access_member_read on public.wa_access for select using (my_client_role(client_id) is not null);

-- ajustes por empresa (antes por usuário)
alter table public.wa_settings add column if not exists conta text;
update public.wa_settings set conta = 'endeavor' where conta is null;
alter table public.wa_settings alter column conta set not null;
alter table public.wa_settings drop constraint if exists wa_settings_pkey;
alter table public.wa_settings alter column user_id drop not null;
alter table public.wa_settings add primary key (conta);
-- perfil do negócio, regras, fluxos e modelos de documentos (editados no portal/admin)
alter table public.wa_settings add column if not exists config jsonb not null default '{}'::jsonb;
alter table public.wa_settings add column if not exists config_version int not null default 0;

alter table public.wa_devices add column if not exists conta text not null default 'endeavor';
create index if not exists wa_devices_conta on public.wa_devices(conta);

alter table public.wa_chats add column if not exists conta text not null default 'endeavor';
alter table public.wa_chats drop constraint if exists wa_chats_user_id_chave_key;
alter table public.wa_chats drop constraint if exists wa_chats_conta_chave_key;
alter table public.wa_chats add constraint wa_chats_conta_chave_key unique (conta, chave);
-- fluxo em andamento na conversa: { id, dados: {nome, email, tipo_caso}, status, inicio, pedido_id }
alter table public.wa_chats add column if not exists fluxo jsonb;
alter table public.wa_chats add column if not exists ct_contact_id uuid;

alter table public.wa_log add column if not exists conta text not null default 'endeavor';
create index if not exists wa_log_conta_time on public.wa_log(conta, created_at desc);

-- pedidos que a IA passa para o CRM. O CRM (agente) cria a pasta pelo modelo no armazenamento conectado,
-- manda o e-mail com a lista e o link da Initial Docs e faz o follow-up (fase 2: conectores Drive/Dropbox).
create table if not exists public.crm_requests (
  id uuid primary key default gen_random_uuid(),
  conta text not null,
  client_id uuid references public.clients(id) on delete cascade,
  tipo text not null check (tipo in ('documentos', 'proposta')),
  lead_id uuid references public.leads(id) on delete set null,
  ct_contact_id uuid references public.ct_contacts(id) on delete set null,
  nome text not null check (char_length(nome) between 2 and 200),
  email text check (email is null or char_length(email) between 5 and 254),
  telefone text check (telefone is null or char_length(telefone) <= 50),
  modelo text,
  documentos jsonb not null default '[]'::jsonb,
  subpastas jsonb not null default '[]'::jsonb,
  resumo text check (resumo is null or char_length(resumo) <= 2000),
  origem text not null default 'whatsapp',
  status text not null default 'novo' check (status in ('novo', 'aguardando_armazenamento', 'pendente', 'enviado', 'recebendo', 'em_revisao', 'completo', 'cancelado')),
  pasta jsonb,
  eventos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_requests_conta on public.crm_requests(conta, created_at desc);
alter table public.crm_requests enable row level security;
drop policy if exists crm_requests_admin on public.crm_requests;
create policy crm_requests_admin on public.crm_requests for all using (is_admin()) with check (is_admin());
drop policy if exists crm_requests_member_read on public.crm_requests;
create policy crm_requests_member_read on public.crm_requests for select using (client_id is not null and my_client_role(client_id) is not null);
