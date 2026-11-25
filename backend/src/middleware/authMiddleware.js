import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication required. Provide a Bearer token.');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ApiError(401, 'Authentication token missing.');
  }

  const decoded = jwt.verify(token, getJwtSecret());
  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new ApiError(401, 'User associated with token no longer exists.');
  }

  req.user = user;
  next();
});
