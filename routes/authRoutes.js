const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const enforceTenant = require('../middlewares/enforceTenant');
const rateLimit = require('express-rate-limit');

/* Rate limit: máx 10 tentativas de login por IP em 15 min */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/login',           loginLimiter, ctrl.login);
router.post('/logout',          ctrl.logout);
router.get('/me',               ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);
router.post('/change-username', requireAuth, ctrl.changeUsername);
router.post('/first-login-done',requireAuth, ctrl.markFirstLoginDone);

/* Reset de senha por token (público) */
router.post('/reset-by-token',  ctrl.resetByToken);

/* Admin gera link de reset para um usuário */
router.post('/users/:userId/reset-token', requireAuth, requireAdmin, enforceTenant, ctrl.generateResetToken);

/* Apenas admin pode criar/listar/excluir usuários */
router.post('/users', requireAuth, requireAdmin, enforceTenant, ctrl.createReseller);
router.get('/users',  requireAuth, requireAdmin, ctrl.listUsers);
router.delete('/users/:userId', requireAuth, requireAdmin, enforceTenant, ctrl.deleteUser);

/* Preferências pessoais — tema de cor e logo (qualquer usuário autenticado) */
router.get('/preferences',  requireAuth, ctrl.getPreferences);
router.put('/preferences',  requireAuth, ctrl.savePreferences);

module.exports = router;
