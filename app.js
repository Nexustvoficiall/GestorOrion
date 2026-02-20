const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const { sequelize, User, Tenant } = require('./models');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('./middlewares/authMiddleware');
const enforceTenant = require('./middlewares/enforceTenant');
const { checkLicensePage } = require('./middlewares/licenseMiddleware');

const app = express();

/* Railway / nginx proxy — necessário para cookies secure e req.ip correto */
app.set('trust proxy', 1);

/* MIDDLEWARES */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ===== SESSION STORE =====
   No Railway (produção) usa PostgreSQL para persistir sessões mesmo após redeploy.
   Em dev local usa memória (padrão). */
let sessionStore;
if (process.env.DATABASE_URL) {
    const pgSession = require('connect-pg-simple')(session);
    const { Pool } = require('pg');
    const pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 5, idleTimeoutMillis: 30000
    });
    sessionStore = new pgSession({
        pool: pgPool,
        tableName: 'session',
        createTableIfMissing: true
    });
    console.log('🗄️  Sessions: PostgreSQL (persistente)');
} else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('\n⚠️  AVISO CRÍTICO: DATABASE_URL não definida em produção!\n' +
            '   Os dados serão perdidos a cada restart.\n' +
            '   Configure DATABASE_URL no Railway com um banco PostgreSQL.\n');
    }
    console.log('🗄️  Sessions: memória (apenas dev local)');
}

app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'orion-saas-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 horas
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

/* Uploads isolados por tenant */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* LOGIN PAGE — pública */
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'login.html'));
});
app.use('/login-assets', express.static(path.join(__dirname, 'dashboard')));

