const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const PaymentOrder = sequelize.define('PaymentOrder', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Tenants', key: 'id' }
    },
    externalRef: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    plan: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.INTEGER,
        allowNull: false // em centavos
    },
    method: {
        type: DataTypes.ENUM('pix', 'card'),
        defaultValue: 'card'
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED'),
        defaultValue: 'PENDING'
    },
    paymentId: {
        type: DataTypes.STRING,
        allowNull: true // ID da transação no Mercado Pago
    },
    pixId: {
        type: DataTypes.STRING,
        allowNull: true // Código PIX
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: true,
    tableName: 'PaymentOrders'
});

module.exports = PaymentOrder;
