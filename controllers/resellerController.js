const { Reseller, ResellerServer } = require('../models');
const { audit } = require('../middlewares/authMiddleware');

/* CRIAR REVENDEDOR */
exports.create = async (req, res) => {
    try {
        const { name, type, settleDate, whatsapp, servers } = req.body;
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

        const reseller = await Reseller.create({ name, type, settleDate: settleDate || null, whatsapp: whatsapp || null, paymentStatus: 'PENDENTE', tenantId });

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
        const data = await Reseller.findAll({
            where: { tenantId },
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

        const reseller = await Reseller.findOne({ where: { id, tenantId } });
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
        await Reseller.update({ paymentStatus }, { where: { id, tenantId } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar pagamento' });
    }
};

/* EXCLUIR REVENDEDOR */
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.tenantId;
        const reseller = await Reseller.findOne({ where: { id, tenantId } });
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
        const r = await Reseller.findOne({ where: { id: req.params.id, tenantId } });
        if (!r) return res.status(404).json({ error: 'Revenda não encontrada' });
        const newStatus = r.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        await r.update({ status: newStatus });
        res.json({ status: newStatus });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
};


