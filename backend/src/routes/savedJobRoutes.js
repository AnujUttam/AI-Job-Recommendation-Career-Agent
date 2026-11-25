import { Router } from 'express';
import { z } from 'zod';
import {
  getSavedJobs,
  removeSavedJob,
  saveJob,
} from '../controllers/savedJobController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const jobIdParamSchema = z.object({
  jobId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid job ID format'),
});

router.use(protect);
router.get('/', getSavedJobs);
router.post('/:jobId', validate(jobIdParamSchema, 'params'), saveJob);
router.delete('/:jobId', validate(jobIdParamSchema, 'params'), removeSavedJob);

export default router;
