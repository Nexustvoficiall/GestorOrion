const cron = require('node-cron');
const { Client, Reseller, ResellerServer, AuditLog } = require('../models');
const { Op } = require('sequelize');

let _started = false;

function startCronJobs() {
    if (_started) return;
    _started = true;

    console.log('⏰ Cron jobs iniciados');

    /* ==============================================================
       JOB 1: Todo dia às 01:00 — expirar clientes vencidos
       ============================================================== */
    cron.schedule('0 1 * * *', async () => {
        console.log('[CRON] Verificando clientes vencidos...');
        try {
            const now = new Date();
            const expired = await Client.findAll({
                where: {
                    status: 'ATIVO',
                    dueDate: { [Op.lt]: now }
                }
            });

            let count = 0;
            for (const c of expired) {
                await c.update({ status: 'INATIVO' });
                count++;
            }

            if (count > 0) {
                console.log(`[CRON] ${count} clientes marcados como INATIVO por vencimento.`);
                await AuditLog.create({
                    tenantId: null,
                    userId: null,
                    userUsername: 'sistema',
                    action: 'AUTO_EXPIRE_CLIENTS',
                    entity: 'Client',
                    details: JSON.stringify({ count, timestamp: now.toISOString() })
                });
            }
        } catch (err) {
            console.error('[CRON] Erro ao expirar clientes:', err.message);
        }
    });

    /* ==============================================================
       JOB 2: Todo dia às 01:30 — alertar acertos de revenda próximos
       ============================================================== */
    cron.schedule('30 1 * * *', async () => {
        console.log('[CRON] Verificando acertos de revenda...');
        try {
            const today = new Date(); today.setHours(0,0,0,0);
            const limit = new Date(today); limit.setDate(today.getDate() + 3);

            const servers = await ResellerServer.findAll({
                where: {
                    settleDate: {
                        [Op.between]: [
                            today.toISOString().slice(0,10),
                            limit.toISOString().slice(0,10)
                        ]
                    }
                }
            });

            if (servers.length > 0) {
                console.log(`[CRON] ${servers.length} servidores com acerto nos próximos 3 dias.`);
                await AuditLog.create({
                    tenantId: null,
                    userId: null,
                    userUsername: 'sistema',
                    action: 'SETTLE_ALERT',
                    entity: 'ResellerServer',
                    details: JSON.stringify({
                        count: servers.length,
                        servers: servers.map(s => ({ id: s.id, server: s.server, settleDate: s.settleDate }))
                    })
                });
            }
        } catch (err) {
            console.error('[CRON] Erro ao verificar acertos:', err.message);
        }
    });

    /* ==============================================================
       JOB 3: A cada hora — resetar status de pagamento revendas pagas
       no dia seguinte ao acerto (pagamento vira PENDENTE novo ciclo)
       ============================================================== */
    cron.schedule('0 * * * *', async () => {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = yesterday.toISOString().slice(0,10);

            // Servidores que tinham acerto ontem e a revenda está PAGA
            const toReset = await ResellerServer.findAll({
                where: { settleDate: yStr },
                include: [{ model: Reseller, as: 'Reseller' }]
            });

            for (const s of toReset) {
                if (s.Reseller && s.Reseller.paymentStatus === 'PAGO') {
                    await s.Reseller.update({ paymentStatus: 'PENDENTE' });
                    console.log(`[CRON] Revenda "${s.Reseller.name}" resetada para PENDENTE (novo ciclo)`);
                }
            }
        } catch (err) {
            console.error('[CRON] Erro ao resetar pagamentos:', err.message);
        }
    });

    /* ==============================================================
       JOB 4: Todo dia às 02:00 — expirar planos mensais de revenda
       ============================================================== */
    cron.schedule('0 2 * * *', async () => {
        console.log('[CRON] Verificando planos mensais de revenda...');
        try {
            const today = new Date().toISOString().slice(0, 10);
            const expired = await Reseller.findAll({
                where: {
                    planActive: true,
                    planExpiresAt: { [Op.lt]: today }
                }
            });
            let count = 0;
            for (const r of expired) {
                await r.update({ planActive: false });
                count++;
            }
            if (count > 0) {
                console.log(`[CRON] ${count} planos de revenda expirados.`);
                await AuditLog.create({
                    tenantId: null,
                    userId: null,
                    userUsername: 'sistema',
                    action: 'AUTO_EXPIRE_RESELLER_PLANS',
                    entity: 'Reseller',
                    details: JSON.stringify({ count, date: today })
                });
            }
        } catch (err) {
            console.error('[CRON] Erro ao expirar planos de revenda:', err.message);
        }
    });
}

module.exports = { startCronJobs };
