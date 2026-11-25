import { Bookmark, Bot, Building2, CheckCircle2, Compass, MapPin, X, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCareer } from '../../context/CareerContext';
import MatchBadge from '../common/MatchBadge';
import SkillBadge from '../common/SkillBadge';

export default function JobDetailModal() {
  const { selectedJob, closeJobDetail, savedJobIds, toggleSaveJob, sendMessage } = useCareer();
  const navigate = useNavigate();

  if (!selectedJob) return null;

  const isSaved = savedJobIds.includes(selectedJob.id);

  const handleAskAssistant = () => {
    const prompt = `What skills am I missing for ${selectedJob.title} at ${selectedJob.company} and how strong is my match?`;
    closeJobDetail();
    navigate('/assistant');
    sendMessage(prompt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="job-modal-title" className="text-lg font-bold text-slate-900">
                {selectedJob.title}
              </h2>
              <MatchBadge score={selectedJob.matchPercentage} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Building2 className="h-4 w-4 text-slate-400" />
                {selectedJob.company}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4 text-slate-400" />
                {selectedJob.location} ({selectedJob.workMode})
              </span>
              <span>• {selectedJob.salaryRange}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeJobDetail}
            aria-label="Close job details"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Role Overview</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {selectedJob.description}
            </p>
          </div>

          {selectedJob.responsibilities?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Key Responsibilities</h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
                {selectedJob.responsibilities.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Matched Skills ({selectedJob.matchedSkills?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedJob.matchedSkills?.length ? (
                  selectedJob.matchedSkills.map((skill) => (
                    <SkillBadge key={skill} label={skill} variant="matched" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No direct skill overlaps yet.</span>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <AlertCircle className="h-4 w-4" />
                Skill Gaps ({selectedJob.missingSkills?.length || 0})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedJob.missingSkills?.length ? (
                  selectedJob.missingSkills.map((skill) => (
                    <SkillBadge key={skill} label={skill} variant="missing" />
                  ))
                ) : (
                  <span className="text-xs text-emerald-700">All required skills covered!</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleSaveJob(selectedJob.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                isSaved
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Saved' : 'Save Job'}
            </button>

            <button
              type="button"
              onClick={handleAskAssistant}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <Bot className="h-4 w-4" />
              Analyze Fit with AI
            </button>

            <button
              type="button"
              onClick={() => {
                const targetId = selectedJob.id;
                closeJobDetail();
                navigate(`/career-plan?jobId=${targetId}`);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100"
            >
              <Compass className="h-4 w-4" />
              Skill Gap &amp; Roadmap
            </button>
          </div>

          <button
            type="button"
            disabled
            title="External ATS application links are disabled in demo mode"
            className="cursor-not-allowed rounded-lg bg-slate-200 px-4 py-2 text-xs font-medium text-slate-500"
          >
            External Apply (Demo Only)
          </button>
        </div>
      </div>
    </div>
  );
}
