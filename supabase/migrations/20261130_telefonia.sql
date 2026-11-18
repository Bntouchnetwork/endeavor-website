-- Telefonia (Endeavor Corporate Phone), fase 1: estrutura, liberação por empresa, planos e dados.
-- Provedor: Telnyx (fase 2). Até lá, tudo roda no provedor de DEMONSTRAÇÃO (linhas com demo = true), sempre identificado na tela.
-- Escrita só pelo servidor (função telephony, service role). Leitura: admin vê tudo; membro do cliente vê só a empresa liberada.

-- planos (preço ao cliente). Excedentes e encaminhamento: a definir com as tarifas reais da conta (tel_rates).
create table if not exists public.tel_plans (
  id text primary key check (id ~ '^[a-z0-9_-]{2,40}$'),
  nome text not null,
  tipo_numero text not null check (tipo_numero in ('local', 'tollfree')),
  preco_cents int not null check (preco_cents >= 0),
  numeros_incluidos int not null default 1 check (numeros_incluidos between 1 and 50),
  minutos int not null default 0 check (minutos >= 0),
  sms int not null default 0 check (sms >= 0),
  excedente_min_cents numeric(10,4),
  excedente_sms_cents numeric(10,4),
  app_incluido boolean not null default true,
  ativo boolean not null default true,
  ordem int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.tel_plans (id, nome, tipo_numero, preco_cents, numeros_incluidos, minutos, sms, ordem) values
  ('professional', 'Professional', 'local', 1999, 1, 500, 250, 1),
  ('business', 'Business', 'tollfree', 2999, 1, 500, 250, 2)
on conflict (id) do nothing;

-- ajustes gerais (uma linha)
create table if not exists public.tel_settings (
  id int primary key default 1 check (id = 1),
  provedor text not null default 'demo' check (provedor in ('demo', 'telnyx')),
  margem_encaminhamento_pct numeric(6,2) not null default 30 check (margem_encaminhamento_pct between 0 and 500),
  paises_encaminhamento text[] not null default array['US', 'CA'],
  alertas_pct int[] not null default array[80, 100],
  limite_mensal_padrao_cents int not null default 5000 check (limite_mensal_padrao_cents >= 0),
  retencao_gravacoes_dias int not null default 90 check (retencao_gravacoes_dias between 1 and 3650),
  retencao_voicemail_dias int not null default 90 check (retencao_voicemail_dias between 1 and 3650),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.tel_settings (id) values (1) on conflict do nothing;

-- tarifas do provedor, sempre com a data em que foram conferidas (nunca preço inventado)
create table if not exists public.tel_rates (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'telnyx',
  item text not null,               -- ex.: 'voz_saida_US', 'voz_entrada_local', 'voz_entrada_tollfree', 'sms_saida', 'encaminhar_BR_movel'
  pais text,
  unidade text not null check (unidade in ('minuto', 'mensagem', 'mes', 'unidade')),
  custo numeric(12,6) not null check (custo >= 0),
  moeda text not null default 'USD',
  verificado_em date not null,
  fonte text,
  created_at timestamptz not null default now()
);

-- liberação por empresa
create table if not exists public.tel_access (
  company_id uuid primary key references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  enabled boolean not null default false,
  plan_id text references public.tel_plans(id),
  limite_mensal_cents int check (limite_mensal_cents is null or limite_mensal_cents >= 0),
  sms_permitido boolean not null default true,
  encaminhamento_permitido boolean not null default false,
  gravacao_permitida boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists tel_access_client on public.tel_access(client_id);

-- números
create table if not exists public.tel_numbers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  e164 text not null check (e164 ~ '^\+1[2-9]\d{9}$'),
  tipo text not null check (tipo in ('local', 'tollfree')),
  status text not null default 'aguardando_aprovacao' check (status in ('aguardando_aprovacao', 'ativo', 'suspenso', 'liberado', 'recusado')),
  demo boolean not null default true,
  provedor text not null default 'demo',
  provider_id text,
  messaging_profile_id text,
  sms_registro text not null default 'nao_iniciado' check (sms_registro in ('nao_iniciado', 'pendente', 'aprovado', 'recusado', 'nao_aplicavel')),
  e911 jsonb,
  custo_mensal_estimado numeric(10,4),
  proposto_por text,
  aprovado_por text,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists tel_numbers_e164_vivo on public.tel_numbers(e164) where status in ('aguardando_aprovacao', 'ativo', 'suspenso');
create index if not exists tel_numbers_company on public.tel_numbers(company_id);

-- quem usa o telefone na empresa (o titular do cliente é Admin do Cliente automaticamente)
create table if not exists public.tel_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null,
  email text,
  papel text not null default 'usuario' check (papel in ('admin', 'usuario')),
  pode_ligar boolean not null default true,
  pode_sms boolean not null default true,
  pode_gravacoes boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

-- atendimento por número: saudação, ausência, horário, destino, encaminhamento, gravação
create table if not exists public.tel_routing (
  number_id uuid primary key references public.tel_numbers(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  greeting jsonb not null default '{}'::jsonb,
  away jsonb not null default '{}'::jsonb,
  horario jsonb not null default '{}'::jsonb,
  feriados jsonb not null default '[]'::jsonb,
  nao_perturbe boolean not null default false,
  destino text not null default 'app' check (destino in ('app', 'numero', 'voicemail', 'encerrar')),
  encaminhar_para text,
  encaminhamento_aceite jsonb,
  voicemail boolean not null default true,
  gravar boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- contatos do telefone (manuais ou puxados do CRM da empresa)
create table if not exists public.tel_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  telefone text not null check (telefone ~ '^\+\d{8,15}$'),
  email text check (email is null or char_length(email) <= 254),
  empresa text check (empresa is null or char_length(empresa) <= 120),
  notas text check (notas is null or char_length(notas) <= 1000),
  origem text not null default 'manual' check (origem in ('manual', 'crm')),
  ct_contact_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, telefone)
);

-- registros
create table if not exists public.tel_calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number_id uuid references public.tel_numbers(id) on delete set null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  de text not null, para text not null,
  status text not null check (status in ('tocando', 'em_andamento', 'completada', 'perdida', 'recusada', 'voicemail', 'falhou', 'encaminhada')),
  usuario_id uuid,
  inicio timestamptz not null default now(), fim timestamptz,
  duracao_s int not null default 0,
  custo numeric(12,6), preco numeric(12,6),
  estimado boolean not null default true,
  demo boolean not null default true,
  provider_call_id text,
  eventos jsonb not null default '[]'::jsonb
);
create index if not exists tel_calls_company_time on public.tel_calls(company_id, inicio desc);

create table if not exists public.tel_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number_id uuid references public.tel_numbers(id) on delete set null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  de text not null, para text not null,
  texto text not null check (char_length(texto) <= 1600),
  status text not null check (status in ('na_fila', 'enviada', 'entregue', 'falhou', 'recebida', 'bloqueada')),
  lida boolean not null default false,
  custo numeric(12,6), preco numeric(12,6),
  demo boolean not null default true,
  provider_msg_id text,
  created_at timestamptz not null default now()
);
create index if not exists tel_messages_company_time on public.tel_messages(company_id, created_at desc);

create table if not exists public.tel_voicemails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  number_id uuid references public.tel_numbers(id) on delete set null,
  call_id uuid references public.tel_calls(id) on delete set null,
  de text not null,
  duracao_s int not null default 0,
  audio_path text,
  transcricao text,
  ouvido boolean not null default false,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  expira_em timestamptz
);
create table if not exists public.tel_recordings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  call_id uuid references public.tel_calls(id) on delete cascade,
  audio_path text,
  duracao_s int not null default 0,
  aviso_tocado boolean not null default false,
  demo boolean not null default true,
  created_at timestamptz not null default now(),
  expira_em timestamptz
);

