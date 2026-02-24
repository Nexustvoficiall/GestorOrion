/**
 * controllers/exportController.js
 * Exporta relatório financeiro como PDF ou Excel
 */
const { Client, Reseller, ResellerServer } = require('../models');
const { getFullFinancials } = require('../services/financialService');

/* ===================== EXCEL ===================== */
exports.exportExcel = async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const tenantId   = req.tenantId;
        const sessionUser = req.session?.user;
        const userId  = sessionUser?.id || null;
        const isMaster = sessionUser?.role === 'master';
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year  = req.query.year  ? parseInt(req.query.year)  : null;
        const period = (month && year) ? { month, year } : null;

        const data = await getFullFinancials(tenantId, userId, isMaster, period);

        const wb = new ExcelJS.Workbook();
        wb.creator = 'Gestor Orion';
        wb.created = new Date();

        /* ── Aba: Resumo ── */
        const wsRes = wb.addWorksheet('Resumo');
        wsRes.columns = [
            { header: 'Indicador', key: 'ind', width: 30 },
            { header: 'Valor', key: 'val', width: 20 }
        ];
        const headerRow = wsRes.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6FFF' } };
        headerRow.alignment = { horizontal: 'center' };

        const fmt = v => `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
        const periodLabel = period ? `${String(month).padStart(2,'0')}/${year}` : 'Geral';

        wsRes.addRow({ ind: 'Período', val: periodLabel });
        wsRes.addRow({ ind: 'Receita Total', val: fmt(data.revenue?.total) });
        wsRes.addRow({ ind: 'Custo Total', val: fmt(data.costs?.total) });
        wsRes.addRow({ ind: 'Lucro Líquido', val: fmt(data.profit) });
        wsRes.addRow({ ind: 'Clientes Ativos', val: data.clients?.active ?? 0 });
        wsRes.addRow({ ind: 'Clientes Expirados', val: data.clients?.expired ?? 0 });
        wsRes.addRow({ ind: 'Total de Clientes', val: data.clients?.total ?? 0 });

        /* ── Aba: Clientes ── */
        const clients = await Client.findAll({
            where: { tenantId, ...(isMaster ? {} : { userId }) },
            order: [['dueDate', 'ASC']]
        });

        const wsCli = wb.addWorksheet('Clientes');
        wsCli.columns = [
            { header: 'Nome', key: 'name', width: 25 },
            { header: 'Usuário', key: 'username', width: 20 },
            { header: 'Servidor', key: 'server', width: 20 },
            { header: 'App', key: 'app', width: 15 },
            { header: 'Plano (dias)', key: 'planType', width: 14 },
            { header: 'Valor (R$)', key: 'planValue', width: 14 },
            { header: 'Vencimento', key: 'dueDate', width: 16 },
            { header: 'Status', key: 'status', width: 12 },
        ];
        const cliHeader = wsCli.getRow(1);
        cliHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cliHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6FFF' } };

        const today = new Date(); today.setHours(0,0,0,0);
        clients.forEach(c => {
            const due = c.dueDate ? new Date(c.dueDate) : null;
            const status = c.status === 'INATIVO' ? 'INATIVO'
                : (due && due < today ? 'EXPIRADO' : 'ATIVO');
            wsCli.addRow({
                name:      c.name || '',
                username:  c.username || '',
                server:    c.server || '',
                app:       c.app || '',
                planType:  c.planType || '',
                planValue: Number(c.planValue) || 0,
                dueDate:   due ? due.toLocaleDateString('pt-BR') : '',
                status
            });
        });

        /* ── Aba: Revendas ── */
        const resellers = await Reseller.findAll({
            where: { tenantId },
            include: [{ association: 'servers', required: false }]
        });
        const wsRev = wb.addWorksheet('Revendas');
        wsRev.columns = [
            { header: 'Revenda', key: 'name', width: 25 },
            { header: 'Servidor', key: 'server', width: 20 },
            { header: 'Ativos', key: 'active', width: 10 },
            { header: 'Preço Venda', key: 'price', width: 14 },
            { header: 'Custo', key: 'cost', width: 14 },
            { header: 'Receita', key: 'revenue', width: 14 },
        ];
        const revHeader = wsRev.getRow(1);
        revHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        revHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A6FFF' } };

        resellers.forEach(r => {
            (r.servers || []).forEach(s => {
                wsRev.addRow({
                    name:    r.name,
                    server:  s.server,
                    active:  s.activeCount || 0,
                    price:   Number(s.pricePerActive) || 0,
                    cost:    Number(s.costPerActive) || 0,
                    revenue: (Number(s.pricePerActive) || 0) * (s.activeCount || 0),
                });
            });
            if (!r.servers || r.servers.length === 0) {
                wsRev.addRow({ name: r.name, server: '-', active: 0, price: 0, cost: 0, revenue: 0 });
            }
        });

        const fileName = `relatorio-orion-${periodLabel.replace('/','-')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('[exportExcel]', err);
        res.status(500).json({ error: 'Erro ao gerar Excel: ' + err.message });
    }
};

