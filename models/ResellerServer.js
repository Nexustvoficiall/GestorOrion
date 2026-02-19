const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const ResellerServer = sequelize.define('ResellerServer', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    resellerId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    server: DataTypes.STRING,
    activeCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    pricePerActive: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    costPerActive: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    settleDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    mensalidade: {
        type: DataTypes.FLOAT,
        allowNull: true
    }
});

module.exports = ResellerServer;
