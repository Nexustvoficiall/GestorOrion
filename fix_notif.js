const fs = require('fs');
let h = fs.readFileSync('dashboard/index.html', 'utf8');

// 1. Badge no botão PERFIL
const perfilBtn = `data-tab="perfil"    onclick="switchTab('perfil')">&#9881; MEU PERFIL</button>`;
const perfilBtnNew = `data-tab="perfil"    onclick="switchTab('perfil')">&#9881; MEU PERFIL <span id="perfilBadge" style="display:none;background:#ff4444;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;vertical-align:middle;margin-left:4px">!</span></button>`;
if (!h.includes(perfilBtn)) { console.error('ERR: botão perfil não encontrado'); process.exit(1); }
h = h.replace(perfilBtn, perfilBtnNew);

// 2. Badge no botão ADMIN
const adminBtn = `id="tabAdmin" data-tab="admin" onclick="switch`;
const adminIdx = h.indexOf(adminBtn);
if (adminIdx === -1) { console.error('ERR: botão admin não encontrado'); process.exit(1); }
const adminClose = h.indexOf('</button>', adminIdx);
const adminContent = h.substring(adminIdx, adminClose);
if (!adminContent.includes('adminRenewalBadge')) {
    h = h.substring(0, adminClose)
      + ' <span id="adminRenewalBadge" style="display:none;background:#ff4444;color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px;vertical-align:middle;margin-left:4px">0</span>'
      + h.substring(adminClose);
}

// 3. Banner de notificação no topo da aba PERFIL
const perfilTabMark = 'id="tab-perfil" class="tab-content">';
const perfilTabIdx  = h.indexOf(perfilTabMark);
if (perfilTabIdx === -1) { console.error('ERR: tab-perfil não encontrado'); process.exit(1); }
const afterPerfilTab = perfilTabIdx + perfilTabMark.length;
if (!h.includes('renewalNotifBanner')) {
    const notifBanner = '\n    <!-- BANNER NOTIFICACAO RENOVACAO -->\n    <div id="renewalNotifBanner" style="display:none;margin-bottom:14px"></div>\n';
    h = h.substring(0, afterPerfilTab) + notifBanner + h.substring(afterPerfilTab);
}

fs.writeFileSync('dashboard/index.html', h, 'utf8');
console.log('OK len=' + h.length);

