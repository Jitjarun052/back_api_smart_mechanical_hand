// src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// จับคู่พาร์ทหลักเพื่อยิงดึงข้อมูลสถิติยอดรวมสรุปขากลาง
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;