import { Link } from 'react-router-dom';

export default function SideDrawer({ open, onClose }) {
  return (
    <>
      {/* overlay */}
      <div className={`fixed inset-0 bg-black/40 z-30 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={onClose} />

      <aside className={`fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-slate-900 z-40 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!open}>
        <div className="h-14 flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
          <div className="font-semibold">Navigation</div>
        </div>
        <nav className="p-4 space-y-2">
          <Link to="/" onClick={onClose} className="block px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">Home</Link>
          <Link to="/supplements" onClick={onClose} className="block px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">Supplements</Link>
        </nav>
      </aside>
    </>
  );
}
