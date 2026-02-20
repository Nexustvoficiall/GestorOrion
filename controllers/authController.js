const { User, Client } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { audit } = require('../middlewares/authMiddleware');

function saveCredentials(username, plainPassword) {
    const file = path.join(__dirname, '..', 'ACESSO_ADMIN.txt');
    const content = [
        '====================================',
        '  GESTOR ORION — CREDENCIAIS SALVAS',
        '====================================',
        `  Usuario : ${username}`,
        `  Senha   : ${plainPassword}`,
        `  Salvo em: ${new Date().toLocaleString('pt-BR')}`,
        '====================================',
    ].join('\n');
    fs.writeFileSync(file, content, 'utf8');
}

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) return res.status(401).json({ error: 'Usuário inválido' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Senha inválida' });

        // Bloqueia personal OU admin com licença de painel expirada
        if (['personal', 'admin'].includes(user.role) && user.panelExpiry && new Date(user.panelExpiry) < new Date()) {
            return res.status(403).json({
                error: 'PAINEL_EXPIRADO',
                message: 'Sua licença de acesso ao painel expirou. Renove com seu administrador.'
            });
        }

        req.session.user = {
            id:          user.id,
            username:    user.username,
            role:        user.role,
            resellerId:  user.resellerId,
            tenantId:    user.tenantId || null,
            firstLogin:  user.firstLogin !== false,
            panelExpiry: user.panelExpiry || null,  // inclui na sessão para exibir no painel
            themeColor:  user.themeColor || 'red'   // tema de cor salvo pelo usuário
        };

        await audit(req, 'LOGIN', 'User', user.id, { username: user.username });

        // Garante que a sessão é gravada antes de responder
        req.session.save(err => {
            if (err) return res.status(500).json({ error: 'Erro ao salvar sessão' });
            res.json({ ok: true, role: user.role });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
};

exports.me = (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Não autenticado' });
    res.json(req.session.user);
};

// Mapa de planos → dias de acesso
const PLAN_DAYS = { '1m': 30, '30d': 30, '3m': 90, '6m': 180, '1a': 365 };

exports.createReseller = async (req, res) => {
    try {
        const { username, password, resellerId, role, accessPlan } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' });

        const tenantId = req.tenantId || req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

        const exists = await User.findOne({ where: { username, tenantId } });
        if (exists) return res.status(400).json({ error: 'Usuário já existe' });

        const hash = await bcrypt.hash(password, 10);
        // master pode criar admin ou personal; admin só pode criar personal
        const callerRole = req.session?.user?.role;
        const allowedRole = (callerRole === 'master' && role === 'admin') ? 'admin' : 'personal';

        // Calcular validade do painel para personal e admin (se accessPlan informado)
        let panelExpiry = null;
        if (accessPlan && PLAN_DAYS[accessPlan]) {
            panelExpiry = new Date();
            panelExpiry.setDate(panelExpiry.getDate() + PLAN_DAYS[accessPlan]);
        }

        const user = await User.create({
            username, password: hash, role: allowedRole,
            resellerId, tenantId,
            panelPlan: 'STANDARD',
            panelExpiry,
            createdBy: req.session?.user?.id || null  // rastreia quem criou
        });

        res.json({ ok: true, id: user.id, role: allowedRole, panelExpiry });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
};

exports.changeUsername = async (req, res) => {
    try {
        const { newUsername, password } = req.body;
        if (!newUsername || !password)
            return res.status(400).json({ error: 'Dados incompletos' });
        if (newUsername.trim().length < 3)
            return res.status(400).json({ error: 'Nome muito curto' });

        const user = await User.findByPk(req.session.user.id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

        const taken = await User.findOne({ where: { username: newUsername.trim() } });
        if (taken && taken.id !== user.id)
            return res.status(400).json({ error: 'Nome de usuário já em uso' });

        await user.update({ username: newUsername.trim() });
        req.session.user.username = newUsername.trim();
        // Salva credenciais atualizadas em arquivo
        saveCredentials(newUsername.trim(), '(senha não alterada — veja ACESSO_ADMIN.txt anterior)');
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Dados incompletos' });
        if (newPassword.length < 4)
            return res.status(400).json({ error: 'Nova senha muito curta (mínimo 4 caracteres)' });

        const user = await User.findByPk(req.session.user.id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });

        const hash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hash });
        // Salva credenciais atualizadas em arquivo
        const u = await User.findByPk(req.session.user.id);
        saveCredentials(u.username, newPassword);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno' });
    }
};

exports.listUsers = async (req, res) => {
    const callerRole = req.session?.user?.role;
    const callerId   = req.session?.user?.id;
    const tenantId   = req.session?.user?.tenantId;

    // Master vê todos do tenant; admin vê apenas os que ele criou
    let where = tenantId ? { tenantId } : {};
    if (callerRole === 'admin') where.createdBy = callerId;

    const users = await User.findAll({
        where,
        attributes: ['id', 'username', 'role', 'resellerId', 'firstLogin', 'panelPlan', 'panelExpiry', 'createdBy']
    });
    res.json(users);
};

/* LISTAR ADMINS COM CONTAGEM DE PERSONALS E CLIENTES (somente master) */
exports.listAdmins = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        const where = tenantId ? { role: 'admin', tenantId } : { role: 'admin' };

        const admins = await User.findAll({
            where,
            attributes: ['id', 'username', 'panelExpiry', 'panelPlan', 'createdAt']
        });

        // Para cada admin: conta personals criados e clientes cadastrados por esses personals
        const result = await Promise.all(admins.map(async (admin) => {
            // Personal users criados por este admin
            const personalUsers = await User.findAll({
                where: { createdBy: admin.id, role: 'personal' },
                attributes: ['id']
            });
            const personalIds = personalUsers.map(u => u.id);

            // Total de clientes cadastrados pelos personals deste admin
            let totalClients = 0;
            if (personalIds.length > 0) {
                totalClients = await Client.count({
                    where: { userId: { [Op.in]: personalIds } }
                });
            }

            // Clientes cadastrados diretamente pelo admin (userId = admin.id)
            const adminClients = await Client.count({ where: { userId: admin.id } });

            const isExpired = admin.panelExpiry && new Date(admin.panelExpiry) < new Date();
            return {
                id: admin.id,
                username: admin.username,
                panelExpiry: admin.panelExpiry || null,
                panelPlan: admin.panelPlan || 'STANDARD',
                isExpired,
                personalCount: personalIds.length,
                clientsFromPersonals: totalClients,
                adminClients,
                createdAt: admin.createdAt
            };
        }));

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar admins' });
    }
};

