import { NavLink } from 'react-router-dom';
import {
  Bot,
  Briefcase,
  Compass,
  FileText,
  LayoutDashboard,
  Sparkles,
  UserCog,
  X,
} from 'lucide-react';
import { useCareer } from '../../context/CareerContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/resume', label: 'Resume Analyzer', icon: FileText },
  { to: '/jobs', label: 'Job Explorer', icon: Briefcase },
  { to: '/career-plan', label: 'Skill Gap & Roadmap', icon: Compass },
  { to: '/assistant', label: 'AI Career Assistant', icon: Bot },
  { to: '/profile', label: 'Profile & Preferences', icon: UserCog },
];

export default function Sidebar({ open, onClose }) {
  const { resume } = useCareer();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-slate-200 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">CareerAI</span>
              <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
                Beta
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Primary Navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-white/10 bg-navy-800/80 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">Resume ATS Score</span>
            <span className="font-semibold text-indigo-300">{resume.atsScore}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{ width: `${resume.atsScore}%` }}
            />
          </div>
          <p className="mt-2 truncate text-[11px] text-slate-400">{resume.fileName}</p>
        </div>
      </aside>
    </>
  );
}
