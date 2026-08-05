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

// 🟢 เพิ่ม 2 บรรทัดนี้ต่อท้ายใน deviceRoutes.js
router.get('/status/:id', deviceController.getDeviceStatus); // ตรงกับ GET: /api/device/status/1
router.post('/control/:id', deviceController.controlDevice);  // ตรงกับ POST: /api/device/control/1

router.put('/live-count/:id', deviceController.updateLiveCount);

// Route ให้ ESP32 ยิง HTTP PUT มาอัปเดตสถานะ
router.put('/training-status/:id', deviceController.updateTrainingStatusFromIoT);

module.exports = router;