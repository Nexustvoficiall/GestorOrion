/**
 * routes/paymentRoutes.js
 * Rotas de pagamento e renovação de licença
 */
const router = require('express').Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const ctrl = require('../controllers/paymentController');

// Criar ordem de pagamento (autenticado)
router.post('/create-order', requireAuth, ctrl.createOrder);

// Webhooks (públicos, sem autenticação)
router.post('/webhook/mercadopago', ctrl.webhookMercadoPago);

// Páginas de retorno (públicas)
router.get('/success', ctrl.paymentSuccess);
router.get('/failure', ctrl.paymentFailed);

module.exports = router;
