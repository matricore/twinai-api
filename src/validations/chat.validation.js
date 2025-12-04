const Joi = require('joi');

const sendMessage = {
  body: Joi.object({
    message: Joi.string().min(1).max(10000).required().trim(),
    conversationId: Joi.string().uuid().allow(null),
  }),
};

const getConversation = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

const getConversations = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};

module.exports = {
  sendMessage,
  getConversation,
  getConversations,
};

