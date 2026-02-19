const router = require('express').Router();
const { AuditLog } = require('../models');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

/* GET /audit — lista logs (admin only) */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const limit  = Math.min(Number(req.query.limit) || 100, 500);
        const offset = Number(req.query.offset) || 0;
        const logs = await AuditLog.findAll({
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
