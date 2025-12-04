const Joi = require('joi');

const register = {
  body: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().min(8).max(128).required(),
    name: Joi.string().min(2).max(100).trim(),
  }),
};

const login = {
  body: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().required(),
  }),
};

const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const googleAuth = {
  body: Joi.object({
    idToken: Joi.string().required(),
  }),
};

const appleAuth = {
  body: Joi.object({
    identityToken: Joi.string().required(),
    user: Joi.object({
      email: Joi.string().email(),
      name: Joi.object({
        firstName: Joi.string(),
        lastName: Joi.string(),
      }),
    }),
  }),
};

module.exports = {
  register,
  login,
  refreshToken,
  googleAuth,
  appleAuth,
};

