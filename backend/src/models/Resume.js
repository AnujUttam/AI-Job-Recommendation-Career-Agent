import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  fileSizeKb: {
    type: Number,
    default: 0,
  },
  extractedText: {
    type: String,
    default: '',
  },
  parsedProfile: {
    summary: { type: String, default: '' },
    atsScore: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    extractedSkills: { type: mongoose.Schema.Types.Mixed, default: {} },
    education: { type: [mongoose.Schema.Types.Mixed], default: [] },
    experience: { type: [mongoose.Schema.Types.Mixed], default: [] },
    projects: { type: [mongoose.Schema.Types.Mixed], default: [] },
    strengths: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

export const Resume = mongoose.model('Resume', resumeSchema);
