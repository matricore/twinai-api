const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { errorConverter, errorHandler } = require('./middlewares/error.middleware');
const ApiError = require('./utils/ApiError');

const app = express();

// Security headers
app.use(helmet());

// CORS
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',') 
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', routes);

// 404 handler
app.use((_req, _res, next) => {
  next(ApiError.notFound('Endpoint not found'));
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  console.info(`🚀 TwinAI API running on port ${config.port}`);
  console.info(`📍 Environment: ${config.env}`);
});

// Graceful shutdown
const shutdown = () => {
  console.info('Shutting down gracefully...');
  server.close(() => {
    console.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;

