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
// 🛠️ 4. PUT: ปลดการผูกอุปกรณ์ (ตั้งค่า user_id เป็น NULL)
exports.unbindDevice = (req, res) => {
    const { device_id } = req.body;

    if (!device_id) {
        return res.status(400).json({ error: "กรุณาระบุ device_id ที่ต้องการยกเลิก" });
    }

    const sql = "UPDATE device SET user_id = NULL WHERE device_id = ?";

    db.query(sql, [device_id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถยกเลิกการผูกอุปกรณ์ได้", details: err.message });
        }
        res.json({ 
            status: "success", 
            message: "ยกเลิกการผูกอุปกรณ์เรียบร้อยแล้ว" 
        });
    });
};

// 🛠️ 5. POST / PUT: เช็กและผูกอุปกรณ์ด้วย Serial Number
exports.bindDeviceBySerial = (req, res) => {
    const { serial_number, user_id, device_name } = req.body;

    if (!serial_number || !user_id) {
        return res.status(400).json({ error: "กรุณาระบุ Serial Number และ User ID" });
    }

    // 1. ค้นหาอุปกรณ์จาก Serial Number
    const findSql = "SELECT * FROM device WHERE serial_number = ?";
    db.query(findSql, [serial_number], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหาอุปกรณ์", details: err.message });
        }

        // ❌ ไม่พบอุปกรณ์ในระบบ
        if (results.length === 0) {
            return res.status(444 || 404).json({ 
                status: "not_found", 
                message: "ไม่พบหมายเลขซีเรียลนัมเบอร์นี้ในระบบ กรุณาตรวจสอบอีกครั้ง" 
            });
        }

        const device = results[0];

        // ⚠️ อุปกรณ์ถูกผูกไว้กับคนอื่นแล้ว (user_id มีค่า และ ไม่ใช่ user_id ตัวเอง)
        if (device.user_id && device.user_id !== user_id) {
            return res.status(400).json({ 
                status: "already_bound", 
                message: "อุปกรณ์หมายเลขนี้ถูกลงทะเบียนโดยผู้ใช้งานอื่นแล้ว" 
            });
        }

        // ✅ อุปกรณ์ว่างอยู่ -> อัปเดตผูก user_id เข้าไป
        const updateSql = "UPDATE device SET user_id = ?, device_name = COALESCE(?, device_name) WHERE device_id = ?";
        db.query(updateSql, [user_id, device_name || null, device.device_id], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ error: "ไม่สามารถผูกอุปกรณ์ได้", details: updateErr.message });
            }
            res.json({ 
                status: "success", 
                message: "ผูกอุปกรณ์สำเร็จเรียบร้อยแล้ว!",
                device: {
                    device_id: device.device_id,
                    serial_number: device.serial_number,
                    device_name: device_name || device.device_name
                }
            });
        });
    });
};

// 6. GET: ให้ ESP32 และ Flutter App มาเช็กสถานะการทำงาน/คำสั่งสั่งฝึก (START/STOP)
exports.getDeviceStatus = async (req, res) => {
    const { id } = req.params;

    try {
        // ดึงค่า status / is_training จากตาราง device
        const [rows] = await db.promise().query(
            "SELECT device_id, device_name, user_id, device_status, is_training, live_count FROM device WHERE device_id = ?", 
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "ไม่พบอุปกรณ์หมายเลขนี้ในระบบ" });
        }

        const dev = rows[0];
        return res.json({
            status: "success",
            device_id: dev.device_id,
            device_name: dev.device_name,
            is_training: dev.is_training == 1, // คืนค่า true/false ให้ ESP32
            live_count: dev.live_count || 0
        });

    } catch (err) {
        console.error("Get Device Status Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านสถานะอุปกรณ์", details: err.message });
    }
};

// 7. POST: ให้ Flutter App ยิงส่งคำสั่งควบคุม (START / STOP) ลง DB
exports.controlDevice = async (req, res) => {
    const { id } = req.params;
    const { command } = req.body; // รับคำสั่ง 'START' หรือ 'STOP'

    if (!command) {
        return res.status(400).json({ error: "กรุณาระบุคำสั่ง command (START หรือ STOP)" });
    }

    const isTraining = (command.toUpperCase() === 'START') ? 1 : 0;

    try {
        const sql = "UPDATE device SET is_training = ? WHERE device_id = ?";
        await db.promise().query(sql, [isTraining, id]);

        console.log(`📡 [IoT Control] อุปกรณ์ ID: ${id} เปลี่ยนสถานะเป็น ${command}`);
        return res.json({
            status: "success",
            message: `ส่งคำสั่ง ${command} ไปยังอุปกรณ์เรียบร้อยแล้ว`,
            is_training: isTraining == 1
        });

    } catch (err) {
        console.error("Control Device Error:", err);
        return res.status(500).json({ error: "ส่งคำสั่งควบคุมไม่สำเร็จ", details: err.message });
    }
};
// PUT: อัปเดต live_count เรียลไทม์จาก ESP32
exports.updateLiveCount = async (req, res) => {
    const { id } = req.params;
    const { live_count } = req.body;

    console.log(`📡 [Real-time Live Count] อุปกรณ์ ID: ${id} -> live_count: ${live_count}`);
    
    try {
        await db.promise().query("UPDATE device SET live_count = ? WHERE device_id = ?", [live_count, id]);
        return res.json({ status: "success", live_count });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

