const Joi = require('joi');

const updateProfile = {
  body: Joi.object({
    name: Joi.string().min(2).max(100).trim(),
    avatarUrl: Joi.string().uri(),
  }).min(1),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
  }),
};

module.exports = {
  updateProfile,
  changePassword,
};

