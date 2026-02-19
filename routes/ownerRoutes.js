const router = require('express').Router();
const ctrl   = require('../controllers/ownerController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');
const enforceTenant = require('../middlewares/enforceTenant');

router.get('/license-status', ctrl.licenseStatus);                                       // pública
router.get('/',               requireAuth, enforceTenant, ctrl.get);
router.put('/',               requireAuth, requireAdmin, enforceTenant, ctrl.update);
router.post('/license',       requireAuth, requireAdmin, enforceTenant, ctrl.setLicense);

module.exports = router;
