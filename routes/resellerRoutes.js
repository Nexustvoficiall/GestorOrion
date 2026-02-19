const router = require('express').Router();
const controller = require('../controllers/resellerController');

router.post('/', controller.create);
router.get('/', controller.list);
router.put('/:id', controller.update);
router.patch('/:id/payment', controller.updatePayment);
router.patch('/:id/status', controller.toggleStatus);
router.patch('/:id/plan', controller.setPlan);
router.delete('/:id', controller.remove);

module.exports = router;
