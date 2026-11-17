-- Fase 2 do fluxo de documentos (agente de documentos do CRM, função "docs"):
-- Google Drive por empresa (conta "endeavor" ou id do cliente), com a permissão mínima drive.file (o app só enxerga as
-- pastas que ele mesmo cria). O token fica no Vault; as tabelas guardam só o id do segredo.
-- O cliente envia cada documento por uma página segura (docs.html?t=…) direto do navegador para o Google Drive:
-- os arquivos não passam pela Endeavor. O CRM sabe o que falta pelo documento escolhido em cada envio.

create table if not exists public.storage_connections (
  conta text primary key,
  provider text not null default 'google' check (provider in ('google')),
  account_email text check (account_email is null or char_length(account_email) <= 254),
  secret_id uuid,
  root_folder_id text,
  status text not null default 'desconectado' check (status in ('conectado', 'desconectado', 'erro')),
  erro text,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.storage_connections enable row level security;
drop policy if exists storage_connections_admin on public.storage_connections;
create policy storage_connections_admin on public.storage_connections for all using (is_admin()) with check (is_admin());

-- estado do consentimento OAuth (vale 15 minutos; só a função lê)
create table if not exists public.oauth_states (
  state text primary key,
  conta text not null,
  user_id uuid,
  volta text,
  created_at timestamptz not null default now()
);
alter table public.oauth_states enable row level security;

alter table public.crm_requests add column if not exists upload_token text unique;
alter table public.crm_requests add column if not exists recebidos jsonb not null default '{}'::jsonb;
alter table public.crm_requests add column if not exists email_alt text;
alter table public.crm_requests add column if not exists idioma text not null default 'pt';
alter table public.crm_requests add column if not exists enviado_at timestamptz;
alter table public.crm_requests add column if not exists ultimo_followup_at timestamptz;
alter table public.crm_requests add column if not exists followups int not null default 0;
alter table public.crm_requests add column if not exists reenvios int not null default 0;

-- segundo e-mail do contato (o cliente pode pedir para mandar a outro endereço)
alter table public.leads add column if not exists email2 text check (email2 is null or email2 ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');
alter table public.ct_contacts add column if not exists email2 text check (email2 is null or email2 ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');

-- token do Google no Vault (só a função, com a service role, grava e lê)
create or replace function public.storage_set_secret(p_conta text, p_secret text, p_email text) returns void
language plpgsql security definer set search_path = public, vault as $$
declare cur uuid; sid uuid;
begin
  select secret_id into cur from public.storage_connections where conta = p_conta;
  if p_secret is null or btrim(p_secret) = '' then
    if cur is not null then delete from vault.secrets where id = cur; end if;
    insert into public.storage_connections (conta, status, secret_id, account_email, updated_at) values (p_conta, 'desconectado', null, null, now())
      on conflict (conta) do update set status = 'desconectado', secret_id = null, account_email = null, root_folder_id = null, erro = null, updated_at = now();
    return;
  end if;
  if cur is not null then perform vault.update_secret(cur, p_secret); sid := cur;
  else sid := vault.create_secret(p_secret, 'storage_google_' || p_conta, 'Google Drive (drive.file) da conta ' || p_conta); end if;
  insert into public.storage_connections (conta, provider, status, secret_id, account_email, connected_at, erro, updated_at)
    values (p_conta, 'google', 'conectado', sid, left(p_email, 254), now(), null, now())
    on conflict (conta) do update set provider = 'google', status = 'conectado', secret_id = sid, account_email = left(p_email, 254), connected_at = now(), erro = null, updated_at = now();
end $$;
create or replace function public.storage_get_secret(p_conta text) returns text
language sql stable security definer set search_path = public, vault as $$
  select d.decrypted_secret from public.storage_connections s join vault.decrypted_secrets d on d.id = s.secret_id where s.conta = p_conta and s.status = 'conectado';
$$;
revoke all on function public.storage_set_secret(text, text, text) from public, anon, authenticated;
revoke all on function public.storage_get_secret(text) from public, anon, authenticated;
grant execute on function public.storage_set_secret(text, text, text) to service_role;
grant execute on function public.storage_get_secret(text) to service_role;

-- a cada 10 minutos: pedidos novos (envio da lista) e follow-up do que falta
create or replace function public.docs_tick() returns void
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key';
  perform net.http_post(
    url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/docs',
    body := jsonb_build_object('acao', 'tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k),
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.docs_tick() from public, anon, authenticated;
select cron.schedule('docs-followup', '*/10 * * * *', 'select public.docs_tick();');
