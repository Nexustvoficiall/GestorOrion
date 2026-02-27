/**
 * controllers/paymentController.js
 * Gerenciamento de pagamentos e renovação de licenças
 */
const { Tenant, PaymentOrder } = require('../models');
const paymentService = require('../services/paymentService');
const emailService = require('../services/emailService');
const { audit } = require('../middlewares/authMiddleware');

/**
 * POST /payment/validate-mercadopago-token
 * Valida se o token do Mercado Pago é válido
 */
exports.validateMercadoPagoToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token é obrigatório' });

        // Tenta fazer uma chamada simples à API do Mercado Pago para validar
        try {
            await axios.get('https://api.mercadopago.com/v1/users/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            res.json({ ok: true, valid: true });
        } catch (err) {
            res.json({ ok: true, valid: false, message: 'Token inválido ou expirado' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao validar token' });
    }
};

/**
 * POST /payment/create-order
 * Cria um novo pedido de pagamento (PIX ou Cartão)
 */
exports.createOrder = async (req, res) => {
    try {
        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return res.status(403).json({ error: 'Acesso restrito a tenant admin' });

        const { plan, amount, method } = req.body;
        if (!plan || !amount || !method) {
            return res.status(400).json({ error: 'Campos obrigatórios: plan, amount, method' });
        }

        if (!['PESSOAL', 'REVENDA'].includes(plan)) {
            return res.status(400).json({ error: 'Plano inválido' });
        }

        const tenant = await Tenant.findByPk(tenantId);
        if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

        const externalRef = `ORN_${tenantId}_${Date.now()}`;

        let result;

        if (method === 'card') {
            // Criar preferência de checkout no Mercado Pago
            try {
                const checkoutUrl = await paymentService.createCheckoutPreference(
                    tenantId,
                    plan,
                    amount,
                    externalRef
                );

                // Registra o pedido no banco
                if (PaymentOrder) {
                    await PaymentOrder.create({
                        tenantId,
                        externalRef,
                        plan,
                        amount,
                        method: 'card',
                        status: 'PENDING'
                    });
                }

                result = { ok: true, checkoutUrl };
            } catch (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erro ao criar checkout: ' + err.message });
            }
        } else if (method === 'pix') {
            // Gerar código PIX
            const pixOrder = paymentService.createPixOrder(tenantId, plan, amount, externalRef);

            // Registra o pedido no banco
            if (PaymentOrder) {
                await PaymentOrder.create({
                    tenantId,
                    externalRef,
                    plan,
                    amount,
                    method: 'pix',
                    status: 'PENDING',
                    pixId: pixOrder.pixId
                });
            }

            // Envia e-mail com instruções e código PIX
            const admin = await tenant.getUsers({ where: { role: 'admin' } });
            if (admin && admin[0] && admin[0].email) {
                // Enviar e-mail com instruções do PIX
                const emailHtml = `
                    <html><head><style>
                        body { background:#0a0a12; color:#ccc; font-family:'Segoe UI',monospace; }
                        .box { max-width:500px; margin:40px auto; background:#181818; border:1px solid #2a2a3c; border-radius:12px; padding:24px; }
                        .head { padding:16px; background:#1a1a2e; border-bottom:3px solid #1a6fff; border-radius:8px; margin-bottom:16px; }
                        .code { background:#0a0a12; border:1px solid #333; padding:16px; border-radius:8px; font-family:monospace; font-size:12px; text-align:center; color:#ffeb3b; word-break:break-all; margin:16px 0; }
                        .btn { display:inline-block; background:#1a6fff; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px; }
                    </style></head><body>
                    <div class="box">
                        <div class="head"><h2>Pagamento PIX — Gestor Orion</h2></div>
                        <p>Olá! Seu pagamento está aguardando.</p>
                        <p><strong>Plano:</strong> ${plan}<br><strong>Valor:</strong> R$ ${(amount/100).toFixed(2)}</p>
                        <p>Copie o código PIX abaixo e cole no seu banco:</p>
                        <div class="code">${pixOrder.pixId}</div>
                        <p style="font-size:12px; color:#666;">Após pagar, seu acesso será ativado automaticamente em até 5 minutos.</p>
                    </div>
                    </body></html>
                `;
            }

            result = { ok: true, pixCopy: pixOrder.pixId, message: 'Código PIX gerado' };
        } else {
            return res.status(400).json({ error: 'Método de pagamento inválido' });
        }

        await audit(req, 'CREATE_PAYMENT_ORDER', 'PaymentOrder', externalRef, { plan, method, amount });
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar pedido de pagamento' });
    }
};

/**
 * POST /payment/webhook/mercadopago
 * Webhook chamado pelo Mercado Pago quando um pagamento é confirmado
 */
exports.webhookMercadoPago = async (req, res) => {
    try {
        const { data, action } = req.body;

        if (action !== 'payment.created' && action !== 'payment.updated') {
            return res.json({ received: true });
        }

        const paymentId = data?.id;
        if (!paymentId) return res.json({ received: true });

        // Buscar o pedido no banco
        if (!PaymentOrder) return res.json({ received: true });

        const order = await PaymentOrder.findOne({
            where: { externalRef: req.body.external_reference || `temp_${paymentId}` }
        });

        if (!order) return res.json({ received: true });

        // Verificar status do pagamento
        try {
            const status = await paymentService.getPaymentStatus(paymentId);
            if (status === 'approved') {
                await order.update({ status: 'PAID', paymentId });
                
                // Renovar licença do tenant
                const tenant = await Tenant.findByPk(order.tenantId);
                if (tenant) {
                    const newExpiration = new Date();
                    newExpiration.setDate(newExpiration.getDate() + 30); // +30 dias
                    await tenant.update({
                        plan: order.plan,
                        licenseExpiration: newExpiration,
                        trialEndsAt: null // Remove trial se houver
                    });

                    console.log(`✅ Tenant ${order.tenantId} renovado para plano ${order.plan}`);
                }
            }
        } catch (err) {
            console.error('[webhook] error checking status:', err.message);
        }

        res.json({ received: true });
    } catch (err) {
        console.error(err);
        res.json({ received: true });
    }
};

/**
 * GET /payment-success
 * Página de sucesso após pagamento via cartão
 */
exports.paymentSuccess = (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Pagamento Aprovado — Gestor Orion</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a12;color:#fff;font-family:'Segoe UI',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;padding:50px;border:1px solid #00cc66;max-width:500px;background:#001a00;border-radius:12px}
    .icon{font-size:80px;margin-bottom:20px}
    h1{color:#44ff88;font-size:22px;letter-spacing:2px;margin-bottom:12px}
    p{color:#aaa;font-size:14px;line-height:1.8;margin-bottom:8px}
    a{color:#44ff88;text-decoration:none;font-size:14px;display:block;margin-top:24px;letter-spacing:1px}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✅</div>
    <h1>PAGAMENTO APROVADO</h1>
    <p>Seu pagamento foi processado com sucesso.</p>
    <p>Seu painel está <strong>ativado</strong> e pronto para usar.</p>
    <a href="/dashboard">← Voltar ao Painel</a>
  </div>
</body>
</html>`);
};

/**
 * GET /payment-failed
 * Página de falha de pagamento
 */
exports.paymentFailed = (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Pagamento Falhou — Gestor Orion</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0a12;color:#fff;font-family:'Segoe UI',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;padding:50px;border:1px solid #ff2222;max-width:500px;background:#110000;border-radius:12px}
    .icon{font-size:80px;margin-bottom:20px}
    h1{color:#ff4444;font-size:22px;letter-spacing:2px;margin-bottom:12px}
    p{color:#aaa;font-size:14px;line-height:1.8;margin-bottom:8px}
    a{color:#ff4444;text-decoration:none;font-size:14px;display:block;margin-top:24px;letter-spacing:1px}
    a:hover{text-decoration:underline}
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">❌</div>
    <h1>PAGAMENTO FALHOU</h1>
    <p>Não conseguimos processar seu pagamento.</p>
    <p>Por favor, tente novamente ou entre em contato com o suporte.</p>
    <a href="/checkout">← Tentar Novamente</a>
  </div>
</body>
</html>`);
};

module.exports = exports;
