const express = require('express');
const ttsController = require('../../controllers/tts.controller');
const auth = require('../../middlewares/auth.middleware');
const multer = require('multer');

const router = express.Router();

// Multer for voice cloning audio uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  },
});

// All routes require authentication
router.use(auth);

// Get available voices
router.get('/voices', ttsController.getVoices);

// Get user's voice settings
router.get('/settings', ttsController.getSettings);

// Update voice settings
router.put('/settings', ttsController.updateSettings);

// Generate speech (returns base64)
router.post('/generate', ttsController.generateSpeech);

// Stream speech (returns audio file)
router.post('/stream', ttsController.streamSpeech);

// Clone voice from audio samples
router.post('/clone', upload.array('audio', 5), ttsController.cloneVoice);

// Delete cloned voice
router.delete('/voices/:voiceId', ttsController.deleteVoice);

module.exports = router;

