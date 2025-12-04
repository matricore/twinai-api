const express = require('express');
const authController = require('../../controllers/auth.controller');
const validate = require('../../middlewares/validate.middleware');
const authValidation = require('../../validations/auth.validation');

const router = express.Router();

router.post('/register', validate(authValidation.register), authController.register);

router.post('/login', validate(authValidation.login), authController.login);

router.post('/google', validate(authValidation.googleAuth), authController.googleAuth);

router.post('/apple', validate(authValidation.appleAuth), authController.appleAuth);

router.post('/refresh', validate(authValidation.refreshToken), authController.refreshToken);

router.post('/logout', validate(authValidation.refreshToken), authController.logout);

module.exports = router;

