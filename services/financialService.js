const { Reseller, ResellerServer, Client } = require('../models');
const { Op } = require('sequelize');

/**
 * Retorna métricas financeiras completas de todos revendedores do tenant
 * Se ownerId for informado, filtra apenas dados do revendedor dono
 */
async function getFullFinancials(tenantId = null, ownerId = null) {
    const where = tenantId ? { tenantId } : {};
    if (ownerId) where.ownerId = ownerId;

    const clientWhere = tenantId ? { tenantId } : {};
    if (ownerId) clientWhere.resellerId = ownerId;

    const resellers = await Reseller.findAll({
        where,
        include: [{ model: ResellerServer, as: 'servers' }]
    });

    const totalClients = await Client.count({ where: clientWhere });

    let totalRevenue = 0;
    let totalCost    = 0;
    const byServer   = {};
    const byReseller = [];

    for (const r of resellers) {
        let rRevenue = 0, rCost = 0, rAtivos = 0;

        (r.servers || []).forEach(s => {
            const rev = (s.pricePerActive || 0) * (s.activeCount || 0);
            const cst = (s.costPerActive  || 0) * (s.activeCount || 0);
            const profit = rev - cst;

            rRevenue  += rev;
            rCost     += cst;
            rAtivos   += (s.activeCount || 0);
            totalRevenue += rev;
            totalCost    += cst;

            if (!byServer[s.server]) {
                byServer[s.server] = { revenue: 0, cost: 0, profit: 0, ativos: 0 };
            }
            byServer[s.server].revenue += rev;
            byServer[s.server].cost    += cst;
            byServer[s.server].profit  += profit;
            byServer[s.server].ativos  += (s.activeCount || 0);
        });

        byReseller.push({
            id:       r.id,
            name:     r.name,
            type:     r.type,
            status:   r.status,
            revenue:  rRevenue,
            cost:     rCost,
            profit:   rRevenue - rCost,
            ativos:   rAtivos,
            paymentStatus: r.paymentStatus
        });
    }

    // Rankings
    const resellerRanking = [...byReseller]
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

    const serverEntries = Object.entries(byServer).map(([name, v]) => ({ name, ...v }));
    const mostExpensive  = [...serverEntries].sort((a, b) => b.cost - a.cost)[0] || null;
    const mostProfitable = [...serverEntries].sort((a, b) => b.profit - a.profit)[0] || null;

    // Projeção mensal (baseada em valor contratado de clientes diretos)
    const clients = await Client.findAll({ where: clientWhere });
    let projectedRevenue = 0;
    clients.forEach(c => {
        if (c.status === 'ATIVO' && c.planValue && c.planType) {
            projectedRevenue += (c.planValue / c.planType) * 30;
        }
    });

    return {
        totalClients,
        totalResellers:   resellers.length,
        revenue:          totalRevenue,
        cost:             totalCost,
        profit:           totalRevenue - totalCost,
        margin:           totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1) : 0,
        costByServer:     Object.fromEntries(Object.entries(byServer).map(([k, v]) => [k, v.cost])),
        profitByServer:   Object.fromEntries(Object.entries(byServer).map(([k, v]) => [k, v.profit])),
        revenueByServer:  Object.fromEntries(Object.entries(byServer).map(([k, v]) => [k, v.revenue])),
        ativosByServer:   Object.fromEntries(Object.entries(byServer).map(([k, v]) => [k, v.ativos])),
        resellerRanking,
        mostExpensive,
        mostProfitable,
        projectedMonthly: projectedRevenue,
        byReseller,
        serverDetails:    serverEntries
    };
}

/**
 * Retorna lista de clientes vencendo em X dias
 */
async function getExpiringClients(days = 7, tenantId = null) {
    const where = tenantId ? { tenantId } : {};
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(today.getDate() + days);

    return Client.findAll({
        where: {
            ...where,
            status: 'ATIVO',
            dueDate: { [Op.between]: [today, limit] }
        },
        order: [['dueDate', 'ASC']]
    });
}

/**
 * Retorna revendas com acerto vencendo em X dias
 */
async function getExpiringSettles(days = 7, tenantId = null) {
    const where = tenantId ? { tenantId } : {};
    const today = new Date(); today.setHours(0,0,0,0);
    const limit = new Date(today); limit.setDate(today.getDate() + days);

    // Busca nos servidores das revendas (settleDate por servidor)
    const { ResellerServer, Reseller } = require('../models');
    const servers = await ResellerServer.findAll({
        where: {
            ...where,
            settleDate: { [Op.between]: [
                today.toISOString().slice(0,10),
                limit.toISOString().slice(0,10)
            ]}
        },
        include: [{ model: Reseller, as: 'Reseller' }]
    });
    return servers;
}

module.exports = { getFullFinancials, getExpiringClients, getExpiringSettles };
