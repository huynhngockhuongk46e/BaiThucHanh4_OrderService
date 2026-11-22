// Giao tiếp với Product Service (Bài 3) qua HTTP - không truy cập trực tiếp DB của nó.
require('dotenv').config();

const BASE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3003';

class ProductServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

// Lấy thông tin sản phẩm (gồm quantity tồn kho). Chuyển tiếp JWT của người dùng.
async function getProduct(productId, token) {
    let response;
    try {
        response = await fetch(`${BASE_URL}/products/${productId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
    } catch (err) {
        throw new ProductServiceError('Không kết nối được Product Service', 503);
    }

    if (response.status === 404) {
        throw new ProductServiceError(`Sản phẩm id=${productId} không tồn tại`, 404);
    }
    if (response.status === 401 || response.status === 403) {
        throw new ProductServiceError('Product Service từ chối token', 401);
    }
    if (!response.ok) {
        throw new ProductServiceError('Product Service trả về lỗi', 502);
    }
    return response.json();
}

// Kiểm tra tồn kho: trả về { available, product }
async function checkStock(productId, quantity, token) {
    const product = await getProduct(productId, token);
    return { available: product.quantity >= quantity, product };
}

module.exports = { getProduct, checkStock, ProductServiceError };
