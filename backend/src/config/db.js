import mongoose from 'mongoose';
import { env } from './env.js';
import { ApiError } from '../utils/ApiError.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const connectDatabase = async (uriOverride = null) => {
  const targetUri = (uriOverride || env.mongoUri || '').trim();
  if (!targetUri) {
    console.warn('[DB] MONGO_URI is not set. Starting backend without a database connection.');
    return false;
  }

  try {
    await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[DB] Connected to MongoDB (${mongoose.connection.name})`);
    return true;
  } catch (error) {
    console.error(`[DB] MongoDB connection error: ${error.message}`);
    return false;
  }
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

export const getDatabaseStatus = () => {
  if (!env.mongoUri && mongoose.connection.readyState === 0) {
    return 'not_configured';
  }
  return READY_STATES[mongoose.connection.readyState] || 'unknown';
};

export const requireDatabase = (_req, _res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return next(
      new ApiError(503, 'Database is currently unavailable. Please try again later.')
    );
  }
  return next();
};
