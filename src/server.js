import mongoose from 'mongoose';
import { checkEnv, env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

async function start() {
  checkEnv();
  await connectDb();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Threads & Gems API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
