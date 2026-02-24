const router = require('express').Router();
const { AuditLog } = require('../models');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

/* GET /audit — lista logs (admin e master) */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(Number(req.query.limit) || 100, 500);
        const offset = Number(req.query.offset) || 0;
        const { role, tenantId } = req.session?.user || {};

        // Master vê logs de qualquer tenant; admin vê apenas logs do seu tenant
        const where = (role === 'master') ? {} : (tenantId ? { tenantId } : {});

        const logs = await AuditLog.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
});

module.exports = router;
