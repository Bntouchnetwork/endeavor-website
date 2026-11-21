-- Agente Admin > skill "Prazos fiscais": prazos buscados em fontes oficiais, com a fonte e a data da verificação
alter table public.compliance_items
  add column if not exists origin text not null default 'manual' check (origin in ('manual', 'agent')),
  add column if not exists source_url text check (source_url is null or source_url ~* '^https://'),
  add column if not exists verified_at timestamptz;
alter table public.companies add column if not exists deadlines_checked_at timestamptz;
alter table public.crm_settings
  add column if not exists deadline_agent_enabled boolean not null default true,
  add column if not exists deadline_agent_days integer not null default 30 check (deadline_agent_days between 7 and 180);
create index if not exists companies_deadlines_checked_idx on public.companies (deadlines_checked_at nulls first);
-- No HUB AI (projeto ciqmeyngbbpjowmsjxhj) foi criado o agente "tax-deadlines" em hub.agents.
