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
        defaultValue: 'reseller' // 'master' | 'admin' | 'reseller'
    },
    resellerId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

module.exports = User;
