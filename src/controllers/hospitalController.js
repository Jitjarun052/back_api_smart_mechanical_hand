const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// 📸 ตั้งค่า Multer อัปโหลดรูปโรงพยาบาล
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('กรุณาอัปโหลดเฉพาะไฟล์รูปภาพเท่านั้น!'), false);
  }
};

const uploadHospital = multer({ storage: storage, fileFilter: fileFilter });
exports.uploadHospital = uploadHospital;

// 1. ดึงโรงพยาบาลทั้งหมด พร้อมคำนวณอุปกรณ์ที่ผูกแล้ว
exports.getAllHospitals = async (req, res) => {
  try {
    const sql = `
      SELECT 
        h.hospital_id,
        h.hospital_name,
        h.hospital_phone,
        h.address,
        h.image,
        COUNT(DISTINCT d.id) AS doctor_count,
        COUNT(DISTINCT u.user_id) AS patient_count,
        COUNT(DISTINCT dev.device_id) AS device_count,
        COUNT(DISTINCT CASE WHEN dev.user_id IS NOT NULL AND dev.user_id != 0 THEN dev.device_id END) AS active_device_count
      FROM hospitals h
      LEFT JOIN doctors d ON h.hospital_id = d.hospital_id
      LEFT JOIN user u ON h.hospital_id = u.hospital_id AND u.role = 0
      LEFT JOIN device dev ON h.hospital_id = dev.hospital_id
      GROUP BY h.hospital_id
      ORDER BY h.hospital_id DESC
    `;
    const [rows] = await (db.promise ? db.promise() : db).query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("Get All Hospitals Error:", err);
    return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลโรงพยาบาลได้" });
  }
};

// 2. เพิ่มโรงพยาบาลใหม่พร้อมรูปภาพ
exports.createHospital = async (req, res) => {
  const body = req.body || {}; // 👈 ป้องกัน req.body เป็น undefined
  const hospital_name = body.hospital_name;
  const hospital_phone = body.hospital_phone;
  const address = body.address;
  const image = req.file ? req.file.filename : null;

  if (!hospital_name) {
    return res.status(400).json({ error: "กรุณากรอกชื่อโรงพยาบาล" });
  }

  try {
    const sql = "INSERT INTO hospitals (hospital_name, hospital_phone, address, image) VALUES (?, ?, ?, ?)";
    await (db.promise ? db.promise() : db).query(sql, [hospital_name, hospital_phone || null, address || null, image]);
    return res.status(201).json({ status: "success", message: "เพิ่มโรงพยาบาลสำเร็จ" });
  } catch (err) {
    console.error("Create Hospital Error:", err);
    return res.status(500).json({ error: "ไม่สามารถเพิ่มโรงพยาบาลได้" });
  }
};

// ลบโรงพยาบาล
exports.deleteHospital = async (req, res) => {
  const { id } = req.params;
  try {
    await db.promise().query("DELETE FROM hospitals WHERE hospital_id = ?", [id]);
    return res.json({ status: "success", message: "ลบโรงพยาบาลเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("Delete Hospital Error:", err);
    return res.status(500).json({ error: "ไม่สามารถลบโรงพยาบาลได้" });
  }
};

// ดึงข้อมูลเชิงลึกของโรงพยาบาล (รายชื่อแพทย์ + รายชื่ออุปกรณ์)
exports.getHospitalDetails = async (req, res) => {
  const { id } = req.params;

  try {
    const connection = db.promise ? db.promise() : db;

    // 1. ข้อมูลทั่วไปของโรงพยาบาล
    const [hospRows] = await connection.query(
      "SELECT * FROM hospitals WHERE hospital_id = ?", 
      [id]
    );
    if (hospRows.length === 0) {
      return res.status(404).json({ error: "ไม่พบข้อมูลโรงพยาบาล" });
    }

    // 2. รายชื่อแพทย์/นักกายภาพบำบัดในสังกัด
    const [doctorRows] = await connection.query(`
      SELECT 
        d.id, d.doctor_code, d.name, d.specialty, d.role_type, d.doctor_status,
        COUNT(u.user_id) AS patient_count
      FROM doctors d
      LEFT JOIN user u ON d.id = u.doctor_id
      WHERE d.hospital_id = ?
      GROUP BY d.id
      ORDER BY d.id DESC
    `, [id]);

    // 3. รายการอุปกรณ์ทั้งหมดที่จัดสรรให้โรงพยาบาลนี้
    const [deviceRows] = await connection.query(`
      SELECT 
        dev.device_id, dev.serial_number, dev.device_name, dev.device_status, dev.user_id,
        CONCAT(u.firstname, ' ', u.lastname) AS owner_name
      FROM device dev
      LEFT JOIN user u ON dev.user_id = u.user_id
      WHERE dev.hospital_id = ?
      ORDER BY dev.device_id DESC
    `, [id]);

    return res.json({
      hospital: hospRows[0],
      doctors: doctorRows,
      devices: deviceRows
    });

  } catch (err) {
    console.error("Get Hospital Details Error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลรายละเอียดโรงพยาบาล", details: err.message });
  }
};