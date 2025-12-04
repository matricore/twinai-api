const ttsService = require('../services/tts.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const fs = require('fs');
const path = require('path');

const getVoices = catchAsync(async (req, res) => {
  const voices = await ttsService.getVoices();
  success(res, voices);
});

const getSettings = catchAsync(async (req, res) => {
  const settings = await ttsService.getUserVoiceSettings(req.user.id);
  success(res, settings);
});

const updateSettings = catchAsync(async (req, res) => {
  const { voiceId, stability, similarityBoost, speed, enabled } = req.body;
  
  const currentSettings = await ttsService.getUserVoiceSettings(req.user.id);
  const newSettings = {
    ...currentSettings,
    ...(voiceId !== undefined && { voiceId }),
    ...(stability !== undefined && { stability }),
    ...(similarityBoost !== undefined && { similarityBoost }),
    ...(speed !== undefined && { speed }),
    ...(enabled !== undefined && { enabled }),
  };
  
  const settings = await ttsService.updateVoiceSettings(req.user.id, newSettings);
  success(res, settings);
});

const generateSpeech = catchAsync(async (req, res) => {
  const { text, voiceId } = req.body;
  
  if (!text) {
    throw ApiError.badRequest('Text is required');
  }
  
  const result = await ttsService.generateSpeechBase64(req.user.id, text, { voiceId });
  
  if (!result) {
    // Fallback info for browser TTS
    success(res, { 
      fallback: true, 
      text,
      message: 'Use browser TTS' 
    });
    return;
  }
  
  success(res, result);
});

const streamSpeech = catchAsync(async (req, res) => {
  const { text, voiceId } = req.body;
  
  if (!text) {
    throw ApiError.badRequest('Text is required');
  }
  
  const result = await ttsService.generateSpeech(req.user.id, text, { voiceId });
  
  // Stream the file
  const filepath = result.filepath;
  const stat = fs.statSync(filepath);
  
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
  
  const readStream = fs.createReadStream(filepath);
  readStream.pipe(res);
  
  // Clean up file after streaming
  readStream.on('end', () => {
    fs.unlink(filepath, () => {});
  });
});

const cloneVoice = catchAsync(async (req, res) => {
  const { name, description } = req.body;
  
  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('At least one audio file is required');
  }
  
  if (!name) {
    throw ApiError.badRequest('Voice name is required');
  }
  
  // Read audio files
  const audioFiles = req.files.map((file) => file.buffer);
  
  const result = await ttsService.cloneVoice(req.user.id, name, audioFiles, description);
  success(res, result, 'Voice cloned successfully');
});

const deleteVoice = catchAsync(async (req, res) => {
  const { voiceId } = req.params;
  
  await ttsService.deleteClonedVoice(req.user.id, voiceId);
  success(res, null, 'Voice deleted');
});

module.exports = {
  getVoices,
  getSettings,
  updateSettings,
  generateSpeech,
  streamSpeech,
  cloneVoice,
  deleteVoice,
};

