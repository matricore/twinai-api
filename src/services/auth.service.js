const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const appleSignin = require('apple-signin-auth');
const prisma = require('../config/database');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/tokens');

const googleClient = new OAuth2Client(config.google.clientId);

/**
 * Create user with twin profile
 */
const createUserWithTwin = async (userData) => {
  return prisma.user.create({
    data: {
      ...userData,
      twin: { create: {} },
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
};

/**
 * Register new user with email/password
 */
const register = async ({ email, password, name }) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    throw ApiError.conflict('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUserWithTwin({ email, passwordHash, name });

  return generateTokens(user.id, user);
};

/**
 * Login with email/password
 */
const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account is deactivated');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return generateTokens(user.id, userWithoutPassword);
};

/**
 * Google OAuth authentication
 */
const googleAuth = async ({ idToken }) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();
  const { sub: googleId, email, name, picture } = payload;

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
    select: { id: true, email: true, name: true, avatarUrl: true, googleId: true },
  });

  if (user && !user.googleId) {
    // Link Google account to existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, avatarUrl: user.avatarUrl || picture },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  } else if (!user) {
    // Create new user
    user = await createUserWithTwin({
      email,
      googleId,
      name,
      avatarUrl: picture,
      isVerified: true,
    });
  }

  return generateTokens(user.id, user);
};

/**
 * Apple Sign-In authentication
 */
const appleAuth = async ({ identityToken, user: appleUser }) => {
  const applePayload = await appleSignin.verifyIdToken(identityToken, {
    audience: config.apple.clientId,
    ignoreExpiration: false,
  });

  const { sub: appleId, email: tokenEmail } = applePayload;
  const email = tokenEmail || appleUser?.email;

  if (!email) {
    throw ApiError.badRequest('Email is required for Apple Sign-In');
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ appleId }, { email }] },
    select: { id: true, email: true, name: true, avatarUrl: true, appleId: true },
  });

  if (user && !user.appleId) {
    // Link Apple account to existing user
    user = await prisma.user.update({
      where: { id: user.id },
      data: { appleId },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
  } else if (!user) {
    // Create new user
    const name = appleUser?.name
      ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
      : null;

    user = await createUserWithTwin({
      email,
      appleId,
      name,
      isVerified: true,
    });
  }

  return generateTokens(user.id, user);
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken) => {
  const payload = verifyToken(refreshToken, 'refresh');

  if (!payload) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } } },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    if (storedToken) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    }
    throw ApiError.unauthorized('Refresh token expired');
  }

  if (!storedToken.user.isActive) {
    throw ApiError.forbidden('Account is deactivated');
  }

  // Delete old refresh token and create new pair
  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  return generateTokens(storedToken.user.id, storedToken.user);
};

/**
 * Logout - invalidate refresh token
 */
const logout = async (refreshToken) => {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
};

/**
 * Generate and store token pair
 */
const generateTokens = async (userId, user) => {
  const accessToken = generateAccessToken(userId);
  const { token: refreshToken, expiresAt } = generateRefreshToken(userId);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt },
  });

  // Cleanup old tokens (keep last 5)
  const tokens = await prisma.refreshToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip: 5,
    select: { id: true },
  });

  if (tokens.length) {
    await prisma.refreshToken.deleteMany({
      where: { id: { in: tokens.map((t) => t.id) } },
    });
  }

  return { accessToken, refreshToken, user };
};

module.exports = {
  register,
  login,
  googleAuth,
  appleAuth,
  refreshAccessToken,
  logout,
};

