/* ============================================================
   GESTOR ORION — DASHBOARD CONTROLLER
   ============================================================ */

const fmt = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

/* ===== TEMA ===== */
const THEMES = ['red', 'blue', 'yellow', 'purple', 'green'];

function setTheme(theme) {
    THEMES.forEach(t => document.body.classList.remove('theme-' + t));
    if (theme !== 'red') document.body.classList.add('theme-' + theme);
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.theme === theme || b.classList.contains('t-' + theme)) {
            b.classList.add('active');
        }
    });
    localStorage.setItem('nexus_theme', theme);
}

function loadTheme() {
    setTheme(localStorage.getItem('nexus_theme') || 'blue');
}

/* ===== PERFIL ===== */
const DEFAULT_LOGO = '/dashboard/assets/logo.png';

function loadProfile() {
    const logo = localStorage.getItem('nexus_logo') || DEFAULT_LOGO;
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
    reader.onload = e => {
        const data = e.target.result;
        localStorage.setItem('nexus_logo', data);
        loadProfile();
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    localStorage.removeItem('nexus_logo');
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
        padding: '10px 18px', fontFamily: 'Orbitron,sans-serif',
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
    if (name === 'financeiro') loadMetrics();
    if (name === 'admin') { loadResellerSelect(); loadUsers(); loadLicenseInfo(); updatePlanPreview('6m'); }
    if (name === 'servidores') loadServers();
}

/* ===== LICENÇA ===== */
async function loadLicenseStatus() {
    try {
        const r = await fetch('/owner/license-status');
        const d = await r.json();
        const banner = document.getElementById('licenseBanner');
        if (!banner) return;
        if (!d.valid) {
            banner.innerHTML = `<span style="background:#ff2222;color:#fff;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px">⚠ LICENÇA EXPIRADA</span>`;
            banner.style.display = 'block';
        } else if (d.warning) {
            banner.innerHTML = `<span style="background:#ffaa00;color:#000;padding:3px 10px;font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:1px">⚠ LICENÇA VENCE EM ${d.daysLeft}d</span>`;
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
        _isReseller = user.role === 'reseller';
        document.getElementById('topUsername').textContent = user.username;
        const roleLabel = _isMaster ? 'MASTER' : (_isAdmin ? 'ADMINISTRADOR' : 'REVENDEDOR');
        document.getElementById('topRole').textContent = roleLabel;
        if (_isMaster) document.getElementById('topRole').style.color = 'var(--accent2)';
        // Preencher campo de usuário na aba Perfil
        const uInp = document.getElementById('usernameInput');
        if (uInp) uInp.placeholder = user.username;
        if (_isAdmin) {
            const tab = document.getElementById('tabAdmin');
            if (tab) tab.style.display = '';
        }
        // Revendedor: acessa Financeiro mas com dados filtrados só pelos seus
        if (_isReseller) {
            // Esconder seções do painel principal que são admin-only (ranking geral e lista de custos)
            ['resellerRanking','costList'].forEach(id => {
                const el = document.getElementById(id)?.closest('section.panel');
                if (el) el.style.display = 'none';
            });
            // Esconder cards de métricas globais do painel (não do financeiro)
            ['m_resellers','m_revenue','m_cost','m_profit','m_margin','m_projected'].forEach(id => {
                const el = document.getElementById(id)?.closest('.card');
                if (el) el.style.display = 'none';
            });
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
        if (wrap) wrap.style.display = roleEl.value === 'reseller' ? '' : 'none';
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
    const role       = document.getElementById('nu_role')?.value || 'reseller';
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
        showFlash('\u2705 Acesso criado! Usu\u00e1rio: ' + username + (role === 'reseller' ? ' | Expira: ' + expMsg : ''));
        document.getElementById('nu_username').value = '';
        document.getElementById('nu_password').value = '';
        document.getElementById('nu_role').value = 'reseller';
        onNuRoleChange();
        loadUsers();
    } catch (e) { alert('\u274c Erro ao criar acesso.'); }
}

// Mostra/oculta cards de plano conforme o perfil selecionado
function onNuRoleChange() {
    const role = document.getElementById('nu_role')?.value || 'reseller';
    const planWrap = document.getElementById('nu_plan_wrap');
    if (planWrap) planWrap.style.display = (role === 'reseller') ? '' : 'none';
    if (role === 'reseller') {
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
            const expBadge  = u.role === 'reseller'
                ? (isExpired
                    ? '<span class="badge badge-pendente" style="font-size:9px">⚠ EXPIRADO</span>'
                    : '<span class="badge badge-pago" style="font-size:9px">✓ ATIVO</span>')
                : '—';
            const planLabel = u.role === 'reseller' ? (u.panelPlan || 'STANDARD') : '—';
            return `<tr>
                <td>${u.username}${u.firstLogin ? ' <span style="font-size:10px;color:#ff9800">●PRIMEIRO ACESSO</span>' : ''}</td>
                <td><span class="badge ${u.role === 'reseller' ? 'badge-pendente' : 'badge-pago'}">${u.role.toUpperCase()}</span></td>
                <td>${u.resellerId || '—'}</td>
                <td>${planLabel}</td>
                <td>${expDate} ${expBadge}</td>
                <td><button class="btn-sm" style="font-size:10px" onclick="generateUserResetToken(${u.id}, '${u.username.replace(/'/g,'')}')">&#128273; Reset Senha</button></td>
            </tr>`;
        }).join('');
    } catch (e) {}
}

/* ===== ONBOARDING ===== */
function closeOnboarding() {
    document.getElementById('modalOnboarding').style.display = 'none';
    fetch('/auth/first-login-done', { method: 'POST', credentials: 'include' }).catch(() => {});
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
    `;
    document.getElementById('modalClient').style.display = 'flex';
}

function closeClientModal() {
    document.getElementById('modalClient').style.display = 'none';
}

/* ===== REVENDAS — FORMULÁRIO DINÂMICO ===== */
function isMensalista() {
    return document.getElementById('r_type').value === 'MEN';
}

function onTypeChange() {
    const container = document.getElementById('serverContainer');
    const qtd = container.querySelectorAll('.serverRow').length;
    container.innerHTML = '';
    for (let i = 0; i < (qtd || 1); i++) addServer();
}

function calcPricePerActive(row) {
    const mens   = Number(row.querySelector('.srv_mens')?.value) || 0;
    const ativos = Number(row.querySelector('.srv_active').value) || 0;
    const priceInput = row.querySelector('.srv_price');
    if (mens > 0 && ativos > 0) {
        priceInput.value = (mens / ativos).toFixed(2);
        priceInput.readOnly = true;
        priceInput.style.opacity = '0.5';
    } else {
        priceInput.readOnly = false;
        priceInput.style.opacity = '1';
    }
}

function buildServerOptions(selected) {
    if (!_serverCache.length) return '<option>Sem servidores</option>';
    return _serverCache.map(s =>
        `<option${selected && s.name === selected ? ' selected' : ''}>${s.name}</option>`
    ).join('');
}

function addServer() {
    const container = document.getElementById('serverContainer');
    const men = isMensalista();
    if (container.querySelectorAll('.serverRow').length === 0) {
        container.innerHTML = `
        <div class="server-header${men ? ' men' : ''}">
            <span>SERVIDOR</span>
            <span>QTD ATIVOS</span>
            ${men ? '<span>MENSALIDADE (R$)</span>' : ''}
            <span>VALOR / ATIVO (R$)</span>
            <span>SEU CUSTO / ATIVO (R$)</span>
            <span>DATA DE ACERTO</span>
            <span></span>
        </div>`;
    }
    const div = document.createElement('div');
    div.className = 'serverRow' + (men ? ' men' : '');
    div.innerHTML = `
        <select class="srv_name">${buildServerOptions()}</select>
        <input class="srv_active" type="number" placeholder="Ex: 50" min="0"
            oninput="calcPricePerActive(this.closest('.serverRow'))">
        ${men ? `<input class="srv_mens" type="number" placeholder="Ex: 120.00" min="0" step="0.01"
            oninput="calcPricePerActive(this.closest('.serverRow'))">` : ''}
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
    if (!confirm('Excluir a revenda "' + name + '"?\nEssa a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;
    try {
        const res = await fetch('/resellers/' + id, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error();
        loadResellers();
        loadMetrics();
        loadExpiringSoon();
        loadResellerSelect();
    } catch (e) { alert('\u274c Erro ao excluir revenda.'); }
}

/* ===== MÉTRICAS ===== */
let financeChartInstance = null;

async function loadMetrics() {
    try {
        const res = await fetch('/report', { credentials: 'include' });
        const data = await res.json();
        ['m_clients','f_clients'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = data.totalClients || 0; });
        ['m_resellers','f_resellers'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = data.totalResellers || 0; });
        ['m_revenue','f_revenue'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = fmt(data.revenue); });
        ['m_cost','f_cost'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = fmt(data.cost); });
        ['m_profit','f_profit'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = fmt(data.profit); });

        // Novas métricas
        const mMargin    = document.getElementById('m_margin');
        const mProjected = document.getElementById('m_projected');
        if (mMargin)    mMargin.textContent    = (data.margin || 0) + '%';
        if (mProjected) mProjected.textContent = fmt(data.projectedMonthly);

        // Custo por servidor
        const renderCostList = (elId) => {
            const costEl = document.getElementById(elId);
            if (!costEl) return;
            costEl.innerHTML = '';
            if (data.costByServer && Object.keys(data.costByServer).length) {
                Object.entries(data.costByServer).forEach(([server, value]) => {
                    costEl.innerHTML += `<div class="cost-item">${server}<span>${fmt(value)}</span></div>`;
                });
            } else {
                costEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
            }
        };
        renderCostList('costList');
        renderCostList('costListFin');

        // Lucro por servidor
        const profitEl = document.getElementById('profitByServer');
        if (profitEl) {
            profitEl.innerHTML = '';
            if (data.profitByServer && Object.keys(data.profitByServer).length) {
                Object.entries(data.profitByServer)
                    .sort((a,b) => b[1]-a[1])
                    .forEach(([server, value]) => {
                        const color = value >= 0 ? 'var(--badge-ok-color, #00cc66)' : '#ff4444';
                        profitEl.innerHTML += `<div class="cost-item">${server}<span style="color:${color}">${fmt(value)}</span></div>`;
                    });
            } else {
                profitEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
            }
        }

        // Servidor mais lucrativo
        const mpEl = document.getElementById('mostProfitable');
        if (mpEl) {
            if (data.mostProfitable) {
                const mp = data.mostProfitable;
                mpEl.innerHTML = `<div class="cost-item" style="font-size:13px"><strong style="color:var(--accent)">${mp.name}</strong><span>Lucro: <strong>${fmt(mp.profit)}</strong> &nbsp;|&nbsp; Ativos: ${mp.ativos}</span></div>`;
            } else {
                mpEl.innerHTML = '<span style="color:#444;font-size:12px">Nenhum dado ainda</span>';
            }
        }

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

        renderChart(data);
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
            plugins: { legend: { labels: { color: '#fff', font: { family: 'Orbitron' } } } },
            scales: {
                x: { ticks: { color: '#ff4444', font: { family: 'Orbitron', size: 11 } }, grid: { color: '#1a0000' } },
                y: { ticks: { color: '#aaa', font: { family: 'Orbitron', size: 10 } }, grid: { color: '#1a0000' } }
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

/* ===== INIT ===== */
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
};
