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


// 🛠️ ดึงข้อมูลผู้ป่วยรายคนตาม user_id (เพิ่ม target_count และ target_set)
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    // 🛡️ 1. ดักจับถ้า id ที่ส่งมาเป็น undefined, null หรือไม่ใช่ตัวเลข
    if (!id || id === 'undefined' || id === 'null' || isNaN(id)) {
        console.log(`⚠️ GetUserById Error: Invalid ID received -> "${id}"`);
        return res.status(400).json({ error: "ระบุ ID ผู้ใช้งานไม่ถูกต้อง" });
    }

    try {
        // 🟢 2. ดึงข้อมูลผู้ใช้ พร้อม Join ชื่อแพทย์ และฟิลด์เป้าหมายการฝึก
        const sql = `
            SELECT 
                u.user_id, u.firstname, u.lastname, u.email, u.phone, 
                u.age, u.gender, u.symptoms, u.emergency_phone, u.status, u.image, u.doctor_id,
                u.target_count, u.target_set,
                IFNULL(CONCAT(d.name, ' (', d.specialty, ')'), 'ยังไม่มีแพทย์ผู้ดูแล') AS doctor_name,
                d.hospital_name
            FROM user u
            LEFT JOIN doctors d ON u.doctor_id = d.id
            WHERE u.user_id = ?
        `;
        
        const connection = db.promise ? db.promise() : db;
        const [rows] = await connection.query(sql, [id]);

        if (rows.length === 0) {
            console.log(`❌ GetUserById: Not found user_id = ${id} in database`);
            return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้งานรายนี้" });
        }

        return res.json({
            status: "success",
            user: rows[0]
        });
    } catch (err) {
        console.error("GetUserById Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้", details: err.message });
    }
};

// ==========================================

// 2. ระบบสมัครสมาชิก (Register) เวอร์ชันรองรับรูปภาพ
// 2. ระบบสมัครสมาชิก (Register) เวอร์ชันสมบูรณ์ (อัปเดต device + doctor_id)
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
        const connection = db.promise ? db.promise() : db;

        // [Logic A]: ตรวจสอบอีเมลซ้ำ
        const [existingEmail] = await connection.query("SELECT user_id FROM user WHERE email = ?", [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: "อีเมลนี้มีอยู่ในระบบแล้ว" });
        }

        // [Logic B]: ค้นหา doctor_id (รองรับทั้ง id และ doctor_code)
        let doctorId = null;
        if (doctor_code) {
            const [doctorResult] = await connection.query(
                "SELECT id FROM doctors WHERE id = ? OR doctor_code = ?", 
                [doctor_code, doctor_code]
            );
            if (doctorResult.length > 0) {
                doctorId = doctorResult[0].id; 
            }
        }

        // 📸 [Logic พิเศษ]: เช็กไฟล์รูปถ่ายโปรไฟล์
        const imageName = req.file ? req.file.filename : null;

        // [Logic C]: บันทึกข้อมูลลงตาราง user
        const insertUserSql = `
            INSERT INTO user (firstname, lastname, email, phone, password, role, status, age, gender, symptoms, emergency_phone, doctor_id, image) 
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)
        `;
        
        const [userResult] = await connection.query(insertUserSql, [
            firstname, lastname, email, phone, password, 
            age || null, gender || null, symptoms || null, emergency_phone || null, 
            doctorId, imageName
        ]);

        const newUserId = userResult.insertId; 

        // 🟢 [Logic D แก้ไขแล้ว]: จัดการตาราง device (ถ้ามีซีเรียลอยู่แล้วให้ UPDATE ถ้ายังไม่มีให้ INSERT)
        if (serial_number && serial_number.trim() !== '') {
            const [existingDevice] = await connection.query(
                "SELECT device_id FROM device WHERE serial_number = ?", 
                [serial_number]
            );

            if (existingDevice.length > 0) {
                // 🔄 มีอุปกรณ์เดิมรออยู่ -> ผูก user_id ใหม่เข้าไป
                await connection.query(
                    "UPDATE device SET user_id = ?, device_name = COALESCE(?, device_name) WHERE serial_number = ?",
                    [newUserId, device_name || null, serial_number]
                );
                console.log(`✅ [Register] Updated device ${serial_number} for user_id: ${newUserId}`);
            } else {
                // ➕ ถ้ายังไม่มี -> เพิ่มอุปกรณ์ชิ้นใหม่
                await connection.query(
                    "INSERT INTO device (serial_number, device_name, user_id, device_status) VALUES (?, ?, ?, 0)",
                    [serial_number, device_name || 'ถุงมืออัจฉริยะ', newUserId]
                );
                console.log(`✅ [Register] Inserted new device ${serial_number} for user_id: ${newUserId}`);
            }
        }

        return res.json({ 
            status: "success", 
            message: "ลงทะเบียนบัญชีผู้ป่วยพร้อมข้อมูลเรียบร้อยแล้ว!" 
        });

    } catch (err) {
        console.error("❌ Register Error:", err);
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

// 🟢 1. ระบบ Login (เช็กแยกตารางแพทย์ และ ตาราง user ชัดเจน)[cite: 22]
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" });
    }

    try {
        const connection = db.promise ? db.promise() : db;

        // 🔍 ขั้นที่ 1: ลองค้นหาในตาราง doctors ก่อน[cite: 22]
        try {
            const doctorSql = `SELECT * FROM doctors WHERE email = ? AND password = ?`;
            const [doctorRows] = await connection.query(doctorSql, [email, password]);

            if (doctorRows.length > 0) {
                const doctor = doctorRows[0];

                if (doctor.doctor_status === 1) {
                    return res.status(403).json({ error: "บัญชีแพทย์ของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
                }

                // 🔑 สร้าง Token สำหรับแพทย์โดยเฉพาะ
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
            console.log("Doctors table query skipped:", doctorQueryErr.message);
        }

        // 🔍 ขั้นที่ 2: ค้นหาในตาราง user (role 0 = user, role 1 = admin)[cite: 22]
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

            // 🟢 กำหนดข้อความ role ให้ตรงกับตัวเลข (0 -> patient, 1 -> admin)[cite: 22]
            const userRoleName = user.role === 1 ? 'admin' : 'patient';

            // 🔑 ฝัง user_id และ role ลงใน Token[cite: 22]
            const token = jwt.sign(
                { id: user.user_id, role: userRoleName }, 
                JWT_SECRET, 
                { expiresIn: '1d' }
            );

            return res.json({
                status: "success",
                message: "เข้าสู่ระบบสำเร็จ!",
                token: token,
                role: userRoleName,
                user: {
                    user_id: user.user_id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role
                }
            });
        }

        // 🔴 ขั้นที่ 3: ไม่ตรงกับบัญชีไหนเลย[cite: 22]
        return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    } catch (err) {
        console.error("Smart Login Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", details: err.message });
    }
};

