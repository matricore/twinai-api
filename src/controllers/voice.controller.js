const voiceService = require('../services/voice.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');
const ApiError = require('../utils/ApiError');

const sendVoiceMessage = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No audio file provided');
  }

  const { conversationId } = req.body;
  
  // Determine MIME type
  const mimeType = req.file.mimetype || 'audio/webm';
  
  const result = await voiceService.processVoiceMessage(
    req.user.id,
    req.file.path,
    mimeType,
    conversationId || null
  );

  // Add TTS config for the response
  result.ttsConfig = voiceService.generateSpeechConfig(result.response);

  success(res, result, 'Voice message processed');
});

module.exports = {
  sendVoiceMessage,
};

