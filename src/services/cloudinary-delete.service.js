const cloudinary = require('../config/cloudinary');

async function deleteImage(publicId) {
  if (!publicId) {
    return;
  }
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

async function deleteImages(publicIds = []) {
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    return;
  }
  await Promise.all(
    publicIds.filter(Boolean).map((publicId) => deleteImage(publicId))
  );
}

module.exports = {
  deleteImage,
  deleteImages,
};
