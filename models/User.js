const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const User = sequelize.define('User', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true  // null = master (super admin do SaaS)
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'personal' // 'master' | 'admin' | 'personal'
    },
    resellerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    firstLogin: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    resetToken: {
        type: DataTypes.STRING,
        allowNull: true
    },
    resetTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true
    },
    panelPlan: {
        type: DataTypes.STRING,
        defaultValue: 'STANDARD' // plano de acesso ao painel
    },
    panelExpiry: {
        type: DataTypes.DATE,
        allowNull: true // null = sem expiração (master)
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true // id do user que criou este usuário (para isolamento de lista)
    },
    themeColor: {
        type: DataTypes.STRING,
        defaultValue: 'red' // tema de cor do painel (red|blue|yellow|purple|green)
    },
    logoBase64: {
        type: DataTypes.TEXT,
        allowNull: true  // logo personalizado do painel (base64)
    },
    // Gastos mensais do usuário (usado na aba mensalistas para calcular lucro)
    monthlyExpenses: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    // Lista de gastos mensais como JSON ([{name, value}, ...])
    expensesJSON: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    extraExpensesJSON: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Preços dos planos de renovação — personal users
    planPricesJSON: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Preços dos planos de renovação — admin users (somente master define)
    planPricesAdminJSON: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Saldo em caixa por período: JSON { "2026-01": 1000, "2026-02": 500 }
    saldoCaixaJSON: {
        type: DataTypes.TEXT,
        allowNull: true
    }
});

module.exports = User;
