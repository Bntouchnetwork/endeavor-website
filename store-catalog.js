/* Endeavor online services: names and descriptions in the three languages (used by the checkout page and the portal).
   Prices come from the store_products table (Admin > Pagamentos > Loja). */
(function () {
  'use strict';
  var P = {
    crm: {
      en: { name: 'CRM', lead: 'Organize your leads and clients in a simple sales pipeline.', feats: ['Sales pipeline by stage', 'Contacts with notes and history', 'Next actions with dates', 'Online bookings become contacts automatically'] },
      pt: { name: 'CRM', lead: 'Organize seus leads e clientes num funil de vendas simples.', feats: ['Funil de vendas por etapa', 'Contatos com anotações e histórico', 'Próximas ações com data', 'Agendamentos online viram contatos automaticamente'] },
      es: { name: 'CRM', lead: 'Organice sus prospectos y clientes en un embudo de ventas simple.', feats: ['Embudo de ventas por etapa', 'Contactos con notas e historial', 'Próximas acciones con fecha', 'Las citas en línea se vuelven contactos automáticamente'] }
    },
    agenda: {
      en: { name: 'Online Scheduling', lead: 'Your own booking page, so clients schedule with you on their own.', feats: ['Personal booking link for your business', 'Weekly hours, breaks and days off', 'Automatic e-mail confirmations', 'Clients cancel with one click'] },
      pt: { name: 'Agenda Online', lead: 'Sua própria página de agendamento, para os clientes marcarem horário sozinhos.', feats: ['Link de agendamento próprio da sua empresa', 'Horários da semana, intervalos e folgas', 'Confirmações automáticas por e-mail', 'O cliente cancela com um clique'] },
      es: { name: 'Agenda en Línea', lead: 'Su propia página de citas, para que los clientes reserven solos.', feats: ['Enlace de citas propio de su empresa', 'Horarios semanales, pausas y días libres', 'Confirmaciones automáticas por correo', 'El cliente cancela con un clic'] }
    },
    esign: {
      en: { name: 'Electronic Signature', lead: 'Send PDFs for legally binding electronic signature.', feats: ['Upload a PDF and place the fields', 'Signature, initials, date and text fields', 'Audit certificate with document fingerprint', 'Signed copies saved in your portal'] },
      pt: { name: 'Assinatura Eletrônica', lead: 'Envie PDFs para assinatura eletrônica com validade jurídica.', feats: ['Suba o PDF e posicione os campos', 'Campos de assinatura, rubrica, data e texto', 'Certificado de auditoria com a impressão digital do documento', 'Cópias assinadas guardadas no seu portal'] },
      es: { name: 'Firma Electrónica', lead: 'Envíe PDF para firma electrónica con validez legal.', feats: ['Suba el PDF y coloque los campos', 'Campos de firma, iniciales, fecha y texto', 'Certificado de auditoría con la huella digital del documento', 'Copias firmadas guardadas en su portal'] }
    },
    bookkeeping: {
      en: { name: 'AI Bookkeeping', lead: 'Endeavor keeps your books, with AI doing the heavy lifting. You connect your accounts; our team does the work.', feats: ['Connect bank and card accounts securely', 'Transactions categorized by our team with AI', 'Profit and Loss, Balance Sheet and Cash Flow', 'Invite your accountant to see the reports'] },
      pt: { name: 'Bookkeeping com IA', lead: 'A Endeavor cuida da sua contabilidade, com a IA fazendo o trabalho pesado. Você conecta as contas; a nossa equipe faz o trabalho.', feats: ['Conecte contas bancárias e cartões com segurança', 'Transações categorizadas pela nossa equipe com IA', 'DRE (P&L), balanço patrimonial e fluxo de caixa', 'Convide o seu contador para ver os relatórios'] },
      es: { name: 'Bookkeeping con IA', lead: 'Endeavor lleva su contabilidad, con la IA haciendo el trabajo pesado. Usted conecta sus cuentas; nuestro equipo hace el trabajo.', feats: ['Conecte cuentas bancarias y tarjetas con seguridad', 'Transacciones categorizadas por nuestro equipo con IA', 'Estado de resultados, balance general y flujo de caja', 'Invite a su contador a ver los informes'] }
    },
    registered_agent: {
      en: { name: 'Registered Agent', lead: 'Florida registered agent at our Orlando office.', feats: ['Florida registered agent service', 'Official mail scanned to your portal', 'Annual report reminders'] },
      pt: { name: 'Registered Agent', lead: 'Registered agent na Flórida, no nosso escritório em Orlando.', feats: ['Serviço de registered agent na Flórida', 'Correspondência oficial digitalizada no seu portal', 'Lembretes do annual report'] },
      es: { name: 'Agente Registrado', lead: 'Agente registrado en Florida, en nuestra oficina de Orlando.', feats: ['Servicio de agente registrado en Florida', 'Correspondencia oficial digitalizada en su portal', 'Recordatorios del annual report'] }
    },
    virtual_address: {
      en: { name: 'Virtual Address', lead: 'A professional business address in Orlando, Florida.', feats: ['Business mailing address in Orlando, FL', 'Mail scanned and notified in your portal', 'Forwarding on request'] },
      pt: { name: 'Endereço Virtual', lead: 'Um endereço comercial profissional em Orlando, na Flórida.', feats: ['Endereço comercial em Orlando, FL', 'Correspondência digitalizada e avisada no seu portal', 'Reenvio sob pedido'] },
      es: { name: 'Dirección Virtual', lead: 'Una dirección comercial profesional en Orlando, Florida.', feats: ['Dirección comercial en Orlando, FL', 'Correspondencia digitalizada y avisada en su portal', 'Reenvío a pedido'] }
    }
  };
  var INT = { en: { month: '/month', year: '/year', once: 'one-time' }, pt: { month: '/mês', year: '/ano', once: 'pagamento único' }, es: { month: '/mes', year: '/año', once: 'pago único' } };
  function L(l) { return P.crm[l] ? l : 'en'; }
  window.EStore = {
    codes: Object.keys(P),
    info: function (code, lang) { var p = P[code]; return p ? p[L(lang)] : null; },
    money: function (cents) { return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 }); },
    interval: function (i, lang) { return (INT[L(lang)] || INT.en)[i] || ''; },
    loadCatalog: function (CFG) {
      return fetch(CFG.supabaseUrl + '/rest/v1/store_products?select=code,price_cents,interval,status,sort&order=sort', { headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey } })
        .then(function (r) { if (!r.ok) throw new Error('catalog'); return r.json(); });
    },
    loadStripe: function () {
      return new Promise(function (res, rej) {
        if (window.Stripe) return res(window.Stripe);
        var s = document.createElement('script'); s.src = 'https://js.stripe.com/v3/'; s.onload = function () { res(window.Stripe); }; s.onerror = rej; document.head.appendChild(s);
      });
    }
  };
})();
