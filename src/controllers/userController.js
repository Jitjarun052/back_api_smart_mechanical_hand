const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY_2026';

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
            const insertDeviceSql = `INSERT INTO device (serial_number, device_name, user_id ,device_status) VALUES (?, ?, ?, ?)`;
            await db.promise().query(insertDeviceSql, [serial_number, device_name, newUserId, 0]);
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
// exports.login = (req, res) => {
//     const { email, password } = req.body;

//     const sql = `
//         SELECT u.*, d.name AS doctor_name, d.specialty AS doctor_specialty, d.hospital_name, d.hospital_phone 
//         FROM user u
//         LEFT JOIN doctors d ON u.doctor_id = d.id
//         WHERE u.email = ? AND u.password = ?
//     `;
    
//     db.query(sql, [email, password], (err, results) => {
//         if (err) {
//             return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", details: err.message });
//         }
//         if (results.length === 0) {
//             return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
//         }

//         const user = results[0];

//         if (user.status === 1) {
//             return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
//         }

//         // 🔑 สร้าง Token โดยฝังข้อมูลสิทธิ์และไอดีไว้ข้างใน (มีอายุใช้งาน 1 วัน)
//         const token = jwt.sign(
//             { user_id: user.user_id, role: user.role }, 
//             JWT_SECRET, 
//             { expiresIn: '1d' }
//         );

//         // 📡 ส่งเฉพาะ Token กลับไปให้หน้าบ้านเก็บลง Storage ตามที่คุณจิตร์จรัญต้องการ
//         res.json({
//             status: "success",
//             message: "เข้าสู่ระบบสำเร็จ!",
//             token: token
//         });
//     });
// };

exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" });
    }

    try {
        const connection = db.promise ? db.promise() : db;

        // 🔍 ขั้นที่ 1: ลองค้นหาในตาราง doctors ก่อน (ดักจับไว้ถ้าตารางแพทย์ไม่มีคอลัมน์ email)
        try {
            const doctorSql = `SELECT * FROM doctors WHERE email = ? AND password = ?`;
            const [doctorRows] = await connection.query(doctorSql, [email, password]);

            if (doctorRows.length > 0) {
                const doctor = doctorRows[0];

                if (doctor.doctor_status === 1) {
                    return res.status(403).json({ error: "บัญชีแพทย์ของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
                }

                const token = jwt.sign(
                    { id: doctor.id, role: 'doctor' }, 
                    JWT_SECRET, 
                    { expiresIn: '1d' }
                );

                return res.json({
                    status: "success",
                    message: "เข้าสู่ระบบในฐานะแพทย์สำเร็จ!",
                    token: token,
                    role: "doctor",
                    user: {
                        id: doctor.id,
                        name: doctor.name,
                        doctor_code: doctor.doctor_code
                    }
                });
            }
        } catch (doctorQueryErr) {
            // ถ้าตาราง doctors ไม่มี column email ให้ข้ามมาค้นหาในตาราง user ต่อได้เลยโดยไม่ล่ม
            console.log("Doctors table query skipped:", doctorQueryErr.message);
        }

        // 🔍 ขั้นที่ 2: ค้นหาในตาราง user (ครอบคลุมทั้ง Admin role=1 และ Patient role=0)
        const userSql = `
            SELECT u.*, d.name AS doctor_name, d.specialty AS doctor_specialty, d.hospital_name, d.hospital_phone 
            FROM user u
            LEFT JOIN doctors d ON u.doctor_id = d.id
            WHERE u.email = ? AND u.password = ?
        `;
        const [userRows] = await connection.query(userSql, [email, password]);

        if (userRows.length > 0) {
            const user = userRows[0];

            if (user.status === 1) {
                return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
            }

            // แยก role ให้ชัดเจน (ถ้า role=1 ให้เป็น admin/doctor, ถ้า role=0 ให้เป็น patient)
            const userRole = user.role === 1 ? 'admin' : 'patient';

            const token = jwt.sign(
                { id: user.user_id, role: userRole }, 
                JWT_SECRET, 
                { expiresIn: '1d' }
            );

            return res.json({
                status: "success",
                message: "เข้าสู่ระบบสำเร็จ!",
                token: token,
                role: userRole,
                user: {
                    user_id: user.user_id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role
                }
            });
        }

        // 🔴 ขั้นที่ 3: ไม่ตรงกับบัญชีไหนเลย
        return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    } catch (err) {
        console.error("Smart Login Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", details: err.message });
    }
};

