import dns from 'dns';
import { execSync } from 'child_process';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, registerShutdown } from './config/db.js';
import { closeExpiredClasses } from './modules/classes/courseClass.service.js';

function freePortOnWindows(port) {
  if (process.platform !== 'win32') return;
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && Number(pid) > 0 && Number(pid) !== process.pid) {
          console.warn(`[Auto-Recovery] Phát hiện tiến trình mồ côi (PID: ${pid}) đang chiếm giữ cổng ${port}. Đang tự động giải phóng...`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`[Auto-Recovery] Đã giải phóng cổng ${port} thành công!`);
          } catch {}
        }
      }
    }
  } catch {}
}

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
    try {
      await closeExpiredClasses();
    } catch (e) {
      console.warn('[Startup Warning] closeExpiredClasses:', e?.message || e);
    }

    const expiryTimer = setInterval(() => {
      closeExpiredClasses().catch((error) => {
        console.error('Failed to close expired class registrations:', error);
      });
    }, 60_000);
    expiryTimer.unref();

    const app = createApp();

    const listenWithRetry = (retriesLeft = 30) => {
      const server = app.listen(config.PORT, () => {
        console.log(`Edumin backend listening on http://localhost:${config.PORT}`);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          if (retriesLeft > 0) {
            console.warn(`[Server] Port ${config.PORT} đang bận (EADDRINUSE). Đang tự động thử lại sau 1s... (${retriesLeft} lần thử còn lại)`);
            if (retriesLeft <= 28) {
              freePortOnWindows(config.PORT);
            }
            setTimeout(() => {
              try {
                if (typeof server.closeAllConnections === 'function') {
                  server.closeAllConnections();
                }
                server.close();
              } catch {}
              listenWithRetry(retriesLeft - 1);
            }, 1000);
          } else {
            console.warn(`[Server] Port ${config.PORT} vẫn đang bận sau nhiều lần thử. Đang giải phóng cổng và thử lại vòng mới...`);
            freePortOnWindows(config.PORT);
            setTimeout(() => listenWithRetry(10), 2000);
          }
        } else {
          console.error('[Server Error]:', err);
        }
      });

      registerShutdown(server);
    };

    listenWithRetry();
  } catch (error) {
    console.error('Lỗi khi khởi động server:', error?.message || error);
    console.log('Đang chờ 3s để tự động khởi động lại...');
    setTimeout(start, 3000);
  }
}

start();
