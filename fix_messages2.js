const fs = require('fs');
let c = fs.readFileSync('dashboard/dashboard.js', 'utf8');
let n = 0;

// The file stores literal \u escape sequences as text (not actual Unicode bytes)
// So we search for the raw string as it appears in the file

const r = (a, b) => {
    if (c.includes(a)) { c = c.replace(a, b); n++; process.stdout.write('OK: ' + a.slice(0,60) + '\n'); }
    else process.stdout.write('SKIP: ' + a.slice(0,60) + '\n');
};

// saveEditUser
r(
    "showToast('Informe o nome de usu\\u00e1rio', '#ff4444')",
    "showToast('Nome de usu\\u00e1rio \\u00e9 obrigat\\u00f3rio', '#ff4444')"
);
r(
    "showToast(data.error || 'Erro ao salvar', '#ff4444')",
    "showToast(data.error || 'N\\u00e3o foi poss\\u00edvel salvar as altera\\u00e7\\u00f5es', '#ff4444')"
);
r(
    "showToast('\\u2705 Usu\\u00e1rio atualizado!', '#00cc66')",
    "showToast('Usu\\u00e1rio atualizado com sucesso', '#00cc66')"
);
r(
    "showToast('Erro de conex\\u00e3o', '#ff4444'); }\n}\n\n\n/* ===== PAGAMENTOS",
    "showToast('Falha na conex\\u00e3o. Verifique sua internet.', '#ff4444'); }\n}\n\n\n/* ===== PAGAMENTOS"
);

// savePayment
r(
    "showToast('Informe m\\u00eas e valor', '#ff4444')",
    "showToast('Preencha o m\\u00eas e o valor do pagamento', '#ff4444')"
);
r(
    "showToast(data.error || 'Erro', '#ff4444'); return; }\n        showToast('\\u2705 Pagamento registrado!', '#00cc66')",
    "showToast(data.error || 'N\\u00e3o foi poss\\u00edvel registrar o pagamento', '#ff4444'); return; }\n        showToast('Pagamento registrado com sucesso', '#00cc66')"
);
r(
    "showToast('Erro de conex\\u00e3o', '#ff4444'); }\n}\n\nasync function openPayHistory",
    "showToast('Falha na conex\\u00e3o. Verifique sua internet.', '#ff4444'); }\n}\n\nasync function openPayHistory"
);

// deletePayment
r(
    "showToast('Pagamento exclu\\u00eddo', '#ffaa00')",
    "showToast('Pagamento removido com sucesso', '#ffaa00')"
);

// savePlanPrices
r(
    "if (res.ok) showToast('\\u2705 Pre\\u00e7os salvos!', '#00cc66');",
    "if (res.ok) showToast('Tabela de pre\\u00e7os atualizada com sucesso', '#00cc66');"
);
r(
    "else showToast(data.error || 'Erro ao salvar pre\\u00e7os', '#ff4444');",
    "else showToast(data.error || 'N\\u00e3o foi poss\\u00edvel salvar os pre\\u00e7os', '#ff4444');"
);

// saveCaixa
r(
    "showToast('Erro ao salvar caixa', '#ff4444')",
    "showToast('N\\u00e3o foi poss\\u00edvel salvar o saldo de caixa', '#ff4444')"
);

fs.writeFileSync('dashboard/dashboard.js', c, 'utf8');
console.log('\nTotal substituicoes: ' + n);
