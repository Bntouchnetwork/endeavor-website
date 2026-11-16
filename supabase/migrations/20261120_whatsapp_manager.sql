-- My WhatsApp Manager: extensão do Chrome da Endeavor ao lado do WhatsApp Web.
-- Guarda só os ajustes, o estado de cada conversa (seguir, IA Takeover) e o REGISTRO do que passou pela IA
-- (sugerido, aprovado, enviado, escalado), nunca a conversa completa. Tudo é acessado pela função "whatsapp"
-- (service role); nenhuma tabela tem acesso direto pelo navegador.

create table if not exists public.wa_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  version int not null default 1,
  updated_at timestamptz not null default now()
);

-- Cada navegador conectado (código de conexão gerado no admin; só o hash fica guardado).
create table if not exists public.wa_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default 'Chrome',
  token_hash text not null unique,
  ext_version text,
  estado jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen timestamptz,
  revoked_at timestamptz
);
create index if not exists wa_devices_user on public.wa_devices(user_id);

create table if not exists public.wa_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chave text not null,                -- id da conversa no WhatsApp (jid) ou, sem ele, o nome
  nome text not null default '',
  grupo boolean not null default false,
  seguir boolean not null default true,
  takeover boolean not null default false,
  aviso_ia_at timestamptz,            -- quando o aviso "assistente virtual" foi enviado nesta conversa
  lead_id uuid,
  updated_at timestamptz not null default now(),
  unique (user_id, chave)
);

create table if not exists public.wa_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.wa_devices(id) on delete set null,
  chave text,
  nome text,
  grupo boolean not null default false,
  ferramenta text not null,           -- sugerir, resumo, prontas, lead, agendamento, proposta, traduzir, comando, takeover, grupo
  status text not null,               -- sugerido, aprovado, enviado, descartado, escalado, criado, erro
  texto text,                         -- só o que a IA produziu ou o que foi enviado por ela (até 2000 caracteres)
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists wa_log_user_time on public.wa_log(user_id, created_at desc);

alter table public.wa_settings enable row level security;
alter table public.wa_devices enable row level security;
alter table public.wa_chats enable row level security;
alter table public.wa_log enable row level security;

-- leads que chegam pelo WhatsApp
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['contact_form','booking','manual','partner','chat','instagram','webinar','whatsapp']));
