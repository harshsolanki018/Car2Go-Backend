const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const apiRoutes = require('./routes');
const notFoundMiddleware = require('./middlewares/not-found.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

const allowedOrigins = env.clientOrigin
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function toOriginMatcher(origin) {
  if (!origin.includes('*')) {
    return origin;
  }
  const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `^${escaped.replace(/\*/g, '.*')}$`;
  return new RegExp(pattern);
}

const allowedOriginMatchers = allowedOrigins.map(toOriginMatcher);

function isOriginAllowed(origin) {
  return allowedOriginMatchers.some((matcher) =>
    matcher instanceof RegExp ? matcher.test(origin) : matcher === origin
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
if (env.httpLogs) {
  app.use(morgan('dev'));
}

app.use('/api', apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;

