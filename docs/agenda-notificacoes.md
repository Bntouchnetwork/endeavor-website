# Agenda: confirmations, reminders, reschedule and cancel

## Flow

1. **Booking** (`schedule.html`): the WhatsApp number is required. It has a country selector, and the number is formatted for the chosen country. It is saved in international format (`+5511912345678`) together with the visitor's time zone.
2. **Confirmation** (right after the booking): e-mail to the client and to the admin, with:
   - date and time in the client's time zone, plus Orlando time;
   - the format and topic;
   - **Add to Google Calendar**;
   - an .ics invitation for Outlook and Apple;
   - **Reschedule** and **Cancel**.

   A WhatsApp message goes out too, once the API is connected.
3. **Reminders**: by default 1 day, 12 hours and 2 hours before the call. They go to the client and to the admin, by e-mail and WhatsApp. The times are set in **Agenda → Disponibilidade → Confirmações e lembretes**, up to 6 reminders.
4. **Reschedule / cancel**: the link opens `booking.html?t=<private token>`. The client can:
   - pick a new free time (up to 3 reschedules);
   - cancel, with an optional reason.

   The client and the admin receive the notice, the slot is freed, and the bell shows the event. A cancellation made by the admin in the Agenda also notifies the client.
5. **Fallback**: if the number has no WhatsApp, or a WhatsApp message fails, the e-mail still goes out. The number is marked so later messages go by e-mail only. There is no SMS.

In the Agenda, each booking shows what was sent, for example "Confirmação: e-mail ✓, WhatsApp ✗ · Lembrete 1d: e-mail ✓".

## Parts

| Part | Where |
|---|---|
| Booking page | `schedule.html`, `schedule.js`, `phone-intl.js` (WhatsApp field with country selector) |
| Reschedule / cancel page | `booking.html`, `booking.js` (PT/EN/ES) |
| Admin | Agenda → Disponibilidade (reminders, notification e-mail and WhatsApp, test e-mail); Agenda list (what was sent) |
| Function | `supabase/functions/booking-notify` (Gmail SMTP port 465 + WhatsApp Cloud API) |
| Database | `booking_messages`, new columns in `bookings` / `booking_settings`, RPCs, `bookings_notify` trigger, `pg_cron` job `booking-reminders` (every 5 min) |

## To switch on

### E-mail (support Gmail)

In Supabase → **Edge Functions → Secrets**, add:

- `SMTP_PASS` = the **Google app password** of support@endeavorbiz.com (the same one used in Authentication → SMTP). Do not paste it in the chat.
- (optional) `SMTP_USER` if it is not support@endeavorbiz.com.

Then test it in Agenda → Disponibilidade → **Enviar e-mail de teste**. As soon as the secret exists:

- the booking page stops using the old FormSubmit confirmation;
- reminders start.

### WhatsApp (when the account exists)

1. Create the app in Meta for Developers, add WhatsApp, and register a dedicated number (Meta Cloud API).
2. Create and get approval for these templates (category **Utility**) in pt_BR, en_US and es:

   | Template | Variables |
   |---|---|
   | `endeavor_booking_confirmation` | {{1}} first name, {{2}} date/time, {{3}} reschedule/cancel link |
   | `endeavor_booking_reminder` | {{1}} first name, {{2}} "tomorrow / in 2 hours", {{3}} date/time, {{4}} link |
   | `endeavor_booking_cancelled` | {{1}} first name, {{2}} date/time, {{3}} link to book again |
   | `endeavor_booking_rescheduled` | {{1}} first name, {{2}} new date/time, {{3}} link |
   | `endeavor_booking_admin_alert` (pt_BR) | {{1}} event, {{2}} name, {{3}} date/time ET, {{4}} contact |

   Example (pt_BR, confirmation): "Olá, {{1}}! Sua conversa com a Endeavor Business Solutions está confirmada para {{2}}. Para reagendar ou cancelar: {{3}}"
3. In Supabase → Edge Functions → Secrets, add `WHATSAPP_TOKEN` (permanent System User token) and `WHATSAPP_PHONE_ID`. Optionally add `WA_TPL_*` if the names are different.

The Agenda shows **WhatsApp: Ativo** after the next call to the function (at most 5 minutes).

## Notes

- Reminders that were missed (for example, a reminder whose time had already passed when the call was booked) are not sent late.
- Each message is recorded once in `booking_messages`, so there are no duplicates even if the timer runs twice.
- The cancel/reschedule link uses a random token, does not show the e-mail or the phone, and works only until the start of the call.
