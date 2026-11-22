const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./db');
require('./models'); // đăng ký model + quan hệ trước khi sync
const orderRoutes = require('./routes/orderRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/orders', orderRoutes);

const PORT = process.env.PORT || 3004;

sequelize.sync().then(() => {
    console.log('✅ Kết nối Database order_db thành công!');
    app.listen(PORT, () => {
        console.log(`🚀 Order Service (Bài 4) đang chạy trên cổng ${PORT}`);
    });
}).catch(err => console.error('❌ Lỗi kết nối DB:', err));
