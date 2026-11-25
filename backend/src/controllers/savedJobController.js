import { Job } from '../models/Job.js';
import { SavedJob } from '../models/SavedJob.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const saveJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const job = await Job.findById(jobId).lean();
  if (!job) {
    throw new ApiError(404, 'Job not found');
  }

  const savedJob = await SavedJob.findOneAndUpdate(
    { userId: req.user._id, jobId },
    { $setOnInsert: { userId: req.user._id, jobId } },
    { upsert: true, new: true }
  );

  res.status(201).json({
    success: true,
    savedJob,
  });
});

export const getSavedJobs = asyncHandler(async (req, res) => {
  const records = await SavedJob.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate('jobId')
    .lean();

  const savedJobs = records
    .filter((item) => Boolean(item.jobId))
    .map((item) => ({
      savedId: item._id,
      savedAt: item.createdAt,
      job: item.jobId,
    }));

  res.status(200).json({
    success: true,
    savedJobs,
  });
});

export const removeSavedJob = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const deleted = await SavedJob.findOneAndDelete({
    userId: req.user._id,
    jobId,
  });

  if (!deleted) {
    throw new ApiError(404, 'Saved job entry not found');
  }

  res.status(200).json({
    success: true,
    message: 'Removed job from saved list',
    jobId,
  });
});
