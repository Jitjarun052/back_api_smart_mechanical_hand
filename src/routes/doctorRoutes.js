const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.post('/add', doctorController.createDoctor);       // POST: /api/doctor/add (เพิ่มแพทย์)
router.get('/', doctorController.getAllDoctors);          // GET: /api/doctor (ดูแพทย์ทั้งหมด)
router.get('/find/:code', doctorController.getDoctorByCode); // GET: /api/doctor/find/รหัสแพทย์ (ค้นหาแพทย์จากรหัส)

module.exports = router;