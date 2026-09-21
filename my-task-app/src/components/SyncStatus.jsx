import { dismissSyncError, useSyncState } from '../sync';

const PERMISSION_HINT =
  'Firestore rejected the request. Deploy firestore.rules with: npx firebase-tools deploy --only firestore:rules';

export default function SyncStatus() {
  const { pending, offline, error } = useSyncState();

  if (error) {
    return (
      <div
        role="alert"
        className="mb-6 flex items-start justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        <div>
          <p className="font-semibold">Not saved to Firebase ({error.label})</p>
          <p className="mt-1 font-mono text-xs">{error.code}</p>
          {error.code === 'permission-denied' && <p className="mt-2">{PERMISSION_HINT}</p>}
        </div>
        <button type="button" onClick={dismissSyncError} className="shrink-0 font-medium hover:underline">
          Dismiss
        </button>
      </div>
    );
  }

  const status = offline
    ? { dot: 'bg-amber-500', text: pending ? `Offline: ${pending} change(s) waiting to sync` : 'Offline: showing cached data' }
    : pending
      ? { dot: 'bg-amber-500 animate-pulse', text: `Saving ${pending} change(s) to Firebase…` }
      : { dot: 'bg-emerald-500', text: 'All changes saved to Firebase' };

  return (
    <p className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${status.dot}`} />
      {status.text}
    </p>
  );
}
