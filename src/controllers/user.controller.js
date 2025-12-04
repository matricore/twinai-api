const userService = require('../services/user.service');
const catchAsync = require('../utils/catchAsync');
const { success, noContent } = require('../utils/response');

const getProfile = catchAsync(async (req, res) => {
  const user = await userService.getProfile(req.user.id);
  success(res, user);
});

const updateProfile = catchAsync(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);
  success(res, user, 'Profile updated');
});

const changePassword = catchAsync(async (req, res) => {
  await userService.changePassword(req.user.id, req.body);
  success(res, null, 'Password changed successfully');
});

const deleteAccount = catchAsync(async (req, res) => {
  await userService.deleteAccount(req.user.id);
  noContent(res);
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};

