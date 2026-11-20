/* LinkedIn Manager · regras da extensão (sem DOM), usadas pelo content.js e pelos testes. */
(function (root) {
  'use strict';
  var PADRAO = { url: 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/linkedin', token: '', modo: 'manual', velocidade: 220, intervalo_min: 90, intervalo_max: 300, limite_dia: 15, palavras: [], aceitouRisco: false };
  function num(v, min, max, d) { var n = Math.round(Number(v)); return isFinite(n) ? Math.min(max, Math.max(min, n)) : d; }
  function limpar(c) {
    c = c || {};
    var min = num(c.intervalo_min, 30, 3600, PADRAO.intervalo_min), url = String(c.url || PADRAO.url).trim();
    if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/functions\/v1\/linkedin$/.test(url)) url = PADRAO.url; // o token só vai para o servidor da Endeavor
    return { url: url, token: /^lim_[A-Za-z0-9_-]{20,64}$/.test(String(c.token || '').trim()) ? String(c.token).trim() : '',
      // automático só com o aviso de risco aceito
      modo: c.modo === 'auto' && c.aceitouRisco === true ? 'auto' : 'manual', aceitouRisco: c.aceitouRisco === true,
      velocidade: num(c.velocidade, 80, 400, PADRAO.velocidade), intervalo_min: min, intervalo_max: Math.max(min, num(c.intervalo_max, 30, 7200, PADRAO.intervalo_max)), limite_dia: num(c.limite_dia, 1, 50, PADRAO.limite_dia),
      palavras: (Array.isArray(c.palavras) ? c.palavras : String(c.palavras || '').split(',')).map(function (p) { return String(p).trim().toLowerCase().slice(0, 60); }).filter(Boolean).slice(0, 40) };
  }
  function semAcento(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function oportunidade(texto, palavras) {
    var t = ' ' + semAcento(texto) + ' ';
    return (palavras || []).filter(function (p) { var k = semAcento(p); return k.length >= 3 && t.indexOf(k) > -1; }).slice(0, 5);
  }
  function origemDe(path) { return /^\/messaging/.test(path) ? 'dm' : /^\/groups/.test(path) ? 'grupo' : 'feed'; }
  /** Atrasos de digitação em ritmo humano: velocidade em caracteres/min com variação aleatória, pausas maiores em pontuação. */
  function atrasos(texto, cpm, rnd) {
    rnd = rnd || Math.random; var base = 60000 / num(cpm, 80, 400, 220), out = [];
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i], d = base * (0.55 + rnd() * 0.9);
      if (/[.,;:!?]/.test(ch)) d += base * (1 + rnd() * 3);
      if (ch === '\n') d += base * (2 + rnd() * 4);
      if (rnd() < 0.03) d += 400 + rnd() * 900; // hesitação
      out.push(Math.round(d));
    }
    return out;
  }
  /** Próximo envio automático: intervalo sorteado entre o mínimo e o máximo. */
  function proximoIntervalo(c, rnd) { rnd = rnd || Math.random; return Math.round((c.intervalo_min + rnd() * (c.intervalo_max - c.intervalo_min)) * 1000); }
  /** Automático só no feed e em grupos, com os dois lados ligados (extensão e servidor), dentro do limite. DM nunca. */
  function podeAuto(c, origem, resposta) { return c.modo === 'auto' && origem !== 'dm' && !!resposta && resposta.auto === true && !!resposta.reply; }
  root.ELiCore = { PADRAO: PADRAO, limpar: limpar, oportunidade: oportunidade, origemDe: origemDe, atrasos: atrasos, proximoIntervalo: proximoIntervalo, podeAuto: podeAuto };
})(typeof globalThis !== 'undefined' ? globalThis : this);
