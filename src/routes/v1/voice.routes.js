const express = require('express');
const voiceController = require('../../controllers/voice.controller');
const auth = require('../../middlewares/auth.middleware');
const { uploadAudio } = require('../../middlewares/upload.middleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Send voice message
router.post('/message', uploadAudio.single('audio'), voiceController.sendVoiceMessage);

module.exports = router;

