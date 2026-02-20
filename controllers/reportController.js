const { getFullFinancials } = require('../services/financialService');

exports.summary = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const sessionUser = req.session?.user;
        const ownerId = sessionUser?.role === 'personal' && sessionUser?.resellerId
            ? sessionUser.resellerId : null;
        const data = await getFullFinancials(tenantId, ownerId);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
};
