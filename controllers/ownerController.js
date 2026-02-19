/**
 * ownerController.js — agora delegado ao tenantController
 * Mantido para compatibilidade de rotas /owner existentes.
 * Cada rota opera sobre o tenant do usuário logado.
 */
const { Tenant } = require('../models');
const { invalidateTenantCache } = require('../middlewares/licenseMiddleware');
const { audit } = require('../middlewares/authMiddleware');

function getTenantId(req) {
    return req.session?.user?.tenantId || null;
}

/* GET /owner */
exports.get = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
        const data = tenant.toJSON();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
};

/* PUT /owner */
exports.update = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        const { brandName, primaryColor, logoUrl } = req.body;
        await tenant.update({ brandName, primaryColor, logoUrl });
        invalidateTenantCache(tenantId);
        await audit(req, 'UPDATE_TENANT_BRANDING', 'Tenant', null, { brandName, primaryColor });
        res.json({ ok: true, owner: tenant.toJSON() });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
};

/* POST /owner/license — master pode forçar manualmente via rota; tenant admin não usa */
exports.setLicense = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(403).json({ error: 'Tenant não identificado' });
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        const { licenseExpiration, isActive, plan } = req.body;
        const update = {};
        if (licenseExpiration !== undefined) update.licenseExpiration = licenseExpiration || null;
        if (isActive !== undefined) update.isActive = isActive;
        if (plan !== undefined) update.plan = plan;

        await tenant.update(update);
        invalidateTenantCache(tenantId);
        await audit(req, 'SET_LICENSE', 'Tenant', null, { licenseExpiration, plan, isActive });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao configurar licença' });
    }
};

/* GET /owner/license-status */
exports.licenseStatus = async (req, res) => {
    try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.json({ valid: true, daysLeft: null, plan: 'PRO' });

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.json({ valid: true, daysLeft: null, plan: 'PRO' });

        if (!tenant.isActive) return res.json({ valid: false, reason: 'Licença inativa' });

        if (!tenant.licenseExpiration) {
            return res.json({ valid: true, daysLeft: null, plan: tenant.plan, brandName: tenant.brandName, primaryColor: tenant.primaryColor });
        }

        const exp = new Date(tenant.licenseExpiration + 'T23:59:59');
        const now = new Date();
        const daysLeft = Math.ceil((exp - now) / 86400000);

        res.json({
            valid: daysLeft > 0,
            daysLeft,
            expiresAt: tenant.licenseExpiration,
            plan: tenant.plan,
            brandName: tenant.brandName,
            primaryColor: tenant.primaryColor,
            warning: daysLeft <= 7 && daysLeft > 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao verificar licença' });
    }
};

