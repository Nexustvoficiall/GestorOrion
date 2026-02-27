/**
 * controllers/masterController.js
 * Operações exclusivas do master (super admin)
 */
const { Tenant, PaymentOrder, ClientPayment } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /master/revenue
 * Retorna estatísticas de receita: MRR, total pago, total pendente
 */
exports.getRevenue = async (req, res) => {
    try {
        // Evita que non-master acesse
        if (req.session?.user?.role !== 'master') {
            return res.status(403).json({ error: 'Acesso restrito ao master' });
        }

        const now = new Date();
        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Total de tenants ativos
        const tenantCount = await Tenant.count({ where: { isActive: true } });

        // Receita de pagamentos de plano do próprio painel (PaymentOrder)
        const paidOrders = await PaymentOrder.findAll({
            where: {
                status: 'PAID',
                createdAt: { [Op.gte]: currentMonth, [Op.lt]: nextMonth }
            }
        });

        const totalPlanRevenue = paidOrders.reduce((sum, order) => sum + (order.amount / 100), 0);

        // Todos os PaymentOrder pendentes ou pagos
        const allPaymentOrders = await PaymentOrder.findAll({
            attributes: ['id', 'amount', 'status', 'createdAt']
        });

        const totalPlanRevenuePaid = allPaymentOrders
            .filter(o => o.status === 'PAID')
            .reduce((sum, o) => sum + (o.amount / 100), 0);

        const totalPlanRevenuePending = allPaymentOrders
            .filter(o => o.status === 'PENDING')
            .reduce((sum, o) => sum + (o.amount / 100), 0);

        // Receita de cobranças de clientes geradas por tenants
        const allClientPayments = await ClientPayment.findAll({
            attributes: ['id', 'amount', 'status', 'createdAt']
        });

        const totalClientRevenuePaid = allClientPayments
            .filter(p => p.status === 'PAID')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        const totalClientRevenuePending = allClientPayments
            .filter(p => p.status === 'PENDING')
            .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        // MRR estimado (média móvel de planos)
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const recentOrders = await PaymentOrder.findAll({
            where: {
                status: 'PAID',
                createdAt: { [Op.gte]: threeMonthsAgo }
            }
        });
        const estimatedMRR = recentOrders.length > 0 
            ? recentOrders.reduce((sum, o) => sum + (o.amount / 100), 0) / 3 
            : 0;

        res.json({
            ok: true,
            stats: {
                tenantCount,
                // Receita de plano (painel do próprio Gestor Orion)
                planRevenue: {
                    paidThisMonth: totalPlanRevenue,
                    totalPaid: totalPlanRevenuePaid,
                    totalPending: totalPlanRevenuePending
                },
                // Receita de cobranças de clientes (passa por tenants)
                clientRevenue: {
                    totalPaid: totalClientRevenuePaid,
                    totalPending: totalClientRevenuePending
                },
                // MRR estimado (média móvel 3 meses)
                estimatedMRR: Math.round(estimatedMRR * 100) / 100,
                // Grand total
                totalRevenuePaid: totalPlanRevenuePaid + totalClientRevenuePaid,
                totalRevenuePending: totalPlanRevenuePending + totalClientRevenuePending
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar receita' });
    }
};

/**
 * GET /master/revenue/by-plan
 * Retorna breakdown de receita por plano
 */
exports.getRevenueByPlan = async (req, res) => {
    try {
        if (req.session?.user?.role !== 'master') {
            return res.status(403).json({ error: 'Acesso restrito ao master' });
        }

        const orders = await PaymentOrder.findAll({
            where: { status: 'PAID' },
            attributes: ['plan', 'amount', 'createdAt']
        });

        const byPlan = {};
        orders.forEach(o => {
            if (!byPlan[o.plan]) {
                byPlan[o.plan] = { count: 0, total: 0 };
            }
            byPlan[o.plan].count++;
            byPlan[o.plan].total += o.amount / 100;
        });

        res.json({ ok: true, byPlan });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar receita por plano' });
    }
};

module.exports = exports;
