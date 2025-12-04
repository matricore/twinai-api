const Joi = require('joi');

const answerQuestion = {
  params: Joi.object({
    questionId: Joi.string().uuid().required(),
  }),
  body: Joi.object({
    answer: Joi.string().min(1).max(5000).required(),
  }),
};

const skipQuestion = {
  params: Joi.object({
    questionId: Joi.string().uuid().required(),
  }),
};

const generateQuestions = {
  body: Joi.object({
    count: Joi.number().integer().min(1).max(10).optional(),
  }),
};

module.exports = {
  answerQuestion,
  skipQuestion,
  generateQuestions,
};

