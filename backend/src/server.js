import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, registerShutdown } from './config/db.js';
import { closeExpiredClasses } from './modules/classes/courseClass.service.js';

// Chặn đứng tình trạng app bị crash do các ngoại lệ bất đồng bộ chưa được bắt
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason?.message || reason);
});

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

    const listenWithRetry = (retriesLeft = 5) => {
      const server = app.listen(config.PORT, () => {
        console.log(`Edumin backend listening on http://localhost:${config.PORT}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
          console.warn(`[Server] Port ${config.PORT} đang bận (EADDRINUSE). Đang thử lại sau 1s... (${retriesLeft} lần thử còn lại)`);
          setTimeout(() => {
            try {
              server.close();
            } catch {}
            listenWithRetry(retriesLeft - 1);
          }, 1000);
        } else {
          console.error('[Server Error]:', err);
          process.exit(1);
        }
      });

      registerShutdown(server);
    };

    listenWithRetry();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
