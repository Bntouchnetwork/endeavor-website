/* Endeavor Bookkeeping (admin console): double-entry books per company, QuickBooks-style.
   Overview · Bank & transactions (Stripe Financial Connections, Plaid or CSV; rules, history and AI suggestions) ·
   Chart of accounts (with ledger) · Journal entries · Reconciliation · Reports (P&L, Balance Sheet, Cash Flow, Trial Balance)
   and publishing the quarterly PDFs to the client's Documents. Money moves only through the bk_* database functions. */
(function () {
  'use strict';
  var D = {
    pt: {
      title: 'Bookkeeping', lead: 'Contabilidade das empresas dos clientes no padrão QuickBooks: bancos, lançamentos, conciliação e relatórios.',
      pick: 'Empresa', none: 'Nenhuma empresa usa o Endeavor Bookkeeping ainda.', noneTxt: 'Escolha uma empresa abaixo para ativar. O plano de contas padrão de uma LLC americana é criado na hora.',
      enable: 'Ativar Endeavor Bookkeeping', enableFor: 'Ativar para', enabled: 'Bookkeeping ativado.',
      t_overview: 'Visão geral', t_bank: 'Bancos e transações', t_coa: 'Plano de contas', t_journal: 'Lançamentos', t_recon: 'Conciliação', t_reports: 'Relatórios', t_rules: 'Regras',
      k_cash: 'Saldo nos bancos (livros)', k_review: 'Para revisar', k_income: 'Receita no ano', k_exp: 'Despesas no ano', k_net: 'Lucro no ano',
      accounts: 'Contas bancárias e cartões', noAccounts: 'Nenhuma conta conectada. Conecte um banco ou crie uma conta para importar extrato (CSV).',
      connect: 'Conectar conta bancária', connectCard: 'Conectar cartão de crédito', c_titleCard: 'Conectar cartão de crédito', house: 'empresa da Endeavor', sampleTxt: 'Esta empresa tem dados de exemplo (contas, transações e lançamentos marcados como exemplo).', sampleClear: 'Apagar dados de exemplo', sampleQ: 'Apagar todos os dados de exemplo desta empresa (transações, lançamentos e contas de exemplo)? Os dados reais ficam.', sampleDone: 'Dados de exemplo apagados.', multiNote: 'Você pode conectar várias contas e vários cartões. O pagamento do cartão feito pela conta do banco é reconhecido como transferência entre as suas contas, sem contar duas vezes.', bankBal: 'Saldo no banco', bookBal: 'Saldo nos livros', lastSync: 'Última sincronização', never: 'nunca', sync: 'Sincronizar', syncAll: 'Sincronizar tudo', disconnect: 'Desconectar', importCsv: 'Importar CSV',
      c_title: 'Conectar conta bancária', c_stripe: 'Stripe Financial Connections', c_stripeTxt: 'Usa a conta Stripe da Endeavor. Cobre os principais bancos dos EUA.', c_plaid: 'Plaid', c_plaidTxt: 'Padrão do mercado de contabilidade. Cobre mais bancos e fintechs.',
      c_manual: 'Conta manual (extrato CSV)', c_manualTxt: 'Para bancos sem conexão: você importa o extrato em CSV.', c_off: 'Falta configurar as chaves no Supabase', c_name: 'Nome da conta', c_kind: 'Tipo', c_mask: 'Final do número (opcional)', c_create: 'Criar conta',
      k_checking: 'Conta corrente', k_savings: 'Poupança', k_credit_card: 'Cartão de crédito', k_other: 'Outra',
      f_review: 'Para revisar', f_posted: 'Lançadas', f_excluded: 'Excluídas', allAcc: 'Todas as contas', search: 'Buscar', date: 'Data', desc: 'Descrição', amount: 'Valor', category: 'Categoria', actions: 'Ações',
      accept: 'Aceitar', exclude: 'Excluir', undo: 'Desfazer', restore: 'Restaurar', acceptSel: 'Aceitar selecionados', aiBtn: 'Sugerir com IA', aiWorking: 'A IA está analisando as transações…', aiDone: '{n} sugestões da IA.', aiOff: 'A IA não está configurada (ANTHROPIC_API_KEY).',
      s_rule: 'Regra', s_ai: 'IA', s_history: 'Histórico', mkRule: 'Criar regra', ruleQ: 'Sempre que a descrição contiver este texto, usar a mesma categoria:', noTx: 'Nenhuma transação aqui.', pending: 'pendente',
      posted: '{n} transações lançadas.', imported: '{n} transações importadas.', choose: 'Escolha…', selAll: 'Selecionar todas',
      coaNew: 'Nova conta', code: 'Código', name: 'Nome', type: 'Tipo', subtype: 'Detalhe', balance: 'Saldo', active: 'Ativa', inactive: 'Inativa', edit: 'Editar', save: 'Salvar', cancel: 'Cancelar', descr: 'Descrição (opcional)', ledger: 'Razão', deactivate: 'Desativar', activate: 'Reativar', system: 'Conta do sistema',
      ty_asset: 'Ativo', ty_liability: 'Passivo', ty_equity: 'Patrimônio', ty_income: 'Receita', ty_expense: 'Despesa',
      jNew: 'Novo lançamento', jMemo: 'Histórico', debit: 'Débito', credit: 'Crédito', addLine: 'Adicionar linha', diff: 'Diferença', post: 'Lançar', voidE: 'Anular', voidQ: 'Anular este lançamento? Se veio do banco, a transação volta para revisão.', number: 'Nº', source: 'Origem', from: 'De', to: 'Até', noJ: 'Nenhum lançamento no período.',
      src_manual: 'Manual', src_bank: 'Banco', src_opening: 'Saldo inicial', src_adjustment: 'Ajuste', src_import: 'Importação', opening: 'Saldo de abertura',
      rAcc: 'Conta', rDate: 'Data do extrato', rBal: 'Saldo final do extrato', rStart: 'Começar', rOpen: 'Saldo já conciliado', rCleared: 'Marcados', rDiff: 'Diferença', rFinish: 'Concluir conciliação', rDone: 'Conciliação concluída.', rHist: 'Conciliações anteriores', rNone: 'Nenhuma conciliação ainda.', rNoLines: 'Nenhum lançamento a conciliar até essa data.',
      rep_pl: 'Demonstração de resultado (P&L)', rep_bs: 'Balanço patrimonial', rep_cf: 'Fluxo de caixa', rep_tb: 'Balancete', period: 'Período', p_month: 'Este mês', p_quarter: 'Este trimestre', p_year: 'Este ano', p_last: 'Ano passado', p_custom: 'Personalizado',
      run: 'Gerar', csv: 'Exportar CSV', publish: 'Publicar para o cliente', pubQ: 'Gerar os PDFs (P&L, Balanço e Fluxo de caixa) e colocar nos Documentos do cliente?', pubDone: 'Relatórios publicados em Documentos do cliente.', year: 'Ano', quarter: 'Período', q1: '1º trimestre', q2: '2º trimestre', q3: '3º trimestre', q4: '4º trimestre', q0: 'Ano completo',
      total: 'Total', netIncome: 'Lucro líquido', grossProfit: 'Lucro bruto', opIncome: 'Resultado operacional', totAssets: 'Total do ativo', totLiab: 'Total do passivo', totEq: 'Total do patrimônio', totLE: 'Passivo + patrimônio', re: 'Lucros acumulados', niYtd: 'Lucro do ano',
      cfOp: 'Caixa das operações', cfNet: 'Variação de caixa no período', cfStart: 'Caixa no início', cfEnd: 'Caixa no fim', balanced: 'Balanço fechado', unbalanced: 'Atenção: o balanço não fecha',
      ruleNew: 'Nova regra', ruleText: 'Texto na descrição', ruleDir: 'Sentido', d_any: 'Entradas e saídas', d_in: 'Só entradas', d_out: 'Só saídas', ruleAcc: 'Categoria', noRules: 'Nenhuma regra ainda. Crie regras para categorizar automaticamente.', del: 'Excluir',
      csvTitle: 'Importar extrato (CSV)', csvFile: 'Arquivo CSV do banco', csvDate: 'Coluna da data', csvDesc: 'Coluna da descrição', csvAmt: 'Coluna do valor', csvDebit: 'Coluna de saídas (opcional)', csvCredit: 'Coluna de entradas (opcional)', csvFmt: 'Formato da data', csvFlip: 'Inverter sinal (o banco mostra saídas como positivas)', csvPrev: 'Prévia', csvGo: 'Importar', csvBad: 'Não consegui ler o arquivo. Confira as colunas e o formato da data.',
      err: { not_balanced: 'Débitos e créditos não batem.', needs_two_lines: 'O lançamento precisa de pelo menos duas linhas.', line_needs_debit_or_credit: 'Cada linha precisa de débito ou crédito (não os dois).', invalid_account: 'Conta inválida.', reconciled: 'Esse lançamento já foi conciliado.', same_account: 'A categoria não pode ser a própria conta do banco.', stripe_not_configured: 'Stripe não configurado.', plaid_not_configured: 'Plaid não configurado (PLAID_CLIENT_ID e PLAID_SECRET).', books_not_enabled: 'Ative o Endeavor Bookkeeping para esta empresa.', future_period: 'Esse período ainda não começou.' },
      loading: 'Carregando…', confirm: 'Confirmar', close: 'Fechar', yes: 'Sim'
    },
    en: {
      title: 'Bookkeeping', lead: "Books for clients' companies, QuickBooks-style: banks, journal, reconciliation and reports.",
      pick: 'Company', none: 'No company uses Endeavor Bookkeeping yet.', noneTxt: 'Pick a company below to turn it on. The standard chart of accounts for a US LLC is created right away.',
      enable: 'Turn on Endeavor Bookkeeping', enableFor: 'Turn on for', enabled: 'Bookkeeping turned on.',
      t_overview: 'Overview', t_bank: 'Banking', t_coa: 'Chart of accounts', t_journal: 'Journal', t_recon: 'Reconcile', t_reports: 'Reports', t_rules: 'Rules',
      k_cash: 'Cash in banks (books)', k_review: 'For review', k_income: 'Income this year', k_exp: 'Expenses this year', k_net: 'Net income this year',
      accounts: 'Bank and card accounts', noAccounts: 'No accounts yet. Connect a bank or create an account to import statements (CSV).',
      connect: 'Connect bank', bankBal: 'Bank balance', bookBal: 'Books balance', lastSync: 'Last sync', never: 'never', sync: 'Sync', syncAll: 'Sync all', disconnect: 'Disconnect', importCsv: 'Import CSV',
      connect: 'Connect bank account', connectCard: 'Connect credit card', c_titleCard: 'Connect a credit card', house: "Endeavor's company", sampleTxt: 'This company has sample data (accounts, transactions and entries marked as sample).', sampleClear: 'Delete sample data', sampleQ: 'Delete all sample data of this company (sample transactions, entries and accounts)? Real data stays.', sampleDone: 'Sample data deleted.', multiNote: 'You can connect several accounts and cards. A card payment made from the bank account is recognized as a transfer between your own accounts, so it is not counted twice.',
      c_title: 'Connect a bank account', c_stripe: 'Stripe Financial Connections', c_stripeTxt: "Uses Endeavor's Stripe account. Covers the main US banks.", c_plaid: 'Plaid', c_plaidTxt: 'The accounting industry standard. Covers more banks and fintechs.',
      c_manual: 'Manual account (CSV statement)', c_manualTxt: 'For banks without a connection: you import the statement as CSV.', c_off: 'Keys not set in Supabase yet', c_name: 'Account name', c_kind: 'Type', c_mask: 'Last digits (optional)', c_create: 'Create account',
      k_checking: 'Checking', k_savings: 'Savings', k_credit_card: 'Credit card', k_other: 'Other',
      f_review: 'For review', f_posted: 'Categorized', f_excluded: 'Excluded', allAcc: 'All accounts', search: 'Search', date: 'Date', desc: 'Description', amount: 'Amount', category: 'Category', actions: 'Actions',
      accept: 'Accept', exclude: 'Exclude', undo: 'Undo', restore: 'Restore', acceptSel: 'Accept selected', aiBtn: 'Suggest with AI', aiWorking: 'The AI is reviewing the transactions…', aiDone: '{n} AI suggestions.', aiOff: 'AI is not configured (ANTHROPIC_API_KEY).',
      s_rule: 'Rule', s_ai: 'AI', s_history: 'History', mkRule: 'Create rule', ruleQ: 'Whenever the description contains this text, use the same category:', noTx: 'No transactions here.', pending: 'pending',
      posted: '{n} transactions categorized.', imported: '{n} transactions imported.', choose: 'Choose…', selAll: 'Select all',
      coaNew: 'New account', code: 'Code', name: 'Name', type: 'Type', subtype: 'Detail', balance: 'Balance', active: 'Active', inactive: 'Inactive', edit: 'Edit', save: 'Save', cancel: 'Cancel', descr: 'Description (optional)', ledger: 'Ledger', deactivate: 'Deactivate', activate: 'Reactivate', system: 'System account',
      ty_asset: 'Asset', ty_liability: 'Liability', ty_equity: 'Equity', ty_income: 'Income', ty_expense: 'Expense',
      jNew: 'New journal entry', jMemo: 'Memo', debit: 'Debit', credit: 'Credit', addLine: 'Add line', diff: 'Difference', post: 'Post', voidE: 'Void', voidQ: 'Void this entry? If it came from the bank, the transaction goes back to review.', number: 'No.', source: 'Source', from: 'From', to: 'To', noJ: 'No entries in this period.',
      src_manual: 'Manual', src_bank: 'Bank', src_opening: 'Opening balance', src_adjustment: 'Adjustment', src_import: 'Import', opening: 'Opening balance',
      rAcc: 'Account', rDate: 'Statement date', rBal: 'Statement ending balance', rStart: 'Start', rOpen: 'Already reconciled', rCleared: 'Cleared', rDiff: 'Difference', rFinish: 'Finish reconciliation', rDone: 'Reconciliation finished.', rHist: 'Past reconciliations', rNone: 'No reconciliations yet.', rNoLines: 'Nothing to reconcile up to this date.',
      rep_pl: 'Profit and Loss', rep_bs: 'Balance Sheet', rep_cf: 'Statement of Cash Flows', rep_tb: 'Trial Balance', period: 'Period', p_month: 'This month', p_quarter: 'This quarter', p_year: 'This year', p_last: 'Last year', p_custom: 'Custom',
      run: 'Run', csv: 'Export CSV', publish: 'Publish to client', pubQ: "Create the PDFs (P&L, Balance Sheet and Cash Flow) and add them to the client's Documents?", pubDone: "Reports published to the client's Documents.", year: 'Year', quarter: 'Period', q1: 'Q1', q2: 'Q2', q3: 'Q3', q4: 'Q4', q0: 'Full year',
      total: 'Total', netIncome: 'Net income', grossProfit: 'Gross profit', opIncome: 'Net operating income', totAssets: 'Total assets', totLiab: 'Total liabilities', totEq: 'Total equity', totLE: 'Liabilities + equity', re: 'Retained earnings', niYtd: 'Net income (year to date)',
      cfOp: 'Net cash from operating activities', cfNet: 'Net change in cash', cfStart: 'Cash at beginning', cfEnd: 'Cash at end', balanced: 'Balanced', unbalanced: 'Warning: the balance sheet is out of balance',
      ruleNew: 'New rule', ruleText: 'Text in description', ruleDir: 'Direction', d_any: 'Money in and out', d_in: 'Money in only', d_out: 'Money out only', ruleAcc: 'Category', noRules: 'No rules yet. Create rules to categorize automatically.', del: 'Delete',
      csvTitle: 'Import statement (CSV)', csvFile: "Bank's CSV file", csvDate: 'Date column', csvDesc: 'Description column', csvAmt: 'Amount column', csvDebit: 'Money out column (optional)', csvCredit: 'Money in column (optional)', csvFmt: 'Date format', csvFlip: 'Flip sign (bank shows money out as positive)', csvPrev: 'Preview', csvGo: 'Import', csvBad: 'Could not read the file. Check the columns and the date format.',
      err: { not_balanced: 'Debits and credits do not match.', needs_two_lines: 'An entry needs at least two lines.', line_needs_debit_or_credit: 'Each line needs a debit or a credit (not both).', invalid_account: 'Invalid account.', reconciled: 'This entry is already reconciled.', same_account: 'The category cannot be the bank account itself.', stripe_not_configured: 'Stripe is not configured.', plaid_not_configured: 'Plaid is not configured (PLAID_CLIENT_ID and PLAID_SECRET).', books_not_enabled: 'Turn on Endeavor Bookkeeping for this company.', future_period: 'That period has not started yet.' },
      loading: 'Loading…', confirm: 'Confirm', close: 'Close', yes: 'Yes'
    }
  };
  var SUB = { asset: ['bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset'], liability: ['credit_card', 'accounts_payable', 'other_current_liability', 'long_term_liability'],
    equity: ['equity', 'retained_earnings'], income: ['income', 'other_income'], expense: ['cogs', 'expense', 'other_expense'] };
  var SUBL = { pt: { bank: 'Banco', accounts_receivable: 'Contas a receber', other_current_asset: 'Outros ativos circulantes', fixed_asset: 'Imobilizado', other_asset: 'Outros ativos', credit_card: 'Cartão de crédito', accounts_payable: 'Contas a pagar',
      other_current_liability: 'Outros passivos circulantes', long_term_liability: 'Passivo de longo prazo', equity: 'Patrimônio', retained_earnings: 'Lucros acumulados', income: 'Receita', other_income: 'Outras receitas', cogs: 'Custo dos produtos/serviços', expense: 'Despesa', other_expense: 'Outras despesas' },
    en: { bank: 'Bank', accounts_receivable: 'Accounts receivable', other_current_asset: 'Other current assets', fixed_asset: 'Fixed assets', other_asset: 'Other assets', credit_card: 'Credit card', accounts_payable: 'Accounts payable',
      other_current_liability: 'Other current liabilities', long_term_liability: 'Long-term liabilities', equity: 'Equity', retained_earnings: 'Retained earnings', income: 'Income', other_income: 'Other income', cogs: 'Cost of goods sold', expense: 'Expenses', other_expense: 'Other expenses' } };
  var L = window.ADMIN_LANG === 'en' ? 'en' : 'pt', T = D[L], LOC = L === 'en' ? 'en-US' : 'pt-BR';
  function t(k, v) { var s = T[k] != null ? T[k] : (D.pt[k] || k); if (v) Object.keys(v).forEach(function (x) { s = s.split('{' + x + '}').join(v[x]); }); return s; }
  var money = function (c) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(c) || 0) / 100); };
  var moneyN = function (c) { var n = Number(c) || 0, s = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n) / 100); return n < 0 ? '(' + s + ')' : s; };
  function parseMoney(v) { var s = String(v == null ? '' : v).trim().replace(/[$\s]/g, ''); if (!s) return 0; var neg = /^\(.*\)$/.test(s) || /^-/.test(s); s = s.replace(/[()\-+]/g, '');
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.'); if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    var n = Math.round(parseFloat(s) * 100); return isNaN(n) ? NaN : (neg ? -n : n); }
  var iso = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var fmtD = function (s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return L === 'en' ? p[1] + '/' + p[2] + '/' + p[0] : p[2] + '/' + p[1] + '/' + p[0]; };
  var E = function (ctx, e) { var m = (e && e.message) || String(e || ''); var k = Object.keys(T.err).find(function (x) { return m.indexOf(x) > -1; }); return k ? T.err[k] : ctx.errText(e); };
  function loadScript(src) { return new Promise(function (ok, no) { if (document.querySelector('script[src="' + src + '"]')) return ok(); var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { no(new Error('script')); }; document.head.appendChild(s); }); }
  async function call(ctx, payload) {
    var sess = (await ctx.sb.auth.getSession()).data.session;
    var r = await fetch(ctx.CFG.functionsUrl + '/books', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ctx.CFG.supabaseKey, Authorization: 'Bearer ' + sess.access_token }, body: JSON.stringify(payload) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok || j.error) { var er = new Error(j.error || 'HTTP ' + r.status); er.detail = j.detail; throw er; }
    return j;
  }
  function param(k) { var m = (location.hash.split('?')[1] || '').match(new RegExp('(?:^|&)' + k + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function go(co, tab, extra) { ERoute.set('#/bookkeeping?co=' + co + '&tab=' + tab + (extra || ''), false); }
  function acctOptions(accts, sel, filter) {
    var groups = ['income', 'expense', 'asset', 'liability', 'equity'];
    return '<option value="">' + t('choose') + '</option>' + groups.map(function (g) {
      var list = accts.filter(function (a) { return a.type === g && a.is_active && (!filter || filter(a)); });
      return list.length ? '<optgroup label="' + t('ty_' + g) + '">' + list.map(function (a) { return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + a.code + ' · ' + escH(a.name) + '</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
  }
  var escH = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------------- main view ---------------- */
  async function view(root, ctx) {
    var esc = ctx.esc, sb = ctx.sb;
    root.innerHTML = '<p class="portal-muted">' + t('loading') + '</p>';
    var cos = await ctx.q(sb.from('companies').select('id, legal_name, client_id, books_provider, fiscal_year_end, is_house, clients(name)').neq('status', 'dissolved').order('legal_name'));
    cos.sort(function (a, b) { return (b.is_house ? 1 : 0) - (a.is_house ? 1 : 0); }); // Endeavor's own company first
    var on = cos.filter(function (c) { return c.books_provider === 'endeavor'; });
    var co = on.find(function (c) { return c.id === param('co'); }) || on.find(function (c) { return c.is_house; }) || on[0];
    var head = '<div class="console__head"><div><h1 class="portal-h1">' + t('title') + '</h1><p class="portal-muted">' + t('lead') + '</p></div></div>';
    var enableBox = function () {
      var off = cos.filter(function (c) { return c.books_provider !== 'endeavor'; });
      return off.length ? '<div class="bk-enable"><label for="bk-en-co">' + t('enableFor') + '</label><select id="bk-en-co">' + off.map(function (c) { return '<option value="' + c.id + '">' + esc(c.legal_name) + (c.clients ? ' · ' + esc(c.clients.name) : '') + (c.books_provider === 'quickbooks' ? ' (QuickBooks)' : '') + '</option>'; }).join('') + '</select><button class="btn btn--ghost btn--sm" type="button" id="bk-en">' + t('enable') + '</button></div>' : '';
    };
    if (!co) {
      root.innerHTML = head + '<section class="portal-card empty-state"><strong>' + t('none') + '</strong><p>' + t('noneTxt') + '</p>' + enableBox() + '</section>';
      wireEnable(); return;
    }
    var tab = param('tab') || 'overview';
    var tabs = ['overview', 'bank', 'coa', 'journal', 'recon', 'reports', 'rules'];
    root.innerHTML = head + '<div class="bk-top"><div class="bk-co"><label for="bk-co">' + t('pick') + '</label><select id="bk-co">' + on.map(function (c) { return '<option value="' + c.id + '"' + (c.id === co.id ? ' selected' : '') + '>' + esc(c.legal_name) + (!c.is_house && c.clients ? ' · ' + esc(c.clients.name) : '') + '</option>'; }).join('') + '</select></div>' +
      '<details class="bk-more"><summary>' + t('enable') + '</summary>' + enableBox() + '</details></div>' +
      '<nav class="bk-tabs" aria-label="' + t('title') + '">' + tabs.map(function (k) { return '<a href="#/bookkeeping?co=' + co.id + '&tab=' + k + '"' + (k === tab ? ' aria-current="page"' : '') + '>' + t('t_' + k) + '</a>'; }).join('') + '</nav><div id="bk-body"></div>';
    $('#bk-co').onchange = function () { go(this.value, tab); };
    wireEnable();
    var body = $('#bk-body');
    var accts = await ctx.q(sb.from('bk_accounts').select('*').eq('company_id', co.id).order('code'));
    var X = { ctx: ctx, co: co, accts: accts, body: body, reload: function () { ctx.route(); } };
    var fn = { overview: tOverview, bank: tBank, coa: tCoa, journal: tJournal, recon: tRecon, reports: tReports, rules: tRules }[tab] || tOverview;
    await fn(X);
    function wireEnable() {
      var b = $('#bk-en'); if (!b) return;
      b.onclick = async function () { var id = $('#bk-en-co').value; b.disabled = true; var r = await sb.rpc('bk_set_provider', { p_company: id, p_provider: 'endeavor' }); b.disabled = false; if (r.error) return alert(E(ctx, r.error)); go(id, 'overview'); };
    }
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- overview ---------------- */
  async function tOverview(X) {
    var sb = X.ctx.sb, y = new Date().getFullYear(), today = iso(new Date());
    var res = await Promise.all([sb.rpc('bk_report', { p_company: X.co.id, p_kind: 'pl', p_from: y + '-01-01', p_to: today }), sb.rpc('bk_report', { p_company: X.co.id, p_kind: 'bs', p_from: null, p_to: today }),
      sb.from('bk_transactions').select('id', { count: 'exact', head: true }).eq('company_id', X.co.id).eq('status', 'review'), sb.from('bk_bank_accounts').select('*').eq('company_id', X.co.id).eq('is_active', true).order('created_at')]);
    var pl = res[0].data || {}, bs = res[1].data || {}, review = res[2].count || 0, banks = res[3].data || [];
    var sec = function (r, k) { return ((r.sections || []).find(function (s) { return s.key === k; }) || {}); };
    var inc = (sec(pl, 'income').total || 0) + (sec(pl, 'other_income').total || 0), exp = (sec(pl, 'cogs').total || 0) + (sec(pl, 'expense').total || 0) + (sec(pl, 'other_expense').total || 0);
    var bal = {}; (bs.sections || []).forEach(function (s) { (s.rows || []).forEach(function (r) { bal[r.account_id] = r.amount; }); });
    X.body.innerHTML = '<div class="kpis">' + [[t('k_cash'), money(sec(bs, 'bank').total)], [t('k_review'), String(review)], [t('k_income'), money(inc)], [t('k_exp'), money(exp)], [t('k_net'), money(pl.net_income)]].map(function (k, i) {
      return '<div class="kpi' + (i === 1 && review ? ' kpi--alert' : '') + '"><span class="kpi__label">' + k[0] + '</span><strong class="kpi__value">' + k[1] + '</strong></div>'; }).join('') + '</div>' +
      '<section class="portal-card"><div class="bk-row"><h2 class="portal-h2">' + t('accounts') + '</h2><a class="btn btn--navy btn--sm" href="#/bookkeeping?co=' + X.co.id + '&tab=bank">' + t('t_bank') + '</a></div>' +
      (banks.length ? '<table class="bk-table"><thead><tr><th>' + t('name') + '</th><th class="num">' + t('bankBal') + '</th><th class="num">' + t('bookBal') + '</th></tr></thead><tbody>' + banks.map(function (b) {
        return '<tr><td>' + escH(b.name) + (b.mask ? ' ···' + escH(b.mask) : '') + ' <span class="pill">' + t('k_' + b.kind) + '</span></td><td class="num">' + (b.balance_cents == null ? '—' : money(b.balance_cents)) + '</td><td class="num">' + money(bal[b.ledger_account_id] || 0) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="empty">' + t('noAccounts') + '</p>') + '</section>' +
      (review ? '<section class="portal-card bk-cta"><strong>' + t('k_review') + ': ' + review + '</strong><a class="btn btn--gold btn--sm" href="#/bookkeeping?co=' + X.co.id + '&tab=bank">' + t('t_bank') + '</a></section>' : '');
  }

  /* ---------------- banking ---------------- */
  async function tBank(X) {
    var ctx = X.ctx, sb = ctx.sb, f = param('f') || 'review', accF = param('acc') || '';
    var res = await Promise.all([sb.from('bk_bank_accounts').select('*, bk_connections(id, provider, institution, status, last_sync_at, last_error)').eq('company_id', X.co.id).eq('is_active', true).order('created_at'),
      sb.from('bk_transactions').select('*').eq('company_id', X.co.id).eq('status', f).order('txn_date', { ascending: false }).limit(500),
      sb.rpc('bk_report', { p_company: X.co.id, p_kind: 'tb', p_from: null, p_to: iso(new Date()) }),
      sb.from('bk_transactions').select('status').eq('company_id', X.co.id).in('status', ['review'])]);
    var banks = res[0].data || [], txns = res[1].data || [], tb = (res[2].data || {}).rows || [], nRev = (res[3].data || []).length;
    var bookBal = function (b) { var r = tb.find(function (x) { return x.account_id === b.ledger_account_id; }); return r ? (b.kind === 'credit_card' ? (r.credit - r.debit) : (r.debit - r.credit)) : 0; };
    var byId = {}; X.accts.forEach(function (a) { byId[a.id] = a; });
    var bankName = {}; banks.forEach(function (b) { bankName[b.id] = b.name + (b.mask ? ' ···' + b.mask : ''); });
    var sample = banks.some(function (b) { return /^sample/.test(b.external_id || '') || (b.bk_connections && b.bk_connections.provider === 'csv' && /exemplo|sample/i.test(b.bk_connections.institution || '')); });
    X.body.innerHTML = '<section class="portal-card"><div class="bk-row"><h2 class="portal-h2">' + t('accounts') + '</h2><div class="portal-btn-row"><button class="btn btn--ghost btn--sm" type="button" id="bk-syncall">' + t('syncAll') + '</button><button class="btn btn--navy btn--sm" type="button" id="bk-connect">' + t('connect') + '</button><button class="btn btn--navy btn--sm" type="button" id="bk-connect-card">' + t('connectCard') + '</button></div></div><p class="portal-muted" style="font-size:.85rem;margin:.25rem 0 .75rem">' + t('multiNote') + '</p>' +
      (sample ? '<div class="portal-alert portal-alert--info bk-sample" style="display:flex"><span>' + t('sampleTxt') + '</span><button class="btn btn--ghost btn--xs" type="button" id="bk-sample">' + t('sampleClear') + '</button></div>' : '') +
      '<div class="portal-alert" id="bk-m" role="status"></div>' +
      (banks.length ? '<div class="bk-banks">' + banks.map(function (b) {
        var c = b.bk_connections;
        return '<article class="bk-bank"><div><strong>' + escH(b.name) + (b.mask ? ' ···' + escH(b.mask) : '') + '</strong><span class="pill">' + t('k_' + b.kind) + '</span></div>' +
          '<dl><dt>' + t('bankBal') + '</dt><dd>' + (b.balance_cents == null ? '—' : money(b.kind === 'credit_card' ? Math.abs(b.balance_cents) : b.balance_cents)) + '</dd><dt>' + t('bookBal') + '</dt><dd>' + money(bookBal(b)) + '</dd></dl>' +
          '<p class="bk-meta">' + (c ? escH(c.institution || c.provider) + ' · ' + t('lastSync') + ': ' + (c.last_sync_at ? X.ctx.fmtDT(c.last_sync_at) : t('never')) : 'CSV') + '</p>' + (c && c.last_error ? '<p class="bk-err">' + escH(c.last_error) + '</p>' : '') +
          '<div class="portal-btn-row">' + (c && c.provider !== 'csv' ? '<button class="btn btn--ghost btn--xs" type="button" data-sync="' + c.id + '">' + t('sync') + '</button><button class="btn btn--ghost btn--xs" type="button" data-disc="' + c.id + '">' + t('disconnect') + '</button>' : '') +
          '<button class="btn btn--ghost btn--xs" type="button" data-csv="' + b.id + '">' + t('importCsv') + '</button></div></article>';
      }).join('') + '</div>' : '<p class="empty">' + t('noAccounts') + '</p>') + '</section>' +
      '<section class="portal-card"><div class="bk-row"><div class="seg" role="group">' + ['review', 'posted', 'excluded'].map(function (k) { return '<button type="button" data-f="' + k + '" aria-pressed="' + (k === f) + '">' + t('f_' + k) + (k === 'review' && nRev ? ' <span class="nav-badge">' + nRev + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="portal-btn-row"><select id="bk-acc" aria-label="' + t('rAcc') + '"><option value="">' + t('allAcc') + '</option>' + banks.map(function (b) { return '<option value="' + b.id + '"' + (b.id === accF ? ' selected' : '') + '>' + escH(bankName[b.id]) + '</option>'; }).join('') + '</select>' +
      '<input type="search" id="bk-q" placeholder="' + t('search') + '" aria-label="' + t('search') + '">' +
      (f === 'review' ? '<button class="btn btn--ghost btn--sm" type="button" id="bk-ai">' + t('aiBtn') + '</button><button class="btn btn--navy btn--sm" type="button" id="bk-acceptsel">' + t('acceptSel') + '</button>' : '') + '</div></div>' +
      '<div class="portal-alert" id="bk-tm" role="status"></div><div class="bk-scroll"><table class="bk-table bk-tx"><thead><tr>' + (f === 'review' ? '<th class="chk"><input type="checkbox" id="bk-all" aria-label="' + t('selAll') + '"></th>' : '') +
      '<th>' + t('date') + '</th><th>' + t('desc') + '</th><th class="num">' + t('amount') + '</th><th>' + t('category') + '</th><th>' + t('actions') + '</th></tr></thead><tbody id="bk-tb"></tbody></table></div></section>';
    function draw() {
      var s = $('#bk-q').value.trim().toLowerCase(), a = $('#bk-acc').value;
      var rows = txns.filter(function (x) { return (!a || x.bank_account_id === a) && (!s || (x.description + ' ' + (x.merchant || '')).toLowerCase().indexOf(s) > -1); });
      $('#bk-tb').innerHTML = rows.length ? rows.map(function (x) {
        var sug = x.suggested_account_id, cur = x.account_id || sug;
        var badge = f === 'review' && sug && x.suggest_source ? '<span class="bk-sug bk-sug--' + x.suggest_source + '" title="' + escH(x.ai_reason || '') + '">' + t('s_' + x.suggest_source) + (x.suggest_source === 'ai' && x.ai_confidence != null ? ' ' + Math.round(x.ai_confidence * 100) + '%' : '') + '</span>' : '';
        return '<tr data-id="' + x.id + '">' + (f === 'review' ? '<td class="chk"><input type="checkbox" class="bk-sel" aria-label="' + escH(x.description) + '"></td>' : '') +
          '<td class="nowrap">' + fmtD(x.txn_date) + (x.pending ? ' <span class="pill">' + t('pending') + '</span>' : '') + '</td>' +
          '<td><div class="bk-desc">' + escH(x.merchant || x.description) + '</div>' + (x.merchant ? '<div class="bk-meta">' + escH(x.description) + '</div>' : '') + (a ? '' : '<div class="bk-meta">' + escH(bankName[x.bank_account_id] || '') + '</div>') + '</td>' +
          '<td class="num ' + (x.amount_cents > 0 ? 'bk-in' : 'bk-out') + '">' + moneyN(x.amount_cents) + '</td>' +
          '<td>' + (f === 'review' ? '<select class="bk-cat" aria-label="' + t('category') + '">' + acctOptions(X.accts, cur, function (ac) { return !ac.is_system || ac.code === '6999' || ac.code === '4999' || ac.code === '3999'; }) + '</select>' + badge
            : escH(byId[x.account_id] ? byId[x.account_id].code + ' · ' + byId[x.account_id].name : '—')) + '</td>' +
          '<td class="nowrap">' + (f === 'review' ? '<button class="btn btn--navy btn--xs" type="button" data-acc="1">' + t('accept') + '</button> <button class="btn btn--ghost btn--xs" type="button" data-rule="1" title="' + t('mkRule') + '">+' + t('s_rule') + '</button> <button class="btn btn--ghost btn--xs" type="button" data-ex="1">' + t('exclude') + '</button>'
            : f === 'posted' ? '<button class="btn btn--ghost btn--xs" type="button" data-undo="1">' + t('undo') + '</button>' : '<button class="btn btn--ghost btn--xs" type="button" data-res="1">' + t('restore') + '</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">' + t('noTx') + '</td></tr>';
      $$('#bk-tb tr[data-id]').forEach(function (tr) {
        var id = tr.dataset.id, x = txns.find(function (z) { return z.id === id; });
        var acc = $('[data-acc]', tr), rule = $('[data-rule]', tr), ex = $('[data-ex]', tr), undo = $('[data-undo]', tr), rs = $('[data-res]', tr);
        if (acc) acc.onclick = async function () { var v = $('.bk-cat', tr).value; if (!v) return $('.bk-cat', tr).focus(); acc.disabled = true; var r = await sb.rpc('bk_accept_txn', { p_txn: id, p_account: v }); if (r.error) { acc.disabled = false; return ctx.msg($('#bk-tm'), E(ctx, r.error), 'error'); } tr.remove(); };
        if (rule) rule.onclick = async function () { var v = $('.bk-cat', tr).value; if (!v) return $('.bk-cat', tr).focus(); var txt = prompt(t('ruleQ'), (x.merchant || x.description).replace(/[0-9#*]+/g, ' ').trim().slice(0, 30)); if (!txt) return;
          var r = await sb.rpc('bk_accept_txn', { p_txn: id, p_account: v, p_rule: txt }); if (r.error) return ctx.msg($('#bk-tm'), E(ctx, r.error), 'error'); X.reload(); };
        if (ex) ex.onclick = async function () { var r = await sb.rpc('bk_set_txn_status', { p_txn: id, p_status: 'excluded' }); if (r.error) return ctx.msg($('#bk-tm'), E(ctx, r.error), 'error'); tr.remove(); };
        if (undo) undo.onclick = async function () { var r = await sb.rpc('bk_set_txn_status', { p_txn: id, p_status: 'review' }); if (r.error) return ctx.msg($('#bk-tm'), E(ctx, r.error), 'error'); tr.remove(); };
        if (rs) rs.onclick = async function () { var r = await sb.rpc('bk_set_txn_status', { p_txn: id, p_status: 'review' }); if (r.error) return ctx.msg($('#bk-tm'), E(ctx, r.error), 'error'); tr.remove(); };
      });
      if ($('#bk-all')) $('#bk-all').onchange = function () { var on = this.checked; $$('.bk-sel').forEach(function (c) { c.checked = on; }); };
    }
    $('#bk-q').oninput = draw; $('#bk-acc').onchange = function () { go(X.co.id, 'bank', '&f=' + f + (this.value ? '&acc=' + this.value : '')); };
    $$('[data-f]').forEach(function (b) { b.onclick = function () { go(X.co.id, 'bank', '&f=' + b.dataset.f + (accF ? '&acc=' + accF : '')); }; });
    draw();
    if ($('#bk-acceptsel')) $('#bk-acceptsel').onclick = async function () {
      var sel = $$('.bk-sel:checked').map(function (c) { var tr = c.closest('tr'); return { id: tr.dataset.id, acc: $('.bk-cat', tr).value }; }).filter(function (x) { return x.acc; });
      if (!sel.length) return; this.disabled = true; var n = 0, err = null;
      for (var i = 0; i < sel.length; i++) { var r = await sb.rpc('bk_accept_txn', { p_txn: sel[i].id, p_account: sel[i].acc }); if (r.error) { err = r.error; break; } n++; }
      if (err) ctx.msg($('#bk-tm'), E(ctx, err), 'error'); else { X.reload(); setTimeout(function () { var m = document.getElementById('bk-tm'); if (m) ctx.msg(m, t('posted', { n: n }), 'ok'); }, 600); }
    };
    if ($('#bk-ai')) $('#bk-ai').onclick = async function () {
      var b = this; b.disabled = true; ctx.msg($('#bk-tm'), t('aiWorking'), 'info');
      try { var j = await call(ctx, { action: 'ai', company_id: X.co.id }); if (j.ai === false) return ctx.msg($('#bk-tm'), t('aiOff'), 'error'); X.reload(); } catch (e) { b.disabled = false; ctx.msg($('#bk-tm'), E(ctx, e) + (e.detail ? ' (' + e.detail + ')' : ''), 'error'); }
    };
    var syncRun = async function (payload, btn) { btn.disabled = true; ctx.msg($('#bk-m'), t('loading'), 'info');
      try { var j = await call(ctx, Object.assign({ action: 'sync', company_id: X.co.id }, payload)); ctx.msg($('#bk-m'), t('imported', { n: j.imported }) + (j.errors && j.errors.length ? ' · ' + j.errors.join(' · ') : ''), j.errors && j.errors.length ? 'error' : 'ok'); setTimeout(X.reload, 1200); }
      catch (e) { btn.disabled = false; ctx.msg($('#bk-m'), E(ctx, e) + (e.detail ? ' (' + e.detail + ')' : ''), 'error'); } };
    $('#bk-syncall').onclick = function () { syncRun({}, this); };
    $$('[data-sync]').forEach(function (b) { b.onclick = function () { syncRun({ connection_id: b.dataset.sync }, b); }; });
    $$('[data-disc]').forEach(function (b) { b.onclick = async function () { if (!confirm(t('disconnect') + '?')) return; try { await call(ctx, { action: 'disconnect', company_id: X.co.id, connection_id: b.dataset.disc }); X.reload(); } catch (e) { ctx.msg($('#bk-m'), E(ctx, e), 'error'); } }; });
    $$('[data-csv]').forEach(function (b) { b.onclick = function () { csvImport(X, b.dataset.csv); }; });
    $('#bk-connect').onclick = function () { connectBank(X, 'bank'); };
    $('#bk-connect-card').onclick = function () { connectBank(X, 'card'); };
    if ($('#bk-sample')) $('#bk-sample').onclick = async function () { if (!confirm(t('sampleQ'))) return; this.disabled = true; var r = await sb.rpc('bk_clear_sample', { p_company: X.co.id }); if (r.error) { this.disabled = false; return ctx.msg($('#bk-m'), E(ctx, r.error), 'error'); } X.reload(); setTimeout(function () { var m = document.getElementById('bk-m'); if (m) ctx.msg(m, t('sampleDone'), 'ok'); }, 700); };
  }

  async function connectBank(X, want) {
    var ctx = X.ctx, cfg = {}, card = want === 'card';
    try { cfg = await call(ctx, { action: 'config' }); } catch (e) { /* show options anyway */ }
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t(card ? 'c_titleCard' : 'c_title') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<div class="bk-opts">' + [['stripe', cfg.stripe], ['plaid', cfg.plaid], ['manual', true]].map(function (p) {
        return '<button type="button" class="bk-opt" data-p="' + p[0] + '"' + (p[1] ? '' : ' disabled') + '><strong>' + t('c_' + p[0]) + '</strong><span>' + t('c_' + p[0] + 'Txt') + '</span>' + (p[1] ? '' : '<em>' + t('c_off') + '</em>') + '</button>';
      }).join('') + '</div><div id="bk-cform"></div><div class="portal-alert" id="bk-cm" role="alert"></div>', true);
    var m = $('#bk-cm', o);
    $$('.bk-opt', o).forEach(function (b) { b.onclick = async function () {
      var p = b.dataset.p;
      if (p === 'manual') {
        $('#bk-cform', o).innerHTML = '<form class="portal-form" id="bk-mf"><div class="field"><label for="bk-mn">' + t('c_name') + '</label><input id="bk-mn" required maxlength="80" placeholder="' + (card ? 'Amex Business Platinum' : 'Bank of America Business') + '"></div>' +
          '<div class="portal-grid2"><div class="field"><label for="bk-mk">' + t('c_kind') + '</label><select id="bk-mk">' + (card ? ['credit_card'] : ['checking', 'savings', 'other']).map(function (k) { return '<option value="' + k + '">' + t('k_' + k) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label for="bk-mm">' + t('c_mask') + '</label><input id="bk-mm" maxlength="4" inputmode="numeric"></div></div><button class="btn btn--navy" type="submit">' + t('c_create') + '</button></form>';
        $('#bk-mf', o).onsubmit = async function (e) { e.preventDefault(); var n = $('#bk-mn', o).value.trim(); if (n.length < 2) return;
          var r = await ctx.sb.rpc('bk_add_bank_account', { p_company: X.co.id, p_connection: null, p_external: null, p_name: n, p_mask: $('#bk-mm', o).value.replace(/\D/g, '') || null, p_kind: $('#bk-mk', o).value, p_currency: 'usd', p_balance: null });
          if (r.error) return ctx.msg(m, E(ctx, r.error), 'error'); ctx.closeOverlay(); X.reload(); };
        return;
      }
      b.disabled = true; ctx.msg(m, t('loading'), 'info');
      try {
        if (p === 'stripe') {
          var s = await call(ctx, { action: 'stripe_session', company_id: X.co.id, kind: card ? 'card' : 'bank' });
          await loadScript('https://js.stripe.com/v3/');
          var res = await window.Stripe(s.pk).collectFinancialConnectionsAccounts({ clientSecret: s.client_secret });
          if (res.error) throw new Error(res.error.message);
          var j = await call(ctx, { action: 'stripe_complete', company_id: X.co.id, connection_id: s.connection_id, session_id: res.financialConnectionsSession.id });
          ctx.closeOverlay(); X.reload(); setTimeout(function () { alert(t('imported', { n: j.imported || 0 })); }, 300);
        } else {
          var lk = await call(ctx, { action: 'plaid_link', company_id: X.co.id, lang: L, kind: card ? 'card' : 'bank' });
          await loadScript('https://cdn.plaid.com/link/v2/stable/link-initialize.js');
          window.Plaid.create({ token: lk.link_token, onSuccess: async function (pt, meta) {
            try { var j2 = await call(ctx, { action: 'plaid_exchange', company_id: X.co.id, public_token: pt, institution: meta && meta.institution ? meta.institution.name : 'Bank' }); ctx.closeOverlay(); X.reload(); setTimeout(function () { alert(t('imported', { n: j2.imported || 0 })); }, 300); }
            catch (e) { ctx.msg(m, E(ctx, e) + (e.detail ? ' (' + e.detail + ')' : ''), 'error'); }
          }, onExit: function () { b.disabled = false; ctx.msg(m, '', 'info'); } }).open();
        }
      } catch (e) { b.disabled = false; ctx.msg(m, E(ctx, e) + (e.detail ? ' (' + e.detail + ')' : ''), 'error'); }
    }; });
  }

  /* CSV statement import with column mapping */
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (c) { return c.trim(); })) rows.push(row); row = []; } else cell += ch;
    }
    row.push(cell); if (row.some(function (c) { return c.trim(); })) rows.push(row);
    return rows;
  }
  function parseDate(s, fmt) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; var a = fmt === 'dmy' ? [m[2], m[1]] : [m[1], m[2]]; if (+a[0] > 12 || +a[1] > 31) return null; return y + '-' + a[0].padStart(2, '0') + '-' + a[1].padStart(2, '0'); }
    return null;
  }
  function csvImport(X, bankId) {
    var ctx = X.ctx, data = null;
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('csvTitle') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<div class="field"><label for="bk-cf">' + t('csvFile') + '</label><input type="file" id="bk-cf" accept=".csv,text/csv"></div><div id="bk-cmap"></div><div class="portal-alert" id="bk-cim" role="alert"></div>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    $('#bk-cf', o).onchange = async function () {
      var f = this.files[0]; if (!f) return; data = parseCsv(await f.text());
      if (data.length < 2) return ctx.msg($('#bk-cim', o), t('csvBad'), 'error');
      var hdr = data[0], guess = function (re) { var i = hdr.findIndex(function (h) { return re.test(h); }); return i; };
      var opt = function (sel, allowNone) { return (allowNone ? '<option value="-1">—</option>' : '') + hdr.map(function (h, i) { return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + escH(h || ('#' + (i + 1))) + '</option>'; }).join(''); };
      var gd = guess(/date|data|fecha|posted/i), gs = guess(/desc|memo|payee|name|hist|detalhe/i), ga = guess(/^amount$|amount|valor|monto/i), gdb = guess(/debit|withdraw|saída|saida/i), gcr = guess(/credit|deposit|entrada/i);
      $('#bk-cmap', o).innerHTML = '<div class="portal-grid2">' +
        '<div class="field"><label for="bk-c1">' + t('csvDate') + '</label><select id="bk-c1">' + opt(Math.max(gd, 0)) + '</select></div>' +
        '<div class="field"><label for="bk-cfmt">' + t('csvFmt') + '</label><select id="bk-cfmt"><option value="mdy">MM/DD/YYYY</option><option value="dmy">DD/MM/YYYY</option></select></div>' +
        '<div class="field"><label for="bk-c2">' + t('csvDesc') + '</label><select id="bk-c2">' + opt(Math.max(gs, 1)) + '</select></div>' +
        '<div class="field"><label for="bk-c3">' + t('csvAmt') + '</label><select id="bk-c3">' + opt(ga, true) + '</select></div>' +
        '<div class="field"><label for="bk-c4">' + t('csvDebit') + '</label><select id="bk-c4">' + opt(ga > -1 ? -1 : gdb, true) + '</select></div>' +
        '<div class="field"><label for="bk-c5">' + t('csvCredit') + '</label><select id="bk-c5">' + opt(ga > -1 ? -1 : gcr, true) + '</select></div></div>' +
        '<div class="check-row"><input type="checkbox" id="bk-cflip"><label for="bk-cflip">' + t('csvFlip') + '</label></div>' +
        '<h3 class="portal-h2" style="font-size:1rem">' + t('csvPrev') + '</h3><div class="bk-scroll"><table class="bk-table" id="bk-cprev"></table></div><button class="btn btn--navy" type="button" id="bk-cgo">' + t('csvGo') + '</button>';
      var rowsOut = function () {
        var di = +$('#bk-c1', o).value, si = +$('#bk-c2', o).value, ai = +$('#bk-c3', o).value, dbi = +$('#bk-c4', o).value, cri = +$('#bk-c5', o).value, fmt = $('#bk-cfmt', o).value, flip = $('#bk-cflip', o).checked;
        return data.slice(1).map(function (r) {
          var amt = ai > -1 ? parseMoney(r[ai]) : (cri > -1 ? Math.abs(parseMoney(r[cri]) || 0) : 0) - (dbi > -1 ? Math.abs(parseMoney(r[dbi]) || 0) : 0);
          if (flip) amt = -amt;
          return { date: parseDate(r[di], fmt), description: String(r[si] || '').trim().slice(0, 300), amount_cents: amt };
        }).filter(function (r) { return r.date && r.amount_cents && !isNaN(r.amount_cents); });
      };
      var prev = function () { var rs = rowsOut(); $('#bk-cprev', o).innerHTML = '<thead><tr><th>' + t('date') + '</th><th>' + t('desc') + '</th><th class="num">' + t('amount') + '</th></tr></thead><tbody>' + rs.slice(0, 6).map(function (r) { return '<tr><td>' + fmtD(r.date) + '</td><td>' + escH(r.description) + '</td><td class="num ' + (r.amount_cents > 0 ? 'bk-in' : 'bk-out') + '">' + moneyN(r.amount_cents) + '</td></tr>'; }).join('') + '</tbody><tfoot><tr><td colspan="3">' + rs.length + ' / ' + (data.length - 1) + '</td></tr></tfoot>'; };
      $$('select, input[type=checkbox]', $('#bk-cmap', o)).forEach(function (s) { s.onchange = prev; }); prev();
      $('#bk-cgo', o).onclick = async function () { var rs = rowsOut(); if (!rs.length) return ctx.msg($('#bk-cim', o), t('csvBad'), 'error'); this.disabled = true;
        var r = await ctx.sb.rpc('bk_import_csv', { p_bank: bankId, p_rows: rs }); this.disabled = false;
        if (r.error) return ctx.msg($('#bk-cim', o), E(ctx, r.error), 'error'); ctx.closeOverlay(); X.reload(); };
    };
  }

  /* ---------------- chart of accounts ---------------- */
  async function tCoa(X) {
    var ctx = X.ctx, r = await ctx.sb.rpc('bk_report', { p_company: X.co.id, p_kind: 'tb', p_from: null, p_to: iso(new Date()) });
    var tb = {}; ((r.data || {}).rows || []).forEach(function (x) { tb[x.account_id] = x; });
    var bal = function (a) { var x = tb[a.id]; if (!x) return 0; return a.type === 'asset' || a.type === 'expense' ? x.debit - x.credit : x.credit - x.debit; };
    X.body.innerHTML = '<section class="portal-card"><div class="bk-row"><h2 class="portal-h2">' + t('t_coa') + '</h2><button class="btn btn--navy btn--sm" type="button" id="bk-anew">' + t('coaNew') + '</button></div>' +
      ['asset', 'liability', 'equity', 'income', 'expense'].map(function (g) {
        var list = X.accts.filter(function (a) { return a.type === g; });
        return '<h3 class="bk-grp">' + t('ty_' + g) + '</h3><table class="bk-table"><thead><tr><th>' + t('code') + '</th><th>' + t('name') + '</th><th>' + t('subtype') + '</th><th class="num">' + t('balance') + '</th><th></th></tr></thead><tbody>' + list.map(function (a) {
          return '<tr' + (a.is_active ? '' : ' class="bk-off"') + '><td>' + escH(a.code) + '</td><td>' + escH(a.name) + (a.is_system ? ' <span class="pill" title="' + t('system') + '">•</span>' : '') + (a.is_active ? '' : ' <span class="pill">' + t('inactive') + '</span>') + '</td><td>' + SUBL[L][a.subtype] + '</td><td class="num">' + moneyN(bal(a)) + '</td>' +
            '<td class="nowrap"><button class="btn btn--ghost btn--xs" type="button" data-led="' + a.id + '">' + t('ledger') + '</button> <button class="btn btn--ghost btn--xs" type="button" data-ed="' + a.id + '">' + t('edit') + '</button></td></tr>';
        }).join('') + '</tbody></table>';
      }).join('') + '</section>';
    $('#bk-anew').onclick = function () { editAcct(X, null); };
    $$('[data-ed]').forEach(function (b) { b.onclick = function () { editAcct(X, X.accts.find(function (a) { return a.id === b.dataset.ed; })); }; });
    $$('[data-led]').forEach(function (b) { b.onclick = function () { ledger(X, X.accts.find(function (a) { return a.id === b.dataset.led; })); }; });
  }
  function editAcct(X, a) {
    var ctx = X.ctx; a = a || { type: 'expense', subtype: 'expense', is_active: true };
    var subOpts = function (ty, sel) { return SUB[ty].filter(function (s) { return s !== 'retained_earnings' && (s !== 'bank' && s !== 'credit_card' || a.id); }).map(function (s) { return '<option value="' + s + '"' + (s === sel ? ' selected' : '') + '>' + SUBL[L][s] + '</option>'; }).join(''); };
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + (a.id ? t('edit') : t('coaNew')) + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<form class="portal-form" id="bk-af"><div class="portal-grid2"><div class="field"><label for="bk-ac">' + t('code') + '</label><input id="bk-ac" required maxlength="12" pattern="[0-9A-Za-z.\\-]+" value="' + escH(a.code || '') + '"' + (a.is_system ? ' readonly' : '') + '></div>' +
      '<div class="field"><label for="bk-an">' + t('name') + '</label><input id="bk-an" required maxlength="120" value="' + escH(a.name || '') + '"></div>' +
      '<div class="field"><label for="bk-at">' + t('type') + '</label><select id="bk-at"' + (a.id ? ' disabled' : '') + '>' + Object.keys(SUB).map(function (k) { return '<option value="' + k + '"' + (k === a.type ? ' selected' : '') + '>' + t('ty_' + k) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="bk-as">' + t('subtype') + '</label><select id="bk-as"' + (a.is_system || (a.id && (a.subtype === 'bank' || a.subtype === 'credit_card')) ? ' disabled' : '') + '>' + subOpts(a.type, a.subtype) + '</select></div></div>' +
      '<div class="field"><label for="bk-ad">' + t('descr') + '</label><input id="bk-ad" maxlength="300" value="' + escH(a.description || '') + '"></div>' +
      '<div class="portal-alert" id="bk-am" role="alert"></div><div class="portal-btn-row"><button class="btn btn--navy" type="submit">' + t('save') + '</button>' +
      (a.id && !a.is_system ? '<button class="btn btn--ghost" type="button" id="bk-aoff">' + (a.is_active ? t('deactivate') : t('activate')) + '</button>' : '') + '</div></form>');
    $('#bk-at', o).onchange = function () { $('#bk-as', o).innerHTML = subOpts(this.value, SUB[this.value][0]); };
    $('#bk-af', o).onsubmit = async function (e) {
      e.preventDefault();
      var row = { code: $('#bk-ac', o).value.trim(), name: $('#bk-an', o).value.trim(), description: $('#bk-ad', o).value.trim() || null };
      if (!a.is_system && !(a.id && (a.subtype === 'bank' || a.subtype === 'credit_card'))) row.subtype = $('#bk-as', o).value;
      if (!a.id) row.type = $('#bk-at', o).value;
      var r = a.id ? await ctx.sb.from('bk_accounts').update(row).eq('id', a.id) : await ctx.sb.from('bk_accounts').insert(Object.assign(row, { company_id: X.co.id }));
      if (r.error) return ctx.msg($('#bk-am', o), /duplicate|unique/i.test(r.error.message) ? t('code') + ' ✕' : E(ctx, r.error), 'error');
      ctx.closeOverlay(); X.reload();
    };
    if ($('#bk-aoff', o)) $('#bk-aoff', o).onclick = async function () { var r = await ctx.sb.from('bk_accounts').update({ is_active: !a.is_active }).eq('id', a.id); if (r.error) return ctx.msg($('#bk-am', o), E(ctx, r.error), 'error'); ctx.closeOverlay(); X.reload(); };
  }
  async function ledger(X, a) {
    var ctx = X.ctx, y = new Date().getFullYear();
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('ledger') + ': ' + escH(a.code + ' · ' + a.name) + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<div class="portal-btn-row"><label>' + t('from') + ' <input type="date" id="bk-lf" value="' + y + '-01-01"></label><label>' + t('to') + ' <input type="date" id="bk-lt" value="' + iso(new Date()) + '"></label></div><div class="bk-scroll" id="bk-lb"></div>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    var load = async function () {
      var r = await ctx.sb.rpc('bk_ledger', { p_account: a.id, p_from: $('#bk-lf', o).value, p_to: $('#bk-lt', o).value });
      var rows = r.data || [];
      $('#bk-lb', o).innerHTML = rows.length ? '<table class="bk-table"><thead><tr><th>' + t('date') + '</th><th>' + t('number') + '</th><th>' + t('desc') + '</th><th class="num">' + t('debit') + '</th><th class="num">' + t('credit') + '</th><th class="num">' + t('balance') + '</th></tr></thead><tbody>' +
        rows.map(function (x) { return '<tr><td class="nowrap">' + fmtD(x.entry_date) + '</td><td>' + x.number + '</td><td>' + escH(x.description || x.memo || '') + ' <span class="bk-meta">' + t('src_' + x.source) + (x.reconciled ? ' · R' : '') + '</span></td><td class="num">' + (x.debit ? moneyN(x.debit) : '') + '</td><td class="num">' + (x.credit ? moneyN(x.credit) : '') + '</td><td class="num">' + moneyN(x.balance) + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<p class="empty">' + t('noJ') + '</p>';
    };
    $('#bk-lf', o).onchange = load; $('#bk-lt', o).onchange = load; load();
  }

  /* ---------------- journal ---------------- */
  async function tJournal(X) {
    var ctx = X.ctx, y = new Date().getFullYear(), from = param('from') || y + '-01-01', to = param('to') || iso(new Date());
    var es = await ctx.q(ctx.sb.from('bk_entries').select('*, bk_lines(*)').eq('company_id', X.co.id).gte('entry_date', from).lte('entry_date', to).order('entry_date', { ascending: false }).order('number', { ascending: false }).limit(300));
    var byId = {}; X.accts.forEach(function (a) { byId[a.id] = a; });
    X.body.innerHTML = '<section class="portal-card"><div class="bk-row"><h2 class="portal-h2">' + t('t_journal') + '</h2><div class="portal-btn-row"><label>' + t('from') + ' <input type="date" id="bk-jf" value="' + from + '"></label><label>' + t('to') + ' <input type="date" id="bk-jt" value="' + to + '"></label>' +
      '<button class="btn btn--navy btn--sm" type="button" id="bk-jnew">' + t('jNew') + '</button></div></div><div class="portal-alert" id="bk-jm" role="status"></div>' +
      (es.length ? '<div class="bk-scroll"><table class="bk-table bk-j"><thead><tr><th>' + t('date') + '</th><th>' + t('number') + '</th><th>' + t('jMemo') + ' / ' + t('rAcc') + '</th><th class="num">' + t('debit') + '</th><th class="num">' + t('credit') + '</th><th></th></tr></thead>' + es.map(function (e) {
        var void_ = e.status === 'void';
        return '<tbody class="' + (void_ ? 'bk-off' : '') + '"><tr class="bk-jh"><td class="nowrap">' + fmtD(e.entry_date) + '</td><td>' + e.number + '</td><td><strong>' + escH(e.memo || '') + '</strong> <span class="bk-meta">' + t('src_' + e.source) + (void_ ? ' · ' + t('voidE') : '') + '</span></td><td></td><td></td><td>' + (void_ ? '' : '<button class="btn btn--ghost btn--xs" type="button" data-void="' + e.id + '">' + t('voidE') + '</button>') + '</td></tr>' +
          (e.bk_lines || []).sort(function (a, b) { return b.debit_cents - a.debit_cents; }).map(function (l) { var a = byId[l.account_id] || {}; return '<tr><td></td><td></td><td class="bk-ind">' + escH((a.code || '') + ' · ' + (a.name || '')) + (l.description && l.description !== e.memo ? ' <span class="bk-meta">' + escH(l.description) + '</span>' : '') + '</td><td class="num">' + (l.debit_cents ? moneyN(l.debit_cents) : '') + '</td><td class="num">' + (l.credit_cents ? moneyN(l.credit_cents) : '') + '</td><td></td></tr>'; }).join('') + '</tbody>';
      }).join('') + '</table></div>' : '<p class="empty">' + t('noJ') + '</p>') + '</section>';
    var rg = function () { go(X.co.id, 'journal', '&from=' + $('#bk-jf').value + '&to=' + $('#bk-jt').value); };
    $('#bk-jf').onchange = rg; $('#bk-jt').onchange = rg;
    $('#bk-jnew').onclick = function () { newEntry(X); };
    $$('[data-void]').forEach(function (b) { b.onclick = async function () { if (!confirm(t('voidQ'))) return; var r = await ctx.sb.rpc('bk_void_entry', { p_entry: b.dataset.void }); if (r.error) return ctx.msg($('#bk-jm'), E(ctx, r.error), 'error'); X.reload(); }; });
  }
  function newEntry(X) {
    var ctx = X.ctx;
    var line = function () { return '<tr><td><select class="bk-la" aria-label="' + t('rAcc') + '">' + acctOptions(X.accts, null) + '</select></td><td><input class="bk-ld num" inputmode="decimal" aria-label="' + t('debit') + '"></td><td><input class="bk-lc num" inputmode="decimal" aria-label="' + t('credit') + '"></td><td><input class="bk-lx" maxlength="300" aria-label="' + t('desc') + '"></td><td><button type="button" class="close-x bk-lrm" aria-label="' + t('del') + '">×</button></td></tr>'; };
    var o = ctx.openOverlay('<div class="drawer__head"><h2 class="portal-h2" style="margin:0">' + t('jNew') + '</h2><button class="close-x" type="button" aria-label="' + t('close') + '">×</button></div>' +
      '<form class="portal-form" id="bk-jfm"><div class="portal-grid2"><div class="field"><label for="bk-jd">' + t('date') + '</label><input type="date" id="bk-jd" required value="' + iso(new Date()) + '"></div>' +
      '<div class="field"><label for="bk-js">' + t('source') + '</label><select id="bk-js">' + ['manual', 'adjustment', 'opening'].map(function (k) { return '<option value="' + k + '">' + t('src_' + k) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="bk-jmemo">' + t('jMemo') + '</label><input id="bk-jmemo" maxlength="500"></div>' +
      '<div class="bk-scroll"><table class="bk-table bk-jl"><thead><tr><th>' + t('rAcc') + '</th><th class="num">' + t('debit') + '</th><th class="num">' + t('credit') + '</th><th>' + t('desc') + '</th><th></th></tr></thead><tbody id="bk-jlines">' + line() + line() + '</tbody>' +
      '<tfoot><tr><td><button class="btn btn--ghost btn--xs" type="button" id="bk-jadd">' + t('addLine') + '</button></td><td class="num" id="bk-jtd"></td><td class="num" id="bk-jtc"></td><td id="bk-jdiff"></td><td></td></tr></tfoot></table></div>' +
      '<div class="portal-alert" id="bk-jem" role="alert"></div><button class="btn btn--navy" type="submit">' + t('post') + '</button></form>', true);
    o.querySelector('.modal').classList.add('modal--wide');
    var sum = function () { var d = 0, c = 0; $$('#bk-jlines tr', o).forEach(function (tr) { d += parseMoney($('.bk-ld', tr).value) || 0; c += parseMoney($('.bk-lc', tr).value) || 0; });
      $('#bk-jtd', o).textContent = moneyN(d); $('#bk-jtc', o).textContent = moneyN(c); $('#bk-jdiff', o).innerHTML = d === c ? '<span class="pill pill--done">✓</span>' : '<span class="pill pill--overdue">' + t('diff') + ': ' + moneyN(d - c) + '</span>'; };
    var wire = function () { $$('#bk-jlines input', o).forEach(function (i) { i.oninput = sum; }); $$('.bk-lrm', o).forEach(function (b) { b.onclick = function () { if ($$('#bk-jlines tr', o).length > 2) { b.closest('tr').remove(); sum(); } }; }); };
    $('#bk-jadd', o).onclick = function () { $('#bk-jlines', o).insertAdjacentHTML('beforeend', line()); wire(); };
    wire(); sum();
    $('#bk-jfm', o).onsubmit = async function (e) {
      e.preventDefault();
      var lines = $$('#bk-jlines tr', o).map(function (tr) { return { account_id: $('.bk-la', tr).value, debit_cents: parseMoney($('.bk-ld', tr).value) || 0, credit_cents: parseMoney($('.bk-lc', tr).value) || 0, description: $('.bk-lx', tr).value.trim() }; })
        .filter(function (l) { return l.account_id && (l.debit_cents || l.credit_cents); });
      var r = await ctx.sb.rpc('bk_post_entry', { p_company: X.co.id, p_date: $('#bk-jd', o).value, p_memo: $('#bk-jmemo', o).value, p_lines: lines, p_source: $('#bk-js', o).value });
      if (r.error) return ctx.msg($('#bk-jem', o), E(ctx, r.error), 'error');
      ctx.closeOverlay(); X.reload();
    };
  }

  /* ---------------- reconciliation ---------------- */
  async function tRecon(X) {
    var ctx = X.ctx, sb = ctx.sb;
    var res = await Promise.all([sb.from('bk_bank_accounts').select('*').eq('company_id', X.co.id).eq('is_active', true).order('created_at'), sb.from('bk_reconciliations').select('*').eq('company_id', X.co.id).order('statement_date', { ascending: false }).limit(30)]);
    var banks = res[0].data || [], hist = res[1].data || [];
    var bname = {}; banks.forEach(function (b) { bname[b.id] = b.name + (b.mask ? ' ···' + b.mask : ''); });
    X.body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">' + t('t_recon') + '</h2>' + (banks.length ? '<form class="bk-rform" id="bk-rf"><div class="field"><label for="bk-rb">' + t('rAcc') + '</label><select id="bk-rb">' + banks.map(function (b) { return '<option value="' + b.id + '">' + escH(bname[b.id]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="bk-rd">' + t('rDate') + '</label><input type="date" id="bk-rd" required value="' + iso(new Date(new Date().getFullYear(), new Date().getMonth(), 0)) + '"></div>' +
      '<div class="field"><label for="bk-rv">' + t('rBal') + '</label><input id="bk-rv" required inputmode="decimal" placeholder="0.00"></div><button class="btn btn--navy" type="submit">' + t('rStart') + '</button></form><div id="bk-rw"></div>' : '<p class="empty">' + t('noAccounts') + '</p>') + '</section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('rHist') + '</h2>' + (hist.length ? '<table class="bk-table"><thead><tr><th>' + t('rAcc') + '</th><th>' + t('rDate') + '</th><th class="num">' + t('rBal') + '</th><th>' + t('lastSync') + '</th></tr></thead><tbody>' +
        hist.map(function (h) { return '<tr><td>' + escH(bname[h.bank_account_id] || '—') + '</td><td>' + fmtD(h.statement_date) + '</td><td class="num">' + moneyN(h.statement_balance_cents) + '</td><td>' + escH(h.completed_at ? ctx.fmtDT(h.completed_at) + ' · ' + (h.created_by || '') : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="empty">' + t('rNone') + '</p>') + '</section>';
    if (!banks.length) return;
    $('#bk-rf').onsubmit = async function (e) {
      e.preventDefault();
      var bank = $('#bk-rb').value, d = $('#bk-rd').value, bal = parseMoney($('#bk-rv').value); if (isNaN(bal)) return $('#bk-rv').focus();
      var b = banks.find(function (x) { return x.id === bank; }), ccard = b.kind === 'credit_card';
      var r = await Promise.all([sb.rpc('bk_recon_lines', { p_bank: bank, p_to: d }), sb.rpc('bk_reconcile', { p_bank: bank, p_date: d, p_balance: ccard ? -bal : bal, p_cleared: null, p_finish: false })]);
      var lines = r[0].data || [], open = (r[1].data || {}).opening || 0;
      // keep the lines that were already ticked
      $('#bk-rw').innerHTML = lines.length ? '<div class="bk-rsum"><span>' + t('rOpen') + ': <b>' + moneyN(open) + '</b></span><span>' + t('rCleared') + ': <b id="bk-rc"></b></span><span>' + t('rDiff') + ': <b id="bk-rdf"></b></span></div>' +
        '<div class="bk-scroll"><table class="bk-table"><thead><tr><th class="chk"><input type="checkbox" id="bk-rall" aria-label="' + t('selAll') + '"></th><th>' + t('date') + '</th><th>' + t('desc') + '</th><th class="num">' + t('amount') + '</th></tr></thead><tbody>' +
        lines.map(function (l) { return '<tr><td class="chk"><input type="checkbox" class="bk-rl" value="' + l.line_id + '" data-a="' + l.amount + '"' + (l.cleared ? ' checked' : '') + ' aria-label="' + escH(l.description || '') + '"></td><td>' + fmtD(l.entry_date) + '</td><td>' + escH(l.description || '') + '</td><td class="num ' + (l.amount > 0 ? 'bk-in' : 'bk-out') + '">' + moneyN(l.amount) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="portal-alert" id="bk-rm" role="status"></div><button class="btn btn--navy" type="button" id="bk-rfin" disabled>' + t('rFinish') + '</button>' : '<p class="empty">' + t('rNoLines') + '</p>';
      if (!lines.length) return;
      var target = ccard ? -bal : bal;
      var upd = function () { var c = 0; $$('.bk-rl:checked').forEach(function (x) { c += +x.dataset.a; }); var diff = target - (open + c); $('#bk-rc').textContent = moneyN(c); $('#bk-rdf').textContent = moneyN(diff); $('#bk-rdf').className = diff === 0 ? 'bk-in' : 'bk-out'; $('#bk-rfin').disabled = diff !== 0; };
      $$('.bk-rl').forEach(function (x) { x.onchange = upd; }); $('#bk-rall').onchange = function () { var on = this.checked; $$('.bk-rl').forEach(function (x) { x.checked = on; }); upd(); }; upd();
      $('#bk-rfin').onclick = async function () {
        var ids = $$('.bk-rl:checked').map(function (x) { return x.value; });
        var rr = await sb.rpc('bk_reconcile', { p_bank: bank, p_date: d, p_balance: target, p_cleared: ids, p_finish: true });
        if (rr.error) return ctx.msg($('#bk-rm'), E(ctx, rr.error), 'error');
        X.reload(); setTimeout(function () { alert(t('rDone')); }, 300);
      };
    };
  }

  /* ---------------- reports ---------------- */
  function periodOf(k) {
    var n = new Date(), y = n.getFullYear(), m = n.getMonth();
    if (k === 'month') return [iso(new Date(y, m, 1)), iso(n)];
    if (k === 'quarter') return [iso(new Date(y, Math.floor(m / 3) * 3, 1)), iso(n)];
    if (k === 'last') return [(y - 1) + '-01-01', (y - 1) + '-12-31'];
    return [y + '-01-01', iso(n)];
  }
  async function tReports(X) {
    var ctx = X.ctx, kind = param('r') || 'pl', per = param('p') || 'year', pr = periodOf(per), from = param('from') || pr[0], to = param('to') || pr[1];
    var y = new Date().getFullYear(), qn = Math.floor(new Date().getMonth() / 3), defQ = qn === 0 ? 4 : qn, defY = qn === 0 ? y - 1 : y;
    X.body.innerHTML = '<section class="portal-card"><div class="bk-row bk-rbar"><div class="seg" role="group">' + ['pl', 'bs', 'cf', 'tb'].map(function (k) { return '<button type="button" data-r="' + k + '" aria-pressed="' + (k === kind) + '">' + t('rep_' + k) + '</button>'; }).join('') + '</div>' +
      '<div class="portal-btn-row"><select id="bk-per" aria-label="' + t('period') + '">' + ['month', 'quarter', 'year', 'last', 'custom'].map(function (k) { return '<option value="' + k + '"' + (k === per ? ' selected' : '') + '>' + t('p_' + k) + '</option>'; }).join('') + '</select>' +
      (kind === 'bs' || kind === 'tb' ? '' : '<input type="date" id="bk-rf1" value="' + from + '" aria-label="' + t('from') + '">') + '<input type="date" id="bk-rt1" value="' + to + '" aria-label="' + t('to') + '"><button class="btn btn--ghost btn--sm" type="button" id="bk-csv">' + t('csv') + '</button></div></div>' +
      '<div id="bk-rep" class="bk-rep"><p class="portal-muted">' + t('loading') + '</p></div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('publish') + '</h2><div class="portal-btn-row"><select id="bk-py" aria-label="' + t('year') + '">' + [y, y - 1, y - 2].map(function (v) { return '<option' + (v === defY ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select>' +
      '<select id="bk-pq" aria-label="' + t('quarter') + '">' + [1, 2, 3, 4, 0].map(function (n) { return '<option value="' + n + '"' + (n === defQ ? ' selected' : '') + '>' + t('q' + n) + '</option>'; }).join('') + '</select><button class="btn btn--navy btn--sm" type="button" id="bk-pub">' + t('publish') + '</button></div><div class="portal-alert" id="bk-pm" role="status"></div></section>';
    var rerun = function (extra) { go(X.co.id, 'reports', '&r=' + kind + '&p=' + $('#bk-per').value + (extra || '')); };
    $$('[data-r]').forEach(function (b) { b.onclick = function () { kind = b.dataset.r; rerun(); }; });
    $('#bk-per').onchange = function () { if (this.value !== 'custom') rerun(); };
    ['#bk-rf1', '#bk-rt1'].forEach(function (s) { if ($(s)) $(s).onchange = function () { $('#bk-per').value = 'custom'; rerun('&from=' + ($('#bk-rf1') ? $('#bk-rf1').value : from) + '&to=' + $('#bk-rt1').value); }; });
    var r = await ctx.sb.rpc('bk_report', { p_company: X.co.id, p_kind: kind, p_from: kind === 'bs' || kind === 'tb' ? null : from, p_to: to });
    if (r.error) { $('#bk-rep').innerHTML = '<div class="portal-alert portal-alert--error" style="display:block">' + escH(E(ctx, r.error)) + '</div>'; return; }
    var rep = r.data, csv = [];
    var row = function (label, v, cls, code) { csv.push([code || '', label, v == null ? '' : (v / 100).toFixed(2)]); return '<tr class="' + (cls || '') + '"><td>' + (code ? '<span class="bk-code">' + escH(code) + '</span> ' : '') + escH(label) + '</td><td class="num">' + (v == null ? '' : moneyN(v)) + '</td></tr>'; };
    var sec = function (s) { return (s.rows.length || s.total ? row(SECT(s.title), null, 'bk-sh') + s.rows.map(function (x) { return row(x.name, x.amount, 'bk-ind', x.code); }).join('') + row(t('total') + ' ' + SECT(s.title), s.total, 'bk-tot') : ''); };
    var S = function (k) { return (rep.sections || []).find(function (s) { return s.key === k; }) || { rows: [], total: 0, title: '' }; };
    var html = '<header class="bk-rhead"><strong>' + escH(rep.company) + '</strong><span>' + t('rep_' + kind) + '</span><span>' + (rep.from ? fmtD(rep.from) + ' – ' : '') + fmtD(rep.to) + '</span></header><table class="bk-table bk-rt"><tbody>';
    if (kind === 'pl') html += sec(S('income')) + sec(S('cogs')) + row(t('grossProfit'), rep.gross_profit, 'bk-grand') + sec(S('expense')) + row(t('opIncome'), rep.operating_income, 'bk-grand') + sec(S('other_income')) + sec(S('other_expense')) + row(t('netIncome'), rep.net_income, 'bk-grand bk-final');
    else if (kind === 'bs') {
      var grp = function (g) { return (rep.sections || []).filter(function (s) { return s.group === g; }).map(sec).join(''); };
      html += grp('assets') + row(t('totAssets'), rep.total_assets, 'bk-grand') + grp('liabilities') + row(t('totLiab'), rep.total_liabilities, 'bk-grand') +
        row(SECT('Equity'), null, 'bk-sh') + S('equity').rows.map(function (x) { return row(x.name, x.amount, 'bk-ind', x.code); }).join('') + row(t('re'), rep.retained_earnings, 'bk-ind') + row(t('niYtd'), rep.net_income, 'bk-ind') +
        row(t('totEq'), rep.total_equity, 'bk-tot') + row(t('totLE'), Number(rep.total_liabilities) + Number(rep.total_equity), 'bk-grand bk-final');
    } else if (kind === 'cf') html += row(t('netIncome'), rep.net_income, 'bk-ind') + sec(S('operating')) + row(t('cfOp'), rep.operating_total, 'bk-grand') + sec(S('investing')) + sec(S('financing')) +
      row(t('cfNet'), rep.net_change, 'bk-grand') + row(t('cfStart'), rep.cash_start) + row(t('cfEnd'), rep.cash_end, 'bk-grand bk-final');
    else { html = html.replace('<tbody>', '<thead><tr><th>' + t('rAcc') + '</th><th class="num">' + t('debit') + '</th><th class="num">' + t('credit') + '</th></tr></thead><tbody>');
      html += (rep.rows || []).map(function (x) { csv.push([x.code, x.name, (x.debit / 100).toFixed(2), (x.credit / 100).toFixed(2)]); return '<tr><td><span class="bk-code">' + escH(x.code) + '</span> ' + escH(x.name) + '</td><td class="num">' + (x.debit ? moneyN(x.debit) : '') + '</td><td class="num">' + (x.credit ? moneyN(x.credit) : '') + '</td></tr>'; }).join('') +
        '<tr class="bk-grand bk-final"><td>' + t('total') + '</td><td class="num">' + moneyN(rep.total_debit) + '</td><td class="num">' + moneyN(rep.total_credit) + '</td></tr>'; }
    html += '</tbody></table>';
    if (kind === 'bs') { var ok = Number(rep.total_assets) === Number(rep.total_liabilities) + Number(rep.total_equity); html += '<p class="' + (ok ? 'bk-ok' : 'bk-err') + '">' + (ok ? '✓ ' + t('balanced') : t('unbalanced')) + '</p>'; }
    $('#bk-rep').innerHTML = html;
    $('#bk-csv').onclick = function () { var txt = csv.map(function (r) { return r.map(function (c) { return /[",\n]/.test(c) ? '"' + String(c).replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
      X.ctx.download((X.co.legal_name + '-' + kind + '-' + to).replace(/[^\w.\-]+/g, '-') + '.csv', new Blob([txt], { type: 'text/csv' })); };
    $('#bk-pub').onclick = async function () { if (!confirm(t('pubQ'))) return; var b = this; b.disabled = true; ctx.msg($('#bk-pm'), t('loading'), 'info');
      try { await call(ctx, { action: 'publish', company_id: X.co.id, year: +$('#bk-py').value, quarter: +$('#bk-pq').value }); ctx.msg($('#bk-pm'), t('pubDone'), 'ok'); } catch (e) { ctx.msg($('#bk-pm'), E(ctx, e), 'error'); } b.disabled = false; };
  }
  var SECT_PT = { 'Income': 'Receitas', 'Cost of Goods Sold': 'Custo dos produtos/serviços', 'Expenses': 'Despesas', 'Other Income': 'Outras receitas', 'Other Expenses': 'Outras despesas', 'Bank Accounts': 'Contas bancárias', 'Accounts Receivable': 'Contas a receber',
    'Other Current Assets': 'Outros ativos circulantes', 'Fixed Assets': 'Imobilizado', 'Other Assets': 'Outros ativos', 'Accounts Payable': 'Contas a pagar', 'Credit Cards': 'Cartões de crédito', 'Other Current Liabilities': 'Outros passivos circulantes',
    'Long-term Liabilities': 'Passivo de longo prazo', 'Equity': 'Patrimônio líquido', 'Adjustments to reconcile net income': 'Ajustes ao lucro líquido', 'Investing Activities': 'Atividades de investimento', 'Financing Activities': 'Atividades de financiamento' };
  function SECT(s) { return L === 'pt' ? (SECT_PT[s] || s) : s; }

  /* ---------------- rules ---------------- */
  async function tRules(X) {
    var ctx = X.ctx, rules = await ctx.q(ctx.sb.from('bk_rules').select('*').eq('company_id', X.co.id).order('created_at', { ascending: false }));
    var byId = {}; X.accts.forEach(function (a) { byId[a.id] = a; });
    X.body.innerHTML = '<section class="portal-card"><h2 class="portal-h2">' + t('ruleNew') + '</h2><form class="bk-rform" id="bk-rlf"><div class="field"><label for="bk-rt">' + t('ruleText') + '</label><input id="bk-rt" required minlength="2" maxlength="80" placeholder="ADOBE"></div>' +
      '<div class="field"><label for="bk-rdir">' + t('ruleDir') + '</label><select id="bk-rdir">' + ['any', 'in', 'out'].map(function (k) { return '<option value="' + k + '">' + t('d_' + k) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="bk-racc">' + t('ruleAcc') + '</label><select id="bk-racc" required>' + acctOptions(X.accts, null, function (a) { return a.subtype !== 'bank' && a.subtype !== 'credit_card'; }) + '</select></div><button class="btn btn--navy" type="submit">' + t('save') + '</button></form><div class="portal-alert" id="bk-rlm" role="status"></div></section>' +
      '<section class="portal-card"><h2 class="portal-h2">' + t('t_rules') + '</h2>' + (rules.length ? '<table class="bk-table"><thead><tr><th>' + t('ruleText') + '</th><th>' + t('ruleDir') + '</th><th>' + t('ruleAcc') + '</th><th></th></tr></thead><tbody>' + rules.map(function (r) {
        var a = byId[r.account_id] || {}; return '<tr><td><code>' + escH(r.match_text) + '</code></td><td>' + t('d_' + r.direction) + '</td><td>' + escH((a.code || '') + ' · ' + (a.name || '')) + '</td><td><button class="btn btn--ghost btn--xs" type="button" data-rdel="' + r.id + '">' + t('del') + '</button></td></tr>'; }).join('') + '</tbody></table>' : '<p class="empty">' + t('noRules') + '</p>') + '</section>';
    $('#bk-rlf').onsubmit = async function (e) { e.preventDefault(); var row = { company_id: X.co.id, match_text: $('#bk-rt').value.trim(), direction: $('#bk-rdir').value, account_id: $('#bk-racc').value };
      if (!row.account_id || row.match_text.length < 2) return; var r = await ctx.sb.from('bk_rules').insert(row); if (r.error) return ctx.msg($('#bk-rlm'), E(ctx, r.error), 'error'); X.reload(); };
    $$('[data-rdel]').forEach(function (b) { b.onclick = async function () { if (!confirm(t('del') + '?')) return; await ctx.sb.from('bk_rules').delete().eq('id', b.dataset.rdel); X.reload(); }; });
  }

  window.AdminBooks = {
    view: view,
    // used by Clientes → Relatórios: turn on the books for one company
    enable: async function (ctx, companyId) { var r = await ctx.sb.rpc('bk_set_provider', { p_company: companyId, p_provider: 'endeavor' }); if (r.error) throw r.error; return true; },
    publish: function (ctx, companyId, year, quarter) { return call(ctx, { action: 'publish', company_id: companyId, year: year, quarter: quarter }); }
  };
})();
