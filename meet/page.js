/* Página da sala do Web Meeting: reuniao.html?s=SALA
   - Lê os dados públicos da sala (função meet, ação info).
   - Quem está logado no admin ou no Portal do Cliente (com o autenticador) entra como anfitrião; o servidor decide.
   - Convidados entram só com o nome.
   - Sem o LiveKit configurado no servidor, a sala abre em modo demonstração. */
(function () {
  'use strict';
  var CFG = window.ENDEAVOR_CFG, msg = document.getElementById('wm-msg');
  var qs = new URLSearchParams(location.search), slug = (qs.get('s') || '').toLowerCase();
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fim(texto, html) { document.querySelector('.wm-cartao h1').textContent = texto; msg.innerHTML = html || ''; }

  async function api(body, token) {
    var h = { 'Content-Type': 'application/json', apikey: CFG.supabaseKey };
    if (token) h.Authorization = 'Bearer ' + token;
    var r = await fetch(CFG.functionsUrl + '/meet', { method: 'POST', headers: h, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.erro || 'Não foi possível abrir a sala.'); e.status = r.status; throw e; }
    return j;
  }

  // sessão do admin (chave padrão do Supabase) ou do Portal do Cliente (endeavor-client-auth), se houver
  async function sessao() {
    if (!window.supabase) return null;
    var pref = qs.get('host');
    var keys = pref === 'client' ? ['endeavor-client-auth', null] : [null, 'endeavor-client-auth'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var opt = { auth: { persistSession: true, autoRefreshToken: false } };
        if (keys[i]) opt.auth.storageKey = keys[i];
        var c = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, opt);
        var s = (await c.auth.getSession()).data.session;
        if (s && s.access_token) {
          var aal = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).aal;
          if (aal === 'aal2') return { token: s.access_token, nome: (s.user.user_metadata && (s.user.user_metadata.name || s.user.user_metadata.full_name)) || '' };
        }
      } catch (e) { /* sem sessão */ }
    }
    return null;
  }

  // fundo "Marca": logo da empresa sobre o azul da Endeavor (se a empresa tiver logo no portal)
  function fundoComLogo(url) {
    return new Promise(function (ok) {
      if (!url) return ok(null);
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = 1280; c.height = 720; var g = c.getContext('2d');
          var gr = g.createLinearGradient(0, 0, 0, 720); gr.addColorStop(0, '#07162b'); gr.addColorStop(1, '#12305a'); g.fillStyle = gr; g.fillRect(0, 0, 1280, 720);
          var w = Math.min(360, img.width), h = img.height * w / img.width; if (h > 140) { h = 140; w = img.width * h / img.height; }
          g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); if (g.roundRect) g.roundRect(1280 - w - 110, 50, w + 40, h + 40, 14); else g.rect(1280 - w - 110, 50, w + 40, h + 40); g.fill();
          g.drawImage(img, 1280 - w - 90, 70, w, h);
          ok(c.toDataURL('image/jpeg', 0.88));
        } catch (e) { ok(null); }
      };
      img.onerror = function () { ok(null); };
      img.src = url;
    });
  }

  async function iniciar() {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(slug)) return fim('Link inválido', '<p>Confira o link da reunião que você recebeu.</p>');
    var info;
    try { info = await api({ acao: 'info', sala: slug }); }
    catch (e) { return fim(e.status === 404 ? 'Sala não encontrada' : 'Não foi possível abrir', '<p>' + esc(e.message) + '</p>'); }
    document.title = info.titulo + ' | Web Meeting';
    if (!info.habilitada) return fim(info.titulo, '<p>O Web Meeting não está disponível para esta empresa no momento.</p>');
    var s = await sessao();
    if (info.situacao === 'ended' && !s) return fim(info.titulo, '<p class="wm-emp">' + esc(info.empresa) + '</p><p>Esta reunião foi encerrada.</p>');
    var marca = await fundoComLogo(info.logo);
    var quando = info.quando ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(info.quando)) : '';
    msg.textContent = '';
    window.EMeetRoom.abrir({
      sala: slug, titulo: info.titulo, quando: [info.empresa, quando].filter(Boolean).join(' · '),
      nome: s ? s.nome : '', papel: s ? 'mentor' : 'aluno', accessToken: s ? s.token : '', demo: !info.configurado,
      marcaImg: marca || undefined, gravacaoPermitida: true,
      onSair: function () { fim(info.titulo, '<p class="wm-emp">' + esc(info.empresa) + '</p><p>Você saiu da reunião. Pode fechar esta janela.</p><p><a href="' + esc(location.href) + '" style="color:#e3cf9f">Entrar de novo</a></p>'); }
    });
  }
  iniciar();
})();
