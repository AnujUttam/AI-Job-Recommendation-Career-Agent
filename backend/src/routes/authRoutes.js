import { Router } from 'express';
import { z } from 'zod';
import { getMe, login, register } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  skills: z.array(z.string().trim()).optional(),
  preferences: z
    .object({
      experienceLevel: z
        .enum([
          'Student / Intern',
          'Entry Level (0-2 yrs)',
          'Mid Level (2-5 yrs)',
          'Senior (5+ yrs)',
        ])
        .optional(),
      preferredLocations: z.array(z.string().trim()).optional(),
      remotePreference: z
        .enum(['Remote Only', 'Hybrid or Remote', 'Hybrid', 'Onsite', 'Any'])
        .optional(),
      desiredRoles: z.array(z.string().trim()).optional(),
    })
    .optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);

export default router;
