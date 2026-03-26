const User = require('../models/user.model');
const asyncHandler = require('../utils/async-handler');
const HttpError = require('../utils/http-error');
const { USER_ROLES } = require('../constants/enums');
const { verifyAccessToken } = require('../services/token.service');
const env = require('../config/env');

function parseCookies(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split('=');
    const key = String(rawKey || '').trim();
    if (!key) {
      return cookies;
    }

    const value = rawValue.join('=') || '';
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});
}

function getAccessToken(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme === 'Bearer' && token) {
    return token;
  }

  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[env.authCookieName] || null;
}

async function attachUserFromToken(req, enforceAuth) {
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    if (enforceAuth) {
      throw new HttpError(401, 'Unauthorized');
    }
    req.user = null;
    return;
  }

  let decoded;
  try {
    decoded = verifyAccessToken(accessToken);
  } catch {
    if (enforceAuth) {
      throw new HttpError(401, 'Invalid or expired token');
    }
    req.user = null;
    return;
  }

  const user = await User.findOne({ id: decoded.userId });
  if (!user) {
    if (enforceAuth) {
      throw new HttpError(401, 'Unauthorized');
    }
    req.user = null;
    return;
  }

  if (user.blocked) {
    if (enforceAuth) {
      throw new HttpError(403, 'Your account has been blocked by admin.');
    }
    req.user = null;
    return;
  }

  req.user = user;
}

const requireAuth = asyncHandler(async (req, res, next) => {
  await attachUserFromToken(req, true);
  next();
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  await attachUserFromToken(req, false);
  next();
});

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      next(new HttpError(403, 'Forbidden'));
      return;
    }
    next();
  };
}

const requireAdmin = [requireAuth, requireRole(USER_ROLES.ADMIN)];
const requireOwner = [requireAuth, requireRole(USER_ROLES.OWNER)];

module.exports = {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireOwner,
};
