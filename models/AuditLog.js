const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const AuditLog = sequelize.define('AuditLog', {
    tenantId: {
        type: DataTypes.UUID,
        allowNull: true  // null = ação do master
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    userUsername: {
        type: DataTypes.STRING,
        allowNull: true
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false
    },
    entity: {
        type: DataTypes.STRING,
        allowNull: true
    },
    entityId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    details: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = AuditLog;