/* PÁGINA LICENÇA EXPIRADA */
app.get('/license-expired', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Licença Expirada — Gestor Orion</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a0a;color:#fff;font-family:'Segoe UI',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;padding:50px;border:1px solid #ff2222;max-width:500px;background:#110000}
    .icon{font-size:64px;margin-bottom:20px}
    h1{color:#ff4444;font-size:22px;letter-spacing:2px;margin-bottom:12px}
    p{color:#aaa;font-size:14px;line-height:1.8;margin-bottom:8px}
    .key{color:#ff6666;font-weight:bold;font-size:13px}
    a{color:#ff4444;text-decoration:none;font-size:12px;display:block;margin-top:24px;letter-spacing:1px}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">⚠️</div>
    <h1>LICENÇA EXPIRADA</h1>
    <p>Sua licença do <strong>Gestor Orion</strong> expirou.</p>
    <p>Para renovar, entre em contato com o suporte.</p>
    <a href="/login">← Voltar ao Login</a>
  </div>
</body>
</html>`);
});

/* PROTEGER DASHBOARD */
app.use('/dashboard', (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
}, checkLicensePage, (req, res, next) => {
    // Nunca cachear o HTML principal — garante que atualizações chegam imediatamente
    if (req.path === '/' || req.path === '/index.html' || req.path === '') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
}, express.static(path.join(__dirname, 'dashboard')));

/* ROTA RAIZ */
app.get('/', (req, res) => res.redirect('/login'));

/* ===== RESET DE EMERGÊNCIA (localhost ou token secreto) ===== */
app.get('/reset-admin', async (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const resetToken = process.env.RESET_TOKEN;
    const tokenOk = resetToken && req.query.token === resetToken;
    if (!isLocal && !tokenOk) return res.status(403).send('Acesso negado. Use ?token=SEU_RESET_TOKEN');
    try {
        const DEFAULT_USER = 'master';
        const DEFAULT_PASS = process.env.MASTER_PASS || 'MasterOrion2026$';
        let user = await User.findOne({ where: { role: 'master' } });
        const hash = await bcrypt.hash(DEFAULT_PASS, 10);
        if (user) {
            await user.update({ username: DEFAULT_USER, password: hash });
        } else {
            await User.create({ username: DEFAULT_USER, password: hash, role: 'master', tenantId: null });
        }

        // Recriar tenant padrão + admin se não existir
        let adminInfo = '';
        const tenantCount = await Tenant.count();
        if (tenantCount === 0) {
            const adminUser = process.env.ADMIN_USER || 'admin';
            const adminPass = process.env.ADMIN_PASS || 'GestorOrion2026$';
            const tenant = await Tenant.create({
                name: 'Gestor Orion', slug: 'gestor-orion', brandName: 'Gestor Orion',
                primaryColor: '#1a6fff', plan: 'PRO', isActive: true, licenseExpiration: null
            });
            const aHash = await bcrypt.hash(adminPass, 10);
            await User.create({ username: adminUser, password: aHash, role: 'admin', tenantId: tenant.id });
            adminInfo = `<br>Admin: <b>${adminUser}</b> / <b>${adminPass}</b>`;
        } else {
            // Resetar senha do primeiro admin existente
            const adminUser2 = await User.findOne({ where: { role: 'admin' } });
            if (adminUser2) {
                const adminPass2 = process.env.ADMIN_PASS || 'GestorOrion2026$';
                const aHash2 = await bcrypt.hash(adminPass2, 10);
                await adminUser2.update({ password: aHash2 });
                adminInfo = `<br>Admin: <b>${adminUser2.username}</b> / <b>${adminPass2}</b>`;
            }
        }

        res.send(`<h2 style="font-family:monospace;background:#000;color:#0f0;padding:30px">
            ✅ Reset OK!<br><br>
            Master: <b>${DEFAULT_USER}</b> / <b>${DEFAULT_PASS}</b>${adminInfo}
            <br><br><a href="/login" style="color:#4af">→ Ir para Login</a>
        </h2>`);
    } catch (e) {
        res.status(500).send('Erro: ' + e.message);
    }
});

/* ===== ROTAS DA API ===== */
app.use('/auth',    require('./routes/authRoutes'));
app.use('/owner',   require('./routes/ownerRoutes'));   // auth por rota (license-status é pública)
app.use('/tenant',  require('./routes/tenantRoutes'));
app.use('/master',  require('./routes/masterRoutes'));

/* Rotas que requerem tenant isolado */
app.use('/audit',           requireAuth, require('./routes/auditRoutes'));
app.use('/clients',         requireAuth, enforceTenant, require('./routes/clientRoutes'));
app.use('/resellers',       requireAuth, enforceTenant, require('./routes/resellerRoutes'));
app.use('/report',          requireAuth, enforceTenant, require('./routes/reportRoutes'));
app.use('/servers',         requireAuth, enforceTenant, require('./routes/serverRoutes'));
app.use('/resellerservers', requireAuth, enforceTenant, require('./routes/resellerServerRoutes'));
app.use('/renewal',         requireAuth, require('./routes/renewalRoutes'));

/* PÁGINA REDEFINIR SENHA (pública, token via query) */
app.get('/reset-password', (req, res) => {
    const token = req.query.token || '';
    res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Redefinir Senha — Gestor Orion</title>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a12;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{background:#12121e;border:1px solid #333;border-radius:12px;padding:40px;width:100%;max-width:380px}
    h2{font-family:'Orbitron',sans-serif;font-size:16px;color:#1a6fff;margin-bottom:24px;letter-spacing:2px;text-align:center}
    label{font-size:11px;color:#aaa;letter-spacing:1px;display:block;margin-bottom:6px}
    input{width:100%;background:#1e1e30;border:1px solid #333;color:#fff;padding:10px 12px;border-radius:6px;font-size:14px;margin-bottom:16px}
    button{width:100%;background:#1a6fff;color:#fff;border:none;padding:12px;border-radius:6px;font-size:14px;cursor:pointer;font-family:'Orbitron',sans-serif;letter-spacing:1px}
    button:hover{background:#0055dd}
    .msg{padding:10px;border-radius:6px;font-size:13px;text-align:center;margin-bottom:14px;display:none}
    .msg.ok{background:#003300;color:#0f0;border:1px solid #006600}
    .msg.err{background:#330000;color:#f44;border:1px solid #660000}
    a{color:#1a6fff;font-size:12px;display:block;text-align:center;margin-top:16px}
  </style>
</head>
<body>
  <div class="box">
    <h2>🔑 REDEFINIR SENHA</h2>
    <div id="msg" class="msg"></div>
    <label>NOVA SENHA</label>
    <input type="password" id="np" placeholder="Nova senha (mínimo 4 caracteres)">
    <label>CONFIRMAR SENHA</label>
    <input type="password" id="cp" placeholder="Repita a nova senha">
    <button onclick="doReset()">SALVAR NOVA SENHA</button>
    <a href="/login">← Voltar ao Login</a>
  </div>
  <script>
    const TOKEN = '${token}';
    async function doReset() {
      const np = document.getElementById('np').value;
      const cp = document.getElementById('cp').value;
      const msg = document.getElementById('msg');
      if (!np || !cp) { showMsg('Preencha os dois campos.', false); return; }
      if (np !== cp)  { showMsg('As senhas não coincidem.', false); return; }
      if (np.length < 4) { showMsg('Senha muito curta.', false); return; }
      const res = await fetch('/auth/reset-by-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, newPassword: np })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('✅ Senha alterada! Redirecionando...', true);
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        showMsg('❌ ' + (data.error || 'Erro ao redefinir.'), false);
      }
    }
    function showMsg(text, ok) {
      const el = document.getElementById('msg');
      el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err');
      el.style.display = 'block';
    }
  </script>
</body>
</html>`);
});

/* TERMOS DE USO */
app.get('/termos', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Termos de Uso — Gestor Orion</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a12;color:#ccc;font-family:'Segoe UI',sans-serif;padding:40px 20px;max-width:700px;margin:0 auto;line-height:1.8}
    h1{color:#1a6fff;font-size:22px;margin-bottom:8px}
    h2{color:#fff;font-size:15px;margin:24px 0 8px}
    p{font-size:13px;margin-bottom:10px}
    a{color:#1a6fff;font-size:13px;display:block;margin-top:32px}
    .updated{color:#555;font-size:11px;margin-bottom:28px}
  </style>
</head>
<body>
  <h1>TERMOS DE USO — GESTOR ORION</h1>
  <p class="updated">Atualizado em: fevereiro de 2026</p>
  <h2>1. Aceitação</h2>
  <p>Ao acessar e utilizar o Gestor Orion, você concorda com estes Termos de Uso. Se não concordar, não utilize o sistema.</p>
  <h2>2. Uso Permitido</h2>
  <p>O sistema destina-se exclusivamente ao gerenciamento de revendas e clientes de streaming licenciado pelo próprio usuário. O uso para atividades ilegais é estritamente proibido.</p>
  <h2>3. Responsabilidade do Usuário</h2>
  <p>O usuário é inteiramente responsável pelo conteúdo gerenciado, credenciais de acesso e pelas ações realizadas dentro do painel. O desenvolvedor não se responsabiliza por qualquer mau uso.</p>
  <h2>4. Dados e Privacidade</h2>
  <p>Os dados cadastrados ficam armazenados em banco de dados seguro. Não compartilhamos informações com terceiros.</p>
  <h2>5. Disponibilidade</h2>
  <p>O serviço é fornecido "como está", sem garantia de disponibilidade ininterrupta. Manutenções podem ocorrer com ou sem aviso prévio.</p>
  <h2>6. Alterações</h2>
  <p>Estes termos podem ser alterados a qualquer momento. O uso continuado do sistema após alterações implica na aceitação dos novos termos.</p>
  <h2>7. Contato</h2>
  <p>Para dúvidas ou suporte, entre em contato com o administrador do sistema.</p>
  <a href="/login">← Voltar ao Login</a>
</body>
</html>`);
});

/* ===== BOOT DO MASTER ADMIN + TENANT PADRÃO ===== */
async function ensureMasterAdmin() {
    const fs = require('fs');

    // 1. Garante usuário master
    let master = await User.findOne({ where: { role: 'master' } });
    if (!master) {
        const pass = process.env.MASTER_PASS || 'MasterOrion2026$';
        const hash = await bcrypt.hash(pass, 10);
        master = await User.create({ username: 'master', password: hash, role: 'master', tenantId: null });
        console.log('✅ Master admin criado  →  usuário: master  |  senha:', pass);
    }

    // 2. Se não existe nenhum tenant, cria o tenant padrão + admin
    const tenantCount = await Tenant.count();
    if (tenantCount === 0) {
        const adminUser  = process.env.ADMIN_USER  || 'admin';
        const adminPass  = process.env.ADMIN_PASS  || 'GestorOrion2026$';
        const tenantName = process.env.TENANT_NAME || 'Gestor Orion';

        const tenant = await Tenant.create({
            name:             tenantName,
            slug:             tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            brandName:        tenantName,
            primaryColor:     '#1a6fff',
            plan:             'PRO',
            isActive:         true,
            licenseExpiration: null
        });

        const hash = await bcrypt.hash(adminPass, 10);
        await User.create({
            username: adminUser,
            password: hash,
            role:     'admin',
            tenantId: tenant.id
        });

        const creds = [
            '====================================',
            '  GESTOR ORION — CREDENCIAIS BOOT',
            '====================================',
            `  Master  : master / ${process.env.MASTER_PASS || 'MasterOrion2026$'}`,
            `  Admin   : ${adminUser} / ${adminPass}`,
            `  Tenant  : ${tenantName} (${tenant.id})`,
            `  Criado  : ${new Date().toLocaleString('pt-BR')}`,
            '====================================',
        ].join('\n');

        console.log('\n' + creds + '\n');

        try {
            fs.writeFileSync(require('path').join(__dirname, 'ACESSO_ADMIN.txt'), creds, 'utf8');
        } catch (_) { /* Railway filesystem é efêmero, só loga */ }
    }
}

/* START SERVER */
/* Apenas cria tabelas que não existem — nunca modifica estrutura existente.
   alter:true pode recriar tabelas com FK constraints causando perda de dados. */
sequelize.sync().then(async () => {
    console.log('✅ Banco conectado e sincronizado');

    /* Migração segura: adiciona colunas novas sem recriar tabelas */
    if (process.env.DATABASE_URL) {
        try {
            await sequelize.query(`ALTER TABLE IF EXISTS "Clients" ADD COLUMN IF NOT EXISTS "resellerId" INTEGER;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Resellers" ADD COLUMN IF NOT EXISTS "ownerId" INTEGER;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Clients" ADD COLUMN IF NOT EXISTS "userId" INTEGER;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "createdBy" INTEGER;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "themeColor" VARCHAR(255) DEFAULT 'red';`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "logoBase64" TEXT;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Resellers" ADD COLUMN IF NOT EXISTS "fixedFee" FLOAT;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "monthlyExpenses" FLOAT DEFAULT 0;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "expensesJSON" TEXT;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "extraExpensesJSON" TEXT;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "planPricesJSON" TEXT;`);
            await sequelize.query(`ALTER TABLE IF EXISTS "Users" ADD COLUMN IF NOT EXISTS "saldoCaixaJSON" TEXT;`);
        } catch (_) { /* coluna já existe — ignorar */ }
    } else {
        // SQLite: sintaxe sem IF NOT EXISTS
        try { await sequelize.query(`ALTER TABLE "Clients" ADD COLUMN "userId" INTEGER`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "createdBy" INTEGER`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "themeColor" VARCHAR(255) DEFAULT 'red'`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "logoBase64" TEXT`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Resellers" ADD COLUMN "fixedFee" FLOAT`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "monthlyExpenses" FLOAT DEFAULT 0`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "expensesJSON" TEXT`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "extraExpensesJSON" TEXT`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "planPricesJSON" TEXT`); } catch (_) {}
        try { await sequelize.query(`ALTER TABLE "Users" ADD COLUMN "saldoCaixaJSON" TEXT`); } catch (_) {}
    }
    // Migra role 'reseller' → 'personal' (renomeio de perfil) — roda em PG e SQLite
    try { await sequelize.query(`UPDATE "Users" SET "role" = 'personal' WHERE "role" = 'reseller'`); } catch (_) {}
    await ensureMasterAdmin();
    const { startCronJobs } = require('./services/cronService');
    startCronJobs();
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
🚀 Gestor Orion SaaS rodando na porta ${PORT}

👉 http://127.0.0.1:${PORT}/login
👉 http://127.0.0.1:${PORT}/dashboard
        `);
    });
}).catch(err => {
    console.error('ERRO FATAL AO INICIAR:', err);
    process.exit(1);
});

/* TRATAMENTO DE ERROS */
/* 404 */
app.use((req, res) => {
    const isApi = req.path.startsWith('/auth') || req.path.startsWith('/resellers') ||
                  req.path.startsWith('/clients') || req.path.startsWith('/servers') ||
                  req.path.startsWith('/report') || req.path.startsWith('/owner') ||
                  req.path.startsWith('/master') || req.path.startsWith('/tenant');
    if (isApi) return res.status(404).json({ error: 'Rota não encontrada' });
    res.status(404).send(`<!DOCTYPE html>
<html lang="pt-br"><head><meta charset="UTF-8"><title>404 — Gestor Orion</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a12;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.box{padding:40px}.code{font-size:80px;color:#1a6fff;font-weight:bold;opacity:.3}h1{font-size:20px;margin-bottom:8px}p{color:#aaa;font-size:13px;margin-bottom:24px}a{color:#1a6fff;font-size:13px}</style>
</head><body><div class="box"><div class="code">404</div><h1>Página não encontrada</h1><p>O endereço que você acessou não existe.</p><a href="/dashboard">← Voltar ao Painel</a></div></body></html>`);
});
/* 500 */
app.use((err, req, res, next) => {
    console.error('[500]', err?.message || err);
    const isApi = req.headers['content-type']?.includes('application/json') || req.path.startsWith('/auth') || req.path.startsWith('/resellers');
    if (isApi || req.xhr) return res.status(500).json({ error: 'Erro interno do servidor' });
    res.status(500).send(`<!DOCTYPE html>
<html lang="pt-br"><head><meta charset="UTF-8"><title>500 — Gestor Orion</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a12;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.box{padding:40px}.code{font-size:80px;color:#ff4444;font-weight:bold;opacity:.3}h1{font-size:20px;margin-bottom:8px}p{color:#aaa;font-size:13px;margin-bottom:24px}a{color:#1a6fff;font-size:13px}</style>
</head><body><div class="box"><div class="code">500</div><h1>Erro interno</h1><p>Algo deu errado. Tente novamente em instantes.</p><a href="/dashboard">← Voltar ao Painel</a></div></body></html>`);
});
