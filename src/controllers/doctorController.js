const db = require('../config/db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY_2026';

// 1. เพิ่มข้อมูลแพทย์ใหม่เข้าสู่ระบบ
exports.createDoctor = async (req, res) => {
    const { doctor_code, name, specialty, hospital_name, hospital_phone } = req.body;

    if (!doctor_code || !name || !hospital_name) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รหัสแพทย์, ชื่อ, โรงพยาบาล)" });
    }

    try {
        // เช็กก่อนว่ารหัสแพทย์นี้ซ้ำไหม
        const [existingDoctor] = await db.promise().query("SELECT id FROM doctors WHERE doctor_code = ?", [doctor_code]);
        if (existingDoctor.length > 0) {
            return res.status(400).json({ error: "รหัสแพทย์นี้มีอยู่ในระบบแล้ว" });
        }

        const sql = `INSERT INTO doctors (doctor_code, name, specialty, hospital_name, hospital_phone) VALUES (?, ?, ?, ?, ?)`;
        await db.promise().query(sql, [doctor_code, name, specialty || null, hospital_name, hospital_phone || null]);

        return res.status(201).json({ status: "success", message: "เพิ่มข้อมูลแพทย์สำเร็จเรียบร้อยแล้ว!" });
    } catch (err) {
        console.error("Create Doctor Error:", err);
        return res.status(500).json({ error: "ไม่สามารถเพิ่มข้อมูลแพทย์ได้", details: err.message });
    }
};

