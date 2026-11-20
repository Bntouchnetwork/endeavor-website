// LinkedIn Manager: as chamadas ao servidor da Endeavor passam por aqui (o token fica no armazenamento da extensão, fora da página).
importScripts('core.js');
chrome.runtime.onMessage.addListener(function (msg, _s, responder) {
  if (msg && msg.tipo === 'opcoes') { chrome.runtime.openOptionsPage(); return; }
  if (!msg || msg.tipo !== 'api') return;
  chrome.storage.local.get('cfg').then(async function (st) {
    var c = ELiCore.limpar(st.cfg);
    if (!c.token) return responder({ erro: 'sem_token' });
    try {
      var r = await fetch(c.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, msg.corpo, { token: c.token })) });
      var j = await r.json().catch(function () { return {}; });
      responder(r.ok ? { ok: j } : { erro: j.erro || ('HTTP ' + r.status) });
    } catch (e) { responder({ erro: 'rede' }); }
  });
  return true;
});
chrome.action.onClicked.addListener(function () { chrome.runtime.openOptionsPage(); });
