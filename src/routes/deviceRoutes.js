const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.get('/', deviceController.getAllDevices);              // GET: /api/device
router.post('/add', deviceController.createDevice);           // POST: /api/device/add
router.put('/status/:id', deviceController.updateDeviceStatus); // PUT: /api/device/status/เลขID

// เพิ่ม Route สำหรับยกเลิกการผูกอุปกรณ์
router.put('/unbind', deviceController.unbindDevice);

// เพิ่ม Route สำหรับผูกอุปกรณ์ผ่าน Serial Number
router.post('/bind', deviceController.bindDeviceBySerial);

module.exports = router;