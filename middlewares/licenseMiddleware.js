const { Tenant, User } = require('../models');

// Cache por tenantId: { [tenantId]: { tenant, checkedAt } }
const _cache = {};
const CACHE_TTL = 60 * 1000; // 1 minuto

async function getTenant(tenantId) {
    const now = Date.now();
    const cached = _cache[tenantId];
    if (cached && (now - cached.checkedAt) < CACHE_TTL) return cached.tenant;
    const tenant = await Tenant.findByPk(tenantId);
    _cache[tenantId] = { tenant, checkedAt: now };
    return tenant;
}

// Invalida o cache de um tenant (chamar após alterar licença)
function invalidateTenantCache(tenantId) {
    delete _cache[tenantId];
}

// Middleware para rotas de API
async function checkLicense(req, res, next) {
    try {
        // Usuário master não tem licença para checar
        if (req.session?.user?.role === 'master') return next();

        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return next(); // instalação nova ou rota pública

        const tenant = await getTenant(tenantId);
        if (!tenant) return next();

        if (!tenant.isActive) {
            return res.status(403).json({
                error: 'LICENCA_INATIVA',
                message: 'Licença desativada. Entre em contato com o suporte.'
            });
        }

        if (tenant.licenseExpiration) {
            const exp = new Date(tenant.licenseExpiration + 'T23:59:59');
            if (exp < new Date()) {
                return res.status(403).json({
                    error: 'LICENCA_EXPIRADA',
                    message: 'Licença expirada em ' + new Date(tenant.licenseExpiration).toLocaleDateString('pt-BR'),
                    expiredAt: tenant.licenseExpiration
                });
            }
        }

        req.tenant = tenant;

        // Verifica validade do painel do personal
        if (req.session?.user?.role === 'personal' && req.session?.user?.id) {
            const usr = await User.findByPk(req.session.user.id, { attributes: ['panelExpiry'] });
            if (usr && usr.panelExpiry && new Date(usr.panelExpiry) < new Date()) {
                return res.status(403).json({
                    error: 'PAINEL_EXPIRADO',
                    message: 'Sua licen\u00e7a de acesso ao painel expirou. Renove com seu administrador.'
                });
            }
        }

        next();
    } catch (err) {
        console.error('checkLicense error:', err.message);
        next(); // em caso de erro de DB, não bloquear
    }
}

// Middleware para rota do dashboard HTML (redireciona para página de expirada)
async function checkLicensePage(req, res, next) {
    try {
        if (req.session?.user?.role === 'master') return next();

        const tenantId = req.session?.user?.tenantId;
        if (!tenantId) return next();

        const tenant = await getTenant(tenantId);
        if (!tenant) return next();

        const expired = !tenant.isActive ||
            (tenant.licenseExpiration && new Date(tenant.licenseExpiration + 'T23:59:59') < new Date());

        // Verifica validade do painel do revendedor
        let panelExpired = false;
        if (!expired && req.session?.user?.role === 'personal' && req.session?.user?.id) {
            const usr = await User.findByPk(req.session.user.id, { attributes: ['panelExpiry'] });
            panelExpired = !!(usr && usr.panelExpiry && new Date(usr.panelExpiry) < new Date());
        }

        if (expired || panelExpired) {
            return res.redirect('/license-expired');
        }

        next();
    } catch (err) {
        console.error('checkLicensePage error:', err.message);
        next();
    }
}

module.exports = { checkLicense, checkLicensePage, invalidateTenantCache };
