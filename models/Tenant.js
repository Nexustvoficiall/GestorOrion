const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');

const Tenant = sequelize.define('Tenant', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true  // URL amigável, ex: joao-iptv
    },
    logoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    primaryColor: {
        type: DataTypes.STRING,
        defaultValue: 'red'   // red | blue | yellow | purple | green
    },
    brandName: {
        type: DataTypes.STRING,
        defaultValue: 'Gestor Orion'
    },
    plan: {
        type: DataTypes.STRING,
        defaultValue: 'PRO'   // 'BASICO' | 'PRO' | 'ENTERPRISE'
    },
    licenseExpiration: {
        type: DataTypes.DATEONLY,
        allowNull: true       // null = sem expiração
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
});

module.exports = Tenant;
