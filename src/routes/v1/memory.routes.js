const express = require('express');
const memoryController = require('../../controllers/memory.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const memoryValidation = require('../../validations/memory.validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.post('/', validate(memoryValidation.createMemory), memoryController.createMemory);

router.get('/search', validate(memoryValidation.searchMemories), memoryController.searchMemories);

router.get('/', validate(memoryValidation.getMemories), memoryController.getMemories);

router.delete('/:id', validate(memoryValidation.memoryId), memoryController.deleteMemory);

module.exports = router;

