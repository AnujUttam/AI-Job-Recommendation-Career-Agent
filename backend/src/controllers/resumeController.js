import axios from 'axios';
import { env } from '../config/env.js';
import { Resume } from '../models/Resume.js';
import { User } from '../models/User.js';
import { assertValidPdfBuffer } from '../middleware/uploadMiddleware.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const KNOWN_SKILLS = [
  'Python',
  'JavaScript',
  'TypeScript',
  'Java',
  'Spring Boot',
  'React',
  'Node.js',
  'Express',
  'FastAPI',
  'MongoDB',
  'PostgreSQL',
  'SQL',
  'Docker',
  'Kubernetes',
  'AWS',
  'Tailwind CSS',
  'PyTorch',
  'LangGraph',
  'Qdrant',
  'REST APIs',
  'Git',
];

const extractReadablePdfText = (buffer) => {
  const raw = buffer.toString('latin1');
  const matches = raw.match(/[A-Za-z0-9.,:;!?@#&()\-+/\s]{4,}/g) || [];
  return matches
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000);
};

const buildFallbackParsedProfile = (extractedText, user) => {
  const lower = extractedText.toLowerCase();
  const detectedSkills = KNOWN_SKILLS.filter((skill) =>
    lower.includes(skill.toLowerCase())
  );
  const mergedSkills = Array.from(
    new Set([...(user?.skills || []), ...detectedSkills])
  );

  const hasEducation = /university|institute|b\.?tech|bachelor|master|college|cgpa/i.test(
    extractedText
  );
  const hasExperience = /intern|engineer|developer|experience|company/i.test(extractedText);
  const hasProjects = /project|github|built|developed/i.test(extractedText);

  const completedSections = [
    Boolean(extractedText.length > 40),
    mergedSkills.length > 0,
    hasExperience,
    hasProjects,
    hasEducation,
  ].filter(Boolean).length;

  const completionPercentage = Math.min(100, Math.max(40, completedSections * 20));
  const atsScore = Math.min(95, 55 + mergedSkills.length * 3 + completedSections * 4);

  return {
    summary: `Extracted ${mergedSkills.length} technical skills and structured profile metadata from uploaded PDF.`,
    atsScore,
    completionPercentage,
    extractedSkills: {
      Detected: mergedSkills,
    },
    education: user?.education || [],
    experience: user?.experience || [],
    projects: [],
    strengths: [
      mergedSkills.length > 0
        ? `Identified ${mergedSkills.length} relevant technical keywords.`
        : 'Valid PDF structure detected.',
    ],
    improvements: [
      'Ensure quantified metrics (latency, accuracy, scale) accompany each role or project.',
    ],
  };
};

const isValidParsedProfile = (profile) =>
  Boolean(
    profile &&
      typeof profile === 'object' &&
      typeof profile.summary === 'string' &&
      typeof profile.atsScore === 'number'
  );

export const uploadResume = asyncHandler(async (req, res) => {
  assertValidPdfBuffer(req.file);

  let extractedText = extractReadablePdfText(req.file.buffer);
  let parsedProfile = null;

  if (env.aiServiceUrl) {
    try {
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: 'application/pdf' });
      formData.append('file', blob, req.file.originalname);

      const response = await axios.post(`${env.aiServiceUrl}/ai/parse-resume`, formData, {
        timeout: env.aiServiceTimeoutMs,
        headers: env.internalApiKey ? { 'X-Internal-API-Key': env.internalApiKey } : {},
      });

      if (!isValidParsedProfile(response.data?.parsedProfile)) {
        throw new ApiError(502, 'AI service returned an invalid parsedProfile payload.');
      }

      parsedProfile = response.data.parsedProfile;
      if (typeof response.data.extractedText === 'string' && response.data.extractedText.trim()) {
        extractedText = response.data.extractedText.trim();
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error.code === 'ECONNABORTED') {
        throw new ApiError(504, 'AI resume parsing request timed out.');
      }

      if (error.response) {
        const aiStatus = error.response.status;
        const aiMessage =
          error.response.data?.error?.message ||
          error.response.data?.message ||
          'AI service failed to process resume.';

        if (aiStatus === 401 || aiStatus === 403) {
          throw new ApiError(502, 'AI service internal authentication failed.');
        }

        const mappedStatus = [400, 413, 422, 502, 503, 504].includes(aiStatus) ? aiStatus : 502;
        throw new ApiError(mappedStatus, aiMessage);
      }

      const isUnreachable = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code);
      if (!isUnreachable) {
        throw new ApiError(502, 'Unexpected error communicating with AI service.');
      }
      // Fall back only when AI service is unreachable in offline/standalone dev mode.
    }
  }

  if (!parsedProfile) {
    parsedProfile = buildFallbackParsedProfile(extractedText, req.user);
  }

  const resume = await Resume.create({
    userId: req.user._id,
    fileName: req.file.originalname,
    fileSizeKb: Math.max(1, Math.round(req.file.size / 1024)),
    extractedText,
    parsedProfile,
  });

  const detected = Object.values(parsedProfile.extractedSkills || {}).flat();
  if (detected.length > 0) {
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { skills: { $each: detected } },
    });
  }

  res.status(201).json({
    success: true,
    resume,
  });
});

export const getResumes = asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id })
    .sort({ uploadedAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    resumes,
  });
});

export const getResumeById = asyncHandler(async (req, res) => {
  const resume = await Resume.findById(req.params.id).lean();
  if (!resume) {
    throw new ApiError(404, 'Resume not found');
  }
  if (resume.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have permission to access this resume');
  }

  res.status(200).json({
    success: true,
    resume,
  });
});
