import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const educationSchema = new mongoose.Schema(
  {
    degree: { type: String, trim: true, default: '' },
    institution: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    grade: { type: String, trim: true, default: '' },
    highlights: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    role: { type: String, trim: true, default: '' },
    company: { type: String, trim: true, default: '' },
    location: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    highlights: { type: [String], default: [] },
  },
  { _id: false }
);

const preferencesSchema = new mongoose.Schema(
  {
    experienceLevel: {
      type: String,
      enum: [
        'Student / Intern',
        'Entry Level (0-2 yrs)',
        'Mid Level (2-5 yrs)',
        'Senior (5+ yrs)',
      ],
      default: 'Entry Level (0-2 yrs)',
    },
    yearsOfExperience: { type: Number, min: 0, max: 50, default: 0 },
    preferredLocations: { type: [String], default: [] },
    remotePreference: {
      type: String,
      enum: ['Remote Only', 'Hybrid or Remote', 'Hybrid', 'Onsite', 'Any'],
      default: 'Hybrid or Remote',
    },
    desiredRoles: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    headline: { type: String, trim: true, default: '' },
    currentLocation: { type: String, trim: true, default: '' },
    bio: { type: String, trim: true, default: '' },
    githubUrl: { type: String, trim: true, default: '' },
    linkedinUrl: { type: String, trim: true, default: '' },
    skills: { type: [String], default: [] },
    education: { type: [educationSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    preferences: { type: preferencesSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePassword = async function comparePassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

export const User = mongoose.model('User', userSchema);
