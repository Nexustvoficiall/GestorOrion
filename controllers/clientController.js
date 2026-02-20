const { Client } = require('../models');
const dayjs = require('dayjs');
const { audit } = require('../middlewares/authMiddleware');
const { Op } = require('sequelize');

/* Helper: para personal e admin, filtra por userId = sessionUser.id (isolamento exclusivo por usuário) */
function personalWhere(sessionUser, base = {}) {
    if (['personal', 'admin'].includes(sessionUser?.role)) {
        return { ...base, userId: sessionUser.id };
    }
    return base;
}

exports.create = async (req, res) => {
    const { planType } = req.body;
    const startDate = dayjs();
    const dueDate = startDate.add(Number(planType), 'day');
    const tenantId = req.tenantId;
    const sessionUser = req.session?.user;

    if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

    // Para personal e admin: userId = id único do usuário logado (isolamento exclusivo)
    const userId = ['personal', 'admin'].includes(sessionUser?.role) ? sessionUser.id : null;
    // resellerId fica nulo para personal/admin (userId já garante isolamento)
    const resellerId = ['personal', 'admin'].includes(sessionUser?.role) ? null : (req.body.resellerId || null);

    const client = await Client.create({
        ...req.body,
        tenantId,
        resellerId,
        userId,
        startDate: startDate.toDate(),
        dueDate: dueDate.toDate()
    });

    await audit(req, 'CREATE_CLIENT', 'Client', client.id, { name: client.name, username: client.username });
    res.json(client);
};

exports.list = async (req, res) => {
    const tenantId = req.tenantId;
    const sessionUser = req.session?.user;
    if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

    // Personal vê apenas seus próprios clientes (por userId exclusivo)
    const where = personalWhere(sessionUser, { tenantId });

    const clients = await Client.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(clients);
};

exports.update = async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const where = personalWhere(sessionUser, { id: req.params.id, tenantId: req.tenantId });
        const client = await Client.findOne({ where });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
        const { name, username, password, whatsapp, server, app, planType, planValue, costPerActive } = req.body;
        await client.update({ name, username, password, whatsapp, server, app, planType, planValue, costPerActive });
        await audit(req, 'UPDATE_CLIENT', 'Client', client.id, { name });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
};

exports.renew = async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const where = personalWhere(sessionUser, { id: req.params.id, tenantId: req.tenantId });
        const client = await Client.findOne({ where });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
        const days = Number(req.body.planType || client.planType) || 30;
        const base = client.dueDate && new Date(client.dueDate) > new Date()
            ? new Date(client.dueDate)
            : new Date();
        base.setDate(base.getDate() + days);
        await client.update({ dueDate: base, status: 'ATIVO' });
        await audit(req, 'RENEW_CLIENT', 'Client', client.id, { days, newDueDate: base });
        res.json({ success: true, dueDate: base });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao renovar cliente' });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const where = personalWhere(sessionUser, { id: req.params.id, tenantId: req.tenantId });
        const client = await Client.findOne({ where });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
        const newStatus = client.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
        await client.update({ status: newStatus });
        await audit(req, 'TOGGLE_CLIENT_STATUS', 'Client', client.id, { newStatus });
        res.json({ status: newStatus });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
};

exports.deleteClient = async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const where = personalWhere(sessionUser, { id: req.params.id, tenantId: req.tenantId });
        const client = await Client.findOne({ where });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
        await audit(req, 'DELETE_CLIENT', 'Client', client.id, { name: client.name });
        await client.destroy();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao excluir cliente' });
    }
};
