import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const storage = multer.memoryStorage();

const pdfFileFilter = (_req, file, cb) => {
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdfMime && !isPdfExt) {
    return cb(new ApiError(400, 'Only PDF files (.pdf) are allowed.'), false);
  }
  cb(null, true);
};

export const uploadResumePdf = multer({
  storage,
  fileFilter: pdfFileFilter,
  limits: {
    fileSize: env.maxResumeFileSizeMb * 1024 * 1024,
  },
}).single('resume');

export const assertValidPdfBuffer = (file) => {
  if (!file || !file.buffer || file.buffer.length < 5) {
    throw new ApiError(400, 'Uploaded PDF file is empty or missing.');
  }
  const header = file.buffer.subarray(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new ApiError(400, 'Invalid PDF file signature.');
  }
};
