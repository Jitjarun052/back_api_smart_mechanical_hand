const db = require('../config/db');

exports.getDashboardStats = (req, res) => {
    // 💥 Query 1: นับจำนวนผู้ป่วยทั้งหมด (role = 0 คือผู้ป่วยทั่วไป)
    const countPatientsSql = "SELECT COUNT(*) AS totalPatients FROM user WHERE role = 0";
    
    // 💥 Query 2: นับจำนวนอุปกรณ์ทั้งหมดในคลัง
    const countDevicesSql = "SELECT COUNT(*) AS totalDevices FROM device";
    
    // 💥 Query 3: นับเฉพาะอุปกรณ์ที่มีคนเอาไปลงทะเบียนใช้งานแล้ว (user_id ไม่ใช่ 0 หรือไม่เป็น NULL)
    const countRegisteredSql = "SELECT COUNT(*) AS registeredDevices FROM device WHERE user_id != 0 AND user_id IS NOT NULL";

    db.query(countPatientsSql, (err, patientsRes) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.query(countDevicesSql, (err, devicesRes) => {
            if (err) return res.status(500).json({ error: err.message });
            
            db.query(countRegisteredSql, (err, registeredRes) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // ส่งผลลัพธ์ยอดรวมสรุปกลับไปให้หน้าบ้าน React
                res.json({
                    totalPatients: patientsRes[0].totalPatients,
                    totalDevices: devicesRes[0].totalDevices,
                    registeredDevices: registeredRes[0].registeredDevices
                });
            });
        });
    });
};