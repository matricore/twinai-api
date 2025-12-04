const express = require('express');
const notificationController = require('../../controllers/notification.controller');
const auth = require('../../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get notifications (also generates new ones)
router.get('/', notificationController.getNotifications);

// Mark all as read
router.post('/read-all', notificationController.markAllAsRead);

// Mark single as read
router.post('/:id/read', notificationController.markAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;

