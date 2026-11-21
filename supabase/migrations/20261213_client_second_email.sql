-- Portal do cliente > Configurações: segundo e-mail (cópia dos avisos) e troca do e-mail principal (login)
alter table public.clients add column if not exists email2 text check (email2 is null or email2 ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$');

-- o titular grava, edita ou remove o segundo e-mail
create or replace function public.client_set_email2(p_client uuid, p_email text) returns text language plpgsql security definer set search_path to 'public' as $$
declare v text := nullif(lower(btrim(coalesce(p_email, ''))), ''); v_primary text;
begin
  if not (public.is_admin() or public.my_client_role(p_client) = 'owner') then raise exception 'forbidden'; end if;
  select lower(primary_email) into v_primary from public.clients where id = p_client;
  if v is not null and v !~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'invalid_email'; end if;
  if v is not null and v = v_primary then raise exception 'same_as_primary'; end if;
  update public.clients set email2 = v, updated_at = now() where id = p_client;
  return v;
end $$;

-- depois que o e-mail de login foi confirmado no Auth: o cadastro acompanha (o antigo vira o segundo e-mail) e a equipe é avisada
create or replace function public.client_email_sync() returns boolean language plpgsql security definer set search_path to 'public' as $$
declare v_new text; r record; v_changed boolean := false; v_name text;
begin
  select lower(email) into v_new from auth.users where id = auth.uid();
  if v_new is null then return false; end if;
  for r in select cu.id, cu.client_id, cu.role, lower(cu.email) old from public.client_users cu where cu.user_id = auth.uid() and lower(cu.email) is distinct from v_new loop
    update public.client_users set email = v_new where id = r.id;
    if r.role = 'owner' then
      update public.clients set primary_email = v_new, email2 = case when email2 is null or lower(email2) = v_new then r.old else email2 end, updated_at = now()
        where id = r.client_id and lower(primary_email) = r.old;
    end if;
    select name into v_name from public.clients where id = r.client_id;
    insert into public.admin_events (kind, title, body, link) values ('client_email_changed', left('E-mail de login trocado: ' || coalesce(v_name, ''), 300), r.old || ' → ' || v_new, '#/clientes?id=' || r.client_id);
    v_changed := true;
  end loop;
  return v_changed;
end $$;
revoke all on function public.client_set_email2(uuid, text), public.client_email_sync() from public, anon;
grant execute on function public.client_set_email2(uuid, text), public.client_email_sync() to authenticated;
