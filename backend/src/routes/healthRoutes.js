import { Router } from 'express';
import axios from 'axios';
import { env } from '../config/env.js';
import { getDatabaseStatus } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res) => {
  let aiServiceStatus = 'unreachable';
  try {
    const response = await axios.get(`${env.aiServiceUrl}/health`, {
      timeout: 1500,
    });
    aiServiceStatus = response.data?.status || 'ok';
  } catch {
    aiServiceStatus = 'unreachable';
  }

  res.status(200).json({
    success: true,
    service: 'careerai-backend',
    status: 'ok',
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: getDatabaseStatus(),
      aiService: aiServiceStatus,
    },
  });
});

export default router;
