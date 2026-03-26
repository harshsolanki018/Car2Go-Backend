const HttpError = require('./http-error');

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function isImageDataUrl(value) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

function isRemoteUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

function getBase64ByteSize(base64) {
  if (!base64) {
    return 0;
  }
  const paddingMatches = base64.match(/=+$/);
  const padding = paddingMatches ? paddingMatches[0].length : 0;
  return Math.ceil((base64.length * 3) / 4) - padding;
}

function validateImageDataUrl(value, label, maxBytes = DEFAULT_MAX_BYTES) {
  if (!value) {
    return;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${label} must be a valid image file.`);
  }
  if (isRemoteUrl(value)) {
    return;
  }
  if (!isImageDataUrl(value)) {
    throw new HttpError(400, `${label} must be a valid image file.`);
  }
  const base64 = value.split(',')[1] || '';
  const size = getBase64ByteSize(base64);
  if (!size) {
    throw new HttpError(400, `${label} must be a valid image file.`);
  }
  if (size > maxBytes) {
    throw new HttpError(
      400,
      `${label} must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`
    );
  }
}

module.exports = {
  validateImageDataUrl,
};
