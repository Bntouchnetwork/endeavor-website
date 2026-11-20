-- LinkedIn Manager: o navegador só lê (a RLS decide quais linhas) e nunca vê os ids dos segredos nem o hash do código
-- da extensão. Tirar a permissão de uma coluna não funciona enquanto a tabela inteira está liberada; por isso a
-- permissão passa a ser dada coluna a coluna.
revoke all on public.linkedin_accounts, public.linkedin_posts, public.linkedin_comments, public.linkedin_devices, public.linkedin_log from anon, authenticated;
grant select on public.linkedin_posts, public.linkedin_comments, public.linkedin_log to authenticated;
grant select (company_id, client_id, enabled, status, org_urn, org_name, member_name, token_expires_at, last_error, settings, comments_checked_at, created_at, updated_at, updated_by) on public.linkedin_accounts to authenticated;
grant select (id, company_id, client_id, user_id, nome, created_at, last_seen, revoked_at) on public.linkedin_devices to authenticated;
revoke insert, update, delete on public.business_activities from anon, authenticated;
