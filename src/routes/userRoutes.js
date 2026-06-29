const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const upload = userController.upload;

router.get('/', userController.getAllUsers);
router.post('/register', upload.single('image'), userController.register); // ตรงกับ POST: /api/user/register
router.post('/login', userController.login);       // ตรงกับ POST: /api/user/login
router.put('/status/:id', userController.updateStatus); // ตรงกับ PUT: /api/user/status/เลขID
module.exports = router;