-- Login único: depois da senha, diz para qual portal a pessoa vai (admin, client, partner).
-- Só responde para quem já está logado e só sobre a própria conta; não muda nada no banco.
create or replace function public.login_route()
returns text[]
language sql stable security definer
set search_path to 'public'
as $$
  with u as (select id, lower(email) em from auth.users where id = auth.uid())
  select coalesce(array_agg(t order by ord), '{}') from (
    select 'admin' t, 1 ord where exists (select 1 from public.admins a, u where lower(a.email) = u.em)
    union all
    select 'client', 2 where exists (select 1 from public.client_users cu join public.clients c on c.id = cu.client_id, u
      where cu.role = 'owner' and c.status = 'active' and ((cu.user_id = u.id and cu.status = 'active') or (cu.user_id is null and cu.status = 'invited' and lower(cu.email) = u.em)))
    union all
    select 'partner', 3 where exists (select 1 from public.client_users cu join public.clients c on c.id = cu.client_id, u
      where cu.role = 'collaborator' and c.status = 'active' and ((cu.user_id = u.id and cu.status = 'active') or (cu.user_id is null and cu.status = 'invited' and lower(cu.email) = u.em)))
      or exists (select 1 from public.partners p, u where (p.user_id = u.id and p.status = 'active') or (p.user_id is null and p.status = 'invited' and lower(p.email) = u.em))
  ) x;
$$;
revoke all on function public.login_route() from public, anon;
grant execute on function public.login_route() to authenticated;
