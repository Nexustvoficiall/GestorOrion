const { Server } = require('../models');

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
        await Server.destroy({ where: { id: req.params.id, tenantId } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir servidor' });
    }
};
