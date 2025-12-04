const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const { success, created } = require('../utils/response');

const register = catchAsync(async (req, res) => {
  const result = await authService.register(req.body);
  created(res, result, 'Registration successful');
});

const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  success(res, result, 'Login successful');
});

const googleAuth = catchAsync(async (req, res) => {
  const result = await authService.googleAuth(req.body);
  success(res, result, 'Google authentication successful');
});

const appleAuth = catchAsync(async (req, res) => {
  const result = await authService.appleAuth(req.body);
  success(res, result, 'Apple authentication successful');
});

const refreshToken = catchAsync(async (req, res) => {
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  success(res, result, 'Token refreshed');
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  success(res, null, 'Logout successful');
});

module.exports = {
  register,
  login,
  googleAuth,
  appleAuth,
  refreshToken,
  logout,
};

