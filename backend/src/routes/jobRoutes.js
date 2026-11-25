import { Router } from 'express';
import { z } from 'zod';
import {
  createJob,
  getJobById,
  getJobs,
  searchJobs,
  syncJobsToQdrant,
} from '../controllers/jobController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const jobIdParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format'),
});

const createJobSchema = z.object({
  title: z.string().trim().min(2).max(150),
  company: z.string().trim().min(1).max(120),
  description: z.string().trim().min(10),
  requiredSkills: z.array(z.string().trim().min(1)).default([]),
  niceToHaveSkills: z.array(z.string().trim().min(1)).optional(),
  responsibilities: z.array(z.string().trim().min(1)).optional(),
  experienceLevel: z
    .enum([
      'Student / Intern',
      'Entry Level (0-2 yrs)',
      'Mid Level (2-5 yrs)',
      'Senior (5+ yrs)',
    ])
    .default('Entry Level (0-2 yrs)'),
  location: z.string().trim().min(1).max(120),
  employmentType: z
    .enum(['Full-time', 'Part-time', 'Contract', 'Internship'])
    .default('Full-time'),
  workMode: z.enum(['Remote', 'Hybrid', 'Onsite']).default('Hybrid'),
  salaryRange: z.string().trim().max(100).optional(),
  source: z.string().trim().max(100).optional(),
  applyUrl: z.string().trim().max(300).optional(),
});

router.get('/', getJobs);
router.get('/search', searchJobs);
router.post('/sync-vectors', protect, syncJobsToQdrant);
router.get('/:id', validate(jobIdParamSchema, 'params'), getJobById);
router.post('/', protect, validate(createJobSchema), createJob);

export default router;
