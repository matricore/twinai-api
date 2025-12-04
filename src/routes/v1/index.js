const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const chatRoutes = require('./chat.routes');
const memoryRoutes = require('./memory.routes');
const datasourceRoutes = require('./datasource.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/memories', memoryRoutes);
router.use('/datasources', datasourceRoutes);

module.exports = router;
