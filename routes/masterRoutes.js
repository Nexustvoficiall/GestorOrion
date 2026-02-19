/**
 * routes/masterRoutes.js
 * Rotas exclusivas do super admin (master) do SaaS.
 * Requerem role === 'master'.
 */
const router = require('express').Router();
const { requireAuth, requireMaster } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/tenantController');

router.use(requireAuth, requireMaster);

router.get('/tenants',      ctrl.list);
router.post('/tenants',     ctrl.create);
router.get('/tenants/:id',  ctrl.getById);
router.put('/tenants/:id',  ctrl.update);
router.delete('/tenants/:id', ctrl.deactivate);

module.exports = router;
