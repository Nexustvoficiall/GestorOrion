const router = require('express').Router();
const { ResellerServer } = require('../models');

router.get('/', async (req, res) => {
    try {
        const data = await ResellerServer.findAll();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar servidores de revenda' });
    }
});

module.exports = router;
