import { Router } from 'express';
import { z } from 'zod';
import {
  analyzeSkillGap,
  generateCareerRoadmap,
} from '../controllers/careerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const careerQuerySchema = z.object({
  jobId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format')
    .optional(),
  targetRole: z.string().trim().max(150).optional(),
});

router.use(protect);
router.post('/skill-gap', validate(careerQuerySchema), analyzeSkillGap);
router.post('/roadmap', validate(careerQuerySchema), generateCareerRoadmap);

export default router;
