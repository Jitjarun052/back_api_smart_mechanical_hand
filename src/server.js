const express = require('express');
require('dotenv').config(); // โหลดไฟล์ .env นอกสุด

const app = express();
const PORT = process.env.PORT || 5000;
const path = require('path');

app.use(express.json());

// ดึงไฟล์เส้นทาง (Routes) ของระบบประวัติการฝึกเข้ามาใช้งาน
const historyRoutes = require('./routes/historyRoutes');
const userRoutes = require('./routes/userRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const doctorRouter = require('./routes/doctorRoutes');

// เปิดใช้งานพาร์ทเริ่มต้นเชื่อมไปหาชุดเส้นทางย่อย
app.use('/api/history', historyRoutes);
app.use('/api/user', userRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/doctor', doctorRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Path ทดสอบหน้าแรกของเซิร์ฟเวอร์
app.get('/api', (req, res) => {
    res.json({ message: "Welcome to Smart Rehabilitation Glove Enterprise API!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server หลังบ้านรันอย่างเป็นระบบที่พอร์ต: ${PORT}`);
});