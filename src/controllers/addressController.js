const db = require('../config/db');

// 1. ดึงรายชื่อจังหวัดทั้งหมด
exports.getProvinces = async (req, res) => {
    try {
        const [rows] = await db.promise().query("SELECT province_id AS id, name_th AS province_name FROM provinces ORDER BY name_th ASC");
        return res.json({ status: "success", data: rows });
    } catch (err) {
        console.error("Get Provinces Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลจังหวัดได้", details: err.message });
    }
};

// 2. ดึงรายชื่ออำเภอตาม province_id
exports.getDistrictsByProvince = async (req, res) => {
    const { province_id } = req.params;
    try {
        // ดึงจากตารางอำเภอ (ในชุดข้อมูลนี้มักใช้ตาราง amphures หรือ districts ที่เก็บข้อมูลอำเภอ)
        // หากอำเภอของคุณอยู่ในตาราง amphures ให้เปลี่ยนจาก districts เป็น amphures ตรงนี้ครับ
        const [rows] = await db.promise().query(
            "SELECT amphure_id AS id, name_th AS district_name FROM amphures WHERE province_id = ? ORDER BY name_th ASC", 
            [province_id]
        );
        return res.json({ status: "success", data: rows });
    } catch (err) {
        console.error("Get Districts Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลอำเภอได้", details: err.message });
    }
};

// 3. ดึงรายชื่อตำบลและรหัสไปรษณีย์ตาม district_id (จากตาราง districts ที่เก็บตำบล)
exports.getSubdistrictsByDistrict = async (req, res) => {
    const { district_id } = req.params;
    try {
        const [rows] = await db.promise().query(
            "SELECT district_id AS id, name_th AS subdistrict_name, zip_code AS postal_code FROM districts WHERE amphure_id = ? ORDER BY name_th ASC", 
            [district_id]
        );
        return res.json({ status: "success", data: rows });
    } catch (err) {
        console.error("Get Subdistricts Error:", err);
        return res.status(500).json({ error: "ไม่สามารถดึงข้อมูลตำบลได้", details: err.message });
    }
};