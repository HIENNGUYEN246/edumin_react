import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, registerShutdown } from './config/db.js';
import { closeExpiredClasses } from './modules/classes/courseClass.service.js';

async function start() {
  try {
    await connectDatabase();
    console.log('MongoDB connected');
    await closeExpiredClasses();
    const expiryTimer = setInterval(() => {
      closeExpiredClasses().catch((error) => {
        console.error('Failed to close expired class registrations:', error);
      });
    }, 60_000);
    expiryTimer.unref();

    const app = createApp();
    const server = app.listen(config.PORT, () => {
      console.log(`Edumin backend listening on http://localhost:${config.PORT}`);
    });

    registerShutdown(server);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}
  const express = require('express');
const cors = require('cors'); // <-- 1. Khai báo thư viện cors
const app = express();

// <-- 2. Kích hoạt middleware CORS cho phép mọi nguồn gọi vào
app.use(cors({
  origin: '*', // Cho phép tất cả các domain (kể cả Vercel) gọi API thoải mái
  credentials: true
}));

app.use(express.json());
start();
