-- Web Meeting · AI Presentation Studio (fase 2): apresentações preparadas, versões publicadas,
-- perfis de voz autorizados (com consentimento) e narração por slide. Toda IA passa pelo HUB AI.
-- Escrita só pela função meet (service role); leitura pelo painel conforme a empresa (RLS).

create table if not exists public.meet_studio (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,   -- null = Endeavor (interna)
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Apresentação',
  settings jsonb not null default '{}'::jsonb,                     -- idioma, tom, duracao_min, ritmo, voz_id, legendas, intro/outro
  content jsonb not null,                                          -- formato noir.apresentacao v1 (slides com roteiro e duracao)
  version int not null default 1,                                  -- sobe a cada gravação (controle de concorrência)
  status text not null default 'draft' check (status in ('draft','published')),
  published_version int,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists meet_studio_client on public.meet_studio(client_id, updated_at desc) where deleted_at is null;
alter table public.meet_studio enable row level security;
create policy mstu_admin_read on public.meet_studio for select to authenticated using (public.is_admin());
create policy mstu_member_read on public.meet_studio for select to authenticated using (client_id is not null and public.my_client_role(client_id) is not null and deleted_at is null);

create table if not exists public.meet_studio_versions (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.meet_studio(id) on delete cascade,
  version int not null,
  content jsonb not null,
  settings jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (studio_id, version)
);
alter table public.meet_studio_versions enable row level security;
create policy mstv_admin_read on public.meet_studio_versions for select to authenticated using (public.is_admin());

-- voz autorizada: só a própria pessoa cria e usa a sua voz
create table if not exists public.meet_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  provider text not null default 'elevenlabs',
  provider_voice_id text,
  status text not null default 'pending' check (status in ('pending','ready','failed','deleted')),
  consent_text text not null,
  consent_version text not null,
  consent_at timestamptz not null,
  consent_ip text,
  sample_path text,                                                -- bucket meet-media (privado); apagado junto com o perfil
  sample_seconds numeric,
  error text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists meet_voice_owner on public.meet_voice_profiles(owner_id) where deleted_at is null;
alter table public.meet_voice_profiles enable row level security;
create policy mvp_owner_read on public.meet_voice_profiles for select to authenticated using (owner_id = auth.uid() and deleted_at is null);

-- um áudio por slide, preso ao texto exato do roteiro (hash) e à voz usada
create table if not exists public.meet_narrations (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.meet_studio(id) on delete cascade,
  slide_id text not null,
  script_hash text not null,
  voice_profile_id uuid references public.meet_voice_profiles(id) on delete set null,
  language text not null default 'pt-BR',
  status text not null default 'pending' check (status in ('pending','running','ready','failed')),
  audio_path text,
  duration_ms int,
  characters int,
  hub_request_id text,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_id, slide_id, script_hash, voice_profile_id)
);
create index if not exists meet_narr_studio on public.meet_narrations(studio_id);
alter table public.meet_narrations enable row level security;
create policy mnar_admin_read on public.meet_narrations for select to authenticated using (public.is_admin());
create policy mnar_member_read on public.meet_narrations for select to authenticated using (exists (select 1 from public.meet_studio s where s.id = studio_id and s.client_id is not null and public.my_client_role(s.client_id) is not null));

-- trilha de auditoria do Studio (gerar, salvar, publicar, voz, narração, apagar)
create table if not exists public.meet_studio_audit (
  id bigint generated always as identity primary key,
  studio_id uuid,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists meet_studio_audit_studio on public.meet_studio_audit(studio_id, at desc);
alter table public.meet_studio_audit enable row level security;
create policy msa_admin_read on public.meet_studio_audit for select to authenticated using (public.is_admin());

-- mídia do Studio (amostras de voz e narrações): privado, acesso só por link assinado da função meet
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meet-media', 'meet-media', false, 26214400, array['audio/mpeg','audio/webm','audio/ogg','audio/mp4','audio/wav','audio/x-wav','audio/aac','image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
