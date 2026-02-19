/**
 * Middleware de isolamento multi-tenant.
 * Injeta req.tenantId a partir da sessão autenticada.
 * NUNCA aceita tenantId do body/query do frontend.
 */
module.exports = function enforceTenant(req, res, next) {
    const user = req.session?.user;

    if (!user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    // Usuário master não tem tenant — ignorar esse middleware em rotas de master
    if (user.role === 'master') {
        req.tenantId = null;
        return next();
    }

    if (!user.tenantId) {
        return res.status(403).json({ error: 'Tenant não identificado na sessão' });
    }

    req.tenantId = user.tenantId;
    next();
};
