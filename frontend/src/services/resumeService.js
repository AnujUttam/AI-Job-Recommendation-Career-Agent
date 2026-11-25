import { apiClient, getAuthToken } from '../api/client';

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate an uploaded resume file before parsing.
 */
export function validateResumeFile(file) {
  if (!file) {
    return 'Please select a PDF file to upload.';
  }
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return 'Only PDF resumes are supported (.pdf).';
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return 'File size must be under 5 MB.';
  }
  return null;
}

const deriveSectionsCompleted = (parsed) => {
  const skillsCount = Object.values(parsed?.extractedSkills || {}).flat().length;
  return [
    { key: 'summary', label: 'Professional Summary', completed: Boolean(parsed?.summary?.trim()) },
    { key: 'skills', label: 'Technical Skills', completed: skillsCount > 0 },
    {
      key: 'experience',
      label: 'Work Experience',
      completed: Array.isArray(parsed?.experience) && parsed.experience.length > 0,
    },
    {
      key: 'projects',
      label: 'Key Projects',
      completed: Array.isArray(parsed?.projects) && parsed.projects.length > 0,
    },
    {
      key: 'education',
      label: 'Education',
      completed: Array.isArray(parsed?.education) && parsed.education.length > 0,
    },
  ];
};

const mapBackendResume = (saved, fallbackFileName = 'Resume.pdf', fallbackSizeKb = 0) => {
  const parsed = saved?.parsedProfile || {};
  return {
    id: saved?._id,
    fileName: saved?.fileName || fallbackFileName,
    fileSizeKb: saved?.fileSizeKb || fallbackSizeKb,
    uploadedAt: saved?.uploadedAt || new Date().toISOString(),
    summary: parsed.summary || '',
    atsScore: typeof parsed.atsScore === 'number' ? parsed.atsScore : 0,
    completionPercentage:
      typeof parsed.completionPercentage === 'number' ? parsed.completionPercentage : 0,
    sectionsCompleted: deriveSectionsCompleted(parsed),
    extractedSkills: parsed.extractedSkills || {},
    education: Array.isArray(parsed.education) ? parsed.education : [],
    experience: Array.isArray(parsed.experience) ? parsed.experience : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
  };
};

/**
 * Fetch the authenticated user's latest persisted resume from MongoDB.
 */
export async function getLatestResume() {
  if (!getAuthToken()) return null;
  const { data } = await apiClient.get('/resumes');
  const latest = Array.isArray(data?.resumes) ? data.resumes[0] : null;
  return latest ? mapBackendResume(latest) : null;
}

/**
 * Upload resume PDF to backend and parse with AI service.
 */
export async function analyzeResumePdf(file, onProgress) {
  if (!getAuthToken()) {
    throw new Error('Authentication required to upload and analyze resumes.');
  }

  if (onProgress) onProgress(30, 'Uploading PDF to server...');
  const formData = new FormData();
  formData.append('resume', file);

  if (onProgress) onProgress(65, 'Extracting text and analyzing structure...');
  const { data } = await apiClient.post('/resumes/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

  if (onProgress) onProgress(100, 'Resume parsed and saved.');
  const saved = data?.resume;
  if (!saved?.parsedProfile) {
    throw new Error('Server returned an unexpected resume response.');
  }

  return mapBackendResume(
    saved,
    file.name,
    Math.max(1, Math.round(file.size / 1024))
  );
}
