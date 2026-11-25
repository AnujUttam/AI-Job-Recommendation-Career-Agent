import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'name',
    'headline',
    'currentLocation',
    'bio',
    'githubUrl',
    'linkedinUrl',
    'skills',
    'education',
    'experience',
    'preferences',
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!updatedUser) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    user: updatedUser,
  });
});
