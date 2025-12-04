const whatsappService = require('../services/whatsapp.service');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { success, noContent } = require('../utils/response');

const uploadWhatsApp = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded');
  }

  const { ownerName } = req.body;
  
  if (!ownerName) {
    throw ApiError.badRequest('ownerName is required - this is your name as it appears in the chat');
  }

  const result = await whatsappService.processWhatsAppExport(
    req.user.id,
    req.file.buffer,
    ownerName
  );

  success(res, result, 'WhatsApp export uploaded and processing started');
});

const getDataSources = catchAsync(async (req, res) => {
  const { type } = req.query;
  const dataSources = await whatsappService.getDataSources(req.user.id, type);
  success(res, { dataSources });
});

const deleteDataSource = catchAsync(async (req, res) => {
  await whatsappService.deleteDataSource(req.user.id, req.params.id);
  noContent(res);
});

module.exports = {
  uploadWhatsApp,
  getDataSources,
  deleteDataSource,
};

