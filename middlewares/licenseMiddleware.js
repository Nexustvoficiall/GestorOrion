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

        // Trial ativo: libera acesso mesmo sem licenseExpiration
        const now = new Date();
        const trialActive = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > now;

        if (!trialActive && tenant.licenseExpiration) {
            const exp = new Date(tenant.licenseExpiration + 'T23:59:59');
            if (exp < now) {
                return res.status(403).json({
                    error: 'LICENCA_EXPIRADA',
                    message: 'Licença expirada em ' + new Date(tenant.licenseExpiration).toLocaleDateString('pt-BR'),
                    expiredAt: tenant.licenseExpiration
                });
            }
        }

        // Se não tem trial nem licenseExpiration e não é ativo sem data → verifica se precisa bloquear
        // (tenant criado pelo master sem data = acesso ilimitado configurado pelo master)

        req.tenant = tenant;

        // Verifica validade do painel do personal ou admin
        if (['personal', 'admin'].includes(req.session?.user?.role) && req.session?.user?.id) {
            try {
                const usr = await User.findByPk(req.session.user.id, { attributes: ['panelExpiry', 'role', 'settlementDate', 'settlementPaid'] });
                if (usr && usr.panelExpiry && new Date(usr.panelExpiry) < new Date()) {
                    return res.status(403).json({
                        error: 'PAINEL_EXPIRADO',
                        message: 'Sua licen\u00e7a de acesso ao painel expirou. Renove com seu administrador.'
                    });
                }

                // PESSOAL: bloqueia se settlementDate expirada e não pago
                if (usr && usr.role === 'personal' && usr.settlementDate && !usr.settlementPaid) {
                    const settlementDate = new Date(usr.settlementDate);
                    if (settlementDate < now) {
                        return res.status(403).json({
                            error: 'PAGAMENTO_VENCIDO',
                            message: `Pagamento vencido em ${settlementDate.toLocaleDateString('pt-BR')}. Entre em contato com seu administrador.`,
                            settlementDate: usr.settlementDate
                        });
                    }
                }
            } catch (dbErr) {
                // Se colunas não existem ainda (migração em progresso), ignora
                console.warn('⚠️  Colunas de settlement ainda não existem:', dbErr.message);
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

        const now = new Date();
        const trialActive = tenant.trialEndsAt && new Date(tenant.trialEndsAt) > now;

        const expired = !tenant.isActive ||
            (!trialActive && tenant.licenseExpiration && new Date(tenant.licenseExpiration + 'T23:59:59') < now);

        // Verifica validade do painel do personal ou admin
        let panelExpired = false;
        if (!expired && ['personal', 'admin'].includes(req.session?.user?.role) && req.session?.user?.id) {
            try {
                const usr = await User.findByPk(req.session.user.id, { attributes: ['panelExpiry', 'role', 'settlementDate', 'settlementPaid'] });
                panelExpired = !!(usr && usr.panelExpiry && new Date(usr.panelExpiry) < new Date());
                
                // PESSOAL: bloqueia se settlementDate expirada e não pago
                if (!panelExpired && usr && usr.role === 'personal' && usr.settlementDate && !usr.settlementPaid) {
                    const settlementDate = new Date(usr.settlementDate);
                    if (settlementDate < now) {
                        panelExpired = true; // marca como expirado para redirecionar
                    }
                }
            } catch (dbErr) {
                // Se colunas não existem ainda (migração em progresso), ignora
                console.warn('⚠️  Colunas de settlement ainda não existem em checkLicensePage:', dbErr.message);
            }
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
