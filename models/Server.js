const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

// Servidores cadastrados por tenant (sem restrição de unicidade global)
const Server = sequelize.define('Server', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

module.exports = Server;
