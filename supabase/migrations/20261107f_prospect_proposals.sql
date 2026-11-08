-- Lead -> prospect -> proposal -> (accepted) client.
-- A prospect gets a client record with status 'prospect' only to hold the proposal: no portal access, not listed under Clientes.
-- When the proposal is accepted, the record becomes an active client and the lead becomes a client.
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check check (status = any (array['active', 'archived', 'prospect']));

create or replace function public.admin_prospect_for_proposal(p_lead uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare l public.leads; v uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into l from public.leads where id = p_lead;
  if l.id is null then raise exception 'not_found'; end if;
  select id into v from public.clients where lead_id = l.id and status <> 'archived' order by created_at limit 1;
  if v is null then select id into v from public.clients where lower(primary_email) = lower(l.email) and status <> 'archived' order by created_at limit 1; end if;
  if v is null then
    insert into public.clients(name, primary_email, phone, language, lead_id, status)
    values (l.name, lower(l.email), l.phone, case when l.language in ('pt', 'en', 'es') then l.language else 'pt' end, l.id, 'prospect') returning id into v;
  end if;
  if coalesce(l.kind, 'lead') not in ('client', 'partner') and coalesce(l.status, '') <> 'client' then
    update public.leads set kind = 'prospect', status = case when status in ('qualified', 'proposal') then status else 'qualified' end, followup_stop = true where id = l.id;
  end if;
  return v;
end $$;
revoke all on function public.admin_prospect_for_proposal(uuid) from public, anon;
grant execute on function public.admin_prospect_for_proposal(uuid) to authenticated;

-- proposal sent -> lead "Proposta enviada"; proposal accepted -> client active and lead "Cliente"
create or replace function public.proposal_lead_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lead uuid;
begin
  select lead_id into v_lead from public.clients where id = new.client_id;
  if new.status = 'sent' and old.status is distinct from 'sent' and v_lead is not null then
    update public.leads set status = 'proposal', kind = 'prospect' where id = v_lead and coalesce(kind, 'lead') in ('lead', 'prospect') and status <> 'client';
  end if;
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.clients set status = 'active', updated_at = now() where id = new.client_id and status = 'prospect';
    if v_lead is not null then update public.leads set kind = 'client', status = 'client' where id = v_lead and coalesce(kind, 'lead') <> 'partner'; end if;
  end if;
  return new;
end $$;
drop trigger if exists proposal_lead_sync on public.proposals;
create trigger proposal_lead_sync after update of status on public.proposals for each row execute function public.proposal_lead_sync();
