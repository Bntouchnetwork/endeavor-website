-- Leads do WhatsApp chegam só com telefone: o e-mail passa a ser opcional (o check de tamanho continua valendo quando houver e-mail).
alter table public.leads alter column email drop not null;
alter table public.leads add constraint leads_email_ou_telefone check (email is not null or phone is not null) not valid;
alter table public.leads validate constraint leads_email_ou_telefone;
