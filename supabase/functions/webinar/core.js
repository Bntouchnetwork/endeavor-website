/* Endeavor Live Webinar · regras compartilhadas entre o navegador (webinar.js, webinar-panel.js) e o servidor
 * (supabase/functions/webinar). Sem dependências; o mesmo arquivo roda nos dois lados.
 *
 * - linha do tempo: cada slide dura o áudio da narração (quando pronta), senão a duração escolhida, senão a estimada;
 * - posição: a apresentação anda pelo relógio do servidor, a partir do horário marcado, descontando pausas;
 * - contador: o número REAL de pessoas assistindo, mostrado só a partir do mínimo escolhido pelo organizador;
 * - dados pessoais no chat aberto: e-mail, telefone e números longos são removidos antes de gravar;
 * - mensagens programadas: boas-vindas, perguntas frequentes (identificadas como tal) e convites para perguntar. */
(function (raiz) {
  'use strict';
  var PPM = { calmo: 130, normal: 150, rapido: 170 };

  function estimarSegundos(roteiro, ritmo) {
    var n = (String(roteiro || '').match(/\S+/g) || []).length;
    return n ? Math.max(3, Math.round(n / (PPM[ritmo] || 150) * 60)) : 0;
  }

  /** slides: [{id, duracao?, roteiro?}]; narr: {slide_id: {duracao_ms}} -> [{i, id, ini, dur}] em ms */
  function linhaDoTempo(slides, narr, ritmo) {
    var t = 0;
    return (slides || []).map(function (s, i) {
      var n = narr && narr[s.id];
      var dur = n && n.duracao_ms ? Math.max(n.duracao_ms + 600, 3000)
        : (s.duracao || estimarSegundos(s.roteiro, ritmo) || 8) * 1000;
      var item = { i: i, id: s.id, ini: t, dur: Math.round(dur) };
      t += item.dur;
      return item;
    });
  }
  function total(linha) { var u = linha[linha.length - 1]; return u ? u.ini + u.dur : 0; }

  /** webinar: {starts_at, playback: {pausado_em?, pausa_total_ms?, encerrado_em?}}; agora em ms (relógio do servidor) */
  function posicao(w, linha, agora) {
    var ini = Date.parse(w.starts_at), pb = w.playback || {}, tot = total(linha);
    if (pb.encerrado_em) return { estado: 'encerrado', pos: tot };
    var ref = pb.pausado_em ? Date.parse(pb.pausado_em) : agora;
    var pos = ref - ini - (Number(pb.pausa_total_ms) || 0);
    if (pos < 0) return { estado: 'antes', pos: 0, faltam: ini - agora };
    if (pos >= tot) return { estado: 'encerrado', pos: tot };
    return { estado: pb.pausado_em ? 'pausado' : 'ao_vivo', pos: pos };
  }
  function slideNa(linha, pos) {
    for (var k = linha.length - 1; k >= 0; k--) if (pos >= linha[k].ini) return { i: k, offset: pos - linha[k].ini };
    return { i: 0, offset: 0 };
  }

  /** Contador real: só aparece quando o número de pessoas assistindo chega ao mínimo escolhido. */
  function contadorVisivel(n, minimo) {
    n = Math.max(0, Math.floor(Number(n) || 0)); minimo = Math.max(0, Math.floor(Number(minimo) || 0));
    return n >= minimo && n > 0 ? n : null;
  }

  var RE_EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
  var RE_FONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
  /** Remove e-mail, telefone e números longos do chat aberto (o lugar certo é a caixa privada). */
  function mascararDados(texto) {
    var t = String(texto || ''), achou = false;
    t = t.replace(RE_EMAIL, function () { achou = true; return '[e-mail removido]'; });
    t = t.replace(RE_FONE, function (m) { if (m.replace(/\D/g, '').length < 7) return m; achou = true; return '[número removido]'; });
    return { texto: t, removido: achou };
  }

  /** Mensagens que entram no chat em pontos da apresentação. Cada uma tem uma chave única (não repete). */
  function programadas(w, linha) {
    var cfg = w.settings || {}, plano = w.ai_plan || {}, out = [];
    if (cfg.boas_vindas !== false) out.push({ chave: 'boas-vindas', em: 0, autor: 'ia', texto: cfg.texto_boas_vindas || 'Bem-vindo! Eu sou o assistente de IA deste webinar. Deixe suas perguntas no chat a qualquer momento que eu respondo.' });
    if (cfg.faq !== false) (plano.faq || []).forEach(function (f, k) {
      var s = linha[Math.min(Math.max(f.slide | 0, 0), linha.length - 1)];
      if (!s || !f.pergunta || !f.resposta || f.aprovada === false) return;
      out.push({ chave: 'faq-' + k, em: s.ini + Math.min(20000, Math.round(s.dur / 2)), autor: 'faq', texto: f.pergunta, resposta: f.resposta });
    });
    (cfg.convites || []).forEach(function (n) {
      var s = linha[n | 0]; if (!s) return;
      out.push({ chave: 'convite-' + (n | 0), em: s.ini + 4000, autor: 'ia', texto: cfg.texto_convite || 'Ficou alguma dúvida até aqui? Deixe sua pergunta no chat. Se quiser falar do seu caso, clique em "Falar em particular".' });
    });
    if (cfg.cta_final !== false && linha.length) {
      var u = linha[linha.length - 1];
      out.push({ chave: 'cta-final', em: u.ini + 2000, autor: 'ia', texto: cfg.texto_cta || 'Quer conversar sobre o seu caso? Clique em "Falar em particular" para marcar um horário com a nossa equipe.' });
    }
    return out.sort(function (a, b) { return a.em - b.em; });
  }

  var api = { estimarSegundos: estimarSegundos, linhaDoTempo: linhaDoTempo, total: total, posicao: posicao, slideNa: slideNa,
    contadorVisivel: contadorVisivel, mascararDados: mascararDados, programadas: programadas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.EWebinarCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
