const AdmZip = require('adm-zip');
const whatsappService = require('../services/whatsapp.service');
const instagramService = require('../services/instagram.service');
const twitterService = require('../services/twitter.service');
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

const uploadInstagram = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded');
  }

  const { ownerName } = req.body;
  
  if (!ownerName) {
    throw ApiError.badRequest('ownerName is required - this is your Instagram username');
  }

  // Extract ZIP file
  const zip = new AdmZip(req.file.buffer);
  const zipEntries = zip.getEntries();
  
  // Parse JSON files from ZIP
  const files = {};
  
  for (const entry of zipEntries) {
    const filename = entry.entryName.toLowerCase();
    
    // Skip directories and non-JSON files
    if (entry.isDirectory || !filename.endsWith('.json')) {
      continue;
    }
    
    try {
      const content = zip.readAsText(entry);
      const data = JSON.parse(content);
      
      // Use just the filename without path
      const baseName = filename.split('/').pop();
      files[baseName] = data;
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  if (Object.keys(files).length === 0) {
    throw ApiError.badRequest('No valid JSON files found in the ZIP. Make sure you uploaded the correct Instagram export.');
  }

  const result = await instagramService.processInstagramExport(
    req.user.id,
    files,
    ownerName
  );

  success(res, result, 'Instagram export uploaded and processing started');
});

const uploadTwitter = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest('No file uploaded');
  }

  // Extract ZIP file
  const zip = new AdmZip(req.file.buffer);
  const zipEntries = zip.getEntries();
  
  // Parse JS/JSON files from ZIP (Twitter uses .js format)
  const files = {};
  
  for (const entry of zipEntries) {
    const filename = entry.entryName.toLowerCase();
    
    // Skip directories
    if (entry.isDirectory) {
      continue;
    }
    
    // Twitter exports are in /data/ folder and use .js extension
    if (!filename.endsWith('.js') && !filename.endsWith('.json')) {
      continue;
    }
    
    // Only process relevant files
    const relevantFiles = ['tweet', 'like', 'profile', 'account', 'direct-message', 'dm'];
    const isRelevant = relevantFiles.some((f) => filename.includes(f));
    
    if (!isRelevant) {
      continue;
    }
    
    try {
      const content = zip.readAsText(entry);
      const baseName = filename.split('/').pop();
      files[baseName] = content; // Keep as raw content, parser will extract JSON
    } catch {
      continue;
    }
  }

  if (Object.keys(files).length === 0) {
    throw ApiError.badRequest('No valid Twitter data files found in the ZIP. Make sure you uploaded the correct Twitter/X export.');
  }

  const result = await twitterService.processTwitterExport(req.user.id, files);

  success(res, result, 'Twitter export uploaded and processing started');
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
  uploadInstagram,
  uploadTwitter,
  getDataSources,
  deleteDataSource,
};
