/* My WhatsApp Manager · service worker.
 * Faz as chamadas ao servidor da Endeavor (função "whatsapp", que usa o Hub AI) com o código de conexão guardado
 * só neste navegador, mostra avisos do Chrome quando uma conversa precisa de você e abre/fecha o painel pelo ícone. */
'use strict';
var API = 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/whatsapp';
var CHAVE_PUBLICA = 'sb_publishable_BXyVbQtTEpA5cmJHQiIl4A_4DO1quqO';

function guardado(k) { return new Promise(function (r) { chrome.storage.local.get(k, r); }); }

async function chamar(body) {
  var s = await guardado(['token', 'api_base']);
  if (!s.token && body.acao !== 'status') return { status: 401, dados: { erro: 'Extensão não conectada. Cole o código de conexão gerado na página WhatsApp Manager do admin.' } };
  var url = s.api_base || API; // api_base só existe nos testes automáticos
  try {
    var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CHAVE_PUBLICA, Authorization: 'Bearer ' + CHAVE_PUBLICA },
      body: JSON.stringify(Object.assign({}, body, { token: s.token })) });
    var j = await r.json().catch(function () { return {}; });
    return { status: r.status, dados: j };
  } catch (e) {
    return { status: 0, dados: { erro: 'Sem conexão com o servidor da Endeavor. Confira a internet.' } };
  }
}

chrome.runtime.onMessage.addListener(function (m, sender, responder) {
  if (!m || typeof m !== 'object') return false;
  if (m.tipo === 'api') { chamar(m.body || {}).then(responder); return true; }
  if (m.tipo === 'conectar') {
    var t = String(m.token || '').trim();
    if (!/^wam_[A-Za-z0-9_-]{20,64}$/.test(t)) { responder({ ok: false }); return false; }
    chrome.storage.local.set({ token: t }, function () { responder({ ok: true }); });
    return true;
  }
  if (m.tipo === 'desconectar') { chrome.storage.local.remove('token', function () { responder({ ok: true }); }); return true; }
  if (m.tipo === 'aviso') {
    try {
      chrome.notifications.create('', { type: 'basic', iconUrl: 'icons/icon128.png', title: String(m.titulo || 'My WhatsApp Manager').slice(0, 80), message: String(m.texto || '').slice(0, 200), priority: 1 });
    } catch (e) { /* sem permissão de aviso: o painel mostra */ }
    responder({ ok: true }); return false;
  }
  return false;
});

// o ícone da extensão abre/fecha o painel na aba do WhatsApp Web; em outra aba, abre o WhatsApp Web
chrome.action.onClicked.addListener(function (tab) {
  if (tab && tab.url && tab.url.indexOf('https://web.whatsapp.com/') === 0) chrome.tabs.sendMessage(tab.id, { tipo: 'alternar' }, function () { void chrome.runtime.lastError; });
  else chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
});
