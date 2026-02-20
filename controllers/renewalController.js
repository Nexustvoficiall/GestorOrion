const { User, RenewalRequest } = require('../models');

const PLAN_DAYS   = { '1m': 30, '3m': 90, '6m': 180, '1a': 365 };
const PLAN_LABELS = { '1m': '1 Mês', '3m': '3 Meses', '6m': '6 Meses', '1a': '1 Ano' };
const DEFAULT_PRICES = { '1m': 30, '3m': 80, '6m': 150, '1a': 250 };

async function getMasterPrices() {
    try {
        const master = await User.findOne({ where: { role: 'master' } });
        if (master && master.planPricesJSON) {
            return { ...DEFAULT_PRICES, ...JSON.parse(master.planPricesJSON) };
        }
    } catch (_) {}
    return { ...DEFAULT_PRICES };
}

/* GET /renewal/prices */
exports.getPrices = async (req, res) => {
    try {
        res.json(await getMasterPrices());
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
};

/* POST /renewal/prices  — somente master */
exports.savePrices = async (req, res) => {
    try {
        if (req.session.user.role !== 'master') return res.status(403).json({ error: 'Sem permissão' });
        const prices = {};
        for (const k of ['1m', '3m', '6m', '1a']) {
            prices[k] = Number(req.body[k]) || DEFAULT_PRICES[k];
        }
        await User.update({ planPricesJSON: JSON.stringify(prices) }, { where: { role: 'master' } });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Erro ao salvar preços' }); }
};

/* POST /renewal  — usuário solicita renovação */
exports.requestRenewal = async (req, res) => {
    try {
        const { plan, message } = req.body;
        if (!PLAN_DAYS[plan]) return res.status(400).json({ error: 'Plano inválido' });

        const userId   = req.session.user.id;
        const tenantId = req.session.user.tenantId || null;

        // Não permite duplicar pedido pendente
        const pending = await RenewalRequest.findOne({ where: { userId, status: 'pending' } });
        if (pending) return res.status(400).json({ error: 'Você já tem uma solicitação pendente. Aguarde a aprovação.' });

        const prices = await getMasterPrices();
        const price  = prices[plan] || 0;

        const r = await RenewalRequest.create({ userId, tenantId, plan, price, message: message || null });
        res.json({ ok: true, id: r.id, price, plan });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao criar solicitação' });
    }
};

/* GET /renewal/my  — usuário vê seus próprios pedidos */
exports.getMyRequests = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const rows   = await RenewalRequest.findAll({
            where:  { userId },
            order:  [['createdAt', 'DESC']],
            limit:  5
        });
        const user = await User.findByPk(userId, { attributes: ['panelExpiry', 'panelPlan'] });
        res.json({
            requests:    rows,
            panelExpiry: user?.panelExpiry || null,
            panelPlan:   user?.panelPlan   || 'STANDARD'
        });
    } catch (e) { res.status(500).json({ error: 'Erro' }); }
};

/* GET /renewal/all  — admin/master vê todos pendentes do tenant */
exports.getAllRequests = async (req, res) => {
    try {
        const { role, tenantId, id: meId } = req.session.user;
        if (!['admin', 'master'].includes(role)) return res.status(403).json({ error: 'Sem permissão' });

        const { Op } = require('sequelize');
        const where = { status: 'pending' };

        if (role === 'master') {
            // master vê todos os pedidos
        } else {
            // admin vê só do seu tenant
            where.tenantId = tenantId;
        }

        const rows    = await RenewalRequest.findAll({ where, order: [['createdAt', 'ASC']] });
        const userIds = [...new Set(rows.map(r => r.userId))];
        const users   = await User.findAll({
            where:      { id: userIds },
            attributes: ['id', 'username', 'panelExpiry', 'panelPlan']
        });
        const userMap = Object.fromEntries(users.map(u => [u.id, u]));

        const result = rows.map(r => ({
            ...r.toJSON(),
            username:      userMap[r.userId]?.username   || '?',
            currentExpiry: userMap[r.userId]?.panelExpiry || null,
            planLabel:     PLAN_LABELS[r.plan] || r.plan
        }));

        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro' });
    }
};

/* POST /renewal/:id/approve */
exports.approveRequest = async (req, res) => {
    try {
        const { role } = req.session.user;
        if (!['admin', 'master'].includes(role)) return res.status(403).json({ error: 'Sem permissão' });

        const r = await RenewalRequest.findByPk(req.params.id);
        if (!r || r.status !== 'pending') return res.status(404).json({ error: 'Pedido não encontrado ou já processado' });

        const user = await User.findByPk(r.userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

        // Extende a partir do vencimento atual (se não expirou) ou de hoje
        const base = user.panelExpiry && new Date(user.panelExpiry) > new Date()
            ? new Date(user.panelExpiry)
            : new Date();
        base.setDate(base.getDate() + (PLAN_DAYS[r.plan] || 30));

        await user.update({ panelExpiry: base });
        await r.update({ status: 'approved', respondedAt: new Date() });

        res.json({
            ok:        true,
            newExpiry: base.toISOString().split('T')[0],
            username:  user.username,
            planLabel: PLAN_LABELS[r.plan] || r.plan
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao aprovar' });
    }
};

/* POST /renewal/:id/reject */
exports.rejectRequest = async (req, res) => {
    try {
        const { role } = req.session.user;
        if (!['admin', 'master'].includes(role)) return res.status(403).json({ error: 'Sem permissão' });

        const r = await RenewalRequest.findByPk(req.params.id);
        if (!r || r.status !== 'pending') return res.status(404).json({ error: 'Pedido não encontrado ou já processado' });

        await r.update({ status: 'rejected', respondedAt: new Date() });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Erro ao rejeitar' }); }
};
