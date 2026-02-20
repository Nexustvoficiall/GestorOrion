const router = require('express').Router();
const controller = require('../controllers/clientController');

router.post('/', controller.create);
router.get('/', controller.list);
router.put('/:id', controller.update);
router.patch('/:id/renew', controller.renew);
router.patch('/:id/status', controller.toggleStatus);

module.exports = router;
