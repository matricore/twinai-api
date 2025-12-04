const express = require('express');
const datasourceController = require('../../controllers/datasource.controller');
const auth = require('../../middlewares/auth.middleware');
const { whatsappUpload, instagramUpload } = require('../../middlewares/upload.middleware');
const validate = require('../../middlewares/validate.middleware');
const datasourceValidation = require('../../validations/datasource.validation');

const router = express.Router();

// All routes require authentication
router.use(auth);

// WhatsApp import
router.post(
  '/whatsapp',
  whatsappUpload,
  datasourceController.uploadWhatsApp
);

// Instagram import
router.post(
  '/instagram',
  instagramUpload,
  datasourceController.uploadInstagram
);

// List all data sources
router.get(
  '/',
  validate(datasourceValidation.getDataSources),
  datasourceController.getDataSources
);

// Delete a data source
router.delete(
  '/:id',
  validate(datasourceValidation.dataSourceId),
  datasourceController.deleteDataSource
);

module.exports = router;
