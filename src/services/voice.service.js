const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/index');
const chatService = require('./chat.service');
const ApiError = require('../utils/ApiError');
const fs = require('fs').promises;

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// Gemini model with audio support
const audioModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
});

/**
 * Normalize MIME type for audio
 */
const normalizeMimeType = (mimeType) => {
  // Handle browser variations like "audio/webm;codecs=opus"
  if (mimeType.startsWith('audio/webm')) return 'audio/webm';
  if (mimeType.startsWith('audio/mp4')) return 'audio/mp4';
  if (mimeType.startsWith('audio/mpeg')) return 'audio/mpeg';
  if (mimeType.startsWith('audio/wav')) return 'audio/wav';
  if (mimeType.startsWith('audio/ogg')) return 'audio/ogg';
  return mimeType;
};

/**
 * Process voice message - transcribe and get response
 */
const processVoiceMessage = async (userId, audioFilePath, mimeType, conversationId = null) => {
  try {
    // Read audio file
    const audioData = await fs.readFile(audioFilePath);
    const base64Audio = audioData.toString('base64');
    const normalizedMimeType = normalizeMimeType(mimeType);

    // Transcribe using Gemini
    const transcribeResult = await audioModel.generateContent([
      {
        inlineData: {
          mimeType: normalizedMimeType,
          data: base64Audio,
        },
      },
      'Transcribe this audio message exactly as spoken. Only return the transcription, nothing else. If the audio is in Turkish, transcribe in Turkish. If in English, transcribe in English.',
    ]);

    const transcription = transcribeResult.response.text().trim();

    if (!transcription) {
      throw ApiError.badRequest('Could not transcribe audio');
    }

    // Clean up temp file
    try {
      await fs.unlink(audioFilePath);
    } catch (e) {
      // Ignore
    }

    // Send transcribed message to chat service (pass as object!)
    const chatResponse = await chatService.sendMessage(userId, {
      message: transcription,
      conversationId: conversationId,
    });

    return {
      transcription,
      response: chatResponse.reply,
      conversationId: chatResponse.conversationId,
      messageId: chatResponse.messageId,
    };
  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(audioFilePath);
    } catch (e) {
      // Ignore
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Voice processing error:', error);
    throw ApiError.internal('Failed to process voice message');
  }
};

/**
 * Generate speech from text using browser TTS (returns SSML for frontend)
 * For server-side TTS, you'd use Google Cloud TTS or ElevenLabs
 */
const generateSpeechConfig = (text, language = 'tr-TR') => {
  // Return configuration for frontend TTS
  return {
    text,
    language,
    rate: 1.0,
    pitch: 1.0,
  };
};

module.exports = {
  processVoiceMessage,
  generateSpeechConfig,
};

