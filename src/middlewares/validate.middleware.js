const ApiError = require('../utils/ApiError');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi schema object with optional body, query, params
 * @returns {Function} Express middleware
 */
const validate = (schema) => (req, _res, next) => {
  const validationErrors = [];

  ['params', 'query', 'body'].forEach((key) => {
    if (schema[key]) {
      const { error, value } = schema[key].validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        validationErrors.push(...error.details.map((d) => d.message));
      } else {
        req[key] = value;
      }
    }
  });

  if (validationErrors.length) {
    return next(ApiError.badRequest(validationErrors.join(', ')));
  }

  next();
};

module.exports = validate;

