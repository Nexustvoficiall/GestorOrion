/**
 * routes/clientPaymentRoutes.js
 * Rotas para gerenciar cobranças de clientes
 */
const router = require('express').Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const enforceTenant = require('../middlewares/enforceTenant');
const ctrl = require('../controllers/clientPaymentController');

// Criar cobrança (autenticado, tenant isolado)
router.post('/create', requireAuth, enforceTenant, ctrl.createPayment);

// Listar cobranças de um cliente (autenticado, tenant isolado)
router.get('/:clientId', requireAuth, enforceTenant, ctrl.listByClient);

// Cancelar cobrança (autenticado, tenant isolado)
router.put('/:paymentId/cancel', requireAuth, enforceTenant, ctrl.cancelPayment);

module.exports = router;
