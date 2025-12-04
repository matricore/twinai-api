const express = require('express');
const questionController = require('../../controllers/question.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const questionValidation = require('../../validations/question.validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Get next question to answer
router.get('/next', questionController.getNextQuestion);

// Get all pending questions
router.get('/pending', questionController.getPendingQuestions);

// Get question stats
router.get('/stats', questionController.getStats);

// Get answered questions history
router.get('/answered', questionController.getAnsweredQuestions);

// Generate new questions
router.post('/generate', validate(questionValidation.generateQuestions), questionController.generateQuestions);

// Answer a question
router.post('/:questionId/answer', validate(questionValidation.answerQuestion), questionController.answerQuestion);

// Skip a question
router.post('/:questionId/skip', validate(questionValidation.skipQuestion), questionController.skipQuestion);

module.exports = router;

