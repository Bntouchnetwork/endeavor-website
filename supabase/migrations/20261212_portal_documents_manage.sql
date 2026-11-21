-- Portal > Documentos: o cliente exclui o próprio envio (soft delete) e a equipe pede documentos.
-- Já aplicada no banco (migração "portal_documents_manage"); este arquivo é o registro, escrito para poder rodar de novo.
alter table public.company_documents add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid;

alter table public.doc_access_log drop constraint if exists doc_access_log_action_check;
alter table public.doc_access_log add constraint doc_access_log_action_check check (action = any (array['view','download','upload','delete']));

drop policy if exists docs_member_read on public.company_documents;
create policy docs_member_read on public.company_documents for select to authenticated
  using (deleted_at is null and ((visible_to_client and public.can_view_doc(client_id, company_id, category)) or (uploaded_by = auth.uid() and public.my_client_role(client_id) is not null)));

-- só o que a própria pessoa enviou; o arquivo fica guardado e a equipe continua vendo
create or replace function public.portal_doc_delete(p_doc uuid) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare d public.company_documents%rowtype;
begin
  select * into d from public.company_documents where id = p_doc and deleted_at is null;
  if not found then return false; end if;
  if d.category <> 'uploaded' or d.uploaded_by is distinct from auth.uid() or public.my_client_role(d.client_id) is null then raise exception 'forbidden'; end if;
  update public.company_documents set deleted_at = now(), deleted_by = auth.uid() where id = p_doc;
  insert into public.doc_access_log (document_id, user_id, email, action) values (p_doc, auth.uid(), coalesce(auth.jwt()->>'email',''), 'delete');
  return true;
end $$;

create table if not exists public.portal_doc_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  note text check (note is null or char_length(note) <= 600),
  due_date date,
  status text not null default 'pending' check (status = any (array['pending','received','cancelled'])),
  document_id uuid references public.company_documents(id) on delete set null,
  created_by text, notified_at timestamptz, received_at timestamptz, received_by text
);
create index if not exists portal_doc_requests_client_idx on public.portal_doc_requests (client_id, status);
alter table public.portal_doc_requests enable row level security;
drop policy if exists pdr_admin on public.portal_doc_requests;
create policy pdr_admin on public.portal_doc_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists pdr_member_read on public.portal_doc_requests;
create policy pdr_member_read on public.portal_doc_requests for select to authenticated
  using (status <> 'cancelled' and public.my_client_can(client_id, 'upload') and (company_id is null or public.can_access_company(client_id, company_id)));

-- o envio do cliente marca o pedido como recebido e avisa a equipe no sino
create or replace function public.portal_doc_request_done(p_id uuid, p_doc uuid) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare r public.portal_doc_requests%rowtype; d public.company_documents%rowtype; v_client text;
begin
  select * into r from public.portal_doc_requests where id = p_id;
  if not found or r.status <> 'pending' then return false; end if;
  if not public.my_client_can(r.client_id, 'upload') then raise exception 'forbidden'; end if;
  select * into d from public.company_documents where id = p_doc;
  if not found or d.client_id <> r.client_id or d.uploaded_by is distinct from auth.uid() then raise exception 'forbidden'; end if;
  update public.portal_doc_requests set status = 'received', document_id = p_doc, received_at = now(), received_by = coalesce(auth.jwt()->>'email','') where id = p_id;
  select name into v_client from public.clients where id = r.client_id;
  insert into public.admin_events (kind, title, body, link) values ('doc_request_done', left('Documento solicitado recebido: ' || r.title, 300), left(coalesce(v_client,'') || ' · enviado por ' || coalesce(auth.jwt()->>'email',''), 2000), '#/clientes?id=' || r.client_id);
  return true;
end $$;
revoke all on function public.portal_doc_delete(uuid), public.portal_doc_request_done(uuid, uuid) from public, anon;
grant execute on function public.portal_doc_delete(uuid), public.portal_doc_request_done(uuid, uuid) to authenticated;
