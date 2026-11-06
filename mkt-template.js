/* Marketing e-mail templates. Shared by the admin console (preview) and the marketing function (sending),
   so what you see in the preview is exactly what is sent. Plain script: sets globalThis.EMkt. */
(function (G) {
  'use strict';
  var NAVY = '#0b1f3a', GOLD = '#c9a24a';
  // Endeavor brand facts used by every template (and given to the AI template writer)
  var BRAND = { name: 'Endeavor Business Solutions', site: 'https://endeavorbiz.com', email: 'support@endeavorbiz.com', phone: '+1 (407) 436-9567', whatsapp: '+1 (630) 689-8702', whatsappUrl: 'https://wa.me/16306898702', city: 'Orlando, FL' };
  // accent colours the AI may choose from (all pass contrast on navy and white)
  var ACCENTS = { gold: '#c9a24a', teal: '#2a9d8f', sky: '#4a90c9', emerald: '#3f9a6b', coral: '#d9734e' };
  var HI = { pt: ['Olá, {nome}!', 'Olá!'], en: ['Hi {nome},', 'Hello,'], es: ['¡Hola, {nome}!', '¡Hola!'] };
  var CONTACT = { pt: 'Fale com a gente', en: 'Talk to us', es: 'Hable con nosotros' };
  var T = {
    pt: {
      kicker: 'PROGRAMA DE PARCEIROS', subject: '{nome}, vamos crescer juntos? Programa de Parceiros da Endeavor',
      pre: 'Indique clientes, acompanhe cada etapa pelo seu portal e receba sua comissão automaticamente.',
      h1: 'Seja parceiro da Endeavor Business Solutions', hi: 'Olá, {nome}!', hiAnon: 'Olá!',
      intro: 'A Endeavor ajuda empreendedores e investidores estrangeiros a abrir e manter empresas nos Estados Unidos: abertura de LLC e corporações, compliance, coordenação fiscal, conta bancária, imóveis e family office. Se os seus clientes precisam disso, podemos crescer juntos.',
      benefitsTitle: 'Por que ser parceiro',
      benefits: [['Comissão em cada indicação', 'Você ganha sobre os serviços contratados pelos clientes que indicar. Sem custo e sem meta mínima.'], ['Pagamento automático', 'Conecte sua conta Stripe uma vez e a sua parte cai direto na sua conta quando o cliente paga.'], ['Seu próprio portal', 'Envie indicações, acompanhe cada cliente etapa por etapa e veja o que já recebeu e o que vai receber.'], ['Atendimento completo', 'Nossa equipe cuida de todo o processo do cliente, em português, inglês ou espanhol, e mantém você informado.']],
      howTitle: 'Como começar', how: [['Converse com a gente', 'Uma conversa rápida para conhecer o seu trabalho e os seus clientes.'], ['Receba seu acesso', 'Você recebe o convite para o Portal do Parceiro.'], ['Indique e receba', 'Indique clientes pelo portal e receba a comissão via Stripe a cada pagamento.']],
      cta: 'Quero ser parceiro', questions: 'Prefere conversar antes? Responda este e-mail ou fale com a gente pelo WhatsApp.', sign: 'Equipe Endeavor Business Solutions',
      why: 'Você recebe este e-mail porque o seu contato profissional está na nossa lista de possíveis parceiros.', whyGen: 'Você recebe este e-mail porque o seu contato profissional está na lista de contatos da Endeavor Business Solutions.', unsub: 'Não quero mais receber estes e-mails'
    },
    en: {
      kicker: 'PARTNER PROGRAM', subject: "{nome}, let's grow together: Endeavor Partner Program",
      pre: 'Refer clients, follow every step in your own portal and get your commission automatically.',
      h1: 'Become an Endeavor Business Solutions partner', hi: 'Hi {nome},', hiAnon: 'Hello,',
      intro: 'Endeavor helps foreign entrepreneurs and investors open and run companies in the United States: LLC and corporation formation, compliance, tax coordination, banking, real estate and family office. If your clients need this, we can grow together.',
      benefitsTitle: 'Why partner with us',
      benefits: [['A commission on every referral', 'You earn on the services bought by the clients you refer. No cost and no minimum targets.'], ['Automatic payouts', 'Connect your Stripe account once and your share goes straight to your account when the client pays.'], ['Your own portal', 'Send referrals, follow each client step by step and see what you have earned and what is coming.'], ['Full-service support', 'Our team handles the whole process for your client, in English, Portuguese or Spanish, and keeps you informed.']],
      howTitle: 'How to start', how: [['Talk to us', 'A quick call to learn about your work and your clients.'], ['Get your access', 'You receive the invitation to the Partner Portal.'], ['Refer and get paid', 'Refer clients in the portal and receive your commission through Stripe with every payment.']],
      cta: 'I want to be a partner', questions: 'Prefer to talk first? Reply to this email or reach us on WhatsApp.', sign: 'The Endeavor Business Solutions team',
      why: 'You are receiving this email because your business contact is on our list of potential partners.', whyGen: 'You are receiving this email because your business contact is on the Endeavor Business Solutions contact list.', unsub: 'Unsubscribe from these emails'
    },
    es: {
      kicker: 'PROGRAMA DE SOCIOS', subject: '{nome}, ¿crecemos juntos? Programa de Socios de Endeavor',
      pre: 'Recomiende clientes, siga cada etapa en su propio portal y reciba su comisión automáticamente.',
      h1: 'Sea socio de Endeavor Business Solutions', hi: '¡Hola, {nome}!', hiAnon: '¡Hola!',
      intro: 'Endeavor ayuda a emprendedores e inversionistas extranjeros a abrir y mantener empresas en Estados Unidos: constitución de LLC y corporaciones, cumplimiento, coordinación fiscal, cuenta bancaria, bienes raíces y family office. Si sus clientes lo necesitan, podemos crecer juntos.',
      benefitsTitle: 'Por qué ser socio',
      benefits: [['Comisión por cada recomendación', 'Usted gana sobre los servicios que contraten los clientes que recomiende. Sin costo y sin metas mínimas.'], ['Pago automático', 'Conecte su cuenta Stripe una vez y su parte llega directo a su cuenta cuando el cliente paga.'], ['Su propio portal', 'Envíe recomendaciones, siga cada cliente paso a paso y vea lo que ya recibió y lo que va a recibir.'], ['Atención completa', 'Nuestro equipo se encarga de todo el proceso del cliente, en español, inglés o portugués, y lo mantiene informado.']],
      howTitle: 'Cómo empezar', how: [['Hable con nosotros', 'Una conversación rápida para conocer su trabajo y sus clientes.'], ['Reciba su acceso', 'Usted recibe la invitación al Portal de Socios.'], ['Recomiende y reciba', 'Recomiende clientes en el portal y reciba la comisión por Stripe con cada pago.']],
      cta: 'Quiero ser socio', questions: '¿Prefiere conversar antes? Responda este correo o escríbanos por WhatsApp.', sign: 'Equipo de Endeavor Business Solutions',
      why: 'Recibe este correo porque su contacto profesional está en nuestra lista de posibles socios.', whyGen: 'Recibe este correo porque su contacto profesional está en la lista de contactos de Endeavor Business Solutions.', unsub: 'No quiero recibir más estos correos'
    }
  };
  var CUSTOM_FOOT = { pt: T.pt, en: T.en, es: T.es };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function first(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }
  function merge(s, ct) {
    var n = first(ct && ct.name), co = (ct && ct.company) || '';
    return String(s || '').replace(/\{\{?\s*(nome|name|nombre)\s*\}?\}/gi, n).replace(/\{\{?\s*(empresa|company)\s*\}?\}/gi, co)
      .replace(/^\s*,\s*/, '').replace(/\s+,/g, ',').replace(/,\s*([!?.:])/g, '$1');
  }
  function withLang(u, lang) { if (!u || u === '#') return u || '#'; return /[?&]lang=/.test(u) ? u : u + (u.indexOf('?') > -1 ? '&' : '?') + 'lang=' + lang; }
  function langOf(c, ct) { var l = c.language === 'auto' ? (ct && ct.language) : c.language; return l === 'en' || l === 'es' ? l : 'pt'; }

  function button(href, label, bg, fg) {
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr><td style="border-radius:10px;background:' + bg + '"><a href="' + esc(href) + '" style="display:inline-block;padding:15px 28px;font:700 15px Arial,sans-serif;color:' + fg + ';text-decoration:none;border-radius:10px">' + esc(label) + '</a></td></tr></table>';
  }
  function shell(o) {
    return '<!doctype html><html lang="' + (o.lang === 'pt' ? 'pt-BR' : o.lang) + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(o.subject) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#eef1f6"><div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(o.pre || '') + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:28px 12px"><tr><td align="center">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e7ee">' +
      '<tr><td style="padding:24px 32px;border-bottom:1px solid #eef0f4"><img src="' + o.site + '/logo-endeavor-3000px.png" alt="Endeavor Business Solutions" width="200" style="display:block;width:200px;height:auto;border:0"></td></tr>' +
      o.body +
      '<tr><td style="padding:18px 32px;background:#f7f8fb;border-top:1px solid #eef0f4;font:12px/1.6 Arial,sans-serif;color:#6b7280">' + esc(o.why) + '<br>' + esc(o.address) +
      ' · <a href="mailto:' + esc(o.replyTo) + '" style="color:#6b7280">' + esc(o.replyTo) + '</a><br><a href="' + esc(o.unsubUrl) + '" data-unsub="1" style="color:#6b7280;text-decoration:underline">' + esc(o.unsub) + '</a></td></tr>' +
      '</table></td></tr></table>' + (o.pixel ? '<img src="' + esc(o.pixel) + '" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">' : '') + '</body></html>';
  }

  /* render(campaign, contact, opts) -> { subject, html, text, urls }
     opts: { site, address, replyTo, unsubUrl, pixel, track(i, url) -> tracked url } */
  function render(c, ct, o) {
    o = o || {};
    var lang = langOf(c, ct), t = T[lang], site = (o.site || 'https://endeavorbiz.com').replace(/\/$/, '');
    var n = first(ct && ct.name);
    var btnUrl = c.button_url || (site + '/schedule.html?lang=' + lang);
    var subject, pre, body, textParts;
    if (c.template === 'custom') {
      subject = merge(c.subject || '', ct); pre = merge(c.preheader || '', ct);
      var paras = merge(c.body || '', ct).split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
      body = '<tr><td style="background:' + NAVY + ';padding:36px 32px 32px"><div style="font:700 26px/1.25 Georgia,serif;color:#ffffff">' + esc(merge(c.heading || subject, ct)) + '</div>' +
        (pre ? '<div style="font:16px/1.6 Arial,sans-serif;color:#d6deea;margin:12px 0 0">' + esc(pre) + '</div>' : '') + '</td></tr>' +
        '<tr><td style="padding:30px 32px 10px;font:16px/1.65 Arial,sans-serif;color:#1f2937">' + paras.map(function (p) { return '<p style="margin:0 0 14px">' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join('') + '</td></tr>' +
        (c.button_label ? '<tr><td align="center" style="padding:6px 32px 30px">' + button(btnUrl, merge(c.button_label, ct), NAVY, '#ffffff') + '</td></tr>' : '');
      textParts = [merge(c.heading || subject, ct), ''].concat(paras).concat(c.button_label ? ['', merge(c.button_label, ct) + ': ' + btnUrl] : []);
    } else if (c.template === 'ai' && c.tpl_data) {
      var D = c.tpl_data, d = D[lang] || D[(D.languages || [])[0]] || D.pt || D.en || D.es || {};
      var AC = ACCENTS[(D.style || {}).accent] || GOLD, light = (D.style || {}).hero === 'light';
      subject = merge(c.subject || d.subject || '', ct); pre = merge(c.preheader || d.preheader || '', ct);
      var label = merge(c.button_label || d.cta || '', ct), head = merge(c.heading || d.heading || subject, ct);
      if (D.button_url && !c.button_url && /^https:\/\//.test(D.button_url)) btnUrl = D.button_url;
      var paraHtml = function (txt) { return merge(txt || '', ct).split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) { return '<p style="margin:0 0 12px">' + esc(p).replace(/\n/g, '<br>') + '</p>'; }).join(''); };
      var secHtml = function (sec) {
        var items = (sec.items || []).slice(0, 6), title = sec.title ? '<div style="font:700 20px/1.3 Georgia,serif;color:' + NAVY + ';margin:0 0 14px">' + esc(merge(sec.title, ct)) + '</div>' : '';
        if (sec.type === 'cards' && items.length) {
          var card = function (b) { return '<td width="50%" valign="top" style="padding:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;border-radius:12px;border:1px solid #e6e9f0"><tr><td style="padding:18px 18px 16px"><div style="width:34px;height:4px;background:' + AC + ';border-radius:2px;margin:0 0 12px"></div><div style="font:700 16px/1.3 Georgia,serif;color:' + NAVY + ';margin:0 0 6px">' + esc(merge(b.title, ct)) + '</div><div style="font:14px/1.55 Arial,sans-serif;color:#4b5563">' + esc(merge(b.text, ct)) + '</div></td></tr></table></td>'; };
          var rows = []; for (var k = 0; k < items.length; k += 2) rows.push('<tr>' + card(items[k]) + (items[k + 1] ? card(items[k + 1]) : '<td width="50%"></td>') + '</tr>');
          return '<tr><td style="padding:16px 24px 8px"><div style="padding:0 8px">' + title + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rows.join('') + '</table></td></tr>';
        }
        if (sec.type === 'steps' && items.length) return '<tr><td style="padding:22px 32px 6px">' + title + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + items.map(function (it, i) { return '<tr><td valign="top" width="44" style="padding:0 0 16px"><div style="width:32px;height:32px;border-radius:16px;background:' + NAVY + ';color:#fff;font:700 15px/32px Arial,sans-serif;text-align:center">' + (i + 1) + '</div></td><td valign="top" style="padding:3px 0 16px;font:15px/1.5 Arial,sans-serif;color:#1f2937"><strong style="color:' + NAVY + '">' + esc(merge(it.title, ct)) + '</strong><br>' + esc(merge(it.text, ct)) + '</td></tr>'; }).join('') + '</table></td></tr>';
        if (sec.type === 'list' && items.length) return '<tr><td style="padding:18px 32px 6px">' + title + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + items.map(function (it) { return '<tr><td valign="top" width="26" style="padding:2px 0 12px;font:700 16px Arial,sans-serif;color:' + AC + '">&#10003;</td><td style="padding:0 0 12px;font:15px/1.55 Arial,sans-serif;color:#1f2937">' + (it.title ? '<strong style="color:' + NAVY + '">' + esc(merge(it.title, ct)) + '</strong>' + (it.text ? ' ' : '') : '') + esc(merge(it.text || '', ct)) + '</td></tr>'; }).join('') + '</table></td></tr>';
        if (sec.type === 'highlight') return '<tr><td style="padding:16px 32px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;border-left:4px solid ' + AC + ';border-radius:8px"><tr><td style="padding:18px 20px;font:16px/1.6 Arial,sans-serif;color:#1f2937">' + (sec.title ? '<div style="font:700 17px/1.3 Georgia,serif;color:' + NAVY + ';margin:0 0 6px">' + esc(merge(sec.title, ct)) + '</div>' : '') + esc(merge(sec.text || '', ct)) + '</td></tr></table></td></tr>';
        return '<tr><td style="padding:16px 32px 4px;font:16px/1.65 Arial,sans-serif;color:#1f2937">' + title + paraHtml(sec.text) + '</td></tr>';
      };
      var hi = HI[lang] || HI.pt, CT = CONTACT[lang] || CONTACT.pt;
      var heroBg = light ? '#f3f5f9' : NAVY, heroInk = light ? NAVY : '#ffffff', heroSub = light ? '#4b5563' : '#d6deea';
      body = '<tr><td style="background:' + heroBg + ';padding:40px 32px 36px;border-bottom:' + (light ? '4px solid ' + AC : '0') + '">' + (d.kicker ? '<div style="font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;color:' + AC + ';margin:0 0 14px">' + esc(String(merge(d.kicker, ct)).toUpperCase()) + '</div>' : '') +
        '<div style="font:700 27px/1.25 Georgia,serif;color:' + heroInk + ';margin:0 0 14px">' + esc(head) + '</div>' + (pre ? '<div style="font:16px/1.6 Arial,sans-serif;color:' + heroSub + '">' + esc(pre) + '</div>' : '') +
        (label ? '<div style="margin:26px 0 0">' + button(btnUrl, label, light ? NAVY : AC, light ? '#ffffff' : NAVY).replace('margin:0 auto', 'margin:0') + '</div>' : '') + '</td></tr>' +
        '<tr><td style="padding:32px 32px 4px;font:16px/1.65 Arial,sans-serif;color:#1f2937"><p style="margin:0 0 12px;font-weight:700;color:' + NAVY + '">' + esc(n ? hi[0].replace('{nome}', n) : hi[1]) + '</p>' + paraHtml(c.body || d.intro) + '</td></tr>' +
        (d.sections || []).slice(0, 6).map(secHtml).join('') +
        (label ? '<tr><td align="center" style="padding:14px 32px 14px">' + button(btnUrl, label, NAVY, '#ffffff') + '</td></tr>' : '') +
        '<tr><td style="padding:14px 32px 30px;font:15px/1.6 Arial,sans-serif;color:#1f2937">' + paraHtml(d.closing) +
        '<p style="margin:10px 0 0;font-weight:700;color:' + NAVY + '">' + esc(d.sign || (lang === 'en' ? 'The Endeavor Business Solutions team' : lang === 'es' ? 'Equipo de Endeavor Business Solutions' : 'Equipe Endeavor Business Solutions')) + '</p>' +
        '<p style="margin:12px 0 0;font:13px/1.6 Arial,sans-serif;color:#4b5563">' + esc(CT) + ': <a href="' + BRAND.whatsappUrl + '" style="color:' + NAVY + '">WhatsApp ' + BRAND.whatsapp + '</a> · ' + BRAND.phone + ' · <a href="mailto:' + BRAND.email + '" style="color:' + NAVY + '">' + BRAND.email + '</a></p></td></tr>';
      textParts = [n ? hi[0].replace('{nome}', n) : hi[1], '', head, ''].concat(merge(c.body || d.intro || '', ct).split(/\n\s*\n/))
        .concat((d.sections || []).map(function (sec) { return '\n' + (sec.title ? merge(sec.title, ct).toUpperCase() + '\n' : '') + (sec.items || []).map(function (it, i) { return (sec.type === 'steps' ? (i + 1) + '. ' : '- ') + merge(it.title || '', ct) + (it.title && it.text ? ': ' : '') + merge(it.text || '', ct); }).join('\n') + (sec.text ? merge(sec.text, ct) : ''); }))
        .concat(label ? ['', label + ': ' + btnUrl] : []).concat(['', merge(d.closing || '', ct), CT + ': WhatsApp ' + BRAND.whatsapp + ' · ' + BRAND.phone + ' · ' + BRAND.email]);
    } else {
      subject = merge(c.subject || t.subject.replace('{nome}', n || ''), ct).replace(/^\s*,\s*/, '');
      if (!n) subject = subject.charAt(0).toUpperCase() + subject.slice(1);
      pre = merge(c.preheader || t.pre, ct);
      var cta = merge(c.button_label || t.cta, ct);
      var benefit = function (b) { return '<td width="50%" valign="top" style="padding:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;border-radius:12px;border:1px solid #e6e9f0"><tr><td style="padding:18px 18px 16px"><div style="width:34px;height:4px;background:' + GOLD + ';border-radius:2px;margin:0 0 12px"></div><div style="font:700 16px/1.3 Georgia,serif;color:' + NAVY + ';margin:0 0 6px">' + esc(b[0]) + '</div><div style="font:14px/1.55 Arial,sans-serif;color:#4b5563">' + esc(b[1]) + '</div></td></tr></table></td>'; };
      var steps = t.how.map(function (s, i) { return '<tr><td valign="top" width="44" style="padding:0 0 16px"><div style="width:32px;height:32px;border-radius:16px;background:' + NAVY + ';color:#fff;font:700 15px/32px Arial,sans-serif;text-align:center">' + (i + 1) + '</div></td><td valign="top" style="padding:3px 0 16px;font:15px/1.5 Arial,sans-serif;color:#1f2937"><strong style="color:' + NAVY + '">' + esc(s[0]) + '</strong><br>' + esc(s[1]) + '</td></tr>'; }).join('');
      var intro = c.body ? merge(c.body, ct) : t.intro;
      body = '<tr><td style="background:' + NAVY + ';padding:40px 32px 36px"><div style="font:700 12px/1 Arial,sans-serif;letter-spacing:.14em;color:' + GOLD + ';margin:0 0 14px">' + esc(t.kicker) + '</div>' +
        '<div style="font:700 27px/1.25 Georgia,serif;color:#ffffff;margin:0 0 14px">' + esc(merge(c.heading || t.h1, ct)) + '</div><div style="font:16px/1.6 Arial,sans-serif;color:#d6deea">' + esc(pre) + '</div>' +
        '<div style="margin:26px 0 0">' + button(btnUrl, cta, GOLD, NAVY).replace('margin:0 auto', 'margin:0') + '</div></td></tr>' +
        '<tr><td style="padding:32px 32px 8px;font:16px/1.65 Arial,sans-serif;color:#1f2937"><p style="margin:0 0 12px;font-weight:700;color:' + NAVY + '">' + esc(n ? t.hi.replace('{nome}', n) : t.hiAnon) + '</p>' +
        intro.split(/\n\s*\n/).map(function (p) { return '<p style="margin:0 0 12px">' + esc(p.trim()) + '</p>'; }).join('') + '</td></tr>' +
        '<tr><td style="padding:16px 24px 8px"><div style="font:700 20px/1.3 Georgia,serif;color:' + NAVY + ';padding:0 8px 8px">' + esc(t.benefitsTitle) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        [t.benefits.slice(0, 2), t.benefits.slice(2, 4)].map(function (r) { return '<tr>' + r.map(benefit).join('') + '</tr>'; }).join('') + '</table></td></tr>' +
        '<tr><td style="padding:22px 32px 6px"><div style="font:700 20px/1.3 Georgia,serif;color:' + NAVY + ';margin:0 0 16px">' + esc(t.howTitle) + '</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + steps + '</table></td></tr>' +
        '<tr><td align="center" style="padding:8px 32px 14px">' + button(btnUrl, cta, NAVY, '#ffffff') + '</td></tr>' +
        '<tr><td style="padding:18px 32px 30px;font:15px/1.6 Arial,sans-serif;color:#1f2937"><p style="margin:0 0 8px">' + esc(t.questions) + '</p><p style="margin:0;font-weight:700;color:' + NAVY + '">' + esc(t.sign) + '</p></td></tr>';
      textParts = [n ? t.hi.replace('{nome}', n) : t.hiAnon, '', merge(c.heading || t.h1, ct), '', intro, '', t.benefitsTitle.toUpperCase()]
        .concat(t.benefits.map(function (b) { return '- ' + b[0] + ': ' + b[1]; })).concat(['', t.howTitle.toUpperCase()])
        .concat(t.how.map(function (s, i) { return (i + 1) + '. ' + s[0] + ': ' + s[1]; })).concat(['', cta + ': ' + btnUrl, '', t.questions, t.sign]);
    }
    var foot = CUSTOM_FOOT[lang];
    var html = shell({ lang: lang, subject: subject, pre: pre, body: body, site: site, why: c.template === 'partners' ? foot.why : foot.whyGen, unsub: foot.unsub, address: o.address || 'Endeavor Business Solutions · Orlando, FL, USA',
      replyTo: o.replyTo || 'support@endeavorbiz.com', unsubUrl: withLang(o.unsubUrl, lang), pixel: o.pixel });
    // click tracking: every https link except the unsubscribe link goes through the tracker (by position)
    var urls = [];
    html = html.replace(/<a href="(https:\/\/[^"]+)"(?![^>]*data-unsub)/g, function (m, href) {
      var raw = href.replace(/&amp;/g, '&'), i = urls.indexOf(raw); if (i < 0) { urls.push(raw); i = urls.length - 1; }
      return o.track ? '<a href="' + esc(o.track(i, raw)) + '"' : m;
    });
    var text = textParts.join('\n') + '\n\n--\n' + (c.template === 'partners' ? foot.why : foot.whyGen) + '\n' + (o.address || '') + '\n' + foot.unsub + ': ' + withLang(o.unsubUrl, lang);
    return { subject: subject, html: html, text: text, urls: urls, language: lang };
  }
  G.EMkt = { render: render, texts: T, langOf: langOf, brand: BRAND, accents: ACCENTS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
