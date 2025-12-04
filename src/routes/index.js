const express = require('express');
const v1Routes = require('./v1');

const router = express.Router();

router.use('/v1', v1Routes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

