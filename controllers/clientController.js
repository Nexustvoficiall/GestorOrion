const { Client } = require('../models');
const dayjs = require('dayjs');
const { audit } = require('../middlewares/authMiddleware');

exports.create = async (req, res) => {

    const { planType } = req.body;

    const startDate = dayjs();
    const dueDate = startDate.add(Number(planType), 'day');
    const tenantId = req.tenantId;

    if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

    const client = await Client.create({
        ...req.body,
        tenantId,
        startDate: startDate.toDate(),
        dueDate: dueDate.toDate()
    });

    await audit(req, 'CREATE_CLIENT', 'Client', client.id, { name: client.name, username: client.username });
    res.json(client);
};

exports.list = async (req, res) => {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
    const clients = await Client.findAll({ where: { tenantId }, order: [['createdAt', 'DESC']] });
    res.json(clients);
};

exports.toggleStatus = async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, tenantId: req.tenantId } });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
        const newStatus = client.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        await client.update({ status: newStatus });
        await audit(req, 'TOGGLE_CLIENT_STATUS', 'Client', client.id, { newStatus });
        res.json({ status: newStatus });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
};

