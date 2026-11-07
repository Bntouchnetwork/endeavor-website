-- What the partner sees about a closed deal in the referral timeline: service contracted, package value and commission
create or replace function public.partner_referral_deals(p_referral uuid)
returns table(source text, title text, total_cents int, currency text, partner_pct numeric, commission_cents int, closed_at timestamptz, invoice_status text, transfer_status text)
language sql security definer set search_path = public stable as $$
  with r as (select id from public.referrals where id = p_referral and partner_id = public.my_partner_id())
  select 'proposal', p.title, p.total_cents, p.currency, coalesce(i.partner_pct, p.partner_pct),
         coalesce(i.partner_amount_cents, round(p.total_cents * coalesce(p.partner_pct, 0) / 100)::int),
         p.accepted_at, i.status, i.transfer_status
    from public.proposals p join r on r.id = p.referral_id
    left join public.invoices i on i.id = p.invoice_id
   where p.status = 'accepted'
  union all
  select 'invoice', coalesce(nullif(i.description, ''), i.number, 'Invoice'), i.total_cents, i.currency, i.partner_pct, coalesce(i.partner_amount_cents, 0),
         coalesce(i.sent_at, i.created_at), i.status, i.transfer_status
    from public.invoices i join r on r.id = i.referral_id
   where i.proposal_id is null and i.status in ('open', 'paid')
  order by 7
$$;
revoke all on function public.partner_referral_deals(uuid) from public, anon;
grant execute on function public.partner_referral_deals(uuid) to authenticated;
