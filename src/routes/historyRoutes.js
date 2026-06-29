const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');

// จับคู่ Path กับฟังก์ชันใน Controller
router.get('/', historyController.getAllHistory);       // ตรงกับ GET: /api/history
router.post('/save', historyController.saveHistory);   // ตรงกับ POST: /api/history/save

// จับคู่พาร์ทต่อขยาย (มี :id เพื่อระบุว่ากำลังจัดการกับข้อมูลแถวไหน)
router.put('/:id', historyController.updateHistory);     // ตรงกับ PUT: /api/history/เลขID
router.delete('/:id', historyController.deleteHistory);  // ตรงกับ DELETE: /api/history/เลขID

// 🛠️ เพิ่มบรรทัดนี้: ทางดึงสถิติรายวันส่งออกไปให้หน้าจอ Recharts วาดกราฟ
router.get('/daily-summary', historyController.getDailyTrainSummary);

module.exports = router;