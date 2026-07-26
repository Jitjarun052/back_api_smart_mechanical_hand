const db = require('../config/db');

// 1. ดึงข้อมูลประวัติการฝึกทั้งหมดจากฐานข้อมูล
exports.getAllHistory = (req, res) => {
    const sql = "SELECT * FROM history";
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล", details: err });
        }
        res.json(results);
    });
};


// รับข้อมูลจากถุงมือ IoT หรือ Mobile App มาบันทึกลงฐานข้อมูลจริง (อัปเดตตามตารางใหม่)
exports.saveHistory = (req, res) => {
    // 1. ดึงค่าตัวแปรจาก Body ให้ครบตามคอลัมน์ใน phpMyAdmin ของคุณ
    const { user_id, device_id, count, accuracy, max_force, duration, Speed, wrist_angle } = req.body;
    
    // 2. คำสั่ง SQL อัปเดตเพิ่มคอลัมน์ device_id, Speed, wrist_angle เข้าไปด้วย
    const sql = `INSERT INTO history 
                 (user_id, device_id, count, accuracy, max_force, duration, Speed, wrist_angle) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    // 3. ส่งอาร์เรย์ของข้อมูลไปเรียงลำดับให้ตรงกับเครื่องหมายเครื่องหมายคำถาม (?)
    db.query(sql, [user_id, device_id, count, accuracy, max_force, duration, Speed, wrist_angle], (err, result) => {
        if (err) {
            console.error("❌ SQL Insert Error:", err); // พิมพ์บอกใน Terminal เผื่อติดบักก์ตาราง
            return res.status(500).json({ 
                error: "ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้", 
                details: err.message 
            });
        }
        
        // ส่งสถานะตอบกลับสำเร็จเมื่อ Insert ผ่านฉลุย
        res.json({
            status: "success",
            message: "บันทึกข้อมูลการฝึกลงฐานข้อมูลเรียบร้อยแล้ว!",
            insertedId: result.insertId
        });
    });
};

// 3. EDIT (UPDATE): แก้ไขข้อมูลประวัติ (เผื่อไว้ให้แอดมินหรือแพทย์ใช้)
exports.updateHistory = (req, res) => {
    const { id } = req.params; // รับ ID ที่จะแก้จาก URL (เช่น /api/history/5)
    const { count, accuracy, max_force, duration, Speed, wrist_angle } = req.body;

    const sql = `UPDATE history 
                 SET count = ?, accuracy = ?, max_force = ?, duration = ?, Speed = ?, wrist_angle = ? 
                 WHERE history_id = ?`;

    db.query(sql, [count, accuracy, max_force, duration, Speed, wrist_angle, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "แก้ไขข้อมูลล้มเหลว", details: err });
        }
        res.json({ status: "success", message: `อัปเดตประวัติ ID: ${id} เรียบร้อยแล้ว` });
    });
};

// 4. DELETE: ลบข้อมูลประวัติออกจากตารางจริง
exports.deleteHistory = (req, res) => {
    const { id } = req.params; // รับ ID ที่จะลบจาก URL

    const sql = "DELETE FROM history WHERE history_id = ?";

    db.query(sql, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ลบข้อมูลล้มเหลว", details: err });
        }
        res.json({ status: "success", message: `ลบประวัติ ID: ${id} ออกจากฐานข้อมูลแล้ว` });
    });
};

exports.getDailyTrainSummary = (req, res) => {
    // 💥 ใช้ DATE_FORMAT จัดกลุ่มข้อมูล history ตามวัน/เดือน/ปี เพื่อดึงรอบรวมและความแม่นยำเฉลี่ยออกรายวัน
    // เปลี่ยนคอลัมน์ 'created_at' หรือชื่อฟิลด์วันที่ในตารางของคุณให้ตรงจุด (เช่น train_date หรือ timestamp)
    const sql = `
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
               SUM(count) AS count,
               ROUND(AVG(accuracy), 0) AS percentage
        FROM history
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
        ORDER BY date ASC
        LIMIT 15
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถคำนวณข้อมูลสถิติได้", details: err.message });
        }
        res.json(results);
    });
};

// 🩺 ดึงประวัติฝึกซ้อมเฉพาะผู้ป่วยรายบุคคล (สำหรับแพทย์/ผู้ป่วยส่องรายละเอียด)
exports.getHistoryByUserId = async (req, res) => {
    const { userId } = req.params;

    try {
        const sql = `
            SELECT history_id, user_id, device_id, count, accuracy, max_force, duration, speed, wrist_angle, 
                   finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky, created_at
            FROM history
            WHERE user_id = ?
            ORDER BY created_at DESC   -- 🟢 เปลี่ยนจาก ASC เป็น DESC เพื่อเอาเซสชันล่าสุดมาอยู่แถวแรกสุด (Index 0)
        `;

        const [rows] = await db.promise().query(sql, [userId]);
        
        // 🟢 ส่งเป็น Array `rows` กลับไปตรงๆ หรือถ้า Flutter รับ { history: rows } ให้คงไว้ตามโครงสร้างเดิม
        return res.json(rows); 

    } catch (err) {
        console.error("Get History By UserId Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงประวัติการฝึกซ้อมได้", details: err.message });
    }
};

