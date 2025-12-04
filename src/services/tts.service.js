const { getClient } = require('../config/elevenlabs');
const config = require('../config/index');
const prisma = require('../config/database');
const ApiError = require('../utils/ApiError');
const fs = require('fs').promises;
const path = require('path');

// Ensure audio output directory exists
const audioDir = path.join(process.cwd(), 'uploads', 'audio');
fs.mkdir(audioDir, { recursive: true }).catch(() => {});

/**
 * Available voices (pre-defined by ElevenLabs)
 */
const AVAILABLE_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', accent: 'American', description: 'Soft, warm' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', accent: 'American', description: 'Calm, professional' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'female', accent: 'American', description: 'Strong, confident' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'female', accent: 'American', description: 'Emotional, expressive' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', accent: 'American', description: 'Deep, narrative' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'male', accent: 'American', description: 'Strong, authoritative' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', accent: 'American', description: 'Deep, warm' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'male', accent: 'American', description: 'Raspy, dynamic' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', accent: 'British', description: 'Authoritative, deep' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', accent: 'Swedish', description: 'Seductive, calm' },
];

/**
 * Get available voices
 */
const getVoices = async () => {
  // Always return pre-defined voices for reliability
  // ElevenLabs API voices can be added later if needed
  return AVAILABLE_VOICES;
};

/**
 * Get user's voice settings
 */
const getUserVoiceSettings = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { voiceSettings: true },
  });
  
  return user?.voiceSettings || {
    enabled: true,
    voiceId: config.elevenlabs.defaultVoiceId,
    stability: 0.5,
    similarityBoost: 0.75,
    speed: 1.0,
  };
};

/**
 * Update user's voice settings
 */
const updateVoiceSettings = async (userId, settings) => {
  await prisma.user.update({
    where: { id: userId },
    data: { voiceSettings: settings },
  });
  
  return settings;
};

/**
 * Generate speech from text
 */
const generateSpeech = async (userId, text, options = {}) => {
  const client = getClient();
  
  if (!client) {
    throw ApiError.badRequest('Voice service not configured. Please add ELEVENLABS_API_KEY.');
  }
  
  // Get user's voice settings
  const settings = await getUserVoiceSettings(userId);
  const voiceId = options.voiceId || settings.voiceId || config.elevenlabs.defaultVoiceId;
  
  try {
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: settings.stability || 0.5,
        similarity_boost: settings.similarityBoost || 0.75,
        speed: settings.speed || 1.0,
      },
    });
    
    // Collect chunks into buffer
    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    
    // Generate unique filename
    const filename = `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
    const filepath = path.join(audioDir, filename);
    
    // Save audio file
    await fs.writeFile(filepath, audioBuffer);
    
    return {
      filename,
      filepath,
      size: audioBuffer.length,
      voiceId,
    };
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    throw ApiError.internal('Failed to generate speech');
  }
};

/**
 * Generate speech and return as base64
 */
const generateSpeechBase64 = async (userId, text, options = {}) => {
  const client = getClient();
  
  if (!client) {
    // Fallback: return null to use browser TTS
    return null;
  }
  
  const settings = await getUserVoiceSettings(userId);
  const voiceId = options.voiceId || settings.voiceId || config.elevenlabs.defaultVoiceId;
  
  try {
    const audio = await client.textToSpeech.convert(voiceId, {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: settings.stability || 0.5,
        similarity_boost: settings.similarityBoost || 0.75,
        speed: settings.speed || 1.0,
      },
    });
    
    const chunks = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);
    
    return {
      audio: audioBuffer.toString('base64'),
      mimeType: 'audio/mpeg',
      voiceId,
    };
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return null; // Fallback to browser TTS
  }
};

/**
 * Clone a voice from audio samples
 */
const cloneVoice = async (userId, name, audioFiles, description = '') => {
  if (!config.elevenlabs.apiKey) {
    throw ApiError.badRequest('Voice service not configured');
  }
  
  try {
    // Use direct API call for voice cloning (more reliable than SDK)
    const FormData = require('form-data');
    const fetch = require('node-fetch');
    
    const formData = new FormData();
    formData.append('name', `${name} (${userId.slice(0, 8)})`);
    formData.append('description', description || 'Cloned voice');
    
    // Add audio files
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      formData.append('files', file, {
        filename: `sample${i}.webm`,
        contentType: 'audio/webm',
      });
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
        ...formData.getHeaders(),
      },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('ElevenLabs API error:', errorData);
      throw new Error(errorData.detail?.message || 'Voice cloning failed');
    }
    
    const voice = await response.json();
    
    // Update user's default voice to the cloned one
    await updateVoiceSettings(userId, {
      ...(await getUserVoiceSettings(userId)),
      voiceId: voice.voice_id,
      isCloned: true,
    });
    
    return {
      voiceId: voice.voice_id,
      name: voice.name,
    };
  } catch (error) {
    console.error('Voice cloning error:', error);
    throw ApiError.internal('Failed to clone voice: ' + error.message);
  }
};

/**
 * Delete a cloned voice
 */
const deleteClonedVoice = async (userId, voiceId) => {
  if (!config.elevenlabs.apiKey) {
    throw ApiError.badRequest('Voice service not configured');
  }
  
  try {
    const fetch = require('node-fetch');
    
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: 'DELETE',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to delete voice');
    }
    
    // Reset user's voice settings to default
    const settings = await getUserVoiceSettings(userId);
    if (settings.voiceId === voiceId) {
      await updateVoiceSettings(userId, {
        ...settings,
        voiceId: config.elevenlabs.defaultVoiceId,
        isCloned: false,
      });
    }
    
    return { deleted: true };
  } catch (error) {
    console.error('Delete voice error:', error);
    throw ApiError.internal('Failed to delete voice');
  }
};

module.exports = {
  getVoices,
  getUserVoiceSettings,
  updateVoiceSettings,
  generateSpeech,
  generateSpeechBase64,
  cloneVoice,
  deleteClonedVoice,
  AVAILABLE_VOICES,
};

