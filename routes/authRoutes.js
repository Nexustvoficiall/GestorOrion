const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const enforceTenant = require('../middlewares/enforceTenant');

router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);
router.post('/change-username', requireAuth, ctrl.changeUsername);

/* Apenas admin pode criar usuários revendedores */
router.post('/users', requireAuth, requireAdmin, enforceTenant, ctrl.createReseller);
router.get('/users',  requireAuth, requireAdmin, ctrl.listUsers);

module.exports = router;
