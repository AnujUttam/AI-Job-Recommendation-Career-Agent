import { Router } from 'express';
import { z } from 'zod';
import {
  createOrAppendConversation,
  getConversationById,
  getConversations,
} from '../controllers/conversationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid conversation ID format'),
});

const messageBodySchema = z.object({
  conversationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid conversation ID format')
    .optional(),
  title: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1, 'Message cannot be empty').max(4000),
});

router.use(protect);
router.get('/', getConversations);
router.post('/', validate(messageBodySchema), createOrAppendConversation);
router.get('/:id', validate(idParamSchema, 'params'), getConversationById);

export default router;
