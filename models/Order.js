const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    status: {
        type: DataTypes.ENUM(...ORDER_STATUSES),
        allowNull: false,
        defaultValue: 'pending'
    },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    shipping_address: { type: DataTypes.STRING(500) },
    note: { type: DataTypes.TEXT }
}, {
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Order;
module.exports.ORDER_STATUSES = ORDER_STATUSES;
