import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { requireDatabase } from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import savedJobRoutes from './routes/savedJobRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import careerRoutes from './routes/careerRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware.js';

const app = express();

// Security & CORS middleware
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check routes
app.use('/api/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);

// Core API routes (require active MongoDB connection)
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/users', requireDatabase, userRoutes);
app.use('/api/resumes', requireDatabase, resumeRoutes);
app.use('/api/jobs', requireDatabase, jobRoutes);
app.use('/api/recommendations', requireDatabase, recommendationRoutes);
app.use('/api/saved-jobs', requireDatabase, savedJobRoutes);
app.use('/api/conversations', requireDatabase, conversationRoutes);
app.use('/api/career', requireDatabase, careerRoutes);

// 404 & centralized error handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
