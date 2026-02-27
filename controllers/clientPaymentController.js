/**
 * controllers/clientPaymentController.js
 * Gerenciamento de cobranças para clientes
 */
const { Client, ClientPayment, Tenant } = require('../models');
const paymentService = require('../services/paymentService');
const { audit } = require('../middlewares/authMiddleware');
const axios = require('axios');

/**
 * POST /client-payments/create
 * Gera uma cobrança para um cliente (PIX ou Mercado Pago)
 */
exports.createPayment = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Acesso restrito a tenant admin' });

        const { clientId, amount, description, dueDate } = req.body;
        if (!clientId || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Campos obrigatórios: clientId, amount' });
        }

        // Verifica se o cliente pertence ao tenant
        const client = await Client.findOne({
            where: { id: clientId, tenantId }
        });
        if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

        // Carrega configurações de pagamento do tenant
        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        let method;
        let paymentData = {
            tenantId,
            clientId,
            amount: parseFloat(amount),
            description: description || `Cobrança para ${client.name}`,
            dueDate: dueDate || null,
            status: 'PENDING'
        };

        // Prioridade: Mercado Pago, depois PIX, depois erro
        if (tenant.mercadoPagoAccessToken) {
            method = 'mercadopago';
            try {
                const preferences = {
                    items: [
                        {
                            title: paymentData.description,
                            unit_price: parseFloat(amount),
                            quantity: 1,
                            currency_id: 'BRL'
                        }
                    ],
                    payer: {
                        email: client.email || `cliente_${client.id}@gestororion.local`
                    },
                    external_reference: `CPAY_${clientId}_${Date.now()}`,
                    back_urls: {
                        success: `${process.env.APP_URL || 'https://gestororion-production.up.railway.app'}/payment-success`,
                        failure: `${process.env.APP_URL || 'https://gestororion-production.up.railway.app'}/payment-failed`
                    }
                };

                const mpRes = await axios.post('https://api.mercadopago.com/v1/checkout/preferences', preferences, {
                    headers: { Authorization: `Bearer ${tenant.mercadoPagoAccessToken}` }
                });

                paymentData.method = 'mercadopago';
                paymentData.mercadoPagoPreferenceId = mpRes.data.id;
                paymentData.mercadoPagoCheckoutUrl = mpRes.data.init_point;
            } catch (err) {
                return res.status(500).json({ error: 'Erro ao criar checkout Mercado Pago: ' + err.message });
            }
        } else if (tenant.pixKey) {
            method = 'pix';
            // Gera um código PIX mock (em produção, integraria com API Pix/QR Code)
            paymentData.method = 'pix';
            paymentData.pixCode = tenant.pixKey;
        } else {
            return res.status(400).json({ error: 'Nenhum método de pagamento configurado. Acesse Configurações de Pagamento.' });
        }

        // Salva a cobrança
        const payment = await ClientPayment.create(paymentData);

        await audit(req, 'CREATE_CLIENT_PAYMENT', 'ClientPayment', payment.id, { clientId, amount, method });

        res.json({
            ok: true,
            paymentId: payment.id,
            method,
            checkoutUrl: payment.mercadoPagoCheckoutUrl || null,
            pixCode: payment.pixCode || null,
            message: method === 'mercadopago' ? 'Checkout Mercado Pago gerado' : 'Código PIX gerado'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar cobrança: ' + err.message });
    }
};

/**
 * GET /client-payments/:clientId
 * Lista cobranças de um cliente
 */
exports.listByClient = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Acesso restrito a tenant admin' });

        const { clientId } = req.params;

        const payments = await ClientPayment.findAll({
            where: { tenantId, clientId },
            order: [['createdAt', 'DESC']]
        });

        res.json(payments);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar cobranças' });
    }
};

/**
 * PUT /client-payments/:paymentId/cancel
 * Cancela uma cobrança
 */
exports.cancelPayment = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Acesso restrito a tenant admin' });

        const { paymentId } = req.params;

        const payment = await ClientPayment.findOne({
            where: { id: paymentId, tenantId }
        });
        if (!payment) return res.status(404).json({ error: 'Cobrança não encontrada' });

        if (payment.status === 'PAID') {
            return res.status(400).json({ error: 'Não é possível cancelar cobrança já paga' });
        }

        await payment.update({ status: 'CANCELLED' });
        await audit(req, 'CANCEL_CLIENT_PAYMENT', 'ClientPayment', paymentId, {});

        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao cancelar cobrança' });
    }
};

module.exports = exports;
