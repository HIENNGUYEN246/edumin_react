import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  // 1. CORS middleware PHẢI ĐƯỢC ĐẶT LÊN ĐẦU TIÊN TRƯỚC MỌI ROUTE VÀ MIDDLEWARE KHÁC
  const corsOptions = {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // 2. Trust proxy & Helmet security headers
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(express.json({ limit: `${config.UPLOAD_MAX_MB}mb` }));
  app.use(express.urlencoded({ extended: true }));

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    // Rate limiting only gets in the way of the deterministic test suite.
    skip: () => config.isTest,
  });
  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
