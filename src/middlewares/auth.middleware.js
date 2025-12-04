const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/tokens');
const prisma = require('../config/database');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, 'access');

    if (!payload) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : ApiError.unauthorized('Authentication failed'));
  }
};

module.exports = auth;

