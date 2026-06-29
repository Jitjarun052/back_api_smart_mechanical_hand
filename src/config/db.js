const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') }); // ชี้ไปที่ไฟล์ .env นอกสุด

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('❌ เชื่อมต่อ MySQL ล้มเหลว:', err);
        return;
    }
    console.log('🔌 เชื่อมต่อฐานข้อมูล MySQL สำเร็จแล้ว! (via src/config/db.js)');
});

module.exports = db;