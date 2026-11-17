/* My WhatsApp Manager · regras compartilhadas (extensão e servidor; cópia idêntica em supabase/whatsapp/core.js).
 * Ajustes com limites seguros, tempos humanos (espera, digitação, pausa), leitura das mensagens do WhatsApp Web,
 * remoção de números sensíveis e o controle de ritmo do IA Takeover. Sem DOM aqui: tudo testável. */
(function (raiz) {
  'use strict';

  var PADRAO = {
    takeover: true,              // chave geral do IA Takeover (o admin e o painel podem desligar)
    takeover_individual: true,   // conversas individuais novas já entram com o Takeover ligado
    espera_min: 4, espera_max: 12,   // segundos antes de começar a digitar
    velocidade: 220,             // caracteres por minuto (digitação visível)
    variacao: 20,                // % de variação aleatória na velocidade
    pausa_min: 3, pausa_max: 8,  // segundos de pausa depois de enviar
    digitar_max: 45,             // segundos no máximo digitando uma mensagem
    limite_hora: 20,             // respostas automáticas por hora (todas as conversas)
    grupo_intervalo: 10,         // minutos entre respostas automáticas no mesmo grupo
    texto_aviso: 'Olá! Aqui é o assistente virtual da Endeavor.',
    idioma: 'pt-BR',
    negocio: 'Endeavor Business Solutions (Orlando, FL): abertura de empresas nos EUA (LLC e corporação), Operating Agreement, EIN, bookkeeping e contabilidade, conta bancária empresarial (orientação), marketing, sites e projetos de IA. Atendimento em português, inglês e espanhol.',
    link_agenda: 'https://endeavorbiz.com/booking.html',
    horario: { ativo: false, inicio: '08:00', fim: '20:00', tz: 'America/New_York' },
    prontas: [
      { titulo: 'Saudação', texto: 'Olá! Obrigado por falar com a Endeavor Business Solutions. Como posso ajudar?' },
      { titulo: 'Marcar conversa', texto: 'Podemos marcar uma conversa rápida com a nossa equipe. Escolha o melhor horário aqui: https://endeavorbiz.com/booking.html' },
      { titulo: 'Retorno', texto: 'Recebi sua mensagem e já vou verificar. Retorno em breve.' }
    ]
  };

  function num(v, min, max, pad) { var n = Number(v); if (!isFinite(n)) return pad; return Math.min(max, Math.max(min, Math.round(n * 10) / 10)); }
  function txt(v, max, pad) { var s = String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim(); return (s || pad || '').slice(0, max); }
  function hhmm(v, pad) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : pad; }

  /** Ajustes sempre dentro de limites seguros (min ≤ max, ritmo humano). */
  function limparAjustes(a) {
    a = a || {};
    var o = {};
    o.takeover = a.takeover === undefined ? PADRAO.takeover : a.takeover === true;
    o.takeover_individual = a.takeover_individual === undefined ? PADRAO.takeover_individual : a.takeover_individual === true;
    o.espera_min = num(a.espera_min, 1, 300, PADRAO.espera_min);
    o.espera_max = num(a.espera_max, 1, 600, PADRAO.espera_max);
    if (o.espera_max < o.espera_min) o.espera_max = o.espera_min;
    o.velocidade = num(a.velocidade, 80, 400, PADRAO.velocidade); // acima de ~400 car/min a digitação parece de robô
    o.variacao = num(a.variacao, 0, 50, PADRAO.variacao);
    o.pausa_min = num(a.pausa_min, 0, 300, PADRAO.pausa_min);
    o.pausa_max = num(a.pausa_max, 0, 600, PADRAO.pausa_max);
    if (o.pausa_max < o.pausa_min) o.pausa_max = o.pausa_min;
    o.digitar_max = num(a.digitar_max, 5, 180, PADRAO.digitar_max);
    o.limite_hora = Math.round(num(a.limite_hora, 1, 120, PADRAO.limite_hora));
    o.grupo_intervalo = num(a.grupo_intervalo, 1, 1440, PADRAO.grupo_intervalo);
    o.texto_aviso = txt(a.texto_aviso, 200, PADRAO.texto_aviso);
    o.idioma = /^[a-z]{2}(-[A-Z]{2})?$/.test(String(a.idioma || '')) ? a.idioma : PADRAO.idioma;
    o.negocio = txt(a.negocio, 3000, PADRAO.negocio);
    o.link_agenda = a.link_agenda === '' ? '' : /^https:\/\/[^\s<>"]{4,300}$/.test(String(a.link_agenda || '')) ? a.link_agenda : PADRAO.link_agenda; // vazio: empresa sem página de agendamento
    var h = a.horario || {};
    o.horario = { ativo: h.ativo === true, inicio: hhmm(h.inicio, PADRAO.horario.inicio), fim: hhmm(h.fim, PADRAO.horario.fim), tz: txt(h.tz, 64, PADRAO.horario.tz) };
    var pr = Array.isArray(a.prontas) ? a.prontas : PADRAO.prontas;
    o.prontas = pr.slice(0, 40).map(function (p) { return { titulo: txt(p && p.titulo, 60, 'Resposta'), texto: txt(p && p.texto, 1500, '') }; }).filter(function (p) { return p.texto; });
    return o;
  }

  function entre(min, max, rnd) { rnd = rnd || Math.random; return (min + (max - min) * rnd()) * 1000; }
  /** Espera antes de digitar e pausa depois de enviar (ms, aleatório entre min e max). */
  function espera(a, rnd) { return Math.round(entre(a.espera_min, a.espera_max, rnd)); }
  function pausa(a, rnd) { return Math.round(entre(a.pausa_min, a.pausa_max, rnd)); }

  /** Intervalos (ms) entre cada caractere digitado: velocidade com variação, pausas maiores na pontuação e no espaço.
   *  Se o total passar de digitar_max, acelera por igual para caber. */
  function ritmoDigitacao(texto, a, rnd) {
    rnd = rnd || Math.random;
    var base = 60000 / a.velocidade, v = a.variacao / 100, out = [], total = 0;
    for (var i = 0; i < texto.length; i++) {
      var c = texto[i], ms = base * (1 + (rnd() * 2 - 1) * v);
      if (/[.!?]/.test(c)) ms += base * 4; else if (/[,;:]/.test(c)) ms += base * 2; else if (c === ' ') ms += base * 0.4; else if (c === '\n') ms += base * 3;
      ms = Math.max(8, ms); out.push(ms); total += ms;
    }
    var lim = a.digitar_max * 1000;
    if (total > lim) { var f = lim / total; out = out.map(function (x) { return Math.max(4, x * f); }); }
    return out.map(Math.round);
  }
  function tempoDigitacao(texto, a, rnd) { return ritmoDigitacao(texto, a, rnd).reduce(function (s, x) { return s + x; }, 0); }

  /** "false_5511999990000@c.us_3EB0..." → { eu:false, chave:'5511999990000@c.us', grupo:false } */
  function lerDataId(id) {
    var m = /^(true|false)_([^_]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|newsletter))_/.exec(String(id || ''));
    if (!m) return null;
    return { eu: m[1] === 'true', chave: m[2], grupo: /@g\.us$/.test(m[2]) };
  }
  /** data-pre-plain-text="[10:15, 11/16/2026] Maria: " → { hora:'10:15', data:'11/16/2026', autor:'Maria' } */
  function lerPrePlain(s) {
    var m = /^\[([^,\]]+),\s*([^\]]+)\]\s*(.*?):\s*$/.exec(String(s || ''));
    return m ? { hora: m[1].trim(), data: m[2].trim(), autor: m[3].trim() } : null;
  }

  // números que nunca vão para a IA nem para o registro: SSN/ITIN, cartões (Luhn) e números depois de "conta", "routing", "passaporte"…
  var RE_SSN = /\b\d{3}[- ]\d{2}[- ]\d{4}\b/g;
  var RE_CARTAO = /\b(?:\d[ -]?){13,19}\b/g;
  var RE_ROTULO = /\b(ssn|itin|social security|passaporte|passport|routing|aba|conta(?: corrente| banc[aá]ria)?|account(?: number)?|ag[eê]ncia|iban|cpf)\b(\s*(?:n[ºo°.]*|#|:|number|é|is)?\s*)([A-Z0-9][A-Z0-9 .\-]{4,24}\d)/gi;
  function luhn(d) { var s = 0, alt = false; for (var i = d.length - 1; i >= 0; i--) { var n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } s += n; alt = !alt; } return s % 10 === 0; }
  function limparSensivel(texto) {
    var t = String(texto || ''), achou = false;
    t = t.replace(RE_ROTULO, function (_, r, sep) { achou = true; return r + sep + '[número removido]'; });
    t = t.replace(RE_SSN, function () { achou = true; return '[número removido]'; });
    t = t.replace(RE_CARTAO, function (m) { var d = m.replace(/\D/g, ''); if (d.length >= 13 && luhn(d)) { achou = true; return '[número removido]'; } return m; });
    return { texto: t, removido: achou };
  }

  /** Mensagens para a IA: as últimas N, sem números sensíveis, no formato "EU: ..." / "Nome: ...". */
  function montarConversa(msgs, max) {
    max = max || 30;
    return (msgs || []).filter(function (m) { return m && m.texto; }).slice(-max).map(function (m) {
      var quem = m.eu ? 'EU' : (m.autor || 'Contato');
      return (m.hora ? '[' + m.hora + '] ' : '') + String(quem).slice(0, 60) + ': ' + limparSensivel(String(m.texto).slice(0, 1500)).texto;
    }).join('\n');
  }

  /** Assinatura da última mensagem recebida: o Takeover responde uma vez por mensagem nova. */
  function ultimaRecebida(msgs) {
    for (var i = (msgs || []).length - 1; i >= 0; i--) { var m = msgs[i]; if (m.eu) return null; if (m.texto || m.midia) return m; }
    return null;
  }

  /** A hora da mensagem ("10:15", "10:15 PM") é de agora (até `min` minutos atrás)? Serve para não responder mensagens antigas. */
  function recente(hora, agora, min) {
    var m = /^(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?\s*[Mm]\.?)?$/.exec(String(hora || '').trim()); if (!m) return false;
    var h = +m[1] % 24, mi = +m[2];
    if (m[3]) { h = h % 12; if (/p/i.test(m[3])) h += 12; }
    agora = agora || new Date();
    var diff = ((agora.getHours() * 60 + agora.getMinutes()) - (h * 60 + mi) + 1440) % 1440;
    return diff <= (min == null ? 3 : min);
  }

  /** Está dentro do horário de atendimento? (sem horário ativo: sempre) */
  function dentroDoHorario(a, agora) {
    var h = a.horario; if (!h || !h.ativo) return true;
    var p = {}; try { new Intl.DateTimeFormat('en-GB', { timeZone: h.tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(agora || new Date()).forEach(function (x) { p[x.type] = x.value; }); } catch (e) { return true; }
    var m = ((+p.hour % 24) * 60) + (+p.minute), ini = +h.inicio.slice(0, 2) * 60 + +h.inicio.slice(3), fim = +h.fim.slice(0, 2) * 60 + +h.fim.slice(3);
    return ini <= fim ? (m >= ini && m < fim) : (m >= ini || m < fim);
  }

  /** O Takeover pode responder agora? envios: horários (ms) das respostas automáticas já enviadas. */
  function podeResponder(a, envios, agora, grupo, ultimoNoGrupo) {
    agora = agora || Date.now();
    if (!a.takeover) return { ok: false, motivo: 'Takeover desligado' };
    if (!dentroDoHorario(a, new Date(agora))) return { ok: false, motivo: 'Fora do horário de atendimento' };
    var ultimaHora = (envios || []).filter(function (t) { return agora - t < 3600000; }).length;
    if (ultimaHora >= a.limite_hora) return { ok: false, motivo: 'Limite de ' + a.limite_hora + ' respostas por hora' };
    if (grupo && ultimoNoGrupo && agora - ultimoNoGrupo < a.grupo_intervalo * 60000) return { ok: false, motivo: 'Intervalo mínimo do grupo' };
    return { ok: true };
  }

  var api = { PADRAO: PADRAO, limparAjustes: limparAjustes, espera: espera, pausa: pausa, ritmoDigitacao: ritmoDigitacao, tempoDigitacao: tempoDigitacao,
    lerDataId: lerDataId, lerPrePlain: lerPrePlain, limparSensivel: limparSensivel, montarConversa: montarConversa, ultimaRecebida: ultimaRecebida,
    recente: recente, dentroDoHorario: dentroDoHorario, podeResponder: podeResponder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.EWaCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
