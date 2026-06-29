const db = require('../config/db');

// 1. GET: ดึงรายการอุปกรณ์ทั้งหมด + ทำ LEFT JOIN ดึงชื่อเจ้าของมาแสดงผลด้วย!
exports.getAllDevices = (req, res) => {
    const { user_id, device_status } = req.query;
    
    // 💥 ใช้ LEFT JOIN ดึงชื่อ (firstname) และนามสกุล (lastname) มารวมกันเป็น owner_name
    let sql = `
        SELECT d.device_id, d.device_name, d.serial_number, d.user_id, d.device_status,
               CONCAT(u.firstname, ' ', u.lastname) AS owner_name
        FROM device d
        LEFT JOIN user u ON d.user_id = u.user_id
        WHERE 1=1
    `;
    let params = [];
    
    if (user_id) {
        sql += " AND d.user_id = ?";
        params.push(user_id);
    }
    
    if (device_status !== undefined) {
        sql += " AND d.device_status = ?";
        params.push(device_status);
    }
    
    // ดึงข้อมูลเรียงตามไอดีล่าสุดขึ้นก่อน
    sql += " ORDER BY d.device_id DESC";

    db.query(sql, params, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลอุปกรณ์ได้", details: err.message });
        }
        res.json(results);
    });
};

// 2. POST: ลงทะเบียนเพิ่มอุปกรณ์ชิ้นใหม่เข้าสู่ระบบ (คงเดิม)
exports.createDevice = (req, res) => {
    const { device_name, serial_number, user_id } = req.body;

    if (!device_name || !serial_number || user_id === undefined) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลอุปกรณ์ให้ครบถ้วน" });
    }

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

// 3. PUT: อัปเดตสลับสถานะการระงับสิทธิ์ / เปิดสิทธิ์การใช้งานตัวเครื่อง (0 = ปกติ, 1 = ระงับเครื่อง)
exports.updateDeviceStatus = (req, res) => {
    const { id } = req.params; // รับ device_id จากพาร์ท URL
    const { device_status } = req.body; // รับเลข 0 หรือ 1

    if (device_status !== 0 && device_status !== 1) {
        return res.status(400).json({ error: "กรุณาระบุสถานะอุปกรณ์ที่ถูกต้อง (0 หรือ 1)" });
    }

    const sql = "UPDATE device SET device_status = ? WHERE device_id = ?";

    db.query(sql, [device_status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถเปลี่ยนสถานะอุปกรณ์ได้", details: err.message });
        }
        res.json({ 
            status: "success", 
            message: `อัปเดตสเตตัสอุปกรณ์ ID: ${id} ในฐานข้อมูลเรียบร้อยแล้ว` 
        });
    });
};