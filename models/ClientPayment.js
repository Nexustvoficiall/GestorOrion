const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const ClientPayment = sequelize.define('ClientPayment', {
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
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'Clients', key: 'id' }
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false // em reais
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true // ex: "Mensalidade janeiro 2026"
    },
    method: {
        type: DataTypes.ENUM('pix', 'mercadopago'),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED'),
        defaultValue: 'PENDING'
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true // data de vencimento
    },
    pixCode: {
        type: DataTypes.TEXT,
        allowNull: true // código PIX copy/cola gerado
    },
    mercadoPagoPreferenceId: {
        type: DataTypes.STRING,
        allowNull: true // ID da preferência no Mercado Pago
    },
    mercadoPagoCheckoutUrl: {
        type: DataTypes.TEXT,
        allowNull: true // URL do checkout
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true // data em que foi pago
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
    tableName: 'ClientPayments'
});

module.exports = ClientPayment;
