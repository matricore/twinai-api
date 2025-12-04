const Joi = require('joi');

const createMemory = {
  body: Joi.object({
    content: Joi.string().min(1).max(5000).required().trim(),
    summary: Joi.string().max(200).trim(),
    category: Joi.string()
      .valid('fact', 'preference', 'experience', 'relationship', 'habit')
      .required(),
    importance: Joi.number().min(0).max(1),
  }),
};

const searchMemories = {
  query: Joi.object({
    q: Joi.string().min(1).max(500).required(),
    category: Joi.string().valid('fact', 'preference', 'experience', 'relationship', 'habit'),
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),
};

const getMemories = {
  query: Joi.object({
    category: Joi.string().valid('fact', 'preference', 'experience', 'relationship', 'habit'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    sort: Joi.string().valid('recent', 'important').default('recent'),
  }),
};

const memoryId = {
  params: Joi.object({
    id: Joi.string().uuid().required(),
  }),
};

module.exports = {
  createMemory,
  searchMemories,
  getMemories,
  memoryId,
};

