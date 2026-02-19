/**
 * routes/tenantRoutes.js
 * Rotas pra o tenant admin gerenciar seus próprios dados de branding/licença.
 */
const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const enforceTenant = require('../middlewares/enforceTenant');
const ctrl = require('../controllers/tenantController');

// Tenant admin vê / atualiza seus próprios dados
router.get('/me',  requireAuth, ctrl.getMyTenant);
router.put('/me',  requireAuth, requireAdmin, ctrl.updateMyTenant);

module.exports = router;
