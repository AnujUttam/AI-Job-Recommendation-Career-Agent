import { getRecommendationsForUser } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getRecommendations = asyncHandler(async (req, res) => {
  const result = await getRecommendationsForUser(req.user, req.query);
  res.status(200).json({
    success: true,
    ...result,
  });
});
