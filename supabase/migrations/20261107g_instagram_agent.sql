-- Marketing agent (Instagram): AI-planned posts, approval queue, scheduled publishing, AI replies to comments and DMs
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['contact_form','booking','manual','partner','chat','instagram']));

create table if not exists public.ig_settings (
  id int primary key default 1 check (id = 1),
  updated_at timestamptz not null default now(),
  posts_per_week int not null default 4 check (posts_per_week between 1 and 21),
  stories_per_week int not null default 3 check (stories_per_week between 0 and 21),
  post_days int[] not null default '{1,3,5,6}',      -- 0 = Sunday
  post_time time not null default '12:30',
  timezone text not null default 'America/New_York',
  languages text[] not null default '{pt}',
  require_approval boolean not null default true,
  auto_reply boolean not null default true,
  handle text default '@endeavorbiz',
  topics text[] not null default array[
    'Abertura de empresa nos EUA (LLC x Corporation, tipos de empresa e diferenças)',
    'Filial nos EUA e expansão de negócios brasileiros',
    'Dolarização do patrimônio',
    'Proteção patrimonial e estruturas (holding, LLC para imóveis)',
    'Impostos nos EUA para estrangeiros (EIN, ITIN, declarações) em linguagem simples',
    'Brasil x EUA: comparações (segurança jurídica, burocracia, custo, moeda)',
    'Vantagens de ter imóvel e empresa nos EUA',
    'Diversificação: patrimônio distribuído em países e moedas diferentes',
    'A importância de ter uma estrutura pronta antes de precisar',
    'Empresa nos EUA como possível caminho para vistos de trabalho para empresários (sempre informativo, com advogado de imigração)',
    'Registered Agent, compliance e Annual Report',
    'Programa de Parceiros: corretores, contadores e advogados que indicam clientes'
  ],
  brand_notes text default 'Tom: confiável, claro e próximo; nada de promessas. Cores: azul-marinho #0b1f3a e dourado #c8a45d.',
  video_enabled boolean not null default false
);
insert into public.ig_settings (id) values (1) on conflict do nothing;

create table if not exists public.ig_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','published','failed','rejected')),
  format text not null default 'post' check (format in ('post','carousel','story','reel')),
  language text not null default 'pt' check (language in ('pt','en','es')),
  topic text,
  hook text,
  design jsonb not null default '{}'::jsonb,       -- template, slides [{kicker, title, body, bullets, left, right, stat}], palette
  caption text,
  hashtags text[] not null default '{}',
  scheduled_at timestamptz,
  image_urls text[] not null default '{}',          -- rendered art (public media bucket)
  video jsonb,                                       -- reel script / render job (phase 2)
  research text,                                     -- why the agent chose this (trends, hashtags)
  feedback text,
  ig_media_id text,
  ig_permalink text,
  published_at timestamptz,
  error text,
  created_by text
);
create index if not exists ig_posts_sched on public.ig_posts(status, scheduled_at);

create table if not exists public.ig_inbox (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('comment','dm')),
  ig_id text unique,                                 -- comment id or message id
  thread_id text,                                    -- commenter / sender id
  username text,
  media_id text,
  text text,
  reply text,
  replied_at timestamptz,
  status text not null default 'new' check (status in ('new','replied','handoff','ignored','failed')),
  lead_id uuid references public.leads(id) on delete set null,
  error text
);
create index if not exists ig_inbox_created on public.ig_inbox(created_at desc);
create index if not exists ig_inbox_thread on public.ig_inbox(thread_id, created_at);

alter table public.ig_settings enable row level security;
alter table public.ig_posts enable row level security;
alter table public.ig_inbox enable row level security;
drop policy if exists ig_settings_admin on public.ig_settings;
create policy ig_settings_admin on public.ig_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ig_posts_admin on public.ig_posts;
create policy ig_posts_admin on public.ig_posts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ig_inbox_admin on public.ig_inbox;
create policy ig_inbox_admin on public.ig_inbox for select to authenticated using (public.is_admin());

-- publishes approved posts at their time (every 10 minutes)
create or replace function public.ig_tick() returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not exists (select 1 from public.ig_posts where status = 'approved' and scheduled_at <= now()) then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key';
  perform net.http_post(url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/ig-agent', body := jsonb_build_object('event', 'tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k), timeout_milliseconds := 60000);
end $$;
revoke all on function public.ig_tick() from public, anon, authenticated;
select cron.schedule('ig-publish', '*/10 * * * *', 'select public.ig_tick();');
