const ApiError = require('../utils/ApiError');
const config = require('../config');

/**
 * Convert non-ApiError to ApiError
 */
const errorConverter = (err, _req, _res, next) => {
  if (!(err instanceof ApiError)) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    err = new ApiError(statusCode, message, false);
  }
  next(err);
};

/**
 * Global error handler
 */
const errorHandler = (err, _req, res, _next) => {
  const { statusCode = 500, message } = err;

  const response = {
    success: false,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    console.error(err);
  }

  res.status(statusCode).json(response);
};

module.exports = { errorConverter, errorHandler };

