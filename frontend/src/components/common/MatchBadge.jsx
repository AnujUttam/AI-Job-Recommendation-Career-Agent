export default function MatchBadge({ score }) {
  let colorClass = 'border-slate-200 bg-slate-100 text-slate-700';
  if (score >= 85) {
    colorClass = 'border-indigo-200 bg-indigo-50 text-indigo-700';
  } else if (score >= 75) {
    colorClass = 'border-violet-200 bg-violet-50 text-violet-700';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${colorClass}`}
      title="Personalized hybrid match score"
    >
      <span>{score}% Match</span>
    </span>
  );
}