-- consentimento de SMS (opt-in / opt-out, STOP / HELP)
create table if not exists public.tel_sms_consent (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  telefone text not null,
  estado text not null check (estado in ('opt_in', 'opt_out')),
  origem text not null,
  em timestamptz not null default now(),
  unique (company_id, telefone)
);

-- consumo por mês (estimado até a reconciliação com a fatura do provedor)
create table if not exists public.tel_usage (
  company_id uuid not null references public.companies(id) on delete cascade,
  periodo date not null,
  minutos_entrada numeric(12,2) not null default 0,
  minutos_saida numeric(12,2) not null default 0,
  sms_entrada int not null default 0,
  sms_saida int not null default 0,
  custo numeric(12,4) not null default 0,
  preco numeric(12,4) not null default 0,
  estimado boolean not null default true,
  alertas_enviados int[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (company_id, periodo)
);

-- eventos do provedor (webhooks): idempotentes pelo event_id
create table if not exists public.tel_events (
  id bigserial primary key,
  provedor text not null,
  event_id text not null,
  tipo text,
  assinatura_ok boolean not null default false,
  payload jsonb,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text,
  unique (provedor, event_id)
);

-- ---------------- RLS ----------------
-- membro pode ver a empresa se o cliente é dele, a empresa está no escopo dele e a Telefonia está liberada
create or replace function public.tel_pode_ver(p_company uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.tel_access a
    where a.company_id = p_company and a.enabled
      and public.my_client_role(a.client_id) is not null
      and public.can_access_company(a.client_id, p_company)
      and (public.my_client_role(a.client_id) = 'owner' or exists (select 1 from public.tel_users u where u.company_id = p_company and u.user_id = auth.uid())))
$$;
revoke all on function public.tel_pode_ver(uuid) from public, anon;
grant execute on function public.tel_pode_ver(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['tel_plans','tel_settings','tel_rates','tel_access','tel_numbers','tel_users','tel_routing','tel_contacts','tel_calls','tel_messages','tel_voicemails','tel_recordings','tel_sms_consent','tel_usage','tel_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for select using (public.is_admin())', t || '_admin', t);
  end loop;
end $$;
-- planos ativos: qualquer usuário logado vê (o portal mostra o plano)
drop policy if exists tel_plans_ver on public.tel_plans;
create policy tel_plans_ver on public.tel_plans for select to authenticated using (ativo);
-- dados da empresa: membros autorizados (gravações só pelo servidor, que confere a permissão)
do $$ declare t text; begin
  foreach t in array array['tel_access','tel_numbers','tel_routing','tel_contacts','tel_calls','tel_messages','tel_voicemails','tel_usage'] loop
    execute format('drop policy if exists %I on public.%I', t || '_membro', t);
    execute format('create policy %I on public.%I for select using (public.tel_pode_ver(company_id))', t || '_membro', t);
  end loop;
end $$;
drop policy if exists tel_users_membro on public.tel_users;
create policy tel_users_membro on public.tel_users for select using (user_id = auth.uid() or public.tel_pode_ver(company_id));
