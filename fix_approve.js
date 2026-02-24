const fs = require('fs');
let c = fs.readFileSync('dashboard/dashboard.js', 'utf8');
const old = `} catch (e) { showToast('Erro ao salvar os gastos extras', '#ff4444'); }`;
const rep = `} catch (e) { showToast('Falha na conexão. Tente novamente.', '#ff4444'); }\n}`;
if (c.includes(old)) {
    fs.writeFileSync('dashboard/dashboard.js', c.replace(old, rep), 'utf8');
    console.log('OK');
} else {
    console.log('NOT FOUND — current snippet:');
    const idx = c.indexOf('loadRenewalRequests();\n    } catch');
    console.log(JSON.stringify(c.slice(idx, idx+120)));
}
