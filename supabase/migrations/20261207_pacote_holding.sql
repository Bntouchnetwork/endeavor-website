-- Pacote Operacional + Holding: vendido só por proposta (escondido na loja; o preço não aparece no site).
insert into public.store_products (code, kind, price_cents, setup_cents, interval, currency, status, sort, category)
values ('pkg_holding', 'package', 24900, 0, 'month', 'usd', 'hidden', 3, 'empresa')
on conflict (code) do nothing;

-- quem tem um produto escondido na conta (ex.: o pacote Holding) consegue ler esse produto, para ver a mensalidade em Meu plano
drop policy if exists sp_owned_read on public.store_products;
create policy sp_owned_read on public.store_products for select to authenticated
  using (exists (select 1 from public.client_services s where s.product_code = store_products.code and s.status in ('active', 'past_due') and public.my_client_role(s.client_id) is not null));

-- cliente com pacote (preço de cliente nos add-ons): agora também o Holding
create or replace function public.client_is_member(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (public.is_admin() or public.my_client_role(p_client) is not null or auth.role() = 'service_role')
    and exists (select 1 from public.client_services s where s.client_id = p_client and s.product_code in ('pkg_essencial', 'pkg_completo', 'pkg_holding') and s.status in ('active', 'past_due'))
$$;
