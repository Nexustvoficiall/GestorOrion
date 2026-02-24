const { Server, ResellerServer, Tenant } = require('../models');

// Limites de servidores por plano
const PLAN_SERVER_LIMITS = {
    'BASICO':      3,
    'PRO':         10,
    'ENTERPRISE':  999999,
    'PREMIUM':     999999,
    'TRIAL':       2
};

/* LISTAR TODOS (do tenant) */
exports.list = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const servers = await Server.findAll({ where: { tenantId }, order: [['name', 'ASC']] });
        res.json(servers);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao listar servidores' });
    }
};

/* CRIAR */
exports.create = async (req, res) => {
    try {
        const { name } = req.body;
        const tenantId = req.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome do servidor' });
        const existing = await Server.findOne({ where: { name: name.trim(), tenantId } });
        if (existing) return res.status(400).json({ error: 'Servidor já existe' });

        // Verificar limite de servidores do plano
        try {
            const tenant = await Tenant.findByPk(tenantId);
            if (tenant) {
                const now = new Date();
                const trialActive = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > now;
                const planKey = trialActive ? 'TRIAL' : (tenant.plan || 'BASICO').toUpperCase();
                const limit = PLAN_SERVER_LIMITS[planKey] ?? 3;
                const total = await Server.count({ where: { tenantId } });
                if (total >= limit) {
                    const planName = trialActive ? 'Trial (7 dias)' : planKey;
                    return res.status(403).json({
                        error: 'LIMITE_PLANO',
                        message: `Limite de ${limit} servidores atingido para o plano ${planName}. Faça upgrade para continuar.`
                    });
                }
            }
        } catch (_) { /* não bloquear em caso de erro de verificação */ }

        const server = await Server.create({ name: name.trim(), tenantId });
        res.json(server);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao criar servidor' });
    }
};

/* EXCLUIR */
exports.remove = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        // Busca nome do servidor antes de apagar para limpar ResellerServer
        const server = await Server.findOne({ where: { id: req.params.id, tenantId } });
        if (server) {
            // Remove entradas de revenda que referenciam este servidor pelo nome
            await ResellerServer.destroy({ where: { server: server.name, tenantId } });
        }
        await Server.destroy({ where: { id: req.params.id, tenantId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir servidor' });
    }
};
