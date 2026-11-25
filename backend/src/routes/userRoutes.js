import { Router } from 'express';
import { z } from 'zod';
import { getProfile, updateProfile } from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  headline: z.string().trim().max(150).optional(),
  currentLocation: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(1000).optional(),
  githubUrl: z.string().trim().max(255).optional(),
  linkedinUrl: z.string().trim().max(255).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  education: z.array(z.record(z.any())).optional(),
  experience: z.array(z.record(z.any())).optional(),
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
      yearsOfExperience: z.number().min(0).max(50).optional(),
      preferredLocations: z.array(z.string().trim().min(1)).optional(),
      remotePreference: z
        .enum(['Remote Only', 'Hybrid or Remote', 'Hybrid', 'Onsite', 'Any'])
        .optional(),
      desiredRoles: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
});

router.use(protect);
router.get('/profile', getProfile);
router.put('/profile', validate(updateProfileSchema), updateProfile);

export default router;
