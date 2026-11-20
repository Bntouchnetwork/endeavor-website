-- LinkedIn Manager: atividade da empresa, página do LinkedIn (API oficial), calendário de posts, comentários e extensão.
-- Tudo por EMPRESA (companies.id). Leitura: admin ou dono da empresa. Escrita: só o servidor (função linkedin).
-- Os tokens do LinkedIn ficam no Vault; as tabelas guardam só o id do segredo e nenhuma política deixa o navegador ler.

-- 1. atividades (dropdown trilíngue no cadastro da empresa; define palavras-chave, temas e tom do agente)
create table if not exists public.business_activities (
  code text primary key check (code ~ '^[a-z_]{2,40}$'),
  label_pt text not null, label_en text not null, label_es text not null,
  keywords text[] not null default '{}', sort integer not null default 100
);
alter table public.business_activities enable row level security;
drop policy if exists business_activities_read on public.business_activities;
create policy business_activities_read on public.business_activities for select to anon, authenticated using (true);
insert into public.business_activities (code, label_pt, label_en, label_es, keywords, sort) values
 ('mortgage', 'Mortgage (financiamento imobiliário)', 'Mortgage', 'Hipotecas (mortgage)', '{mortgage,financiamento,home loan,refinance,hipoteca,pre-approval,juros,down payment}', 10),
 ('real_estate', 'Imobiliária', 'Real estate', 'Inmobiliaria', '{imóvel,casa,realtor,real estate,comprar casa,investimento imobiliário,alquiler,propiedad}', 20),
 ('accounting', 'Contabilidade', 'Accounting', 'Contabilidad', '{contabilidade,bookkeeping,accounting,contador,balanço,payroll,contabilidad}', 30),
 ('tax', 'Serviços fiscais', 'Tax services', 'Servicios fiscales', '{imposto,tax,IRS,tax return,declaração,ITIN,impuestos}', 40),
 ('formation', 'Abertura de empresas', 'Company formation', 'Apertura de empresas', '{abrir empresa,LLC,EIN,company formation,registered agent,abrir empresa nos EUA,abrir empresa en EE. UU.}', 50),
 ('insurance', 'Seguros', 'Insurance', 'Seguros', '{seguro,insurance,apólice,cobertura,life insurance,health insurance,póliza}', 60),
 ('consulting', 'Consultoria', 'Consulting', 'Consultoría', '{consultoria,consulting,estratégia,processos,mentoria,consultoría}', 70),
 ('digital_marketing', 'Marketing digital', 'Digital marketing', 'Marketing digital', '{marketing,tráfego,ads,social media,SEO,leads,branding}', 80),
 ('technology', 'Tecnologia / software', 'Technology / software', 'Tecnología / software', '{software,app,sistema,SaaS,automação,AI,desenvolvimento,desarrollo}', 90),
 ('construction', 'Construção', 'Construction', 'Construcción', '{construção,reforma,remodeling,contractor,obra,construcción}', 100),
 ('cleaning', 'Limpeza', 'Cleaning', 'Limpieza', '{limpeza,cleaning,house cleaning,janitorial,limpieza}', 110),
 ('restaurant', 'Restaurante', 'Restaurant', 'Restaurante', '{restaurante,restaurant,catering,delivery,food}', 120),
 ('ecommerce', 'E-commerce', 'E-commerce', 'E-commerce', '{e-commerce,loja online,Amazon,Shopify,dropshipping,tienda online}', 130),
 ('import_export', 'Importação / exportação', 'Import / export', 'Importación / exportación', '{importação,exportação,import,export,comex,freight,aduana}', 140),
 ('logistics', 'Transporte / logística', 'Transportation / logistics', 'Transporte / logística', '{transporte,logística,trucking,frete,shipping,dispatch}', 150),
 ('health_beauty', 'Saúde e beleza', 'Health and beauty', 'Salud y belleza', '{estética,beleza,salon,spa,wellness,saúde,belleza}', 160),
 ('education', 'Educação', 'Education', 'Educación', '{curso,escola,education,training,aulas,inglês,educación}', 170),
 ('legal', 'Serviços jurídicos', 'Legal services', 'Servicios legales', '{advogado,attorney,imigração,visa,contrato,legal,abogado}', 180),
 ('tourism', 'Turismo', 'Tourism', 'Turismo', '{turismo,viagem,travel,Orlando,Disney,vacation,viaje}', 190),
 ('other', 'Outra', 'Other', 'Otra', '{}', 999)
on conflict (code) do nothing;
alter table public.companies add column if not exists activity_code text references public.business_activities(code);

-- 2. página do LinkedIn por empresa
create table if not exists public.linkedin_accounts (
  company_id uuid primary key references public.companies(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  enabled boolean not null default false,              -- liberado pela Endeavor
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'expired', 'error')),
  org_urn text, org_name text, member_name text,
  token_secret_id uuid, refresh_secret_id uuid,          -- ids no Vault (nunca o token)
  token_expires_at timestamptz, last_error text,
  settings jsonb not null default '{}'::jsonb,           -- idioma, posts por semana, horários, fuso, modo de resposta, links, extensão
  comments_checked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by text
);
create table if not exists public.linkedin_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'posted', 'failed', 'rejected')),
  theme text, body text not null check (char_length(body) between 1 and 3000),
  language text not null default 'pt' check (language in ('pt', 'en', 'es')),
  scheduled_at timestamptz not null,
  approved_by text, approved_at timestamptz, posted_at timestamptz,
  post_urn text, error text, attempts integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists linkedin_posts_c on public.linkedin_posts(company_id, scheduled_at);
