const express = require('express');
const chatController = require('../../controllers/chat.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const chatValidation = require('../../validations/chat.validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.post('/', validate(chatValidation.sendMessage), chatController.sendMessage);

router.get('/conversations', validate(chatValidation.getConversations), chatController.getConversations);

router.get('/conversations/:id', validate(chatValidation.getConversation), chatController.getConversation);

router.delete('/conversations/:id', validate(chatValidation.getConversation), chatController.deleteConversation);

module.exports = router;

