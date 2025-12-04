const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const chatRoutes = require('./chat.routes');
const memoryRoutes = require('./memory.routes');
const datasourceRoutes = require('./datasource.routes');
const twinRoutes = require('./twin.routes');
const questionRoutes = require('./question.routes');
const photoRoutes = require('./photo.routes');
const voiceRoutes = require('./voice.routes');
const notificationRoutes = require('./notification.routes');
const ttsRoutes = require('./tts.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/memories', memoryRoutes);
router.use('/datasources', datasourceRoutes);
router.use('/twin', twinRoutes);
router.use('/questions', questionRoutes);
router.use('/photos', photoRoutes);
router.use('/voice', voiceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tts', ttsRoutes);

module.exports = router;
