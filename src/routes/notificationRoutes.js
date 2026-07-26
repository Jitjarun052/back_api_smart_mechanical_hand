const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// GET: /api/notifications/user/:userId
router.get('/user/:userId', notificationController.getNotificationsByUserId);

// POST: /api/notifications/create
router.post('/create', notificationController.createNotification);

// PUT: /api/notifications/read/:notificationId
router.put('/read/:notificationId', notificationController.markAsRead);

module.exports = router;