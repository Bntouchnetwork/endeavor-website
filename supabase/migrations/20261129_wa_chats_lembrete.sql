-- WhatsApp Manager 1.9.0: mensagens automáticas (lembrete de serviços nos grupos). Estado do agendamento por grupo.
alter table public.wa_chats add column if not exists auto jsonb;
comment on column public.wa_chats.auto is 'Mensagens automáticas (lembrete de serviços) do grupo: {proximo, ultimo, parado, motivo, parado_em}. Estado do servidor, não da configuração.';
