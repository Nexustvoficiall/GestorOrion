/**
 * routes/masterRoutes.js
 * Rotas exclusivas do super admin (master) do SaaS.
 * Requerem role === 'master'.
 */
const router = require('express').Router();
const { requireAuth, requireMaster } = require('../middlewares/authMiddleware');
const tenantCtrl = require('../controllers/tenantController');
const masterCtrl = require('../controllers/masterController');

router.use(requireAuth, requireMaster);

// Gerenciamento de tenants
router.get('/tenants',      tenantCtrl.list);
router.post('/tenants',     tenantCtrl.create);
router.get('/tenants/:id',  tenantCtrl.getById);
router.put('/tenants/:id',  tenantCtrl.update);
router.delete('/tenants/:id', tenantCtrl.deactivate);

// Receita e estatísticas
router.get('/revenue',      masterCtrl.getRevenue);
router.get('/revenue/by-plan', masterCtrl.getRevenueByPlan);

module.exports = router;
