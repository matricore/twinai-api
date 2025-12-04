const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Memory storage (files stored in memory as Buffer)
const storage = multer.memoryStorage();

// Disk storage for photos (needed for Gemini Vision)
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

// File filter for text files (WhatsApp exports)
const textFileFilter = (_req, file, cb) => {
  const allowedMimes = ['text/plain', 'application/octet-stream'];
  const allowedExts = ['.txt'];
  
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only .txt files are allowed'), false);
  }
};

// File filter for ZIP files (Instagram exports)
const zipFileFilter = (_req, file, cb) => {
  const allowedMimes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
  const allowedExts = ['.zip'];
  
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only .zip files are allowed'), false);
  }
};

// File filter for images
const imageFileFilter = (_req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only image files (jpg, png, gif, webp) are allowed'), false);
  }
};

// File filter for audio
const audioFileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'audio/webm',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only audio files are allowed'), false);
  }
};

// Disk storage for audio (needed for Gemini)
const audioDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

// WhatsApp export upload (single .txt file, max 50MB)
const whatsappUpload = multer({
  storage,
  fileFilter: textFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
}).single('file');

// Instagram export upload (single .zip file, max 500MB)
const instagramUpload = multer({
  storage,
  fileFilter: zipFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
    files: 1,
  },
}).single('file');

// Photo upload (single image to disk, max 10MB)
const uploadPhoto = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

// Multiple photo upload (to memory)
const photoUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
}).array('photos', 10);

// Audio upload (single audio to disk, max 25MB)
const uploadAudio = multer({
  storage: audioDiskStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 1,
  },
});

// Wrapper to handle multer errors
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest('File too large'));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(ApiError.badRequest('Too many files'));
      }
      return next(ApiError.badRequest(err.message));
    }
    if (err) {
      return next(err);
    }
    next();
  });
};

module.exports = {
  whatsappUpload: handleUpload(whatsappUpload),
  instagramUpload: handleUpload(instagramUpload),
  photoUpload: handleUpload(photoUpload),
  uploadPhoto,
  uploadAudio,
};
