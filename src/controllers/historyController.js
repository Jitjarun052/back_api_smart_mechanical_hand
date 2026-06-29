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