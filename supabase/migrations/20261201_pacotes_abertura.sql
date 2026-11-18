-- Pacotes de abertura (Essencial e Completo), add-ons no carrinho e catálogo de Add-ons no portal.
--   store_products.kind          tool (ferramenta avulsa), addon (só como adicional), package (pacote de abertura)
--   store_products.setup_cents   valor de abertura cobrado uma vez junto com a 1ª mensalidade (pacotes)
--   store_products.member_cents  preço para quem já é cliente com pacote (null = sem desconto)
--   store_products.category      tipo, para a busca da página Add-ons
--   store_orders.items           add-ons escolhidos no carrinho; setup_cents / monthly_cents = totais do pedido
--   client_services.included_in  pacote que inclui o serviço (não se cancela sozinho)
--   client_services.stripe_item_id  item da assinatura do pacote (cancelar o add-on sem cancelar o pacote)
alter table public.store_products add column if not exists kind text not null default 'tool';
alter table public.store_products add column if not exists setup_cents integer not null default 0;
alter table public.store_products add column if not exists member_cents integer;
alter table public.store_products add column if not exists category text not null default 'empresa';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'store_products_kind_check') then
    alter table public.store_products add constraint store_products_kind_check check (kind in ('tool', 'addon', 'package'));
    alter table public.store_products add constraint store_products_setup_check check (setup_cents >= 0);
    alter table public.store_products add constraint store_products_member_check check (member_cents is null or member_cents >= 0);
    alter table public.store_products add constraint store_products_category_check check (category in ('empresa', 'vendas', 'comunicacao', 'financeiro', 'documentos'));
  end if;
end $$;

alter table public.store_orders add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.store_orders add column if not exists setup_cents integer not null default 0;
alter table public.store_orders add column if not exists monthly_cents integer not null default 0;
alter table public.store_orders add column if not exists options jsonb not null default '{}'::jsonb;

alter table public.client_services add column if not exists included_in text;
alter table public.client_services add column if not exists stripe_item_id text;

update public.store_products set category = 'vendas' where code in ('crm', 'agenda');
update public.store_products set category = 'documentos' where code = 'esign';
update public.store_products set category = 'financeiro' where code = 'bookkeeping';
update public.store_products set category = 'empresa' where code in ('registered_agent', 'virtual_address');

insert into public.store_products (code, kind, price_cents, setup_cents, interval, currency, status, sort, category) values
  ('pkg_essencial', 'package', 5900, 99900, 'month', 'usd', 'active', 1, 'empresa'),
  ('pkg_completo', 'package', 19900, 149700, 'month', 'usd', 'active', 2, 'empresa'),
  ('operating_agreement', 'addon', 29700, 0, 'once', 'usd', 'active', 45, 'documentos'),
  ('telefone', 'tool', 1999, 0, 'month', 'usd', 'active', 46, 'comunicacao')
on conflict (code) do nothing;

-- desconto inicial de 20% nas ferramentas para quem já é cliente com pacote (ajustável em Admin › Pagamentos › Loja)
update public.store_products set member_cents = round(price_cents * 0.8) where code in ('crm', 'agenda', 'esign') and member_cents is null;

-- é cliente com pacote ativo (preço de cliente na página Add-ons)
create or replace function public.client_is_member(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  -- só responde para quem é da conta (ou admin); para os outros, sempre false
  select (public.is_admin() or public.my_client_role(p_client) is not null or auth.role() = 'service_role')
    and exists (select 1 from public.client_services s where s.client_id = p_client and s.product_code in ('pkg_essencial', 'pkg_completo') and s.status in ('active', 'past_due'))
$$;
revoke all on function public.client_is_member(uuid) from public;
grant execute on function public.client_is_member(uuid) to authenticated, service_role;
