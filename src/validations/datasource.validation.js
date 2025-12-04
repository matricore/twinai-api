const Joi = require('joi');

const whatsappUpload = {
  body: Joi.object({
    ownerName: Joi.string().min(1).max(100).required().trim(),
  }),
};

const getDataSources = {
  query: Joi.object({
    type: Joi.string().valid('whatsapp', 'instagram', 'twitter', 'photos'),
  }),
};

const dataSourceId = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

module.exports = {
  whatsappUpload,
  getDataSources,
  dataSourceId,
};

