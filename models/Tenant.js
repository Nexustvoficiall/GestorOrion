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
        defaultValue: 'REVENDA'   // 'PESSOAL' | 'REVENDA'
    },
    licenseExpiration: {
        type: DataTypes.DATEONLY,
        allowNull: true       // null = sem expiração
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Trial: data de término do período gratuito (7 dias após criação)
    trialEndsAt: {
        type: DataTypes.DATE,
        allowNull: true  // null = sem trial (tenant criado pelo master diretamente)
    },
    // Contato do admin do tenant
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Código único de indicação (8 chars hex maiúsculo, ex: A3F7C210)
    referralCode: {
        type: DataTypes.STRING(12),
        unique: true,
        allowNull: true   // gerado no momento do registro
    },
    // Código do tenant que indicou (referralCode do referrer)
    referredBy: {
        type: DataTypes.STRING(12),
        allowNull: true   // null = não foi indicado por ninguém
    },
    // Integração de pagamento — Mercado Pago
    mercadoPagoAccessToken: {
        type: DataTypes.TEXT,
        allowNull: true   // API key do Mercado Pago do revendedor
    },
    // Chave PIX do revendedor (para cobranças manuais)
    pixKey: {
        type: DataTypes.STRING,
        allowNull: true   // CPF, CNPJ, email ou chave aleatória do revendedor
    },
    // Beneficiário do PIX (nome da chave)
    pixKeyName: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = Tenant;
