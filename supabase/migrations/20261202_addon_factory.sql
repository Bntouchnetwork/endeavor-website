-- Fábrica de add-ons (Admin › Add-ons): o super admin conversa com a IA, a IA gera numa branch de teste,
-- roda os testes e publica uma prévia; nada vai para o site sem aprovação. Escrita só pela função addon-builder.
create table if not exists public.addon_builds (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  kind text not null default 'addon' check (kind in ('addon', 'change', 'bugfix')),
  status text not null default 'chatting' check (status in ('chatting', 'queued', 'building', 'preview', 'publishing', 'published', 'failed', 'discarded', 'reverting', 'reverted')),
  plan jsonb not null default '{}'::jsonb,           -- plano da IA: resumo, tarefas, arquivos prováveis, produto (nome PT/EN/ES, categoria, cobrança)
  product_code text,                                 -- código do add-on na loja (quando é um add-on)
  branch text, pr_number integer, preview_url text, head_sha text, merge_sha text, run_url text,
  files jsonb not null default '[]'::jsonb,          -- arquivos mudados na última geração
  sensitive jsonb not null default '[]'::jsonb,      -- arquivos em áreas sensíveis (servidor, pagamentos, chaves, workflows)
  summary text, feedback text, error text,
  cost_usd numeric not null default 0,
  runs integer not null default 0,
  created_by text, approved_by text, approved_at timestamptz, published_at timestamptz, reverted_by text, reverted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.addon_build_messages (
  id bigint generated always as identity primary key,
  build_id uuid not null references public.addon_builds(id) on delete cascade,
  role text not null check (role in ('admin', 'ai', 'system')),
  content text not null, author text,
  created_at timestamptz not null default now()
);
create table if not exists public.addon_build_events (
  id bigint generated always as identity primary key,
  build_id uuid not null references public.addon_builds(id) on delete cascade,
  kind text not null, title text not null, detail text, actor text, cost_usd numeric,
  created_at timestamptz not null default now()
);
create index if not exists addon_build_messages_b on public.addon_build_messages(build_id, id);
create index if not exists addon_build_events_b on public.addon_build_events(build_id, id);

alter table public.addon_builds enable row level security;
alter table public.addon_build_messages enable row level security;
alter table public.addon_build_events enable row level security;
drop policy if exists addon_builds_admin on public.addon_builds;
drop policy if exists addon_build_messages_admin on public.addon_build_messages;
drop policy if exists addon_build_events_admin on public.addon_build_events;
create policy addon_builds_admin on public.addon_builds for select to authenticated using (public.is_admin());
create policy addon_build_messages_admin on public.addon_build_messages for select to authenticated using (public.is_admin());
create policy addon_build_events_admin on public.addon_build_events for select to authenticated using (public.is_admin());

-- limites de custo da fábrica (Hub AI): por tarefa e por mês
alter table public.ai_limits add column if not exists addon_task_cap_usd numeric not null default 15;
alter table public.ai_limits add column if not exists addon_monthly_cap_usd numeric not null default 100;

-- quantos clientes usam cada add-on (só admin)
create or replace function public.addon_usage_counts() returns table (product_code text, clientes bigint)
language sql stable security definer set search_path = public as $$
  select s.product_code, count(distinct s.client_id) from public.client_services s
  where public.is_admin() and s.status in ('active', 'past_due') group by s.product_code
$$;
revoke all on function public.addon_usage_counts() from public;
grant execute on function public.addon_usage_counts() to authenticated;
