(function () {
  'use strict';
  var C = globalThis.ELiCore, L = (navigator.language || 'pt').slice(0, 2); if (['pt', 'en', 'es'].indexOf(L) < 0) L = 'en';
  var T = {
    pt: { sub: 'Lê só o que está na sua tela do LinkedIn e sugere respostas. Manual por padrão.', conexao: 'Conexão', url: 'URL do agente', token: 'Token', tokenDica: 'Gere em LinkedIn Manager › Configurações › Gerar código de conexão.', modoT: 'Modo e ritmo', modo: 'Modo',
      manual: 'Manual: só sugere; você copia, cola e envia (recomendado)', auto: 'Automático: digita e envia sozinha no feed e em grupos',
      risco: 'Risco para a conta: o LinkedIn proíbe automação por extensões e pode restringir ou encerrar o perfil. Mensagens privadas nunca são automáticas.', aceito: 'Entendo o risco e quero ligar o automático.',
      vel: 'Velocidade de digitação (caracteres/min)', imin: 'Intervalo mínimo entre envios (s)', imax: 'Intervalo máximo (s)', lim: 'Limite diário de envios', servidor: 'O automático só funciona se também estiver ligado no LinkedIn Manager. O limite diário e o intervalo mínimo de lá sempre valem.',
      oport: 'Oportunidades', pal: 'Palavras-chave extras (separadas por vírgula)', wa: 'Link do WhatsApp', ag: 'Link de agendamento', links: 'Os links vêm do LinkedIn Manager (Configurações) para a IA nunca inventar um endereço.', salvar: 'Salvar',
      salvo: 'Salvo.', conectado: 'Conectado: ', semToken: 'Cole a URL e o token para conectar.', falhou: 'Não conectou: ', precisaAceite: 'Marque que entende o risco para ligar o automático.' },
    en: { sub: 'Reads only what is on your LinkedIn screen and suggests replies. Manual by default.', conexao: 'Connection', url: 'Agent URL', token: 'Token', tokenDica: 'Generate it in LinkedIn Manager › Settings › Generate connection code.', modoT: 'Mode and pace', modo: 'Mode',
      manual: 'Manual: suggestions only; you copy, paste and send (recommended)', auto: 'Automatic: types and sends by itself on the feed and in groups',
      risco: 'Account risk: LinkedIn forbids automation by extensions and may restrict or close the profile. Private messages are never automatic.', aceito: 'I understand the risk and want to turn automatic on.',
      vel: 'Typing speed (characters/min)', imin: 'Minimum interval between sends (s)', imax: 'Maximum interval (s)', lim: 'Daily send limit', servidor: 'Automatic only works if it is also on in LinkedIn Manager. Its daily limit and minimum interval always apply.',
      oport: 'Opportunities', pal: 'Extra keywords (comma separated)', wa: 'WhatsApp link', ag: 'Booking link', links: 'Links come from LinkedIn Manager (Settings) so the AI never invents an address.', salvar: 'Save',
      salvo: 'Saved.', conectado: 'Connected: ', semToken: 'Paste the URL and token to connect.', falhou: 'Not connected: ', precisaAceite: 'Check that you understand the risk to turn automatic on.' },
    es: { sub: 'Lee solo lo que está en su pantalla de LinkedIn y sugiere respuestas. Manual por defecto.', conexao: 'Conexión', url: 'URL del agente', token: 'Token', tokenDica: 'Genérelo en LinkedIn Manager › Configuración › Generar código de conexión.', modoT: 'Modo y ritmo', modo: 'Modo',
      manual: 'Manual: solo sugiere; usted copia, pega y envía (recomendado)', auto: 'Automático: escribe y envía sola en el feed y en grupos',
      risco: 'Riesgo para la cuenta: LinkedIn prohíbe la automatización con extensiones y puede restringir o cerrar el perfil. Los mensajes privados nunca son automáticos.', aceito: 'Entiendo el riesgo y quiero activar el automático.',
      vel: 'Velocidad de escritura (caracteres/min)', imin: 'Intervalo mínimo entre envíos (s)', imax: 'Intervalo máximo (s)', lim: 'Límite diario de envíos', servidor: 'El automático solo funciona si también está activado en LinkedIn Manager. Su límite diario e intervalo mínimo siempre aplican.',
      oport: 'Oportunidades', pal: 'Palabras clave extra (separadas por coma)', wa: 'Enlace de WhatsApp', ag: 'Enlace de agenda', links: 'Los enlaces vienen de LinkedIn Manager (Configuración) para que la IA nunca invente una dirección.', salvar: 'Guardar',
      salvo: 'Guardado.', conectado: 'Conectado: ', semToken: 'Pegue la URL y el token para conectar.', falhou: 'No conectó: ', precisaAceite: 'Marque que entiende el riesgo para activar el automático.' }
  }[L];
  document.documentElement.lang = L === 'pt' ? 'pt-BR' : L;
  document.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = T[el.dataset.t]; });
  var $ = function (id) { return document.getElementById(id); };
  function mostrar(c) {
    $('url').value = c.url; $('token').value = c.token; $('modo').value = c.modo; $('aceito').checked = c.aceitouRisco; $('risco').hidden = c.modo !== 'auto';
    $('vel').value = c.velocidade; $('velo').textContent = c.velocidade; $('imin').value = c.intervalo_min; $('imax').value = c.intervalo_max; $('lim').value = c.limite_dia; $('pal').value = c.palavras.join(', ');
  }
  async function testar() {
    var e = $('estado');
    chrome.runtime.sendMessage({ tipo: 'api', corpo: { acao: 'ext_iniciar' } }, function (r) {
      if (!r || r.erro === 'sem_token') { e.textContent = T.semToken; e.className = 'nota'; return; }
      if (r.erro) { e.textContent = T.falhou + r.erro; e.className = 'nota erro'; return; }
      e.textContent = T.conectado + r.ok.empresa; e.className = 'nota ok'; $('wa').value = r.ok.links.whatsapp || '—'; $('ag').value = r.ok.links.agenda || '—';
    });
  }
  chrome.storage.local.get('cfg').then(function (st) { mostrar(C.limpar(st.cfg)); testar(); });
  $('vel').oninput = function () { $('velo').textContent = $('vel').value; };
  $('modo').onchange = function () { $('risco').hidden = $('modo').value !== 'auto'; };
  $('f').onsubmit = async function (ev) {
    ev.preventDefault();
    var m = $('msg');
    if ($('modo').value === 'auto' && !$('aceito').checked) { m.textContent = T.precisaAceite; m.className = 'erro'; return; }
    var c = C.limpar({ url: $('url').value, token: $('token').value, modo: $('modo').value, aceitouRisco: $('aceito').checked, velocidade: $('vel').value, intervalo_min: $('imin').value, intervalo_max: $('imax').value, limite_dia: $('lim').value, palavras: $('pal').value });
    await chrome.storage.local.set({ cfg: c });
    mostrar(c); m.textContent = T.salvo; m.className = 'ok'; testar();
  };
})();
