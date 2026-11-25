import {
  analyzeSkillGapForUser,
  generateCareerRoadmapForUser,
} from '../services/skillGapService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const analyzeSkillGap = asyncHandler(async (req, res) => {
  const { jobId, targetRole } = req.body;
  const analysis = await analyzeSkillGapForUser(req.user, { jobId, targetRole });

  res.status(200).json({
    success: true,
    analysis,
  });
});

export const generateCareerRoadmap = asyncHandler(async (req, res) => {
  const { jobId, targetRole } = req.body;
  const roadmap = await generateCareerRoadmapForUser(req.user, { jobId, targetRole });

  res.status(200).json({
    success: true,
    roadmap,
  });
});
