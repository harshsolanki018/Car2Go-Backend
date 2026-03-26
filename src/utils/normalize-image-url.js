function normalizeImageUrl(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice(7)}`;
  }
  return trimmed;
}

module.exports = {
  normalizeImageUrl,
};
