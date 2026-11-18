/* Admin › Telefonia (Endeavor Corporate Phone). Fase 1: provedor de demonstração, sempre identificado.
   Fala só com a função "telephony" (nunca com a Telnyx). Abas pela rota #/telefonia?aba=… */
(function () {
  var ABAS = [['dashboard', 'Dashboard'], ['numeros', 'Números'], ['clientes', 'Clientes'], ['chamadas', 'Chamadas'], ['sms', 'Mensagens SMS'], ['voicemail', 'Voicemail'], ['atendimento', 'Saudações e atendimento'],
    ['gravacoes', 'Gravações'], ['consumo', 'Consumo e faturamento'], ['planos', 'Planos e preços'], ['integracoes', 'Integrações'], ['config', 'Configurações e auditoria']];
  var ST_NUM = { aguardando_aprovacao: ['Aguardando aprovação', 'pill--warn'], ativo: ['Ativo', 'pill--live-ok'], suspenso: ['Suspenso', 'pill--overdue'], liberado: ['Liberado', 'pill--muted'], recusado: ['Recusado', 'pill--muted'] };
  var EST = { demonstracao: ['Demonstração', 'pill--report'], nao_configurado: ['Não configurado', 'pill--muted'], configurado_nao_verificado: ['Chaves cadastradas · não verificado', 'pill--warn'], teste: ['Teste (sandbox)', 'pill--warn'], conectado: ['Conectado', 'pill--live-ok'] };
  var ctx, P = null;

  function param(k) { var m = location.hash.match(new RegExp('[?&]' + k + '=([^&]+)')); return m ? decodeURIComponent(m[1]) : ''; }
  function link(aba, extra) { return '#/telefonia?aba=' + aba + (extra || ''); }
  async function call(body) {
    var s = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/telephony', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + (s ? s.access_token : ctx.CFG.supabaseKey) }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status);
    return j;
  }
  var esc = function (s) { return ctx.esc(s); };
  var usd = function (v, dig) { return v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dig || 2, maximumFractionDigits: dig || 2 }).format(v); };
  var quando = function (iso) { if (!iso) return '—'; try { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); } catch (e) { return iso; } };
  var fone = function (n) { var m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(n || ''); return m ? '+1 (' + m[1] + ') ' + m[2] + '-' + m[3] : (n || '—'); };
  var pill = function (p) { return '<span class="pill ' + p[1] + '">' + esc(p[0]) + '</span>'; };
  var nomeEmp = function (id) { var a = (P.acessos || []).find(function (x) { return x.company_id === id; }); return a ? (a.companies && a.companies.legal_name) || '—' : '—'; };
  function msg(el, t, k) { if (!el) return; el.hidden = false; ctx.msg(el, t, k === 'erro' ? 'error' : k === 'ok' ? 'ok' : undefined); }

  async function render(view, c) {
    ctx = c;
    var aba = param('aba') || 'dashboard';
    if (!ABAS.some(function (a) { return a[0] === aba; })) aba = 'dashboard';
    P = await call({ acao: 'adm_painel' });
    var e = EST[P.estado.estado] || [P.estado.estado, ''];
    view.innerHTML = '<div class="console__head"><div><h1>Telefonia</h1><p class="portal-muted">Endeavor Corporate Phone: números americanos por assinatura, ligações pelo app, SMS, voicemail e encaminhamento.</p></div>' +
      '<div class="tel-estado">' + pill(e) + '</div></div>' +
      (P.estado.estado === 'demonstracao' ? '<p class="portal-alert portal-alert--info tel-demo-aviso"><strong>Modo demonstração.</strong> ' + esc(P.estado.texto) + ' Números na faixa fictícia 555-01XX. A conexão com a Telnyx entra na Fase 2.</p>' : '<p class="portal-alert portal-alert--info">' + esc(P.estado.texto) + '</p>') +
      '<nav class="subtabs tel-abas" aria-label="Seções da Telefonia">' + ABAS.map(function (a) { return '<a href="' + link(a[0]) + '"' + (a[0] === aba ? ' aria-current="page"' : '') + '>' + a[1] + '</a>'; }).join('') + '</nav><div id="tel-corpo"></div>';
    var corpo = view.querySelector('#tel-corpo');
    return ({ dashboard: dashboard, numeros: numeros, clientes: clientes, chamadas: lista('chamadas'), sms: lista('mensagens'), voicemail: lista('voicemails'), atendimento: atendimento, gravacoes: lista('gravacoes'),
      consumo: lista('consumo'), planos: planos, integracoes: integracoes, config: config })[aba](corpo);
  }

  /* ---------- dashboard ---------- */
  function kpi(r, v, sub) { return '<div class="tel-kpi"><span>' + esc(r) + '</span><strong>' + esc(v) + '</strong>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>'; }
  async function dashboard(corpo) {
    var d = P.dashboard;
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Este mês</h2><div class="tel-kpis">' +
      kpi('Números ativos', d.numeros_ativos, d.aguardando ? d.aguardando + ' aguardando aprovação' : '') + kpi('Empresas habilitadas', d.empresas) + kpi('Chamadas', d.chamadas) + kpi('SMS', d.sms) + kpi('Minutos', Math.round(d.minutos)) +
      kpi('Receita (planos)', usd(d.receita_estimada), 'estimada') + kpi('Custo do provedor', usd(d.custo_estimado), 'estimado') + kpi('Margem', usd(d.margem_estimada), 'estimada') + '</div>' +
      '<p class="portal-muted">Valores estimados até a reconciliação com a fatura da Telnyx (Fase 4). Em demonstração não há custo real.</p></section>' +
      (d.aguardando ? '<p class="portal-alert portal-alert--info"><a href="' + link('numeros') + '">' + d.aguardando + ' número(s) aguardando a sua aprovação</a></p>' : '');
  }

  /* ---------- números: buscar, propor, aprovar, suspender, liberar ---------- */
  async function numeros(corpo) {
    var emp = (P.acessos || []).filter(function (a) { return a.enabled; });
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Procurar número</h2>' +
      '<form class="portal-form tel-busca" id="tb-f"><div class="field-row"><div class="field"><label for="tb-tipo">Tipo</label><select id="tb-tipo"><option value="local">Local</option><option value="tollfree">Toll-free</option></select></div>' +
      '<div class="field"><label for="tb-pre">Código de área / prefixo</label><input id="tb-pre" inputmode="numeric" maxlength="3" placeholder="407 ou 833"></div>' +
      '<div class="field tel-bt-fim"><button class="btn btn--navy" type="submit">Procurar</button></div></div>' +
      '<p class="portal-muted">Toll-free: 800, 888, 877, 866, 855, 844 e 833 (mesmo custo; o 800 e o 888 têm menos números livres). Procurar não compra nada.</p></form>' +
      '<div id="tb-res" aria-live="polite"></div><p class="portal-alert" id="tb-m" role="status" hidden></p></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Números</h2><div id="tn-lista"></div><p class="portal-alert" id="tn-m" role="status" hidden></p></section>';
    corpo.querySelector('#tb-f').onsubmit = async function (ev) {
      ev.preventDefault();
      var res = corpo.querySelector('#tb-res'), m = corpo.querySelector('#tb-m'); msg(m, 'Procurando…');
      try {
        var r = await call({ acao: 'adm_buscar', tipo: corpo.querySelector('#tb-tipo').value, prefixo: corpo.querySelector('#tb-pre').value });
        m.hidden = true;
        res.innerHTML = !r.numeros.length ? '<p class="portal-muted">Nenhum número disponível.</p>' : '<ul class="tel-disp">' + r.numeros.map(function (n) {
          return '<li><span class="tel-num">' + esc(fone(n.e164)) + '</span>' + (n.demo ? ' <span class="pill pill--report">Demonstração</span>' : '') + ' <small class="portal-muted">' + esc(n.regiao) + '</small>' +
            (emp.length ? '<span class="tel-prop"><label class="sr-only" for="tp-' + n.e164.slice(1) + '">Empresa</label><select id="tp-' + n.e164.slice(1) + '">' + emp.map(function (a) { return '<option value="' + a.company_id + '">' + esc(a.companies.legal_name) + '</option>'; }).join('') + '</select>' +
              '<button class="btn btn--ghost btn--xs" type="button" data-propor="' + esc(n.e164) + '">Propor</button></span>' : '<small class="portal-muted"> · libere a Telefonia para uma empresa (ficha do cliente) para propor</small>') + '</li>';
        }).join('') + '</ul>';
        res.querySelectorAll('[data-propor]').forEach(function (b) {
          b.onclick = async function () {
            b.disabled = true;
            try { await call({ acao: 'adm_propor', e164: b.dataset.propor, company_id: res.querySelector('#tp-' + b.dataset.propor.slice(1)).value }); msg(m, 'Proposto. Agora aprove na lista abaixo para ativar.', 'ok'); P = await call({ acao: 'adm_painel' }); desenharNumeros(corpo); }
            catch (x) { msg(m, x.message, 'erro'); b.disabled = false; }
          };
        });
      } catch (x) { msg(m, x.message, 'erro'); }
    };
    desenharNumeros(corpo);
  }
  function desenharNumeros(corpo) {
    var l = corpo.querySelector('#tn-lista'), ns = P.numeros || [];
    l.innerHTML = !ns.length ? '<p class="portal-muted">Nenhum número ainda.</p>' : '<div class="table-wrap"><table class="data"><thead><tr><th>Número</th><th>Empresa</th><th>Tipo</th><th>Situação</th><th>SMS</th><th>Ações</th></tr></thead><tbody>' + ns.map(function (n) {
      var acoes = n.status === 'aguardando_aprovacao' ? '<form class="tel-aprovar" data-id="' + n.id + '"><label class="sr-only" for="ap-' + n.id + '">Digite CONTRATAR</label><input id="ap-' + n.id + '" placeholder="CONTRATAR" autocomplete="off" size="11"><button class="btn btn--navy btn--xs" type="submit">Aprovar e contratar</button><button class="btn btn--ghost btn--xs" type="button" data-st="recusado">Recusar</button></form>'
        : n.status === 'ativo' ? '<button class="btn btn--ghost btn--xs" type="button" data-st="suspenso">Suspender</button> <button class="btn btn--ghost btn--xs" type="button" data-st="liberado">Liberar</button>'
        : n.status === 'suspenso' ? '<button class="btn btn--ghost btn--xs" type="button" data-st="ativo">Reativar</button> <button class="btn btn--ghost btn--xs" type="button" data-st="liberado">Liberar</button>' : '';
      return '<tr data-id="' + n.id + '"><td class="tel-num">' + esc(fone(n.e164)) + (n.demo ? ' <span class="pill pill--report">Demonstração</span>' : '') + '</td><td>' + esc(nomeEmp(n.company_id)) + '</td><td>' + (n.tipo === 'tollfree' ? 'Toll-free' : 'Local') + '</td><td>' + pill(ST_NUM[n.status] || [n.status, '']) +
        '</td><td>' + esc({ nao_iniciado: n.tipo === 'tollfree' ? 'Verificação toll-free não iniciada' : '10DLC não iniciado', pendente: 'Em análise', aprovado: 'Aprovado', recusado: 'Recusado', nao_aplicavel: 'Demonstração' }[n.sms_registro] || n.sms_registro) + '</td><td>' + acoes + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    var m = corpo.querySelector('#tn-m');
    l.querySelectorAll('form.tel-aprovar').forEach(function (f) {
      f.onsubmit = async function (ev) {
        ev.preventDefault();
        try { await call({ acao: 'adm_aprovar', number_id: f.dataset.id, confirmacao: f.querySelector('input').value.trim() }); msg(m, 'Número ativo.', 'ok'); P = await call({ acao: 'adm_painel' }); desenharNumeros(corpo); }
        catch (x) { msg(m, x.message, 'erro'); }
      };
    });
    l.querySelectorAll('[data-st]').forEach(function (b) {
      b.onclick = async function () {
        var tr = b.closest('tr'), st = b.dataset.st, conf = '';
        if (st === 'liberado') { conf = window.prompt('O número deixa de ser da empresa. Para confirmar, digite LIBERAR.') || ''; if (!conf) return; }
        try { await call({ acao: 'adm_status_numero', number_id: tr.dataset.id, status: st, confirmacao: conf.trim() }); msg(m, 'Salvo.', 'ok'); P = await call({ acao: 'adm_painel' }); desenharNumeros(corpo); }
        catch (x) { msg(m, x.message, 'erro'); }
      };
    });
  }

  /* ---------- clientes ---------- */
  async function clientes(corpo) {
    var planoDe = {}; (P.planos || []).forEach(function (p) { planoDe[p.id] = p; });
    var ac = P.acessos || [];
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Empresas</h2><p class="portal-muted">A Telefonia é liberada por empresa, na ficha do cliente (aba Telefonia), com plano, limites e permissões.</p>' +
      (!ac.length ? '<p class="portal-muted">Nenhuma empresa liberada ainda.</p>' : '<div class="table-wrap"><table class="data"><thead><tr><th>Empresa</th><th>Cliente</th><th>Plano</th><th>Números</th><th>Situação</th><th></th></tr></thead><tbody>' + ac.map(function (a) {
        var n = (P.numeros || []).filter(function (x) { return x.company_id === a.company_id && x.status === 'ativo'; }).length;
        return '<tr><td>' + esc(a.companies && a.companies.legal_name) + '</td><td>' + esc(a.clients && a.clients.name) + '</td><td>' + esc(planoDe[a.plan_id] ? planoDe[a.plan_id].nome : '—') + '</td><td>' + n + '</td><td>' + (a.enabled ? pill(['Liberada', 'pill--live-ok']) : pill(['Desligada', 'pill--muted'])) +
          '</td><td><a class="btn btn--ghost btn--xs" href="#/clientes?id=' + a.client_id + '&tab=telefonia">Abrir ficha</a></td></tr>';
      }).join('') + '</tbody></table></div>') + '</section>';
  }

  /* ---------- listas com filtros (empresa, número, período) e CSV ---------- */
  var COLS = {
    chamadas: [['inicio', 'Quando', quando], ['company_id', 'Empresa', nomeEmp], ['direcao', 'Direção'], ['de', 'De', fone], ['para', 'Para', fone], ['status', 'Situação'], ['duracao_s', 'Duração (s)'], ['custo', 'Custo est.', function (v) { return v == null ? '—' : usd(Number(v), 4); }]],
    mensagens: [['created_at', 'Quando', quando], ['company_id', 'Empresa', nomeEmp], ['direcao', 'Direção'], ['de', 'De', fone], ['para', 'Para', fone], ['status', 'Situação'], ['texto', 'Mensagem']],
    voicemails: [['created_at', 'Quando', quando], ['company_id', 'Empresa', nomeEmp], ['de', 'De', fone], ['duracao_s', 'Duração (s)'], ['ouvido', 'Ouvido', function (v) { return v ? 'Sim' : 'Não'; }], ['transcricao', 'Transcrição']],
    gravacoes: [['created_at', 'Quando', quando], ['company_id', 'Empresa', nomeEmp], ['duracao_s', 'Duração (s)'], ['aviso_tocado', 'Aviso de gravação', function (v) { return v ? 'Tocado' : 'Não'; }], ['expira_em', 'Apaga em', quando]],
    consumo: [['periodo', 'Mês'], ['company_id', 'Empresa', nomeEmp], ['minutos_entrada', 'Min. entrada'], ['minutos_saida', 'Min. saída'], ['sms_entrada', 'SMS entrada'], ['sms_saida', 'SMS saída'], ['custo', 'Custo', function (v) { return usd(Number(v), 2); }], ['estimado', 'Valores', function (v) { return v ? 'Estimados' : 'Efetivos'; }]]
  };
  function lista(tipo) {
    return async function (corpo) {
      var ac = P.acessos || [], ns = P.numeros || [];
      corpo.innerHTML = '<section class="portal-card"><form class="portal-form tel-filtros" id="tf"><div class="field-row">' +
        '<div class="field"><label for="tf-emp">Empresa</label><select id="tf-emp"><option value="">Todas</option>' + ac.map(function (a) { return '<option value="' + a.company_id + '"' + (param('empresa') === a.company_id ? ' selected' : '') + '>' + esc(a.companies && a.companies.legal_name) + '</option>'; }).join('') + '</select></div>' +
        (['chamadas', 'mensagens', 'voicemails'].indexOf(tipo) > -1 ? '<div class="field"><label for="tf-num">Número</label><select id="tf-num"><option value="">Todos</option>' + ns.map(function (n) { return '<option value="' + n.id + '">' + esc(fone(n.e164)) + '</option>'; }).join('') + '</select></div>' : '') +
        '<div class="field"><label for="tf-de">De</label><input id="tf-de" type="date"></div><div class="field"><label for="tf-ate">Até</label><input id="tf-ate" type="date"></div>' +
        '<div class="field tel-bt-fim"><button class="btn btn--navy" type="submit">Filtrar</button> <button class="btn btn--ghost" type="button" id="tf-csv">Exportar CSV</button></div></div></form>' +
        (tipo === 'gravacoes' ? '<p class="portal-muted">Gravação só acontece onde foi liberada e ligada, com aviso no início da ligação (a Flórida exige o consentimento de todas as partes). O áudio fica em armazenamento privado e é apagado no prazo de retenção.</p>' : '') +
        (tipo === 'consumo' ? '<p class="portal-muted">Valores estimados pelas tarifas conferidas (aba Configurações) até a reconciliação com a fatura da Telnyx.</p>' : '') +
        '<div id="tl"></div></section>';
      var itens = [];
      async function carregar() {
        var q = { acao: 'adm_lista', tipo: tipo, company_id: corpo.querySelector('#tf-emp').value, de: corpo.querySelector('#tf-de').value, ate: corpo.querySelector('#tf-ate').value };
        var fn = corpo.querySelector('#tf-num'); if (fn) q.number_id = fn.value;
        var el = corpo.querySelector('#tl'); el.innerHTML = '<p class="portal-muted">Carregando…</p>';
        try { itens = (await call(q)).itens; } catch (x) { el.innerHTML = '<p class="portal-alert portal-alert--error">' + esc(x.message) + '</p>'; return; }
        var cols = COLS[tipo];
        el.innerHTML = !itens.length ? '<p class="portal-muted">Nada no período.</p>' : '<div class="table-wrap"><table class="data"><thead><tr>' + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
          itens.map(function (x) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(c[2] ? c[2](x[c[0]]) : x[c[0]]) + '</td>'; }).join('') + '<td>' + (x.demo ? '<span class="pill pill--report">Demo</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      }
      corpo.querySelector('#tf').onsubmit = function (ev) { ev.preventDefault(); carregar(); };
      corpo.querySelector('#tf-csv').onclick = function () {
        var cols = COLS[tipo], linhas = [cols.map(function (c) { return c[1]; }).join(',')].concat(itens.map(function (x) { return cols.map(function (c) { return '"' + String(c[2] ? c[2](x[c[0]]) : x[c[0]] == null ? '' : x[c[0]]).replace(/"/g, '""') + '"'; }).join(','); }));
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv' })); a.download = 'telefonia-' + tipo + '.csv'; a.click();
      };
      return carregar();
    };
  }

  /* ---------- atendimento (visão do admin; quem configura é a empresa no portal) ---------- */
  async function atendimento(corpo) {
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Saudações e atendimento</h2><p class="portal-muted">Cada empresa configura no portal, por número: saudação (greeting) e mensagem de ausência em PT/EN/ES, horário comercial com fuso, feriados, não perturbe, destino (app, outro número, voicemail ou encerrar) e encaminhamento com custo estimado e aceite registrado. Exemplos:</p>' +
      '<ul class="tel-ex"><li><strong>Greeting:</strong> “Obrigado por ligar para [Nome da Empresa]. Aguarde enquanto transferimos sua ligação.”</li><li><strong>Away:</strong> “Estamos fora do horário de atendimento. Deixe sua mensagem após o sinal.”</li></ul>' +
      '<p class="portal-muted">A voz (TTS ou áudio próprio) e a pré-escuta entram com a Telnyx, na Fase 3. Mensagens automáticas por SMS só com consentimento registrado.</p>' +
      '<p><a class="btn btn--ghost btn--xs" href="' + link('config') + '">Ver alterações na auditoria</a></p></section>';
  }

  /* ---------- planos ---------- */
  async function planos(corpo) {
    var ps = P.planos || [];
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Planos e preços</h2><p class="portal-muted">Preço ao cliente. Excedentes ficam em branco até você conferir as tarifas reais na conta da Telnyx; atender pelo app está incluído em todos.</p>' +
      '<form id="tp-f"><div class="table-wrap"><table class="data tel-planos"><thead><tr><th>Código</th><th>Nome</th><th>Número</th><th>Preço/mês (US$)</th><th>Números</th><th>Minutos</th><th>SMS</th><th>Excedente/min (US$)</th><th>Excedente/SMS (US$)</th><th>Ativo</th></tr></thead><tbody>' +
      ps.concat([{ id: '', nome: '', tipo_numero: 'local', preco_cents: 0, numeros_incluidos: 1, minutos: 0, sms: 0, ativo: true, novo: true }]).map(function (p, i) {
        var inp = function (k, v, t, extra) { return '<input aria-label="' + k + '" data-k="' + k + '" type="' + (t || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (extra || '') + '>'; };
        return '<tr data-i="' + i + '"' + (p.novo ? ' class="tel-novo"' : '') + '><td>' + (p.novo ? inp('id', '', 'text', ' placeholder="novo plano" pattern="[a-z0-9_-]{2,40}"') : '<code>' + esc(p.id) + '</code><input type="hidden" data-k="id" value="' + esc(p.id) + '">') + '</td><td>' + inp('nome', p.nome) +
          '</td><td><select data-k="tipo_numero" aria-label="tipo"><option value="local"' + (p.tipo_numero === 'local' ? ' selected' : '') + '>Local</option><option value="tollfree"' + (p.tipo_numero === 'tollfree' ? ' selected' : '') + '>Toll-free</option></select></td>' +
          '<td>' + inp('preco', (p.preco_cents / 100).toFixed(2), 'number', ' step="0.01" min="0"') + '</td><td>' + inp('numeros_incluidos', p.numeros_incluidos, 'number', ' min="1" max="50"') + '</td><td>' + inp('minutos', p.minutos, 'number', ' min="0"') + '</td><td>' + inp('sms', p.sms, 'number', ' min="0"') +
          '</td><td>' + inp('excedente_min_cents', p.excedente_min_cents == null ? '' : (p.excedente_min_cents / 100), 'number', ' step="0.0001" min="0" placeholder="a definir"') + '</td><td>' + inp('excedente_sms_cents', p.excedente_sms_cents == null ? '' : (p.excedente_sms_cents / 100), 'number', ' step="0.0001" min="0" placeholder="a definir"') +
          '</td><td><input type="checkbox" data-k="ativo" aria-label="ativo"' + (p.ativo !== false ? ' checked' : '') + '></td></tr>';
      }).join('') + '</tbody></table></div><div class="portal-btn-row" style="margin-top:1rem"><button class="btn btn--navy" type="submit">Salvar planos</button></div><p class="portal-alert" id="tp-m" role="status" hidden></p></form></section>';
    corpo.querySelector('#tp-f').onsubmit = async function (ev) {
      ev.preventDefault();
      var lista = [];
      corpo.querySelectorAll('tbody tr').forEach(function (tr, i) {
        var g = function (k) { var el = tr.querySelector('[data-k="' + k + '"]'); return el.type === 'checkbox' ? el.checked : el.value.trim(); };
        if (!g('id')) return;
        var cents = function (v) { return v === '' ? null : Math.round(Number(v) * 10000) / 100; };
        lista.push({ id: g('id'), nome: g('nome'), tipo_numero: g('tipo_numero'), preco_cents: Math.round(Number(g('preco')) * 100), numeros_incluidos: +g('numeros_incluidos'), minutos: +g('minutos'), sms: +g('sms'),
          excedente_min_cents: cents(g('excedente_min_cents')), excedente_sms_cents: cents(g('excedente_sms_cents')), ativo: g('ativo'), ordem: i + 1 });
      });
      var m = corpo.querySelector('#tp-m'); msg(m, 'Salvando…');
      try { await call({ acao: 'adm_planos_salvar', planos: lista }); P = await call({ acao: 'adm_painel' }); msg(m, 'Planos salvos.', 'ok'); }
      catch (x) { msg(m, x.message, 'erro'); }
    };
  }

  /* ---------- integrações ---------- */
  async function integracoes(corpo) {
    var e = P.estado, hook = ctx.CFG.functionsUrl + '/telephony-webhook';
    corpo.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Telnyx</h2><p>' + pill(EST[e.estado] || [e.estado, '']) + ' ' + esc(e.texto) + '</p>' +
      '<p class="portal-muted">As chaves ficam só nos Secrets do Supabase (Edge Functions → Secrets). Nunca cole chaves no chat nem no navegador.</p>' +
      '<ul class="tel-check">' + ['TELNYX_API_KEY', 'TELNYX_PUBLIC_KEY', 'TELNYX_CONNECTION_ID', 'TELNYX_MESSAGING_PROFILE_ID'].map(function (k) { return '<li><code>' + k + '</code>' + ((e.faltando || []).indexOf(k) > -1 || e.provedor === 'demo' ? ' <span class="portal-muted">· a cadastrar</span>' : ' <span class="pill pill--live-ok">cadastrada</span>'); }).join('') + '</ul>' +
      '<h3>Webhooks (Fase 2)</h3><p class="portal-muted">Endereço que vai na Telnyx: <code>' + esc(hook) + '</code>. Assinatura Ed25519 conferida (cabeçalhos <code>telnyx-signature-ed25519</code> e <code>telnyx-timestamp</code>), cada evento processado uma vez só.</p>' +
      '<h3>App Endeavor Phone</h3><p class="portal-muted">App instalável (PWA) ligado ao login do portal: <code>' + esc((ctx.siteUrl ? ctx.siteUrl('phone.html') : '/phone.html')) + '</code>. Com o app fechado, o iPhone não garante o toque: a ligação cai no voicemail ou no encaminhamento. O app nativo (push e integração com o sistema de chamadas) fica preparado nas APIs.</p>' +
      '<h3>WhatsApp (adicional opcional)</h3><p class="portal-muted">Pela API oficial, via Telnyx, com o “Conectar WhatsApp” (Embedded Signup da Meta) no portal. Depende da verificação da Endeavor Tax Solutions LLC no Meta Business. Até lá, o ícone do celular virtual abre o WhatsApp Web numa janela ao lado.</p></section>';
  }

  /* ---------- configurações, tarifas e auditoria ---------- */
  async function config(corpo) {
    var s = P.settings, ts = P.tarifas || [];
    corpo.innerHTML = '<form class="portal-card portal-form" id="tc-f"><h2 class="portal-h2">Configurações</h2>' +
      '<div class="field-row"><div class="field"><label for="tc-mg">Margem sobre o encaminhamento (%)</label><input id="tc-mg" type="number" min="0" max="500" step="0.5" value="' + esc(s.margem_encaminhamento_pct) + '"></div>' +
      '<div class="field"><label for="tc-pa">Países liberados para encaminhar</label><input id="tc-pa" value="' + esc((s.paises_encaminhamento || []).join(', ')) + '" placeholder="US, CA, BR"></div></div>' +
      '<div class="field-row"><div class="field"><label for="tc-lim">Limite de gasto extra por mês, padrão (US$)</label><input id="tc-lim" type="number" min="0" step="1" value="' + esc((s.limite_mensal_padrao_cents || 0) / 100) + '"></div>' +
      '<div class="field"><label for="tc-rg">Guardar gravações (dias)</label><input id="tc-rg" type="number" min="1" max="3650" value="' + esc(s.retencao_gravacoes_dias) + '"></div><div class="field"><label for="tc-rv">Guardar voicemail (dias)</label><input id="tc-rv" type="number" min="1" max="3650" value="' + esc(s.retencao_voicemail_dias) + '"></div></div>' +
      '<p class="portal-muted">Alertas de consumo em 80% e 100% da franquia (aviso no sino). Encaminhar soma duas pernas: a entrada no número e a saída para o destino; o Brasil tem tarifa própria.</p>' +
      '<button class="btn btn--navy" type="submit">Salvar</button><p class="portal-alert" id="tc-m" role="status" hidden></p></form>' +
      '<section class="portal-card"><h2 class="portal-h2">Tarifas do provedor (conferidas)</h2><p class="portal-muted">Nunca preço fixo inventado: cada tarifa leva a data em que foi conferida na conta da Telnyx. Sem tarifa, não há estimativa e o encaminhamento não pode ser aceito.</p>' +
      (ts.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>País</th><th>Unidade</th><th>Custo (US$)</th><th>Conferida em</th><th>Fonte</th><th></th></tr></thead><tbody>' + ts.map(function (t) {
        return '<tr><td><code>' + esc(t.item) + '</code></td><td>' + esc(t.pais || '—') + '</td><td>' + esc(t.unidade) + '</td><td>' + esc(Number(t.custo).toFixed(6)) + '</td><td>' + esc(t.verificado_em) + '</td><td>' + esc(t.fonte || '—') + '</td><td><button class="btn btn--ghost btn--xs" type="button" data-apagar="' + t.id + '">Apagar</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="portal-muted">Nenhuma tarifa cadastrada.</p>') +
      '<form class="portal-form" id="tt-f"><div class="field-row"><div class="field"><label for="tt-item">Item</label><select id="tt-item"><option value="voz_entrada_local">Voz – entrada (número local)</option><option value="voz_entrada_tollfree">Voz – entrada (toll-free)</option><option value="voz_saida_US">Voz – saída EUA</option><option value="voz_saida_BR">Voz – saída Brasil</option><option value="voz_saida_CA">Voz – saída Canadá</option><option value="sms_saida">SMS – saída</option><option value="sms_entrada">SMS – entrada</option><option value="numero_local">Número local (mês)</option><option value="numero_tollfree">Número toll-free (mês)</option></select></div>' +
      '<div class="field"><label for="tt-custo">Custo (US$)</label><input id="tt-custo" type="number" min="0" step="0.000001" required></div><div class="field"><label for="tt-data">Conferida em</label><input id="tt-data" type="date" required></div><div class="field"><label for="tt-fonte">Fonte</label><input id="tt-fonte" placeholder="Portal Telnyx › Pricing"></div>' +
      '<div class="field tel-bt-fim"><button class="btn btn--ghost" type="submit">Adicionar tarifa</button></div></div><p class="portal-alert" id="tt-m" role="status" hidden></p></form></section>' +
      '<section class="portal-card"><h2 class="portal-h2">Auditoria</h2><div id="ta"></div></section>';
    corpo.querySelector('#tc-f').onsubmit = async function (ev) {
      ev.preventDefault();
      var m = corpo.querySelector('#tc-m'); msg(m, 'Salvando…');
      try {
        await call({ acao: 'adm_config_salvar', margem_encaminhamento_pct: +corpo.querySelector('#tc-mg').value, paises_encaminhamento: corpo.querySelector('#tc-pa').value.split(/[\s,;]+/).filter(Boolean),
          limite_mensal_padrao_cents: Math.round(+corpo.querySelector('#tc-lim').value * 100), retencao_gravacoes_dias: +corpo.querySelector('#tc-rg').value, retencao_voicemail_dias: +corpo.querySelector('#tc-rv').value });
        msg(m, 'Salvo.', 'ok');
      } catch (x) { msg(m, x.message, 'erro'); }
    };
    corpo.querySelector('#tt-f').onsubmit = async function (ev) {
      ev.preventDefault();
      var item = corpo.querySelector('#tt-item').value, m = corpo.querySelector('#tt-m');
      try {
        await call({ acao: 'adm_tarifa_salvar', item: item, pais: (item.match(/_([A-Z]{2})$/) || [])[1] || '', unidade: /^numero/.test(item) ? 'mes' : /^sms/.test(item) ? 'mensagem' : 'minuto', custo: +corpo.querySelector('#tt-custo').value, verificado_em: corpo.querySelector('#tt-data').value, fonte: corpo.querySelector('#tt-fonte').value });
        P = await call({ acao: 'adm_painel' }); config(corpo);
      } catch (x) { msg(m, x.message, 'erro'); }
    };
    corpo.querySelectorAll('[data-apagar]').forEach(function (b) { b.onclick = async function () { if (!window.confirm('Apagar esta tarifa?')) return; await call({ acao: 'adm_tarifa_apagar', id: b.dataset.apagar }); P = await call({ acao: 'adm_painel' }); config(corpo); }; });
    try {
      var a = (await call({ acao: 'adm_lista', tipo: 'auditoria' })).itens;
      corpo.querySelector('#ta').innerHTML = !a.length ? '<p class="portal-muted">Nada registrado ainda.</p>' : '<div class="table-wrap"><table class="data"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Empresa</th></tr></thead><tbody>' +
        a.map(function (x) { return '<tr><td>' + esc(quando(x.at)) + '</td><td>' + esc(x.actor_email || x.actor_role) + '</td><td><code>' + esc(x.action.replace('telefonia.', '')) + '</code></td><td>' + esc(x.company_id ? nomeEmp(x.company_id) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    } catch (x) { corpo.querySelector('#ta').innerHTML = '<p class="portal-alert portal-alert--error">' + esc(x.message) + '</p>'; }
  }

  /* ---------- ficha do cliente › Telefonia (liberar por empresa) ---------- */
  async function fichaCliente(body, c, cliente, empresas) {
    ctx = c;
    var r = await call({ acao: 'adm_painel' }); P = r;
    var planos = (r.planos || []).filter(function (p) { return p.ativo; });
    body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">Telefonia</h2><p class="portal-muted">Liberada, a empresa vê “Telefonia” no Portal do Cliente: número americano, telefone virtual no navegador, app, SMS, voicemail e encaminhamento. Cada empresa tem plano, limites e permissões próprios.' +
      (r.estado.estado === 'demonstracao' ? ' <strong>Agora em modo demonstração:</strong> nada é real e nada é cobrado.' : '') + '</p>' +
      (!empresas.length ? '<p class="portal-muted">Cadastre uma empresa na aba Empresas primeiro.</p>' : empresas.map(function (co) {
        var a = (r.acessos || []).find(function (x) { return x.company_id === co.id; }) || { enabled: false, sms_permitido: true };
        var nums = (r.numeros || []).filter(function (n) { return n.company_id === co.id; });
        return '<form class="portal-form tel-acesso" data-co="' + co.id + '"><fieldset><legend><strong>' + esc(co.legal_name) + '</strong></legend>' +
          '<div class="check-row"><input type="checkbox" id="ta-on-' + co.id + '" data-k="enabled"' + (a.enabled ? ' checked' : '') + '><label for="ta-on-' + co.id + '">Habilitar Telefonia / Enable Corporate Phone</label></div>' +
          '<div class="field-row"><div class="field"><label for="ta-pl-' + co.id + '">Plano</label><select id="ta-pl-' + co.id + '" data-k="plan_id"><option value="">Escolha</option>' + planos.map(function (p) { return '<option value="' + p.id + '"' + (a.plan_id === p.id ? ' selected' : '') + '>' + esc(p.nome + ' · ' + (p.tipo_numero === 'tollfree' ? 'toll-free' : 'local') + ' · US$ ' + (p.preco_cents / 100).toFixed(2) + ' · ' + p.minutos + ' min · ' + p.sms + ' SMS') + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="ta-lim-' + co.id + '">Limite de gasto extra/mês (US$, vazio = padrão)</label><input id="ta-lim-' + co.id + '" data-k="limite" type="number" min="0" step="1" value="' + (a.limite_mensal_cents == null ? '' : a.limite_mensal_cents / 100) + '"></div></div>' +
          '<div class="check-row"><input type="checkbox" id="ta-sms-' + co.id + '" data-k="sms_permitido"' + (a.sms_permitido !== false ? ' checked' : '') + '><label for="ta-sms-' + co.id + '">SMS</label></div>' +
          '<div class="check-row"><input type="checkbox" id="ta-enc-' + co.id + '" data-k="encaminhamento_permitido"' + (a.encaminhamento_permitido ? ' checked' : '') + '><label for="ta-enc-' + co.id + '">Encaminhamento para outro número (com custo estimado e aceite da empresa)</label></div>' +
          '<div class="check-row"><input type="checkbox" id="ta-grv-' + co.id + '" data-k="gravacao_permitida"' + (a.gravacao_permitida ? ' checked' : '') + '><label for="ta-grv-' + co.id + '">Gravação de ligações (com aviso; consentimento de todas as partes na Flórida)</label></div>' +
          '<p class="portal-muted">Números: ' + (nums.length ? nums.map(function (n) { return esc(fone(n.e164)) + ' (' + esc((ST_NUM[n.status] || [n.status])[0]) + ')'; }).join(', ') : 'nenhum') + ' · <a href="#/telefonia?aba=numeros">procurar e propor</a></p>' +
          '<button class="btn btn--navy" type="submit">Salvar</button><p class="portal-alert" role="status" hidden></p></fieldset></form>';
      }).join('')) + '</section>';
    body.querySelectorAll('form.tel-acesso').forEach(function (f) {
      f.onsubmit = async function (ev) {
        ev.preventDefault();
        var g = function (k) { var el = f.querySelector('[data-k="' + k + '"]'); return el.type === 'checkbox' ? el.checked : el.value; }, m = f.querySelector('.portal-alert');
        msg(m, 'Salvando…');
        try {
          await call({ acao: 'adm_acesso', company_id: f.dataset.co, enabled: g('enabled'), plan_id: g('plan_id') || null, limite_mensal_cents: g('limite') === '' ? null : Math.round(+g('limite') * 100),
            sms_permitido: g('sms_permitido'), encaminhamento_permitido: g('encaminhamento_permitido'), gravacao_permitida: g('gravacao_permitida') });
          msg(m, g('enabled') ? 'Salvo. A Telefonia já aparece no portal desta empresa.' : 'Salvo. A Telefonia está desligada para esta empresa.', 'ok');
        } catch (x) { msg(m, x.message, 'erro'); }
      };
    });
  }

  window.ETelAdmin = { render: render, ficha: fichaCliente };
})();
