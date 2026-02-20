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
    },
    // Plano mensal do Gestor Orion
    planActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    planExpiresAt: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    planValue: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 20.00
    },
    // Quando criada por um usuário revendedor, guarda o resellerId do dono
    ownerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

module.exports = Reseller;
