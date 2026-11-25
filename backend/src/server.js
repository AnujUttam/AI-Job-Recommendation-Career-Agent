import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';

const startServer = async () => {
  await connectDatabase();

  app.listen(env.port, () => {
    console.log(`[Server] CareerAI backend running on http://localhost:${env.port}`);
  });
};

startServer();
