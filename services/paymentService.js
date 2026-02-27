/**
 * services/paymentService.js
 * Integração com Mercado Pago para processamento de pagamentos
 *
 * Variáveis de ambiente necessárias:
 *   MERCADOPAGO_ACCESS_TOKEN  ex: APP_123456789...
 */
const axios = require('axios');

const MP_API = 'https://api.mercadopago.com/v1';
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;

/**
 * Cria uma preferência de pagamento no Mercado Pago (checkout)
 * Retorna a URL do checkout
 */
async function createCheckoutPreference(tenantId, plan, amount, externalRef) {
    if (!MP_TOKEN) {
        throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    try {
        const preference = {
            items: [
                {
                    title: `Plano ${plan} — Gestor Orion`,
                    unit_price: amount / 100, // Convertendo de centavos para reais
                    quantity: 1,
                    currency_id: 'BRL'
                }
            ],
            payer: {
                email: `tenant_${tenantId}@gestororion.local`
            },
            external_reference: externalRef,
            back_urls: {
                success: `${process.env.APP_URL || 'https://gestororion-production.up.railway.app'}/payment-success?ref=${externalRef}`,
                failure: `${process.env.APP_URL || 'https://gestororion-production.up.railway.app'}/payment-failed`,
                pending: `${process.env.APP_URL || 'https://gestororion-production.up.railway.app'}/payment-pending`
            },
            auto_return: 'approved'
        };

        const response = await axios.post(`${MP_API}/checkout/preferences`, preference, {
            headers: { Authorization: `Bearer ${MP_TOKEN}` }
        });

        return response.data.init_point; // URL do checkout
    } catch (err) {
        console.error('[paymentService] createCheckoutPreference error:', err.message);
        throw err;
    }
}

/**
 * Cria um pedido PIX (para recebimento manual)
 * Gera um ID de transação e código para o admin cobrar
 */
function createPixOrder(tenantId, plan, amount, externalRef) {
    const pixId = `PIX_${tenantId}_${Date.now()}`;
    
    return {
        pixId,
        tenantId,
        plan,
        amount,
        amountFormatted: (amount / 100).toFixed(2),
        externalRef,
        createdAt: new Date().toISOString(),
        status: 'PENDING'
    };
}

/**
 * Verifica status de uma transação no Mercado Pago
 */
async function getPaymentStatus(paymentId) {
    if (!MP_TOKEN) {
        throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado');
    }

    try {
        const response = await axios.get(`${MP_API}/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${MP_TOKEN}` }
        });

        return response.data.status; // approved, pending, rejected, etc
    } catch (err) {
        console.error('[paymentService] getPaymentStatus error:', err.message);
        throw err;
    }
}

module.exports = {
    createCheckoutPreference,
    createPixOrder,
    getPaymentStatus,
    MP_API,
    MP_TOKEN: () => MP_TOKEN
};