/* ===================== PDF ===================== */
exports.exportPdf = async (req, res) => {
    try {
        const PDFDocument = require('pdfkit');
        const tenantId   = req.tenantId;
        const sessionUser = req.session?.user;
        const userId  = sessionUser?.id || null;
        const isMaster = sessionUser?.role === 'master';
        const month = req.query.month ? parseInt(req.query.month) : null;
        const year  = req.query.year  ? parseInt(req.query.year)  : null;
        const period = (month && year) ? { month, year } : null;
        const periodLabel = period ? `${String(month).padStart(2,'0')}/${year}` : 'Geral';

        const data = await getFullFinancials(tenantId, userId, isMaster, period);
        const clients = await Client.findAll({
            where: { tenantId, ...(isMaster ? {} : { userId }) },
            order: [['dueDate', 'ASC']]
        });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const fileName = `relatorio-orion-${periodLabel.replace('/','-')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        doc.pipe(res);

        const BLU = '#1a6fff';
        const GRY = '#888888';
        const W = 495; // largura útil

        /* Cabeçalho */
        doc.rect(50, 50, W, 56).fill(BLU);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20)
           .text('GESTOR ORION', 70, 63);
        doc.fillColor('#ccddff').font('Helvetica').fontSize(10)
           .text(`Relatório Financeiro — Período: ${periodLabel}`, 70, 87);
        doc.moveDown(3);

        /* Resumo */
        const fmt = v => `R$ ${(Number(v)||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        const rows = [
            ['Receita Total',    fmt(data.revenue?.total)],
            ['Custo Total',      fmt(data.costs?.total)],
            ['Lucro Líquido',    fmt(data.profit)],
            ['Clientes Ativos',  String(data.clients?.active ?? 0)],
            ['Clientes Expirados', String(data.clients?.expired ?? 0)],
            ['Total de Clientes',  String(data.clients?.total ?? 0)],
        ];

        doc.fillColor('#222222').font('Helvetica-Bold').fontSize(13).text('RESUMO FINANCEIRO', 50, doc.y + 10);
        doc.moveDown(0.5);

        let yy = doc.y;
        rows.forEach(([label, val], i) => {
            const bg = i % 2 === 0 ? '#f0f4ff' : '#ffffff';
            doc.rect(50, yy, W, 22).fill(bg);
            doc.fillColor('#333').font('Helvetica').fontSize(10).text(label, 60, yy + 5);
            doc.font('Helvetica-Bold').text(val, 50, yy + 5, { width: W - 10, align: 'right' });
            yy += 22;
        });

        doc.moveDown(1.5);

        /* Tabela de clientes */
        if (clients.length > 0) {
            doc.addPage();
            doc.fillColor(BLU).font('Helvetica-Bold').fontSize(13).text('CLIENTES', 50, 50);
            doc.moveDown(0.5);

            const colX = [50, 180, 280, 360, 430];
            const colW = [125, 95, 75, 65, 65];
            const headers = ['Nome', 'Usuário', 'Servidor', 'Plano', 'Valor'];
            let yt = doc.y;

            doc.rect(50, yt, W, 20).fill(BLU);
            headers.forEach((h, i) => {
                doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9)
                   .text(h, colX[i], yt + 5, { width: colW[i] });
            });
            yt += 20;

            const today2 = new Date(); today2.setHours(0,0,0,0);
            clients.forEach((c, idx) => {
                if (yt > 780) { doc.addPage(); yt = 50; }
                const bg2 = idx % 2 === 0 ? '#f0f4ff' : '#ffffff';
                const due = c.dueDate ? new Date(c.dueDate) : null;
                const dueTxt = due ? due.toLocaleDateString('pt-BR') : '-';
                doc.rect(50, yt, W, 18).fill(bg2);
                const vals = [c.name||'', c.username||'', c.server||'', dueTxt, fmt(c.planValue)];
                vals.forEach((v, i) => {
                    doc.fillColor('#333').font('Helvetica').fontSize(8)
                       .text(String(v).substring(0, 22), colX[i], yt + 4, { width: colW[i] });
                });
                yt += 18;
            });
        }

        /* Rodapé */
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            doc.fillColor(GRY).font('Helvetica').fontSize(8)
               .text(`Gerado em ${new Date().toLocaleString('pt-BR')} — Gestor Orion`, 50, 820, { width: W, align: 'center' });
        }

        doc.end();
    } catch (err) {
        console.error('[exportPdf]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
    }
};
