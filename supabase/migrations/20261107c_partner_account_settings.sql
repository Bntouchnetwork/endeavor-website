-- Partner "My account": edit contact details, second e-mail, change password with the current one, request account closure

alter table public.partners add column if not exists email2 text check (email2 is null or email2 ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');
alter table public.partners add column if not exists closure_requested_at timestamptz;
alter table public.partners add column if not exists closed_at timestamptz;

-- failed password checks (to slow down guessing)
create table if not exists public.password_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  at timestamptz not null default now(),
  ok boolean not null
);
create index if not exists password_checks_user on public.password_checks(user_id, at desc);
alter table public.password_checks enable row level security;

-- checks the signed-in user's current password (max 5 wrong tries per 15 minutes)
create or replace function public.verify_my_password(p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.password_checks where user_id = auth.uid() and not ok and at > now() - interval '15 minutes') >= 5 then raise exception 'too_many_attempts'; end if;
  select encrypted_password into v_hash from auth.users where id = auth.uid();
  v_ok := v_hash is not null and coalesce(p_password, '') <> '' and v_hash = extensions.crypt(p_password, v_hash);
  insert into public.password_checks(user_id, ok) values (auth.uid(), v_ok);
  return v_ok;
end $$;
revoke all on function public.verify_my_password(text) from public, anon;
grant execute on function public.verify_my_password(text) to authenticated;

-- contact details (the login e-mail changes through Supabase Auth with a confirmation link)
create or replace function public.partner_update_profile(p_name text, p_phone text, p_company text, p_email2 text)
returns setof public.partners language plpgsql security definer set search_path = public as $$
declare v uuid; v_e2 text := nullif(lower(btrim(coalesce(p_email2, ''))), '');
begin
  select id into v from public.partners where user_id = auth.uid() and status = 'active';
  if v is null then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'invalid_name'; end if;
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'invalid_phone'; end if;
  if v_e2 is not null and v_e2 !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'invalid_email'; end if;
  update public.partners set name = left(btrim(p_name), 200), phone = p_phone, company = nullif(left(btrim(coalesce(p_company, '')), 200), ''), email2 = v_e2 where id = v;
  update public.leads set name = left(btrim(p_name), 200), phone = p_phone where partner_id = v;
  return query select * from public.partners where id = v;
end $$;
revoke all on function public.partner_update_profile(text, text, text, text) from public, anon;
grant execute on function public.partner_update_profile(text, text, text, text) to authenticated;

-- after the new login e-mail is confirmed, the partner record follows it
create or replace function public.partner_sync_email() returns setof public.partners
language plpgsql security definer set search_path = public as $$
declare v_mail text; v uuid; v_old text;
begin
  select lower(email) into v_mail from auth.users where id = auth.uid();
  select id, email into v, v_old from public.partners where user_id = auth.uid();
  if v is null then return; end if;
  if v_mail is not null and lower(v_old) <> v_mail then
    update public.partners set email = v_mail where id = v;
    insert into public.admin_events(kind, title, body, link) select 'partner_new', 'Parceiro trocou o e-mail de login: ' || p.name, v_old || ' → ' || v_mail, '#/parceiros?id=' || p.id from public.partners p where p.id = v;
  end if;
  return query select * from public.partners where id = v;
end $$;
revoke all on function public.partner_sync_email() from public, anon;
grant execute on function public.partner_sync_email() to authenticated;

-- account closure: no new referrals; the account stays open until the last commission is paid, then it is closed automatically
create or replace function public.partner_request_closure(p_password text) returns setof public.partners
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.partners where user_id = auth.uid() and status = 'active';
  if v is null then raise exception 'forbidden'; end if;
  if not public.verify_my_password(p_password) then raise exception 'wrong_password'; end if;
  update public.partners set closure_requested_at = coalesce(closure_requested_at, now()) where id = v;
  insert into public.admin_events(kind, title, body, link)
  select 'partner_new', 'Parceiro pediu para encerrar a conta: ' || p.name, 'Sem novas indicações. A conta fecha sozinha depois do último repasse de comissão.', '#/parceiros?id=' || p.id from public.partners p where p.id = v;
  return query select * from public.partners where id = v;
end $$;
revoke all on function public.partner_request_closure(text) from public, anon;
grant execute on function public.partner_request_closure(text) to authenticated;

create or replace function public.partner_cancel_closure() returns setof public.partners
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.partners where user_id = auth.uid() and status = 'active' and closure_requested_at is not null;
  if v is null then raise exception 'forbidden'; end if;
  update public.partners set closure_requested_at = null where id = v;
  insert into public.admin_events(kind, title, body, link) select 'partner_new', 'Parceiro cancelou o encerramento: ' || p.name, 'A conta continua ativa.', '#/parceiros?id=' || p.id from public.partners p where p.id = v;
  return query select * from public.partners where id = v;
end $$;
revoke all on function public.partner_cancel_closure() from public, anon;
grant execute on function public.partner_cancel_closure() to authenticated;

-- commissions still to be paid to a partner (used before closing the account)
create or replace function public.partner_open_commissions(p_partner uuid) returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from public.invoices i
   where i.partner_id = p_partner and coalesce(i.partner_amount_cents, 0) > 0
     and (i.status in ('draft', 'open') or (i.status = 'paid' and i.transfer_status in ('none', 'scheduled', 'pending', 'failed')))
$$;
revoke all on function public.partner_open_commissions(uuid) from public, anon, authenticated;

-- no new referrals once the partner asked to close the account
create or replace function public.submit_referral(p jsonb)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_pid uuid := public.my_partner_id(); v_partner public.partners; v_lead uuid; v_ref uuid; v_name text; v_email text;
begin
  if v_pid is null then raise exception 'forbidden'; end if;
  select * into v_partner from public.partners where id = v_pid;
  if v_partner.program_status <> 'approved' then raise exception 'pending_approval'; end if;
  if v_partner.closure_requested_at is not null then raise exception 'account_closing'; end if;
  if (select count(*) from public.referrals where partner_id = v_pid and created_at > now() - interval '1 day') >= 30 then raise exception 'rate_limited'; end if;
  v_name := btrim(coalesce(p->>'name','')); v_email := lower(btrim(coalesce(p->>'email','')));
  if char_length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'consent_required'; end if;
  insert into public.leads(name, email, phone, country, company, assistance, message, language, source, status, marketing_consent, notes)
  values (left(v_name,200), v_email, left(p->>'phone',50), left(p->>'country',100), left(p->>'company',200), left(p->>'service',100),
          left(coalesce(p->>'message',''),3000), coalesce(nullif(p->>'language',''),'pt'), 'partner', 'new', false,
          'Indicado pelo parceiro ' || v_partner.name || coalesce(' (' || v_partner.company || ')','') || ' <' || v_partner.email || '>')
  returning id into v_lead;
  insert into public.referrals(partner_id, lead_id, name, email, phone, country, company, service, message, language, consent)
  values (v_pid, v_lead, left(v_name,200), v_email, left(p->>'phone',50), left(p->>'country',100), left(p->>'company',200), left(p->>'service',100),
          left(coalesce(p->>'message',''),3000), coalesce(nullif(p->>'language',''),'pt'), true)
  returning id into v_ref;
  insert into public.referral_events(referral_id, kind, label, created_by) values (v_ref, 'status', 'submitted', v_partner.email);
  return v_ref;
end $function$;
