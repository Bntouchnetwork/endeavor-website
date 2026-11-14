-- Web Meeting (videoconferência com LiveKit) para a Endeavor e para as empresas clientes.
--   meet_access        permissão e limites por cliente (habilitado na ficha do cliente, no admin)
--   meet_rooms         salas (client_id nulo = sala da própria Endeavor); slug = nome da sala no LiveKit
--   meet_participants  entradas e saídas (webhook do LiveKit)
--   meet_recordings    gravações e transmissões (LiveKit Egress)
--   meet_summaries     resumos da reunião gerados pela IA
--   meet_presentations versões das apresentações do assistente de slides
-- Quem cria salas e libera tokens é a função `meet` (confere permissão e limites); o painel lê pelas políticas abaixo.

create table if not exists public.meet_access (
  client_id uuid primary key references public.clients(id) on delete cascade,
  enabled boolean not null default false,
  max_rooms_month integer check (max_rooms_month is null or max_rooms_month between 0 and 10000),
  max_participants integer check (max_participants is null or max_participants between 2 and 500),
  max_minutes_month integer check (max_minutes_month is null or max_minutes_month between 0 and 1000000),
  recording_allowed boolean not null default true,
  streaming_allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.meet_access enable row level security;
create policy ma_admin on public.meet_access for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy ma_member_read on public.meet_access for select to authenticated using (public.my_client_role(client_id) is not null);

create table if not exists public.meet_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  kind text not null default 'instant' check (kind in ('instant', 'scheduled')),
  scheduled_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  peak_participants integer not null default 0
);
create index if not exists meet_rooms_client_idx on public.meet_rooms (client_id, created_at desc);
alter table public.meet_rooms enable row level security;
create policy mr_admin on public.meet_rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mr_member_read on public.meet_rooms for select to authenticated using (client_id is not null and public.my_client_role(client_id) is not null);

create table if not exists public.meet_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  room_name text not null,
  identity text not null,
  name text,
  role text,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists meet_participants_room_idx on public.meet_participants (room_id, joined_at);
alter table public.meet_participants enable row level security;
create policy mp_admin on public.meet_participants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mp_member_read on public.meet_participants for select to authenticated using (exists (select 1 from public.meet_rooms r where r.id = room_id and r.client_id is not null and public.my_client_role(r.client_id) is not null));

create table if not exists public.meet_recordings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  egress_id text not null unique,
  kind text not null default 'recording' check (kind in ('recording', 'stream')),
  status text not null default 'active' check (status in ('active', 'complete', 'failed')),
  file_path text,
  duration_seconds integer,
  started_by text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  error text
);
create index if not exists meet_recordings_room_idx on public.meet_recordings (room_id, started_at desc);
alter table public.meet_recordings enable row level security;
create policy mrec_admin on public.meet_recordings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy mrec_member_read on public.meet_recordings for select to authenticated using (exists (select 1 from public.meet_rooms r where r.id = room_id and r.client_id is not null and public.my_client_role(r.client_id) is not null));

create table if not exists public.meet_summaries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  summary text not null,
  transcript jsonb not null default '[]'::jsonb,
  polls jsonb not null default '[]'::jsonb,
  timers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists meet_summaries_room_idx on public.meet_summaries (room_id, created_at desc);
alter table public.meet_summaries enable row level security;
create policy msum_admin on public.meet_summaries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy msum_member_read on public.meet_summaries for select to authenticated using (exists (select 1 from public.meet_rooms r where r.id = room_id and r.client_id is not null and public.my_client_role(r.client_id) is not null));

create table if not exists public.meet_presentations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.meet_rooms(id) on delete cascade,
  instruction text,
  content jsonb not null,
  engine text,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists meet_presentations_room_idx on public.meet_presentations (room_id, created_at desc);
alter table public.meet_presentations enable row level security;
create policy mpres_admin on public.meet_presentations for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- minutos de reunião usados no mês (pelo início e fim de cada sala) e salas criadas no mês
create or replace function public.meet_usage(p_client uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'rooms_month', (select count(*) from public.meet_rooms r where r.client_id = p_client and r.created_at >= date_trunc('month', now())),
    'minutes_month', coalesce((select sum(ceil(extract(epoch from (coalesce(r.ended_at, now()) - r.started_at)) / 60))::int from public.meet_rooms r
       where r.client_id = p_client and r.started_at is not null and r.started_at >= date_trunc('month', now())), 0))
  where public.is_admin() or public.my_client_role(p_client) is not null or auth.role() = 'service_role'
$$;
grant execute on function public.meet_usage(uuid) to authenticated, service_role;

-- vídeos das gravações: bucket privado; o download sai por link assinado da função `meet`
insert into storage.buckets (id, name, public) values ('meet-recordings', 'meet-recordings', false) on conflict (id) do nothing;