// 🛠️ 2. ระบบ getMe (แกะ Token เช็ก ID และ Role ชัดเจน)
exports.getMe = (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "ไม่พบ Token สำหรับยืนยันตัวตน" });
    }

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.log("❌ getMe Token Verify Error:", err.message);
            return res.status(403).json({ error: "Token หมดอายุหรือไม่มีความถูกต้อง" });
        }

        // 🟢 แกะ ID ยืดหยุ่น (รองรับทั้ง id และ user_id ที่ฝั่งอยู่ใน Token)
        const userId = decoded.id || decoded.user_id;

        if (!userId || userId === 'undefined' || isNaN(userId)) {
            console.log("⚠️ getMe Invalid User ID from Token Payload:", decoded);
            return res.status(400).json({ error: "ระบุ ID ผู้ใช้งานไม่ถูกต้อง" });
        }

        try {
            const connection = db.promise ? db.promise() : db;

            // 🩺 กรณีที่ 1: เป็น Token ของ Doctor (role === 'doctor')
            if (decoded.role === 'doctor') {
                const [doctorRows] = await connection.query(
                    "SELECT id, name, doctor_code, specialty, hospital_name, hospital_phone, doctor_status FROM doctors WHERE id = ?", 
                    [userId]
                );

                if (doctorRows.length === 0) {
                    return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์" });
                }

                return res.json({
                    status: "success",
                    role: "doctor",
                    user: doctorRows[0]
                });
            }

            // 🟠 กรณีที่ 2: เป็น Token จากตาราง user (role 0 = patient, role 1 = admin)
            const [userRows] = await connection.query(
                `SELECT u.*, 
                        d.name AS doctor_name, 
                        d.specialty AS doctor_specialty,
                        d.hospital_name,
                        d.hospital_phone
                FROM user u 
                LEFT JOIN doctors d ON u.doctor_id = d.id 
                WHERE u.user_id = ?`, 
                [userId]
            );

            if (userRows.length === 0) {
                console.log(`❌ user_id: ${userId} Not Found in user table`);
                return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้ในระบบ" });
            }

            const user = userRows[0];
            const roleName = user.role === 1 ? 'admin' : 'patient';

            return res.json({
                status: "success",
                role: roleName,
                user: user,
            });

        } catch (err) {
            console.error("GetMe Server Error:", err);
            return res.status(500).json({ error: "ดึงข้อมูลโปรไฟล์ล้มเหลว", details: err.message });
        }
    });
};

// 3. สำหรับ Admin: ดึงข้อมูลผู้ใช้งานทั้งหมดในระบบ (เพิ่มฟิลด์สุขภาพให้แอดมินส่องได้)
exports.getAllUsers = (req, res) => {
    const sql = `
        SELECT user_id, firstname, lastname, email, phone, role, status, age, gender, symptoms, emergency_phone, target_count, target_set
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