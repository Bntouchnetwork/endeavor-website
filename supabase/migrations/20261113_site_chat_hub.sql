-- site chat: the proposal form is offered at most once per conversation when the visitor shows buying intent
alter table public.site_chats add column if not exists lead_offered boolean not null default false;