// 🛠️ 2. พาร์ทใหม่ (Get Me): ใช้ Token ในการ Select ข้อมูลผู้ใช้งานกลับไป
exports.getMe = (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token หมดอายุหรือไม่มีความถูกต้อง" });
        }

        try {
            // 🩺 กรณี Token เป็นสิทธิ์แพทย์
            if (decoded.role === 'doctor') {
                const [doctorRows] = await db.promise().query(
                    "SELECT id, name, doctor_code, specialty, hospital_name, hospital_phone, doctor_status FROM doctors WHERE id = ?", 
                    [decoded.id]
                );
                
                if (doctorRows.length === 0) {
                    return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์ในระบบ" });
                }

                return res.json({
                    status: "success",
                    role: "doctor",
                    user: doctorRows[0]
                });
            } 
            
            // 🟠 กรณี Token เป็นสิทธิ์ผู้ป่วย (patient)
            // ⚠️ [FIXED ✨]: เพิ่มคอลัมน์ `image` เข้าไปในคำสั่ง SELECT
            const [userRows] = await db.promise().query(
                `SELECT u.*, 
                        d.name AS doctor_name, 
                        d.specialty AS doctor_specialty, 
                        d.hospital_name, 
                        d.hospital_phone 
                FROM user u 
                LEFT JOIN doctors d ON u.doctor_id = d.id 
                WHERE u.user_id = ?`, 
                [decoded.id]
            );

            if (userRows.length === 0) {
                return res.status(404).json({ error: "ไม่พบผู้ใช้งานรายนี้ในระบบ" });
            }

            return res.json({
                status: "success",
                role: "patient",
                user: userRows[0],
            });

        } catch (err) {
            console.error("GetMe Error:", err);
            return res.status(500).json({ error: "ดึงข้อมูลระบบโปรไฟล์ล้มเหลว", details: err.message });
        }
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

// 1. เช็กความถูกต้องของ Email + Phone
exports.verifyIdentity = async (req, res) => {
  const { email, phone } = req.body;

  if (!email || !phone) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }

  try {
    const [users] = await db.promise().query(
      "SELECT user_id, firstname FROM user WHERE email = ? AND (phone = ? OR emergency_phone = ?)",
      [email, phone, phone]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "ไม่พบข้อมูลบัญชีที่ตรงกับอีเมลและเบอร์โทรนี้" });
    }

    return res.json({ 
      status: "success", 
      message: "ยืนยันตัวตนสำเร็จ",
      userId: users[0].user_id,
      firstname: users[0].firstname
    });
  } catch (err) {
    console.error("Verify Identity Error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

// 2. อัปเดตรหัสผ่านใหม่
exports.resetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });
  }

  try {
    await db.promise().query(
      "UPDATE user SET password = ? WHERE user_id = ?",
      [newPassword, userId]
    );

    return res.json({ status: "success", message: "รีเซ็ตรหัสผ่านใหม่เรียบร้อยแล้ว!" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

// 🛠️ 5. ระบบแก้ไขข้อมูลส่วนตัวผู้ป่วย (Update Profile)
exports.updateProfile = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Token หมดอายุหรือไม่มีความถูกต้อง" });
        }

        const { firstname, lastname, age, gender, symptoms, emergency_phone, doctor_id } = req.body;

        try {
            // อัปเดตข้อมูลผู้ป่วยในตาราง user ตาม user_id ที่อยู่ใน Token
            const updateSql = `
                UPDATE user 
                SET firstname = ?, lastname = ?, age = ?, gender = ?, symptoms = ?, emergency_phone = ?, doctor_id = ?
                WHERE user_id = ?
            `;

            await db.promise().query(updateSql, [
                firstname, lastname, age || null, gender || null, 
                symptoms || null, emergency_phone || null, doctor_id || null, 
                decoded.id
            ]);

            return res.json({
                status: "success",
                message: "อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว!"
            });

        } catch (err) {
            console.error("Update Profile Error:", err);
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตข้อมูล", details: err.message });
        }
    });
};