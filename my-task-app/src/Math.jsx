import { Link } from 'react-router-dom';

export default function MathPage() {
  return (
    <div className="min-h-screen pt-20 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <h1 className="text-3xl font-semibold mb-4">Math</h1>
        <p className="text-slate-700 dark:text-slate-300 mb-6">
          This is your new math page. Add formulas, problems, or any math content here.
        </p>
        <Link to="/" className="inline-block px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700">
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
