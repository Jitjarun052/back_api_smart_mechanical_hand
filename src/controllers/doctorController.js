const db = require('../config/db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY_2026';

// 1. เพิ่มข้อมูลแพทย์ใหม่เข้าสู่ระบบ[cite: 16]
exports.createDoctor = async (req, res) => {
    // 🟢 1. ดึง email และ password เพิ่มเติมจาก req.body
    const { doctor_code, name, specialty, role_type, hospital_id, email, password } = req.body;
    
    if (!doctor_code || !name || !hospital_id) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รหัสแพทย์, ชื่อ, โรงพยาบาล)" });
    }
    try {
        const [existingDoctor] = await db.promise().query("SELECT id FROM doctors WHERE doctor_code = ?", [doctor_code]);
        if (existingDoctor.length > 0) {
            return res.status(400).json({ error: "รหัสแพทย์นี้มีอยู่ในระบบแล้ว" });
        }

        // 🟢 2. เพิ่มช่อง email และ password ในคำสั่ง SQL
        const sql = `
            INSERT INTO doctors (doctor_code, name, specialty, role_type, hospital_id, email, password) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await db.promise().query(sql, [
            doctor_code, 
            name, 
            specialty || null, 
            role_type || 'doctor', 
            hospital_id, 
            email || null, 
            password || null
        ]);

        return res.status(201).json({ status: "success", message: "เพิ่มข้อมูลแพทย์สำเร็จเรียบร้อยแล้ว!" });
    } catch (err) {
        console.error("Create Doctor Error:", err);
        return res.status(500).json({ error: "ไม่สามารถเพิ่มข้อมูลแพทย์ได้" });
    }
};

// 2. ดึงข้อมูลแพทย์ทั้งหมด[cite: 16]
exports.getAllDoctors = async (req, res) => {
    const { hospital_id } = req.query;
    try {
        let sql = `
            SELECT 
                d.id, 
                d.doctor_code, 
                d.name, 
                d.specialty, 
                d.role_type,
                d.email,
                d.password,
                d.hospital_id,
                h.hospital_name, 
                h.hospital_phone, 
                d.doctor_status,
                COUNT(u.user_id) AS patient_count
            FROM doctors d
            LEFT JOIN hospitals h ON d.hospital_id = h.hospital_id
            LEFT JOIN user u ON d.id = u.doctor_id
            WHERE 1=1
        `;
        const params = [];
        if (hospital_id) {
            sql += ` AND d.hospital_id = ?`;
            params.push(hospital_id);
        }
        sql += ` GROUP BY d.id ORDER BY d.id DESC`;
        const [results] = await db.promise().query(sql, params);
        return res.json(results);
    } catch (err) {
        console.error("Get All Doctors Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลแพทย์ได้" });
    }
};

// 3. ค้นหาแพทย์รายบุคคล[cite: 16]
exports.getDoctorByCode = (req, res) => {
    const { code } = req.params;
    const sql = "SELECT * FROM doctors WHERE doctor_code = ?";

    db.query(sql, [code], (err, results) => {
        if (err) return res.status(500).json({ error: "เกิดข้อผิดพลาดในการค้นหา" });
        if (results.length === 0) return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์ที่ใช้รหัสนี้" });
        res.json({ status: "success", doctor: results[0] });
    });
};

// 4. เปลี่ยนสถานะแพทย์[cite: 16]
exports.updateDoctorStatus = async (req, res) => {
  const { id } = req.params;
  const { doctor_status } = req.body;

  if (doctor_status !== 0 && doctor_status !== 1) {
    return res.status(400).json({ message: 'ค่าสถานะไม่ถูกต้อง (ต้องเป็น 0 หรือ 1 เท่านั้น)' });
  }

  try {
    const query = 'UPDATE doctors SET doctor_status = ? WHERE id = ?';
    db.query(query, [doctor_status, id], (err) => {
      if (err) return res.status(500).json({ message: 'เกิดข้อผิดพลาดในคำสั่ง SQL' });
      return res.status(200).json({ message: 'อัปเดตสิทธิ์การใช้งานของแพทย์เรียบร้อยแล้ว' });
    });
  } catch (error) {
    res.status(500).json({ message: 'เซิร์ฟเวอร์เกิดข้อผิดพลาดภายใน' });
  }
};

// 5. ดึงรายชื่อผู้ป่วยในความดูแลของแพทย์[cite: 16]
exports.getMyPatients = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์การใช้งานไม่ถูกต้อง" });
        }

        try {
            const sql = `
                SELECT 
                    u.user_id AS id,
                    CONCAT(u.firstname, ' ', u.lastname) AS name,
                    u.age,
                    u.symptoms AS symptom,
                    u.phone,
                    u.image,
                    u.target_count,
                    u.target_set,
                    (SELECT MAX(created_at) FROM history WHERE user_id = u.user_id) AS last_session_raw,
                    (SELECT ROUND(AVG(accuracy), 0) FROM history WHERE user_id = u.user_id) AS avg_accuracy
                FROM user u
                WHERE u.doctor_id = ?
                ORDER BY u.user_id DESC
            `;

            const [rows] = await db.promise().query(sql, [decoded.id]);
            return res.json({ status: "success", patients: rows });
        } catch (err) {
            console.error("Get My Patients Error:", err);
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย" });
        }
    });
};

// 6. ดึงประวัติฝึกภาพรวม[cite: 16]
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
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงประวัติ" });
        }
    });
};

// 7. อัปเดตโปรไฟล์แพทย์[cite: 16]
exports.updateDoctorProfile = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์การใช้งานไม่ถูกต้อง" });
        }

        const { name, hospital_id, doctor_code, email, specialty } = req.body;

        if (!name || !hospital_id) {
            return res.status(400).json({ error: "กรุณากรอกชื่อและเลือกโรงพยาบาล" });
        }

        try {
            const sql = `
                UPDATE doctors 
                SET name = ?, hospital_id = ?, doctor_code = ?, email = ?, specialty = ?
                WHERE id = ?
            `;

            await db.promise().query(sql, [
                name, 
                hospital_id, 
                doctor_code || null, 
                email || null, 
                specialty || null,
                decoded.id
            ]);

            return res.json({ status: "success", message: "อัปเดตข้อมูลโปรไฟล์แพทย์เรียบร้อยแล้ว!" });
        } catch (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูลโปรไฟล์" });
        }
    });
};

// 8. อัปเดตเป้าหมายการฝึกผู้ป่วย[cite: 16]
exports.updatePrescription = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err || decoded.role !== 'doctor') {
            return res.status(403).json({ error: "สิทธิ์การใช้งานไม่ถูกต้อง" });
        }

        const { patient_id, target_count, target_set } = req.body;

        if (!patient_id || target_count === undefined || target_set === undefined) {
            return res.status(400).json({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        try {
            const sql = `UPDATE user SET target_count = ?, target_set = ? WHERE user_id = ?`;
            await db.promise().query(sql, [target_count, target_set, patient_id]);

            return res.status(200).json({ status: 'success', message: 'บันทึกแผนการฝึกกายภาพเรียบร้อยแล้ว' });
        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
        }
    });
};