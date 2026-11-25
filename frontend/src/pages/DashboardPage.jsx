import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  Bookmark,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import StatCard from '../components/common/StatCard';
import SectionCard from '../components/common/SectionCard';
import SkillBadge from '../components/common/SkillBadge';
import MatchBadge from '../components/common/MatchBadge';
import JobCard from '../components/jobs/JobCard';

export default function DashboardPage() {
  const {
    profile,
    resume,
    rankedJobs,
    jobsLoading,
    jobsError,
    rankingMode,
    refreshJobs,
    savedJobIds,
    recentlyViewedJobs,
    conversations,
    toggleSaveJob,
    openJobDetail,
  } = useCareer();

  const totalJobs = rankedJobs.length;
  const strongMatches = rankedJobs.filter((j) => (j.matchPercentage || 0) >= 85).length;
  const goodMatches = rankedJobs.filter(
    (j) => (j.matchPercentage || 0) >= 75 && (j.matchPercentage || 0) < 85
  ).length;
  const moderateMatches = rankedJobs.filter((j) => (j.matchPercentage || 0) < 75).length;
  const avgMatch =
    totalJobs > 0
      ? Math.round(
          rankedJobs.reduce((sum, job) => sum + (job.matchPercentage || 0), 0) / totalJobs
        )
      : 0;

  const topRecommended = rankedJobs.slice(0, 4);
  const savedJobsList = rankedJobs.filter((j) => savedJobIds.includes(j.id)).slice(0, 4);

  const missingSkillCounts = new Map();
  for (const job of rankedJobs.slice(0, 5)) {
    for (const s of job.missingSkills || []) {
      missingSkillCounts.set(s, (missingSkillCounts.get(s) || 0) + 1);
    }
  }
  const topSkillGaps = Array.from(missingSkillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill, count]) => ({ skill, count }));

  const firstName = (profile.fullName || 'Candidate').split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-navy-900 via-navy-800 to-indigo-900 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              AI Career Overview
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {firstName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {totalJobs > 0 ? (
                <>
                  Your profile matches{' '}
                  <span className="font-semibold text-white">{strongMatches} high-fit roles</span>{' '}
                  above 85%. Review your ranked matches or analyze skill gaps for your target role.
                </>
              ) : (
                'Upload your resume or update your skills to start matching against indexed roles.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/resume"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:bg-slate-100"
            >
              <FileText className="h-4 w-4 text-indigo-600" />
              Resume Analyzer
            </Link>
            <Link
              to="/career-plan"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/40 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
            >
              <Compass className="h-4 w-4" />
              Skill Gap &amp; Roadmap
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {jobsError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {jobsError}
          </span>
          <button
            type="button"
            onClick={refreshJobs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Top KPI Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Total Jobs Available"
          value={jobsLoading ? '...' : totalJobs}
          helper={rankingMode === 'hybrid_semantic' ? 'Semantic + MongoDB catalog' : 'MongoDB job catalog'}
          accent="navy"
        />
        <StatCard
          icon={TrendingUp}
          label="Average Match Score"
          value={jobsLoading ? '...' : `${avgMatch}%`}
          helper={`${strongMatches} strong matches (85%+)`}
          accent="indigo"
        />
        <StatCard
          icon={Award}
          label="Resume Readiness"
          value={`${resume.completionPercentage}%`}
          helper={`ATS Score: ${resume.atsScore}/100`}
          accent="violet"
        />
        <StatCard
          icon={Bookmark}
          label="Saved Jobs"
          value={savedJobIds.length}
          helper="Persisted to your account"
          accent="emerald"
        />
      </section>

      {/* Profile Summary, Resume Completion & Skill Gap Progress */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Candidate Profile"
          subtitle="Active matching context"
          action={
            <Link
              to="/profile"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Edit Profile
            </Link>
          }
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {profile.fullName || 'Candidate'}
              </h3>
              <p className="text-sm font-medium text-indigo-600">{profile.headline}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                {profile.currentLocation || 'Location not set'} • {profile.experienceLevel}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Target Roles
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.desiredRoles.length > 0 ? (
                  profile.desiredRoles.map((role) => (
                    <SkillBadge key={role} label={role} variant="accent" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No target roles specified yet.</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Preferred Locations
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {profile.preferredLocations.length > 0
                  ? `${profile.preferredLocations.join(', ')} (${profile.remotePreference})`
                  : profile.remotePreference}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Resume Completion"
          subtitle={resume.fileName}
          action={
            <Link
              to="/resume"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Analyze PDF
            </Link>
          }
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-600">Profile Completeness</span>
                <span className="font-semibold text-indigo-600">
                  {resume.completionPercentage}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"
                  style={{ width: `${resume.completionPercentage}%` }}
                />
              </div>
            </div>

            <ul className="space-y-2">
              {resume.sectionsCompleted.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <span className={item.completed ? 'text-slate-700' : 'text-slate-400'}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        <SectionCard
          title="Career Progress & Skill Gaps"
          subtitle="Top gaps across your best matches"
          action={
            <Link
              to="/career-plan"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Full Analysis
            </Link>
          }
        >
          <div className="space-y-4">
            <MatchBar
              label="Strong Fit (85% - 100%)"
              count={strongMatches}
              total={totalJobs}
              barClass="bg-indigo-600"
            />
            <MatchBar
              label="Good Fit (75% - 84%)"
              count={goodMatches}
              total={totalJobs}
              barClass="bg-violet-500"
            />
            <MatchBar
              label="Stretch (< 75%)"
              count={moderateMatches}
              total={totalJobs}
              barClass="bg-slate-400"
            />

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Top Missing Skills
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {topSkillGaps.length > 0 ? (
                  topSkillGaps.map(({ skill }) => (
                    <SkillBadge key={skill} label={skill} variant="missing" />
                  ))
                ) : (
                  <span className="text-xs text-slate-500">
                    {totalJobs === 0
                      ? 'Load jobs to inspect skill gaps.'
                      : 'No missing skills across your top 5 matches.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Recommended Jobs */}
      <SectionCard
        title="Recommended Jobs"
        subtitle={
          rankingMode === 'hybrid_semantic'
            ? 'Hybrid semantic similarity + skill & experience ranking'
            : 'Ranked by skill overlap, experience fit, and preferences'
        }
        action={
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View all {totalJobs} jobs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {jobsLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
            <span>Loading personalized job recommendations...</span>
          </div>
        ) : topRecommended.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">
            No jobs found in the database yet. Seed jobs on the backend to populate recommendations.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {topRecommended.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                compact
                isSaved={savedJobIds.includes(job.id)}
                onToggleSave={toggleSaveJob}
                onViewDetails={openJobDetail}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Skills Overview, Saved Jobs & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Skills Overview"
          subtitle={`${profile.skills.length} skills in your profile`}
          action={
            <Link
              to="/profile"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Manage
            </Link>
          }
        >
          {profile.skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              No skills added yet. Upload a PDF resume or add skills in Profile &amp; Preferences.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <SkillBadge key={skill} label={skill} variant="neutral" />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Saved Jobs"
          subtitle={`${savedJobIds.length} bookmarked roles`}
          action={
            <Link
              to="/jobs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Explore
            </Link>
          }
        >
          {savedJobsList.length === 0 ? (
            <p className="text-sm text-slate-500">
              Bookmark jobs in Job Explorer to keep track of them here.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {savedJobsList.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openJobDetail(job.id)}
                      className="truncate text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                    >
                      {job.title}
                    </button>
                    <p className="text-xs text-slate-500">
                      {job.company} • {job.location}
                    </p>
                  </div>
                  <MatchBadge score={job.matchPercentage || 0} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent Activity" subtitle="Viewed roles & assistant threads">
          <div className="space-y-4">
            {recentlyViewedJobs.length === 0 && conversations.length === 0 ? (
              <p className="text-sm text-slate-500">
                Inspect a job or start an AI Career Assistant conversation to see recent activity.
              </p>
            ) : (
              <>
                {recentlyViewedJobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openJobDetail(job.id)}
                      className="flex min-w-0 items-center gap-2 text-left text-xs font-medium text-slate-800 hover:text-indigo-600"
                    >
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">
                        Viewed {job.title} ({job.company})
                      </span>
                    </button>
                  </div>
                ))}

                {conversations.slice(0, 2).map((conv) => (
                  <Link
                    key={conv._id}
                    to="/assistant"
                    className="flex items-center gap-2 text-xs font-medium text-slate-700 hover:text-indigo-600"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <span className="truncate">
                      Chat: {conv.title || 'Career Guidance Session'}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MatchBar({ label, count, total, barClass }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-900">
          {count} {count === 1 ? 'role' : 'roles'} ({pct}%)
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