create index if not exists linkedin_posts_due on public.linkedin_posts(scheduled_at) where status = 'approved';
create table if not exists public.linkedin_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null,
  post_id uuid references public.linkedin_posts(id) on delete set null,
  post_urn text not null, comment_urn text not null, parent_urn text,
  author_urn text, author_name text, body text not null, commented_at timestamptz,
  is_lead boolean not null default false, lead_reason text,
  reply text, status text not null default 'pending' check (status in ('pending', 'replied', 'ignored', 'failed')),
  replied_at timestamptz, replied_by text, reply_urn text, error text,
  lead_id uuid, ct_contact_id uuid,
  created_at timestamptz not null default now(),
  unique (company_id, comment_urn)
);
create index if not exists linkedin_comments_c on public.linkedin_comments(company_id, status, created_at desc);
-- extensão do Chrome: código de conexão (só o hash) e registro do que passou pelo agente (sem guardar conversas)
create table if not exists public.linkedin_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null, user_id uuid, nome text, token_hash text not null unique,
  created_at timestamptz not null default now(), last_seen timestamptz, revoked_at timestamptz
);
create table if not exists public.linkedin_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid not null,
  device_id uuid, origem text not null check (origem in ('feed', 'grupo', 'dm', 'comentario', 'calendario')),
  acao text not null check (acao in ('sugerido', 'copiado', 'colado', 'enviado_auto', 'ignorado', 'bloqueado', 'lead')),
  is_lead boolean not null default false, detalhe text,
  created_at timestamptz not null default now()
);
create index if not exists linkedin_log_c on public.linkedin_log(company_id, created_at desc);

-- 3. RLS: admin ou dono da empresa leem; ninguém escreve pelo navegador
create or replace function public.li_pode_ver(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.my_client_role(p_client) = 'owner'
$$;
revoke all on function public.li_pode_ver(uuid) from public;
grant execute on function public.li_pode_ver(uuid) to authenticated;
do $$ declare t text; begin
  foreach t in array array['linkedin_accounts', 'linkedin_posts', 'linkedin_comments', 'linkedin_devices', 'linkedin_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_ver', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.li_pode_ver(client_id))', t || '_ver', t);
  end loop;
end $$;
-- o navegador não lê os ids dos segredos nem o hash do código da extensão
revoke select (token_secret_id, refresh_secret_id) on public.linkedin_accounts from authenticated, anon;
revoke select (token_hash) on public.linkedin_devices from authenticated, anon;

-- 4. tokens no Vault (só o servidor)
create or replace function public.li_token_set(p_company uuid, p_access text, p_refresh text, p_expires timestamptz) returns void
language plpgsql security definer set search_path = public, vault as $$
declare a uuid; r uuid;
begin
  select token_secret_id, refresh_secret_id into a, r from public.linkedin_accounts where company_id = p_company;
  if p_access is null then
    if a is not null then delete from vault.secrets where id = a; end if;
    if r is not null then delete from vault.secrets where id = r; end if;
    update public.linkedin_accounts set token_secret_id = null, refresh_secret_id = null, token_expires_at = null, updated_at = now() where company_id = p_company;
    return;
  end if;
  if a is not null then perform vault.update_secret(a, p_access); else a := vault.create_secret(p_access, 'linkedin_access_' || p_company, 'LinkedIn access token'); end if;
  if p_refresh is not null then
    if r is not null then perform vault.update_secret(r, p_refresh); else r := vault.create_secret(p_refresh, 'linkedin_refresh_' || p_company, 'LinkedIn refresh token'); end if;
  end if;
  update public.linkedin_accounts set token_secret_id = a, refresh_secret_id = r, token_expires_at = p_expires, updated_at = now() where company_id = p_company;
end $$;
create or replace function public.li_token_get(p_company uuid) returns table (access_token text, refresh_token text)
language sql stable security definer set search_path = public, vault as $$
  select (select decrypted_secret from vault.decrypted_secrets where id = l.token_secret_id),
         (select decrypted_secret from vault.decrypted_secrets where id = l.refresh_secret_id)
  from public.linkedin_accounts l where l.company_id = p_company
$$;
revoke all on function public.li_token_set(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.li_token_get(uuid) from public, anon, authenticated;
grant execute on function public.li_token_set(uuid, text, text, timestamptz) to service_role;
grant execute on function public.li_token_get(uuid) to service_role;

-- 5. CRM: origem "linkedin" (um comentário não traz e-mail nem telefone; o perfil vai nas notas)
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['contact_form', 'booking', 'manual', 'partner', 'chat', 'instagram', 'webinar', 'whatsapp', 'linkedin']));
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%email IS NOT NULL) OR (phone IS NOT NULL%';
  if c is not null then execute format('alter table public.leads drop constraint %I', c); end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_contact_check') then
    alter table public.leads add constraint leads_contact_check check (email is not null or phone is not null or source = 'linkedin');
  end if;
end $$;

-- 6. cron (mesmo padrão do Instagram: chave do gancho no Vault, sem chave no SQL)
create or replace function public.li_tick(p_event text) returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if p_event = 'publicar' and not exists (select 1 from public.linkedin_posts where status = 'approved' and scheduled_at <= now()) then return; end if;
  if p_event = 'comentarios' and not exists (select 1 from public.linkedin_accounts where enabled and status = 'connected') then return; end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key' limit 1;
  if k is null then return; end if;
  perform net.http_post(url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/linkedin', body := jsonb_build_object('acao', 'tick_' || p_event),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k), timeout_milliseconds := 120000);
end $$;
revoke all on function public.li_tick(text) from public, anon, authenticated;
select cron.unschedule(jobname) from cron.job where jobname in ('linkedin-publisher', 'linkedin-comments');
select cron.schedule('linkedin-publisher', '*/5 * * * *', $$select public.li_tick('publicar');$$);
select cron.schedule('linkedin-comments', '*/15 * * * *', $$select public.li_tick('comentarios');$$);
