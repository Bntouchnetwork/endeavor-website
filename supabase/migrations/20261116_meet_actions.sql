-- Web Meeting: painel de ações da reunião (IA acompanha a conversa e prepara proposta, cobrança, contrato,
-- pedido de documentos, reuniões, tarefas, CRM e ata; só executa com comando do organizador).

-- registro de cada ação executada (idempotência: o mesmo pedido não é enviado duas vezes)
create table if not exists public.meet_actions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  idem text not null check (char_length(idem) between 3 and 120),
  kind text not null check (kind in ('proposta','cobranca','contrato','documentos','reuniao','remarcar','tarefa','crm','ata','email')),
  status text not null default 'executando' check (status in ('executando','concluida','falhou')),
  data jsonb not null default '{}'::jsonb,
  result jsonb,
  error text check (char_length(error) <= 1000),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, idem)
);
create index if not exists meet_actions_room on public.meet_actions(room_id, created_at desc);

-- tarefas criadas a partir de compromissos confirmados na reunião
create table if not exists public.meet_tasks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 300),
  owner_name text check (char_length(owner_name) <= 120),
  owner_email text check (char_length(owner_email) <= 254),
  due_date date,
  status text not null default 'open' check (status in ('open','done','cancelled')),
  source text check (char_length(source) <= 500),
  created_by text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists meet_tasks_room on public.meet_tasks(room_id);
create index if not exists meet_tasks_client on public.meet_tasks(client_id, status);

-- pedidos de documentos com link seguro de envio (sem login; token aleatório, expira)
create table if not exists public.meet_doc_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32),
  email text not null check (char_length(email) between 5 and 254),
  name text check (char_length(name) <= 120),
  items jsonb not null default '[]'::jsonb,          -- [{ nome, status: pendente|recebido, arquivos: [{ path, nome, tamanho, em }] }]
  message text check (char_length(message) <= 1000),
  status text not null default 'pendente' check (status in ('pendente','concluido','cancelado','expirado')),
  expires_at timestamptz not null default now() + interval '14 days',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meet_doc_requests_room on public.meet_doc_requests(room_id);

alter table public.meet_actions enable row level security;
alter table public.meet_tasks enable row level security;
alter table public.meet_doc_requests enable row level security;

-- leitura: admin vê tudo; a equipe da empresa vê o que é das salas dela. Escrita só pela função meet (service role).
create policy meet_actions_read on public.meet_actions for select to authenticated
  using (public.is_admin() or exists (select 1 from public.meet_rooms r where r.id = room_id and r.client_id is not null and public.my_client_role(r.client_id) is not null));
create policy meet_tasks_read on public.meet_tasks for select to authenticated
  using (public.is_admin() or (client_id is not null and public.my_client_role(client_id) is not null));
create policy meet_tasks_update on public.meet_tasks for update to authenticated
  using (public.is_admin() or (client_id is not null and public.my_client_role(client_id) is not null))
  with check (public.is_admin() or (client_id is not null and public.my_client_role(client_id) is not null));
create policy meet_doc_requests_read on public.meet_doc_requests for select to authenticated
  using (public.is_admin() or (client_id is not null and public.my_client_role(client_id) is not null));

-- arquivos recebidos pelo link seguro: bucket privado (só a função meet grava e gera links)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meet-documents', 'meet-documents', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;
