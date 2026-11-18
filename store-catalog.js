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
    pkg_essencial: {
      en: { name: 'Essential Formation Package', lead: 'The formation of your LLC with what the law and the banks ask for.', feats: ['LLC formation (single member or with partners)', 'EIN (federal tax ID)', 'Registered agent', 'Business address', 'Mailing address with mail management', 'Client Portal to manage your company'] },
      pt: { name: 'Pacote Essencial de Abertura', lead: 'A abertura da sua LLC com o que a lei e os bancos pedem.', feats: ['Abertura da LLC (single member ou com sócios)', 'EIN (o CNPJ americano)', 'Registered agent', 'Endereço comercial', 'Endereço de correspondência com gestão das cartas', 'Portal do Cliente para gerenciar a sua empresa'] },
      es: { name: 'Paquete Esencial de Apertura', lead: 'La apertura de su LLC con lo que piden la ley y los bancos.', feats: ['Apertura de la LLC (un solo miembro o con socios)', 'EIN (identificación fiscal federal)', 'Agente registrado', 'Dirección comercial', 'Dirección postal con gestión de la correspondencia', 'Portal del Cliente para gestionar su empresa'] }
    },
    pkg_completo: {
      en: { name: 'Complete Formation Package', lead: 'Your company open and running, with books and a U.S. phone number.', feats: ['LLC formation (single member or with partners)', 'EIN (federal tax ID)', 'Registered agent', 'Business and mailing addresses with mail management', 'Operating Agreement', 'AI Bookkeeping', 'U.S. business phone number', 'Client Portal to manage your company'] },
      pt: { name: 'Pacote Completo de Abertura', lead: 'Sua empresa aberta e funcionando, com contabilidade e número de telefone americano.', feats: ['Abertura da LLC (single member ou com sócios)', 'EIN (o CNPJ americano)', 'Registered agent', 'Endereço comercial e de correspondência com gestão das cartas', 'Operating Agreement', 'Bookkeeping com IA', 'Número de telefone comercial americano', 'Portal do Cliente para gerenciar a sua empresa'] },
      es: { name: 'Paquete Completo de Apertura', lead: 'Su empresa abierta y funcionando, con contabilidad y número de teléfono estadounidense.', feats: ['Apertura de la LLC (un solo miembro o con socios)', 'EIN (identificación fiscal federal)', 'Agente registrado', 'Dirección comercial y postal con gestión de la correspondencia', 'Operating Agreement', 'Bookkeeping con IA', 'Número de teléfono comercial en EE. UU.', 'Portal del Cliente para gestionar su empresa'] }
    },
    operating_agreement: {
      en: { name: 'Operating Agreement', lead: 'The internal agreement of your LLC: who the owners are, how decisions are made and what happens if someone leaves.', feats: ['Ownership and roles of each member', 'Rules for decisions and profit distribution', 'Often requested by banks', 'Helps keep your personal assets separate from the company'] },
      pt: { name: 'Operating Agreement', lead: 'O contrato interno da sua LLC: quem são os donos, como as decisões são tomadas e o que acontece se alguém sair.', feats: ['Participação e papel de cada sócio', 'Regras para decisões e distribuição de lucros', 'Bancos costumam pedir', 'Ajuda a separar o seu patrimônio pessoal do da empresa'] },
      es: { name: 'Operating Agreement', lead: 'El acuerdo interno de su LLC: quiénes son los dueños, cómo se toman las decisiones y qué pasa si alguien sale.', feats: ['Participación y rol de cada socio', 'Reglas para decisiones y reparto de utilidades', 'Los bancos suelen pedirlo', 'Ayuda a separar su patrimonio personal del de la empresa'] }
    },
    telefone: {
      en: { name: 'Business Phone', lead: 'A U.S. number for your company that you answer in the app, on your phone or computer, from anywhere.', feats: ['Local U.S. number', '500 minutes and 250 text messages per month', 'Greeting, business hours and voicemail', 'Answer in the browser or in the Endeavor Phone app'] },
      pt: { name: 'Telefone Comercial', lead: 'Um número americano para a sua empresa, que você atende pelo app, no celular ou no computador, de qualquer lugar.', feats: ['Número local dos EUA', '500 minutos e 250 SMS por mês', 'Saudação, horário de atendimento e caixa postal', 'Atenda pelo navegador ou pelo app Endeavor Phone'] },
      es: { name: 'Teléfono Comercial', lead: 'Un número de EE. UU. para su empresa, que usted atiende en la app, en el celular o la computadora, desde cualquier lugar.', feats: ['Número local de EE. UU.', '500 minutos y 250 SMS por mes', 'Saludo, horario de atención y buzón de voz', 'Atienda en el navegador o en la app Endeavor Phone'] }
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
      return fetch(CFG.supabaseUrl + '/rest/v1/store_products?select=code,kind,price_cents,setup_cents,member_cents,category,interval,status,sort&order=sort', { headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey } })
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
