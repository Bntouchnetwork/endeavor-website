-- Autorização de débito automático (portal › Billing): o dono da conta marca o aceite e digita o nome completo no primeiro pagamento.
-- Guarda quem autorizou, quando, de onde (IP e navegador) e em qual forma de pagamento. Nunca guarda número de cartão nem de conta.
create table if not exists public.billing_authorizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid,
  user_email text,
  signer_name text not null check (char_length(signer_name) between 3 and 200),
  text_version text not null,
  consent_text text not null check (char_length(consent_text) <= 4000),
  language text,
  method_type text check (method_type in ('card', 'us_bank_account')),
  method_label text check (method_label is null or char_length(method_label) <= 120),
  stripe_payment_method_id text,
  method_saved boolean not null default false,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_status text,
  ip text,
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  revoked_at timestamptz,
  revoked_by text
);
create index if not exists billing_authorizations_client_idx on public.billing_authorizations (client_id, created_at desc);
alter table public.billing_authorizations enable row level security;
revoke all on public.billing_authorizations from anon, authenticated;
grant select on public.billing_authorizations to authenticated;
drop policy if exists ba_admin_read on public.billing_authorizations;
create policy ba_admin_read on public.billing_authorizations for select to authenticated using (public.is_admin());
drop policy if exists ba_owner_read on public.billing_authorizations;
create policy ba_owner_read on public.billing_authorizations for select to authenticated using (public.my_client_role(client_id) = 'owner');
