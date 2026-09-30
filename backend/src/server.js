import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, registerShutdown } from './config/db.js';

async function start() {
  try {
    await connectDatabase();
    console.log('MongoDB connected');

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

start();
