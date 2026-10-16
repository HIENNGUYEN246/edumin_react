import mongoose from 'mongoose';
import { config } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(uri = config.MONGO_URI) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.connection.close();
}

/**
 * Register graceful shutdown handlers so an interrupted process closes its
 * database sockets instead of leaking connections.
 */
export function registerShutdown(server) {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
