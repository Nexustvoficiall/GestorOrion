const { Client, Reseller, Server } = require('../models');

exports.generateReport = async () => {

    const clients = await Client.findAll({
        include: {
            model: Reseller,
            include: Server
        }
    });

    let revenue = 0;
    let cost = 0;

    clients.forEach(c => {
        if (!c.active) return;

        revenue += c.price_paid;
        cost += c.Reseller.Server.cost_per_user;
    });

    return {
        revenue,
        cost,
        profit: revenue - cost
    };
};
