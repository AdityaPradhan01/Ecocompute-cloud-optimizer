const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');
const { loginLimiter } = require('../middleware/rateLimiters');

router.post('/login', loginLimiter, authController.login);
router.get('/me', requireAuth, authController.me);

module.exports = router;