// 2. ดึงข้อมูลแพทย์ทั้งหมด (สำหรับ Admin หรือแสดงผลใน Dropdown หน้าบ้าน)
exports.getAllDoctors = (req, res) => {
    const sql = `
        SELECT d.id, d.doctor_code, d.name, d.specialty, d.hospital_name, d.hospital_phone, d.doctor_status,
            COUNT(u.user_id) AS patient_count
        FROM doctors d
        LEFT JOIN user u ON d.id = u.doctor_id
        GROUP BY d.id
        ORDER BY d.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลแพทย์ได้", details: err.message });
        }
        res.json(results);
    });
};

// 3. ค้นหาแพทย์รายบุคคลด้วย รหัสแพทย์ (doctor_code)
exports.getDoctorByCode = (req, res) => {
    const { code } = req.params; // รับค่าผ่าน URL เช่น /api/doctor/find/DOC-99X
    const sql = "SELECT * FROM doctors WHERE doctor_code = ?";

    db.query(sql, [code], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา", details: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์ที่ใช้รหัสนี้" });
        }
        res.json({ status: "success", doctor: results[0] });
    });
};

// src/controllers/doctorController.js

exports.updateDoctorStatus = async (req, res) => {
  const { id } = req.params; // รับ ID ของแพทย์จาก URL
  const { doctor_status } = req.body; // รับค่าสถานะใหม่ (1 หรือ 0) ที่ส่งมาจาก React หน้าบ้าน

  // เช็คความปลอดภัยของข้อมูลก่อนส่งเข้า SQL (ตรวจสอบว่าเป็นเลข 0 หรือ 1 เท่านั้น)
  if (doctor_status !== 0 && doctor_status !== 1) {
    return res.status(400).json({ message: 'ค่าสถานะไม่ถูกต้อง (ต้องเป็น 0 หรือ 1 เท่านั้น)' });
  }

  try {
    const db = require('../config/db'); // ดึงตัวเชื่อมต่อฐานข้อมูลของคุณจิตร์จรัญมาใช้งาน
    const query = 'UPDATE doctors SET doctor_status = ? WHERE id = ?';

    db.query(query, [doctor_status, id], (err, result) => {
      if (err) {
        console.error('SQL Error:', err);
        return res.status(500).json({ message: 'เกิดข้อผิดพลาดในคำสั่ง SQL ระหลังบ้าน' });
      }
      return res.status(200).json({ message: 'อัปเดตสิทธิ์การใช้งานของแพทย์เรียบร้อยแล้ว' });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'เซิร์ฟเวอร์เกิดข้อผิดพลาดภายใน' });
  }
};

// 🛠️ 4. ดึงรายชื่อผู้ป่วยเฉพาะคนที่ผูกกับแพทย์คนนี้ (ดึงตาม doctor_id จาก Token หรือ Query)
// 🛠️ 4. ดึงรายชื่อผู้ป่วยเฉพาะคนที่ผูกกับแพทย์คนนี้ (แก้ไข Query ให้ดึงชัวร์ 100%)
exports.getMyPatients = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์การใช้งานไม่ถูกต้อง" });
        }

        try {
            // 💡 [ปรับ Query ใหม่]: ดึงจาก user เป็นหลัก แล้ว Subquery หาประวัติล่าสุด/ค่าเฉลี่ย
            const sql = `
                SELECT 
                    u.user_id AS id,
                    CONCAT(u.firstname, ' ', u.lastname) AS name,
                    u.age,
                    u.symptoms AS symptom,
                    u.phone,
                    u.image,
                    (SELECT MAX(created_at) FROM history WHERE user_id = u.user_id) AS last_session_raw,
                    (SELECT ROUND(AVG(accuracy), 0) FROM history WHERE user_id = u.user_id) AS avg_accuracy
                FROM user u
                WHERE u.doctor_id = ?
                ORDER BY u.user_id DESC
            `;

            const [rows] = await db.promise().query(sql, [decoded.id]);
            
            console.log(`[Doctor ID: ${decoded.id}] Found Patients:`, rows.length); // 🔍 Log ดู ID หมอที่ล็อกอินเข้ามา

            return res.json({ status: "success", patients: rows });

        } catch (err) {
            console.error("Get My Patients Error:", err);
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย", details: err.message });
        }
    });
};

// 🛠️ 5. ดึงประวัติฝึกภาพรวมของผู้ป่วยทุกคนในการดูแลของแพทย์คนนี้
exports.getDoctorHistoryLogs = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "ไม่พบ Token" });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์ไม่ถูกต้อง" });
        }

        try {
            const sql = `
                SELECT 
                    h.history_id,
                    CONCAT(u.firstname, ' ', u.lastname) AS patient_name,
                    h.count,
                    h.accuracy,
                    h.duration,
                    h.max_force,
                    h.created_at
                FROM history h
                JOIN user u ON h.user_id = u.user_id
                WHERE u.doctor_id = ?
                ORDER BY h.created_at DESC
                LIMIT 30
            `;

            const [rows] = await db.promise().query(sql, [decoded.id]);
            return res.json({ status: "success", logs: rows });

        } catch (err) {
            console.error("Get Doctor Logs Error:", err);
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงประวัติ", details: err.message });
        }
    });
};

// 🛠️ 6. อัปเดตข้อมูลโปรไฟล์ของแพทย์ผู้ใช้งานเอง
exports.updateDoctorProfile = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์การใช้งานไม่ถูกต้อง" });
        }

        const { name, hospital_name, doctor_code, email } = req.body;

        if (!name || !hospital_name) {
            return res.status(400).json({ error: "กรุณากรอกชื่อและโรงพยาบาล" });
        }

        try {
            const sql = `
                UPDATE doctors 
                SET name = ?, hospital_name = ?, doctor_code = ?, email = ?
                WHERE id = ?
            `;

            await db.promise().query(sql, [
                name, 
                hospital_name, 
                doctor_code || null, 
                email || null, 
                decoded.id
            ]);

            return res.json({
                status: "success",
                message: "อัปเดตข้อมูลโปรไฟล์แพทย์เรียบร้อยแล้ว!"
            });

        } catch (err) {
            console.error("Update Doctor Profile Error:", err);
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลโปรไฟล์", details: err.message });
        }
    });
};