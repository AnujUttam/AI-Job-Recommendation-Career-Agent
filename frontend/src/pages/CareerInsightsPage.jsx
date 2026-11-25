import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  FolderGit2,
  Layers,
  Loader2,
  Milestone,
  Sparkles,
  Target,
} from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import {
  fetchCareerRoadmap,
  fetchSkillGapAnalysis,
} from '../services/careerService';
import SectionCard from '../components/common/SectionCard';
import SkillBadge from '../components/common/SkillBadge';

export default function CareerInsightsPage() {
  const { profile, rankedJobs } = useCareer();
  const [searchParams] = useSearchParams();
  const initialJobId = searchParams.get('jobId') || '';

  const [mode, setMode] = useState(initialJobId ? 'job' : 'role');
  const [selectedJobId, setSelectedJobId] = useState(initialJobId);
  const [targetRole, setTargetRole] = useState(
    profile.desiredRoles?.[0] || 'AI Engineer'
  );

  const [analysis, setAnalysis] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async (overrideParams = null) => {
    setError('');
    setLoadingAnalysis(true);
    try {
      const params = overrideParams || (mode === 'job' ? { jobId: selectedJobId } : { targetRole });
      if (mode === 'job' && !params.jobId) {
        setError('Please select a job listing to analyze.');
        setLoadingAnalysis(false);
        return;
      }
      const data = await fetchSkillGapAnalysis(params);
      setAnalysis(data);
    } catch (err) {
      setError(err.message || 'Failed to run skill gap analysis.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const runRoadmap = async () => {
    setError('');
    setLoadingRoadmap(true);
    try {
      const params = mode === 'job' ? { jobId: selectedJobId } : { targetRole };
      if (mode === 'job' && !params.jobId) {
        setError('Please select a job listing before generating a roadmap.');
        setLoadingRoadmap(false);
        return;
      }
      const data = await fetchCareerRoadmap(params);
      setRoadmap(data);
    } catch (err) {
      setError(err.message || 'Failed to generate career roadmap.');
    } finally {
      setLoadingRoadmap(false);
    }
  };

  useEffect(() => {
    if (initialJobId) {
      setMode('job');
      setSelectedJobId(initialJobId);
      runAnalysis({ jobId: initialJobId });
    } else if (rankedJobs.length > 0 && !analysis) {
      runAnalysis({ targetRole });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId]);

  return (
    <div className="space-y-6">
      {/* Target Selection Toolbar */}
      <SectionCard
        title="Skill Gap Analysis & Career Roadmap"
        subtitle="Compare your saved profile & resume skills against real job requirements"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('role')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                mode === 'role'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Analyze by Target Role
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('job');
                if (!selectedJobId && rankedJobs.length > 0) {
                  setSelectedJobId(rankedJobs[0].id);
                }
              }}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                mode === 'job'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Analyze Specific Job Listing
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {mode === 'role' ? (
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Target Role Keyword
                </span>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g., AI Engineer, Full Stack Developer, Backend Developer"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </label>
            ) : (
              <label className="flex-1">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">
                  Select Target Job Listing
                </span>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Choose a job --</option>
                  {rankedJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {job.company} ({job.location})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={loadingAnalysis}
                onClick={() => runAnalysis()}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
              >
                {loadingAnalysis ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Target className="h-4 w-4" />
                )}
                Analyze Skill Gap
              </button>

              <button
                type="button"
                disabled={loadingRoadmap}
                onClick={runRoadmap}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loadingRoadmap ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Compass className="h-4 w-4" />
                )}
                Generate Roadmap
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Skill Gap Results */}
      {analysis && (
        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard
            title={`Skill Match: ${analysis.scopeLabel}`}
            subtitle={analysis.formulaExplanation}
            className="lg:col-span-2"
          >
            {analysis.targetJobsCount === 0 ? (
              <p className="text-sm text-slate-500">
                No job listings matched that target role in the database. Try a broader role title
                or seed jobs first.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-indigo-700">
                      Skill Match Score
                    </p>
                    <p className="mt-1 text-3xl font-bold text-navy-900">
                      {analysis.skillMatchPercentage}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                        style={{ width: `${analysis.skillMatchPercentage}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      Based on {analysis.candidateSkills.length} verified candidate skills from your
                      profile and uploaded resume.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Matched Skills ({analysis.matchedSkills.length})
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {analysis.matchedSkills.length > 0 ? (
                        analysis.matchedSkills.map((s) => (
                          <SkillBadge key={s} label={s} variant="matched" />
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">
                          No overlapping required skills found yet.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-4">
                    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                      <AlertCircle className="h-4 w-4" />
                      Missing Required Skills ({analysis.missingSkills.length})
                    </h3>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {analysis.missingSkills.length > 0 ? (
                        analysis.missingSkills.map((s) => (
                          <SkillBadge key={s} label={s} variant="missing" />
                        ))
                      ) : (
                        <span className="text-xs text-emerald-700">
                          You cover all required skills for this target!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {analysis.niceToHaveGaps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Optional / Nice-to-Have Skills
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {analysis.niceToHaveGaps.map((s) => (
                        <SkillBadge key={s} label={s} variant="neutral" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Learning Priorities"
            subtitle="Ranked by demand across target jobs"
          >
            {analysis.learningPriorities.length === 0 ? (
              <p className="text-sm text-slate-500">
                No missing required skills to prioritize right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {analysis.learningPriorities.map((item) => (
                  <li
                    key={item.skill}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.rank}. {item.skill}
                      </p>
                      <p className="text-xs text-slate-500">
                        Required in {item.jobsRequiring} of {item.totalTargetJobs}{' '}
                        {item.totalTargetJobs === 1 ? 'role' : 'roles'}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.priority === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.priority}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* Personalized Career Roadmap */}
      {roadmap && (
        <SectionCard
          title={`Personalized Career Roadmap — ${roadmap.careerGoal}`}
          subtitle={`Estimated Timeline: ${roadmap.estimatedTimeline} • Level: ${roadmap.experienceLevel}`}
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              {roadmap.generatedSuggestions?.isTemplateGenerated
                ? 'Deterministic Template Roadmap'
                : 'AI-Generated Roadmap'}
            </span>
          }
        >
          <div className="space-y-6">
            {/* Clearly distinguish verified requirements vs generated assumptions */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Verified Job-Market Requirements
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {roadmap.verifiedMarketRequirements?.length > 0 ? (
                    roadmap.verifiedMarketRequirements.map((req) => (
                      <SkillBadge key={req} label={req} variant="accent" />
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">
                      No job requirements loaded for this target.
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
                  Timeline &amp; Planning Assumptions
                </h3>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
                  {roadmap.assumptions.map((a, idx) => (
                    <li key={idx}>• {a}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Learning Stages */}
            <div className="grid gap-4 md:grid-cols-2">
              {(roadmap.generatedSuggestions?.stages || []).map((stage) => (
                <div
                  key={stage.stage}
                  className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Layers className="h-4 w-4 text-indigo-600" />
                      Stage {stage.stage}: {stage.title}
                    </h4>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {stage.timeline}
                    </span>
                  </div>

                  {stage.skillsToLearn?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {stage.skillsToLearn.map((skill) => (
                        <SkillBadge key={skill} label={skill} variant="violet" />
                      ))}
                    </div>
                  )}

                  {stage.suggestedProjects?.length > 0 && (
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <FolderGit2 className="h-3.5 w-3.5 text-indigo-600" />
                        Suggested Project Work
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-600">
                        {stage.suggestedProjects.map((p, idx) => (
                          <li key={idx}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {stage.milestones?.length > 0 && (
                    <div className="mt-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Milestone className="h-3.5 w-3.5 text-emerald-600" />
                        Practical Milestones
                      </p>
                      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-600">
                        {stage.milestones.map((m, idx) => (
                          <li key={idx}>• {m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
