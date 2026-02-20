const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const RenewalRequest = sequelize.define('RenewalRequest', {
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true
    },
    plan: {
        type: DataTypes.STRING,
        allowNull: false  // '1m' | '3m' | '6m' | '1a'
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending'  // 'pending' | 'approved' | 'rejected'
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    respondedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

module.exports = RenewalRequest;
