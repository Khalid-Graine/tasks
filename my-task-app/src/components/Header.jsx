import { Link } from 'react-router-dom';

export default function Header({ onToggle, open, onSync, isOnline, onToggleDark, dark }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-40 border-b border-slate-200 dark:border-slate-700 flex items-center px-3 sm:px-6">
      <div className="flex items-center gap-3 w-full">
        <button aria-label="Open navigation" onClick={onToggle} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>

        <Link to="/" className="text-lg font-semibold truncate">📌 My Task Tracker</Link>

        <nav className="ml-auto hidden md:flex items-center gap-3">
          <Link to="/supplements" className="text-sm text-sky-600 hover:underline">Supplements</Link>
          <button className="btn" onClick={onSync} disabled={!isOnline}>Sync</button>
          <button className="btn" onClick={onToggleDark} aria-pressed={dark}>{dark ? '🌙' : '☀️'}</button>
        </nav>
      </div>
    </header>
  );
}
