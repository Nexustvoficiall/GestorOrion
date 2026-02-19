const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const Client = sequelize.define('Client', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: DataTypes.STRING,
    username: DataTypes.STRING,
    password: DataTypes.STRING,
    whatsapp: DataTypes.STRING,

    planType: DataTypes.STRING, // 30,90,180,365
    app: DataTypes.STRING,

    planValue: DataTypes.FLOAT,
    costPerActive: DataTypes.FLOAT,

    server: DataTypes.STRING,

    startDate: DataTypes.DATE,
    dueDate: DataTypes.DATE,

    status: {
        type: DataTypes.STRING,
        defaultValue: 'ATIVO'
    }
});

module.exports = Client;
