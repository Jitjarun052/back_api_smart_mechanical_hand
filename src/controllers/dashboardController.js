const db = require('../config/db');

exports.getDashboardStats = (req, res) => {
    // 🔍 1. รับค่า hospital_id จาก Query Parameters (เช่น /dashboard/stats?hospital_id=5)
    const hospitalId = req.query.hospital_id;

    // ถ้ามี hospital_id ให้กรองเฉพาะโรงพยาบาลนั้น ๆ ถ้าไม่มีให้ดึงทั้งหมด (เผื่อกรณี Super Admin)
    let countPatientsSql = "SELECT COUNT(*) AS totalPatients FROM user WHERE role = 0";
    let countDevicesSql = "SELECT COUNT(*) AS totalDevices FROM device";
    let countRegisteredSql = "SELECT COUNT(*) AS registeredDevices FROM device WHERE user_id != 0 AND user_id IS NOT NULL";

    let patientParams = [];
    let deviceParams = [];
    let registeredParams = [];

    if (hospitalId) {
        countPatientsSql += " AND hospital_id = ?";
        patientParams.push(hospitalId);

        countDevicesSql += " WHERE hospital_id = ?";
        deviceParams.push(hospitalId);

        countRegisteredSql += " AND hospital_id = ?";
        registeredParams.push(hospitalId);
    }

    db.query(countPatientsSql, patientParams, (err, patientsRes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query(countDevicesSql, deviceParams, (err, devicesRes) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.query(countRegisteredSql, registeredParams, (err, registeredRes) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // ส่งผลลัพธ์ยอดรวมสรุปแยกตามโรงพยาบาลกลับไปให้หน้าบ้าน
                res.json({
                    totalPatients: patientsRes[0].totalPatients,
                    totalDevices: devicesRes[0].totalDevices,
                    registeredDevices: registeredRes[0].registeredDevices
                });
            });
        });
    });
};