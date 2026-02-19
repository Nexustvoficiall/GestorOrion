const { Sequelize } = require('sequelize');

let sequelize;

if (process.env.DATABASE_URL) {
    // PostgreSQL — produção (Railway)
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: { require: true, rejectUnauthorized: false }
        },
        pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
    });
} else {
    // SQLite — desenvolvimento local
    const path = require('path');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, 'iptv.sqlite'),
        logging: false
    });
}

module.exports = sequelize;

