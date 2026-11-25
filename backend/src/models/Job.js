import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    niceToHaveSkills: {
      type: [String],
      default: [],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
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
    location: {
      type: String,
      required: true,
      trim: true,
    },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
      default: 'Full-time',
    },
    workMode: {
      type: String,
      enum: ['Remote', 'Hybrid', 'Onsite'],
      default: 'Hybrid',
    },
    salaryRange: {
      type: String,
      trim: true,
      default: 'Competitive',
    },
    source: {
      type: String,
      trim: true,
      default: 'CareerAI Curated',
    },
    applyUrl: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

jobSchema.index({
  title: 'text',
  company: 'text',
  description: 'text',
  requiredSkills: 'text',
});

export const Job = mongoose.model('Job', jobSchema);