// ✅ เพิ่มการรับค่า 5 นิ้ว และใส่ค่าสำรองเป็น 0 เพื่อไม่ให้กระทบเคสที่ส่งมาไม่ครบ
exports.createHistory = async (req, res) => {
    const { 
        user_id, device_id, count, accuracy, max_force, 
        duration, speed, wrist_angle,
        finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky 
    } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: "กรุณาระบุ user_id" });
    }

    try {
        // 1. บันทึกสถิติลงตาราง history ตามโค้ดเดิมของคุณ
        const sql = `
            INSERT INTO history (
                user_id, device_id, count, accuracy, max_force, 
                duration, speed, wrist_angle, 
                finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.promise().query(sql, [
            user_id, 
            device_id || 1, 
            count || 0, 
            accuracy || 0, 
            max_force || 0,
            duration || 0, 
            speed || 0, 
            wrist_angle || 0,
            finger_thumb || 0, 
            finger_index || 0, 
            finger_middle || 0, 
            finger_ring || 0, 
            finger_pinky || 0
        ]);

        // 2. ⚡ [แทรกใหม่] ออโต้สร้าง Notification แจ้งเตือนเมื่อปลดล็อกความสำเร็จ
        try {
            // ดึงจำนวนวันที่เคยฝึกซ้อมทั้งหมดแบบไม่นับวันซ้ำ
            const [historyRows] = await db.promise().query(
                'SELECT DISTINCT DATE(created_at) as train_date FROM history WHERE user_id = ?',
                [user_id]
            );

            const totalDays = historyRows.length;

            // ตรวจเช็กเป้าหมาย เช่น ครบ 3 วัน, 5 วัน, 10 วัน หรือ 30 วัน
            if ([3, 5, 10, 15, 30].includes(totalDays)) {
                // เช็กซ้ำก่อนว่าเคยยิงแจ้งเตือนความสำเร็จของวันนั้นๆ ไปหรือยัง (ป้องกันแจ้งเตือนซ้ำในวันเดียวกัน)
                const [existNoti] = await db.promise().query(
                    'SELECT notification_id FROM notifications WHERE user_id = ? AND subtitle LIKE ?',
                    [user_id, `%ครบ ${totalDays} วัน%`]
                );

                if (existNoti.length === 0) {
                    await db.promise().query(
                        'INSERT INTO notifications (user_id, title, subtitle, type) VALUES (?, ?, ?, ?)',
                        [
                            user_id,
                            'ความสำเร็จใหม่! 🏆',
                            `ยินดีด้วย! คุณทำสถิติฝึกซ้อมสะสมครบ ${totalDays} วันเรียบร้อยแล้ว`,
                            'achievement'
                        ]
                    );
                }
            }
        } catch (notiErr) {
            // ซ่อน/Log Error ฝั่ง Notification ไว้ เพื่อไม่ให้กระทบกระบวนการหลักของการบันทึก History
            console.error("Auto Notification Error (Non-blocking):", notiErr);
        }

        // 3. คืนค่า JSON สเปกเดิมที่คุณทำไว้ หน้าบ้าน Flutter รับค่าได้ปกติ 100%
        return res.json({ 
            status: "success", 
            message: "บันทึกประวัติการฝึกซ้อมพร้อมสถิติ 5 นิ้วเรียบร้อยแล้ว!" 
        });

    } catch (err) {
        console.error("Create History Error:", err);
        return res.status(500).json({ error: "บันทึกข้อมูลไม่สำเร็จ", details: err.message });
    }
};

// 🩺 [เพิ่มใหม่]: สำหรับหน้าจอด็อกเตอร์ ไว้ดึงพัฒนาการแยกรายนิ้วของคนไข้เฉพาะคน
exports.getPatientFingerDetail = async (req, res) => {
    const { userId } = req.params;

    try {
        const sql = `
            SELECT 
                history_id, count, accuracy, max_force, duration, wrist_angle,
                finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky,
                created_at
            FROM history 
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        const [rows] = await db.promise().query(sql, [userId]);
        return res.json({ status: "success", history: rows });
    } catch (err) {
        console.error("Get Finger Detail Error:", err);
        return res.status(500).json({ error: "ดึงข้อมูลประวัติรายนิ้วล้มเหลว", details: err.message });
    }
};

exports.createHistoryFromIoT = async (req, res) => {
    const { 
        serial_number, user_id, count, accuracy, max_force, 
        duration, speed, wrist_angle,
        finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky 
    } = req.body;

    try {
        // 1. นำ serial_number ที่ส่งมาจาก ESP32 ไปหา device_id ในตาราง devices
        const [deviceRows] = await db.promise().query(
            'SELECT device_id FROM device WHERE serial_number = ?', 
            [serial_number]
        );

        if (deviceRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบ Serial Number ของอุปกรณ์นี้ในระบบ!" });
        }

        const device_id = deviceRows[0].device_id;

        // 2. บันทึกลงตาราง history พร้อม device_id ที่ถูกต้อง
        const sql = `
            INSERT INTO history (
                user_id, device_id, count, accuracy, max_force, 
                duration, speed, wrist_angle, 
                finger_thumb, finger_index, finger_middle, finger_ring, finger_pinky
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.promise().query(sql, [
            user_id, device_id, count || 0, accuracy || 0, max_force || 0,
            duration || 0, speed || 0, wrist_angle || 0,
            finger_thumb || 0, finger_index || 0, finger_middle || 0, finger_ring || 0, finger_pinky || 0
        ]);

        return res.json({ status: "success", message: "บันทึกข้อมูลเรียบร้อย!" });

    } catch (err) {
        console.error("Save History Error:", err);
        return res.status(500).json({ error: "Server Error", details: err.message });
    }
};