/**
 * Wraps async route handlers to catch errors and pass them to Express error handler
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;

