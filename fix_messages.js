const fs = require('fs');
let c = fs.readFileSync('dashboard/dashboard.js', 'utf8');
let changed = 0;

const replacements = [
    // savePayment
    [
        "if (!month || !amount) { showToast('Informe m\u00eas e valor', '#ff4444'); return; }",
        "if (!month || !amount) { showToast('Preencha o m\u00eas e o valor do pagamento', '#ff4444'); return; }"
    ],
    [
        "if (!res.ok) { showToast(data.error || 'Erro', '#ff4444'); return; }\n        showToast('\u2705 Pagamento registrado!', '#00cc66');",
        "if (!res.ok) { showToast(data.error || 'N\u00e3o foi poss\u00edvel registrar o pagamento', '#ff4444'); return; }\n        showToast('Pagamento registrado com sucesso', '#00cc66');"
    ],
    [
        "} catch (e) { showToast('Erro de conex\u00e3o', '#ff4444'); }\n}\n\nasync function openPayHistory",
        "} catch (e) { showToast('Falha na conex\u00e3o. Verifique sua internet.', '#ff4444'); }\n}\n\nasync function openPayHistory"
    ],
    // deletePayment
    [
        "showToast('Pagamento exclu\u00eddo', '#ffaa00');",
        "showToast('Pagamento removido', '#ffaa00');"
    ],
    // saveCaixa
    [
        "} catch (e) { showToast('Erro ao salvar caixa', '#ff4444'); }",
        "} catch (e) { showToast('N\u00e3o foi poss\u00edvel salvar o caixa. Tente novamente.', '#ff4444'); }"
    ],
    // savePlanPrices
    [
        "if (res.ok) showToast('\u2705 Pre\u00e7os salvos!', '#00cc66');",
        "if (res.ok) showToast('Tabela de pre\u00e7os atualizada com sucesso', '#00cc66');"
    ],
    [
        "else showToast(data.error || 'Erro ao salvar pre\u00e7os', '#ff4444');",
        "else showToast(data.error || 'N\u00e3o foi poss\u00edvel salvar os pre\u00e7os', '#ff4444');"
    ],
    [
        "} catch (e) { showToast('Erro de conex\u00e3o', '#ff4444'); }\n}\n\nasync function loadRenewalRequests",
        "} catch (e) { showToast('Falha na conex\u00e3o. Tente novamente.', '#ff4444'); }\n}\n\nasync function loadRenewalRequests"
    ],
    // gastos extras
    [
        "showToast('Gastos extras salvos!', '#00cc66');",
        "showToast('Gastos extras salvos com sucesso', '#00cc66');"
    ],
    [
        "showToast('Erro ao salvar', '#ff4444');",
        "showToast('N\u00e3o foi poss\u00edvel salvar os gastos extras', '#ff4444');"
    ],
];

for (const [old, rep] of replacements) {
    if (c.includes(old)) {
        c = c.replace(old, rep);
        changed++;
        console.log('OK:', old.slice(0,50));
    } else {
        console.log('SKIP (not found):', old.slice(0,50));
    }
}

fs.writeFileSync('dashboard/dashboard.js', c, 'utf8');
console.log(`\nFeito: ${changed} substituicoes`);
