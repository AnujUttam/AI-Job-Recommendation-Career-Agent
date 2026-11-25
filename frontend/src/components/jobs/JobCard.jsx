import { Bookmark, Building2, Clock, MapPin } from 'lucide-react';
import MatchBadge from '../common/MatchBadge';
import SkillBadge from '../common/SkillBadge';

export default function JobCard({ job, isSaved, onToggleSave, onViewDetails, compact = false }) {
  return (
    <article className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-indigo-200">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">{job.title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {job.company}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {job.location} • {job.workMode}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {job.postedAgo}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MatchBadge score={job.matchPercentage} />
            <button
              type="button"
              onClick={() => onToggleSave(job.id)}
              aria-label={isSaved ? 'Remove from saved jobs' : 'Save job'}
              title={isSaved ? 'Saved' : 'Save job'}
              className={`rounded-lg border p-2 transition-colors ${
                isSaved
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {!compact && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {job.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {job.matchedSkills?.slice(0, compact ? 3 : 4).map((skill) => (
            <SkillBadge key={skill} label={skill} variant="matched" />
          ))}
          {job.missingSkills?.slice(0, compact ? 1 : 2).map((skill) => (
            <SkillBadge key={skill} label={`Gap: ${skill}`} variant="missing" />
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {job.jobType}
          </span>
          <span>{job.experienceLevel}</span>
          {job.salaryRange && <span>• {job.salaryRange}</span>}
        </div>

        <button
          type="button"
          onClick={() => onViewDetails(job.id)}
          className="rounded-lg bg-navy-900 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy-800"
        >
          View Details
        </button>
      </div>
    </article>
  );
}
