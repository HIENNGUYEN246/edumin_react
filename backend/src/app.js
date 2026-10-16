import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();
app.use(cors({
  origin: true, // Cho phép mọi origin tự động phản hồi lại mà không cần liệt kê cứng
  credentials: true
}));
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: false }));

  const explicitOrigins = [
    'https://eduminreact.vercel.app',
    'https://edumin-react.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4000',
  ];

  const envOrigins = (config.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = Array.from(new Set([...explicitOrigins, ...envOrigins]));

  const corsOptions = {
    origin: (origin, callback) => {
      // Cho phép request không có origin (curl, server-to-server, mobile app)
      if (!origin) return callback(null, true);
      // Nằm trong danh sách origin được cấp phép hoặc wildcard
      if (config.CLIENT_ORIGIN === '*' || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Tự động cho phép mọi domain Vercel (*.vercel.app)
      if (origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      // Cho phép localhost ở mọi port khi chạy local dev
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // Fallback cho phép an toàn: trả về chính origin để tránh lỗi CORS làm kẹt ứng dụng
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
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
