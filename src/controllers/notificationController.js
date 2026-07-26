const db = require('../config/db');

// 1. ดึงรายการแจ้งเตือนตาม user_id
exports.getNotificationsByUserId = async (req, res) => {
    const { userId } = req.params;
    try {
        // ⚡ เรียกใช้ .promise().query() เพื่อรองรับ async/await
        const [rows] = await db.promise().query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// 2. สร้างการ์ดแจ้งเตือนใหม่
exports.createNotification = async (req, res) => {
    const { user_id, title, subtitle, type } = req.body;
    try {
        const [result] = await db.promise().query(
            'INSERT INTO notifications (user_id, title, subtitle, type) VALUES (?, ?, ?, ?)',
            [user_id, title, subtitle, type || 'system']
        );
        res.json({ success: true, notification_id: result.insertId });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

// 3. อัปเดตสถานะเป็น "อ่านแล้ว" (is_unread = 0)
exports.markAsRead = async (req, res) => {
    const { notificationId } = req.params;
    try {
        await db.promise().query(
            'UPDATE notifications SET is_unread = 0 WHERE notification_id = ?',
            [notificationId]
        );
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        console.error('Error updating notification status:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};