import * as jobService from '../services/jobService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getJobs = asyncHandler(async (req, res) => {
  const result = await jobService.listJobs(req.query);
  res.status(200).json({
    success: true,
    ...result,
  });
});

export const searchJobs = asyncHandler(async (req, res) => {
  const result = await jobService.searchJobs(req.query);
  res.status(200).json({
    success: true,
    ...result,
  });
});

export const getJobById = asyncHandler(async (req, res) => {
  const job = await jobService.getJobById(req.params.id);
  res.status(200).json({
    success: true,
    job,
  });
});

export const createJob = asyncHandler(async (req, res) => {
  const job = await jobService.createJob(req.body);
  res.status(201).json({
    success: true,
    job,
  });
});

export const syncJobsToQdrant = asyncHandler(async (_req, res) => {
  const result = await jobService.syncAllJobsToQdrant();
  res.status(result.available ? 200 : 503).json({
    success: Boolean(result.available),
    ...result,
  });
});
