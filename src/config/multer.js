const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'car_rental',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    resource_type: 'image',
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('Only JPG, JPEG, PNG, or WEBP images are allowed.');
    error.statusCode = 400;
    cb(error);
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

module.exports = {
  upload,
  uploadSingle: (field) => upload.single(field),
  uploadArray: (field, maxCount = 5) => upload.array(field, maxCount),
};
