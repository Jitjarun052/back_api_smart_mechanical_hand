const db = require('../config/db');

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
    const sql = "SELECT * FROM doctors ORDER BY created_at DESC";
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