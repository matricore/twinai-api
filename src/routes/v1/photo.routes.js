const express = require('express');
const photoController = require('../../controllers/photo.controller');
const auth = require('../../middlewares/auth.middleware');
const { uploadPhoto } = require('../../middlewares/upload.middleware');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Upload and analyze photo
router.post('/upload', uploadPhoto.single('photo'), photoController.uploadPhoto);

// Get all photos
router.get('/', photoController.getPhotos);

// Get photo stats
router.get('/stats', photoController.getStats);

// Get single photo
router.get('/:photoId', photoController.getPhoto);

// Delete photo
router.delete('/:photoId', photoController.deletePhoto);

module.exports = router;

