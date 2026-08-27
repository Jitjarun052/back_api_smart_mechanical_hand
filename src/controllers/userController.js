const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'YOUR_SUPER_SECRET_KEY_2026';

// 📸 1. ตั้งค่าการจัดเก็บไฟล์รูปภาพ[cite: 15]
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

const upload = multer({ storage: storage, fileFilter: fileFilter });
exports.upload = upload;

// 🛠️ ดึงข้อมูลผู้ป่วยรายคนตาม user_id[cite: 15]
exports.getUserById = async (req, res) => {
    const { id } = req.params;

    if (!id || id === 'undefined' || id === 'null' || isNaN(id)) {
        console.log(`⚠️ GetUserById Error: Invalid ID received -> "${id}"`);
        return res.status(400).json({ error: "ระบุ ID ผู้ใช้งานไม่ถูกต้อง" });
    }

    try {
        const sql = `
            SELECT 
                u.user_id, u.firstname, u.lastname, u.email, u.phone, 
                u.age, u.gender, u.symptoms, u.emergency_phone, u.status, u.image, u.doctor_id, u.hospital_id,
                u.target_count, u.target_set,
                IFNULL(CONCAT(d.name, ' (', d.specialty, ')'), 'ยังไม่มีแพทย์ผู้ดูแล') AS doctor_name,
                h.hospital_name, h.hospital_phone
            FROM user u
            LEFT JOIN doctors d ON u.doctor_id = d.id
            LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
            WHERE u.user_id = ?
        `;
        
        const connection = db.promise ? db.promise() : db;
        const [rows] = await connection.query(sql, [id]);

        if (rows.length === 0) {
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

// 2. ระบบสมัครสมาชิก (Register)[cite: 15]
exports.register = async (req, res) => {
    const { 
        firstname, lastname, email, phone, password, 
        age, gender, symptoms, emergency_phone, 
        doctor_code, hospital_id, serial_number, device_name 
    } = req.body;

    if (!firstname || !lastname || !email || !phone || !password) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลพื้นฐานให้ครบถ้วน" });
    }

    try {
        const connection = db.promise ? db.promise() : db;

        const [existingEmail] = await connection.query("SELECT user_id FROM user WHERE email = ?", [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: "อีเมลนี้มีอยู่ในระบบแล้ว" });
        }

        let doctorId = null;
        let finalHospitalId = hospital_id ? Number(hospital_id) : null;

        if (doctor_code) {
            const [doctorResult] = await connection.query(
                "SELECT id, hospital_id FROM doctors WHERE id = ? OR doctor_code = ?", 
                [doctor_code, doctor_code]
            );
            if (doctorResult.length > 0) {
                doctorId = doctorResult[0].id;
                if (!finalHospitalId && doctorResult[0].hospital_id) {
                    finalHospitalId = doctorResult[0].hospital_id;
                }
            }
        }

        const imageName = req.file ? req.file.filename : null;

        const insertUserSql = `
            INSERT INTO user (firstname, lastname, email, phone, password, role, status, age, gender, symptoms, emergency_phone, doctor_id, hospital_id, image) 
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const [userResult] = await connection.query(insertUserSql, [
            firstname, lastname, email, phone, password, 
            age || null, gender || null, symptoms || null, emergency_phone || null, 
            doctorId, finalHospitalId, imageName
        ]);

        const newUserId = userResult.insertId; 

        if (serial_number && serial_number.trim() !== '') {
            const [existingDevice] = await connection.query(
                "SELECT device_id FROM device WHERE serial_number = ?", 
                [serial_number]
            );

            if (existingDevice.length > 0) {
                await connection.query(
                    "UPDATE device SET user_id = ?, hospital_id = ?, device_name = COALESCE(?, device_name) WHERE serial_number = ?",
                    [newUserId, finalHospitalId, device_name || null, serial_number]
                );
            } else {
                await connection.query(
                    "INSERT INTO device (serial_number, device_name, user_id, hospital_id, device_status) VALUES (?, ?, ?, ?, 0)",
                    [serial_number, device_name || 'ถุงมืออัจฉริยะ', newUserId, finalHospitalId]
                );
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

// 🟢 1. ระบบ Login[cite: 15]
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน" });
    }

    try {
        const connection = db.promise ? db.promise() : db;

        // 🔍 ฝั่ง Doctor[cite: 15]
        try {
            const doctorSql = `SELECT * FROM doctors WHERE email = ? AND password = ?`;
            const [doctorRows] = await connection.query(doctorSql, [email, password]);

            if (doctorRows.length > 0) {
                const doctor = doctorRows[0];

                if (doctor.doctor_status === 1) {
                    return res.status(403).json({ error: "บัญชีแพทย์ของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
                }

                const token = jwt.sign(
                    { id: doctor.id, role: 'doctor', hospital_id: doctor.hospital_id }, 
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
                        doctor_code: doctor.doctor_code,
                        hospital_id: doctor.hospital_id
                    }
                });
            }
        } catch (doctorQueryErr) {
            console.log("Doctors table query skipped:", doctorQueryErr.message);
        }

        // 🔍 ฝั่ง User / Admin[cite: 15]
        const userSql = `
            SELECT u.*, d.name AS doctor_name, d.specialty AS doctor_specialty, h.hospital_name, h.hospital_phone 
            FROM user u
            LEFT JOIN doctors d ON u.doctor_id = d.id
            LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
            WHERE u.email = ? AND u.password = ?
        `;
        const [userRows] = await connection.query(userSql, [email, password]);

        if (userRows.length > 0) {
            const user = userRows[0];

            if (user.status === 1) {
                return res.status(403).json({ error: "บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ" });
            }

            let userRoleName = user.role === 1 ? 'admin' : 'patient';
            let adminType = null;

            if (user.role === 1) {
                if (user.email.includes('super') || user.email.endsWith('@adminsuper.com')) {
                    adminType = 'super_admin';
                } else {
                    adminType = 'hospital_admin';
                }
            }

            const token = jwt.sign(
                { id: user.user_id, role: userRoleName, admin_type: adminType, hospital_id: user.hospital_id }, 
                JWT_SECRET, 
                { expiresIn: '1d' }
            );

            return res.json({
                status: "success",
                message: "เข้าสู่ระบบสำเร็จ!",
                token: token,
                role: userRoleName,
                admin_type: adminType,
                user: {
                    user_id: user.user_id,
                    firstname: user.firstname,
                    lastname: user.lastname,
                    email: user.email,
                    role: user.role,
                    admin_type: adminType,
                    hospital_id: user.hospital_id
                }
            });
        }

        return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });

    } catch (err) {
        console.error("Smart Login Error:", err);
        return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล", details: err.message });
    }
};

// 🛠️ 2. ระบบ getMe[cite: 15]
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

        const userId = decoded.id || decoded.user_id;

        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: "ระบุ ID ผู้ใช้งานไม่ถูกต้อง" });
        }

        try {
            const connection = db.promise ? db.promise() : db;

            // 🩺 หมอ (ดึงจากตาราง hospitals โดยตรง)[cite: 15]
            if (decoded.role === 'doctor') {
                const [doctorRows] = await connection.query(`
                    SELECT 
                        d.id, 
                        d.name, 
                        d.doctor_code, 
                        d.specialty, 
                        d.role_type,
                        d.doctor_status,
                        d.hospital_id,
                        h.hospital_name, 
                        h.hospital_phone
                    FROM doctors d
                    LEFT JOIN hospitals h ON d.hospital_id = h.hospital_id
                    WHERE d.id = ?
                `, [userId]);

                if (doctorRows.length === 0) {
                    return res.status(404).json({ error: "ไม่พบข้อมูลแพทย์" });
                }

                return res.json({
                    status: "success",
                    role: "doctor",
                    user: doctorRows[0]
                });
            }

            // 🟠 ผู้ป่วย / แอดมิน[cite: 15]
            const [userRows] = await connection.query(
                `SELECT u.*, 
                        d.name AS doctor_name, 
                        d.specialty AS doctor_specialty,
                        h.hospital_name,
                        h.hospital_phone
                FROM user u 
                LEFT JOIN doctors d ON u.doctor_id = d.id 
                LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
                WHERE u.user_id = ?`, 
                [userId]
            );

            if (userRows.length === 0) {
                return res.status(404).json({ error: "ไม่พบข้อมูลผู้ใช้ในระบบ" });
            }

            const user = userRows[0];
            const roleName = user.role === 1 ? 'admin' : 'patient';
            
            let adminType = null;
            if (user.role === 1) {
                if (user.email.includes('super') || user.email.endsWith('@adminsuper.com')) {
                    adminType = 'super_admin';
                } else {
                    adminType = 'hospital_admin';
                }
            }

            return res.json({
                status: "success",
                role: roleName,
                admin_type: adminType,
                user: {
                    ...user,
                    admin_type: adminType
                }
            });

        } catch (err) {
            console.error("GetMe Server Error:", err);
            return res.status(500).json({ error: "ดึงข้อมูลโปรไฟล์ล้มเหลว", details: err.message });
        }
    });
};


// 3. สำหรับ Admin: ดึงข้อมูลผู้ป่วย (JOIN ข้อมูลแพทย์, อุปกรณ์ และกรองตาม รพ.)
exports.getAllUsers = async (req, res) => {
    const { hospital_id } = req.query; // 👈 รองรับการกรองตามโรงพยาบาล

    try {
        let sql = `
            SELECT 
                u.user_id, 
                u.firstname, 
                u.lastname, 
                u.email, 
                u.phone, 
                u.role, 
                u.status, 
                u.age, 
                u.gender, 
                u.symptoms, 
                u.emergency_phone, 
                u.hospital_id,
                IFNULL(CONCAT(d.name, ' (', d.specialty, ')'), NULL) AS doctor_name,
                dev.serial_number,
                h.hospital_name
            FROM user u
            LEFT JOIN doctors d ON u.doctor_id = d.id
            LEFT JOIN device dev ON u.user_id = dev.user_id
            LEFT JOIN hospitals h ON u.hospital_id = h.hospital_id
            WHERE u.role = 0
        `;
        const params = [];

        // กรองเฉพาะโรงพยาบาลของแอดมินคนนั้น
        if (hospital_id) {
            sql += ` AND u.hospital_id = ?`;
            params.push(hospital_id);
        }

        sql += ` ORDER BY u.user_id DESC`;

        const [results] = await db.promise().query(sql, params);
        return res.json(results);
    } catch (err) {
        console.error("Get All Users Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลผู้ใช้งานได้", details: err.message });
    }
};

// 4. สำหรับ Admin: สั่งระงับ หรือ ปลดระงับ[cite: 15]
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

// 5. Verify Identity & Reset Password[cite: 15]
exports.verifyIdentity = async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน" });

  try {
    const [users] = await db.promise().query(
      "SELECT user_id, firstname FROM user WHERE email = ? AND (phone = ? OR emergency_phone = ?)",
      [email, phone, phone]
    );

    if (users.length === 0) return res.status(404).json({ error: "ไม่พบข้อมูลบัญชี" });

    return res.json({ status: "success", message: "ยืนยันตัวตนสำเร็จ", userId: users[0].user_id, firstname: users[0].firstname });
  } catch (err) {
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

exports.resetPassword = async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ error: "ข้อมูลไม่ครบถ้วน" });

  try {
    await db.promise().query("UPDATE user SET password = ? WHERE user_id = ?", [newPassword, userId]);
    return res.json({ status: "success", message: "รีเซ็ตรหัสผ่านใหม่เรียบร้อยแล้ว!" });
  } catch (err) {
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
};

// 6. แก้ไขโปรไฟล์[cite: 15]
exports.updateProfile = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "ไม่พบ Token" });

    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token หมดอายุ" });

        const { firstname, lastname, age, gender, symptoms, emergency_phone, doctor_id } = req.body;

        try {
            const updateSql = `
                UPDATE user 
                SET firstname = ?, lastname = ?, age = ?, gender = ?, symptoms = ?, emergency_phone = ?, doctor_id = ?
                WHERE user_id = ?
            `;
            await db.promise().query(updateSql, [firstname, lastname, age || null, gender || null, symptoms || null, emergency_phone || null, doctor_id || null, decoded.id]);
            return res.json({ status: "success", message: "อัปเดตข้อมูลเรียบร้อยแล้ว!" });
        } catch (err) {
            return res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดต" });
        }
    });
};