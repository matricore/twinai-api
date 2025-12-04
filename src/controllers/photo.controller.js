const photoService = require('../services/photo.service');
const catchAsync = require('../utils/catchAsync');
const { success } = require('../utils/response');
const ApiError = require('../utils/ApiError');

const uploadPhoto = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No photo file provided');
  }

  const { description } = req.body;
  
  const result = await photoService.analyzePhoto(
    req.user.id,
    req.file.path,
    req.file.originalname,
    description
  );

  success(res, result, 'Photo analyzed successfully');
});

const getPhotos = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const offset = parseInt(req.query.offset) || 0;
  const category = req.query.category || null;

  const result = await photoService.getPhotos(req.user.id, limit, offset, category);
  success(res, result);
});

const getPhoto = catchAsync(async (req, res) => {
  const photo = await photoService.getPhoto(req.user.id, req.params.photoId);
  success(res, photo);
});

const deletePhoto = catchAsync(async (req, res) => {
  await photoService.deletePhoto(req.user.id, req.params.photoId);
  success(res, null, 'Photo deleted successfully');
});

const getStats = catchAsync(async (req, res) => {
  const stats = await photoService.getPhotoStats(req.user.id);
  success(res, stats);
});

module.exports = {
  uploadPhoto,
  getPhotos,
  getPhoto,
  deletePhoto,
  getStats,
};

