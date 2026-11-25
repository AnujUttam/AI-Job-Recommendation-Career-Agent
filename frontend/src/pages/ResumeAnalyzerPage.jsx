import { useRef, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  FileText,
  FolderGit2,
  GraduationCap,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useCareer } from '../context/CareerContext';
import { analyzeResumePdf, validateResumeFile } from '../services/resumeService';
import SectionCard from '../components/common/SectionCard';
import SkillBadge from '../components/common/SkillBadge';

export default function ResumeAnalyzerPage() {
  const { resume, applyParsedResume } = useCareer();
  const fileInputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleFile = async (file) => {
    setError('');
    setStatusMessage('');

    const validationError = validateResumeFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setProgress(10);
    setStageText('Preparing upload...');

    try {
      const parsed = await analyzeResumePdf(file, (pct, stage) => {
        setProgress(pct);
        setStageText(stage);
      });
      applyParsedResume(parsed);
      setStatusMessage(
        `Parsed "${parsed.fileName}" successfully (Demo Mode) and updated your skill profile.`
      );
    } catch (err) {
      setError(err.message || 'Failed to analyze resume.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Upload Area */}
      <SectionCard
        title="Upload Resume (PDF)"
        subtitle="Drop your resume to extract skills, education, work experience, and projects"
        action={
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            Active: {resume.fileName} ({resume.fileSizeKb} KB)
          </span>
        }
      >
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/70'
              : 'border-slate-300 bg-slate-50/60 hover:border-indigo-300'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <UploadCloud className="h-6 w-6" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-900">
            Drag and drop your PDF resume here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports PDF up to 10 MB • Parsed securely with structured extraction
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
          >
            {uploading ? 'Analyzing Resume...' : 'Choose PDF File'}
          </button>
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
              <span>{stageText}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {statusMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </SectionCard>

      {/* Analysis Summary + ATS Score */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Resume Analysis Summary"
          subtitle="AI-generated structural & ATS review"
          className="lg:col-span-2"
        >
          <p className="text-sm leading-relaxed text-slate-700">{resume.summary}</p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                Key Strengths
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700">
                {resume.strengths.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                <Sparkles className="h-4 w-4" />
                Recommended Improvements
              </h3>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700">
                {resume.improvements.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="ATS & Completeness" subtitle="Section extraction coverage">
          <div className="flex items-baseline justify-between rounded-xl bg-navy-900 p-4 text-white">
            <div>
              <p className="text-xs text-slate-300">Estimated ATS Fit</p>
              <p className="mt-1 text-3xl font-bold">{resume.atsScore}/100</p>
            </div>
            <FileText className="h-8 w-8 text-indigo-400" />
          </div>

          <ul className="mt-5 space-y-2.5">
            {resume.sectionsCompleted.map((sec) => (
              <li key={sec.key} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{sec.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    sec.completed
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {sec.completed ? 'Extracted' : 'Missing'}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {/* Extracted Skills */}
      <SectionCard
        title="Extracted Skills"
        subtitle="Categorized technical skills detected from your resume"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(resume.extractedSkills).map(([category, skills]) => (
            <div key={category} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {category === 'DataAndAI' ? 'Data & AI' : category}
              </h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <SkillBadge key={skill} label={skill} variant="accent" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Experience & Education */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Work Experience"
          subtitle="Extracted roles and achievements"
          className="lg:col-span-2"
        >
          <div className="space-y-6">
            {resume.experience.map((exp) => (
              <div key={exp.id} className="border-l-2 border-indigo-200 pl-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Briefcase className="h-4 w-4 text-indigo-600" />
                      {exp.role}
                    </h3>
                    <p className="text-xs font-medium text-slate-600">
                      {exp.company} • {exp.location}
                    </p>
                  </div>
                  <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {exp.duration}
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  {exp.highlights.map((bullet, idx) => (
                    <li key={idx}>• {bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Education" subtitle="Academic credentials">
          <div className="space-y-4">
            {resume.education.map((edu) => (
              <div key={edu.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-start gap-2.5">
                  <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{edu.degree}</h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{edu.institution}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {edu.duration} • {edu.grade}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {edu.highlights}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Projects */}
      <SectionCard title="Extracted Projects" subtitle="Technical builds highlighted on your resume">
        <div className="grid gap-4 md:grid-cols-2">
          {resume.projects.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-5"
            >
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FolderGit2 className="h-4 w-4 text-indigo-600" />
                {project.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{project.description}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {project.techStack.map((tech) => (
                  <SkillBadge key={tech} label={tech} variant="violet" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
