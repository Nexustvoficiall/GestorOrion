const router = require('express').Router();
const controller = require('../controllers/reportController');
const exportCtrl = require('../controllers/exportController');

router.get('/', controller.summary);

/* Exportação — GET /report/export?format=xlsx&month=1&year=2026 */
router.get('/export', (req, res) => {
    if (req.query.format === 'pdf') return exportCtrl.exportPdf(req, res);
    return exportCtrl.exportExcel(req, res);
});

module.exports = router;
