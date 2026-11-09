-- Partner type in the profile + attorney calendars: attorneys publish their availability in the Partner Portal,
-- clients book a free consultation with any active attorney partner in the Client Portal (fees are agreed directly with the attorney).

alter table public.partners add column if not exists attorney_bookable boolean not null default true;
alter table public.partners add column if not exists attorney_practice text check (attorney_practice is null or char_length(attorney_practice) <= 200);
alter table public.partners add column if not exists attorney_bio text check (attorney_bio is null or char_length(attorney_bio) <= 1200);
alter table public.partners add column if not exists attorney_meeting_info text check (attorney_meeting_info is null or char_length(attorney_meeting_info) <= 500);
alter table public.partners add column if not exists attorney_slot_minutes int not null default 30 check (attorney_slot_minutes in (15, 20, 30, 45, 60, 90));
alter table public.partners add column if not exists attorney_timezone text not null default 'America/New_York';

create table if not exists public.attorney_availability (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
create index if not exists attorney_availability_p on public.attorney_availability(partner_id, weekday);
create table if not exists public.attorney_blackouts (
  partner_id uuid not null references public.partners(id) on delete cascade,
  day date not null,
  primary key (partner_id, day)
);
alter table public.attorney_availability enable row level security;
alter table public.attorney_blackouts enable row level security;
drop policy if exists att_av_own on public.attorney_availability;
create policy att_av_own on public.attorney_availability for select to authenticated using (partner_id = public.my_partner_id() or public.is_admin());
drop policy if exists att_bo_own on public.attorney_blackouts;
create policy att_bo_own on public.attorney_blackouts for select to authenticated using (partner_id = public.my_partner_id() or public.is_admin());

-- bookings with an attorney
alter table public.bookings add column if not exists attorney_id uuid references public.partners(id) on delete set null;
alter table public.bookings add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists bookings_attorney on public.bookings(attorney_id, starts_at) where attorney_id is not null;
drop index if exists public.bookings_no_double;
create unique index bookings_no_double on public.bookings (coalesce(attorney_id, '00000000-0000-0000-0000-000000000000'::uuid), starts_at) where status = 'confirmed';
alter table public.bookings drop constraint if exists bookings_cancelled_by_check;
alter table public.bookings add constraint bookings_cancelled_by_check check (cancelled_by = any (array['client', 'admin', 'attorney']));
alter table public.booking_messages drop constraint if exists booking_messages_audience_check;
alter table public.booking_messages add constraint booking_messages_audience_check check (audience = any (array['client', 'admin', 'attorney']));
drop policy if exists bookings_attorney_read on public.bookings;
create policy bookings_attorney_read on public.bookings for select to authenticated using (attorney_id is not null and attorney_id = public.my_partner_id());
drop policy if exists bookings_client_read on public.bookings;
create policy bookings_client_read on public.bookings for select to authenticated using (client_id is not null and (public.my_membership(client_id)).id is not null);

-- Endeavor's own agenda ignores the attorneys' bookings
create or replace function public.get_available_slots(p_from date, p_to date)
 returns table(slot timestamp with time zone) language plpgsql stable security definer set search_path to 'public' as $function$
declare s public.booking_settings%rowtype; d date; r record; t timestamptz; t_end timestamptz; today date; last_day date;
begin
  select * into s from public.booking_settings where id = 1;
  today := (now() at time zone s.timezone)::date;
  last_day := today + s.max_days_ahead;
  if p_to - p_from > 62 then p_to := p_from + 62; end if;
  for d in select generate_series(greatest(p_from, today), least(p_to, last_day), interval '1 day')::date loop
    continue when exists (select 1 from public.blackout_dates b where b.day = d);
    for r in select start_time, end_time from public.availability_rules where weekday = extract(dow from d)::int order by start_time loop
      t := (d + r.start_time) at time zone s.timezone;
      t_end := (d + r.end_time) at time zone s.timezone;
      while t + make_interval(mins => s.slot_minutes) <= t_end loop
        if t >= now() + make_interval(hours => s.min_notice_hours)
           and not exists (select 1 from public.bookings b where b.status = 'confirmed' and b.attorney_id is null
               and b.starts_at < t + make_interval(mins => s.slot_minutes + s.buffer_minutes)
               and b.ends_at + make_interval(mins => s.buffer_minutes) > t) then
          slot := t; return next;
        end if;
        t := t + make_interval(mins => s.slot_minutes + s.buffer_minutes);
      end loop;
    end loop;
  end loop;
end $function$;

-- free slots of one attorney
create or replace function public.attorney_slots(p_attorney uuid, p_from date, p_to date)
 returns table(slot timestamptz) language plpgsql stable security definer set search_path = public as $$
declare a public.partners; d date; r record; t timestamptz; t_end timestamptz; today date; v_notice int;
begin
  select * into a from public.partners where id = p_attorney and partner_type = 'attorney' and status = 'active' and program_status = 'approved' and attorney_bookable and closure_requested_at is null;
  if a.id is null then return; end if;
  select coalesce(min_notice_hours, 12) into v_notice from public.booking_settings where id = 1;
  today := (now() at time zone a.attorney_timezone)::date;
  if p_to - p_from > 62 then p_to := p_from + 62; end if;
  for d in select generate_series(greatest(p_from, today), least(p_to, today + 60), interval '1 day')::date loop
    continue when exists (select 1 from public.attorney_blackouts b where b.partner_id = a.id and b.day = d);
    for r in select start_time, end_time from public.attorney_availability where partner_id = a.id and weekday = extract(dow from d)::int order by start_time loop
      t := (d + r.start_time) at time zone a.attorney_timezone;
      t_end := (d + r.end_time) at time zone a.attorney_timezone;
      while t + make_interval(mins => a.attorney_slot_minutes) <= t_end loop
        if t >= now() + make_interval(hours => v_notice)
           and not exists (select 1 from public.bookings b where b.status = 'confirmed' and b.attorney_id = a.id
               and b.starts_at < t + make_interval(mins => a.attorney_slot_minutes) and b.ends_at > t) then
          slot := t; return next;
        end if;
        t := t + make_interval(mins => a.attorney_slot_minutes);
      end loop;
    end loop;
  end loop;
end $$;
revoke all on function public.attorney_slots(uuid, date, date) from public, anon;
grant execute on function public.attorney_slots(uuid, date, date) to authenticated;

-- attorneys a signed-in client can book (all active attorney partners with availability)
create or replace function public.attorney_list()
 returns table(id uuid, name text, company text, practice text, bio text, language text, country text, slot_minutes int, timezone text)
 language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.company, p.attorney_practice, p.attorney_bio, p.language, p.country, p.attorney_slot_minutes, p.attorney_timezone
    from public.partners p
   where p.partner_type = 'attorney' and p.status = 'active' and p.program_status = 'approved' and p.attorney_bookable and p.closure_requested_at is null
     and exists (select 1 from public.attorney_availability a where a.partner_id = p.id)
     and (public.is_admin() or exists (select 1 from public.client_users cu where cu.user_id = auth.uid() and cu.status = 'active'))
   order by p.name
$$;
revoke all on function public.attorney_list() from public, anon;
grant execute on function public.attorney_list() to authenticated;

-- the client books (the platform does not charge; fees are agreed directly with the attorney)
create or replace function public.client_book_attorney(p_client uuid, p_attorney uuid, p_start timestamptz, p_meeting_type text, p_topic text, p_notes text, p_timezone text, p_phone text)
 returns uuid language plpgsql security definer set search_path = public as $$
declare m public.client_users; c public.clients; a public.partners; v uuid; v_mail text; v_name text;
begin
  m := public.my_membership(p_client);
  if m.id is null then raise exception 'forbidden'; end if;
  select * into c from public.clients where id = p_client;
  select * into a from public.partners where id = p_attorney;
  if p_meeting_type not in ('video', 'phone', 'whatsapp') then raise exception 'invalid_meeting_type'; end if;
  if p_phone is not null and p_phone <> '' and p_phone !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'invalid_phone'; end if;
  if not exists (select 1 from public.attorney_slots(p_attorney, (p_start at time zone a.attorney_timezone)::date, (p_start at time zone a.attorney_timezone)::date) s where s.slot = p_start) then raise exception 'slot_unavailable'; end if;
  if (select count(*) from public.bookings b where b.client_id = p_client and b.attorney_id = p_attorney and b.status = 'confirmed' and b.starts_at > now()) >= 2 then raise exception 'too_many_bookings'; end if;
  select lower(email) into v_mail from auth.users where id = auth.uid();
  v_name := coalesce(nullif(btrim(m.name), ''), c.name);
  begin
    insert into public.bookings(lead_id, client_id, attorney_id, starts_at, ends_at, name, email, phone, topic, notes, meeting_type, language, timezone)
    values (c.lead_id, p_client, p_attorney, p_start, p_start + make_interval(mins => a.attorney_slot_minutes), left(v_name, 200), coalesce(v_mail, lower(m.email)),
            nullif(btrim(coalesce(p_phone, '')), ''), left(nullif(btrim(coalesce(p_topic, '')), ''), 100), left(nullif(btrim(coalesce(p_notes, '')), ''), 2000), p_meeting_type, coalesce(c.language, 'pt'), left(nullif(btrim(coalesce(p_timezone, '')), ''), 64))
    returning id into v;
  exception when unique_violation then raise exception 'slot_unavailable';
  end;
  return v;
end $$;
revoke all on function public.client_book_attorney(uuid, uuid, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.client_book_attorney(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;

create or replace function public.client_cancel_attorney_booking(p_booking uuid, p_reason text) returns boolean
 language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking and attorney_id is not null for update;
  if b.id is null or (public.my_membership(b.client_id)).id is null then raise exception 'forbidden'; end if;
  if b.status <> 'confirmed' or b.starts_at <= now() then raise exception 'not_changeable'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'client', cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500) where id = b.id;
  return true;
end $$;
revoke all on function public.client_cancel_attorney_booking(uuid, text) from public, anon;
grant execute on function public.client_cancel_attorney_booking(uuid, text) to authenticated;

create or replace function public.client_reschedule_attorney_booking(p_booking uuid, p_new_start timestamptz) returns boolean
 language plpgsql security definer set search_path = public as $$
declare b public.bookings; a public.partners; v_day date;
begin
  select * into b from public.bookings where id = p_booking and attorney_id is not null for update;
  if b.id is null or (public.my_membership(b.client_id)).id is null then raise exception 'forbidden'; end if;
  if b.status <> 'confirmed' or b.starts_at <= now() then raise exception 'not_changeable'; end if;
  if b.schedule_version >= 4 then raise exception 'too_many_changes'; end if;
  select * into a from public.partners where id = b.attorney_id;
  perform set_config('endeavor.booking_silent', '1', true);
  update public.bookings set status = 'cancelled' where id = b.id;
  v_day := (p_new_start at time zone a.attorney_timezone)::date;
  if not exists (select 1 from public.attorney_slots(a.id, v_day, v_day) s where s.slot = p_new_start) then raise exception 'slot_unavailable'; end if;
  perform set_config('endeavor.booking_silent', '0', true);
  update public.bookings set status = 'confirmed', starts_at = p_new_start, ends_at = p_new_start + make_interval(mins => a.attorney_slot_minutes),
    schedule_version = schedule_version + 1, scheduled_at = now() where id = b.id;
  return true;
exception when unique_violation then raise exception 'slot_unavailable';
end $$;
revoke all on function public.client_reschedule_attorney_booking(uuid, timestamptz) from public, anon;
grant execute on function public.client_reschedule_attorney_booking(uuid, timestamptz) to authenticated;

create or replace function public.attorney_cancel_booking(p_booking uuid, p_reason text) returns boolean
 language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking for update;
  if b.id is null or b.attorney_id is null or b.attorney_id <> public.my_partner_id() then raise exception 'forbidden'; end if;
  if b.status <> 'confirmed' or b.starts_at <= now() then raise exception 'not_changeable'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = 'attorney', cancel_reason = left(nullif(btrim(coalesce(p_reason, '')), ''), 500) where id = b.id;
  return true;
end $$;
revoke all on function public.attorney_cancel_booking(uuid, text) from public, anon;
grant execute on function public.attorney_cancel_booking(uuid, text) to authenticated;

-- the attorney's calendar settings and weekly availability (replaces the rules)
create or replace function public.attorney_save_calendar(p_bookable boolean, p_practice text, p_bio text, p_meeting_info text, p_slot int, p_timezone text, p_rules jsonb, p_blackouts date[])
 returns boolean language plpgsql security definer set search_path = public as $$
declare v uuid := public.my_partner_id(); r jsonb;
begin
  if v is null or not exists (select 1 from public.partners where id = v and partner_type = 'attorney') then raise exception 'forbidden'; end if;
  if p_slot not in (15, 20, 30, 45, 60, 90) then raise exception 'invalid_slot'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'invalid_timezone'; end if;
  update public.partners set attorney_bookable = coalesce(p_bookable, true), attorney_practice = nullif(left(btrim(coalesce(p_practice, '')), 200), ''), attorney_bio = nullif(left(btrim(coalesce(p_bio, '')), 1200), ''),
    attorney_meeting_info = nullif(left(btrim(coalesce(p_meeting_info, '')), 500), ''), attorney_slot_minutes = p_slot, attorney_timezone = p_timezone, updated_at = now() where id = v;
  delete from public.attorney_availability where partner_id = v;
  for r in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    if (r->>'weekday')::int between 0 and 6 and (r->>'end')::time > (r->>'start')::time then
      insert into public.attorney_availability(partner_id, weekday, start_time, end_time) values (v, (r->>'weekday')::int, (r->>'start')::time, (r->>'end')::time);
    end if;
  end loop;
  delete from public.attorney_blackouts where partner_id = v;
  insert into public.attorney_blackouts(partner_id, day) select v, d from unnest(coalesce(p_blackouts, '{}'::date[])) d where d >= current_date on conflict do nothing;
  return true;
end $$;
revoke all on function public.attorney_save_calendar(boolean, text, text, text, int, text, jsonb, date[]) from public, anon;
grant execute on function public.attorney_save_calendar(boolean, text, text, text, int, text, jsonb, date[]) to authenticated;

-- partner type chosen in the profile (realtor, accountant, attorney, other...)
create or replace function public.partner_set_type(p_type text) returns setof public.partners
 language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  select id into v from public.partners where user_id = auth.uid() and status = 'active';
  if v is null then raise exception 'forbidden'; end if;
  if p_type not in ('realtor', 'accountant', 'attorney', 'bookkeeping', 'property_management', 'referral', 'other') then raise exception 'invalid_type'; end if;
  update public.partners set partner_type = p_type, updated_at = now() where id = v;
  return query select * from public.partners where id = v;
end $$;
revoke all on function public.partner_set_type(text) from public, anon;
grant execute on function public.partner_set_type(text) to authenticated;

-- admin bell names the attorney
create or replace function public.bookings_notify() returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare ev text; who text; att text;
begin
  if coalesce(current_setting('endeavor.booking_silent', true), '0') = '1' then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then ev := 'created'; end if;
  elsif old.status = 'confirmed' and new.status = 'cancelled' then ev := 'cancelled';
  elsif new.status = 'confirmed' and new.starts_at is distinct from old.starts_at then ev := 'rescheduled';
  end if;
  if ev is null then return new; end if;
  if ev = 'cancelled' and new.cancelled_at is null then
    update public.bookings set cancelled_at = now(), cancelled_by = coalesce(new.cancelled_by, 'admin') where id = new.id;
  end if;
  if new.attorney_id is not null then select name into att from public.partners where id = new.attorney_id; end if;
  who := new.name || ' · ' || to_char(new.starts_at at time zone (select timezone from public.booking_settings where id = 1), 'DD/MM/YYYY HH24:MI') || ' ET';
  insert into public.admin_events(kind, title, body, link)
  values ('booking_' || case ev when 'created' then 'new' else ev end,
          case ev when 'created' then 'Novo agendamento' when 'cancelled' then 'Agendamento cancelado' else 'Agendamento remarcado' end || coalesce(' com o advogado ' || att, '') || ': ' || who,
          left(coalesce(new.topic, '') || case when new.cancel_reason is not null then ' · Motivo: ' || new.cancel_reason else '' end, 2000), '#/agenda');
  perform public.booking_call(ev, new.id);
  return new;
end $function$;
