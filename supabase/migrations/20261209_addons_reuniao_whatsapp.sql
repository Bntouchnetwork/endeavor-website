-- Web Meeting, Live Webinar e WhatsApp Manager entram na loja com preço, como "Em breve" (sem compra) até o teste do checkout.
-- Para liberar: Admin › Pagamentos › Loja › "À venda".
insert into public.store_products (code, kind, sort, status, category, currency, "interval", price_cents, setup_cents, member_cents) values
  ('webmeeting', 'tool', 47, 'coming_soon', 'comunicacao', 'usd', 'month', 1900, 0, null),
  ('webinar',    'tool', 48, 'coming_soon', 'comunicacao', 'usd', 'month', 9900, 0, null),
  ('whatsapp',   'tool', 49, 'coming_soon', 'vendas',      'usd', 'month', 7900, 0, null)
on conflict (code) do nothing;
