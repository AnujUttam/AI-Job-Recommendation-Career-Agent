import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import { filterJobs, searchJobsRemote } from '../services/jobService';
import JobCard from '../components/jobs/JobCard';

export default function JobExplorerPage() {
  const {
    profile,
    rankedJobs,
    jobsLoading,
    jobsError,
    refreshJobs,
    savedJobIds,
    toggleSaveJob,
    openJobDetail,
  } = useCareer();

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('All');
  const [experience, setExperience] = useState('All');
  const [skill, setSkill] = useState('All');
  const [jobType, setJobType] = useState('All');
  const [savedOnly, setSavedOnly] = useState(false);

  const [remoteResults, setRemoteResults] = useState(null);
  const [searchMode, setSearchMode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const filterOptions = useMemo(() => {
    const locations = new Set();
    const experiences = new Set();
    const skills = new Set();
    const types = new Set();

    for (const job of rankedJobs) {
      locations.add(job.location);
      if (job.workMode === 'Remote') locations.add('Remote');
      experiences.add(job.experienceLevel);
      types.add(job.jobType);
      types.add(job.workMode);
      for (const s of job.requiredSkills || []) {
        skills.add(s);
      }
    }

    return {
      locations: ['All', ...Array.from(locations).sort()],
      experiences: ['All', ...Array.from(experiences)],
      skills: ['All', ...Array.from(skills).sort()],
      types: ['All', ...Array.from(types).sort()],
    };
  }, [rankedJobs]);

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setRemoteResults(null);
      setSearchMode('');
      setSearchError('');
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        const res = await searchJobsRemote(
          { search: trimmed, location, experience, skill, jobType },
          profile
        );
        setRemoteResults(res.jobs);
        setSearchMode(res.searchMode);
      } catch (err) {
        setSearchError(err.message || 'Search failed.');
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, location, experience, skill, jobType, profile]);

  const filteredJobs = useMemo(() => {
    const base =
      remoteResults !== null
        ? filterJobs(remoteResults, { search: '', location, experience, skill, jobType })
        : filterJobs(rankedJobs, { search, location, experience, skill, jobType });
    return savedOnly ? base.filter((j) => savedJobIds.includes(j.id)) : base;
  }, [
    remoteResults,
    rankedJobs,
    search,
    location,
    experience,
    skill,
    jobType,
    savedOnly,
    savedJobIds,
  ]);

  const hasActiveFilters =
    search.trim() !== '' ||
    location !== 'All' ||
    experience !== 'All' ||
    skill !== 'All' ||
    jobType !== 'All' ||
    savedOnly;

  const resetFilters = () => {
    setSearch('');
    setLocation('All');
    setExperience('All');
    setSkill('All');
    setJobType('All');
    setSavedOnly(false);
    setRemoteResults(null);
    setSearchMode('');
    setSearchError('');
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs semantically or by keyword (e.g., FastAPI, React, Qdrant)..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSavedOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                savedOnly
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${savedOnly ? 'fill-current' : ''}`} />
              Saved ({savedJobIds.length})
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Location"
            value={location}
            onChange={setLocation}
            options={filterOptions.locations}
          />
          <FilterSelect
            label="Experience Level"
            value={experience}
            onChange={setExperience}
            options={filterOptions.experiences}
          />
          <FilterSelect
            label="Required Skill"
            value={skill}
            onChange={setSkill}
            options={filterOptions.skills}
          />
          <FilterSelect
            label="Job Type / Mode"
            value={jobType}
            onChange={setJobType}
            options={filterOptions.types}
          />
        </div>
      </section>

      {(jobsError || searchError) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {searchError || jobsError}
          </span>
          <button
            type="button"
            onClick={refreshJobs}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p className="flex items-center gap-2">
          {searching || jobsLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          )}
          Showing <span className="font-semibold text-slate-900">{filteredJobs.length}</span>{' '}
          {filteredJobs.length === 1 ? 'role' : 'roles'}
        </p>

        {searchMode && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {searchMode === 'semantic' ? 'Semantic Vector Search (Qdrant)' : 'Keyword Search (MongoDB)'}
          </span>
        )}
      </div>

      {/* Job Cards Grid */}
      {jobsLoading && rankedJobs.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          <span>Loading job listings...</span>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No jobs match your filters</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing one or more filters to broaden your job search.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white hover:bg-navy-800"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isSaved={savedJobIds.includes(job.id)}
              onToggleSave={toggleSaveJob}
              onViewDetails={openJobDetail}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}
