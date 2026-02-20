const router = require('express').Router();
const ctrl   = require('../controllers/renewalController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/prices',              requireAuth, ctrl.getPrices);
router.get('/prices/config',       requireAuth, ctrl.getPricesConfig);
router.post('/prices/config',      requireAuth, ctrl.savePricesConfig);
router.post('/prices',             requireAuth, ctrl.savePrices);
router.post('/',            requireAuth, ctrl.requestRenewal);
router.get('/my',           requireAuth, ctrl.getMyRequests);
router.get('/all',          requireAuth, ctrl.getAllRequests);
router.post('/:id/approve', requireAuth, ctrl.approveRequest);
router.post('/:id/reject',  requireAuth, ctrl.rejectRequest);

module.exports = router;
