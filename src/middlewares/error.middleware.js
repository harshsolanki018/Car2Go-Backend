function errorMiddleware(err, req, res, next) {
  const statusCode = err?.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[Error]', err);
  }
  if (err && err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File size must be 2MB or smaller.'
        : err.message || 'File upload failed.';
    res.status(400).json({
      success: false,
      message,
    });
    return;
  }

  if (err && err.statusCode === 400 && /image/i.test(err.message || '')) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }
  if (err && err.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Duplicate value detected. Please use a unique value.',
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = errorMiddleware;
