const sequelize = require('../db');
const { Order, OrderItem } = require('../models');
const { ORDER_STATUSES } = require('../models/Order');
const { checkStock, ProductServiceError } = require('../services/productClient');

// Luồng chuyển trạng thái hợp lệ
const STATUS_FLOW = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipping', 'cancelled'],
    shipping: ['completed'],
    completed: [],
    cancelled: []
};

const getToken = (req) => req.headers['authorization'].split(' ')[1];
const getUserId = (user) => user.id ?? user.userId ?? user.user_id ?? null;

const handleError = (res, error) => {
    if (error instanceof ProductServiceError) {
        return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
};

// POST /orders  — tạo đơn hàng
// body: { shipping_address, note, items: [{ product_id, quantity }] }
exports.createOrder = async (req, res) => {
    try {
        const { shipping_address, note, items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
        }

        const token = getToken(req);
        const orderItems = [];
        let total = 0;

        // Gom số lượng theo product_id (phòng trường hợp trùng sản phẩm)
        const merged = new Map();
        for (const it of items) {
            const qty = Number(it.quantity);
            if (!it.product_id || !Number.isInteger(qty) || qty <= 0) {
                return res.status(400).json({ message: 'product_id hoặc quantity không hợp lệ' });
            }
            merged.set(it.product_id, (merged.get(it.product_id) || 0) + qty);
        }

        // Kiểm tra tồn kho qua Product Service
        for (const [productId, qty] of merged) {
            const { available, product } = await checkStock(productId, qty, token);
            if (!available) {
                return res.status(400).json({
                    message: `Sản phẩm "${product.name}" không đủ số lượng`,
                    product_id: productId,
                    requested: qty,
                    in_stock: product.quantity
                });
            }
            orderItems.push({
                product_id: productId,
                product_name: product.name,
                price: product.price,
                quantity: qty
            });
            total += Number(product.price) * qty;
        }

        const order = await sequelize.transaction(async (t) => {
            const created = await Order.create({
                user_id: getUserId(req.user),
                status: 'pending',
                total_amount: total,
                shipping_address,
                note
            }, { transaction: t });

            await OrderItem.bulkCreate(
                orderItems.map(i => ({ ...i, order_id: created.id })),
                { transaction: t }
            );
            return created;
        });

        const result = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });
        res.status(201).json(result);
    } catch (error) {
        handleError(res, error);
    }
};

// GET /orders?status=pending
exports.getAllOrders = async (req, res) => {
    try {
        const where = {};
        if (req.query.status) where.status = req.query.status;

        const orders = await Order.findAll({
            where,
            include: [{ model: OrderItem, as: 'items' }],
            order: [['id', 'DESC']]
        });
        res.status(200).json(orders);
    } catch (error) {
        handleError(res, error);
    }
};

// GET /orders/:id
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: OrderItem, as: 'items' }]
        });
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        res.status(200).json(order);
    } catch (error) {
        handleError(res, error);
    }
};

// GET /orders/check-stock?product_id=1&quantity=2 — kiểm tra tồn kho từ Product Service
exports.checkProductStock = async (req, res) => {
    try {
        const productId = req.query.product_id;
        const quantity = Number(req.query.quantity || 1);
        if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ message: 'Thiếu hoặc sai product_id / quantity' });
        }
        const { available, product } = await checkStock(productId, quantity, getToken(req));
        res.status(200).json({
            product_id: product.id,
            product_name: product.name,
            requested: quantity,
            in_stock: product.quantity,
            available
        });
    } catch (error) {
        handleError(res, error);
    }
};

// PUT /orders/:id — cập nhật trạng thái / địa chỉ / ghi chú
exports.updateOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

        const { status, shipping_address, note } = req.body;
        const updates = {};

        if (status !== undefined) {
            if (!ORDER_STATUSES.includes(status)) {
                return res.status(400).json({ message: `Trạng thái không hợp lệ. Cho phép: ${ORDER_STATUSES.join(', ')}` });
            }
            if (status !== order.status && !STATUS_FLOW[order.status].includes(status)) {
                return res.status(400).json({
                    message: `Không thể chuyển từ "${order.status}" sang "${status}"`,
                    allowed: STATUS_FLOW[order.status]
                });
            }
            updates.status = status;
        }

        if (shipping_address !== undefined || note !== undefined) {
            if (['shipping', 'completed', 'cancelled'].includes(order.status)) {
                return res.status(400).json({ message: 'Không thể sửa thông tin đơn hàng ở trạng thái hiện tại' });
            }
            if (shipping_address !== undefined) updates.shipping_address = shipping_address;
            if (note !== undefined) updates.note = note;
        }

        await order.update(updates);
        const result = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });
        res.status(200).json(result);
    } catch (error) {
        handleError(res, error);
    }
};

// DELETE /orders/:id
exports.deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

        await sequelize.transaction(async (t) => {
            await OrderItem.destroy({ where: { order_id: order.id }, transaction: t });
            await order.destroy({ transaction: t });
        });
        res.status(200).json({ message: 'Xóa đơn hàng thành công' });
    } catch (error) {
        handleError(res, error);
    }
};
