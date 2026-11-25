import { Router } from 'express';
import { z } from 'zod';
import { getResumeById, getResumes, uploadResume } from '../controllers/resumeController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadResumePdf } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid resume ID format'),
});

router.use(protect);
router.post('/upload', uploadResumePdf, uploadResume);
router.get('/', getResumes);
router.get('/:id', validate(idParamSchema, 'params'), getResumeById);

export default router;
