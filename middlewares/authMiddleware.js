const { AuditLog } = require('../models');

/* Protege rotas: requer sessão autenticada */
exports.requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }
    req.currentUser = req.session.user;
    next();
};

/* Apenas admin do tenant */
exports.requireAdmin = (req, res, next) => {
    const role = req.session?.user?.role;
    if (!role || !['admin', 'master'].includes(role)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
};

/* Apenas master (super admin do SaaS) */
exports.requireMaster = (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'master') {
        return res.status(403).json({ error: 'Acesso restrito ao master' });
    }
    next();
};

/* Helper: registrar ação no audit log */
exports.audit = async (req, action, entity, entityId, details) => {
    try {
        const user = req.session?.user;
        await AuditLog.create({
            tenantId:     user?.tenantId || null,
            userId:       user?.id || null,
            userUsername: user?.username || 'sistema',
            action,
            entity:       entity || null,
            entityId:     entityId || null,
            details:      details ? JSON.stringify(details) : null,
            ip:           req.ip || req.connection?.remoteAddress || null
        });
    } catch (e) {
        console.error('Audit log error:', e.message);
    }
};
