/* Endeavor portal DEMO MODE: replaces Supabase, Edge Functions and FormSubmit with an in-memory backend
   loaded with fictitious sample data. Nothing leaves the browser and nothing is saved. */
(function () {
  'use strict';
  var MODE = window.DEMO_MODE || 'admin'; // 'admin' | 'client' | 'partner'
  var PORTAL = MODE === 'client' || MODE === 'partner';
  var LIVE = 'https://endeavorbiz.com/';
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); })); }
  var now = new Date();
  function iso(daysFromNow, h, m) { var d = new Date(now); d.setDate(d.getDate() + daysFromNow); if (h != null) d.setHours(h, m || 0, 0, 0); return d.toISOString(); }
  function day(daysFromNow) { return iso(daysFromNow).slice(0, 10); }
  function ymd(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  var Y = now.getFullYear();

  /* ---------------- sample data ---------------- */
  var ADMIN = { id: 'demo-admin', email: 'support@endeavorbiz.com' };
  var CLIENT_USER = { id: 'demo-client-user', email: 'carlos.lima@example.com' };
  var PARTNER_USER = { id: 'u-cpa', email: 'ana.cpa@example.com' };
  var ME = MODE === 'partner' ? PARTNER_USER : CLIENT_USER;
  var ALLCATS = ['formation', 'tax_return', 'report', 'compliance', 'other'];
  var C1 = 'c1000000-0000-4000-8000-000000000001', C2 = 'c2000000-0000-4000-8000-000000000002', C3 = 'c3000000-0000-4000-8000-000000000003';
  var CO1 = 'a1000000-0000-4000-8000-000000000001', CO2 = 'a2000000-0000-4000-8000-000000000002', CO3 = 'a3000000-0000-4000-8000-000000000003', CO4 = 'a4000000-0000-4000-8000-000000000004';
  var L = function (id, name, email, phone, country, company, assistance, msg, source, status, d, lang) {
    return { id: id, created_at: iso(-d, 10), updated_at: iso(-d, 10), name: name, email: email, phone: phone, country: country, company: company, assistance: assistance, message: msg, source: source, status: status, marketing_consent: d % 2 === 0, notes: '', language: lang };
  };
  var DB = {
    leads: [
      L('b1000000-0000-4000-8000-000000000001', 'Carlos Lima', 'carlos.lima@example.com', '+55 11 98888-1234', 'Brazil', 'Lima Holdings', 'Start a U.S. Company', 'Quero abrir uma LLC na Flórida para receber de clientes americanos.', 'contact_form', 'client', 40, 'pt'),
      L('b2000000-0000-4000-8000-000000000002', 'Sofía Martínez', 'sofia@example.com', '+595 981 555 222', 'Paraguay', 'Martínez Export', 'Start Operations in Paraguay', 'Exportamos para EE. UU. y queremos una empresa en Florida.', 'booking', 'client', 30, 'es'),
      L('b3000000-0000-4000-8000-000000000003', 'Michael Turner', 'mturner@example.com', '+1 407 555 0199', 'United States', 'Sunshine Ventures', 'Tax Coordination', 'Need help with our 1120 and Florida corporate tax.', 'contact_form', 'client', 25, 'en'),
      L('b4000000-0000-4000-8000-000000000004', 'Juliana Rocha', 'juliana@example.com', '+55 21 97777-0000', 'Brazil', 'Rocha Design', 'Start a U.S. Company', 'Sou designer e quero faturar em dólar.', 'contact_form', 'new', 1, 'pt'),
      L('b5000000-0000-4000-8000-000000000005', 'Pedro Alves', 'pedro@example.com', '+55 31 96666-1111', 'Brazil', 'Alves Imóveis', 'Real Estate', 'Quero comprar imóveis em Orlando pela empresa.', 'booking', 'contacted', 3, 'pt'),
      L('b6000000-0000-4000-8000-000000000006', 'Laura Gómez', 'laura@example.com', '+595 971 333 444', 'Paraguay', 'Gómez Agro', 'Business Financing', '¿Pueden ayudar con financiamiento para maquinaria?', 'contact_form', 'qualified', 6, 'es'),
      L('b7000000-0000-4000-8000-000000000007', 'David Chen', 'dchen@example.com', '+1 321 555 0110', 'United States', 'Chen Logistics', 'Compliance', 'Annual report and registered agent change.', 'contact_form', 'proposal', 9, 'en'),
      L('b8000000-0000-4000-8000-000000000008', 'Renata Souza', 'renata@example.com', '+55 41 95555-2222', 'Brazil', '', 'Family Office', 'Planejamento patrimonial nos EUA.', 'manual', 'lost', 60, 'pt')
    ],
    booking_settings: [{ id: 1, timezone: 'America/New_York', slot_minutes: 30, buffer_minutes: 0, min_notice_hours: 12, max_days_ahead: 30, meeting_note: 'Enviaremos o link da videochamada por e-mail.' }],
    availability_rules: [[1, '09:00:00', '12:00:00'], [1, '14:00:00', '17:00:00'], [2, '09:00:00', '12:00:00'], [2, '14:00:00', '17:00:00'], [3, '09:00:00', '12:00:00'], [3, '14:00:00', '17:00:00'], [4, '09:00:00', '12:00:00'], [4, '14:00:00', '17:00:00'], [5, '09:00:00', '12:00:00']]
      .map(function (r, i) { return { id: i + 1, weekday: r[0], start_time: r[1], end_time: r[2] }; }),
    blackout_dates: [{ day: ymd(Y, 12, 25), reason: 'Christmas' }, { day: ymd(Y + 1, 1, 1), reason: "New Year's Day" }],
    bookings: [
      { id: uuid(), lead_id: 'b5000000-0000-4000-8000-000000000005', starts_at: iso(1, 10), ends_at: iso(1, 10, 30), name: 'Pedro Alves', email: 'pedro@example.com', phone: '+55 31 96666-1111', topic: 'Real Estate', notes: 'Prefiro falar em português.', meeting_type: 'video', status: 'confirmed', language: 'pt', created_at: iso(-3) },
      { id: uuid(), lead_id: 'b6000000-0000-4000-8000-000000000006', starts_at: iso(2, 14), ends_at: iso(2, 14, 30), name: 'Laura Gómez', email: 'laura@example.com', phone: '+595 971 333 444', topic: 'Business Financing', notes: '', meeting_type: 'whatsapp', status: 'confirmed', language: 'es', created_at: iso(-2) },
      { id: uuid(), lead_id: 'b7000000-0000-4000-8000-000000000007', starts_at: iso(4, 9, 30), ends_at: iso(4, 10), name: 'David Chen', email: 'dchen@example.com', phone: '+1 321 555 0110', topic: 'Compliance', notes: 'Registered agent change', meeting_type: 'phone', status: 'confirmed', language: 'en', created_at: iso(-1) },
      { id: uuid(), lead_id: 'b4000000-0000-4000-8000-000000000004', starts_at: iso(6, 15), ends_at: iso(6, 15, 30), name: 'Juliana Rocha', email: 'juliana@example.com', phone: '', topic: 'Business Formation', notes: '', meeting_type: 'video', status: 'confirmed', language: 'pt', created_at: iso(0) },
      { id: uuid(), lead_id: 'b1000000-0000-4000-8000-000000000001', starts_at: iso(-38, 11), ends_at: iso(-38, 11, 30), name: 'Carlos Lima', email: 'carlos.lima@example.com', phone: '', topic: 'Business Formation', notes: '', meeting_type: 'video', status: 'completed', language: 'pt', created_at: iso(-40) }
    ],
    envelopes: [], envelope_events: [],
    clients: [
      { id: C1, created_at: iso(-35), updated_at: iso(-35), name: 'Carlos Lima', primary_email: 'carlos.lima@example.com', phone: '+55 11 98888-1234', language: 'pt', lead_id: 'b1000000-0000-4000-8000-000000000001', status: 'active', notes: 'Cliente desde a formação da LLC.' },
      { id: C2, created_at: iso(-28), updated_at: iso(-28), name: 'Sofía Martínez', primary_email: 'sofia@example.com', phone: '+595 981 555 222', language: 'es', lead_id: 'b2000000-0000-4000-8000-000000000002', status: 'active', notes: '' },
      { id: C3, created_at: iso(-20), updated_at: iso(-20), name: 'Sunshine Ventures', primary_email: 'mturner@example.com', phone: '+1 407 555 0199', language: 'en', lead_id: 'b3000000-0000-4000-8000-000000000003', status: 'active', notes: '' }
    ],
    client_users: [
      { id: uuid(), client_id: C1, user_id: CLIENT_USER.id, email: 'carlos.lima@example.com', name: 'Carlos Lima', role: 'owner', collab_type: null, can_view: true, can_upload: true, status: 'active', invited_by: 'support@endeavorbiz.com', invited_at: iso(-35), accepted_at: iso(-34) },
      { id: uuid(), client_id: C1, user_id: 'u-cpa', email: 'ana.cpa@example.com', name: 'Ana Ribeiro, CPA', role: 'collaborator', collab_type: 'accountant', can_view: true, can_upload: true, perm_companies: null, perm_doc_categories: ALLCATS.slice(), perm_deadlines: true, status: 'active', invited_by: 'carlos.lima@example.com', invited_at: iso(-20), accepted_at: iso(-19) },
      { id: uuid(), client_id: C2, user_id: 'u-cpa', email: 'ana.cpa@example.com', name: 'Ana Ribeiro, CPA', role: 'collaborator', collab_type: 'accountant', can_view: true, can_upload: false, perm_companies: null, perm_doc_categories: ['tax_return', 'report'], perm_deadlines: false, status: 'active', invited_by: 'sofia@example.com', invited_at: iso(-12), accepted_at: iso(-11) },
      { id: uuid(), client_id: C1, user_id: null, email: 'books@example.com', name: 'João Bookkeeping', role: 'collaborator', collab_type: 'bookkeeping', can_view: true, can_upload: true, perm_companies: null, perm_doc_categories: ['report', 'other'], perm_deadlines: true, status: 'invited', invited_by: 'carlos.lima@example.com', invited_at: iso(-2), accepted_at: null },
      { id: uuid(), client_id: C2, user_id: 'u-sofia', email: 'sofia@example.com', name: 'Sofía Martínez', role: 'owner', collab_type: null, can_view: true, can_upload: true, status: 'active', invited_by: 'support@endeavorbiz.com', invited_at: iso(-28), accepted_at: iso(-27) },
      { id: uuid(), client_id: C3, user_id: null, email: 'mturner@example.com', name: 'Michael Turner', role: 'owner', collab_type: null, can_view: true, can_upload: true, status: 'invited', invited_by: 'support@endeavorbiz.com', invited_at: iso(-20), accepted_at: null }
    ],
    companies: [
      { id: CO1, client_id: C1, created_at: iso(-35), legal_name: 'Lima Holdings LLC', entity_type: 'llc_foreign', state: 'FL', formation_date: ymd(Y - 1, 3, 12), document_number: 'L' + String(Y - 1).slice(2) + '000123456', ein: '99-1234567', fiscal_year_end: '12-31', registered_agent: 'Endeavor Business Solutions', address: '111 N Orange Ave, Suite 800, Orlando, FL 32801', status: 'active', notes: '' },
      { id: CO2, client_id: C1, created_at: iso(-10), legal_name: 'Lima Real Estate LLC', entity_type: 'llc_multi', state: 'FL', formation_date: null, document_number: null, ein: null, fiscal_year_end: '12-31', registered_agent: 'Endeavor Business Solutions', address: '', status: 'in_formation', notes: 'Aguardando aprovação na Sunbiz.' },
      { id: CO3, client_id: C2, created_at: iso(-28), legal_name: 'Martínez Export LLC', entity_type: 'llc_foreign', state: 'FL', formation_date: ymd(Y, 2, 3), document_number: 'L' + String(Y).slice(2) + '000045678', ein: '98-7654321', fiscal_year_end: '12-31', registered_agent: 'Endeavor Business Solutions', address: '', status: 'active', notes: 'Opera com fábrica no Paraguai.' },
      { id: CO4, client_id: C3, created_at: iso(-20), legal_name: 'Sunshine Ventures Inc.', entity_type: 'c_corp', state: 'FL', formation_date: ymd(Y - 3, 6, 20), document_number: 'P' + String(Y - 3).slice(2) + '000077889', ein: '93-1112223', fiscal_year_end: '12-31', registered_agent: 'Endeavor Business Solutions', address: 'Orlando, FL', status: 'active', notes: '' }
    ],
    company_documents: [], compliance_items: [], financial_reports: [], doc_access_log: [], admins: [{ email: 'support@endeavorbiz.com' }]
  };
  var QBO = {}; QBO[CO1] = { connected: true, qbo_company_name: 'Lima Holdings LLC', connected_at: iso(-15), last_sync_at: iso(-5), last_error: null };

  /* ---- partner program, invoices, Stripe ---- */
  var P1 = 'e1000000-0000-4000-8000-000000000001', P2 = 'e2000000-0000-4000-8000-000000000002', P3 = 'e3000000-0000-4000-8000-000000000003';
  var PART = function (id, name, email, company, type, pct, status, uid, stripe, d) {
    return { id: id, created_at: iso(-d), updated_at: iso(-d), name: name, email: email, company: company, phone: null, language: 'pt', partner_type: type, default_share_pct: pct, status: status, user_id: uid,
      invited_at: iso(-d), accepted_at: status === 'active' ? iso(-d + 1) : null, stripe_account_id: stripe ? 'acct_1Demo' + id.slice(1, 8) : null, stripe_details_submitted: !!stripe, stripe_charges_enabled: !!stripe,
      stripe_payouts_enabled: !!stripe, stripe_transfers_active: !!stripe, notes: null };
  };
  DB.partners = [PART(P1, 'Ana Ribeiro', 'ana.cpa@example.com', 'Ribeiro Contabilidade', 'accountant', 15, 'active', 'u-cpa', true, 60),
    PART(P2, 'Marcos Tavares', 'marcos@example.com', 'Tavares Realty', 'realtor', 10, 'active', 'u-marcos', false, 40),
    PART(P3, 'Bruno Castro', 'bruno@example.com', 'Castro Law', 'attorney', 12, 'invited', null, false, 3)];
  DB.referrals = []; DB.referral_events = []; DB.referral_items = []; DB.invoices = [];
  var REF = function (pid, lead, client, name, email, company, service, status, d, steps, items) {
    var id = uuid(), l = DB.leads.find(function (x) { return x.id === lead; }) || {};
    DB.referrals.push({ id: id, created_at: iso(-d), updated_at: iso(-(steps.length ? steps[steps.length - 1][1] : d)), partner_id: pid, lead_id: lead, client_id: client, name: name, email: email, phone: l.phone || null, country: l.country || null,
      company: company, service: service, message: null, language: 'pt', consent: true, status: status });
    DB.referral_events.push({ id: DB.referral_events.length + 1, referral_id: id, at: iso(-d), kind: 'status', label: 'submitted', visible_to_partner: true, created_by: 'ana.cpa@example.com' });
    steps.forEach(function (s) { DB.referral_events.push({ id: DB.referral_events.length + 1, referral_id: id, at: iso(-s[1]), kind: s[2] || 'status', label: s[0], visible_to_partner: s[3] !== false, created_by: 'support@endeavorbiz.com' }); });
    (items || []).forEach(function (it) { DB.referral_items.push({ id: uuid(), referral_id: id, created_at: iso(-d), label: it[0], status: it[1], updated_at: iso(-d) }); });
    return id;
  };
  var R1 = REF(P1, 'b1000000-0000-4000-8000-000000000001', C1, 'Carlos Lima', 'carlos.lima@example.com', 'Lima Holdings', 'Start a U.S. Company', 'in_process', 42,
    [['contacted', 41], ['proposal', 39], ['onboarding', 36], ['received:Passaporte do sócio', 35, 'document'], ['approved:Comprovante de endereço', 35, 'document'], ['Articles of Organization protocolados na Sunbiz', 34, 'note'], ['in_process', 33], ['Pedido de EIN enviado ao IRS', 30, 'note'], ['Cliente pediu desconto no 2º ano', 29, 'note', false]],
    [['Passaporte do sócio', 'approved'], ['Comprovante de endereço', 'approved'], ['Formulário de cadastro (KYC)', 'approved'], ['Contrato de serviços assinado', 'approved'], ['Extratos para abertura de conta', 'received']]);
  REF(P1, 'b4000000-0000-4000-8000-000000000004', null, 'Juliana Rocha', 'juliana@example.com', 'Rocha Design', 'Start a U.S. Company', 'submitted', 1, []);
  REF(P1, 'b5000000-0000-4000-8000-000000000005', null, 'Pedro Alves', 'pedro@example.com', 'Alves Imóveis', 'Real Estate Structure', 'contacted', 3, [['contacted', 2], ['Reunião agendada por vídeo', 2, 'note']]);
  REF(P1, 'b6000000-0000-4000-8000-000000000006', null, 'Laura Gómez', 'laura@example.com', 'Gómez Agro', 'Business Financing', 'proposal', 6, [['contacted', 5], ['proposal', 4]], [['Demonstrativos financeiros', 'pending'], ['Passaporte do sócio', 'received']]);
  REF(P1, null, null, 'Fernanda Costa', 'fernanda@example.com', 'Costa Tech LLC', 'Registered Agent', 'completed', 80, [['contacted', 79], ['proposal', 78], ['onboarding', 76], ['in_process', 74], ['completed', 70]], [['Passaporte do sócio', 'approved'], ['Contrato de serviços assinado', 'approved']]);
  REF(P1, 'b8000000-0000-4000-8000-000000000008', null, 'Renata Souza', 'renata@example.com', '', 'Family Office', 'lost', 61, [['contacted', 60], ['lost', 55]]);
  var R7 = REF(P2, 'b3000000-0000-4000-8000-000000000003', C3, 'Michael Turner', 'mturner@example.com', 'Sunshine Ventures', 'Tax Services', 'onboarding', 22, [['contacted', 21], ['proposal', 21], ['onboarding', 20]], [['Form 1120 do ano anterior', 'received'], ['Contrato de serviços assinado', 'approved']]);
  REF(P2, 'b7000000-0000-4000-8000-000000000007', null, 'David Chen', 'dchen@example.com', 'Chen Logistics', 'Annual Report / Compliance', 'proposal', 9, [['contacted', 8], ['proposal', 7]]);
  var INV = function (client, ref, pid, pct, items, status, transfer, d, desc) {
    var tot = items.reduce(function (s, i) { return s + i[1] * 100; }, 0), n = DB.invoices.length + 1, id = uuid();
    DB.invoices.push({ id: id, created_at: iso(-d), updated_at: iso(-d), client_id: client, referral_id: ref, partner_id: pid, partner_pct: pid ? pct : null, partner_amount_cents: pid ? Math.round(tot * pct / 100) : 0,
      transfer_status: transfer, stripe_transfer_id: null, stripe_invoice_id: 'in_demo' + n, number: status === 'draft' ? null : 'EBS-' + Y + '-' + String(n).padStart(4, '0'), status: status, currency: 'usd',
      items: items.map(function (i) { return { description: i[0], amount_cents: i[1] * 100, quantity: 1 }; }), description: desc, total_cents: tot, amount_paid_cents: status === 'paid' ? tot : 0,
      due_date: day(-d + 7), customer_email: (DB.clients.find(function (c) { return c.id === client; }) || {}).primary_email, hosted_invoice_url: status === 'draft' ? null : 'https://invoice.stripe.com/i/demo_' + n,
      invoice_pdf: status === 'draft' ? null : 'https://pay.stripe.com/invoice/demo_' + n + '/pdf', sent_at: status === 'draft' ? null : iso(-d), paid_at: status === 'paid' ? iso(-d + 3) : null, created_by: 'support@endeavorbiz.com' });
  };
  INV(C1, R1, P1, 15, [['Abertura de LLC na Flórida (Lima Holdings LLC)', 1500]], 'paid', 'paid', 38, 'Formação da empresa');
  INV(C1, R1, P1, 15, [['Registered Agent - 12 meses', 300], ['Annual Report Sunbiz', 150]], 'open', 'scheduled', 6, 'Serviços anuais');
  INV(C2, null, null, null, [['Contabilidade mensal (outubro)', 450], ['Form 5472 + pro forma 1120', 450]], 'paid', 'none', 12, null);
  INV(C3, R7, P2, 10, [['Preparação Form 1120 + F-1120', 2000]], 'paid', 'pending', 15, 'Imposto corporativo');
  INV(C1, R1, P1, 15, [['Abertura de LLC (Lima Real Estate LLC)', 1500]], 'draft', 'scheduled', 1, 'Segunda empresa');
  DB.stripe_settings = [{ id: 1, account_id: 'acct_1EndeavorDemo', account_name: 'Endeavor Business Solutions', livemode: false, charges_enabled: true, payouts_enabled: true, connect_ready: true, webhook_configured: true,
    default_days_until_due: 7, default_partner_pct: 10, checked_at: iso(-1), last_error: null }];
  var PME = MODE === 'partner' ? DB.partners[0] : null;
  var DEMO_TOKEN = 'demo4f9c2a7b1e8d6c3f0a5b9e2d7c4f1a8b6e3d0c9f';
  window.DEMO_PROPOSAL_TOKEN = DEMO_TOKEN;
  var PROP_ITEMS = [{ description: 'Abertura da LLC na Flórida (Lima Real Estate LLC)', amount_cents: 120000, quantity: 1 }, { description: 'EIN no IRS', amount_cents: 25000, quantity: 1 }, { description: 'Registered Agent - 12 meses', amount_cents: 30000, quantity: 1 }];
  DB.proposals = [
    { id: 'f1000000-0000-4000-8000-000000000001', created_at: iso(-2), updated_at: iso(-2), client_id: C1, title: 'Pacote Abertura de LLC - Lima Real Estate', intro: 'Proposta para abrir a segunda empresa do Carlos na Flórida, já com EIN e Registered Agent, pronta para comprar imóveis em Orlando.',
      included: ['Registro da LLC na Sunbiz (Articles of Organization)', 'Operating Agreement para vários sócios', 'EIN emitido pelo IRS', 'Registered Agent na Flórida por 12 meses', 'Calendário de obrigações fiscais no portal'],
      items: PROP_ITEMS, total_cents: 175000, currency: 'usd', terms: 'Pagamento pelo portal do cliente (cartão, Pix ou transferência bancária). Taxas do governo incluídas. Os serviços começam após a confirmação do pagamento.', language: 'pt', days_until_due: 7,
      partner_id: P1, partner_pct: 15, referral_id: R1, status: 'sent', token: DEMO_TOKEN, valid_until: day(28), sent_at: iso(-2), viewed_at: null, accepted_at: null, accepted_name: null, invoice_id: null, created_by: ADMIN.email },
    { id: 'f2000000-0000-4000-8000-000000000002', created_at: iso(-21), updated_at: iso(-16), client_id: C3, title: 'Imposto corporativo 2025 (Form 1120 + F-1120)', intro: null, included: ['Form 1120 federal', 'Florida F-1120', 'Revisão contábil'], items: [{ description: 'Preparação Form 1120 + F-1120', amount_cents: 200000, quantity: 1 }],
      total_cents: 200000, currency: 'usd', terms: null, language: 'en', days_until_due: 7, partner_id: P2, partner_pct: 10, referral_id: R7, status: 'accepted', token: 'demo0accepted0000000000000000000000000000', valid_until: day(9), sent_at: iso(-21), viewed_at: iso(-20), accepted_at: iso(-17), accepted_name: 'Michael Turner',
      invoice_id: DB.invoices[3].id, created_by: ADMIN.email },
    { id: 'f3000000-0000-4000-8000-000000000003', created_at: iso(0), updated_at: iso(0), client_id: C2, title: 'Contabilidade mensal 2027', intro: null, included: ['Bookkeeping mensal', 'Relatórios trimestrais no portal'], items: [{ description: 'Contabilidade mensal (12 meses)', amount_cents: 45000, quantity: 12 }],
      total_cents: 540000, currency: 'usd', terms: null, language: 'es', days_until_due: 7, partner_id: null, partner_pct: null, referral_id: null, status: 'draft', token: null, valid_until: null, sent_at: null, viewed_at: null, accepted_at: null, accepted_name: null, invoice_id: null, created_by: ADMIN.email }
  ];
  DB.invoices[3].proposal_id = 'f2000000-0000-4000-8000-000000000002';
  var TPL = function (n, name, st, title, intro, inc, items, lang) { return { id: 'fa00000' + n + '-0000-4000-8000-00000000000' + n, created_at: iso(-60), updated_at: iso(-60), name: name, structure: st, language: lang || 'pt', title: title, intro: intro, included: inc,
    items: items.map(function (i) { return { description: i[0], amount_cents: i[1] == null ? null : i[1] * 100, quantity: i[2] || 1 }; }), terms: 'Pagamento pelo portal do cliente (cartão, Pix ou transferência bancária). Taxas do governo incluídas. Os serviços começam após a confirmação do pagamento.',
    days_until_due: 7, valid_days: 30, archived: false, created_by: ADMIN.email }; };
  DB.proposal_templates = [
    TPL(1, 'LLC Flórida - sócio estrangeiro', 'llc_foreign', 'Abertura de LLC na Flórida (sócio estrangeiro)', 'Abertura da sua empresa nos EUA, pronta para faturar em dólar e cumprir as obrigações do IRS para LLC de dono estrangeiro.',
      ['Registro da LLC na Sunbiz (Articles of Organization)', 'Operating Agreement', 'EIN emitido pelo IRS', 'Registered Agent na Flórida por 12 meses', 'Orientação para abertura de conta bancária', 'Calendário de obrigações (Form 5472 e Annual Report) no portal'],
      [['Abertura da LLC na Flórida (taxa estadual inclusa)', 1200], ['EIN no IRS', 250], ['Registered Agent - 12 meses', 300]]),
    TPL(2, 'LLC Flórida - vários sócios', 'llc_multi', 'Abertura de LLC com vários sócios na Flórida', 'Estrutura para sócios que vão operar juntos nos EUA, com acordo entre sócios e obrigações fiscais organizadas.',
      ['Registro da LLC na Sunbiz', 'Operating Agreement para vários sócios', 'EIN emitido pelo IRS', 'Registered Agent na Flórida por 12 meses', 'Calendário de obrigações (Form 1065 e K-1) no portal'],
      [['Abertura da LLC na Flórida (taxa estadual inclusa)', 1200], ['Operating Agreement multi-member', 450], ['EIN no IRS', 250], ['Registered Agent - 12 meses', 300]]),
    TPL(3, 'C-Corporation Flórida', 'c_corp', 'Abertura de C-Corporation na Flórida', 'Corporação para quem vai captar investidores ou reinvestir lucros nos EUA.',
      ['Registro da corporação na Sunbiz (Articles of Incorporation)', 'Bylaws e emissão de ações', 'EIN emitido pelo IRS', 'Registered Agent na Flórida por 12 meses', 'Calendário de obrigações (Form 1120 e F-1120) no portal'],
      [['Abertura da C-Corp na Flórida (taxa estadual inclusa)', 1500], ['Bylaws e ata de organização', 500], ['EIN no IRS', 250], ['Registered Agent - 12 meses', 300]]),
    TPL(4, 'Registered Agent + Annual Report', 'registered_agent', 'Manutenção anual da empresa na Flórida', 'Mantém a sua empresa ativa e em dia com o estado da Flórida.',
      ['Registered Agent na Flórida por 12 meses', 'Entrega do Annual Report na Sunbiz', 'Alertas de prazo no portal'], [['Registered Agent - 12 meses', 300], ['Annual Report Sunbiz (taxa estadual inclusa)', 250]]),
    TPL(5, 'Imposto anual - LLC estrangeira (5472)', 'tax', 'Declaração anual: Form 5472 + pro forma 1120', 'Entrega obrigatória para LLC de dono estrangeiro, evitando a multa do IRS.',
      ['Preparação do Form 5472 e pro forma 1120', 'Revisão das transações com o sócio', 'Envio ao IRS', 'Cópia da declaração no portal'], [['Form 5472 + pro forma 1120', 650]]),
    TPL(6, 'Contabilidade mensal', 'bookkeeping', 'Contabilidade mensal (bookkeeping)', 'Livros em dia todo mês, com relatórios trimestrais no portal.',
      ['Conciliação bancária mensal', 'Classificação das despesas', 'Relatórios P&L, balanço e fluxo de caixa no portal', 'Suporte por e-mail e WhatsApp'], [['Contabilidade mensal', 450, 12]]),
    TPL(7, 'Formação: Holding Wyoming + LLC Flórida (imóvel)', 'real_estate', 'Abertura de empresa para registro de imóvel nos EUA (Holding WY + LLC FL)',
      'Estrutura de proteção patrimonial imobiliária com duas empresas: uma Holding LLC em Wyoming e uma LLC na Flórida. A LLC da Flórida será de propriedade da Holding, para proteger e blindar os ativos e manter a confidencialidade do proprietário final nas informações públicas.',
      ['Abertura da Wyoming Holdings LLC', 'Abertura da Florida LLC', 'Contrato social (Operating Agreement) da Florida LLC', 'Contrato social (Operating Agreement) da Wyoming LLC', 'Solicitação do EIN ao IRS (Florida LLC)', 'Solicitação do EIN ao IRS (Wyoming LLC)',
        'Endereço comercial e correspondência (1 mês, Florida LLC)', 'Endereço comercial e correspondência (1 mês, Wyoming LLC)', 'Agente registrador por 1 ano (Wyoming LLC)', 'Agente registrador por 1 ano (Florida LLC)', 'Taxas de registro nos estados da Flórida e de Wyoming',
        'Abertura de conta bancária digital da empresa', 'Manutenção mensal: bookkeeping (registro de entradas e saídas), endereço comercial e correspondência das duas empresas e suporte na comunicação com o banco do financiamento do imóvel'],
      [['Pacote de abertura: Holding LLC Wyoming + LLC Flórida (taxas estaduais incluídas)', 3450], ['Manutenção mensal - 1º mês (bookkeeping, endereço comercial e correspondência das duas empresas)', 247]]),
    TPL(8, 'Manutenção anual: Holding Wyoming + LLC Flórida', 'registered_agent', 'Manutenção anual da estrutura Holding Wyoming + LLC Flórida', 'Renovações, agentes registradores e declarações anuais para manter a estrutura ativa e em dia.',
      ['Renovação do registro estadual na Flórida e em Wyoming', 'Agente registrador na Flórida e em Wyoming', 'Serviço de renovação anual das duas empresas', 'Declaração de renda da empresa', 'Declaração de renda pessoa física'],
      [['Taxa de renovação de registro - Estado da Flórida', 135], ['Taxa de renovação de registro - Estado de Wyoming', 50], ['Agente registrador - Florida LLC', 175], ['Agente registrador - Wyoming LLC', 175], ['Serviço de renovação anual do registro - Florida LLC', 100], ['Serviço de renovação anual do registro - Wyoming LLC', 100], ['Declaração de renda da empresa', 950], ['Declaração de renda pessoa física', 650]])
  ];
  DB.proposal_templates[6].terms = 'Manutenção mensal de US$ 247, cobrada até o dia 5 de cada mês após a conclusão da abertura.\nServiços anuais (cobrados à parte, no início de cada ano fiscal): renovação dos registros estaduais e agentes registradores das duas empresas, declaração de renda da empresa (US$ 950) e declaração de renda pessoa física (US$ 650 por sócio).\nDocumentos necessários: cópia do passaporte ou documento de identidade e 1 comprovante de endereço de todos os sócios, e 3 opções de nome para cada empresa (Holding e Florida LLC).\nPrazo estimado: 30 a 45 dias após a confirmação do pagamento. Não garantimos que a empresa esteja pronta antes do fechamento da compra do imóvel; se for preciso transferir o registro depois, pode haver custos adicionais.';

  DB.admin_events = [
    { id: 3, at: iso(0, 9, 12), kind: 'referral_new', title: 'Nova indicação: Juliana Rocha', body: 'Parceiro: Ana Ribeiro · Start a U.S. Company', link: '#/parceiros?id=' + P1, read_at: null },
    { id: 2, at: iso(-15), kind: 'payment_received', title: 'Pagamento recebido: US$ 2,000.00 · Sunshine Ventures', body: 'Fatura EBS-' + Y + '-0004 paga pelo portal (mturner@example.com).', link: '#/pagamentos?tab=faturas', read_at: iso(-14) },
    { id: 1, at: iso(-17), kind: 'proposal_accepted', title: 'Proposta aceita: Imposto corporativo 2025 · Sunshine Ventures', body: 'Michael Turner aceitou (US$ 2,000.00).', link: '#/pagamentos?tab=propostas', read_at: iso(-16) }
  ];
  // the single-file preview carries what happened in another demo (accept proposal -> pay in portal -> admin sees it)
  var FLOW_KEY = 'endeavor-demo-flow';
  function flowGet() { try { return JSON.parse(sessionStorage.getItem(FLOW_KEY) || '{}'); } catch (e) { return {}; } }
  function flowSet(o) { try { sessionStorage.setItem(FLOW_KEY, JSON.stringify(Object.assign(flowGet(), o))); } catch (e) { /* ignore */ } }
  function acceptProposal(pr, name, at) {
    pr.status = 'accepted'; pr.accepted_name = name; pr.accepted_at = at; pr.viewed_at = pr.viewed_at || at;
    if (!pr.invoice_id) {
      var n = DB.invoices.length + 1, tot = pr.total_cents, share = pr.partner_id ? Math.round(tot * pr.partner_pct / 100) : 0, pp = DB.partners.find(function (x) { return x.id === pr.partner_id; });
      var inv = { id: 'f9000000-0000-4000-8000-00000000000' + (DB.proposals.indexOf(pr) + 1), created_at: at, updated_at: at, client_id: pr.client_id, referral_id: pr.referral_id, partner_id: pr.partner_id, partner_pct: pr.partner_pct, partner_amount_cents: share,
        transfer_status: pr.partner_id ? (pp && pp.stripe_transfers_active ? 'scheduled' : 'pending') : 'none', stripe_transfer_id: null, stripe_invoice_id: 'in_demo_prop_' + pr.id.slice(0, 2), number: 'EBS-' + Y + '-' + String(n).padStart(4, '0'), status: 'open', currency: 'usd',
        items: pr.items, description: pr.title, total_cents: tot, amount_paid_cents: 0, due_date: day(pr.days_until_due), customer_email: (DB.clients.find(function (c) { return c.id === pr.client_id; }) || {}).primary_email,
        hosted_invoice_url: 'https://invoice.stripe.com/i/demo_p' + n, invoice_pdf: 'https://pay.stripe.com/invoice/demo_p' + n + '/pdf', sent_at: at, paid_at: null, created_by: 'proposal', proposal_id: pr.id };
      DB.invoices.unshift(inv); pr.invoice_id = inv.id;
      DB.admin_events.unshift({ id: 100, at: at, kind: 'proposal_accepted', title: 'Proposta aceita: ' + pr.title + ' · ' + (DB.clients.find(function (c) { return c.id === pr.client_id; }) || {}).name, body: name + ' aceitou (US$ ' + (tot / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '). Fatura ' + inv.number + ' criada e aguardando pagamento no portal.', link: '#/pagamentos?tab=propostas', read_at: null });
    }
    return DB.invoices.find(function (i) { return i.id === pr.invoice_id; });
  }
  function markPaid(inv, at, quiet) {
    if (inv.status === 'paid') return;
    Object.assign(inv, { status: 'paid', amount_paid_cents: inv.total_cents, paid_at: at });
    if (inv.transfer_status === 'scheduled') inv.transfer_status = 'paid';
    var cl = DB.clients.find(function (c) { return c.id === inv.client_id; }) || {};
    DB.admin_events.unshift({ id: 200 + DB.admin_events.length, at: at, kind: 'payment_received', title: 'Pagamento recebido: US$ ' + (inv.total_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' · ' + cl.name, body: 'Fatura ' + inv.number + ' paga pelo portal (' + cl.primary_email + ').', link: '#/pagamentos?tab=faturas', read_at: null });
    if (!quiet) { var f = flowGet(); f.paid = (f.paid || []).concat([inv.stripe_invoice_id]); flowSet({ paid: f.paid }); }
  }
  (function () {
    var f = flowGet();
    if (f.accepted) acceptProposal(DB.proposals[0], f.accepted.name, f.accepted.at);
    (f.paid || []).forEach(function (sid) { var inv = DB.invoices.find(function (i) { return i.stripe_invoice_id === sid; }); if (inv) markPaid(inv, f.paidAt || new Date().toISOString(), true); });
  })();
  function doc(company, client, cat, title, year, d, by) {
    var id = uuid();
    DB.company_documents.push({ id: id, company_id: company, client_id: client, created_at: iso(-d), category: cat, title: title, year: year, path: client + '/' + company + '/' + cat + '/' + id.slice(0, 8) + '-' + title.replace(/[^\w]+/g, '-') + '.pdf', mime: 'application/pdf', size_bytes: 48213, sha256: null, visible_to_client: true, uploaded_by: by === CLIENT_USER.email ? CLIENT_USER.id : by ? 'u-cpa' : null, uploaded_by_email: by || 'support@endeavorbiz.com', note: null });
    return id;
  }
  doc(CO1, C1, 'formation', 'Articles of Organization', Y - 1, 34); doc(CO1, C1, 'formation', 'Operating Agreement', Y - 1, 34); doc(CO1, C1, 'formation', 'EIN Confirmation Letter (CP 575)', Y - 1, 30);
  doc(CO1, C1, 'tax_return', 'Form 5472 + pro forma 1120', Y - 1, 12); doc(CO1, C1, 'compliance', 'Florida Annual Report', Y, 20);
  var rep = function (co, cl, t, q) { var id = doc(co, cl, 'report', t + ' - Q' + q + ' ' + Y, Y, 5); DB.company_documents[DB.company_documents.length - 1].uploaded_by_email = 'QuickBooks'; return id; };
  rep(CO1, C1, 'Profit and Loss', 3); rep(CO1, C1, 'Balance Sheet', 3); rep(CO1, C1, 'Statement of Cash Flows', 3);
  doc(CO1, C1, 'uploaded', 'Extratos bancários jan-set', Y, 4, 'carlos.lima@example.com'); doc(CO1, C1, 'uploaded', '1099-NEC recebidos', Y - 1, 8, 'ana.cpa@example.com');
  doc(CO3, C2, 'formation', 'Articles of Organization', Y, 26); doc(CO3, C2, 'formation', 'Operating Agreement', Y, 26); doc(CO3, C2, 'tax_return', 'Form 5472 + pro forma 1120 (' + (Y - 1) + ')', Y - 1, 15); doc(CO3, C2, 'report', 'Profit and Loss - Q2 ' + Y, Y, 9);
  doc(CO4, C3, 'formation', 'Articles of Incorporation', Y - 3, 19); doc(CO4, C3, 'tax_return', 'Form 1120', Y - 1, 15);
  var DL = function (co, cl, title, cat, due, st) { DB.compliance_items.push({ id: uuid(), company_id: co, client_id: cl, created_at: iso(-30), title: title, category: cat, due_date: due, status: st || 'pending', completed_at: st === 'done' ? iso(-60) : null, notes: null }); };
  DL(CO1, C1, 'Florida Annual Report (Sunbiz)', 'annual_report', ymd(Y, 5, 1), 'done');
  DL(CO1, C1, 'Form 5472 + pro forma 1120 (' + (Y - 1) + ')', 'federal_tax', ymd(Y, 4, 15), 'done');
  DL(CO1, C1, 'Forms 1099-NEC e 1099-MISC (pagamentos de ' + Y + ')', 'federal_tax', ymd(Y + 1, 2, 1));
  DL(CO1, C1, 'Form 5472 + pro forma 1120 (' + Y + ')', 'federal_tax', ymd(Y + 1, 4, 15));
  DL(CO1, C1, 'Florida Annual Report (Sunbiz)', 'annual_report', ymd(Y + 1, 5, 1));
  DL(CO2, C1, 'Obter EIN da nova LLC', 'other', day(10), 'in_progress');
  DL(CO3, C2, 'Forms 1099-NEC (pagos en ' + Y + ')', 'federal_tax', ymd(Y + 1, 2, 1));
  DL(CO3, C2, 'Form 5472 + pro forma 1120 (' + Y + ')', 'federal_tax', ymd(Y + 1, 4, 15));
  DL(CO4, C3, 'Estimated tax 4º trimestre ' + Y, 'federal_tax', ymd(Y + 1, 1, 15));
  DL(CO4, C3, 'Form 1120 (' + Y + ')', 'federal_tax', ymd(Y + 1, 4, 15));
  DL(CO4, C3, 'Florida Corporate Income Tax F-1120 (' + Y + ')', 'state_tax', ymd(Y + 1, 5, 1));
  DL(CO4, C3, 'Sales tax DR-15 (outubro)', 'sales_tax', day(-3));
  var ENV = function (title, name, email, status, d, fields) {
    var id = uuid();
    var e = { id: id, created_at: iso(-d), title: title, message: null, signer_name: name, signer_email: email, lead_id: null, document_path: 'originals/' + id + '.pdf', document_sha256: 'a3f1c9e7' + id.replace(/-/g, '').slice(0, 56), token: uuid(), token_expires_at: iso(30 - d), status: status, viewed_at: status !== 'sent' ? iso(-d + 1) : null, consent_at: null, signed_at: status === 'signed' ? iso(-d + 1) : null, signature_name: status === 'signed' ? name : null, signer_ip: status === 'signed' ? '201.17.45.88' : null, signer_user_agent: status === 'signed' ? 'Mozilla/5.0 (iPhone)' : null, signed_document_path: status === 'signed' ? 'signed/' + id + '.pdf' : null, signed_document_sha256: status === 'signed' ? '7be2d0f4' + id.replace(/-/g, '').slice(0, 56) : null, created_by: 'support@endeavorbiz.com', fields: fields || [], id_stamped: true };
    DB.envelopes.push(e);
    var ev = function (k, dd, ip) { DB.envelope_events.push({ id: DB.envelope_events.length + 1, envelope_id: id, event: k, at: iso(-dd), ip: ip || null, user_agent: ip ? 'Mozilla/5.0 (iPhone)' : null, details: {} }); };
    ev('created', d); ev('sent', d); ev('emailed', d);
    if (status !== 'sent') ev('viewed', d - 0.5, '201.17.45.88');
    if (status === 'signed') { ev('consented', d - 0.9, '201.17.45.88'); ev('signed', d - 1, '201.17.45.88'); ev('completed', d - 1, '201.17.45.88'); }
  };
  ENV('Engagement Letter - Formação de LLC', 'Carlos Lima', 'carlos.lima@example.com', 'signed', 34, [{ id: 's1', type: 'signature', page: 0, x: .55, y: .8, w: .3, h: .06, required: true }]);
  ENV('Operating Agreement - Lima Real Estate LLC', 'Carlos Lima', 'carlos.lima@example.com', 'viewed', 3);
  ENV('Contrato de Servicios Contables', 'Sofía Martínez', 'sofia@example.com', 'sent', 1);
  ENV('Registered Agent Change Form', 'David Chen', 'dchen@example.com', 'voided', 8);

  /* ---------------- query engine ---------------- */
  var DEF = {
    leads: { status: 'new', kind: 'lead', source: 'manual', marketing_consent: false }, envelopes: { status: 'sent', fields: [], id_stamped: false },
    client_users: { status: 'invited', can_view: false, can_upload: true }, compliance_items: { status: 'pending', category: 'other' },
    partners: { status: 'invited', partner_type: 'referral', default_share_pct: 10, language: 'pt', stripe_details_submitted: false, stripe_charges_enabled: false, stripe_payouts_enabled: false, stripe_transfers_active: false, stripe_account_id: null, user_id: null },
    referral_items: { status: 'pending' }, referral_events: { kind: 'note', visible_to_partner: true },
    proposal_templates: { archived: false, structure: 'other', language: 'pt', days_until_due: 7, valid_days: 30 },
    clients: { status: 'active', language: 'pt' }, companies: { status: 'in_formation', state: 'FL' }, company_documents: { visible_to_client: true }
  };
  function current() { return AUTH.user; }
  function prepare(table, row) {
    var r = Object.assign({}, DEF[table] || {}, row);
    if (!r.id && table !== 'blackout_dates' && table !== 'booking_settings') r.id = table === 'doc_access_log' || table === 'envelope_events' ? Date.now() + Math.random() : uuid();
    if (!r.created_at) r.created_at = new Date().toISOString();
    if (table === 'envelopes') { r.token = r.token || uuid(); r.created_by = current() ? current().email : null; }
    if (table === 'envelope_events') r.at = r.at || new Date().toISOString();
    if (table === 'referral_events' && !r.id) r.id = Date.now() + Math.random();
    if (table === 'doc_access_log') { r.at = new Date().toISOString(); r.user_id = current() && current().id; r.email = current() && current().email; }
    if (table === 'client_users' || table === 'partners') r.invited_at = r.invited_at || new Date().toISOString();
    if (table === 'referral_events') r.at = r.at || new Date().toISOString();
    if (/^(partners|referral_items|proposal_templates|proposals)$/.test(table)) r.updated_at = new Date().toISOString();
    if (table === 'company_documents') { r.uploaded_by = r.uploaded_by || (current() && current().id); r.uploaded_by_email = r.uploaded_by_email || (current() && current().email); }
    if (/^(company_documents|compliance_items|financial_reports)$/.test(table)) { var co = DB.companies.find(function (c) { return c.id === r.company_id; }); if (co) r.client_id = co.client_id; }
    if (table === 'envelopes' && !r.status) r.status = 'sent';
    return r;
  }
  function visible(table, rows) {
    if (!PORTAL) return rows;
    // emulate row-level security (with partner permissions) for the client and partner portals
    var mem = DB.client_users.filter(function (u) { return u.user_id === ME.id && u.status === 'active'; });
    var ids = mem.map(function (m) { return m.client_id; });
    var M = function (cid) { return mem.find(function (x) { return x.client_id === cid; }); };
    var role = function (cid) { var m = M(cid); return m && m.role; };
    var coOk = function (cid, co) { var m = M(cid); return !!m && (m.role === 'owner' || !m.perm_companies || m.perm_companies.indexOf(co) > -1); };
    var can = function (cid, what) { var m = M(cid); if (!m) return false; if (m.role === 'owner') return true;
      if (what === 'deadlines') return m.perm_deadlines !== false; if (what === 'upload') return !!m.can_upload;
      var c = m.perm_doc_categories || []; return what === 'view' ? c.length > 0 : c.indexOf(what) > -1; };
    switch (table) {
      case 'clients': return rows.filter(function (r) { return ids.indexOf(r.id) > -1; });
      case 'client_users': return rows.filter(function (r) { return r.user_id === ME.id || role(r.client_id) === 'owner'; });
      case 'companies': return rows.filter(function (r) { return coOk(r.client_id, r.id); });
      case 'compliance_items': return rows.filter(function (r) { return coOk(r.client_id, r.company_id) && can(r.client_id, 'deadlines'); });
      case 'company_documents': return rows.filter(function (r) { return coOk(r.client_id, r.company_id) && ((r.visible_to_client && can(r.client_id, r.category)) || r.uploaded_by === ME.id); });
      case 'financial_reports': return rows.filter(function (r) { return coOk(r.client_id, r.company_id) && can(r.client_id, 'report'); });
      case 'partners': return rows.filter(function (r) { return PME && r.id === PME.id; });
      case 'referrals': return rows.filter(function (r) { return PME && r.partner_id === PME.id; });
      case 'referral_items': case 'referral_events': return rows.filter(function (r) { var ref = DB.referrals.find(function (x) { return x.id === r.referral_id; }); return PME && ref && ref.partner_id === PME.id && (table === 'referral_items' || r.visible_to_partner); });
      case 'invoices': return rows.filter(function (r) { return r.status !== 'draft' && r.status !== 'void' && role(r.client_id) === 'owner'; });
      case 'proposals': return rows.filter(function (r) { return (r.status === 'sent' || r.status === 'accepted') && role(r.client_id) === 'owner'; });
      default: return oaVisible(table, rows, role, coOk) || [];
    }
  }
  function Q(table) { this.t = table; this.f = []; this.o = []; this.lim = null; this.op = 'select'; this.one = false; this.ret = false; this.opts = {}; }
  Q.prototype.select = function (cols, opts) { if (this.op === 'select') { this.opts = opts || {}; this.cols = cols || '*'; } else this.ret = true; return this; };
  Q.prototype.not = function (c, op, v) { this.f.push(['not', c, v]); return this; };
  Q.prototype.is = function (c, v) { this.f.push(['is', c, v]); return this; };
  Q.prototype.like = function (c, v) { this.f.push(['like', c, v]); return this; };
  Q.prototype.ilike = function (c, v) { this.f.push(['ilike', c, v]); return this; };
  Q.prototype.or = function (expr) { this.f.push(['or', null, expr]); return this; };
  ['eq', 'neq', 'gte', 'lte', 'gt', 'lt', 'in'].forEach(function (k) { Q.prototype[k] = function (c, v) { this.f.push([k, c, v]); return this; }; });
  Q.prototype.order = function (c, o) { this.o.push([c, !(o && o.ascending === false)]); return this; };
  Q.prototype.limit = function (n) { this.lim = n; return this; };
  Q.prototype.single = function () { this.one = true; return this; };
  Q.prototype.maybeSingle = function () { this.one = true; this.maybe = true; return this; };
  Q.prototype.insert = function (rows) { this.op = 'insert'; this.rows = rows; return this; };
  Q.prototype.upsert = function (rows) { this.op = 'upsert'; this.rows = rows; return this; };
  Q.prototype.update = function (v) { this.op = 'update'; this.vals = v; return this; };
  Q.prototype.delete = function () { this.op = 'delete'; return this; };
  function match(r, f) {
    var v = r[f[1]], x = f[2];
    switch (f[0]) {
      case 'eq': return String(v) === String(x); case 'neq': return String(v) !== String(x);
      case 'gte': return v != null && v >= x; case 'lte': return v != null && v <= x; case 'gt': return v != null && v > x; case 'lt': return v != null && v < x;
      case 'in': return x.map(String).indexOf(String(v)) > -1;
      case 'not': return x === null ? v != null : String(v) !== String(x);
      case 'is': return x === null ? v == null : v === x;
      case 'like': case 'ilike': var rx = new RegExp('^' + String(x).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', f[0] === 'ilike' ? 'i' : ''); return v != null && rx.test(String(v));
      case 'or': return orMatch(r, x);
    } return true;
  }
  function splitTop(e) { var out = [], d = 0, cur = ''; for (var i = 0; i < e.length; i++) { var ch = e[i]; if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
  function orMatch(r, expr, and) {
    var parts = splitTop(expr).map(function (p) {
      var m = p.match(/^(and|or)\((.*)\)$/); if (m) return orMatch(r, m[2], m[1] === 'and');
      var q = p.match(/^(\w+)\.(eq|neq|like|ilike|gte|lte)\.(.*)$/); if (!q) return false;
      return match(r, [q[2], q[1], q[3]]);
    });
    return and ? parts.every(Boolean) : parts.some(Boolean);
  }
  Q.prototype.run = function () {
    if (this.t === 'oa_rule_sets') seedRules();
    var self = this, tbl = DB[this.t] || (DB[this.t] = []);
    var filt = function (rows) { return rows.filter(function (r) { return self.f.every(function (f) { return match(r, f); }); }); };
    var out;
    if (this.op === 'select') {
      out = filt(visible(this.t, tbl)).slice();
      if (this.o.length) out.sort(function (a, b) { for (var i = 0; i < self.o.length; i++) { var c = self.o[i][0], A = a[c], B = b[c]; if (A === B) continue; if (A == null) return 1; if (B == null) return -1; return (A > B ? 1 : -1) * (self.o[i][1] ? 1 : -1); } return 0; });
      var count = out.length;
      if (this.lim != null) out = out.slice(0, this.lim);
      if (this.opts.head) return { data: null, count: count, error: null };
      out = JSON.parse(JSON.stringify(out));
      var joins = String(this.cols || '').match(/(\w+)(![\w]+)?\(([^)]*)\)/g) || [];
      joins.forEach(function (j) {
        var t = j.split('(')[0].split('!')[0], key = t === 'companies' ? 'company_id' : t.replace(/s$/, '') + '_id';
        out.forEach(function (r) { var x = (DB[t] || []).find(function (y) { return y.id === r[key]; }); r[t] = x ? JSON.parse(JSON.stringify(x)) : null; });
      });
      if (this.one) return out.length ? { data: out[0], error: null } : (this.maybe ? { data: null, error: null } : { data: null, error: { message: 'Row not found' } });
      return { data: out, error: null, count: count };
    }
    if (this.op === 'insert' || this.op === 'upsert') {
      var rows = (Array.isArray(this.rows) ? this.rows : [this.rows]).map(function (r) { return prepare(self.t, r); });
      if (this.t === 'client_users') {
        for (var i = 0; i < rows.length; i++) if (tbl.some(function (u) { return u.client_id === rows[i].client_id && u.email.toLowerCase() === rows[i].email.toLowerCase() && u.status !== 'revoked'; })) return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
      }
      rows.forEach(function (r) {
        var key = self.t === 'blackout_dates' ? 'day' : self.t === 'company_documents' && self.op === 'upsert' ? 'path' : 'id';
        var ix = tbl.findIndex(function (x) { return x[key] === r[key]; });
        if (ix > -1 && self.op === 'upsert') tbl[ix] = Object.assign(tbl[ix], r); else tbl.push(r);
      });
      out = JSON.parse(JSON.stringify(rows));
      return { data: this.ret ? (this.one ? out[0] : out) : null, error: null };
    }
    if (this.op === 'update') {
      var staged = [];
      filt(tbl).forEach(function (r) {
        var before = r.status, beforeStage = r.stage;
        Object.assign(r, self.vals, { updated_at: new Date().toISOString() });
        if (self.t === 'companies' && self.vals.stage && self.vals.stage !== beforeStage) staged.push([r, beforeStage]);
        if (self.t === 'compliance_settings') { auditPush({ action: 'compliance.settings', entity_type: 'settings', entity_id: '1', details: { capture_ip: r.capture_ip, capture_user_agent: r.capture_user_agent } }); r.updated_by = current() && current().email; oaSave(); }
        var by = current() ? current().email : 'system';
        if (self.t === 'referrals' && r.status !== before) DB.referral_events.push({ id: Date.now() + Math.random(), referral_id: r.id, at: new Date().toISOString(), kind: 'status', label: r.status, visible_to_partner: true, created_by: by });
        if (self.t === 'referral_items' && r.status !== before && r.status !== 'pending') DB.referral_events.push({ id: Date.now() + Math.random(), referral_id: r.referral_id, at: new Date().toISOString(), kind: 'document', label: r.status + ':' + r.label, visible_to_partner: true, created_by: by });
        if (self.t === 'leads' && r.status !== before) {
          var ord = ['submitted', 'contacted', 'proposal', 'onboarding', 'in_process', 'completed'], nv = { contacted: 'contacted', qualified: 'contacted', proposal: 'proposal', client: 'onboarding', lost: 'lost' }[r.status];
          if (nv) DB.referrals.filter(function (x) { return x.lead_id === r.id && x.status !== nv && x.status !== 'completed' && (nv === 'lost' || x.status === 'lost' || ord.indexOf(nv) > ord.indexOf(x.status)); })
            .forEach(function (x) { new Q('referrals').update({ status: nv }).eq('id', x.id).run(); });
        }
      });
      staged.forEach(function (x) { stageChanged(x[0], x[1]); });
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      var del = filt(tbl);
      DB[this.t] = tbl.filter(function (r) { return del.indexOf(r) < 0; });
      if (this.t === 'envelopes') DB.envelope_events = DB.envelope_events.filter(function (e) { return !del.some(function (d) { return d.id === e.envelope_id; }); });
      if (this.t === 'companies') ['company_documents', 'compliance_items', 'financial_reports'].forEach(function (t) { DB[t] = DB[t].filter(function (r) { return !del.some(function (d) { return d.id === r.company_id; }); }); });
      return { data: null, error: null };
    }
  };
  Q.prototype.then = function (res, rej) { var self = this; return new Promise(function (r) { setTimeout(function () { r(self.run()); }, 40); }).then(res, rej); };

  /* ---------------- auth ---------------- */
  var AUTH = { user: null, aal: null, listeners: [] };
  var SKEY = 'endeavor-demo-auth-' + MODE;
  try { var saved = JSON.parse(sessionStorage.getItem(SKEY) || 'null'); if (saved) { AUTH.user = saved.u === 'admin' ? ADMIN : ME; AUTH.aal = saved.aal; } } catch (e) { /* ignore */ }
  if (window.DEMO_AUTOLOGIN) { AUTH.user = MODE === 'admin' ? ADMIN : ME; AUTH.aal = 'aal2'; }
  function persist() { try { if (AUTH.user) sessionStorage.setItem(SKEY, JSON.stringify({ u: AUTH.user === ADMIN ? 'admin' : 'client', aal: AUTH.aal })); else sessionStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }
  function session() { return AUTH.user ? { access_token: 'demo', user: { id: AUTH.user.id, email: AUTH.user.email, last_sign_in_at: new Date().toISOString(), factors: [{ id: 'f1', factor_type: 'totp', status: 'verified' }] } } : null; }
  var ok = function (d) { return Promise.resolve({ data: d, error: null }); };
  var auth = {
    getSession: function () { return ok({ session: session() }); },
    getUser: function () { return ok({ user: session() && session().user }); },
    onAuthStateChange: function (cb) { AUTH.listeners.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; },
    signInWithPassword: function (o) {
      var email = String(o.email || '').trim().toLowerCase();
      if (MODE === 'admin' && email !== ADMIN.email) return Promise.resolve({ data: {}, error: { message: 'Demo: use support@endeavorbiz.com' } });
      if (PORTAL && email !== ME.email) return Promise.resolve({ data: {}, error: { message: 'Demo: use ' + ME.email } });
      AUTH.user = MODE === 'admin' ? ADMIN : ME; AUTH.aal = 'aal1'; persist();
      return ok({ session: session() });
    },
    signUp: function () { return Promise.resolve({ data: {}, error: { message: 'Demo: use the sample login shown at the bottom of the screen.' } }); },
    resetPasswordForEmail: function () { return ok({}); },
    updateUser: function () { return ok({ user: session() && session().user }); },
    signOut: function () { AUTH.user = null; AUTH.aal = null; persist();
      if (window.ENDEAVOR_COMBINED) { try { sessionStorage.removeItem('endeavor-combined-open'); } catch (e) { /* ignore */ } location.reload(); return new Promise(function () {}); } AUTH.listeners.forEach(function (cb) { try { cb('SIGNED_OUT'); } catch (e) { /* ignore */ } }); return ok({}); },
    mfa: {
      getAuthenticatorAssuranceLevel: function () { return ok({ currentLevel: AUTH.aal, nextLevel: 'aal2' }); },
      listFactors: function () { return ok({ totp: [{ id: 'f1', status: 'verified', factor_type: 'totp' }], all: [{ id: 'f1', status: 'verified' }] }); },
      challengeAndVerify: function (o) { if (String(o.code) === '123456') { AUTH.aal = 'aal2'; persist(); return ok({}); } return Promise.resolve({ data: null, error: { message: 'Invalid TOTP code entered' } }); },
      enroll: function () { return ok({ id: 'f1', totp: { qr_code: '', secret: 'DEMO' } }); }, unenroll: function () { return ok({}); }
    }
  };

  /* ---------------- storage (sample PDFs generated on demand) ---------------- */
  var FILES = {};
  async function samplePdf(path) {
    var L2 = window.PDFLib; if (!L2) return new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' });
    var d = await L2.PDFDocument.create(), f = await d.embedFont(L2.StandardFonts.Helvetica), b = await d.embedFont(L2.StandardFonts.HelveticaBold);
    var docRow = DB.company_documents.find(function (x) { return x.path === path; }) || DB.envelopes.find(function (x) { return x.document_path === path || x.signed_document_path === path; }) || {};
    var title = docRow.title || 'Sample document', p = d.addPage([612, 792]), navy = L2.rgb(0.04, 0.12, 0.23), grey = L2.rgb(0.45, 0.47, 0.52);
    p.drawRectangle({ x: 0, y: 786, width: 612, height: 6, color: navy });
    p.drawText('Endeavor Envelope ID: ' + (docRow.id || uuid()).toUpperCase(), { x: 18, y: 778, size: 7, font: f, color: grey });
    p.drawText(EPdfSafe(title), { x: 56, y: 700, size: 22, font: b, color: navy });
    p.drawText('SAMPLE DOCUMENT - DEMO MODE', { x: 56, y: 672, size: 11, font: b, color: L2.rgb(0.75, 0.55, 0.2) });
    var lines = ['This is a fictitious document generated for the Endeavor portal demonstration.', 'It contains no real client information.', '', 'Endeavor Business Solutions', '111 North Orange Avenue, Suite 800, Orlando, FL 32801', 'support@endeavorbiz.com  |  +1 (407) 436-9567'];
    lines.forEach(function (t, i) { p.drawText(t, { x: 56, y: 630 - i * 18, size: 11, font: f, color: L2.rgb(0.15, 0.15, 0.18) }); });
    for (var i = 0; i < 14; i++) p.drawRectangle({ x: 56, y: 470 - i * 22, width: 500 - (i % 3) * 60, height: 7, color: L2.rgb(0.9, 0.91, 0.93) });
    if (/signed\//.test(path)) { p.drawText('Electronically signed by ' + EPdfSafe(docRow.signer_name || ''), { x: 330, y: 80, size: 9, font: b, color: navy }); p.drawLine({ start: { x: 330, y: 95 }, end: { x: 556, y: 95 }, thickness: .8, color: navy }); }
    return new Blob([await d.save()], { type: 'application/pdf' });
  }
  function EPdfSafe(s) { return String(s || '').normalize('NFC').replace(/[^\x20-\x7E -ÿ]/g, ''); }
  var storage = { from: function () {
    return {
      upload: function (path, blob) { FILES[path] = blob; return ok({ path: path }); },
      createSignedUrl: async function (path) { if (!FILES[path]) FILES[path] = GEN[path] ? await bytesOf(path) : await samplePdf(path); return { data: { signedUrl: URL.createObjectURL(FILES[path]) }, error: null }; },
      download: async function (path) { if (!FILES[path]) FILES[path] = GEN[path] ? await bytesOf(path) : await samplePdf(path); return { data: FILES[path], error: null }; },
      remove: function (paths) { (paths || []).forEach(function (p) { delete FILES[p]; }); return ok([]); }
    };
  } };

  /* ---------------- rpc ---------------- */
  function rpc(name, args) {
    args = args || {};
    var ox = oaRpc(name, args); if (ox) return Promise.resolve({ data: ox.v, error: null });
    var r = null;
    if (name === 'is_admin' || name === 'is_admin_email') r = MODE === 'admin' && AUTH.user === ADMIN && (name === 'is_admin_email' || AUTH.aal === 'aal2');
    else if (name === 'claim_invitations') r = DB.client_users.filter(function (u) { return u.user_id === ME.id && u.status === 'active'; }).map(function (u) { var c = DB.clients.find(function (x) { return x.id === u.client_id; }); return { client_id: u.client_id, client_name: c.name, role: u.role, status: u.status }; });
    else if (name === 'qbo_status') { var s = QBO[args.p_company]; r = [s ? Object.assign({ connected: true }, s) : { connected: false }]; }
    else if (name === 'claim_partner' || name === 'my_partner_id') r = PME && AUTH.user === ME ? (name === 'claim_partner' ? [JSON.parse(JSON.stringify(PME))] : PME.id) : (name === 'claim_partner' ? [] : null);
    else if (name === 'partner_commissions') r = !PME ? [] : DB.invoices.filter(function (i) { return i.partner_id === PME.id && i.status !== 'draft'; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).map(function (i) {
      var ref = DB.referrals.find(function (x) { return x.id === i.referral_id; }), c = DB.clients.find(function (x) { return x.id === i.client_id; });
      return { invoice_id: i.id, number: i.number, created_at: i.created_at, client_label: ref ? ref.name : c.name, currency: i.currency, total_cents: i.total_cents, partner_pct: i.partner_pct, partner_amount_cents: i.partner_amount_cents, status: i.status, paid_at: i.paid_at, transfer_status: i.transfer_status };
    });
    else if (name === 'submit_referral') {
      var a = args.p || {};
      if (!PME) return Promise.resolve({ data: null, error: { message: 'forbidden' } });
      if (!a.consent) return Promise.resolve({ data: null, error: { message: 'consent_required' } });
      var lead = new Q('leads').insert({ name: a.name, email: a.email, phone: a.phone, country: a.country, company: a.company, assistance: a.service, message: a.message, language: a.language, source: 'partner', status: 'new', notes: 'Indicado pelo parceiro ' + PME.name + ' (' + PME.company + ')' }).select('id').single().run().data;
      var ref = new Q('referrals').insert({ partner_id: PME.id, lead_id: lead.id, client_id: null, name: a.name, email: a.email, phone: a.phone || null, country: a.country || null, company: a.company || null, service: a.service || null, message: a.message || null, language: a.language || 'pt', consent: true, status: 'submitted', updated_at: new Date().toISOString() }).select('id').single().run().data;
      DB.referral_events.push({ id: Date.now() + Math.random(), referral_id: ref.id, at: new Date().toISOString(), kind: 'status', label: 'submitted', visible_to_partner: true, created_by: PME.email });
      toast('Demo: indicação criada e lead adicionado ao CRM da Endeavor.');
      r = ref.id;
    }
    else if (name === 'my_client_role') { var mm = DB.client_users.find(function (u) { return u.user_id === ME.id && u.client_id === args.p_client && u.status === 'active'; }); r = MODE === 'admin' ? 'owner' : mm ? mm.role : null; }
    return Promise.resolve({ data: r, error: null });
  }

  /* ================= DEMO: timeline + Operating Agreement + e-signature chain + audit ================= */
  // Same flow as the `oa` edge function, run in the browser with the shared rules (oa-rules.js) and renderer (oa-render.js).
  // The "AI" is simulated in the demo. State is kept in sessionStorage so the client, admin and signing demos share it.
  var OAK = 'endeavor-demo-oa', GEN = {}, LISTEN = [], SIGS = {};
  var RS_ID = { WY: 'd0000000-0000-4000-8000-0000000000a1', FL: 'd0000000-0000-4000-8000-0000000000a2', DE: 'd0000000-0000-4000-8000-0000000000a3', TX: 'd0000000-0000-4000-8000-0000000000a4' };
  var OA1 = 'f9000000-0000-4000-8000-000000000001', OA2 = 'f9000000-0000-4000-8000-000000000002', OA3 = 'f9000000-0000-4000-8000-000000000003';
  DB.company_timeline = []; DB.operating_agreements = []; DB.oa_versions = []; DB.oa_comments = []; DB.audit_log = []; DB.oa_rule_sets = [];
  DB.compliance_settings = [{ id: 1, capture_ip: true, capture_user_agent: true, updated_at: iso(-30), updated_by: ADMIN.email }];
  DB.admins[0].legal_reviewer = true;
  var demoIp = function () { return MODE === 'admin' ? '72.185.14.9' : '189.40.12.77'; };
  function notify(table, ev, row, old) {
    LISTEN.forEach(function (l) {
      if (l.table !== table || (l.event !== '*' && l.event !== ev)) return;
      var m = l.filter && l.filter.match(/^(\w+)=eq\.(.+)$/); if (m && String(row[m[1]]) !== m[2]) return;
      setTimeout(function () { try { l.cb({ eventType: ev, new: JSON.parse(JSON.stringify(row)), old: old || {}, table: table }); } catch (e) { console.error(e); } }, 30);
    });
  }
  function rtChannel() { var ch = { on: function (type, o, cb) { LISTEN.push({ table: o.table, event: o.event || '*', filter: o.filter, cb: cb, ch: ch }); return ch; }, subscribe: function () { return ch; } }; return ch; }
  function rtRemove(ch) { LISTEN = LISTEN.filter(function (l) { return l.ch !== ch; }); return Promise.resolve(); }
  function fnv(s) { var h1 = 0x811c9dc5, h2 = 0x01000193; for (var i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0; h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519) >>> 0; } var x = ('0000000' + h1.toString(16)).slice(-8) + ('0000000' + h2.toString(16)).slice(-8); return x + x.split('').reverse().join('') + x + x.split('').reverse().join(''); }
  function rowHash(r, prev) { return fnv((prev || '') + '|' + r.id + '|' + r.at + '|' + (r.actor_email || '') + '|' + (r.actor_role || '') + '|' + r.action + '|' + (r.entity_id || '') + '|' + (r.ip || '') + '|' + JSON.stringify(r.details || {})); }
  function auditPush(o) {
    var last = DB.audit_log[DB.audit_log.length - 1];
    var r = Object.assign({ id: (last ? last.id : 0) + 1, at: new Date().toISOString(), actor_id: current() ? current().id : null, actor_email: current() ? current().email : 'system', actor_role: !current() ? 'system' : MODE === 'admin' ? 'admin' : 'client_owner',
      entity_type: null, entity_id: null, client_id: null, company_id: null, ip: DB.compliance_settings[0].capture_ip ? demoIp() : null, user_agent: DB.compliance_settings[0].capture_user_agent ? 'Mozilla/5.0 (demo browser)' : null, details: {} }, o);
    r.prev_hash = last ? last.hash : null; r.hash = rowHash(r, r.prev_hash);
    DB.audit_log.push(r); return r;
  }
  function tlPush(co, stage, sub, at, actor, note) {
    var r = { id: DB.company_timeline.length + 1, company_id: co.id, client_id: co.client_id, at: at || new Date().toISOString(), stage: stage, substatus: sub || null, note: note || null, visible_to_client: true, actor_email: actor || 'system', actor_role: !actor || actor === 'system' ? 'system' : MODE === 'admin' ? 'admin' : 'user' };
    DB.company_timeline.push(r); notify('company_timeline', 'INSERT', r); return r;
  }
  function oaSet(oa, patch, actor) {
    var before = oa.status, old = JSON.parse(JSON.stringify(oa));
    Object.assign(oa, patch, { updated_at: new Date().toISOString() });
    if (patch.status && patch.status !== before) { oa.status_actor = actor || 'system'; var co = DB.companies.find(function (c) { return c.id === oa.company_id; }); tlPush(co, 'operating_agreement', oa.status, null, actor, oa.status === 'in_review' && oa.review_required ? 'review_required' : null); }
    notify('operating_agreements', 'UPDATE', oa, old); oaSave(); return oa;
  }
  function stageChanged(co, before) {
    co.stage_at = new Date().toISOString();
    tlPush(co, co.stage, null, null, current() ? current().email : 'system');
    auditPush({ action: 'timeline.stage', entity_type: 'company', entity_id: co.id, client_id: co.client_id, company_id: co.id, details: { from: before, to: co.stage } });
    notify('companies', 'UPDATE', co);
    if (co.stage === 'approved') { var b = co.stage; co.stage = 'operating_agreement'; stageChanged(co, b); return; }
    if (co.stage === 'operating_agreement' && !DB.operating_agreements.some(function (o) { return o.company_id === co.id && o.status !== 'cancelled'; })) {
      var oa = { id: uuid(), company_id: co.id, client_id: co.client_id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status: 'pending_generation', status_actor: 'system', state: co.state, answers: {}, prefill: {}, prefill_sources: {}, issues: [], review_required: false, review_note: null, rule_set_id: null, rules_version: null, version: 0, current_version_id: null, consents: [], signers: [] };
      DB.operating_agreements.push(oa); tlPush(co, 'operating_agreement', 'pending_generation'); notify('operating_agreements', 'INSERT', oa);
    }
    oaSave();
  }

  /* ---- seed: three companies at different stages ---- */
  (function seedOA() {
    var co1 = DB.companies.find(function (c) { return c.id === CO1; }), co2 = DB.companies.find(function (c) { return c.id === CO2; }), co3 = DB.companies.find(function (c) { return c.id === CO3; }), co4 = DB.companies.find(function (c) { return c.id === CO4; });
    Object.assign(co2, { formation_date: day(-8), document_number: 'L' + String(Y).slice(2) + '000987654', address: '7345 W Sand Lake Rd, Suite 210, Orlando, FL 32819', status: 'active', notes: 'Aprovada pela Sunbiz.' });
    doc(CO2, C1, 'formation', 'Articles of Organization', Y, 6);
    var env0 = DB.envelopes.find(function (e) { return /Operating Agreement - Lima Real Estate/.test(e.title); }); if (env0) env0.title = 'Engagement Letter - Lima Real Estate LLC';
    var walk = function (co, upto, d0, oaStatus, oaId) {
      var st = ['onboarding', 'documents', 'filing_prep', 'filed', 'approved', 'operating_agreement'];
      for (var i = 0; i <= st.indexOf(upto); i++) tlPush(co, st[i], null, iso(-d0 + Math.min(i, 4), 10 + i), i ? ADMIN.email : 'system');
      co.stage = upto; co.stage_at = iso(-d0 + 4);
      if (upto !== 'operating_agreement') return;
      var subs = ['pending_generation', 'questionnaire', 'drafting', 'in_review', 'client_review', 'approved', 'signing', 'signed', 'archived'];
      subs.slice(0, subs.indexOf(oaStatus) + 1).forEach(function (s, j) { tlPush(co, 'operating_agreement', s, iso(-d0 + 4 + (j ? Math.ceil(j / 3) : 0), 16 + j), s === 'pending_generation' || s === 'drafting' ? 'system' : 'carlos.lima@example.com'); });
      DB.operating_agreements.push({ id: oaId, company_id: co.id, client_id: co.client_id, created_at: iso(-d0 + 4), updated_at: iso(-d0 + 6), status: oaStatus, status_actor: 'system', state: co.state, answers: {}, prefill: {}, prefill_sources: {}, issues: [], review_required: false, review_note: null,
        rule_set_id: oaStatus === 'archived' ? RS_ID.FL : null, rules_version: oaStatus === 'archived' ? '2026.11-1' : null, version: oaStatus === 'archived' ? 1 : 0, current_version_id: null, consents: [], signers: [], archived_at: oaStatus === 'archived' ? iso(-d0 + 6) : null });
    };
    DB.company_timeline = [];
    walk(co1, 'operating_agreement', 40, 'archived', OA1);
    walk(co3, 'operating_agreement', 28, 'archived', OA3);
    walk(co2, 'operating_agreement', 12, 'pending_generation', OA2);
    walk(co4, 'approved', 22);
    LISTEN = [];
    var A = function (d, who, role, action, co, det, ip) { auditPush({ at: iso(-d), actor_email: who, actor_role: role, action: action, entity_type: /^oa\./.test(action) ? 'operating_agreement' : 'company', entity_id: co.id, client_id: co.client_id, company_id: co.id, ip: ip || null, details: det || {} }); };
    A(36, ADMIN.email, 'admin', 'timeline.stage', co1, { from: 'filed', to: 'approved' }, '72.185.14.9');
    A(35, 'carlos.lima@example.com', 'client_owner', 'oa.consent', co1, { consent: 'ai_drafting_and_data_use', version: '2026-11-05' }, '189.40.12.77');
    A(34, 'carlos.lima@example.com', 'client_owner', 'oa.approve', co1, { final_pdf_sha256: 'demo', signers: 1 }, '189.40.12.77');
    A(34, 'system', 'system', 'oa.archived', co1, { final_sha256: 'demo' });
    A(6, ADMIN.email, 'admin', 'timeline.stage', co2, { from: 'filed', to: 'approved' }, '72.185.14.9');
    A(2, 'carlos.lima@example.com', 'client_owner', 'portal.access', co2, {}, '189.40.12.77');
    A(1, 'carlos.lima@example.com', 'client_owner', 'doc.view', co1, { title: 'Articles of Organization', category: 'formation' }, '189.40.12.77');
  })();
  function oaSave() {
    try {
      var envs = DB.envelopes.filter(function (e) { return e.oa_id; });
      sessionStorage.setItem(OAK, JSON.stringify({ co: DB.companies.map(function (c) { return { id: c.id, stage: c.stage, stage_at: c.stage_at }; }), oa: DB.operating_agreements, v: DB.oa_versions, c: DB.oa_comments, tl: DB.company_timeline, a: DB.audit_log,
        e: envs, ev: DB.envelope_events.filter(function (x) { return envs.some(function (e) { return e.id === x.envelope_id; }); }), docs: DB.company_documents.filter(function (d) { return d.oa_doc; }),
        ae: DB.admin_events.filter(function (x) { return /^oa_/.test(x.kind); }), sig: SIGS, cs: DB.compliance_settings, rs: DB.oa_rule_sets.map(function (r) { return { id: r.id, status: r.status, approved_by: r.approved_by, approved_at: r.approved_at }; }), adm: DB.admins }));
    } catch (e) { /* storage full or blocked */ }
  }
  (function oaLoad() {
    var s = null; try { s = JSON.parse(sessionStorage.getItem(OAK) || 'null'); } catch (e) { /* ignore */ }
    if (!s) return;
    (s.co || []).forEach(function (x) { var c = DB.companies.find(function (y) { return y.id === x.id; }); if (c) { c.stage = x.stage; c.stage_at = x.stage_at; } });
    DB.operating_agreements = s.oa || []; DB.oa_versions = s.v || []; DB.oa_comments = s.c || []; DB.company_timeline = s.tl || []; DB.audit_log = s.a || [];
    DB.envelopes = DB.envelopes.concat(s.e || []); DB.envelope_events = DB.envelope_events.concat(s.ev || []); DB.company_documents = DB.company_documents.concat(s.docs || []);
    DB.admin_events = (s.ae || []).concat(DB.admin_events); SIGS = s.sig || {}; DB.compliance_settings = s.cs || DB.compliance_settings; DB.admins = s.adm || DB.admins; window.__DEMO_RS = s.rs || [];
    (s.docs || []).forEach(function (d) { GEN[d.path] = d.oa_doc === 'evidence' ? function () { return evidenceBytes(d.oa_id); } : function () { return signedBytes(DB.envelopes.find(function (e) { return e.id === d.env_id; })); }; });
  })();
  function seedRules() {
    if (DB.oa_rule_sets.length || !window.EOARules) return;
    Object.keys(RS_ID).forEach(function (st) {
      var c = EOARules.buildRuleSet(st);
      var r = { id: RS_ID[st], state: st, version: c.version, status: 'approved', content: c, content_sha256: fnv(JSON.stringify(c)), created_at: iso(-20), approved_at: iso(-19), approved_by: 'support@endeavorbiz.com', approval_note: 'Demo: conjunto aprovado para demonstração. Em produção, um advogado habilitado aprova.' };
      var saved = (window.__DEMO_RS || []).find(function (x) { return x.id === r.id; }); if (saved) Object.assign(r, saved);
      DB.oa_rule_sets.push(r);
    });
  }
  function ruleSet(state) {
    seedRules();
    var r = DB.oa_rule_sets.find(function (x) { return x.state === state && x.status === 'approved'; });
    if (r) return { rs: r.content, id: r.id, approved: true, version: r.version };
    var b = window.EOARules && EOARules.buildRuleSet(state); return b ? { rs: b, id: null, approved: false, version: b.version } : null;
  }
  function genericRules() { var rs = EOARules.buildRuleSet('FL'); rs.state = 'other'; rs.state_name = ''; rs.questions.forEach(function (q) { q.note = null; }); return { rs: rs, id: null, approved: false, version: rs.version }; }

  /* ---- PDFs ---- */
  async function bytesOf(path) { var b = FILES[path] || (GEN[path] ? await GEN[path]() : null); if (b && !(b instanceof Blob)) b = new Blob([b], { type: 'application/pdf' }); if (b) FILES[path] = b; return b; }
  async function versionBytes(v) {
    var p = 'oa/' + v.oa_id + '/v' + v.version + (v.final ? '-final' : '') + '.pdf';
    if (!FILES[p]) { var r = await EOARender.render(PDFLib, v.content, v.final ? { footerLeft: 'Final v' + v.version, footerRight: 'OA ' + v.oa_id.slice(0, 8), fixedDate: v.created_at } : { watermark: 'DRAFT FOR REVIEW', footerLeft: 'Draft v' + v.version + ' - not for signature', footerRight: 'Rules ' + v.rules_version, fixedDate: v.created_at }); FILES[p] = new Blob([r.bytes], { type: 'application/pdf' }); }
    return FILES[p];
  }
  async function docBytes(env) {
    if (env.signer_index > 0) { var prev = DB.envelopes.find(function (e) { return e.oa_id === env.oa_id && e.signer_index === env.signer_index - 1; }); return signedBytes(prev); }
    var v = DB.oa_versions.find(function (x) { return x.oa_id === env.oa_id && x.final; }); return versionBytes(v);
  }
  async function signedBytes(env) {
    var base = new Uint8Array(await (await docBytes(env)).arrayBuffer()), s = SIGS[env.id];
    if (!s) return new Blob([base], { type: 'application/pdf' });
    var P = window.PDFLib, pdf = await P.PDFDocument.load(base), f = await pdf.embedFont(P.StandardFonts.Helvetica), b = await pdf.embedFont(P.StandardFonts.HelveticaBold);
    var img = s.png ? await pdf.embedPng(Uint8Array.from(atob(s.png.split(',')[1]), function (c) { return c.charCodeAt(0); })) : null, pages = pdf.getPages(), ink = P.rgb(0.04, 0.12, 0.27);
    (env.fields || []).forEach(function (fl) {
      var p = pages[fl.page], W = p.getWidth(), H = p.getHeight(), x = fl.x * W, w = fl.w * W, h = fl.h * H, y = H - fl.y * H - h;
      if (fl.type === 'signature') { if (img) { var sc = img.scaleToFit(w - 4, h - 10); p.drawImage(img, { x: x + 2, y: y + 8, width: sc.width, height: sc.height }); } else p.drawText(pdfSafe(s.typed), { x: x + 2, y: y + 12, size: 14, font: b, color: ink }); p.drawText(pdfSafe('Signed electronically by ' + s.typed + ' | Envelope ' + env.id.slice(0, 8)), { x: x + 2, y: y + 1, size: 5.5, font: f, color: P.rgb(0.35, 0.35, 0.4) }); }
      if (fl.type === 'date') p.drawText(s.date, { x: x + 2, y: y + 3, size: 10, font: f, color: ink });
    });
    if (env.signer_index === 0) pages.forEach(function (p) { p.drawText('Endeavor Envelope ID: ' + env.id.toUpperCase(), { x: 18, y: p.getHeight() - 14, size: 6.5, font: f, color: P.rgb(0.45, 0.47, 0.52) }); });
    var c = pdf.addPage([612, 792]), y = 740, line = function (t, sz, fo) { c.drawText(pdfSafe(t), { x: 40, y: y, size: sz || 9, font: fo || f, color: P.rgb(0.12, 0.12, 0.15) }); y -= (sz || 9) + 6; };
    line('Certificate of Completion (demo)', 17, b); y -= 6;
    [['Envelope ID', env.id], ['Document', env.title], ['Signer', env.signer_name + ' <' + env.signer_email + '>'], ['Typed signature name', s.typed], ['Signed at', s.at.replace('T', ' ').slice(0, 19) + ' UTC'], ['Signer IP address', '189.40.12.77 (demo)'], ['Original document SHA-256', env.document_sha256]].forEach(function (r) { line(r[0], 8.5, b); line('   ' + r[1], 9); });
    line('Fictitious demonstration record. In production the Endeavor e-signature module records the real IP, device and SHA-256 fingerprints.', 7.5);
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }
  async function evidenceBytes(oaId) {
    var oa = DB.operating_agreements.find(function (o) { return o.id === oaId; }), P = window.PDFLib, pdf = await P.PDFDocument.create(), f = await pdf.embedFont(P.StandardFonts.Helvetica), b = await pdf.embedFont(P.StandardFonts.HelveticaBold);
    var pg = pdf.addPage([612, 792]), y = 740, line = function (t, sz, fo) { if (y < 50) { pg = pdf.addPage([612, 792]); y = 740; } pg.drawText(pdfSafe(t).slice(0, 120), { x: 48, y: y, size: sz || 8.5, font: fo || f }); y -= (sz || 8.5) + 5; };
    line('Operating Agreement - Signature and Compliance Evidence (demo)', 14, b); line('OA ' + oa.id + ' · rules ' + oa.rules_version + ' · final v' + oa.version); y -= 6;
    line('Versions', 11, b); DB.oa_versions.filter(function (v) { return v.oa_id === oa.id; }).forEach(function (v) { line('v' + v.version + (v.final ? ' final' : '') + ' · ' + v.source + ' · ' + (v.ai_model || '-') + ' · rules ' + v.rules_version); });
    line('Consents', 11, b); (oa.consents || []).forEach(function (c) { line(c.type + ' v' + c.version + ' · ' + c.by + ' · ' + c.at); });
    line('Signatures', 11, b); DB.envelopes.filter(function (e) { return e.oa_id === oa.id; }).forEach(function (e) { line(e.signer_name + ' <' + e.signer_email + '> · ' + (e.signed_at || '') + ' · envelope ' + e.id); });
    line('Audit trail', 11, b); DB.audit_log.filter(function (a) { return a.company_id === oa.company_id; }).forEach(function (a) { line(a.at.replace('T', ' ').slice(0, 19) + ' · ' + a.action + ' · ' + (a.actor_email || '') + (a.ip ? ' · IP ' + a.ip : '') + ' · ' + a.hash.slice(0, 12)); });
    return new Blob([await pdf.save()], { type: 'application/pdf' });
  }

  /* ---- e-signature chain + archive ---- */
  function demoSignUrl(token, lang) { return 'sign.html?t=' + token + '&ret=client&lang=' + (lang || 'pt'); }
  async function createEnvelope(oa, i, fields) {
    var s = oa.signers[i], co = DB.companies.find(function (c) { return c.id === oa.company_id; });
    var env = prepare('envelopes', { title: 'Operating Agreement - ' + co.legal_name, signer_name: s.name, signer_email: s.email, message: 'Operating Agreement approved in the Endeavor client portal. Signer ' + (i + 1) + ' of ' + oa.signers.length + '.',
      document_path: i === 0 ? 'oa/' + oa.id + '/v' + oa.version + '-final.pdf' : 'signed/' + DB.envelopes.find(function (e) { return e.oa_id === oa.id && e.signer_index === i - 1; }).id + '.pdf',
      document_sha256: fnv(oa.id + i), fields: fields.filter(function (f) { return f.signer === i; }).map(function (f) { var o = Object.assign({}, f); delete o.signer; return o; }), oa_id: oa.id, signer_index: i, id_stamped: i > 0, status: 'sent' });
    env.created_by = 'oa-module'; DB.envelopes.push(env);
    ['created', 'sent'].forEach(function (k) { DB.envelope_events.push({ id: Date.now() + Math.random(), envelope_id: env.id, event: k, at: new Date().toISOString(), ip: null, user_agent: null, details: { oa_id: oa.id, signer_index: i } }); });
    auditPush({ action: 'esign.created', actor_email: s.email, actor_role: 'system', entity_type: 'envelope', entity_id: env.id, client_id: oa.client_id, company_id: oa.company_id, ip: null, details: { oa_id: oa.id, signer_index: i } });
    oa.signers[i] = Object.assign({}, s, { envelope_id: env.id, status: 'sent', sent_at: new Date().toISOString() });
    return env;
  }
  function mailSigner(oa, s, env) {
    var co = DB.companies.find(function (c) { return c.id === oa.company_id; });
    mailPreview({ email: s.email, _subject: 'Assinatura do Operating Agreement: ' + co.legal_name, _autoresponse: 'Olá ' + s.name + ',\n\nO Operating Agreement de ' + co.legal_name + ' foi aprovado e aguarda a sua assinatura eletrônica.\n\nAssinar: https://endeavorbiz.com/sign.html?t=' + env.token + '\n\nO link é pessoal. Endeavor Business Solutions' });
    DB.envelope_events.push({ id: Date.now() + Math.random(), envelope_id: env.id, event: 'emailed', at: new Date().toISOString(), ip: null, user_agent: null, details: { to: s.email } });
  }
  async function advance(oa) {
    if (oa.status !== 'signing') return oa;
    var envs = DB.envelopes.filter(function (e) { return e.oa_id === oa.id; }).sort(function (a, b) { return a.signer_index - b.signer_index; }), last = null;
    envs.forEach(function (e) { var s = oa.signers[e.signer_index]; if (e.status === 'signed') { last = e; if (s.status !== 'signed') oa.signers[e.signer_index] = Object.assign({}, s, { status: 'signed', signed_at: e.signed_at }); } });
    var next = oa.signers.findIndex(function (s) { return s.status !== 'signed'; });
    if (next >= 0) {
      if (!oa.signers[next].envelope_id && last) {
        var fin = DB.oa_versions.find(function (v) { return v.oa_id === oa.id && v.final; });
        var env = await createEnvelope(oa, next, fin.fields);
        auditPush({ action: 'oa.signature_requested', actor_email: 'system', actor_role: 'system', entity_type: 'operating_agreement', entity_id: oa.id, client_id: oa.client_id, company_id: oa.company_id, ip: null, details: { signer_index: next, envelope_id: env.id } });
        mailSigner(oa, oa.signers[next], env);
      }
      oaSet(oa, { signers: oa.signers }); return oa;
    }
    oaSet(oa, { status: 'signed', signed_at: new Date().toISOString(), signers: oa.signers });
    auditPush({ action: 'oa.signed', actor_email: 'system', actor_role: 'system', entity_type: 'operating_agreement', entity_id: oa.id, client_id: oa.client_id, company_id: oa.company_id, ip: null, details: { envelopes: envs.map(function (e) { return e.id; }) } });
    var co = DB.companies.find(function (c) { return c.id === oa.company_id; }), dd = new Date().toISOString().slice(0, 10), base = oa.client_id + '/' + oa.company_id + '/formation/';
    var p1 = base + 'Operating-Agreement-signed-' + dd + '-' + oa.id.slice(0, 8) + '.pdf', p2 = base + 'Operating-Agreement-evidence-' + dd + '-' + oa.id.slice(0, 8) + '.pdf';
    var d1 = prepare('company_documents', { company_id: oa.company_id, category: 'formation', title: 'Operating Agreement (signed)', year: Y, path: p1, mime: 'application/pdf', size_bytes: 61234, sha256: fnv(p1), visible_to_client: true, uploaded_by: null, uploaded_by_email: 'Endeavor e-signature', note: 'Signed by ' + envs.map(function (e) { return e.signer_name; }).join(', ') });
    var d2 = prepare('company_documents', { company_id: oa.company_id, category: 'compliance', title: 'Operating Agreement - signature evidence', year: Y, path: p2, mime: 'application/pdf', size_bytes: 18200, sha256: fnv(p2), visible_to_client: false, uploaded_by: null, uploaded_by_email: 'Endeavor compliance' });
    d1.uploaded_by = null; d2.uploaded_by = null; d1.oa_doc = 'signed'; d1.env_id = last.id; d2.oa_doc = 'evidence'; d2.oa_id = oa.id; DB.company_documents.push(d1, d2);
    GEN[p1] = function () { return signedBytes(last); }; GEN[p2] = function () { return evidenceBytes(oa.id); };
    oaSet(oa, { status: 'archived', archived_at: new Date().toISOString(), final_document_id: d1.id, evidence_document_id: d2.id, final_sha256: d1.sha256 });
    auditPush({ action: 'oa.archived', actor_email: 'system', actor_role: 'system', entity_type: 'operating_agreement', entity_id: oa.id, client_id: oa.client_id, company_id: oa.company_id, ip: null, details: { document_id: d1.id, evidence_document_id: d2.id } });
    DB.admin_events.unshift({ id: Date.now(), at: new Date().toISOString(), kind: 'oa_archived', title: 'Operating Agreement assinado e arquivado: ' + co.legal_name, body: 'PDF final e evidências na pasta da empresa.', link: '#/clientes?id=' + oa.client_id + '&tab=documentos', read_at: null });
    oaSave(); toast('Demo: todos assinaram. PDF final e evidências arquivados na pasta da empresa.');
    return oa;
  }

  /* ---- the `oa` function ---- */
  async function oaFn(pb) {
    var err = function (code, status, detail) { var e = new Error(code); e.status = status || 400; e.detail = detail; throw e; };
    var A = String(pb.action || '');
    seedRules();
    if (A === 'envelope_signed') { var e0 = DB.envelopes.find(function (e) { return e.token === pb.token; }); if (!e0 || !e0.oa_id || e0.status !== 'signed') return { ok: true }; var o0 = await advance(DB.operating_agreements.find(function (o) { return o.id === e0.oa_id; })); return { ok: true, status: o0.status }; }
    if (A === 'rules_seed') return { ok: true, inserted: 0 };
    var oa = DB.operating_agreements.find(function (o) { return o.id === pb.oa_id; }); if (!oa) err('not_found', 404);
    var isAdmin = MODE === 'admin', me = current() ? current().email : '', role = isAdmin ? 'admin' : 'client_owner';
    if (!isAdmin) { var m = DB.client_users.find(function (u) { return u.user_id === ME.id && u.client_id === oa.client_id && u.status === 'active'; }); if (!m || m.role !== 'owner') err('forbidden', 403); }
    if (/^admin_/.test(A) && !isAdmin) err('forbidden', 403);
    var co = DB.companies.find(function (c) { return c.id === oa.company_id; }), cl = DB.clients.find(function (c) { return c.id === oa.client_id; });
    var log = function (action, det) { auditPush({ action: action, actor_role: role, entity_type: 'operating_agreement', entity_id: oa.id, client_id: oa.client_id, company_id: oa.company_id, details: Object.assign({}, det || {}, { oa_version: oa.version, rules_version: oa.rules_version }) }); oaSave(); };
    var need = function (c, code) { if (!c) err(code || 'invalid_state', 409); };
    var bell = function (kind, title, body) { DB.admin_events.unshift({ id: Date.now() + Math.random(), at: new Date().toISOString(), kind: kind, title: title, body: body, link: '#/compliance?tab=oa&id=' + oa.id, read_at: null }); };
    switch (A) {
      case 'get':
        if (oa.status === 'signing') await advance(oa);
        var st = oa.answers.state || oa.state || co.state, ri = (st && ruleSet(st)) || genericRules();
        return { oa: Object.assign({}, JSON.parse(JSON.stringify(oa)), { signers: (oa.signers || []).map(function (s) { return { name: s.name, capacity: s.capacity, status: s.status, signed_at: s.signed_at || null, me: s.email === me, email: isAdmin || s.email === me ? s.email : undefined }; }) }),
          company: JSON.parse(JSON.stringify(co)), client: { name: cl.name, language: cl.language }, rules: Object.assign({}, ri.rs, { clauses: isAdmin ? ri.rs.clauses : undefined, approved: ri.approved, rule_set_id: ri.id }),
          versions: DB.oa_versions.filter(function (v) { return v.oa_id === oa.id; }).sort(function (a, b) { return b.version - a.version || (b.final ? 1 : -1); }).map(function (v) { return JSON.parse(JSON.stringify(v)); }),
          comments: DB.oa_comments.filter(function (c) { return c.oa_id === oa.id; }), ai_configured: true, email_configured: false, reviewer: isAdmin };
      case 'pdf':
        var v = DB.oa_versions.find(function (x) { return x.oa_id === oa.id && x.version === (+pb.version || oa.version) && !!x.final === !!pb.final; }) || DB.oa_versions.find(function (x) { return x.oa_id === oa.id && x.version === oa.version; });
        if (!v) err('not_found', 404);
        log('oa.pdf_view', { version: v.version, final: v.final });
        return { url: URL.createObjectURL(await versionBytes(v)) };
      case 'start':
        need(!isAdmin, 'owner_only'); need(oa.status === 'pending_generation' || oa.status === 'questionnaire');
        if (pb.consent !== true) err('consent_required');
        if (oa.status === 'questionnaire') return { ok: true };
        var art = DB.company_documents.find(function (d) { return d.company_id === co.id && d.category === 'formation' && /Articles/.test(d.title); });
        var pf = { legal_name: co.legal_name, state: co.state, filing_number: co.document_number, formation_date: co.formation_date, principal_address: co.address, registered_agent: co.registered_agent, management: art ? 'manager' : undefined, fiscal_year: co.fiscal_year_end === '12-31' ? '12-31' : 'other' };
        Object.keys(pf).forEach(function (k) { if (pf[k] == null || pf[k] === '') delete pf[k]; });
        var src = {}; Object.keys(pf).forEach(function (k) { src[k] = art && k !== 'fiscal_year' ? 'articles' : 'company_record'; });
        src._articles_document = art ? art.id : null; src._articles_ai = art ? { provider: 'demo', model: 'simulated (demo)' } : null;
        var consent = { type: 'ai_drafting_and_data_use', version: '2026-11-05', at: new Date().toISOString(), by: me, ip: demoIp() };
        await new Promise(function (r) { setTimeout(r, 900); });
        oaSet(oa, { status: 'questionnaire', prefill: pf, prefill_sources: src, answers: JSON.parse(JSON.stringify(pf)), consents: oa.consents.concat([consent]) }, me);
        log('oa.consent', { consent: consent.type, version: consent.version }); log('oa.start', { prefilled: Object.keys(pf), sources: 'company_record+articles' });
        return { ok: true };
      case 'save':
        need(oa.status === 'questionnaire');
        oa.answers = Object.assign({}, oa.answers, JSON.parse(JSON.stringify(pb.answers || {}))); oa.updated_at = new Date().toISOString();
        log('oa.answer', { fields: Object.keys(pb.answers || {}).slice(0, 30) });
        var r1 = ruleSet(oa.answers.state) || genericRules();
        return { ok: true, saved_at: new Date().toISOString(), evaluation: EOARules.evaluate(r1.rs, oa.answers, oa.prefill) };
      case 'submit':
        need(oa.status === 'questionnaire');
        var r2 = ruleSet(oa.answers.state), ev = EOARules.evaluate(r2 ? r2.rs : genericRules().rs, oa.answers, oa.prefill);
        if (ev.missing.length || ev.errors.length) err('incomplete', 422, ev);
        var c2 = { type: 'questionnaire_submitted', version: '2026-11-05', at: new Date().toISOString(), by: me, ip: demoIp() };
        log('oa.submit', { review_reasons: ev.review.map(function (x) { return x.code; }) });
        if (!r2) { oaSet(oa, { status: 'in_review', issues: ev.review.map(function (x) { return Object.assign({}, x, { resolved: false }); }), review_required: true, consents: oa.consents.concat([c2]) }, me); bell('oa_review', 'Revisão habilitada necessária: ' + co.legal_name, 'Estado sem regras aprovadas.'); return { ok: true, status: 'in_review' }; }
        oaSet(oa, { status: 'drafting', consents: oa.consents.concat([c2]) }, me);
        setTimeout(function () { draft(oa, ev.review, null); }, 2200);
        return { ok: true, status: 'drafting' };
      case 'comment':
        need(oa.status === 'client_review');
        DB.oa_comments.push({ id: DB.oa_comments.length + 1, oa_id: oa.id, version: oa.version, at: new Date().toISOString(), author_email: me, author_role: 'client_owner', section: pb.section || null, body: String(pb.body || '').slice(0, 2000), resolved_at: null, resolved_by: null, resolution: null });
        log('oa.comment', { section: pb.section || null });
        if (pb.request_changes) { oaSet(oa, { status: 'in_review' }, me); log('oa.changes_requested', {}); bell('oa_review', 'Cliente pediu correções: ' + co.legal_name, String(pb.body || '').slice(0, 200)); }
        oaSave(); return { ok: true };
      case 'approve':
        need(oa.status === 'client_review');
        if (pb.consent !== true || String(pb.typed_name || '').trim().length < 3) err('consent_required');
        var cur = DB.oa_versions.find(function (x) { return x.id === oa.current_version_id; });
        var fin = Object.assign({}, JSON.parse(JSON.stringify(cur)), { id: uuid(), final: true, created_at: new Date().toISOString(), created_by: me, note: 'Approved by client' });
        var rr = await EOARender.render(PDFLib, fin.content, { footerLeft: 'Final v' + fin.version, footerRight: 'OA ' + oa.id.slice(0, 8), fixedDate: fin.created_at });
        FILES['oa/' + oa.id + '/v' + fin.version + '-final.pdf'] = new Blob([rr.bytes], { type: 'application/pdf' });
        var signers = EOARules.signers(oa.answers).map(function (s) { return Object.assign({}, s, { status: 'pending' }); }), mine = signers.findIndex(function (s) { return s.email === me; });
        if (mine > 0) signers = [signers[mine]].concat(signers.filter(function (x, i) { return i !== mine; }));
        var order = EOARules.signers(oa.answers).map(function (s) { return s.email; });
        fin.fields = rr.fields.map(function (f) { return Object.assign({}, f, { signer: signers.findIndex(function (s) { return s.email === order[f.signer]; }) }); });
        fin.pdf_sha256 = fnv('final' + oa.id + fin.version); DB.oa_versions.push(fin);
        var c3 = { type: 'final_version_approved', version: '2026-11-05', at: new Date().toISOString(), by: me, ip: demoIp(), typed_name: pb.typed_name, oa_version: oa.version, pdf_sha256: cur.pdf_sha256 };
        oa.signers = signers;
        oaSet(oa, { status: 'approved', approved_at: new Date().toISOString(), approved_by_email: me, consents: oa.consents.concat([c3]), signers: signers }, me);
        log('oa.approve', { typed_name: pb.typed_name, signers: signers.length });
        var env = await createEnvelope(oa, 0, fin.fields);
        oaSet(oa, { status: 'signing', signers: oa.signers });
        log('oa.signature_requested', { signer_index: 0, envelope_id: env.id });
        bell('oa_client', 'Operating Agreement aprovado pelo cliente: ' + co.legal_name, 'Assinaturas em andamento (' + signers.length + ' signatário(s)).');
        if (signers[0].email === me) return { ok: true, sign_url: demoSignUrl(env.token, cl.language) };
        mailSigner(oa, signers[0], env); return { ok: true };
      case 'sign_link':
        need(oa.status === 'signing'); await advance(oa);
        var ni = oa.signers.findIndex(function (s) { return s.status !== 'signed'; });
        if (ni < 0 || oa.signers[ni].email !== me) err('not_your_turn', 403);
        return { url: demoSignUrl(DB.envelopes.find(function (e) { return e.id === oa.signers[ni].envelope_id; }).token, cl.language) };
      case 'resend':
        var ri2 = oa.signers.findIndex(function (s) { return s.status !== 'signed'; }); if (ri2 < 0) return { ok: true };
        mailSigner(oa, oa.signers[ri2], DB.envelopes.find(function (e) { return e.id === oa.signers[ri2].envelope_id; })); log('oa.signature_resent', { signer_index: ri2, emailed: true }); return { ok: true, emailed: true };
      case 'admin_release':
        need(oa.status === 'in_review' && !!oa.current_version_id);
        var open = (oa.issues || []).filter(function (i) { return !i.resolved; }); if (open.length) err('issues_open', 409, open.map(function (i) { return i.code; }));
        oaSet(oa, { status: 'client_review', review_note: pb.note || null }, me); log('oa.released_to_client', { reviewer: true, rules_approved: true }); return { ok: true };
      case 'admin_regenerate':
        need(['in_review', 'client_review'].indexOf(oa.status) > -1);
        oaSet(oa, { status: 'drafting' }, me); log('oa.regenerate', {}); setTimeout(function () { draft(oa, (oa.issues || []).filter(function (i) { return !i.resolved; }), pb.note || null); }, 1800); return { ok: true };
      case 'admin_edit_section':
        var cv = DB.oa_versions.find(function (x) { return x.id === oa.current_version_id; }), content = JSON.parse(JSON.stringify(cv.content));
        content.articles.forEach(function (a) { a.sections.forEach(function (s) { if (s.rule === pb.rule) { s.text = String(pb.text || ''); s.ai = false; s.edited_by = me; } }); });
        var nv = { id: uuid(), oa_id: oa.id, version: oa.version + 1, final: false, created_at: new Date().toISOString(), created_by: me, source: 'edit', content: content, pdf_sha256: fnv(JSON.stringify(content)), rules_version: oa.rules_version, rule_set_id: oa.rule_set_id, validation: [], note: 'Section ' + pb.rule + ' edited' };
        DB.oa_versions.push(nv); oaSet(oa, { version: nv.version, current_version_id: nv.id }); if (oa.status === 'client_review') oaSet(oa, { status: 'in_review' }, me);
        log('oa.section_edited', { rule: pb.rule, version: nv.version }); return { ok: true };
      case 'admin_resolve_issue':
        var iss = (oa.issues || []).slice(); iss[+pb.index] = Object.assign({}, iss[+pb.index], { resolved: true, resolved_by: me, resolved_at: new Date().toISOString(), note: pb.note });
        oaSet(oa, { issues: iss }); log('oa.issue_resolved', { code: iss[+pb.index].code, note: String(pb.note || '').slice(0, 300) }); return { ok: true };
      case 'admin_resolve_comment':
        var cm = DB.oa_comments.find(function (c) { return c.id === +pb.comment_id; }); if (cm) Object.assign(cm, { resolved_at: new Date().toISOString(), resolved_by: me, resolution: pb.resolution });
        log('oa.comment_resolved', { comment_id: +pb.comment_id }); return { ok: true };
      case 'admin_return': oaSet(oa, { status: 'questionnaire', review_note: pb.note || null }, me); log('oa.returned_to_client', {}); return { ok: true };
      case 'admin_cancel': oaSet(oa, { status: 'cancelled', review_note: pb.note || null }, me); log('oa.cancelled', { note: pb.note }); return { ok: true };
      case 'admin_restart': var n2 = Object.assign({}, oa, { id: uuid(), status: 'pending_generation', answers: {}, versions: 0, version: 0, current_version_id: null, issues: [], consents: [], signers: [] }); DB.operating_agreements.push(n2); tlPush(co, 'operating_agreement', 'pending_generation'); log('oa.restarted', { new_id: n2.id }); return { ok: true, id: n2.id };
    }
    err('unknown_action');
  }
  async function draft(oa, reasons, notes) {
    var ri = ruleSet(oa.answers.state), co = DB.companies.find(function (c) { return c.id === oa.company_id; });
    var model = EOARules.compose(ri.rs, oa.answers, co);
    model.articles.forEach(function (a) { a.sections.forEach(function (s) { s.ai = true; }); });
    var v = { id: uuid(), oa_id: oa.id, version: oa.version + 1, final: false, created_at: new Date().toISOString(), created_by: 'carlos.lima@example.com', source: 'ai', content: model, pdf_sha256: fnv(JSON.stringify(model)), pages: null, fields: null,
      ai_provider: 'demo', ai_model: 'simulated (demo)', ai_request_id: 'demo_' + Date.now(), prompt_sha256: fnv('prompt' + oa.id + Date.now()), rules_version: ri.rs.version, rule_set_id: ri.id, validation: [], note: notes };
    DB.oa_versions.push(v);
    var issues = (reasons || []).map(function (x) { return Object.assign({}, x, { resolved: !!x.resolved }); });
    oaSet(oa, { status: 'in_review', version: v.version, current_version_id: v.id, rule_set_id: ri.id, rules_version: ri.rs.version, issues: issues, review_required: issues.some(function (i) { return !i.resolved; }), last_error: null });
    auditPush({ action: 'oa.draft_generated', actor_email: 'system', actor_role: 'system', entity_type: 'operating_agreement', entity_id: oa.id, client_id: oa.client_id, company_id: oa.company_id, ip: null, details: { version_id: v.id, source: 'ai', ai_provider: 'demo', ai_model: 'simulated (demo)', rules_approved: true, review_reasons: issues.map(function (i) { return i.code; }) } });
    DB.admin_events.unshift({ id: Date.now(), at: new Date().toISOString(), kind: 'oa_review', title: (issues.length ? 'Revisão habilitada necessária: ' : 'Minuta para revisar: ') + 'Operating Agreement · ' + co.legal_name, body: 'Minuta v' + v.version + ' pronta.', link: '#/compliance?tab=oa&id=' + oa.id, read_at: null });
    oaSave();
    toast(MODE === 'admin' ? 'Demo: nova minuta gerada.' : 'Demo: minuta gerada. A Endeavor revisa e libera no Admin → Compliance.');
  }

  /* ---- the e-signature function (signer page) ---- */
  async function esignFn(pb) {
    var env = DB.envelopes.find(function (e) { return e.token === pb.token; });
    var err = function (c, s) { var e = new Error(c); e.status = s || 400; throw e; };
    if (!env) err('invalid_link', 404);
    if (pb.action === 'get') {
      if (env.status === 'signed') return { status: 'signed', title: env.title, signer_name: env.signer_name, signed_at: env.signed_at, signed_url: URL.createObjectURL(await signedBytes(env)), signed_sha256: env.signed_document_sha256 };
      var first = !env.viewed_at; if (first) { env.viewed_at = new Date().toISOString(); env.status = 'viewed'; }
      DB.envelope_events.push({ id: Date.now() + Math.random(), envelope_id: env.id, event: 'viewed', at: new Date().toISOString(), ip: '189.40.12.77', user_agent: 'demo', details: {} });
      if (env.oa_id) { var o = DB.operating_agreements.find(function (x) { return x.id === env.oa_id; }); auditPush({ action: 'esign.viewed', actor_email: env.signer_email, actor_role: 'signer', entity_type: 'envelope', entity_id: env.id, client_id: o.client_id, company_id: o.company_id, details: { oa_id: o.id, signer_index: env.signer_index } }); }
      oaSave();
      return { status: 'viewed', first_view: first, title: env.title, message: env.message, signer_name: env.signer_name, signer_email: env.signer_email, fields: env.fields || [], document_sha256: env.document_sha256, document_url: URL.createObjectURL(env.oa_id ? await docBytes(env) : await samplePdf(env.document_path)) };
    }
    if (pb.action === 'sign') {
      if (env.status === 'signed') err('already_signed', 409);
      var at = new Date();
      SIGS[env.id] = { png: pb.signature_png || '', typed: pb.typed_name, at: at.toISOString(), date: new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: '2-digit', day: '2-digit', year: 'numeric' }).format(at) };
      Object.assign(env, { status: 'signed', signed_at: at.toISOString(), consent_at: at.toISOString(), signature_name: pb.typed_name, signer_ip: '189.40.12.77', signer_user_agent: 'demo', signed_document_path: 'signed/' + env.id + '.pdf', signed_document_sha256: fnv('signed' + env.id) });
      GEN['signed/' + env.id + '.pdf'] = function () { return signedBytes(env); };
      ['consented', 'signed', 'completed'].forEach(function (k) { DB.envelope_events.push({ id: Date.now() + Math.random(), envelope_id: env.id, event: k, at: at.toISOString(), ip: '189.40.12.77', user_agent: 'demo', details: {} }); });
      if (env.oa_id) { var o2 = DB.operating_agreements.find(function (x) { return x.id === env.oa_id; }); ['esign.consented', 'esign.signed', 'esign.completed'].forEach(function (k) { auditPush({ action: k, actor_email: env.signer_email, actor_role: 'signer', entity_type: 'envelope', entity_id: env.id, client_id: o2.client_id, company_id: o2.company_id, ip: '189.40.12.77', details: { oa_id: o2.id, signer_index: env.signer_index, signer_name: env.signer_name } }); }); }
      oaSave();
      if (env.oa_id) setTimeout(function () { demoNextSigner(env); }, 900);
      return { status: 'signed', signed_at: env.signed_at, signed_sha256: env.signed_document_sha256, signed_url: URL.createObjectURL(await signedBytes(env)) };
    }
    if (pb.action === 'download') return { signed_url: URL.createObjectURL(await signedBytes(env)) };
    err('unknown_action');
  }
  // demo shortcut: after one signer signs, offer to open the next signer's link (in production it arrives by e-mail)
  function demoNextSigner(env) {
    var nx = DB.envelopes.find(function (e) { return e.oa_id === env.oa_id && e.signer_index === env.signer_index + 1; });
    var box = document.getElementById('done'); if (!box || !nx || nx.status === 'signed') return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--gold'; b.id = 'demo-next-signer'; b.style.marginTop = '1rem';
    b.textContent = 'Demo: abrir o link do próximo signatário (' + nx.signer_name + ')';
    b.onclick = function () { if (window.ENDEAVOR_REOPEN) window.ENDEAVOR_REOPEN('sign', null, { t: nx.token, ret: 'client' }); else location.href = 'sign-demo.html?t=' + nx.token + '&ret=client'; };
    box.appendChild(b);
  }

  /* ---- rpc additions ---- */
  function oaRpc(name, args) {
    if (name === 'audit_event') { var co = args.p_company && DB.companies.find(function (c) { return c.id === args.p_company; }); auditPush({ action: args.p_action, entity_type: args.p_entity_type, entity_id: args.p_entity_id, company_id: args.p_company || null, client_id: co ? co.client_id : (args.p_details && args.p_details.client_id) || null, details: args.p_details || {} }); oaSave(); return { v: null }; }
    if (name === 'audit_verify') { var prev = null, n = 0; for (var i = 0; i < DB.audit_log.length; i++) { var r = DB.audit_log[i]; n++; if (r.prev_hash !== prev || r.hash !== rowHash(r, prev)) return { v: [{ ok: false, checked: n, first_bad: r.id }] }; prev = r.hash; } return { v: [{ ok: true, checked: n, first_bad: null }] }; }
    if (name === 'is_legal_reviewer') return { v: MODE === 'admin' && !!(DB.admins.find(function (a) { return a.email === ADMIN.email; }) || {}).legal_reviewer };
    if (name === 'set_legal_reviewer') { var a = DB.admins.find(function (x) { return x.email === args.p_email; }); if (a) a.legal_reviewer = args.p_on; auditPush({ action: 'compliance.reviewer', entity_type: 'admin', entity_id: args.p_email, details: { legal_reviewer: args.p_on } }); oaSave(); return { v: null }; }
    if (name === 'approve_rule_set' || name === 'retire_rule_set') { seedRules(); var s = DB.oa_rule_sets.find(function (x) { return x.id === args.p_id; }); if (s) Object.assign(s, name === 'approve_rule_set' ? { status: 'approved', approved_at: new Date().toISOString(), approved_by: ADMIN.email, approval_note: args.p_note } : { status: 'retired', approval_note: args.p_note }); auditPush({ action: name === 'approve_rule_set' ? 'rules.approve' : 'rules.retire', entity_type: 'rule_set', entity_id: args.p_id, details: { state: s && s.state, note: args.p_note } }); oaSave(); return { v: null }; }
    return null;
  }
  function oaVisible(table, rows, role, coOk) {
    switch (table) {
      case 'company_timeline': return rows.filter(function (r) { return r.visible_to_client && coOk(r.client_id, r.company_id); });
      case 'operating_agreements': return rows.filter(function (r) { return role(r.client_id) === 'owner'; });
      case 'oa_versions': case 'oa_comments': return rows.filter(function (r) { var o = DB.operating_agreements.find(function (x) { return x.id === r.oa_id; }); return o && role(o.client_id) === 'owner'; });
      case 'oa_rule_sets': seedRules(); return rows.filter(function (r) { return r.status === 'approved'; });
    }
    return null;
  }

  window.supabase = { createClient: function () { return { from: function (t) { return new Q(t); }, auth: auth, storage: storage, rpc: rpc, channel: rtChannel, removeChannel: rtRemove }; } };
  window.EOA_NAVIGATE = function (url) {
    var q = {}; (url.split('?')[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ''); });
    if (window.ENDEAVOR_REOPEN) window.ENDEAVOR_REOPEN('sign', null, q); else location.href = 'sign-demo.html?' + (url.split('?')[1] || '');
  };

  /* ---------------- edge functions & FormSubmit ---------------- */
  var realFetch = window.fetch.bind(window);
  var REPORTS = { ProfitAndLoss: 'Profit and Loss', BalanceSheet: 'Balance Sheet', CashFlow: 'Statement of Cash Flows' };
  window.fetch = function (url, opts) {
    var u = String(url && url.url || url);
    var json = function (b, s) { return Promise.resolve(new Response(JSON.stringify(b), { status: s || 200, headers: { 'Content-Type': 'application/json' } })); };
    if (/formsubmit\.co/.test(u)) { var fb = {}; try { fb = JSON.parse(opts.body); } catch (e) { /* ignore */ } mailPreview(fb); return json({ success: 'true' }); }
    if (/\/functions\/v1\/qbo/.test(u)) {
      var b = {}; try { b = JSON.parse(opts.body); } catch (e) { /* ignore */ }
      if (b.action === 'connect') { QBO[b.company_id] = { connected: true, qbo_company_name: (DB.companies.find(function (c) { return c.id === b.company_id; }) || {}).legal_name, connected_at: new Date().toISOString(), last_sync_at: null, last_error: null }; return json({ url: PORTAL ? '#/reports?company=' + b.company_id + '&qbo=connected' : (window.ERoute ? ERoute.get() : location.hash) || '#/clientes' }); }
      if (b.action === 'disconnect') { delete QBO[b.company_id]; return json({ ok: true }); }
      if (b.action === 'generate') {
        var co = DB.companies.find(function (c) { return c.id === b.company_id; }), q = +b.quarter, label = q ? 'Q' + q + ' ' + b.year : b.year + ' (full year)';
        Object.keys(REPORTS).forEach(function (k) { new Q('company_documents').upsert({ company_id: co.id, category: 'report', title: REPORTS[k] + ' - ' + label, year: +b.year, path: co.client_id + '/' + co.id + '/reports/' + b.year + '-' + q + '-' + k + '.pdf', mime: 'application/pdf', visible_to_client: true, uploaded_by: null, uploaded_by_email: 'QuickBooks' }).run(); });
        QBO[co.id].last_sync_at = new Date().toISOString();
        return new Promise(function (r) { setTimeout(function () { r(json({ ok: true, period: label })); }, 900); });
      }
    }
    if (/\/functions\/v1\/(oa|esign)$/.test(u)) {
      var ob = {}; try { ob = JSON.parse(opts.body); } catch (e) { /* ignore */ }
      return (/\/oa$/.test(u) ? oaFn : esignFn)(ob).then(function (r) { return json(r); }, function (e) { if (!e.status) console.error(e); return json({ error: e.message, detail: e.detail }, e.status || 500); });
    }
    if (/\/functions\/v1\/payments/.test(u)) {
      var pb = {}; try { pb = JSON.parse(opts.body); } catch (e) { /* ignore */ }
      var later = function (b) { return new Promise(function (res) { setTimeout(function () { res(json(b)); }, 600); }); };
      var invRow = DB.invoices.find(function (i) { return i.id === pb.invoice_id; });
      var partner = DB.partners.find(function (p) { return p.id === (MODE === 'admin' ? pb.partner_id : PME && PME.id); });
      switch (pb.action) {
        case 'status': DB.stripe_settings[0].checked_at = new Date().toISOString(); return later(Object.assign({ configured: true }, DB.stripe_settings[0]));
        case 'partner_onboard':
          if (!partner) return json({ error: 'forbidden' }, 403);
          if (MODE === 'admin') return later({ url: 'https://connect.stripe.com/setup/e/demo/' + partner.id.slice(0, 8) });
          Object.assign(partner, { stripe_account_id: 'acct_1Demo' + partner.id.slice(1, 8), stripe_details_submitted: true, stripe_charges_enabled: true, stripe_payouts_enabled: true, stripe_transfers_active: true });
          toast('Demo: no site real o parceiro preenche o cadastro no Stripe e volta para cá.');
          return later({ url: '#/payouts?stripe=return' });
        case 'partner_refresh': return later({ ok: true });
        case 'send_access': toast('Demo: o Supabase enviaria o e-mail "Crie sua senha do portal Endeavor" com o link de acesso.'); return later({ ok: true, sent: 'invite' });
        case 'partner_login': toast('Demo: abriria o painel Stripe Express do parceiro.'); return later({ url: '#/payouts' });
        case 'invoice_create':
          var cl = DB.clients.find(function (c) { return c.id === pb.client_id; }), its = pb.items || [], tot = its.reduce(function (s, i) { return s + i.amount_cents * (i.quantity || 1); }, 0);
          var pp = DB.partners.find(function (p) { return p.id === pb.partner_id; }), pct = pp ? (pb.partner_pct != null ? +pb.partner_pct : +pp.default_share_pct) : null, share = pp ? Math.round(tot * pct / 100) : 0, n = DB.invoices.length + 1;
          DB.invoices.push({ id: uuid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), client_id: cl.id, referral_id: pb.referral_id || null, partner_id: pp ? pp.id : null, partner_pct: pct, partner_amount_cents: share,
            transfer_status: pp && share > 0 ? (pp.stripe_transfers_active ? 'scheduled' : 'pending') : 'none', stripe_invoice_id: 'in_demo' + n, number: pb.send ? 'EBS-' + Y + '-' + String(n).padStart(4, '0') : null, status: pb.send ? 'open' : 'draft', currency: 'usd',
            items: its, description: pb.description || null, total_cents: tot, amount_paid_cents: 0, due_date: day(+pb.days_until_due || 7), customer_email: cl.primary_email,
            hosted_invoice_url: pb.send ? 'https://invoice.stripe.com/i/demo_' + n : null, invoice_pdf: pb.send ? 'https://pay.stripe.com/invoice/demo_' + n + '/pdf' : null, sent_at: pb.send ? new Date().toISOString() : null, paid_at: null, created_by: ADMIN.email });
          toast(pb.send ? 'Demo: fatura criada no Stripe e enviada para ' + cl.primary_email + '.' : 'Demo: rascunho criado no Stripe.');
          return later({ ok: true });
        case 'invoice_send': Object.assign(invRow, { status: 'open', number: 'EBS-' + Y + '-' + String(DB.invoices.indexOf(invRow) + 1).padStart(4, '0'), sent_at: new Date().toISOString(), hosted_invoice_url: 'https://invoice.stripe.com/i/demo_x', invoice_pdf: 'https://pay.stripe.com/invoice/demo_x/pdf' }); toast('Demo: fatura enviada ao cliente pelo Stripe.'); return later({ ok: true });
        case 'invoice_void': invRow.status = 'void'; return later({ ok: true });
        case 'invoice_checkout':
          if (!invRow) return json({ error: 'not_found' }, 404);
          return later({ status: invRow.status, client_secret: invRow.status === 'open' || invRow.status === 'uncollectible' ? 'pi_demo_' + invRow.id.slice(0, 8) + '_secret_demo' : undefined, publishable_key: 'pk_test_demo',
            amount_due: invRow.total_cents - invRow.amount_paid_cents, currency: invRow.currency, hosted_invoice_url: invRow.hosted_invoice_url, invoice_pdf: invRow.invoice_pdf });
        case 'invoice_refresh': return later({ ok: true, status: invRow && invRow.status });
        case 'invoice_archive': return later({ url: invRow ? invRow.invoice_pdf : '' });
        case 'proposal_send':
          var ps = DB.proposals.find(function (x) { return x.id === pb.proposal_id; });
          ps.token = ps.token || (ps.id === DB.proposals[0].id ? DEMO_TOKEN : 'demo' + ps.id.replace(/-/g, '').slice(0, 36));
          Object.assign(ps, { status: 'sent', sent_at: new Date().toISOString(), valid_until: ps.valid_until || day(30) });
          return later({ ok: true, url: 'https://endeavorbiz.com/proposal.html?t=' + ps.token + '&lang=' + ps.language });
        case 'proposal_invoice':
          var pi2 = DB.proposals.find(function (x) { return x.id === pb.proposal_id; }); acceptProposal(pi2, pi2.accepted_name, pi2.accepted_at); return later({ ok: true });
        case 'proposal_get': case 'proposal_accept':
          var pp2 = DB.proposals.find(function (x) { return x.token === pb.token; });
          if (!pp2) return json({ error: 'not_found' }, 404);
          var cl2 = DB.clients.find(function (c) { return c.id === pp2.client_id; });
          var pub = function () { return { title: pp2.title, intro: pp2.intro, included: pp2.included, items: pp2.items, total_cents: pp2.total_cents, currency: pp2.currency, terms: pp2.terms, language: pp2.language, valid_until: pp2.valid_until, status: pp2.status, client_name: cl2.name, accepted_at: pp2.accepted_at, accepted_name: pp2.accepted_name }; };
          if (pb.action === 'proposal_get') { pp2.viewed_at = pp2.viewed_at || new Date().toISOString(); return later(pub()); }
          var portalUrl = 'https://endeavorbiz.com/client.html?lang=' + pp2.language + '#/invoices';
          if (pp2.status === 'accepted') return later(Object.assign(pub(), { portal_url: portalUrl, already: true }));
          var at = new Date().toISOString(), newInv = acceptProposal(pp2, pb.name, at);
          if (pp2.id === DB.proposals[0].id) flowSet({ accepted: { name: pb.name, at: at } });
          return later(Object.assign(pub(), { portal_url: portalUrl, first_access: true, access_email: 'invite', email: cl2.primary_email, invoice: { number: newInv.number, total_cents: newInv.total_cents, currency: 'usd', due_date: newInv.due_date } }));
        case 'invoice_sync':
          markPaid(invRow, new Date().toISOString());
          toast('Demo: pagamento simulado. ' + (invRow.transfer_status === 'paid' ? 'A comissão foi repassada automaticamente ao parceiro.' : invRow.transfer_status === 'pending' ? 'O parceiro ainda não conectou o Stripe: repasse pendente.' : ''));
          return later({ ok: true });
        case 'transfer':
          var tp = DB.partners.find(function (p) { return p.id === invRow.partner_id; });
          if (!tp || !tp.stripe_transfers_active) return json({ error: 'partner_not_ready' }, 400);
          invRow.transfer_status = 'paid'; invRow.stripe_transfer_id = 'tr_demo'; toast('Demo: comissão transferida para a conta Stripe do parceiro.'); return later({ ok: true });
      }
      return json({ error: 'unknown_action' }, 400);
    }
    if (/\/rest\/v1\/rpc\//.test(u)) return json(null);
    return realFetch(url, opts);
  };

  /* ---------------- demo banner ---------------- */
  function toast(t) {
    var el = document.createElement('div'); el.className = 'demo-toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 3800);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent = '.demo-pill{position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(24rem,calc(100vw - 24px));background:#0b1f3a;color:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);font:500 13px/1.45 Inter,system-ui,sans-serif;padding:.75rem .9rem}' +
      '.demo-pill b{color:#e2c27d}.demo-pill code{background:rgba(255,255,255,.12);padding:0 .3rem;border-radius:4px;font-size:12px}.demo-pill a{color:#e2c27d}.demo-pill button{background:none;border:0;color:#cbd5e1;cursor:pointer;float:right;font-size:16px;line-height:1;margin:-2px -4px 0 6px}' +
      '.demo-badge{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:999px;background:#c8a45d;color:#0b1f3a;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.08em;white-space:nowrap}.demo-pill[hidden]{display:none}.demo-pill.is-mini{max-width:14.5rem;padding:.45rem .7rem;font-size:12px}.demo-pill.is-mini .demo-pill__more{display:none}' +
      '.demo-toast{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:10000;background:#1e6b3a;color:#fff;padding:.6rem 1rem;border-radius:10px;font:500 13px Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:calc(100vw - 32px)}';
    document.head.appendChild(css);
    var pill = document.createElement('aside'); pill.className = 'demo-pill'; pill.setAttribute('aria-label', 'Demo');
    pill.innerHTML = '<button type="button" aria-label="Fechar aviso">×</button><b>MODO DEMONSTRAÇÃO</b> · dados fictícios<span class="demo-pill__more">, nada é salvo.<br>' +
      (MODE === 'proposal' ? 'Página pública da proposta: é o link que o cliente recebe por e-mail.' : MODE === 'sign' ? 'Ferramenta de assinatura eletrônica da Endeavor: é o link que cada signatário recebe.' : 'Login: <code>' + (MODE === 'admin' ? ADMIN.email : ME.email) + '</code> · qualquer senha · código <code>123456</code>') + '</span>';
    document.body.appendChild(pill);
    pill.querySelector('button').onclick = function () { pill.remove(); };
    var badge = document.createElement('span'); badge.className = 'demo-badge'; badge.textContent = 'DEMO'; badge.title = 'Modo demonstração: dados fictícios, nada é salvo';
    var mini = function () {
      var inApp = document.body.classList.contains('app-shell');
      pill.hidden = inApp;
      var left = document.querySelector('.portal-top__left');
      if (inApp && left && !badge.isConnected) left.appendChild(badge);
      if (!inApp && badge.isConnected) badge.remove();
    };
    new MutationObserver(mini).observe(document.body, { attributes: true, attributeFilter: ['class'] }); mini();
    // prefill sample login
    var tryFill = function () {
      var e = document.getElementById('l-email'), p = document.getElementById('l-pass'), c = document.getElementById('mfa-code');
      if (e && !e.value) e.value = MODE === 'admin' ? ADMIN.email : ME.email;
      if (p && !p.value) p.value = 'demo-password';
      if (c && !c.value) c.value = '123456';
    };
    new MutationObserver(tryFill).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    tryFill();
    // links that point to other site pages go to the live site
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var h = a.getAttribute('href');
      if (window.ENDEAVOR_COMBINED) {
        // single-file preview: logo goes back to the homepage, language links reload this portal
        if (/^index\.html/.test(h) || a.closest('.portal-top__left')) { e.preventDefault(); try { sessionStorage.removeItem('endeavor-combined-open'); } catch (x) { /* ignore */ } location.reload(); return; }
        if (a.closest('.lang-mini')) { e.preventDefault(); try { localStorage.setItem('endeavor-lang', JSON.stringify(a.dataset.lang)); } catch (x) { /* ignore */ } if (window.ENDEAVOR_REOPEN) window.ENDEAVOR_REOPEN(MODE, a.dataset.lang); else location.reload(); return; }
      }
      if (/client\.html/.test(h) && (MODE === 'proposal' || MODE === 'sign')) { e.preventDefault(); if (window.ENDEAVOR_REOPEN) window.ENDEAVOR_REOPEN('client'); else location.href = 'client-demo.html'; return; }
      if (/proposal\.html\?t=/.test(h) || a.hasAttribute('data-open-proposal')) { e.preventDefault(); if (window.ENDEAVOR_REOPEN) window.ENDEAVOR_REOPEN('proposal'); else window.open('proposal-demo.html', '_blank'); return; }
      if (/^https:\/\/pay\.stripe\.com\/invoice\/.+\/pdf$/.test(h)) { e.preventDefault(); var ir = DB.invoices.find(function (x) { return x.invoice_pdf === h; }); if (ir) showInvoicePdf(ir); return; }
      if (/^https:\/\/(invoice|pay|connect)\.stripe\.com\//.test(h)) { e.preventDefault(); toast('Demo: abriria a página segura do Stripe (pagamento com cartão, Pix ou transferência).'); return; }
      if (/^(index|schedule|login|privacy-policy|terms-of-use)\.html/.test(h)) { a.setAttribute('href', LIVE + h); a.target = '_blank'; a.rel = 'noopener'; }
    }, true);
  });

  /* ---------------- demo invoice PDF ---------------- */
  function pdfSafe(x) { return String(x == null ? '' : x).normalize('NFC').replace(/[^\x20-\x7E -ÿ]/g, function (c) { return c.normalize('NFKD').replace(/[^\x20-\x7E]/g, ''); }); }
  async function invoicePdf(inv) {
    var L2 = window.PDFLib, pdf = await L2.PDFDocument.create(), pg = pdf.addPage([612, 792]);
    var f = await pdf.embedFont(L2.StandardFonts.Helvetica), b = await pdf.embedFont(L2.StandardFonts.HelveticaBold);
    var navy = L2.rgb(0.04, 0.12, 0.23), gold = L2.rgb(0.78, 0.64, 0.36), grey = L2.rgb(0.42, 0.45, 0.5), ink = L2.rgb(0.1, 0.1, 0.12), green = L2.rgb(0.12, 0.42, 0.23);
    var cl = DB.clients.find(function (c) { return c.id === inv.client_id; }) || {};
    var usd = function (c) { return 'US$ ' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var T = function (t, x, y, o) { o = o || {}; pg.drawText(pdfSafe(t), { x: x, y: y, size: o.s || 10, font: o.b ? b : f, color: o.c || ink }); };
    var R2 = function (t, x, y, o) { o = o || {}; var w = (o.b ? b : f).widthOfTextAtSize(pdfSafe(t), o.s || 10); T(t, x - w, y, o); };
    pg.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: navy });
    T('ENDEAVOR', 48, 768, { s: 18, b: true, c: L2.rgb(1, 1, 1) }); T('BUSINESS SOLUTIONS', 48, 754, { s: 8, c: gold });
    R2('INVOICE / FATURA', 564, 762, { s: 14, b: true, c: L2.rgb(1, 1, 1) });
    T('Endeavor Business Solutions (Endeavor Tax Solutions LLC)', 48, 712, { b: true }); T('111 N Orange Ave, Suite 800, Orlando, FL 32801', 48, 698, { c: grey });
    T('support@endeavorbiz.com  ·  +1 (407) 436-9567', 48, 684, { c: grey });
    R2('Invoice # ' + (inv.number || 'DRAFT'), 564, 712, { b: true }); R2('Issued: ' + inv.created_at.slice(0, 10), 564, 698, { c: grey }); R2('Due: ' + (inv.due_date || ''), 564, 684, { c: grey });
    T('BILL TO', 48, 648, { s: 8, b: true, c: grey }); T(cl.name, 48, 634, { b: true }); T(cl.primary_email, 48, 620, { c: grey });
    var y = 580;
    pg.drawRectangle({ x: 48, y: y - 6, width: 516, height: 22, color: L2.rgb(0.95, 0.96, 0.98) });
    T('DESCRIPTION', 58, y, { s: 8, b: true, c: grey }); R2('QTY', 420, y, { s: 8, b: true, c: grey }); R2('AMOUNT', 554, y, { s: 8, b: true, c: grey });
    y -= 26;
    (inv.items || []).forEach(function (i) { T(i.description, 58, y); R2(String(i.quantity || 1), 420, y); R2(usd(i.amount_cents * (i.quantity || 1)), 554, y); y -= 20; pg.drawLine({ start: { x: 48, y: y + 12 }, end: { x: 564, y: y + 12 }, thickness: 0.5, color: L2.rgb(0.88, 0.9, 0.93) }); });
    y -= 8; T('Total', 380, y, { b: true }); R2(usd(inv.total_cents), 554, y, { b: true, s: 12 });
    y -= 18; T('Amount paid', 380, y, { c: grey }); R2(usd(inv.amount_paid_cents), 554, y, { c: grey });
    y -= 18; T('Amount due', 380, y, { b: true }); R2(usd(inv.total_cents - inv.amount_paid_cents), 554, y, { b: true, c: navy });
    if (inv.status === 'paid') { pg.drawRectangle({ x: 48, y: y - 4, width: 120, height: 34, borderColor: green, borderWidth: 2 }); T('PAID / PAGA', 60, y + 8, { s: 14, b: true, c: green }); T('on ' + String(inv.paid_at || '').slice(0, 10), 60, y - 1, { s: 7, c: green }); }
    y -= 60;
    pg.drawLine({ start: { x: 48, y: y + 20 }, end: { x: 564, y: y + 20 }, thickness: 1, color: gold });
    T('How to pay', 48, y, { b: true }); y -= 16;
    T('Online in the Endeavor Client Portal (Invoices > Pay now): card, Pix, U.S. bank transfer (ACH), Apple Pay or Google Pay.', 48, y, { s: 9, c: grey }); y -= 13;
    T('Payments are processed by Stripe. Endeavor never sees your card or bank details.', 48, y, { s: 9, c: grey });
    T('SAMPLE DOCUMENT - DEMO MODE', 48, 40, { s: 8, b: true, c: gold }); R2('Page 1 of 1', 564, 40, { s: 8, c: grey });
    return pdf.save();
  }
  async function showInvoicePdf(inv) {
    var bytes = await invoicePdf(inv), name = 'Invoice-' + (inv.number || 'draft') + '.pdf';
    var ov = document.createElement('div'); ov.className = 'overlay overlay--center'; ov.style.zIndex = 9000;
    ov.innerHTML = '<div class="modal modal--wide" role="dialog" aria-modal="true" aria-label="' + name + '"><div class="viewer"><div class="viewer__bar"><strong>' + name + '</strong><div class="portal-btn-row"><button class="btn btn--ghost btn--xs" type="button" data-dl>Download</button><button class="close-x" type="button" aria-label="Close">×</button></div></div><div class="viewer__pages" data-pages></div></div></div>';
    document.body.appendChild(ov);
    var close = function () { ov.remove(); document.removeEventListener('keydown', esc); }, esc = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc); ov.querySelector('.close-x').onclick = close; ov.onclick = function (e) { if (e.target === ov) close(); };
    ov.querySelector('[data-dl]').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
    ov.querySelector('.close-x').focus();
    if (window.EPdf) { var d = await EPdf.open(bytes.slice ? bytes.slice() : bytes); await EPdf.render(d, ov.querySelector('[data-pages]'), { maxWidth: 820, pageLabel: 'Page' }); }
  }

  /* ---------------- demo Stripe.js (Payment Element) ---------------- */
  function payInvoice(secret, how) {
    var inv = DB.invoices.find(function (i) { return secret.indexOf('pi_demo_' + i.id.slice(0, 8)) === 0; });
    if (!inv) return;
    if (how === 'ach') { toast('Demo: débito ACH iniciado. Ele leva de 1 a 4 dias úteis para compensar.'); return 'processing'; }
    markPaid(inv, new Date().toISOString());
    toast('Demo: pagamento aprovado' + (inv.partner_id ? ' e comissão do parceiro repassada automaticamente.' : '.'));
    return 'succeeded';
  }
  function fakeQr(canvas, seed) {
    var n = 29, c = canvas.getContext('2d'), s = canvas.width / n, r = seed;
    var rnd = function () { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#0b1f3a';
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (rnd() > 0.52) c.fillRect(x * s, y * s, s, s);
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(function (p) {
      c.fillStyle = '#fff'; c.fillRect((p[0] - 1) * s, (p[1] - 1) * s, 9 * s, 9 * s);
      c.fillStyle = '#0b1f3a'; c.fillRect(p[0] * s, p[1] * s, 7 * s, 7 * s); c.fillStyle = '#fff'; c.fillRect((p[0] + 1) * s, (p[1] + 1) * s, 5 * s, 5 * s); c.fillStyle = '#0b1f3a'; c.fillRect((p[0] + 2) * s, (p[1] + 2) * s, 3 * s, 3 * s);
    });
  }
  window.Stripe = function (pk, opts) {
    var pt = /^pt/.test((opts && opts.locale) || ''), es = /^es/.test((opts && opts.locale) || '');
    var Lx = function (p, e, s2) { return pt ? p : es ? s2 : e; };
    var state = { tab: 'card', bank: null, root: null, secret: null };
    var css = document.createElement('style');
    css.textContent = '.fpe{display:grid;gap:.85rem;font:400 15px/1.4 Inter,system-ui,sans-serif;color:#14213d}.fpe-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem}@media(max-width:520px){.fpe-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}.fpe,.fpe-f,.fpe-row>*{min-width:0}.fpe-f input,.fpe-f select{width:100%;box-sizing:border-box}.fpe-tab{display:grid;gap:.35rem;justify-items:start;padding:.65rem .75rem;border:1px solid #d5dae3;border-radius:8px;background:#fff;cursor:pointer;font:600 13px Inter,system-ui,sans-serif;color:#30313d;text-align:left;box-shadow:0 1px 1px rgba(0,0,0,.03)}.fpe-tab[aria-selected=true]{border-color:#0b1f3a;box-shadow:0 0 0 1px #0b1f3a;color:#0b1f3a}.fpe-tab svg{width:22px;height:16px}' +
      '.fpe-f{display:grid;gap:.3rem}.fpe-f label{font-size:13px;color:#30313d}.fpe-f input,.fpe-f select{min-height:44px;border:1px solid #d5dae3;border-radius:8px;padding:0 .75rem;font:inherit;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.03)}.fpe-f input:focus,.fpe-f select:focus{outline:2px solid rgba(11,31,58,.25);border-color:#0b1f3a}.fpe-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}' +
      '.fpe-note{font-size:13px;color:#55627a;background:#f6f8fb;border-radius:8px;padding:.7rem .8rem}.fpe-banks{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}.fpe-bank{min-height:44px;border:1px solid #d5dae3;border-radius:8px;background:#fff;font:600 13px Inter,system-ui,sans-serif;cursor:pointer}.fpe-bank[aria-pressed=true]{border-color:#0b1f3a;box-shadow:0 0 0 1px #0b1f3a}' +
      '.fpe-wallet{min-height:48px;border-radius:8px;border:0;background:#000;color:#fff;font:600 16px Inter,system-ui,sans-serif}.fpe-pix{display:grid;justify-items:center;gap:.6rem;text-align:center;padding:.5rem}.fpe-pix canvas{width:210px;height:210px;border:8px solid #fff;box-shadow:0 0 0 1px #e3e7ee;border-radius:6px}.fpe-copy{display:flex;gap:.4rem;width:100%}.fpe-copy input{flex:1;min-width:0;min-height:40px;border:1px solid #d5dae3;border-radius:8px;padding:0 .6rem;font:12px ui-monospace,monospace}.fpe-copy button{border:1px solid #d5dae3;border-radius:8px;background:#fff;padding:0 .8rem;cursor:pointer;font:600 13px Inter,sans-serif}.fpe-wait{display:flex;gap:.5rem;align-items:center;font-size:13px;color:#55627a}.fpe-spin{width:14px;height:14px;border:2px solid #d5dae3;border-top-color:#0b1f3a;border-radius:50%;animation:fpe 0.8s linear infinite}@keyframes fpe{to{transform:rotate(360deg)}}.fpe-badge{font-size:11px;color:#6b7280;text-align:right}';
    document.head.appendChild(css);
    var ico = { card: '<svg viewBox="0 0 24 16"><rect x=".5" y=".5" width="23" height="15" rx="2" fill="none" stroke="currentColor"/><path d="M1 5h22" stroke="currentColor" stroke-width="2"/></svg>', pix: '<svg viewBox="0 0 24 16"><path d="M12 1l6 7-6 7-6-7z" fill="#32BCAD"/></svg>', ach: '<svg viewBox="0 0 24 16"><path d="M2 6l10-5 10 5M3 6v8M21 6v8M8 7v6M12 7v6M16 7v6M2 15h20" fill="none" stroke="currentColor"/></svg>', wallet: '<svg viewBox="0 0 24 16"><rect x="1" y="2" width="22" height="12" rx="3" fill="#000"/><text x="12" y="11" font-size="7" fill="#fff" text-anchor="middle" font-family="Arial">Pay</text></svg>' };
    function render() {
      var r = state.root; if (!r) return;
      var tabs = [['card', Lx('Cartão', 'Card', 'Tarjeta')], ['pix', 'Pix'], ['ach', Lx('Banco dos EUA', 'US bank account', 'Banco de EE. UU.')], ['wallet', 'Apple Pay / Google Pay']];
      var body = '';
      if (state.tab === 'card') body = '<div class="fpe-f"><label for="fpe-num">' + Lx('Número do cartão', 'Card number', 'Número de tarjeta') + '</label><input id="fpe-num" inputmode="numeric" value="4242 4242 4242 4242" autocomplete="off"></div>' +
        '<div class="fpe-row"><div class="fpe-f"><label for="fpe-exp">' + Lx('Validade', 'Expiration', 'Vencimiento') + '</label><input id="fpe-exp" value="12 / 30"></div><div class="fpe-f"><label for="fpe-cvc">CVC</label><input id="fpe-cvc" value="123" inputmode="numeric"></div></div>' +
        '<div class="fpe-row"><div class="fpe-f"><label for="fpe-ctry">' + Lx('País', 'Country', 'País') + '</label><select id="fpe-ctry"><option>Brasil</option><option>United States</option><option>Paraguay</option></select></div><div class="fpe-f"><label for="fpe-zip">' + Lx('CEP / ZIP', 'ZIP', 'Código postal') + '</label><input id="fpe-zip" value="01310-100"></div></div>';
      if (state.tab === 'pix') body = '<p class="fpe-note">' + Lx('Ao clicar em Pagar, aparece um QR code. Abra o app do seu banco, escolha Pix e leia o código. Compra internacional: o banco aplica IOF de 3,5%.', 'After you click Pay, a QR code appears. Open your bank app, choose Pix and scan it. International purchase: a 3.5% IOF applies.', 'Al hacer clic en Pagar aparece un código QR. Abra la app de su banco, elija Pix y escanéelo. Compra internacional: se aplica IOF de 3,5%.') + '</p>' +
        '<div class="fpe-f"><label for="fpe-cpf">' + Lx('Nome completo', 'Full name', 'Nombre completo') + '</label><input id="fpe-cpf" value="Carlos Lima"></div>';
      if (state.tab === 'ach') body = '<p class="fpe-note">' + Lx('Conecte a conta bancária nos EUA com segurança pelo Stripe. O débito compensa em 1 a 4 dias úteis.', 'Securely connect your U.S. bank account through Stripe. The debit clears in 1 to 4 business days.', 'Conecte su cuenta bancaria de EE. UU. con seguridad por Stripe. El débito se acredita en 1 a 4 días hábiles.') + '</p><div class="fpe-banks">' +
        ['Chase', 'Bank of America', 'Wells Fargo', 'Truist'].map(function (bk) { return '<button type="button" class="fpe-bank" data-bank="' + bk + '" aria-pressed="' + (state.bank === bk) + '">' + bk + '</button>'; }).join('') + '</div>' + (state.bank ? '<p class="fpe-note">' + state.bank + ' · Checking ••••6789 ✓</p>' : '');
      if (state.tab === 'wallet') body = '<p class="fpe-note">' + Lx('Pague com a carteira digital do seu celular ou navegador.', 'Pay with the wallet on your phone or browser.', 'Pague con la billetera de su celular o navegador.') + '</p><button type="button" class="fpe-wallet" data-wallet> Pay</button>';
      r.innerHTML = '<div class="fpe"><div class="fpe-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" class="fpe-tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + ico[t[0]] + t[1] + '</button>'; }).join('') + '</div>' + body + '<div class="fpe-badge">Powered by <b>stripe</b> · demo</div></div>';
      r.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { state.tab = b.dataset.tab; render(); }; });
      r.querySelectorAll('[data-bank]').forEach(function (b) { b.onclick = function () { state.bank = b.dataset.bank; render(); }; });
      var w = r.querySelector('[data-wallet]'); if (w) w.onclick = function () { var f = r.closest('form'); if (f) f.requestSubmit(); };
    }
    var element = { mount: function (sel) { state.root = typeof sel === 'string' ? document.querySelector(sel) : sel; render(); setTimeout(function () { (element._ready || function () {})(); }, 50); }, on: function (ev, cb) { if (ev === 'ready') element._ready = cb; } };
    return {
      elements: function (o) { state.secret = o.clientSecret; return { create: function () { return element; } }; },
      confirmPayment: function () {
        var r = state.root;
        if (state.tab === 'card') {
          var num = (r.querySelector('#fpe-num').value || '').replace(/\D/g, '');
          if (num.length < 15) return Promise.resolve({ error: { message: Lx('Número do cartão incompleto.', 'Your card number is incomplete.', 'Número de tarjeta incompleto.') } });
          if (/^4000000000000002/.test(num)) return Promise.resolve({ error: { message: Lx('Cartão recusado.', 'Your card was declined.', 'Tarjeta rechazada.') } });
          return new Promise(function (res) { setTimeout(function () { res({ paymentIntent: { status: payInvoice(state.secret, 'card') } }); }, 1200); });
        }
        if (state.tab === 'ach' && !state.bank) return Promise.resolve({ error: { message: Lx('Escolha o seu banco.', 'Choose your bank.', 'Elija su banco.') } });
        if (state.tab === 'ach') return new Promise(function (res) { setTimeout(function () { res({ paymentIntent: { status: payInvoice(state.secret, 'ach') } }); }, 1000); });
        if (state.tab === 'wallet') return new Promise(function (res) { setTimeout(function () { res({ paymentIntent: { status: payInvoice(state.secret, 'wallet') } }); }, 900); });
        // Pix: show QR code and wait for the bank app
        return new Promise(function (res) {
          var code = '00020101021226870014br.gov.bcb.pix2565pix.stripe.com/qr/v2/' + state.secret.slice(8, 16) + '5204000053039865802BR5925ENDEAVOR BUSINESS SOLUT6009SAO PAULO62070503***6304' + 'A1B2';
          r.innerHTML = '<div class="fpe fpe-pix"><strong>' + Lx('Pague com Pix', 'Pay with Pix', 'Pague con Pix') + '</strong><canvas width="290" height="290" aria-label="QR code Pix"></canvas>' +
            '<div class="fpe-copy"><label class="sr-only" for="fpe-code">Pix copia e cola</label><input id="fpe-code" readonly value="' + code + '"><button type="button" data-copy>' + Lx('Copiar', 'Copy', 'Copiar') + '</button></div>' +
            '<div class="fpe-wait" role="status"><span class="fpe-spin" aria-hidden="true"></span>' + Lx('Aguardando a confirmação do banco…', 'Waiting for your bank to confirm…', 'Esperando la confirmación del banco…') + '</div>' +
            '<button type="button" class="fpe-bank" data-sim style="padding:0 1rem">' + Lx('Demo: simular pagamento no app do banco', 'Demo: simulate bank app payment', 'Demo: simular pago en la app del banco') + '</button><div class="fpe-badge">Powered by <b>stripe</b> · Pix</div></div>';
          fakeQr(r.querySelector('canvas'), state.secret.length * 7919);
          r.querySelector('[data-copy]').onclick = function () { try { navigator.clipboard.writeText(code); } catch (e) { /* ignore */ } this.textContent = '✓'; };
          var done = false, finish = function () { if (done) return; done = true; res({ paymentIntent: { status: payInvoice(state.secret, 'pix') } }); };
          r.querySelector('[data-sim]').onclick = finish; setTimeout(finish, 9000);
        });
      }
    };
  };

  /* ---------------- demo e-mail preview (FormSubmit is simulated) ---------------- */
  function mailPreview(b) {
    var old = document.getElementById('demo-mail'); if (old) old.remove();
    var el = document.createElement('aside'); el.id = 'demo-mail'; el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'E-mail automático (demo)');
    el.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:10001;width:min(26rem,calc(100vw - 24px));max-height:70vh;display:grid;grid-template-rows:auto 1fr;background:#fff;border:1px solid #e3e7ee;border-radius:14px;box-shadow:0 18px 40px rgba(11,31,58,.22);font:400 13px/1.45 Inter,system-ui,sans-serif;color:#14213d;overflow:hidden';
    var esc2 = function (x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var body = b._autoresponse ? esc2(b._autoresponse).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>') : '';
    el.innerHTML = '<div style="background:#0b1f3a;color:#fff;padding:.65rem .85rem;display:flex;justify-content:space-between;align-items:center;gap:.5rem"><strong style="font-size:13px">✉ E-mail automático enviado (demo)</strong><button type="button" aria-label="Fechar" style="background:none;border:0;color:#cbd5e1;font-size:18px;cursor:pointer;line-height:1">×</button></div>' +
      '<div style="overflow:auto;padding:.75rem .85rem;display:grid;gap:.5rem">' +
      (b._autoresponse ? '<div><b>Para:</b> ' + esc2(b.email) + '</div><pre style="white-space:pre-wrap;margin:0;font:inherit;background:#f6f8fb;border-radius:8px;padding:.6rem">' + body + '</pre>' : '') +
      '<div style="color:#55627a"><b>Cópia para a equipe:</b> support@endeavorbiz.com · ' + esc2(b._subject || '') + '</div></div>';
    document.body.appendChild(el);
    el.querySelector('button').onclick = function () { el.remove(); };
    if (window.innerWidth < 700) el.style.maxHeight = '45vh';
    setTimeout(function () { if (!el.isConnected) return; var body2 = el.lastChild; body2.hidden = true; el.style.width = 'auto'; el.firstChild.style.cursor = 'pointer';
      el.firstChild.onclick = function (e) { if (e.target.tagName === 'BUTTON') return; body2.hidden = !body2.hidden; el.style.width = body2.hidden ? 'auto' : 'min(26rem,calc(100vw - 24px))'; }; }, 12000);
  }
  var realOpen = window.open;
  window.open = function (u) {
    if (/^https:\/\/pay\.stripe\.com\/invoice\/.+\/pdf$/.test(String(u || ''))) { var ir = DB.invoices.find(function (x) { return x.invoice_pdf === u; }); if (ir) showInvoicePdf(ir); return null; }
    if (/^https:\/\/(invoice|pay|connect)\.stripe\.com\//.test(String(u || ''))) { toast('Demo: abriria a página segura do Stripe.'); return null; }
    return realOpen.apply(window, arguments);
  };
})();
