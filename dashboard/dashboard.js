/* ============================================================
   GESTOR ORION — DASHBOARD CONTROLLER
   ============================================================ */

const fmt = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

/* ===== TEMA ===== */
const THEMES_LIST = ['red', 'blue', 'yellow', 'orange', 'purple', 'green'];

// Aplica o tema localmente (sem salvar no servidor)
function applyThemeLocally(name) {
    THEMES_LIST.forEach(t => document.body.classList.remove('theme-' + t));
    if (name !== 'red') document.body.classList.add('theme-' + name);
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.theme === name || b.classList.contains('t-' + name)) {
            b.classList.add('active');
        }
    });
    localStorage.setItem('nexus_theme', name);
}

// Aplica tema E salva no servidor (acionado pelo usuário via botão)
async function setTheme(name) {
    applyThemeLocally(name);
    await savePrefsToServer({ themeColor: name });
    showFlash('\u2705 Tema salvo!');
}

function loadTheme() {
    applyThemeLocally(localStorage.getItem('nexus_theme') || 'red');
}

// Salva preferências no servidor (themeColor e/ou logoBase64)
async function savePrefsToServer(prefs) {
    try {
        await fetch('/auth/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(prefs)
        });
    } catch (e) { /* falha silenciosa — dado já aplicado localmente */ }
}

/* ===== PERFIL ===== */
const DEFAULT_LOGO = '/dashboard/assets/logo.png';

// Chave do localStorage isolada por usuário (evita vazar logo entre contas)
let _userId = null;
let _cachedExpenses       = [];
let _cachedExtras         = [];
let _cachedSaldoCaixaJSON = {};
function logoKey() { return 'nexus_logo_' + (_userId || 'anon'); }

function loadProfile() {
    // Enquanto _userId não é conhecido, não le localStorage (evita mostrar logo de outro user)
    const logo = _userId ? (localStorage.getItem(logoKey()) || DEFAULT_LOGO) : DEFAULT_LOGO;
    const topImg = document.getElementById('topLogoImg');
    const topIcon = document.getElementById('topLogoIcon');
    const prevImg = document.getElementById('logoPreviewImg');
    const prevPlaceholder = document.getElementById('logoPlaceholder');
    if (topImg)   { topImg.src = logo; topImg.style.display = 'block'; }
    if (topIcon)  topIcon.style.display = 'none';
    if (prevImg)  { prevImg.src = logo; prevImg.style.display = 'block'; }
    if (prevPlaceholder) prevPlaceholder.style.display = 'none';
}

function uploadLogo(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) { alert('Imagem muito grande. Use até 500KB.'); return; }
    const reader = new FileReader();
    reader.onload = async e => {
        const data = e.target.result;
        localStorage.setItem(logoKey(), data);
        loadProfile();
        await savePrefsToServer({ logoBase64: data });
        showFlash('\u2705 Logo salva!');
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    localStorage.removeItem(logoKey());
    const topImg = document.getElementById('topLogoImg');
    const topIcon = document.getElementById('topLogoIcon');
    const prevImg = document.getElementById('logoPreviewImg');
    const prevPlaceholder = document.getElementById('logoPlaceholder');
    if (topImg)  { topImg.src = DEFAULT_LOGO; topImg.style.display = 'block'; }
    if (topIcon) topIcon.style.display = 'none';
    if (prevImg) { prevImg.src = DEFAULT_LOGO; prevImg.style.display = 'block'; }
    if (prevPlaceholder) prevPlaceholder.style.display = 'none';
    const inp = document.getElementById('logoFileInput');
    if (inp) inp.value = '';
    savePrefsToServer({ logoBase64: null });
    showFlash('\u2705 Logo removida!');
}

// Carrega logo salva no servidor e aplica no painel (sincroniza entre dispositivos)
async function applyLogoFromServer() {
    try {
        const r = await fetch('/auth/preferences', { credentials: 'include' });
        if (!r.ok) return;
        const p = await r.json();
        if (p.logoBase64) {
            localStorage.setItem(logoKey(), p.logoBase64);
            loadProfile();
        } else {
            // Sem logo no servidor — limpar cache desta conta para não exibir logo de outra
            localStorage.removeItem(logoKey());
            loadProfile();
        }
        // Carrega gastos mensais salvos
        if (p.expensesJSON) {
            try { const arr = JSON.parse(p.expensesJSON); _cachedExpenses = arr; renderExpenses(arr); } catch (_) {}
        }
        // Carrega gastos extras salvos
        if (p.extraExpensesJSON) {
            try { const arr = JSON.parse(p.extraExpensesJSON); _cachedExtras = arr; renderExtras(arr); } catch (_) {}
        }
        // Carrega saldo em caixa por mês
        if (p.saldoCaixaJSON) {
            try { _cachedSaldoCaixaJSON = JSON.parse(p.saldoCaixaJSON); } catch (_) {}
        }
    } catch (e) { /* falha silenciosa */ }
}

function saveSiteTitle() { /* mantido para compatibilidade */ }

async function changeUsername() {
    const newUser = document.getElementById('usernameInput').value.trim();
    const pwd     = document.getElementById('usernamePassword').value;
    const msg     = document.getElementById('usernameMsg');

    const show = (txt, ok) => {
        msg.textContent = txt;
        msg.className = 'pwd-msg ' + (ok ? 'ok' : 'erro');
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };

    if (!newUser) return show('Informe o novo nome de usuário.', false);
    if (!pwd)     return show('Informe sua senha para confirmar.', false);
    if (newUser.length < 3) return show('Nome muito curto (mínimo 3 caracteres).', false);

    try {
        const r = await fetch('/auth/change-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newUsername: newUser, password: pwd })
        });
        const d = await r.json();
        if (r.ok) {
            show('✅ Usuário alterado! Você será redirecionado...', true);
            document.getElementById('topUsername').textContent = newUser;
            document.getElementById('usernameInput').value = '';
            document.getElementById('usernamePassword').value = '';
            setTimeout(() => { window.location.href = '/login'; }, 2500);
        } else {
            show(d.error || 'Erro ao alterar usuário.', false);
        }
    } catch (e) { show('Erro de conexão.', false); }
}

async function changePwd() {
    const cur  = document.getElementById('pwd_current').value;
    const novo = document.getElementById('pwd_new').value;
    const conf = document.getElementById('pwd_confirm').value;
    const msg  = document.getElementById('pwdMsg');

    const show = (txt, ok) => {
        msg.textContent = txt;
        msg.className = 'pwd-msg ' + (ok ? 'ok' : 'erro');
        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 4000);
    };

    if (!cur || !novo || !conf) return show('Preencha todos os campos.', false);
    if (novo !== conf) return show('As senhas não coincidem.', false);
    if (novo.length < 4) return show('Nova senha muito curta.', false);

    try {
        const r = await fetch('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ currentPassword: cur, newPassword: novo })
        });
        const d = await r.json();
        if (r.ok) {
            show('✅ Senha alterada com sucesso!', true);
            document.getElementById('pwd_current').value = '';
            document.getElementById('pwd_new').value = '';
            document.getElementById('pwd_confirm').value = '';
        } else {
            show(d.error || 'Erro ao alterar senha.', false);
        }
    } catch (e) { show('Erro de conexão.', false); }
}

function showFlash(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        background: 'var(--badge-ok-bg)', color: 'var(--badge-ok-color)',
        border: '1px solid var(--badge-ok-border)',
        padding: '10px 18px', fontFamily: 'Rajdhani,sans-serif',
        fontSize: '11px', letterSpacing: '1px'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

/* ===== ABAS ===== */
function switchTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const content = document.getElementById('tab-' + name);
    if (content) content.classList.add('active');
    const btn = document.querySelector('[data-tab="' + name + '"]');
    if (btn) btn.classList.add('active');
    if (name === 'financeiro') loadFinanceiro();
    if (name === 'extras') loadExtras();
    if (name === 'perfil') loadMyRenewal();
    if (name === 'admin') { loadResellerSelect(); loadUsers(); loadLicenseInfo(); updatePlanPreview('6m'); loadRenewalRequests(); loadPlanPrices(); }
    if (name === 'servidores') loadServers();
    if (name === 'users') loadAdminUsers();
    if (name === 'mensalistas') loadMensalistas();
}

