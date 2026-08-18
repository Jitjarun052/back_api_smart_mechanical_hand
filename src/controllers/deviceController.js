const db = require('../config/db');


// 1. GET: ดึงรายการอุปกรณ์ทั้งหมด (อัปเดต Query ให้ใช้ UNIX_TIMESTAMP เช่นกัน)
exports.getAllDevices = async (req, res) => {
    const { user_id, device_status } = req.query;
    
    try {
        let sql = `
            SELECT 
                d.device_id, 
                d.device_name, 
                d.device_image, 
                d.serial_number, 
                d.user_id, 
                d.device_status,
                d.is_training,
                d.live_count,
                d.last_seen,
                CASE 
                    WHEN d.last_seen IS NOT NULL 
                         AND (UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - UNIX_TIMESTAMP(d.last_seen)) BETWEEN 0 AND 6 
                    THEN 1 
                    ELSE 0 
                END AS is_online,
                IFNULL(CONCAT(u.firstname, ' ', u.lastname), 'ยังไม่มีผู้ถือครอง') AS owner_name
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
        
        sql += " ORDER BY d.device_id DESC";

        const connection = db.promise ? db.promise() : db;
        const [results] = await connection.query(sql, params);

        return res.json(results);

    } catch (err) {
        console.error("❌ Get All Devices Error:", err);
        return res.status(500).json({ 
            error: "ไม่สามารถดึงข้อมูลอุปกรณ์ได้", 
            details: err.message 
        });
    }
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



// 6. GET: ให้ ESP32 และ Flutter App มาเช็กสถานะการทำงาน
exports.getDeviceStatus = async (req, res) => {
    const { id } = req.params;
    const { caller } = req.query; // รับค่า caller (iot หรือ app)

    try {
        const connection = db.promise ? db.promise() : db;

        // 🟢 อัปเดต last_seen เฉพาะเมื่อ ESP32 เป็นคนยิงเข้ามาเท่านั้น!
        if (caller === 'iot') {
            await connection.query("UPDATE device SET last_seen = CURRENT_TIMESTAMP WHERE device_id = ?", [id]);
        }

        // 🟢 ใช้ UNIX_TIMESTAMP() ตัดปัญหา Timezone เพี้ยนระหว่าง Server กับ DB
        const [rows] = await connection.query(
            `SELECT device_id, device_name, user_id, device_status, is_training, live_count,
                    UNIX_TIMESTAMP(CURRENT_TIMESTAMP) - UNIX_TIMESTAMP(last_seen) AS diff_seconds
             FROM device WHERE device_id = ?`, 
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "ไม่พบอุปกรณ์หมายเลขนี้ในระบบ" });
        }

        const dev = rows[0];

        // 🟢 ถ้า diff_seconds ไม่เกิน 6 วินาที และไม่ใช่ค่าติดลบ ถือว่าออนไลน์จริง
        const isOnline = (dev.diff_seconds !== null && dev.diff_seconds >= 0 && dev.diff_seconds <= 6);

        return res.json({
            status: "success",
            device_id: dev.device_id,
            device_name: dev.device_name,
            training_status: String(dev.is_training),
            live_count: dev.live_count || 0,
            is_online: isOnline, // 👈 ส่งเป็น boolean (true / false) เสมอ
            diff_seconds: dev.diff_seconds
        });

    } catch (err) {
        console.error("Get Device Status Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอ่านสถานะอุปกรณ์", details: err.message });
    }
};

// 7. POST: ให้ Flutter App ยิงส่งคำสั่งควบคุม (START / STOP) ลง DB
exports.controlDevice = async (req, res) => {
    const { id } = req.params;
    const { command } = req.body; // รับ "START-APP" หรือ "STOP-APP"

    if (!command) {
        return res.status(400).json({ error: "กรุณาระบุ command" });
    }

    try {
        if (command === 'START-APP') {
            await db.promise().query("UPDATE device SET is_training = 'START-APP', live_count = 0 WHERE device_id = ?", [id]);
        } else if (command === 'PAUSE-APP') {
            
            await db.promise().query("UPDATE device SET is_training = 'PAUSE-APP'WHERE device_id = ?", [id]);
        } else {
            await db.promise().query("UPDATE device SET is_training = 'STOP-APP', live_count = 0 WHERE device_id = ?", [id]);
        }

        console.log(`📡 [App Control] ID: ${id} -> ${command}`);
        return res.json({ status: "success", training_status: command });

    } catch (err) {
        return res.status(500).json({ error: err.message });
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

// 🛠️ 9. PUT: ให้ ESP32 ยิงอัปเดตสถานะการฝึกซ้อม (is_training) โดยตรงเมื่อเปิด/ปิดจากภายนอก
exports.updateTrainingStatusFromIoT = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // รับ "START-IOT" หรือ "STOP-IOT"

    try {
        if (status === 'START-IOT') {
            await db.promise().query("UPDATE device SET is_training = 'START-IOT', live_count = 0 WHERE device_id = ?", [id]);
        } 
        else {
            await db.promise().query("UPDATE device SET is_training = 'STOP-IOT' WHERE device_id = ?", [id]);
        }

        console.log(`⚡ [IoT Status] ID: ${id} -> ${status}`);
        return res.json({ status: "success", training_status: status });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};



