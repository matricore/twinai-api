const express = require('express');
const twinController = require('../../controllers/twin.controller');
const auth = require('../../middlewares/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/profile', twinController.getProfile);
router.get('/dashboard', twinController.getDashboard);

module.exports = router;

