-- dados do contato que a pessoa passou na conversa (card do painel da extensão)
alter table public.wa_chats add column if not exists contato jsonb;
