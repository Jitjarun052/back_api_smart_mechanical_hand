const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// 📸 1. ตั้งค่าการจัดเก็บไฟล์รูปภาพ
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

// ส่งออกตัว middleware ไปใช้ที่ Router
const upload = multer({ storage: storage, fileFilter: fileFilter });

exports.upload = upload;

// ==========================================

// 2. ระบบสมัครสมาชิก (Register) เวอร์ชันรองรับรูปภาพ
exports.register = async (req, res) => {
    const { 
        firstname, lastname, email, phone, password, 
        age, gender, symptoms, emergency_phone, 
        doctor_code, serial_number, device_name 
    } = req.body;

    // ตรวจสอบข้อมูลบังคับ
    if (!firstname || !lastname || !email || !phone || !password) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลพื้นฐานให้ครบถ้วน" });
    }

    try {
        // [Logic A]: ตรวจสอบอีเมลซ้ำ
        const [existingEmail] = await db.promise().query("SELECT user_id FROM user WHERE email = ?", [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: "อีเมลนี้มีอยู่ในระบบแล้ว" });
        }

        // [Logic B]: ค้นหา doctor_id จาก doctor_code
        let doctorId = null;
        if (doctor_code) {
            const [doctorResult] = await db.promise().query("SELECT id FROM doctors WHERE doctor_code = ?", [doctor_code]);
            if (doctorResult.length > 0) {
                doctorId = doctorResult[0].id; 
            }
        }

        // 📸 [Logic พิเศษ]: เช็กว่าหน้าบ้านมีการส่งไฟล์รูปมาไหม ถ้ามีให้เอาชื่อไฟล์ไปเก็บ
        const imageName = req.file ? req.file.filename : null;

        // [Logic C]: บันทึกข้อมูลลงตาราง user (เพิ่มคอลัมน์ image ตัวที่ 12)
        const insertUserSql = `
            INSERT INTO user (firstname, lastname, email, phone, password, role, status, age, gender, symptoms, emergency_phone, doctor_id, image) 
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
        `;
        
        const [userResult] = await db.promise().query(insertUserSql, [
            firstname, lastname, email, phone, password, 
            age || null, gender || null, symptoms || null, emergency_phone || null, 
            doctorId, imageName // ✨ หยอดชื่อไฟล์รูปภาพลงฐานข้อมูล
        ]);

        const newUserId = userResult.insertId; 

        // [Logic D]: บันทึกอุปกรณ์ลงตาราง device
        if (serial_number && device_name) {
            const insertDeviceSql = `INSERT INTO device (serial_number, device_name, user_id) VALUES (?, ?, ?)`;
            await db.promise().query(insertDeviceSql, [serial_number, device_name, newUserId]);
        }

        return res.json({ 
            status: "success", 
            message: "ลงทะเบียนบัญชีผู้ป่วยพร้อมรูปถ่ายสำเร็จเรียบร้อยแล้ว!" 
        });

    } catch (err) {
        console.error("Register Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ", details: err.message });
    }
};

// 2. ระบบเข้าสู่ระบบ (Login) - เพิ่มการส่งคืนข้อมูลสุขภาพเพื่อไปแสดงบนหน้าจอ Patient Info
exports.login = (req, res) => {
    const { email, password } = req.body;

    // JOIN ตาราง doctors เพื่อดึงข้อมูลหมอมาแสดงในหน้าโปรไฟล์พร้อมกันเลย
    const sql = `
        SELECT u.*, d.name AS doctor_name, d.specialty AS doctor_specialty, d.hospital_name, d.hospital_phone 
        FROM user u
        LEFT JOIN doctors d ON u.doctor_id = d.id
        WHERE u.email = ? AND u.password = ?
    `;
    
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", details: err.message });
        }
        
        if (results.length === 0) {
            return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
        }

        const user = results[0];

        // ดักสถานะบัญชีถูกระงับ
        if (user.status === 1) {
            return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
        }

        // ส่งก้อนข้อมูลกลับหน้าบ้านเอาไปใช้ต่อในหน้าแสดงประวัติและแพทย์ประจำตัว
        res.json({
            status: "success",
            message: "เข้าสู่ระบบสำเร็จ!",
            user: {
                user_id: user.user_id,
                firstname: user.firstname,
                lastname: user.lastname,
                email: user.email,
                phone: user.phone,
                role: user.role,
                age: user.age,
                gender: user.gender,
                symptoms: user.symptoms,
                emergency_phone: user.emergency_phone,
                doctor: user.doctor_id ? {
                    name: user.doctor_name,
                    specialty: user.doctor_specialty,
                    hospital: user.hospital_name,
                    phone: user.hospital_phone
                } : null
            }
        });
    });
};

// 3. สำหรับ Admin: ดึงข้อมูลผู้ใช้งานทั้งหมดในระบบ (เพิ่มฟิลด์สุขภาพให้แอดมินส่องได้)
exports.getAllUsers = (req, res) => {
    const sql = `
        SELECT user_id, firstname, lastname, email, phone, role, status, age, gender, symptoms, emergency_phone 
        FROM user
    `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลผู้ใช้งานได้", details: err.message });
        }
        res.json(results);
    });
};

// 4. สำหรับ Admin: สั่งระงับ หรือ ปลดระงับผู้ใช้งาน (คงเดิม)
exports.updateStatus = (req, res) => {
    const { id } = req.params; 
    const { status } = req.body; 

    if (status === undefined) {
        return res.status(400).json({ error: "กรุณาระบุสถานะที่ต้องการอัปเดต" });
    }

    const sql = "UPDATE user SET status = ? WHERE user_id = ?";

    db.query(sql, [status, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: "ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้", details: err.message });
        }
        res.json({ 
            status: "success", 
            message: `เปลี่ยนสถานะผู้ใช้งาน ID: ${id} เป็นสถานะ ${status} เรียบร้อยแล้ว!` 
        });
    });
};