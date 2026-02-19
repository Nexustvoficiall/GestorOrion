const router = require('express').Router();
const controller = require('../controllers/clientController');

router.post('/', controller.create);
router.get('/', controller.list);
router.patch('/:id/status', controller.toggleStatus);

module.exports = router;
