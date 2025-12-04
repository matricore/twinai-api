const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * Get user profile with twin summary
 */
const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      isVerified: true,
      googleId: true,
      appleId: true,
      createdAt: true,
      twin: {
        select: {
          id: true,
          interests: true,
          lastAnalyzedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return {
    ...user,
    hasGoogleLinked: !!user.googleId,
    hasAppleLinked: !!user.appleId,
    googleId: undefined,
    appleId: undefined,
  };
};

/**
 * Update user profile
 */
const updateProfile = async (userId, data) => {
  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      updatedAt: true,
    },
  });
};

/**
 * Change password
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    throw ApiError.badRequest('Password change not available for OAuth accounts');
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
};

/**
 * Soft delete user account
 */
const deleteAccount = async (userId) => {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    }),
  ]);
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};