/* GERAR TOKEN DE RESET (admin/master para outro usuário) */
exports.generateResetToken = async (req, res) => {
    try {
        const { userId } = req.params;
        const callerRole = req.session?.user?.role;
        const tenantId   = req.tenantId || req.session?.user?.tenantId;
        // master acessa qualquer usuário; admin só do próprio tenant
        const where = (callerRole === 'master') ? { id: userId } : { id: userId, tenantId };
        const user = await User.findOne({ where });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        const token  = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await user.update({ resetToken: token, resetTokenExpiry: expiry });
        res.json({ ok: true, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao gerar token' });
    }
};

/* REDEFINIR SENHA POR TOKEN (rota pública) */
exports.resetByToken = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Dados incompletos' });
        if (newPassword.length < 4) return res.status(400).json({ error: 'Senha muito curta (mínimo 4)' });
        const user = await User.findOne({ where: { resetToken: token } });
        if (!user) return res.status(400).json({ error: 'Token inválido ou já utilizado' });
        if (new Date() > new Date(user.resetTokenExpiry)) return res.status(400).json({ error: 'Token expirado (válido por 24h)' });
        const hash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hash, resetToken: null, resetTokenExpiry: null, firstLogin: false });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao redefinir senha' });
    }
};

/* MARCAR PRIMEIRO LOGIN COMO CONCLUÍDO */
exports.markFirstLoginDone = async (req, res) => {
    try {
        await User.update({ firstLogin: false }, { where: { id: req.session.user.id } });
        req.session.user.firstLogin = false;
        req.session.save(() => res.json({ ok: true }));
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
};

/* PREFERÊNCIAS DO USUÁRIO: tema de cor e logo (GET — retorna do DB) */
exports.getPreferences = async (req, res) => {
    try {
        const user = await User.findByPk(req.session.user.id, {
            attributes: ['themeColor', 'logoBase64']
        });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ themeColor: user.themeColor || 'red', logoBase64: user.logoBase64 || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao carregar preferências' });
    }
};

/* PREFERÊNCIAS DO USUÁRIO: salva tema de cor e/ou logo (PUT) */
exports.savePreferences = async (req, res) => {
    try {
        const { themeColor, logoBase64 } = req.body;
        const updates = {};
        if (themeColor !== undefined) updates.themeColor = themeColor;
        if (logoBase64 !== undefined) updates.logoBase64 = logoBase64 || null;
        await User.update(updates, { where: { id: req.session.user.id } });
        // Atualiza sessão para que /auth/me reflita imediatamente
        if (themeColor !== undefined) req.session.user.themeColor = themeColor;
        req.session.save(() => res.json({ ok: true }));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao salvar preferências' });
    }
};

/* EXCLUIR USUÁRIO (master pode excluir qualquer um; admin só do próprio tenant) */
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const callerRole = req.session?.user?.role;
        const tenantId   = req.tenantId || req.session?.user?.tenantId;
        // Impede auto-exclusão
        if (Number(userId) === req.session?.user?.id) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio acesso' });
        }
        const where = callerRole === 'master' ? { id: userId } : { id: userId, tenantId };
        const user = await User.findOne({ where });
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
        // Impede excluir outro master
        if (user.role === 'master') return res.status(403).json({ error: 'Não é possível excluir um master' });
        await user.destroy();
        await audit(req, 'DELETE_USER', 'User', Number(userId), { username: user.username });
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
};