/* ===== ADMINISTRADORES (ABA USERS — somente master) ===== */
async function loadAdminUsers() {
    const tb = document.getElementById('adminUserList');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#555">Carregando...</td></tr>';
    try {
        const res = await fetch('/auth/admins', { credentials: 'include' });
        if (!res.ok) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#f44">Sem permissão</td></tr>'; return; }
        const admins = await res.json();
        if (!admins.length) {
            tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#555">Nenhum administrador cadastrado</td></tr>';
            return;
        }
        tb.innerHTML = admins.map(a => {
            const expDate = a.panelExpiry ? new Date(a.panelExpiry).toLocaleDateString('pt-BR') : '&mdash;';
            const statusBadge = a.isExpired
                ? '<span class="badge badge-pendente" style="font-size:9px">⚠ EXPIRADO</span>'
                : '<span class="badge badge-pago" style="font-size:9px">✓ ATIVO</span>';
            const createdAt = new Date(a.createdAt).toLocaleDateString('pt-BR');
            const totalClients = (a.clientsFromPersonals || 0) + (a.adminClients || 0);
            const revenueColor = (a.totalRevenue || 0) > 0 ? '#00cc66' : '#555';
            return `<tr>
                <td><strong>${a.username}</strong><br><span style="font-size:10px;color:#666">criado em ${createdAt}</span></td>
                <td>${statusBadge}</td>
                <td><span style="font-size:10px;color:var(--accent)">${a.panelPlan}</span></td>
                <td>${expDate}</td>
                <td style="text-align:center">
                    <span style="font-size:18px;font-family:'Rajdhani','Segoe UI',sans-serif;color:var(--accent2)">${a.personalCount}</span>
                    <span style="font-size:10px;color:#666"> personal(s)</span>
                    <br><span style="font-size:10px;color:#aaa">${totalClients} cliente(s)</span>
                </td>
                <td style="text-align:center">
                    <span style="font-size:18px;font-family:'Rajdhani','Segoe UI',sans-serif;color:#4499ff">${a.clientsFromPersonals}</span>
                    <br><span style="font-size:10px;color:#666">via personal</span>
                </td>
                <td style="text-align:right">
                    <span style="font-size:16px;font-family:'Rajdhani','Segoe UI',sans-serif;color:${revenueColor}">${fmt(a.totalRevenue || 0)}</span>
                    <br><span style="font-size:10px;color:#555">clientes ativos</span>
                </td>
                <td>
                    <button class="btn-sm" style="font-size:10px;background:#c0392b" onclick="deleteUser(${a.id}, '${a.username.replace(/'/g, '')}')">&#128465; Excluir</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#f44">Erro ao carregar</td></tr>';
    }
}

/* ===== LICENÇA ===== */
async function loadLicenseStatus() {
    try {
        const r = await fetch('/owner/license-status');
        const d = await r.json();
        const banner = document.getElementById('licenseBanner');
        if (!banner) return;
        if (!d.valid) {
            banner.innerHTML = `<span style="background:#ff2222;color:#fff;padding:3px 10px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:9px;letter-spacing:1px">⚠ LICENÇA EXPIRADA</span>`;
            banner.style.display = 'block';
        } else if (d.warning) {
            banner.innerHTML = `<span style="background:#ffaa00;color:#000;padding:3px 10px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:9px;letter-spacing:1px">⚠ LICENÇA VENCE EM ${d.daysLeft}d</span>`;
            banner.style.display = 'block';
        }
    } catch(e) {}
}

async function loadLicenseInfo() {
    try {
        const r = await fetch('/owner/license-status');
        const d = await r.json();
        const el = document.getElementById('licenseInfo');
        if (el) {
            const statusColor = d.valid ? '#00cc66' : '#ff4444';
            el.innerHTML = `
                <span style="color:#aaa">PLANO:</span> <strong style="color:var(--accent)">${d.plan || 'PRO'}</strong> &nbsp;
                <span style="color:#aaa">STATUS:</span> <strong style="color:${statusColor}">${d.valid ? 'ATIVO' : 'EXPIRADO'}</strong> &nbsp;
                <span style="color:#aaa">VALIDADE:</span> <strong>${d.expiresAt ? new Date(d.expiresAt+'T00:00:00').toLocaleDateString('pt-BR') : 'SEM EXPIRAÇÃO'}</strong>
                ${d.daysLeft !== null && d.daysLeft !== undefined ? `&nbsp; <span style="color:${d.daysLeft<=7?'#ffaa00':'#aaa'}">(⏳ ${d.daysLeft} dias restantes)</span>` : ''}
            `;
        }
        // Preencher o form com dados atuais
        const or = await fetch('/owner', { credentials: 'include' });
        if (or.ok) {
            const owner = await or.json();
            const licExp = document.getElementById('lic_expiration');
            const licPlan = document.getElementById('lic_plan');
            const licActive = document.getElementById('lic_active');
            if (licExp && owner.licenseExpiration) licExp.value = owner.licenseExpiration;
            if (licPlan) licPlan.value = owner.plan || 'PRO';
            if (licActive) licActive.value = owner.isActive ? '1' : '0';
        }
    } catch(e) {}
}

async function saveLicense() {
    const expiration = document.getElementById('lic_expiration').value;
    const plan = document.getElementById('lic_plan').value;
    const isActive = document.getElementById('lic_active').value === '1';
    try {
        const r = await fetch('/owner/license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ licenseExpiration: expiration || null, plan, isActive })
        });
        if (r.ok) { showFlash('✅ Licença salva!'); loadLicenseInfo(); loadLicenseStatus(); }
        else showFlash('❌ Erro ao salvar licença');
    } catch(e) { showFlash('❌ Erro de conexão'); }
}

/* ===== LOG DE AUDITORIA ===== */
async function loadAuditLog() {
    const tb = document.getElementById('auditList');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#555">Carregando...</td></tr>';
    try {
        const r = await fetch('/audit?limit=100', { credentials: 'include' });
        const logs = await r.json();
        if (!logs.length) {
            tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#555">Nenhum registro</td></tr>';
            return;
        }
        tb.innerHTML = logs.map(l => {
            const dt = new Date(l.createdAt).toLocaleString('pt-BR');
            return `<tr>
                <td style="font-size:11px">${dt}</td>
                <td>${l.userUsername || '-'}</td>
                <td><span style="color:var(--accent);font-size:10px;letter-spacing:1px">${l.action}</span></td>
                <td>${l.entity ? l.entity + (l.entityId ? ' #' + l.entityId : '') : '-'}</td>
                <td style="font-size:11px">${l.ip || '-'}</td>
            </tr>`;
        }).join('');
    } catch(e) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#f44">Erro ao carregar logs</td></tr>'; }
}

/* ===== AUTH ===== */
let _isAdmin = false;
let _isMaster = false;
let _isReseller = false;

async function loadUserInfo() {
    try {
        const res = await fetch('/auth/me', { credentials: 'include' });
        if (!res.ok) { window.location.href = '/login'; return; }
        const user = await res.json();
        _isAdmin    = user.role === 'admin' || user.role === 'master';
        _isMaster   = user.role === 'master';
        _isReseller = user.role === 'personal';
        _userId     = user.id;  // isola logo no localStorage por usuário
        document.getElementById('topUsername').textContent = user.username;
        const roleLabel = _isMaster ? 'MASTER' : (_isAdmin ? 'ADMINISTRADOR' : 'PESSOAL');
        document.getElementById('topRole').textContent = roleLabel;
        if (_isMaster) document.getElementById('topRole').style.color = 'var(--accent2)';
        // Preencher campo de usuário na aba Perfil
        const uInp = document.getElementById('usernameInput');
        if (uInp) uInp.placeholder = user.username;
        // Aplicar tema e logo salvos no servidor (fonte de verdade ao logar em outro dispositivo)
        applyThemeLocally(user.themeColor || localStorage.getItem('nexus_theme') || 'red');
        applyLogoFromServer(); // async, não bloqueia o carregamento
        if (_isAdmin) {
            const tab = document.getElementById('tabAdmin');
            if (tab) tab.style.display = '';
        }
        // Aba USUÁRIOS visível apenas para master
        if (_isMaster) {
            const tabU = document.getElementById('tabUsers');
            if (tabU) tabU.style.display = '';
            // Master vê painel de preços para admin
            const ppa = document.getElementById('planPricesAdminPanel');
            if (ppa) ppa.style.display = '';
        }
        // Master ou admin podem configurar preços para personal
        if (_isMaster || _isAdmin) {
            const ppp = document.getElementById('planPricesPersonalPanel');
            if (ppp) ppp.style.display = '';
        }
        // Personal: painel completo com dados isolados — não esconder nenhum card
        // (backend já filtra pelos dados exclusivos do usuário)

        // Exibir banner de validade do painel para personal e admin
        if (!_isMaster && user.panelExpiry) {
            const exp     = new Date(user.panelExpiry);
            const today   = new Date();
            const diffMs  = exp - today;
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const fmtExp  = exp.toLocaleDateString('pt-BR');
            const banner  = document.getElementById('licenseBanner');
            if (banner) {
                if (daysLeft <= 0) {
                    banner.innerHTML = `<span style="background:#ff2222;color:#fff;padding:3px 10px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:9px;letter-spacing:1px">⚠ SEU PAINEL EXPIROU EM ${fmtExp}</span>`;
                } else if (daysLeft <= 7) {
                    banner.innerHTML = `<span style="background:#ffaa00;color:#000;padding:3px 10px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:9px;letter-spacing:1px">⚠ PAINEL VENCE EM ${daysLeft}d (${fmtExp})</span>`;
                } else {
                    banner.innerHTML = `<span style="background:#1a2a1a;color:#00cc66;padding:3px 10px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:9px;letter-spacing:1px;border:1px solid #00cc6644">✓ PAINEL VÁLIDO ATÉ ${fmtExp}</span>`;
                }
                banner.style.display = 'block';
            }
        }
        // Configura seletor de perfil de usuário
        setupUserRoleSelector();
        // Mostra onboarding no primeiro acesso (não mostra para master)
        if (user.firstLogin && user.role !== 'master') {
            document.getElementById('modalOnboarding').style.display = 'flex';
        }
    } catch (e) {
        window.location.href = '/login';
    }
}

async function doLogout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
}

/* ===== SERVIDORES ===== */
let _serverCache = [];

async function loadServers() {
    try {
        const res = await fetch('/servers', { credentials: 'include' });
        _serverCache = await res.json();
        renderServerListUI();
        refreshServerSelects();
    } catch (e) { console.error('Erro ao carregar servidores', e); }
}

function renderServerListUI() {
    const el = document.getElementById('serverListUI');
    if (!el) return;
    if (!_serverCache.length) {
        el.innerHTML = '<span class="empty-alert">Nenhum servidor cadastrado ainda.</span>';
        return;
    }
    el.innerHTML = _serverCache.map(s => `
        <div class="server-chip">
            <span>${s.name}</span>
            ${_isAdmin ? `<button class="chip-del" onclick="deleteServer(${s.id}, '${s.name.replace(/'/g,'')}')" title="Remover">&#10005;</button>` : ''}
        </div>
    `).join('');
}

function refreshServerSelects(keepVal) {
    const opts = _serverCache.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    /* select no form de cliente */
    const sel = document.getElementById('server');
    if (sel) { const v = sel.value; sel.innerHTML = opts; if (v) sel.value = v; }
    /* selects nas linhas de revendas */
    document.querySelectorAll('.srv_name').forEach(s => {
        const v = s.value;
        s.innerHTML = opts;
        if (v) s.value = v;
    });
    /* filtro por servidor na aba revendas */
    const fSrv = document.getElementById('filterResellerServer');
    if (fSrv) {
        const cur = fSrv.value;
        fSrv.innerHTML = '<option value="">Todos os servidores</option>' +
            _serverCache.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        if (cur) fSrv.value = cur;
    }
}

async function createServer() {
    const inp = document.getElementById('newServerName');
    const name = inp.value.trim();
    if (!name) { alert('Informe o nome do servidor!'); return; }
    try {
        const res = await fetch('/servers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) { alert('\u274c ' + (data.error || 'Erro')); return; }
        inp.value = '';
        await loadServers();
    } catch (e) { alert('\u274c Erro ao adicionar servidor.'); }
}

async function deleteServer(id, name) {
    if (!confirm('Remover servidor "' + name + '"?')) return;
    try {
        await fetch('/servers/' + id, { method: 'DELETE', credentials: 'include' });
        await loadServers();
    } catch (e) { alert('\u274c Erro ao remover servidor.'); }
}

/* ===== CRIAR USUÁRIO REVENDEDOR ===== */
function setupUserRoleSelector() {
    const roleEl = document.getElementById('nu_role');
    if (!roleEl) return;
    // Ocultar opção Admin se não for master
    if (!_isMaster) {
        const adminOpt = roleEl.querySelector('option[value="admin"]');
        if (adminOpt) adminOpt.remove();
    }
    // Mostrar/ocultar campo de revenda conforme perfil
    roleEl.addEventListener('change', () => {
        const wrap = document.getElementById('nu_reseller_wrap');
        if (wrap) wrap.style.display = roleEl.value === 'personal' ? '' : 'none';
    });
}

async function loadResellerSelect() {
    try {
        const res = await fetch('/resellers', { credentials: 'include' });
        const data = await res.json();
        const sel = document.getElementById('nu_reseller');
        if (!sel) return;
        sel.innerHTML = '<option value="">\u2014 Selecione \u2014</option>';
        data.forEach(r => { sel.innerHTML += `<option value="${r.id}">${r.name}</option>`; });
    } catch (e) {}
}

/* ===== CARDS DE PLANO ===== */
const PLAN_DAYS_MAP = { '1m': 30, '3m': 90, '6m': 180, '1a': 365 };
const PLAN_LABEL_MAP = { '1m': '1 M\u00caS', '3m': '3 MESES', '6m': '6 MESES', '1a': '1 ANO' };

function selectPlanCard(el, plan) {
    document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('plan-card-selected'));
    el.classList.add('plan-card-selected');
    const inp = document.getElementById('nu_accessPlan');
    if (inp) inp.value = plan;
    updatePlanPreview(plan);
}

function updatePlanPreview(plan) {
    const days = PLAN_DAYS_MAP[plan] || 30;
    const start = new Date();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    const fmt = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const els = {
        start:  document.getElementById('prev_start'),
        expiry: document.getElementById('prev_expiry'),
        plan:   document.getElementById('prev_plan')
    };
    if (els.start)  els.start.textContent  = fmt(start);
    if (els.expiry) els.expiry.textContent = fmt(expiry);
    if (els.plan)   els.plan.textContent   = 'STANDARD \u2014 ' + (PLAN_LABEL_MAP[plan] || plan);
}

async function createUserReseller() {
    const username   = document.getElementById('nu_username').value.trim();
    const password   = document.getElementById('nu_password').value;
    const role       = document.getElementById('nu_role')?.value || 'personal';
    const accessPlan = document.getElementById('nu_accessPlan')?.value || '1m';
    if (!username || !password) { alert('Informe usu\u00e1rio e senha!'); return; }
    try {
        const res = await fetch('/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, accessPlan }),
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) { alert('\u274c ' + (data.error || 'Erro')); return; }
        const expMsg = data.panelExpiry
            ? new Date(data.panelExpiry).toLocaleDateString('pt-BR')
            : '\u2014';
        showFlash('\u2705 Acesso criado! Usu\u00e1rio: ' + username + (data.panelExpiry ? ' | Expira: ' + expMsg : ''));
        document.getElementById('nu_username').value = '';
        document.getElementById('nu_password').value = '';
        document.getElementById('nu_role').value = 'personal';
        onNuRoleChange();
        loadUsers();
    } catch (e) { alert('\u274c Erro ao criar acesso.'); }
}

// Mostra/oculta cards de plano conforme o perfil selecionado
function onNuRoleChange() {
    const role = document.getElementById('nu_role')?.value || 'personal';
    const planWrap = document.getElementById('nu_plan_wrap');
    // Plano obrigatório para personal; opcional (mas exibido) para admin
    if (planWrap) planWrap.style.display = ['personal', 'admin'].includes(role) ? '' : 'none';
    if (['personal', 'admin'].includes(role)) {
        const current = document.getElementById('nu_accessPlan')?.value || '6m';
        updatePlanPreview(current);
    }
}

async function loadUsers() {
    try {
        const res = await fetch('/auth/users', { credentials: 'include' });
        if (!res.ok) return;
        const users = await res.json();
        const tb = document.getElementById('userList');
        if (!tb) return;
        tb.innerHTML = users.map(u => {
            const isExpired = u.panelExpiry && new Date(u.panelExpiry) < new Date();
            const expDate   = u.panelExpiry ? new Date(u.panelExpiry).toLocaleDateString('pt-BR') : '—';
            const expBadge  = u.role === 'personal'
                ? (isExpired
                    ? '<span class="badge badge-pendente" style="font-size:9px">⚠ EXPIRADO</span>'
                    : '<span class="badge badge-pago" style="font-size:9px">✓ ATIVO</span>')
                : '—';
            const planLabel = u.role === 'personal' ? (u.panelPlan || 'STANDARD') : '—';
            return `<tr>
                <td>${u.username}${u.firstLogin ? ' <span style="font-size:10px;color:#ff9800">●PRIMEIRO ACESSO</span>' : ''}</td>
                <td><span class="badge ${u.role === 'personal' ? 'badge-pendente' : 'badge-pago'}">${u.role.toUpperCase()}</span></td>
                <td>${u.resellerId || '—'}</td>
                <td>${planLabel}</td>
                <td>${expDate} ${expBadge}</td>
                <td style="white-space:nowrap">
                    <button class="btn-sm" style="font-size:10px" onclick="generateUserResetToken(${u.id}, '${u.username.replace(/'/g,'')}')">&#128273; Senha</button>
                    <button class="btn-sm" style="font-size:10px;background:#c0392b;margin-left:4px" onclick="deleteUser(${u.id}, '${u.username.replace(/'/g,'')}')">&#128465; Excluir</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {}
}

/* ===== ONBOARDING ===== */
function closeOnboarding() {
    document.getElementById('modalOnboarding').style.display = 'none';
    fetch('/auth/first-login-done', { method: 'POST', credentials: 'include' }).catch(() => {});
}

/* ===== EXCLUIR USUÁRIO ===== */
async function deleteUser(userId, username) {
    if (!confirm('Excluir o acesso de "' + username + '"?\nEssa ação não pode ser desfeita.')) return;
    try {
        const res = await fetch('/auth/users/' + userId, {
            method: 'DELETE', credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) { alert('\u274c ' + (data.error || 'Erro')); return; }
        showFlash('\u2705 Acesso de "' + username + '" excluído.');
        loadUsers();
    } catch (e) { alert('\u274c Erro ao excluir.'); }
}


/* ===== RESET SENHA DE USUÁRIO ===== */
let _resetLinkUrl = '';
async function generateUserResetToken(userId, username) {
    if (!confirm('Gerar link de reset de senha para "' + username + '"?\nO link expira em 24 horas.')) return;
    try {
        const res = await fetch('/auth/users/' + userId + '/reset-token', {
            method: 'POST', credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) { alert('\u274c ' + (data.error || 'Erro')); return; }
        const base = window.location.origin;
        _resetLinkUrl = base + '/reset-password?token=' + data.token;
        document.getElementById('resetLinkInput').value = _resetLinkUrl;
        document.getElementById('modalResetLink').style.display = 'flex';
    } catch (e) { alert('\u274c Erro ao gerar token.'); }
}

function copyResetLink() {
    navigator.clipboard.writeText(_resetLinkUrl).then(() => {
        showFlash('\u2705 Link copiado! Envie para o usuário via WhatsApp.');
    }).catch(() => {
        document.getElementById('resetLinkInput').select();
        document.execCommand('copy');
        showFlash('\u2705 Link copiado!');
    });
}

/* ===== CRIAR CLIENTE ===== */
let _clientMap = new Map();

async function createClient() {
    const payload = {
        name:          document.getElementById('name').value,
        username:      document.getElementById('username').value,
        password:      document.getElementById('password').value,
        whatsapp:      document.getElementById('whatsapp').value,
        planType:      Number(document.getElementById('planType').value),
        app:           document.getElementById('app').value,
        server:        document.getElementById('server').value,
        planValue:     Number(document.getElementById('planValue').value),
        costPerActive: Number(document.getElementById('costPerActive').value)
    };
    if (!payload.name || !payload.username) { alert('Preencha Nome e Usu\u00e1rio!'); return; }
    try {
        const res = await fetch('/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        alert('\u2705 Cliente cadastrado!');
        ['name','username','password','whatsapp','planValue','costPerActive','app'].forEach(id => {
            document.getElementById(id).value = '';
        });
        loadClients();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao cadastrar cliente.'); }
}

/* ===== LISTAR CLIENTES ===== */
async function loadClients() {
    try {
        const res = await fetch('/clients', { credentials: 'include' });
        let data = await res.json();
        _clientMap = new Map(data.map(c => [c.id, c]));
        const filter = document.getElementById('filterClientStatus')?.value;
        if (filter) data = data.filter(c => c.status === filter);
        const table = document.getElementById('clientList');
        table.innerHTML = '';
        if (!data.length) {
            table.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#555">Nenhum cliente cadastrado</td></tr>';
            return;
        }
        data.forEach(c => {
            const due = c.dueDate ? new Date(c.dueDate).toLocaleDateString('pt-BR') : '-';
            const isAtivo = c.status !== 'INATIVO';
            const badgeClass = isAtivo ? 'badge-pago' : 'badge-pendente';
            const waTel = c.whatsapp ? c.whatsapp.replace(/\D/g,'') : '';
            const waLink = waTel ? `<a href="https://wa.me/55${waTel}" target="_blank" style="color:var(--accent)">${c.whatsapp}</a>` : '-';
            table.innerHTML += `
            <tr class="${isAtivo ? '' : 'row-inativo'}">
                <td>${c.name}</td>
                <td>${c.username}</td>
                <td>${waLink}</td>
                <td>${c.server || '-'}</td>
                <td>${c.planType}d</td>
                <td>${fmt(c.planValue)}</td>
                <td>${due}</td>
                <td>${c.app || '-'}</td>
                <td><span class="badge ${badgeClass}">${c.status || 'ATIVO'}</span></td>
                <td class="td-actions">
                    <button class="btn-action btn-edit" onclick="openClientModal(${c.id})" title="Ver detalhes">&#128065;</button>
                    <button class="btn-action ${isAtivo ? 'btn-danger' : 'btn-success'}" onclick="toggleClientStatus(${c.id}, this)" title="${isAtivo ? 'Desativar' : 'Ativar'}">${isAtivo ? '&#10006;' : '&#10003;'}</button>
                    <button class="btn-action btn-danger" onclick="deleteClientConfirm(${c.id}, '${(c.name||'').replace(/'/g,'')}')" title="Excluir">&#128465;</button>
                </td>
            </tr>`;
        });
    } catch (e) { console.error('Erro ao carregar clientes', e); }
}

async function toggleClientStatus(id, btn) {
    try {
        const res = await fetch('/clients/' + id + '/status', { method: 'PATCH', credentials: 'include' });
        if (!res.ok) throw new Error();
        loadClients();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao atualizar status.'); }
}

async function deleteClientConfirm(id, name) {
    if (!confirm('Excluir o cliente "' + name + '"?\nEssa ação não pode ser desfeita.')) return;
    try {
        const res = await fetch('/clients/' + id, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) { const d = await res.json(); alert('\u274c ' + (d.error || 'Erro')); return; }
        showFlash('\u2705 Cliente "' + name + '" excluído.');
        loadClients();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao excluir cliente.'); }
}

let _currentClient = null;
function openClientModal(id) {
    const c = _clientMap.get(id);
    if (!c) return;
    const due  = c.dueDate  ? new Date(c.dueDate).toLocaleDateString('pt-BR')  : '-';
    const start= c.startDate? new Date(c.startDate).toLocaleDateString('pt-BR'): '-';
    const waTelM = c.whatsapp ? c.whatsapp.replace(/\D/g,'') : '';
    const waLinkM = waTelM ? `<a href="https://wa.me/55${waTelM}" target="_blank" style="color:var(--accent)">${c.whatsapp}</a>` : '-';
    document.getElementById('clientDetail').innerHTML = `
        <div class="detail-item"><span>Nome</span><strong>${c.name}</strong></div>
        <div class="detail-item"><span>Usu&aacute;rio</span><strong>${c.username}</strong></div>
        <div class="detail-item"><span>Senha</span><strong>${c.password || '-'}</strong></div>
        <div class="detail-item"><span>WhatsApp</span><strong>${waLinkM}</strong></div>
        <div class="detail-item"><span>Servidor</span><strong>${c.server || '-'}</strong></div>
        <div class="detail-item"><span>App</span><strong>${c.app || '-'}</strong></div>
        <div class="detail-item"><span>Plano</span><strong>${c.planType} dias</strong></div>
        <div class="detail-item"><span>Valor Cobrado</span><strong>${fmt(c.planValue)}</strong></div>
        <div class="detail-item"><span>Seu Custo</span><strong>${fmt(c.costPerActive)}</strong></div>
        <div class="detail-item"><span>In&iacute;cio</span><strong>${start}</strong></div>
        <div class="detail-item"><span>Vencimento</span><strong>${due}</strong></div>
        <div class="detail-item"><span>Status</span><strong><span class="badge ${c.status==='INATIVO'?'badge-pendente':'badge-pago'}">${c.status||'ATIVO'}</span></strong></div>
        <div class="detail-item" style="grid-column:1/-1;margin-top:8px;display:flex;gap:10px">
            <button onclick="closeClientModal();openEditClientModal(${c.id})" style="flex:1">&#9998; EDITAR / RENOVAR</button>
        </div>
    `;
    document.getElementById('modalClient').style.display = 'flex';
}

function closeClientModal() {
    document.getElementById('modalClient').style.display = 'none';
}

/* ===== EDITAR / RENOVAR CLIENTE ===== */
function openEditClientModal(id) {
    const c = _clientMap.get(id);
    if (!c) return;
    document.getElementById('ec_id').value          = c.id;
    document.getElementById('ec_name').value         = c.name || '';
    document.getElementById('ec_username').value     = c.username || '';
    document.getElementById('ec_password').value     = c.password || '';
    document.getElementById('ec_whatsapp').value     = c.whatsapp || '';
    document.getElementById('ec_app').value          = c.app || '';
    document.getElementById('ec_planValue').value    = c.planValue || '';
    document.getElementById('ec_costPerActive').value= c.costPerActive || '';
    // servidor
    const srvSel = document.getElementById('ec_server');
    srvSel.innerHTML = _serverCache.map(s =>
        `<option${s.name === c.server ? ' selected' : ''}>${s.name}</option>`).join('');
    if (!_serverCache.length) srvSel.innerHTML = `<option>${c.server || ''}</option>`;
    // plano
    const planSel = document.getElementById('ec_planType');
    planSel.value = String(c.planType || 30);
    // exibir datas
    _updateEcDates();
    planSel.onchange = _updateEcDates;
    document.getElementById('modalEditClient').style.display = 'flex';
}

function _updateEcDates() {
    const id = Number(document.getElementById('ec_id').value);
    const c  = _clientMap.get(id);
    const days = Number(document.getElementById('ec_planType').value) || 30;
    const due  = c?.dueDate ? new Date(c.dueDate) : null;
    const dueStr = due ? due.toLocaleDateString('pt-BR') : '-';
    const base = due && due > new Date() ? new Date(due) : new Date();
    base.setDate(base.getDate() + days);
    document.getElementById('ec_dueDisplay').textContent = dueStr;
    document.getElementById('ec_renewDisplay').textContent = base.toLocaleDateString('pt-BR');
}

function closeEditClientModal() {
    document.getElementById('modalEditClient').style.display = 'none';
}

async function saveEditClient() {
    const id = document.getElementById('ec_id').value;
    const payload = {
        name:          document.getElementById('ec_name').value,
        username:      document.getElementById('ec_username').value,
        password:      document.getElementById('ec_password').value,
        whatsapp:      document.getElementById('ec_whatsapp').value,
        server:        document.getElementById('ec_server').value,
        app:           document.getElementById('ec_app').value,
        planType:      document.getElementById('ec_planType').value,
        planValue:     Number(document.getElementById('ec_planValue').value),
        costPerActive: Number(document.getElementById('ec_costPerActive').value)
    };
    try {
        const res = await fetch('/clients/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        showFlash('\u2705 Cliente atualizado!');
        closeEditClientModal();
        loadClients();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao salvar cliente.'); }
}

async function renewClient() {
    const id   = document.getElementById('ec_id').value;
    const days = document.getElementById('ec_planType').value;
    try {
        const res = await fetch('/clients/' + id + '/renew', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ planType: days })
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        const nova = new Date(data.dueDate).toLocaleDateString('pt-BR');
        showFlash('\u2705 Renovado! Novo vencimento: ' + nova);
        closeEditClientModal();
        loadClients();
        loadExpiringSoon();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao renovar cliente.'); }
}

/* ===== REVENDAS — FORMULÁRIO DINÂMICO ===== */

function onTypeChange() {
    const container = document.getElementById('serverContainer');
    const qtd = container.querySelectorAll('.serverRow').length;
    container.innerHTML = '';
    for (let i = 0; i < (qtd || 1); i++) addServer();
}

function buildServerOptions(selected) {
    if (!_serverCache.length) return '<option>Sem servidores</option>';
    return _serverCache.map(s =>
        `<option${selected && s.name === selected ? ' selected' : ''}>${s.name}</option>`
    ).join('');
}

function addServer() {
    const container = document.getElementById('serverContainer');
    if (container.querySelectorAll('.serverRow').length === 0) {
        container.innerHTML = `
        <div class="server-header">
            <span>SERVIDOR</span>
            <span>QTD ATIVOS</span>
            <span>VALOR / ATIVO (R$)</span>
            <span>SEU CUSTO / ATIVO (R$)</span>
            <span>DATA DE ACERTO</span>
            <span></span>
        </div>`;
    }
    const div = document.createElement('div');
    div.className = 'serverRow';
    div.innerHTML = `
        <select class="srv_name">${buildServerOptions()}</select>
        <input class="srv_active" type="number" placeholder="Ex: 50" min="0">
        <input class="srv_price" type="number" placeholder="Ex: 10.00" min="0" step="0.01">
        <input class="srv_cost" type="number" placeholder="Ex: 6.00" min="0" step="0.01">
        <input class="srv_settle" type="date" title="Data de Acerto deste servidor">
        <button class="btn-secondary btn-remove" onclick="removeServerRow(this)">&#10006;</button>
    `;
    container.appendChild(div);
}

function removeServerRow(btn) {
    btn.parentNode.remove();
    if (!document.getElementById('serverContainer').querySelectorAll('.serverRow').length) {
        document.getElementById('serverContainer').innerHTML = '';
    }
}

/* ===== CRIAR REVENDA ===== */
async function createReseller() {
    const rows = document.querySelectorAll('#serverContainer .serverRow');
    if (!rows.length) { alert('Adicione ao menos um servidor!'); return; }
    const name = document.getElementById('r_name').value;
    if (!name) { alert('Informe o nome da revenda!'); return; }
    const servers = [];
    rows.forEach(r => {
        servers.push({
            server:        r.querySelector('.srv_name').value,
            activeCount:   Number(r.querySelector('.srv_active').value) || 0,
            pricePerActive:Number(r.querySelector('.srv_price').value) || 0,
            costPerActive: Number(r.querySelector('.srv_cost').value) || 0,
            settleDate:    r.querySelector('.srv_settle')?.value || null
        });
    });
    try {
        const res = await fetch('/resellers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                name,
                type: document.getElementById('r_type').value,
                whatsapp: document.getElementById('r_whatsapp').value || null,
                servers
            })
        });
        if (!res.ok) throw new Error();
        alert('\u2705 Revenda cadastrada!');
        document.getElementById('r_name').value = '';
        document.getElementById('r_whatsapp').value = '';
        document.getElementById('serverContainer').innerHTML = '';
        addServer();
        loadResellers();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao cadastrar revenda.'); }
}

/* ===== LISTAR REVENDAS ===== */
async function loadResellers() {
    try {
        const res = await fetch('/resellers', { credentials: 'include' });
        let data = await res.json();
        // Mensalistas têm aba própria — não aparecem aqui
        data = data.filter(r => r.type !== 'MEN' && r.type !== 'MENF');
        const filterStatus = document.getElementById('filterResellerStatus')?.value;
        const filterServer = document.getElementById('filterResellerServer')?.value;
        if (filterStatus) data = data.filter(r => r.status === filterStatus);
        if (filterServer) data = data.filter(r => (r.servers || []).some(s => s.server === filterServer));
        const table = document.getElementById('resellerList');
        table.innerHTML = '';
        if (!data.length) {
            table.innerHTML = '<tr><td colspan="12" style="text-align:center;color:#555">Nenhuma revenda cadastrada</td></tr>';
            return;
        }
        const today = new Date(); today.setHours(0,0,0,0);
        data.forEach(r => {
            const servers = r.servers || [];
            const serverNames = servers.map(s => s.server).join(', ') || '-';
            const totalAtivos = servers.reduce((acc, s) => acc + (s.activeCount || 0), 0);
            const receita = servers.reduce((acc, s) => acc + (s.pricePerActive * s.activeCount), 0);
            const custo   = servers.reduce((acc, s) => acc + (s.costPerActive * s.activeCount), 0);
            // Datas de acerto por servidor
            let rowClass = '';
            const settleParts = servers.map(s => {
                if (!s.settleDate) return null;
                const d = new Date(s.settleDate + 'T00:00:00');
                const diff = Math.ceil((d - today) / 86400000);
                if (diff >= 0 && diff <= 7 && rowClass !== 'row-danger') rowClass = 'row-warning';
                if (diff < 0) rowClass = 'row-danger';
                return `${s.server}: ${d.toLocaleDateString('pt-BR')}`;
            }).filter(Boolean);
            const settleDisplay = settleParts.length ? settleParts.join('<br>') : '-';
            const waTelR = r.whatsapp ? r.whatsapp.replace(/\D/g,'') : '';
            const waLinkR = waTelR ? `<a href="https://wa.me/55${waTelR}" target="_blank" style="color:var(--accent)">${r.whatsapp}</a>` : '-';
            const pago       = r.paymentStatus === 'PAGO';
            const isAtivo    = r.status !== 'INATIVO';
            const safeName   = r.name.replace(/'/g, '');
            // Plano gestor
            const today2 = new Date(); today2.setHours(0,0,0,0);
            let planHtml = '';
            if (r.planActive && r.planExpiresAt) {
                const exp = new Date(r.planExpiresAt + 'T00:00:00');
                const diff = Math.ceil((exp - today2) / 86400000);
                const expStr = exp.toLocaleDateString('pt-BR');
                const cor = diff <= 5 ? '#ff9800' : '#00cc66';
                planHtml = `<span class="badge" style="background:${cor};color:#000;font-size:10px">ATIVO</span><br><span style="font-size:10px;color:#aaa">${expStr}${diff <= 5 ? ' ⚠' : ''}</span><br>`;
            } else if (r.planExpiresAt && !r.planActive) {
                planHtml = `<span class="badge badge-pendente" style="font-size:10px">EXPIRADO</span><br>`;
            } else {
                planHtml = `<span class="badge" style="background:#555;color:#ccc;font-size:10px">INATIVO</span><br>`;
            }
            const planBtnLabel = r.planActive ? 'Renovar' : 'Ativar';
            planHtml += `<button class="btn-sm" style="margin-top:3px;font-size:10px" onclick="openPlanModal(${r.id}, '${safeName}', ${!!r.planActive}, '${r.planExpiresAt || ''}')">${planBtnLabel}</button>`;
            table.innerHTML += `
            <tr class="${rowClass}${isAtivo ? '' : ' row-inativo'}">
                <td>${r.name}</td>
                <td>${r.type}</td>
                <td>${waLinkR}</td>
                <td title="${serverNames}">${serverNames.length > 28 ? serverNames.slice(0,26)+'..' : serverNames}</td>
                <td>${totalAtivos}</td>
                <td>${fmt(receita)}</td>
                <td>${fmt(custo)}</td>
                <td style="font-size:12px;line-height:1.6">${settleDisplay}</td>
                <td><button class="badge ${pago ? 'badge-pago' : 'badge-pendente'}" onclick="togglePayment(${r.id}, '${r.paymentStatus}', this)">${r.paymentStatus}</button></td>
                <td><span class="badge ${isAtivo ? 'badge-pago' : 'badge-pendente'}">${r.status || 'ATIVO'}</span></td>
                <td style="text-align:center">${planHtml}</td>
                <td class="td-actions">
                    <button class="btn-action btn-edit" onclick="openEditModal(${r.id})" title="Editar">&#9998;</button>
                    <button class="btn-action ${isAtivo ? 'btn-danger' : 'btn-success'}" onclick="toggleResellerStatus(${r.id}, this)" title="${isAtivo ? 'Desativar' : 'Ativar'}">${isAtivo ? '&#10006;' : '&#10003;'}</button>
                    <button class="btn-action btn-danger" onclick="deleteReseller(${r.id}, '${safeName}')" title="Excluir">&#128465;</button>
                </td>
            </tr>`;
        });
    } catch (e) { console.error('Erro ao carregar revendas', e); }
}

async function toggleResellerStatus(id, btn) {
    try {
        const res = await fetch('/resellers/' + id + '/status', { method: 'PATCH', credentials: 'include' });
        if (!res.ok) throw new Error();
        loadResellers();
        loadMensalistas();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao atualizar status.'); }
}

async function togglePayment(id, current, btn) {
    const next = current === 'PAGO' ? 'PENDENTE' : 'PAGO';
    try {
        const res = await fetch('/resellers/' + id + '/payment', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: next }),
            credentials: 'include'
        });
        if (!res.ok) throw new Error();
        loadResellers();
        loadMensalistas();
        loadExpiringSoon();
    } catch (e) { alert('\u274c Erro ao atualizar pagamento.'); }
}

/* ===== PLANO GESTOR (REVENDA) ===== */
let _planResellerId = null;

function openPlanModal(id, name, isActive, expiresAt) {
    _planResellerId = id;
    document.getElementById('planResellerName').textContent = name;
    const statusEl = document.getElementById('planCurrentStatus');
    if (isActive && expiresAt) {
        const exp = new Date(expiresAt + 'T00:00:00');
        const diff = Math.ceil((exp - new Date()) / 86400000);
        const cor = diff <= 5 ? '#ff9800' : '#00cc66';
        statusEl.innerHTML = `Status: <strong style="color:${cor}">ATIVO</strong> &nbsp; Vence: <strong>${exp.toLocaleDateString('pt-BR')}</strong>${diff <= 5 ? ' <span style="color:#ff9800">⚠ ' + diff + ' dia(s)</span>' : ''}`;
    } else if (!isActive && expiresAt) {
        const exp = new Date(expiresAt + 'T00:00:00');
        statusEl.innerHTML = `Status: <strong style="color:#f44">EXPIRADO</strong> &nbsp; Venceu: <strong>${exp.toLocaleDateString('pt-BR')}</strong>`;
    } else {
        statusEl.innerHTML = `Status: <strong style="color:#888">SEM PLANO</strong>`;
    }
    document.getElementById('planMonths').value = '1';
    document.getElementById('planValueInput').value = '20';
    document.getElementById('modalPlan').style.display = 'flex';
}

function closePlanModal() {
    document.getElementById('modalPlan').style.display = 'none';
    _planResellerId = null;
}

async function confirmSetPlan(action) {
    if (!_planResellerId) return;
    const months = document.getElementById('planMonths').value;
    const planValue = document.getElementById('planValueInput').value;
    try {
        const res = await fetch('/resellers/' + _planResellerId + '/plan', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, months: Number(months), planValue: Number(planValue) }),
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) { alert('\u274c ' + (data.error || 'Erro')); return; }
        if (action === 'cancel') {
            showFlash('\u2705 Plano cancelado!');
        } else {
            const exp = new Date(data.planExpiresAt + 'T00:00:00');
            showFlash('\u2705 Plano ativado! Vence em ' + exp.toLocaleDateString('pt-BR'));
        }
        closePlanModal();
        loadResellers();
    } catch (e) { alert('\u274c Erro ao atualizar plano.'); }
}

/* ===== EDITAR REVENDA ===== */
async function openEditModal(id) {
    try {
        const res = await fetch('/resellers', { credentials: 'include' });
        const list = await res.json();
        const r = list.find(x => x.id === id);
        if (!r) return;
        document.getElementById('edit_id').value       = r.id;
        document.getElementById('edit_name').value     = r.name;
        document.getElementById('edit_type').value     = r.type;
        document.getElementById('edit_whatsapp').value = r.whatsapp || '';
        document.getElementById('edit_payment').value  = r.paymentStatus || 'PENDENTE';
        const container = document.getElementById('edit_serverContainer');
        container.innerHTML = `<div class="server-header"><span>SERVIDOR</span><span>QTD ATIVOS</span><span>VALOR/ATIVO</span><span>CUSTO/ATIVO</span><span>DATA ACERTO</span><span></span></div>`;
        (r.servers || []).forEach(s => addEditServer(s));
        document.getElementById('modalEdit').style.display = 'flex';
    } catch (e) { alert('Erro ao carregar revenda.'); }
}

function addEditServer(data) {
    const container = document.getElementById('edit_serverContainer');
    if (!container.querySelector('.server-header')) {
        container.innerHTML = `<div class="server-header"><span>SERVIDOR</span><span>QTD ATIVOS</span><span>VALOR/ATIVO</span><span>CUSTO/ATIVO</span><span>DATA ACERTO</span><span></span></div>`;
    }
    const div = document.createElement('div');
    div.className = 'serverRow';
    div.innerHTML = `
        <select class="srv_name">${buildServerOptions(data && data.server)}</select>
        <input class="srv_active" type="number" value="${data ? data.activeCount : ''}" placeholder="Qtd" min="0">
        <input class="srv_price" type="number" value="${data ? data.pricePerActive : ''}" placeholder="Valor" min="0" step="0.01">
        <input class="srv_cost" type="number" value="${data ? data.costPerActive : ''}" placeholder="Custo" min="0" step="0.01">
        <input class="srv_settle" type="date" value="${data && data.settleDate ? data.settleDate : ''}" title="Data de Acerto deste servidor">
        <button class="btn-secondary btn-remove" onclick="this.parentNode.remove()">&#10006;</button>
    `;
    container.appendChild(div);
}

async function saveEditReseller() {
    const id   = document.getElementById('edit_id').value;
    const name = document.getElementById('edit_name').value;
    if (!name) { alert('Informe o nome!'); return; }
    const rows = document.querySelectorAll('#edit_serverContainer .serverRow');
    const servers = [];
    rows.forEach(r => {
        servers.push({
            server:         r.querySelector('.srv_name').value,
            activeCount:    Number(r.querySelector('.srv_active').value) || 0,
            pricePerActive: Number(r.querySelector('.srv_price').value) || 0,
            costPerActive:  Number(r.querySelector('.srv_cost').value) || 0,
            settleDate:     r.querySelector('.srv_settle')?.value || null
        });
    });
    try {
        const res = await fetch('/resellers/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                type:          document.getElementById('edit_type').value,
                whatsapp:      document.getElementById('edit_whatsapp').value || null,
                paymentStatus: document.getElementById('edit_payment').value,
                servers
            }),
            credentials: 'include'
        });
        if (!res.ok) throw new Error();
        document.getElementById('modalEdit').style.display = 'none';
        loadResellers();
        loadMetrics();
        loadExpiringSoon();
    } catch (e) { alert('\u274c Erro ao salvar.'); }
}

function closeModal(e) {
    if (e.target.id === 'modalEdit') document.getElementById('modalEdit').style.display = 'none';
}

async function deleteReseller(id, name) {
    if (!confirm('Excluir a revenda "' + name + '"?\nEssa ação não pode ser desfeita.')) return;
    try {
        const res = await fetch('/resellers/' + id, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error();
        loadResellers();
        loadMensalistas();
        loadMetrics();
        loadExpiringSoon();
        loadResellerSelect();
    } catch (e) { alert('\u274c Erro ao excluir revenda.'); }
}

/* ===== MENSALISTAS ===== */

function onMensalistaTypeChange() {
    const container = document.getElementById('mensalistaFormExtra');
    const btnAddServer = document.getElementById('btnAddMensalistaServer');
    if (!container) return;
    container.innerHTML = '';
    const isFixo = document.getElementById('mn_type')?.value === 'MENF';
    if (isFixo) {
        if (btnAddServer) btnAddServer.style.display = 'none';
        container.innerHTML = `
        <div class="form-row" style="margin-bottom:15px">
            <div class="field"><label>Valor Mensal (R$)</label><input id="mn_fixedFee" type="number" placeholder="Ex: 150.00" min="0" step="0.01"></div>
            <div class="field"><label>Data de Acerto</label><input id="mn_fixedSettle" type="date"></div>
        </div>`;
    } else {
        if (btnAddServer) btnAddServer.style.display = '';
        addMensalistaServer();
    }
}

function addMensalistaServer() {
    const container = document.getElementById('mensalistaFormExtra');
    if (!container) return;
    if (container.querySelectorAll('.serverRow').length === 0) {
        container.innerHTML = `
        <div class="server-header">
            <span>SERVIDOR</span>
            <span>QTD ATIVOS</span>
            <span>VALOR / ATIVO (R$)</span>
            <span>SEU CUSTO / ATIVO (R$)</span>
            <span>DATA DE ACERTO</span>
            <span></span>
        </div>`;
    }
    const div = document.createElement('div');
    div.className = 'serverRow';
    div.innerHTML = `
        <select class="srv_name">${buildServerOptions()}</select>
        <input class="srv_active" type="number" placeholder="Ex: 50" min="0">
        <input class="srv_price" type="number" placeholder="Ex: 10.00" min="0" step="0.01">
        <input class="srv_cost"  type="number" placeholder="Ex: 6.00"  min="0" step="0.01">
        <input class="srv_settle" type="date" title="Data de Acerto deste servidor">
        <button class="btn-secondary btn-remove" onclick="this.parentNode.remove()">&#10006;</button>
    `;
    container.appendChild(div);
}

async function createMensalista() {
    const name = document.getElementById('mn_name').value.trim();
    if (!name) { alert('Informe o nome!'); return; }
    const type = document.getElementById('mn_type').value;
    const body = { name, type, whatsapp: document.getElementById('mn_whatsapp').value || null };

    if (type === 'MENF') {
        body.fixedFee = Number(document.getElementById('mn_fixedFee')?.value) || 0;
        body.settleDate = document.getElementById('mn_fixedSettle')?.value || null;
        body.servers = [];
    } else {
        const rows = document.querySelectorAll('#mensalistaFormExtra .serverRow');
        if (!rows.length) { alert('Adicione ao menos um servidor!'); return; }
        body.servers = [];
        rows.forEach(r => {
            body.servers.push({
                server:        r.querySelector('.srv_name').value,
                activeCount:   Number(r.querySelector('.srv_active').value) || 0,
                pricePerActive:Number(r.querySelector('.srv_price').value) || 0,
                costPerActive: Number(r.querySelector('.srv_cost').value)  || 0,
                settleDate:    r.querySelector('.srv_settle')?.value || null
            });
        });
    }
    try {
        const res = await fetch('/resellers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error();
        showFlash('\u2705 Mensalista cadastrado!');
        document.getElementById('mn_name').value = '';
        document.getElementById('mn_whatsapp').value = '';
        onMensalistaTypeChange();
        loadMensalistas();
        loadMetrics();
    } catch (e) { alert('\u274c Erro ao cadastrar mensalista.'); }
}

async function saveExpenses() {
    const rows = document.querySelectorAll('#expenseContainer .expense-row');
    const expenses = [];
    rows.forEach(r => {
        const name  = r.querySelector('.exp_name')?.value?.trim();
        const value = Number(r.querySelector('.exp_value')?.value) || 0;
        if (name && value > 0) expenses.push({ name, value });
    });
    try {
        await fetch('/auth/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ expensesJSON: JSON.stringify(expenses) })
        });
        showFlash('\u2705 Gastos salvos!');
        loadMensalistas();
    } catch (e) { alert('\u274c Erro ao salvar gastos.'); }
}

function addExpenseRow(data) {
    const container = document.getElementById('expenseContainer');
    if (!container) return;
    // Garante que o cabeçalho existe
    if (!container.querySelector('.expense-header')) {
        const hdr = document.createElement('div');
        hdr.className = 'server-header expense-header';
        hdr.style.gridTemplateColumns = '1fr 160px 36px';
        hdr.innerHTML = '<span>DESCRIÇÃO DO GASTO</span><span>VALOR (R$)</span><span></span>';
        container.innerHTML = '';
        container.appendChild(hdr);
    }
    const div = document.createElement('div');
    div.className = 'serverRow expense-row';
    div.style.gridTemplateColumns = '1fr 160px 36px';
    div.innerHTML = `
        <input class="exp_name" type="text" placeholder="Ex: Aluguel, Internet..." value="${data ? data.name.replace(/"/g,'&quot;') : ''}">
        <input class="exp_value" type="number" placeholder="0.00" min="0" step="0.01" value="${data ? data.value : ''}" oninput="calcExpenseTotal()">
        <button class="btn-secondary btn-remove" onclick="this.parentNode.remove();calcExpenseTotal()">&#10006;</button>
    `;
    container.appendChild(div);
    calcExpenseTotal();
}

function renderExpenses(arr) {
    _cachedExpenses = arr || [];
    const container = document.getElementById('expenseContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!arr || !arr.length) { calcExpenseTotal(); return; }
    arr.forEach(item => addExpenseRow(item));
    calcExpenseTotal();
    loadMensalistas(); // recalcula lucro com gastos carregados
}

function calcExpenseTotal() {
    const rows = document.querySelectorAll('#expenseContainer .expense-row');
    const total = Array.from(rows).reduce((acc, r) => {
        return acc + (Number(r.querySelector('.exp_value')?.value) || 0);
    }, 0);
    const el = document.getElementById('expenseTotal');
    if (el) el.textContent = fmt(total);
}

/* ===== GASTOS EXTRAS ===== */
function addExtraRow(data) {
    const container = document.getElementById('extraContainer');
    if (!container) return;
    if (!container.children.length) {
        const hdr = document.createElement('div');
        hdr.className = 'serverRow';
        hdr.style.gridTemplateColumns = '1fr 160px 36px';
        hdr.innerHTML = '<span>DESCRIÇÃO DO GASTO</span><span>VALOR (R$)</span><span></span>';
        container.appendChild(hdr);
    }
    const div = document.createElement('div');
    div.className = 'serverRow extra-row';
    div.style.gridTemplateColumns = '1fr 160px 36px';
    div.innerHTML = `
        <input class="ext_name" type="text" placeholder="Ex: Alimentação, Transporte..." value="${data ? data.name.replace(/"/g,'&quot;') : ''}">
        <input class="ext_value" type="number" placeholder="0.00" min="0" step="0.01" value="${data ? data.value : ''}" oninput="calcExtrasTotal()">
        <button class="btn-secondary btn-remove" onclick="this.parentNode.remove();calcExtrasTotal()">&#10006;</button>
    `;
    container.appendChild(div);
    calcExtrasTotal();
}

function renderExtras(arr) {
    _cachedExtras = arr || [];
    const container = document.getElementById('extraContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!arr || !arr.length) { calcExtrasTotal(); return; }
    arr.forEach(item => addExtraRow(item));
    calcExtrasTotal();
}

function calcExtrasTotal() {
    const rows = document.querySelectorAll('#extraContainer .extra-row');
    const total = Array.from(rows).reduce((acc, r) => {
        return acc + (Number(r.querySelector('.ext_value')?.value) || 0);
    }, 0);
    const el = document.getElementById('extraTotal');
    if (el) el.textContent = fmt(total);
}


async function loadExtras() {
    // Renderiza extras já carregados (vindo do applyLogoFromServer)
    calcExtrasTotal();
}

async function saveExtras() {
    const rows = document.querySelectorAll('#extraContainer .extra-row');
    const extras = Array.from(rows).map(r => ({
        name:  r.querySelector('.ext_name')?.value.trim()  || '',
        value: Number(r.querySelector('.ext_value')?.value) || 0
    })).filter(e => e.name || e.value > 0);
    try {
        const res = await fetch('/auth/preferences', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extraExpensesJSON: JSON.stringify(extras) })
        });
        if (res.ok) showToast('Gastos extras salvos!', '#00cc66');
        else showToast('Erro ao salvar', '#ff4444');
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

async function loadMensalistas() {
    const table = document.getElementById('mensalistaList');
    if (!table) return;
    try {
        const res = await fetch('/resellers', { credentials: 'include' });
        let data = await res.json();
        data = data.filter(r => r.type === 'MEN' || r.type === 'MENF');
        table.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        let totalRevenue = 0;

        if (!data.length) {
            table.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#555">Nenhum mensalista cadastrado</td></tr>';
        } else {
            data.forEach(r => {
                let receita = 0, totalAtivos = 0, displayInfo = '', settleDisplay = '-', rowClass = '';
                if (r.type === 'MENF') {
                    receita = Number(r.fixedFee) || 0;
                    displayInfo = `<em style="color:var(--accent)">${fmt(receita)}/m\u00eas</em>`;
                    totalAtivos = '&mdash;';
                    if (r.settleDate) {
                        const d = new Date(r.settleDate + 'T00:00:00');
                        const diff = Math.ceil((d - today) / 86400000);
                        if (diff >= 0 && diff <= 7) rowClass = 'row-warning';
                        if (diff < 0) rowClass = 'row-danger';
                        settleDisplay = d.toLocaleDateString('pt-BR');
                    }
                } else {
                    const servers = r.servers || [];
                    totalAtivos = servers.reduce((acc, s) => acc + (s.activeCount || 0), 0);
                    receita     = servers.reduce((acc, s) => acc + (s.pricePerActive * s.activeCount), 0);
                    const serverNames = servers.map(s => s.server).join(', ') || '-';
                    displayInfo = serverNames.length > 28 ? serverNames.slice(0, 26) + '..' : serverNames;
                    const settleParts = servers.map(s => {
                        if (!s.settleDate) return null;
                        const d = new Date(s.settleDate + 'T00:00:00');
                        const diff = Math.ceil((d - today) / 86400000);
                        if (diff >= 0 && diff <= 7 && rowClass !== 'row-danger') rowClass = 'row-warning';
                        if (diff < 0) rowClass = 'row-danger';
                        return `${s.server}: ${d.toLocaleDateString('pt-BR')}`;
                    }).filter(Boolean);
                    settleDisplay = settleParts.length ? settleParts.join('<br>') : '-';
                }
                totalRevenue += receita;
                const pago    = r.paymentStatus === 'PAGO';
                const isAtivo = r.status !== 'INATIVO';
                const safeName = r.name.replace(/'/g, '');
                const waTelR   = r.whatsapp ? r.whatsapp.replace(/\D/g, '') : '';
                const waLinkR  = waTelR ? `<a href="https://wa.me/55${waTelR}" target="_blank" style="color:var(--accent)">${r.whatsapp}</a>` : '-';
                const typeLabel = r.type === 'MENF'
                    ? '<span class="badge" style="background:#1a6b9a;color:#fff;font-size:10px">FIXO</span>'
                    : '<span class="badge" style="background:#2d6a4f;color:#fff;font-size:10px">POR ATIVO</span>';
                table.innerHTML += `
                <tr class="${rowClass}${isAtivo ? '' : ' row-inativo'}">
                    <td>${r.name}</td>
                    <td>${typeLabel}</td>
                    <td>${waLinkR}</td>
                    <td>${displayInfo}</td>
                    <td style="text-align:center">${totalAtivos}</td>
                    <td>${fmt(receita)}</td>
                    <td style="font-size:12px;line-height:1.6">${settleDisplay}</td>
                    <td><button class="badge ${pago ? 'badge-pago' : 'badge-pendente'}" onclick="togglePayment(${r.id}, '${r.paymentStatus}', this)">${r.paymentStatus}</button></td>
                    <td><span class="badge ${isAtivo ? 'badge-pago' : 'badge-pendente'}">${r.status || 'ATIVO'}</span></td>
                    <td class="td-actions">
                        <button class="btn-action ${isAtivo ? 'btn-danger' : 'btn-success'}" onclick="toggleResellerStatus(${r.id}, this)" title="${isAtivo ? 'Desativar' : 'Ativar'}">${isAtivo ? '&#10006;' : '&#10003;'}</button>
                        <button class="btn-action btn-danger" onclick="deleteReseller(${r.id}, '${safeName}')" title="Excluir">&#128465;</button>
                    </td>
                </tr>`;
            });
        }

    } catch (e) { console.error('Erro ao carregar mensalistas', e); }
}

/* ===== MÉTRICAS ===== */
let financeChartInstance = null;

async function loadMetrics() {
    try {
        const res = await fetch('/report', { credentials: 'include' });
        const data = await res.json();
        const el = id => document.getElementById(id);
        if (el('m_clients'))   el('m_clients').textContent   = data.totalClients   || 0;
        if (el('m_resellers')) el('m_resellers').textContent = data.totalResellers  || 0;
        if (el('m_margin'))    el('m_margin').textContent    = (data.margin || 0) + '%';
        if (el('m_projected')) el('m_projected').textContent = fmt(data.projectedMonthly);

        // Custo por servidor (aba PAINEL)
        const costEl = document.getElementById('costList');
        if (costEl) {
            costEl.innerHTML = '';
            if (data.costByServer && Object.keys(data.costByServer).length) {
                Object.entries(data.costByServer).forEach(([server, value]) => {
                    costEl.innerHTML += `<div class="cost-item">${server}<span>${fmt(value)}</span></div>`;
                });
            } else {
                costEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
            }
        }

        // Tabela: Balan�o Mensal por Servidor
        // Ranking de revendas
        const rkEl = document.getElementById('resellerRanking');
        if (rkEl) {
            rkEl.innerHTML = '';
            if (data.resellerRanking && data.resellerRanking.length) {
                data.resellerRanking.forEach((r, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                    const profitColor = r.profit >= 0 ? 'var(--badge-ok-color, #00cc66)' : '#ff4444';
                    rkEl.innerHTML += `<div class="cost-item">${medal} ${r.name} <small style="color:#666">(${r.type})</small><span style="color:${profitColor}">${fmt(r.profit)} &nbsp;<small style="color:#666">/ ${r.ativos} ativos</small></span></div>`;
                });
            } else {
                rkEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhuma revenda cadastrada</span>';
            }
        }
    } catch (e) { console.error('Erro ao carregar métricas', e); }
}


function renderChart(data) {
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;
    if (financeChartInstance) financeChartInstance.destroy();
    financeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Receita', 'Custo', 'Lucro'],
            datasets: [{
                label: 'Financeiro (R$)',
                data: [data.revenue || 0, data.cost || 0, data.profit || 0],
                backgroundColor: ['rgba(0,200,100,0.7)','rgba(220,40,40,0.7)','rgba(100,160,255,0.7)'],
                borderColor: ['#00cc66','#ff2222','#4499ff'],
                borderWidth: 2, borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#fff', font: { family: 'Rajdhani' } } } },
            scales: {
                x: { ticks: { color: '#ff4444', font: { family: 'Rajdhani', size: 11 } }, grid: { color: '#1a0000' } },
                y: { ticks: { color: '#aaa', font: { family: 'Rajdhani', size: 10 } }, grid: { color: '#1a0000' } }
            }
        }
    });
}

/* ===== ALERTAS ===== */
async function loadExpiringSoon() {
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 7);
    try {
        /* Clientes */
        const rc = await fetch('/clients', { credentials: 'include' });
        const clients = await rc.json();
        const elC = document.getElementById('alertClients');
        const nearC = clients.filter(c => {
            if (!c.dueDate) return false;
            const d = new Date(c.dueDate); d.setHours(0,0,0,0);
            return d >= today && d <= limit;
        }).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
        elC.innerHTML = nearC.length ? nearC.map(c => {
            const d = new Date(c.dueDate); d.setHours(0,0,0,0);
            const diff = Math.ceil((d - today) / 86400000);
            return `<div class="alert-item"><span class="alert-name">${c.name}</span><span class="alert-days ${diff<=2?'urgent':''}">&#9200; ${diff===0?'HOJE':diff+'d'}</span></div>`;
        }).join('') : '<span class="empty-alert">Nenhum nos pr\u00f3ximos 7 dias</span>';
        /* Revendas — acerto por servidor */
        const rr = await fetch('/resellers', { credentials: 'include' });
        const resellers = await rr.json();
        const elR = document.getElementById('alertResellers');
        const nearR = [];
        resellers.forEach(r => {
            (r.servers || []).forEach(s => {
                if (!s.settleDate) return;
                const d = new Date(s.settleDate + 'T00:00:00');
                if (d >= today && d <= limit) {
                    nearR.push({ name: r.name, server: s.server, settleDate: s.settleDate, paymentStatus: r.paymentStatus });
                }
            });
        });
        nearR.sort((a, b) => new Date(a.settleDate) - new Date(b.settleDate));
        elR.innerHTML = nearR.length ? nearR.map(r => {
            const d = new Date(r.settleDate + 'T00:00:00');
            const diff = Math.ceil((d - today) / 86400000);
            const pago = r.paymentStatus === 'PAGO';
            return `<div class="alert-item">
                <span class="alert-name">${r.name} <small style="color:#666">(${r.server})</small></span>
                <span class="badge ${pago?'badge-pago':'badge-pendente'} badge-sm">${r.paymentStatus}</span>
                <span class="alert-days ${diff<=2&&!pago?'urgent':''}">&#9200; ${diff===0?'HOJE':diff+'d'}</span>
            </div>`;
        }).join('') : '<span class="empty-alert">Nenhuma nos pr\u00f3ximos 7 dias</span>';
    } catch (e) { console.error('Erro alertas', e); }
}

/* ===== EXPORTAR CSV ===== */
function exportClientesCSV() {
    if (!_clientMap.size) { showFlash('⚠ Nenhum cliente para exportar.'); return; }
    const cols = ['Nome','Usuario','WhatsApp','Servidor','App','Plano (dias)','Valor','Custo','Inicio','Vencimento','Status'];
    const rows = [..._clientMap.values()].map(c => [
        c.name || '',
        c.username || '',
        c.whatsapp || '',
        c.server || '',
        c.app || '',
        c.planType || '',
        (c.planValue || 0).toFixed(2),
        (c.costPerActive || 0).toFixed(2),
        c.startDate ? new Date(c.startDate).toLocaleDateString('pt-BR') : '',
        c.dueDate   ? new Date(c.dueDate).toLocaleDateString('pt-BR')   : '',
        c.status || 'ATIVO'
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
    const csv = '\uFEFF' + [cols.join(';'), ...rows].join('\n'); // BOM para Excel BR
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const today = new Date().toLocaleDateString('pt-BR').replace(/\//g,'-');
    a.href = url; a.download = `clientes_${today}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFlash(`✅ ${_clientMap.size} cliente(s) exportados!`);
}

/* ===== RENOVAÇÃO DO PAINEL ===== */
const PLAN_LABELS_RNV = { '1m': '1 Mês', '3m': '3 Meses', '6m': '6 Meses', '1a': '1 Ano' };

function selectRenewalPlan(el, plan) {
    document.querySelectorAll('[data-rplan]').forEach(c => c.classList.remove('plan-card-selected'));
    el.classList.add('plan-card-selected');
    const inp = document.getElementById('rnv_plan');
    if (inp) inp.value = plan;
}

async function loadMyRenewal() {
    try {
        const isAdminOnly = _isAdmin && !_isMaster;
        const reqForm  = document.getElementById('renewalRequestForm');
        const adminSec = document.getElementById('adminBillingSection');

        // ---- ADMIN (não master): fatura por cliente ativo ----
        if (isAdminOnly) {
            if (reqForm)  reqForm.style.display  = 'none';
            if (adminSec) adminSec.style.display = '';

            // Carrega estimativa de fatura
            const bilRes = await fetch('/renewal/billing', { credentials: 'include' });
            if (bilRes.ok) {
                const b = await bilRes.json();
                const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
                setTxt('bil_activeClients', b.personalCount ?? b.activeClients);
                setTxt('bil_monthly', 'R$ ' + Number(b.monthlyEstimate || 0).toFixed(2).replace('.', ','));
                setTxt('bil_total',   'R$ ' + Number(b.totalEstimate   || 0).toFixed(2).replace('.', ','));
                const adesaoRow   = document.getElementById('bil_adesao_row');
                const adesaoBadge = document.getElementById('bil_adesao_badge');
                if (adesaoRow)   adesaoRow.style.display   = b.adesaoPaga ? 'none' : '';
                if (adesaoBadge) adesaoBadge.style.display = b.adesaoPaga ? '' : 'none';
            }

            // Carrega status e histórico
            const res = await fetch('/renewal/my', { credentials: 'include' });
            if (!res.ok) return;
            const data = await res.json();

            // Status atual
            const statusEl = document.getElementById('renewalCurrentStatus');
            if (statusEl) {
                const exp = data.panelExpiry ? new Date(data.panelExpiry) : null;
                const expFmt = exp ? exp.toLocaleDateString('pt-BR') : 'Sem vencimento';
                const today = new Date();
                const daysLeft = exp ? Math.ceil((exp - today) / 86400000) : null;
                const statusColor = !exp ? '#00cc66' : daysLeft <= 0 ? '#ff4444' : daysLeft <= 7 ? '#ffaa00' : '#00cc66';
                statusEl.innerHTML = `
                    <span>&#128100; <strong>PLANO:</strong> ADMIN POR CLIENTE</span> &nbsp;&nbsp;
                    <span>&#128197; <strong>VENCIMENTO:</strong> <strong style="color:${statusColor}">${expFmt}</strong></span>
                    ${daysLeft !== null ? `&nbsp;&nbsp;<span style="color:${statusColor}">(${daysLeft > 0 ? daysLeft + ' dias restantes' : 'EXPIRADO'})</span>` : ''}
                `;
            }

            // Controla botão de solicitação pendente
            const pending = data.requests.find(r => r.status === 'pending');
            const pendingMsg = document.getElementById('renewalPendingMsg');
            const submitBtn  = adminSec ? adminSec.querySelector('button') : null;
            if (pending) {
                if (pendingMsg) pendingMsg.style.display = '';
                if (submitBtn)  submitBtn.disabled = true;
            } else {
                if (pendingMsg) pendingMsg.style.display = 'none';
                if (submitBtn)  submitBtn.disabled = false;
            }

            // Histórico
            const hist = document.getElementById('renewalHistory');
            if (hist) {
                if (!data.requests.length) {
                    hist.innerHTML = '<span style="color:#555;font-size:12px">Nenhuma solicitação encontrada.</span>';
                } else {
                    const statusColors = { pending: '#ffaa00', approved: '#00cc66', rejected: '#ff4444' };
                    const statusLabels = { pending: '⏳ Aguardando', approved: '✅ Aprovado', rejected: '❌ Rejeitado' };
                    hist.innerHTML = data.requests.map(r => {
                        const dt = new Date(r.createdAt).toLocaleDateString('pt-BR');
                        const color = statusColors[r.status] || '#888';
                        return `<div class="cost-item">
                            <span>Admin/1 Mês &nbsp;<span style="font-size:10px;color:#666">${dt}</span></span>
                            <span style="display:flex;gap:12px;align-items:center">
                                <span style="color:#aaa;font-size:11px">R$ ${r.price || '--'}</span>
                                <span style="color:${color};font-size:11px;font-weight:600">${statusLabels[r.status] || r.status}</span>
                            </span>
                        </div>`;
                    }).join('');
                }
            }
            return; // pula lógica do personal
        }

        // ---- PERSONAL / MASTER: lógica original ----
        // Garante que seções estejam no estado correto
        if (adminSec) adminSec.style.display = 'none';

        // Carrega preços
        const prRes = await fetch('/renewal/prices', { credentials: 'include' });
        if (prRes.ok) {
            const prices = await prRes.json();
            ['1m','3m','6m','1a'].forEach(k => {
                const el = document.getElementById('rnv_price_' + k);
                if (el) el.textContent = 'R$ ' + (prices[k] || '--');
            });
        }
        // Carrega status e histórico
        const res = await fetch('/renewal/my', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();

        // Status atual
        const statusEl = document.getElementById('renewalCurrentStatus');
        if (statusEl) {
            const exp = data.panelExpiry ? new Date(data.panelExpiry) : null;
            const expFmt = exp ? exp.toLocaleDateString('pt-BR') : 'Sem vencimento';
            const today = new Date();
            const daysLeft = exp ? Math.ceil((exp - today) / 86400000) : null;
            const statusColor = !exp ? '#00cc66' : daysLeft <= 0 ? '#ff4444' : daysLeft <= 7 ? '#ffaa00' : '#00cc66';
            statusEl.innerHTML = `
                <span>&#128100; <strong>PLANO:</strong> ${data.panelPlan || 'STANDARD'}</span> &nbsp;&nbsp;
                <span>&#128197; <strong>VENCIMENTO:</strong> <strong style="color:${statusColor}">${expFmt}</strong></span>
                ${daysLeft !== null ? `&nbsp;&nbsp;<span style="color:${statusColor}">(${daysLeft > 0 ? daysLeft + ' dias restantes' : 'EXPIRADO'})</span>` : ''}
            `;
        }

        // Controla se mostra form ou aviso de pendente
        const pending = data.requests.find(r => r.status === 'pending');
        const pendingMsg = document.getElementById('renewalPendingMsg');
        if (pending) {
            if (pendingMsg) pendingMsg.style.display = '';
            if (reqForm)    reqForm.style.display    = 'none';
        } else {
            if (pendingMsg) pendingMsg.style.display = 'none';
            if (reqForm)    reqForm.style.display    = '';
        }

        // Histórico
        const hist = document.getElementById('renewalHistory');
        if (hist) {
            if (!data.requests.length) {
                hist.innerHTML = '<span style="color:#555;font-size:12px">Nenhuma solicitação encontrada.</span>';
            } else {
                const statusColors = { pending: '#ffaa00', approved: '#00cc66', rejected: '#ff4444' };
                const statusLabels = { pending: '⏳ Aguardando', approved: '✅ Aprovado', rejected: '❌ Rejeitado' };
                hist.innerHTML = data.requests.map(r => {
                    const dt = new Date(r.createdAt).toLocaleDateString('pt-BR');
                    const color = statusColors[r.status] || '#888';
                    return `<div class="cost-item">
                        <span>${PLAN_LABELS_RNV[r.plan] || r.plan} &nbsp;<span style="font-size:10px;color:#666">${dt}</span></span>
                        <span style="display:flex;gap:12px;align-items:center">
                            <span style="color:#aaa;font-size:11px">R$ ${r.price || '--'}</span>
                            <span style="color:${color};font-size:11px;font-weight:600">${statusLabels[r.status] || r.status}</span>
                        </span>
                    </div>`;
                }).join('');
            }
        }
    } catch (e) { console.error('Erro ao carregar renovação', e); }
}

async function submitRenewal() {
    const plan    = document.getElementById('rnv_plan')?.value || '6m';
    const message = document.getElementById('rnv_message')?.value.trim() || '';
    try {
        const res = await fetch('/renewal', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, message })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Erro ao solicitar', '#ff4444'); return; }
        showToast(`✅ Solicitação enviada! Plano: ${PLAN_LABELS_RNV[plan]} — R$ ${data.price}`, '#00cc66');
        loadMyRenewal();
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

async function submitAdminRenewal() {
    const message = document.getElementById('rnv_message_admin')?.value.trim() || '';
    try {
        const res = await fetch('/renewal', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan: '1m', message })
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Erro ao solicitar', '#ff4444'); return; }
        showToast(`✅ Solicitação enviada! Total: R$ ${data.price}`, '#00cc66');
        loadMyRenewal();
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

async function loadPlanPrices() {
    try {
        // Carrega preços para PERSONAL (master e admin configuram)
        const rp = await fetch('/renewal/prices/config?type=personal', { credentials: 'include' });
        if (rp.ok) {
            const prices = await rp.json();
            ['1m','3m','6m','1a'].forEach(k => {
                const el = document.getElementById('pp_' + k);
                if (el) el.value = prices[k] || '';
            });
        }
        // Carrega preços para ADMIN (somente master)
        if (_isMaster) {
            const ra = await fetch('/renewal/prices/config?type=admin', { credentials: 'include' });
            if (ra.ok) {
                const prices = await ra.json();
                ['1m','3m','6m','1a'].forEach(k => {
                    const el = document.getElementById('ppa_' + k);
                    if (el) el.value = prices[k] || '';
                });
            }
        }
    } catch (e) {}
}

async function savePlanPrices(type = 'personal') {
    // Validação: plano mensal mínimo R$ 20
    const prefix = type === 'admin' ? 'ppa_' : 'pp_';
    const val1m = Number(document.getElementById(prefix + '1m')?.value);
    if (val1m < 20) {
        showToast('O plano mensal deve ser no mínimo R$ 20,00', '#ff4444');
        return;
    }
    const prices = { type };
    ['1m','3m','6m','1a'].forEach(k => {
        prices[k] = Number(document.getElementById(prefix + k)?.value) || 0;
    });
    try {
        const res = await fetch('/renewal/prices/config', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prices)
        });
        const data = await res.json();
        if (res.ok) showToast('✅ Preços salvos!', '#00cc66');
        else showToast(data.error || 'Erro ao salvar preços', '#ff4444');
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

async function loadRenewalRequests() {
    const tb = document.getElementById('renewalList');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#555">Carregando...</td></tr>';
    try {
        const res = await fetch('/renewal/all', { credentials: 'include' });
        if (!res.ok) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f44">Sem permissão</td></tr>'; return; }
        const rows = await res.json();
        if (!rows.length) {
            tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#555">Nenhuma solicitação pendente 🎉</td></tr>';
            return;
        }
        tb.innerHTML = rows.map(r => {
            const dt = new Date(r.createdAt).toLocaleDateString('pt-BR');
            const curExp = r.currentExpiry ? new Date(r.currentExpiry).toLocaleDateString('pt-BR') : '—';
            const msg = r.message ? `<span title="${r.message.replace(/"/g,'&quot;')}" style="cursor:help;color:#aaa">💬</span>` : '—';
            return `<tr>
                <td><strong>${r.username}</strong></td>
                <td>${PLAN_LABELS_RNV[r.plan] || r.plan}</td>
                <td style="color:var(--accent)">R$ ${r.price || '--'}</td>
                <td>${msg}</td>
                <td style="font-size:11px">${curExp}</td>
                <td style="font-size:11px;color:#666">${dt}</td>
                <td class="td-actions">
                    <button class="btn-action btn-success" onclick="approveRenewal(${r.id},'${r.username.replace(/'/g,'')}','${r.planLabel}')" title="Aprovar">✓ Aprovar</button>
                    <button class="btn-action btn-danger"  onclick="rejectRenewal(${r.id},'${r.username.replace(/'/g,'')}')" title="Rejeitar">✕</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#f44">Erro ao carregar</td></tr>'; }
}

async function approveRenewal(id, username, planLabel) {
    if (!confirm(`Aprovar renovação de "${username}" — ${planLabel}?`)) return;
    try {
        const res  = await fetch(`/renewal/${id}/approve`, { method: 'POST', credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Erro ao aprovar', '#ff4444'); return; }
        const newExpFmt = data.newExpiry ? new Date(data.newExpiry + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        showToast(`✅ ${data.username} renovado por ${data.planLabel}. Novo vencimento: ${newExpFmt}`, '#00cc66');
        loadRenewalRequests();
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

async function rejectRenewal(id, username) {
    if (!confirm(`Rejeitar solicitação de "${username}"?`)) return;
    try {
        const res = await fetch(`/renewal/${id}/reject`, { method: 'POST', credentials: 'include' });
        if (res.ok) { showToast(`Solicitação de ${username} rejeitada.`, '#ffaa00'); loadRenewalRequests(); }
        else showToast('Erro ao rejeitar', '#ff4444');
    } catch (e) { showToast('Erro de conexão', '#ff4444'); }
}

/* ===== INIT ===== */
/* ===== FINANCEIRO COMPLETO ===== */
async function loadFinanceiro() {
    // Popula select de anos na primeira vez
    const yrSel = document.getElementById('fin_year');
    if (yrSel && !yrSel.options.length) {
        const cur = new Date().getFullYear();
        for (let y = cur - 2; y <= cur + 1; y++) {
            const o = document.createElement('option');
            o.value = y; o.textContent = y;
            if (y === cur) o.selected = true;
            yrSel.appendChild(o);
        }
    }
    // Define mês atual como padrão na primeira vez
    const mSel = document.getElementById('fin_month');
    if (mSel && !mSel.dataset.initialized) {
        mSel.value = new Date().getMonth() + 1;
        mSel.dataset.initialized = '1';
    }
    const month = parseInt(document.getElementById('fin_month')?.value || (new Date().getMonth() + 1));
    const year  = parseInt(document.getElementById('fin_year')?.value  || new Date().getFullYear());
    const MNAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const periodoLbl = document.getElementById('fin_period_label');
    if (periodoLbl) periodoLbl.textContent = `Exibindo: ${MNAMES[month-1]}/${year}`;

    // Caixa para este período
    const key = `${year}-${String(month).padStart(2,'0')}`;
    const caixaVal = Number(_cachedSaldoCaixaJSON[key]) || 0;
    const caixaInput = document.getElementById('fin_caixa');
    if (caixaInput && !caixaInput.dataset.dirty) caixaInput.value = caixaVal || '';
    const caixaCard = document.getElementById('fin_caixa_card');
    if (caixaCard) caixaCard.textContent = fmt(caixaVal);

    // Totais locais de gastos
    const monthly = _cachedExpenses.reduce((a,e) => a + (Number(e.value)||0), 0);
    const extras  = _cachedExtras.reduce((a,e)   => a + (Number(e.value)||0), 0);
    const $ = id => document.getElementById(id);
    if ($('fin_monthly')) $('fin_monthly').textContent = fmt(monthly);
    if ($('fin_extras'))  $('fin_extras').textContent  = fmt(extras);

    try {
        const res  = await fetch(`/report?month=${month}&year=${year}`, { credentials: 'include' });
        const data = await res.json();
        const revenue = data.revenue || 0;
        const cost    = data.cost    || 0;
        if ($('f_revenue')) $('f_revenue').textContent = fmt(revenue);
        if ($('f_cost'))    $('f_cost').textContent    = fmt(cost);
        const saldo = caixaVal + revenue - cost - monthly - extras;
        const profEl = $('f_profit');
        if (profEl) { profEl.textContent = fmt(saldo); profEl.style.color = saldo >= 0 ? '#00cc66' : '#ff4444'; }

        // Breakdown completo
        const bd = $('fin_breakdown');
        if (bd) bd.innerHTML = [
            { label: '+ Caixa Inicial',  value: caixaVal, color: '#4499ff' },
            { label: '+ Receita IPTV',   value: revenue,  color: '#00cc66' },
            { label: '− Gastos IPTV',    value: cost,     color: '#ff6644' },
            { label: '− Gastos Mensais', value: monthly,  color: '#ffaa00' },
            { label: '− Gastos Extras',  value: extras,   color: '#ff4444' },
            { label: '= SALDO LÍQUIDO',  value: saldo,    color: saldo >= 0 ? '#00cc66' : '#ff4444' },
        ].map(i => `<div class="cost-item"><span style="color:${i.color}">${i.label}</span><span style="color:${i.color};font-weight:700">${fmt(i.value)}</span></div>`).join('');

        // Breakdown: Gastos Mensais
        const mbd = $('fin_monthly_breakdown');
        if (mbd) mbd.innerHTML = _cachedExpenses.length
            ? _cachedExpenses.map(e => `<div class="cost-item"><span>${e.name||'—'}</span><span style="color:#ffaa00">${fmt(Number(e.value)||0)}</span></div>`).join('')
            : '<span style="color:#555;font-size:12px">Nenhum gasto mensal cadastrado</span>';

        // Breakdown: Gastos Extras
        const ebd = $('fin_extras_breakdown');
        if (ebd) ebd.innerHTML = _cachedExtras.length
            ? _cachedExtras.map(e => `<div class="cost-item"><span>${e.name||'—'}</span><span style="color:#ff6644">${fmt(Number(e.value)||0)}</span></div>`).join('')
            : '<span style="color:#555;font-size:12px">Nenhum gasto extra cadastrado</span>';

        // Custo por servidor
        const costEl = $('costListFin');
        if (costEl) {
            costEl.innerHTML = '';
            if (data.costByServer && Object.keys(data.costByServer).length) {
                Object.entries(data.costByServer).forEach(([s,v]) => {
                    costEl.innerHTML += `<div class="cost-item">${s}<span>${fmt(v)}</span></div>`;
                });
            } else costEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
        }

        // Balanço por servidor
        const srvBalBody = $('serverBalanceBody');
        if (srvBalBody) {
            const details = data.serverDetails || [];
            if (!details.length) {
                srvBalBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#555">Nenhum servidor com dados ainda</td></tr>';
            } else {
                const sorted = [...details].sort((a,b) => b.profit - a.profit);
                srvBalBody.innerHTML = sorted.map(s => {
                    const mg = s.revenue > 0 ? ((s.profit/s.revenue)*100).toFixed(1) : '0.0';
                    const pc = s.profit >= 0 ? '#00cc66' : '#ff4444';
                    const mc = Number(mg) >= 30 ? '#00cc66' : Number(mg) >= 10 ? '#ffaa00' : '#ff4444';
                    return `<tr>
                        <td><strong>${s.name}</strong></td>
                        <td style="text-align:center">${s.ativos}</td>
                        <td style="text-align:right;color:#4499ff">${fmt(s.revenue)}</td>
                        <td style="text-align:right;color:#ff6644">${fmt(s.cost)}</td>
                        <td style="text-align:right;color:${pc}"><strong>${fmt(s.profit)}</strong></td>
                        <td style="text-align:center;color:${mc}">${mg}%</td>
                    </tr>`;
                }).join('');
            }
        }

        // Lucro por servidor
        const profitEl = $('profitByServer');
        if (profitEl) {
            profitEl.innerHTML = '';
            if (data.profitByServer && Object.keys(data.profitByServer).length) {
                Object.entries(data.profitByServer).sort((a,b) => b[1]-a[1]).forEach(([srv,val]) => {
                    const c = val >= 0 ? 'var(--badge-ok-color,#00cc66)' : '#ff4444';
                    profitEl.innerHTML += `<div class="cost-item">${srv}<span style="color:${c}">${fmt(val)}</span></div>`;
                });
            } else profitEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
        }

        // Servidor mais lucrativo
        const mpEl = $('mostProfitable');
        if (mpEl) {
            if (data.mostProfitable) {
                const mp = data.mostProfitable;
                mpEl.innerHTML = `<div class="cost-item" style="font-size:13px"><strong style="color:var(--accent)">${mp.name}</strong><span>Lucro: <strong>${fmt(mp.profit)}</strong> &nbsp;|&nbsp; Ativos: ${mp.ativos}</span></div>`;
            } else mpEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
        }

        // Atualiza margem/projeção no PAINEL também
        if ($('m_margin'))    $('m_margin').textContent    = (data.margin||0) + '%';
        if ($('m_projected')) $('m_projected').textContent = fmt(data.projectedMonthly);

        renderChart(data);
    } catch (e) { console.error('loadFinanceiro error', e); }
}

async function saveCaixa() {
    if (document.getElementById('fin_caixa')) document.getElementById('fin_caixa').dataset.dirty = '';
    const val   = Number(document.getElementById('fin_caixa')?.value) || 0;
    const month = parseInt(document.getElementById('fin_month')?.value  || (new Date().getMonth() + 1));
    const year  = parseInt(document.getElementById('fin_year')?.value   || new Date().getFullYear());
    const key   = `${year}-${String(month).padStart(2,'0')}`;
    _cachedSaldoCaixaJSON[key] = val;
    try {
        await fetch('/auth/preferences', {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saldoCaixaJSON: JSON.stringify(_cachedSaldoCaixaJSON) })
        });
        showToast('Caixa inicial salvo!', '#00cc66');
        if (document.getElementById('fin_caixa')) delete document.getElementById('fin_caixa').dataset.dirty;
        loadFinanceiro();
    } catch (e) { showToast('Erro ao salvar caixa', '#ff4444'); }
}

function previewSaldo() {
    const caixaInput = document.getElementById('fin_caixa');
    if (caixaInput) caixaInput.dataset.dirty = '1';
    const val     = Number(caixaInput?.value) || 0;
    const parseCard = id => {
        const el = document.getElementById(id);
        if (!el) return 0;
        return parseFloat(el.textContent.replace(/R\$\s*/,'').replace(/\./g,'').replace(',','.').trim()) || 0;
    };
    const revenue = parseCard('f_revenue');
    const cost    = parseCard('f_cost');
    const monthly = _cachedExpenses.reduce((a,e) => a + (Number(e.value)||0), 0);
    const extras  = _cachedExtras.reduce((a,e)   => a + (Number(e.value)||0), 0);
    const saldo   = val + revenue - cost - monthly - extras;
    const profEl  = document.getElementById('f_profit');
    if (profEl) { profEl.textContent = fmt(saldo); profEl.style.color = saldo >= 0 ? '#00cc66' : '#ff4444'; }
    const caixaCard = document.getElementById('fin_caixa_card');
    if (caixaCard) caixaCard.textContent = fmt(val);
}

window.onload = async () => {
    loadTheme();
    loadProfile();
    await loadUserInfo();
    await loadServers();
    loadClients();
    loadExpiringSoon();
    loadLicenseStatus();
    // Financeiro disponível para todos — dados filtrados por ownerId no backend
    loadMetrics();
    addServer();
    loadResellers();
    loadMensalistas();
    onMensalistaTypeChange();
    loadMyRenewal(); // carrega status de renovação na aba perfil
};


