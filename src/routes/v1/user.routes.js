const express = require('express');
const userController = require('../../controllers/user.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const userValidation = require('../../validations/user.validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/me', userController.getProfile);

router.patch('/me', validate(userValidation.updateProfile), userController.updateProfile);

router.post('/me/change-password', validate(userValidation.changePassword), userController.changePassword);

router.delete('/me', userController.deleteAccount);

module.exports = router;

