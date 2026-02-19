/**
 * Middleware de isolamento multi-tenant.
 * Injeta req.tenantId a partir da sessão autenticada.
 * NUNCA aceita tenantId do body/query do frontend.
 */
const { Tenant } = require('../models');

module.exports = async function enforceTenant(req, res, next) {
    const user = req.session?.user;

    if (!user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // Master: usa o tenantId salvo na sessão ou busca o primeiro tenant
    if (user.role === 'master') {
        // Se já escolheu um tenant para gerenciar (salvo na sessão)
        if (user.activeTenantId) {
            req.tenantId = user.activeTenantId;
            req.isMaster = true;
            return next();
        }
        // Caso contrário, usa o primeiro tenant disponível
        try {
            const first = await Tenant.findOne({ order: [['createdAt', 'ASC']] });
            if (first) {
                req.tenantId = first.id;
                req.isMaster = true;
                return next();
            }
        } catch (e) { /* ignorar erro de lookup */ }
        req.tenantId = null;
        req.isMaster = true;
        return next();
    }

    if (!user.tenantId) {
        return res.status(403).json({ error: 'Tenant não identificado na sessão' });
    }

    req.tenantId = user.tenantId;
    next();
};
