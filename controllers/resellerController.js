const { Reseller, ResellerServer } = require('../models');
const { audit } = require('../middlewares/authMiddleware');

/* CRIAR REVENDEDOR */
exports.create = async (req, res) => {
    try {
        const { name, type, settleDate, whatsapp, servers } = req.body;
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

        const sessionUser = req.session?.user;
        const ownerId = sessionUser?.role === 'reseller' && sessionUser?.resellerId
            ? sessionUser.resellerId : null;

        const reseller = await Reseller.create({ name, type, settleDate: settleDate || null, whatsapp: whatsapp || null, paymentStatus: 'PENDENTE', tenantId, ownerId });

        if (servers && servers.length) {
            for (const s of servers) {
                await ResellerServer.create({
                    resellerId:    reseller.id,
                    server:        s.server,
                    activeCount:   s.activeCount,
                    pricePerActive:s.pricePerActive,
                    costPerActive: s.costPerActive,
                    settleDate:    s.settleDate || null,
                    tenantId
                });
            }
        }

        await audit(req, 'CREATE_RESELLER', 'Reseller', reseller.id, { name, type });
        res.json({ success: true, id: reseller.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar revendedor' });
    }
};

/* LISTAR REVENDEDORES */
exports.list = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const sessionUser = req.session?.user;
        const where = { tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) {
            where.ownerId = sessionUser.resellerId;
        }
        const data = await Reseller.findAll({
            where,
            include: [{ model: ResellerServer, as: 'servers' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar revendas' });
    }
};

/* ATUALIZAR REVENDEDOR */
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, settleDate, paymentStatus, whatsapp, servers } = req.body;
        const tenantId = req.tenantId;
        const sessionUser = req.session?.user;
        const where = { id, tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) where.ownerId = sessionUser.resellerId;

        const reseller = await Reseller.findOne({ where });
        if (!reseller) return res.status(404).json({ error: 'Revenda não encontrada' });

        await reseller.update({ name, type, settleDate: settleDate || null, paymentStatus, whatsapp: whatsapp || null });

        /* atualiza servidores se enviados */
        if (servers && servers.length) {
            await ResellerServer.destroy({ where: { resellerId: id, tenantId } });
            for (const s of servers) {
                await ResellerServer.create({
                    resellerId:    id,
                    server:        s.server,
                    activeCount:   s.activeCount,
                    pricePerActive:s.pricePerActive,
                    costPerActive: s.costPerActive,
                    settleDate:    s.settleDate || null,
                    tenantId
                });
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar revendedor' });
    }
};

/* ATUALIZAR SÓ PAGAMENTO */
exports.updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        const tenantId = req.tenantId;
        const sessionUser = req.session?.user;
        const where = { id, tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) where.ownerId = sessionUser.resellerId;
        await Reseller.update({ paymentStatus }, { where });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar pagamento' });
    }
};

/* GERENCIAR PLANO MENSAL */
exports.setPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, months, planValue } = req.body; // action: 'activate' | 'renew' | 'cancel'
        const tenantId = req.tenantId;
        const sessionUser = req.session?.user;
        const planWhere = { id, tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) planWhere.ownerId = sessionUser.resellerId;

        const reseller = await Reseller.findOne({ where: planWhere });
        if (!reseller) return res.status(404).json({ error: 'Revenda não encontrada' });

        if (action === 'cancel') {
            await reseller.update({ planActive: false, planExpiresAt: null });
            return res.json({ success: true, message: 'Plano cancelado' });
        }

        const qty = Number(months) || 1;
        const value = planValue !== undefined ? Number(planValue) : 20.00;

        // Calcula nova data: se já tem expiração futura, soma a partir dela; senão de hoje
        let base = reseller.planExpiresAt && reseller.planActive
            ? new Date(reseller.planExpiresAt + 'T00:00:00')
            : new Date();
        if (base < new Date()) base = new Date(); // se já expirou, renova a partir de hoje
        base.setDate(base.getDate() + (qty * 30));
        const newExpiry = base.toISOString().slice(0, 10);

        await reseller.update({ planActive: true, planExpiresAt: newExpiry, planValue: value });
        await audit(req, 'PLAN_RENEWED', 'Reseller', reseller.id, { months: qty, expiresAt: newExpiry, value });

        res.json({ success: true, planExpiresAt: newExpiry, planActive: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar plano' });
    }
};

/* EXCLUIR REVENDEDOR */
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const sessionUser = req.session?.user;
        const where = { id, tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) where.ownerId = sessionUser.resellerId;
        const reseller = await Reseller.findOne({ where });
        if (!reseller) return res.status(404).json({ error: 'Revenda não encontrada' });
        await ResellerServer.destroy({ where: { resellerId: id, tenantId } });
        await reseller.destroy();
        await audit(req, 'DELETE_RESELLER', 'Reseller', Number(id), { name: reseller?.name });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao excluir revendedor' });
    }
};

/* ALTERNAR STATUS ATIVO/INATIVO */
exports.toggleStatus = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const sessionUser = req.session?.user;
        const where = { id: req.params.id, tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) where.ownerId = sessionUser.resellerId;
        const r = await Reseller.findOne({ where });
        if (!r) return res.status(404).json({ error: 'Revenda não encontrada' });
        const newStatus = r.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        await r.update({ status: newStatus });
        res.json({ status: newStatus });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
};


