const chatService = require('../services/chat.service');
const catchAsync = require('../utils/catchAsync');
const { success, noContent } = require('../utils/response');

const sendMessage = catchAsync(async (req, res) => {
  const result = await chatService.sendMessage(req.user.id, req.body);
  success(res, result);
});

const getConversations = catchAsync(async (req, res) => {
  const result = await chatService.getConversations(req.user.id, req.query);
  success(res, result);
});

const getConversation = catchAsync(async (req, res) => {
  const conversation = await chatService.getConversation(req.user.id, req.params.id);
  success(res, conversation);
});

const deleteConversation = catchAsync(async (req, res) => {
  await chatService.deleteConversation(req.user.id, req.params.id);
  noContent(res);
});

module.exports = {
  sendMessage,
  getConversations,
  getConversation,
  deleteConversation,
};

