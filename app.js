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
app.use(session({
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
}, checkLicensePage, express.static(path.join(__dirname, 'dashboard')));

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
app.use('/owner',   require('./routes/ownerRoutes'));
app.use('/tenant',  require('./routes/tenantRoutes'));
app.use('/master',  require('./routes/masterRoutes'));

/* Rotas que requerem tenant isolado */
app.use('/audit',           requireAuth, require('./routes/auditRoutes'));
app.use('/clients',         requireAuth, enforceTenant, require('./routes/clientRoutes'));
app.use('/resellers',       requireAuth, enforceTenant, require('./routes/resellerRoutes'));
app.use('/report',          requireAuth, enforceTenant, require('./routes/reportRoutes'));
app.use('/servers',         requireAuth, enforceTenant, require('./routes/serverRoutes'));
app.use('/resellerservers', requireAuth, enforceTenant, require('./routes/resellerServerRoutes'));

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
sequelize.sync({ alter: true }).then(async () => {
    console.log('✅ Banco conectado e sincronizado');
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
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});
