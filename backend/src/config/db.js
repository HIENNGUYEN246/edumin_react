import dns from 'dns';
import mongoose from 'mongoose';
import { config } from './env.js';

// Khắc phục triệt để lỗi querySrv ECONNREFUSED trên Windows / mạng gia đình khi phân giải MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {}

mongoose.set('strictQuery', true);

// Lắng nghe các sự kiện kết nối của Mongoose để chống crash app khi mạng chập chờn
mongoose.connection.on('error', (err) => {
  console.error('[MongoDB Error]:', err?.message || err);
});
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Warning]: Mất kết nối tạm thời tới cơ sở dữ liệu. Đang tự động kết nối lại...');
});
mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB Info]: Đã kết nối lại thành công với cơ sở dữ liệu.');
});

export async function connectDatabase(uri = config.MONGO_URI, maxRetries = 5, retryDelayMs = 2500) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      return mongoose.connection;
    } catch (err) {
      console.warn(
        `[MongoDB Warning] Kết nối CSDL lần ${attempt}/${maxRetries} chưa thành công: ${err?.message || err}. Thử lại sau ${retryDelayMs / 1000}s...`
      );
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.connection.close();
  } catch {}
}

/**
 * Register graceful shutdown handlers so an interrupted process closes its
 * database sockets instead of leaking connections or keeping ports busy.
 */
export function registerShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    try {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(async () => {
        await disconnectDatabase();
        process.exit(0);
      });
    } catch {
      await disconnectDatabase();
      process.exit(0);
    }
    // Safety exit cleanly after 1.5s if keep-alives linger
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Hỗ trợ nodemon restart sạch sẽ, giải phóng port 4000 trước khi nodemon khởi động lại tiến trình mới
  process.once('SIGUSR2', () => {
    try {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close(async () => {
        await disconnectDatabase();
        process.kill(process.pid, 'SIGUSR2');
      });
    } catch {
      process.kill(process.pid, 'SIGUSR2');
    }
  });
}
