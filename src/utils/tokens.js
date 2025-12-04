const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Parse duration string to milliseconds
 * @param {string} duration - Duration string (e.g., '15m', '7d')
 * @returns {number} Milliseconds
 */
const parseDuration = (duration) => {
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900000; // Default 15 minutes
  }
  return parseInt(match[1], 10) * units[match[2]];
};

/**
 * Generate JWT access token
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ sub: userId, type: 'access' }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

/**
 * Generate JWT refresh token
 * @param {string} userId - User ID
 * @returns {{ token: string, expiresAt: Date }}
 */
const generateRefreshToken = (userId) => {
  const expiresAt = new Date(Date.now() + parseDuration(config.jwt.refreshExpiresIn));
  const token = jwt.sign({ sub: userId, type: 'refresh' }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { token, expiresAt };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} type - Token type ('access' or 'refresh')
 * @returns {{ sub: string, type: string } | null}
 */
const verifyToken = (token, type) => {
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.type !== type) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  parseDuration,
};

