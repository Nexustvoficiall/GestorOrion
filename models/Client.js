const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const Client = sequelize.define('Client', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    resellerId: {
        type: DataTypes.INTEGER,
        allowNull: true  // null = criado pelo admin direto
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true  // id do user personal que criou (isolamento exclusivo)
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
