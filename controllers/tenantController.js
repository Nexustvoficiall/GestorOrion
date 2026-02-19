/**
 * tenantController.js
 * Gerenciamento de tenants — apenas master pode usar este controller.
 * Tenant = "cliente do SaaS" (comprador de uma licença Orion)
 */
const { Tenant, User } = require('../models');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { invalidateTenantCache } = require('../middlewares/licenseMiddleware');
const { audit } = require('../middlewares/authMiddleware');

/* GET /master/tenants — lista todos os tenants */
exports.list = async (req, res) => {
    try {
        const tenants = await Tenant.findAll({ order: [['createdAt', 'DESC']] });
        res.json(tenants);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar tenants' });
    }
};

/* POST /master/tenants — cria novo tenant + admin do tenant */
exports.create = async (req, res) => {
    try {
        const {
            name, slug, plan,
            licenseExpiration,
            primaryColor, logoUrl, brandName,
            adminUsername, adminPassword
        } = req.body;

        if (!name || !slug || !adminUsername || !adminPassword) {
            return res.status(400).json({ error: 'Campos obrigatórios: name, slug, adminUsername, adminPassword' });
        }

        // Slug único
        const existing = await Tenant.findOne({ where: { slug } });
        if (existing) return res.status(400).json({ error: 'Slug já em uso' });

        const tenant = await Tenant.create({
            name,
            slug,
            plan: plan || 'BASICO',
            licenseExpiration: licenseExpiration || null,
            primaryColor: primaryColor || '#e53935',
            logoUrl: logoUrl || null,
            brandName: brandName || name,
            isActive: true
        });

        // Cria o admin do tenant
        const hash = await bcrypt.hash(adminPassword, 10);
        await User.create({
            username: adminUsername,
            password: hash,
            role: 'admin',
            tenantId: tenant.id
        });

        await audit(req, 'CREATE_TENANT', 'Tenant', null, { name, slug, plan });
        res.json({ ok: true, tenantId: tenant.id, slug: tenant.slug });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar tenant' });
    }
};

/* GET /master/tenants/:id */
exports.getById = async (req, res) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
        res.json(tenant);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar tenant' });
    }
};

/* PUT /master/tenants/:id — atualiza dados do tenant */
exports.update = async (req, res) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        const { name, plan, licenseExpiration, isActive, primaryColor, logoUrl, brandName } = req.body;
        await tenant.update({ name, plan, licenseExpiration, isActive, primaryColor, logoUrl, brandName });

        invalidateTenantCache(tenant.id);
        await audit(req, 'UPDATE_TENANT', 'Tenant', null, { id: tenant.id, name, plan });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar tenant' });
    }
};

/* DELETE /master/tenants/:id — desativa (soft delete) */
exports.deactivate = async (req, res) => {
    try {
        const tenant = await Tenant.findByPk(req.params.id);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
        await tenant.update({ isActive: false });
        invalidateTenantCache(tenant.id);
        await audit(req, 'DEACTIVATE_TENANT', 'Tenant', null, { id: tenant.id });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao desativar tenant' });
    }
};

/* GET /tenant/me — tenant admin vê seus próprios dados */
exports.getMyTenant = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
        res.json(tenant);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar tenant' });
    }
};

/* PUT /tenant/me — tenant admin atualiza branding do próprio tenant */
exports.updateMyTenant = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        // Tenant admin só pode alterar branding — não altera plano/licença/isActive
        const { primaryColor, logoUrl, brandName } = req.body;
        await tenant.update({ primaryColor, logoUrl, brandName });
        invalidateTenantCache(tenant.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar tenant' });
    }
};
