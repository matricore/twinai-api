const questionService = require('../services/question.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');

const getNextQuestion = catchAsync(async (req, res) => {
  const question = await questionService.getNextQuestion(req.user.id);
  success(res, question);
});

const getPendingQuestions = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const questions = await questionService.getPendingQuestions(req.user.id, limit);
  success(res, questions);
});

const answerQuestion = catchAsync(async (req, res) => {
  const { questionId } = req.params;
  const { answer } = req.body;
  
  const question = await questionService.answerQuestion(req.user.id, questionId, answer);
  success(res, question, 'Answer saved successfully');
});

const skipQuestion = catchAsync(async (req, res) => {
  const { questionId } = req.params;
  
  const question = await questionService.skipQuestion(req.user.id, questionId);
  success(res, question, 'Question skipped');
});

const generateQuestions = catchAsync(async (req, res) => {
  const count = parseInt(req.body.count) || 5;
  
  const questions = await questionService.generateQuestions(req.user.id, count);
  success(res, questions, `Generated ${questions.length} questions`);
});

const getStats = catchAsync(async (req, res) => {
  const stats = await questionService.getQuestionStats(req.user.id);
  success(res, stats);
});

const getAnsweredQuestions = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  
  const result = await questionService.getAnsweredQuestions(req.user.id, limit, offset);
  success(res, result);
});

module.exports = {
  getNextQuestion,
  getPendingQuestions,
  answerQuestion,
  skipQuestion,
  generateQuestions,
  getStats,
  getAnsweredQuestions,
};

