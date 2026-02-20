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
        allowNull: true // null = sem expiração (admin/master)
    }
});

module.exports = User;
