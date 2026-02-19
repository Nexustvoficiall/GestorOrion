const { User } = require('../models');
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

        req.session.user = {
            id:         user.id,
            username:   user.username,
            role:       user.role,
            resellerId: user.resellerId,
            tenantId:   user.tenantId || null,
            firstLogin: user.firstLogin !== false  // true no primeiro acesso
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

exports.createReseller = async (req, res) => {
    try {
        const { username, password, resellerId, role } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Dados incompletos' });

        const tenantId = req.tenantId || req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

        const exists = await User.findOne({ where: { username, tenantId } });
        if (exists) return res.status(400).json({ error: 'Usuário já existe' });

        const hash = await bcrypt.hash(password, 10);
        // master pode criar qualquer role; admin só pode criar reseller
        const callerRole = req.session?.user?.role;
        const allowedRole = (callerRole === 'master' && role === 'admin') ? 'admin' : 'reseller';
        const user = await User.create({ username, password: hash, role: allowedRole, resellerId, tenantId });

        res.json({ ok: true, id: user.id, role: allowedRole });
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
    const tenantId = req.session?.user?.tenantId;
    const where = tenantId ? { tenantId } : {};
    const users = await User.findAll({ where, attributes: ['id', 'username', 'role', 'resellerId', 'firstLogin'] });
    res.json(users);
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
