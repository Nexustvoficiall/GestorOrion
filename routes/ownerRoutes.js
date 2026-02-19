const router = require('express').Router();
const ctrl   = require('../controllers/ownerController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

router.get('/license-status', ctrl.licenseStatus);           // pública — usada pelo dashboard
router.get('/',               requireAuth, ctrl.get);
router.put('/',               requireAuth, requireAdmin, ctrl.update);
router.post('/license',       requireAuth, requireAdmin, ctrl.setLicense);

module.exports = router;
