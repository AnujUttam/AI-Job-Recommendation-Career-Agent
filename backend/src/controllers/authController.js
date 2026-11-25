import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env, getJwtSecret } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const signToken = (userId) =>
  jwt.sign({ sub: userId.toString() }, getJwtSecret(), {
    expiresIn: env.jwtExpiresIn,
  });

const sanitizeUser = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.passwordHash;
  return obj;
};

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, skills, preferences } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    skills: skills || [],
    preferences: preferences || {},
  });

  const token = signToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken(user._id);

  res.status(200).json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    user: sanitizeUser(req.user),
  });
});
