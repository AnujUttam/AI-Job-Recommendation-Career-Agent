import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center text-slate-900">
      <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">404</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        The CareerAI route you requested does not exist. Return to your dashboard to continue.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
