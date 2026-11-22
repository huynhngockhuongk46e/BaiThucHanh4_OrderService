const Order = require('./Order');
const OrderItem = require('./OrderItem');

Order.hasMany(OrderItem, { as: 'items', foreignKey: 'order_id', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

module.exports = { Order, OrderItem };
