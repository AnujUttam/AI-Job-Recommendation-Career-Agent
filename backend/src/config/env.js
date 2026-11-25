import dotenv from 'dotenv';

dotenv.config();

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

export const env = {
  port: parsePositiveInt(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: (process.env.MONGO_URI || '').trim(),
  jwtSecret: (process.env.JWT_SECRET || '').trim(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, ''),
  aiServiceTimeoutMs: parsePositiveInt(process.env.AI_SERVICE_TIMEOUT_MS, 25000),
  internalApiKey: (process.env.INTERNAL_API_KEY || '').trim(),
  maxResumeFileSizeMb: parsePositiveInt(process.env.MAX_RESUME_FILE_SIZE_MB, 5),
};

export const getJwtSecret = () => {
  if (env.jwtSecret) {
    return env.jwtSecret;
  }
  if (env.nodeEnv === 'production') {
    throw new Error('JWT_SECRET environment variable must be configured in production.');
  }
  // Ephemeral runtime secret only used in non-production when JWT_SECRET is omitted
  if (!globalThis.__careerAiDevJwtSecret) {
    globalThis.__careerAiDevJwtSecret = `dev-ephemeral-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.warn('[Auth] JWT_SECRET is not set. Using an ephemeral development secret.');
  }
  return globalThis.__careerAiDevJwtSecret;
};
