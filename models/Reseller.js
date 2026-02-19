const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const Reseller = sequelize.define('Reseller', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: DataTypes.STRING,
    whatsapp: DataTypes.STRING,
    type: {
        type: DataTypes.STRING,
        defaultValue: 'PRE'
    },
    settleDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    paymentStatus: {
        type: DataTypes.STRING,
        defaultValue: 'PENDENTE'
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'ATIVO'
    }
});

module.exports = Reseller;
