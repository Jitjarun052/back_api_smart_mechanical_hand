const express = require('express');
require('dotenv').config(); // โหลดไฟล์ .env นอกสุด
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const path = require('path');

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ดึงไฟล์เส้นทาง (Routes) ของระบบประวัติการฝึกเข้ามาใช้งาน
const historyRoutes = require('./src/routes/historyRoutes');
const userRoutes = require('./src/routes/userRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const doctorRouter = require('./src/routes/doctorRoutes');
const dashboardController = require('./src/routes/dashboardRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// เปิดใช้งานพาร์ทเริ่มต้นเชื่อมไปหาชุดเส้นทางย่อย
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/doctor', doctorRouter);
app.use('/api/dashboard', dashboardController);
app.use('/api/notifications', notificationRoutes);

// Path ทดสอบหน้าแรกของเซิร์ฟเวอร์
app.get('/api', (req, res) => {
    res.json({ message: "Welcome to Smart Rehabilitation Glove Enterprise API!" });
});

// app.listen(PORT, () => {
//     console.log(`🚀 Server หลังบ้านรันอย่างเป็นระบบที่พอร์ต: ${PORT}`);
// });
app.listen(5000, '0.0.0.0', () => {
    console.log("🚀 Server running on port 5000 (Binding to all interfaces)");
});