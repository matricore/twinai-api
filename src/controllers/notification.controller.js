const proactiveService = require('../services/proactive.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');

const getNotifications = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const result = await proactiveService.getNotifications(req.user.id, limit);
  success(res, result);
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await proactiveService.markAsRead(req.user.id, req.params.id);
  success(res, notification);
});

const markAllAsRead = catchAsync(async (req, res) => {
  await proactiveService.markAllAsRead(req.user.id);
  success(res, null, 'All notifications marked as read');
});

const deleteNotification = catchAsync(async (req, res) => {
  await proactiveService.deleteNotification(req.user.id, req.params.id);
  success(res, null, 'Notification deleted');
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};

