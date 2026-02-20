const { Client } = require('../models');
const dayjs = require('dayjs');
const { audit } = require('../middlewares/authMiddleware');
const { Op } = require('sequelize');

exports.create = async (req, res) => {

    const { planType } = req.body;

    const startDate = dayjs();
    const dueDate = startDate.add(Number(planType), 'day');
    const tenantId = req.tenantId;
    const sessionUser = req.session?.user;

    if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });

    // Revendedor só pode criar clientes vinculados a si mesmo
    const resellerId = sessionUser?.role === 'reseller' && sessionUser?.resellerId
        ? sessionUser.resellerId
        : (req.body.resellerId || null);

    const client = await Client.create({
        ...req.body,
        tenantId,
        resellerId,
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

    // Revendedor vê apenas seus próprios clientes
    const where = { tenantId };
    if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) {
        where.resellerId = sessionUser.resellerId;
    }

    const clients = await Client.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json(clients);
};

exports.update = async (req, res) => {
    try {
        const sessionUser = req.session?.user;
        const where = { id: req.params.id, tenantId: req.tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) {
            where.resellerId = sessionUser.resellerId;
        }
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
        const where = { id: req.params.id, tenantId: req.tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) {
            where.resellerId = sessionUser.resellerId;
        }
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
        const where = { id: req.params.id, tenantId: req.tenantId };
        if (sessionUser?.role === 'reseller' && sessionUser?.resellerId) {
            where.resellerId = sessionUser.resellerId;
        }
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

