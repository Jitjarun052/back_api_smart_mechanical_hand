const db = require('../config/db');

// 1. GET: ดึงรายการอุปกรณ์ทั้งหมด (หรือดึงแยกตาม user_id)
// 1. GET: ดึงรายการอุปกรณ์ทั้งหมด (และรองรับการค้นหาเฉพาะเครื่องที่ถูกระงับ/Offline)
exports.getAllDevices = (req, res) => {
    const { user_id, device_status } = req.query; // รับค่าเงื่อนไขจากพาร์ท URL (เช่น ?device_status=0)
    
    let sql = "SELECT * FROM device WHERE 1=1"; // ใช้ WHERE 1=1 เพื่อให้เราสามารถต่อคำสั่ง AND ได้ง่ายๆ
    let params = [];
    
    // เงื่อนไขที่ 1: ถ้าส่งไอดีผู้ใช้มา ให้ค้นหาเฉพาะของคนนั้น
    if (user_id) {
        sql += " AND user_id = ?";
        params.push(user_id);
    }
    
    // เงื่อนไขที่ 2: ถ้าส่งสถานะมา (เช่น 0 หรือ 1) ให้คัดกรองตามสถานะนั้น
    if (device_status !== undefined) {
        sql += " AND device_status = ?";
        params.push(device_status);
    }
    
    db.query(sql, params, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลอุปกรณ์ได้", details: err.message });
        }
        res.json(results);
    });
};

// 2. POST: ลงทะเบียนเพิ่มอุปกรณ์ชิ้นใหม่เข้าสู่ระบบ
exports.createDevice = (req, res) => {
    const { device_name, serial_number, user_id } = req.body; // อิงตามคอลัมน์จริง

    if (!device_name || !serial_number || !user_id) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลอุปกรณ์ให้ครบถ้วน" });
    }

    // กำหนดให้ตอนเพิ่มใหม่ device_status เป็น 0 (Offline) โดยอัตโนมัติ
    const sql = "INSERT INTO device (device_name, serial_number, user_id, device_status) VALUES (?, ?, ?, 0)";

    db.query(sql, [device_name, serial_number, user_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถเพิ่มอุปกรณ์ได้", details: err.message });
        }
        res.json({ 
            status: "success", 
            message: "ลงทะเบียนอุปกรณ์ใหม่สำเร็จแล้ว!", 
            deviceId: result.insertId 
        });
    });
};

// 3. PUT: อัปเดตสถานะการเชื่อมต่อ IoT (Online/Offline)
exports.updateDeviceStatus = (req, res) => {
    const { id } = req.params; // รับ device_id จาก URL
    const { device_status } = req.body; // รับเลข 0 หรือ 1

    if (device_status === undefined) {
        return res.status(400).json({ error: "กรุณาระบุสถานะอุปกรณ์ (device_status)" });
    }

    const sql = "UPDATE device SET device_status = ? WHERE device_id = ?";

    db.query(sql, [device_status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถเปลี่ยนสถานะอุปกรณ์ได้", details: err.message });
        }
        res.json({ 
            status: "success", 
            message: `อัปเดตสถานะอุปกรณ์ ID: ${id} เป็นเรียบร้อยแล้ว` 
        });
    });
};