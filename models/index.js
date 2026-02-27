const sequelize = require('../database/db');

const Tenant         = require('./Tenant');
const User           = require('./User');
const Client         = require('./Client');
const Reseller       = require('./Reseller');
const ResellerServer = require('./ResellerServer');
const Server         = require('./Server');
const AuditLog       = require('./AuditLog');
const RenewalRequest = require('./RenewalRequest');
const PaymentOrder   = require('./PaymentOrder');
const ClientPayment  = require('./ClientPayment');

/* RELACIONAMENTOS */
Reseller.hasMany(ResellerServer, { foreignKey: 'resellerId', as: 'servers' });
ResellerServer.belongsTo(Reseller, { foreignKey: 'resellerId' });

Tenant.hasMany(User,           { foreignKey: 'tenantId' });
Tenant.hasMany(Client,         { foreignKey: 'tenantId' });
Tenant.hasMany(Reseller,       { foreignKey: 'tenantId' });
Tenant.hasMany(Server,         { foreignKey: 'tenantId' });
Tenant.hasMany(AuditLog,       { foreignKey: 'tenantId' });
Tenant.hasMany(PaymentOrder,   { foreignKey: 'tenantId' });
Tenant.hasMany(ClientPayment,  { foreignKey: 'tenantId' });

module.exports = {
    sequelize,
    Tenant,
    User,
    Client,
    Reseller,
    ResellerServer,
    Server,
    AuditLog,
    RenewalRequest,
    PaymentOrder,
    ClientPayment
};
