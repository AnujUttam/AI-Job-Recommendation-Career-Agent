export default function SkillBadge({ label, variant = 'neutral', onRemove }) {
  const variants = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    accent: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    matched: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    missing: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${variants[variant] || variants.neutral}`}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="rounded text-current opacity-65 hover:opacity-100 focus:outline-none"
        >
          ×
        </button>
      )}
    </span>
  );
}
