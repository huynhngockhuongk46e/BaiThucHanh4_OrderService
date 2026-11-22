# BÀI THỰC HÀNH SỐ 4: DỊCH VỤ QUẢN LÝ ĐƠN HÀNG (ORDER SERVICE)

## 1. Thông tin sinh viên
- **Họ và tên:** ...
- **MSSV:** ...
- **Lớp:** ...

## 2. Mô tả kiến trúc (SOA)
- **Cổng hoạt động:** 3004 (độc lập với Bài 2 và Bài 3)
- **Database:** `order_db` (riêng, không dùng chung với `product_db`)
- **Xác thực:** JWT cấp từ Bài 2, `JWT_SECRET` trùng khớp trong `.env`
- **Giao tiếp giữa các service:** Order Service gọi **Product Service (cổng 3003)** qua HTTP
  (`GET /products/:id`) để kiểm tra tồn kho và lấy tên/giá sản phẩm. Không truy cập trực tiếp DB của service khác;
  `order_items.product_id` không là khóa ngoại sang `product_db`, mà lưu snapshot tên + giá lúc đặt hàng.

## 3. Cài đặt và chạy
1. `npm install`
2. Tạo database: chạy `database.sql` trong MySQL (hoặc chỉ cần tạo `order_db`, Sequelize sẽ tự tạo bảng).
3. Kiểm tra `.env` (`DB_USER`, `DB_PASSWORD`, `PRODUCT_SERVICE_URL`).
4. **Chạy Product Service (Bài 3) trước** trên cổng 3003.
5. `node index.js`

## 4. API (tất cả cần Header `Authorization: Bearer <token>`)
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/orders` | Tạo đơn hàng (kiểm tra tồn kho qua Product Service) |
| GET | `/orders` | Xem danh sách (lọc `?status=pending`) |
| GET | `/orders/:id` | Xem chi tiết đơn hàng |
| GET | `/orders/check-stock?product_id=1&quantity=2` | Kiểm tra số lượng sản phẩm |
| PUT | `/orders/:id` | Cập nhật trạng thái / địa chỉ / ghi chú |
| DELETE | `/orders/:id` | Xóa đơn hàng |

### Ví dụ tạo đơn hàng
```json
POST /orders
{
  "shipping_address": "12 Nguyễn Huệ, Quy Nhơn",
  "note": "Giao giờ hành chính",
  "items": [
    { "product_id": 1, "quantity": 2 },
    { "product_id": 3, "quantity": 1 }
  ]
}
```

### Trạng thái đơn hàng
`pending → confirmed → shipping → completed`; có thể `cancelled` khi đang `pending` hoặc `confirmed`.

```json
PUT /orders/1
{ "status": "confirmed" }
```
