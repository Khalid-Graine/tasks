import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc, deleteDoc } from "firebase/firestore";

function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('tasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'failed'
  const [syncError, setSyncError] = useState(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    const q = query(collection(db, "tasks"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let tasksArray = [];
      querySnapshot.forEach((docSnap) => {
        tasksArray.push({ ...docSnap.data(), id: docSnap.id });
      });
      // Merge server tasks with any local-only tasks (identified by id starting with 'local-')
      setTasks((prev) => {
        const localOnly = prev.filter(t => String(t.id).startsWith('local-'));
        return [...tasksArray, ...localOnly];
      });
    }, (err) => {
      console.error('Firestore onSnapshot error:', err);
    });
    return () => unsubscribe();
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Persist tasks locally so they survive refresh
  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
      console.warn('Could not save tasks to localStorage', e);
    }
  }, [tasks]);

  // Sync local-only tasks (id starts with 'local-') to Firestore when online
  const syncLocalTasks = async () => {
    if (syncingRef.current) return;
    const localTasks = tasks.filter(t => String(t.id).startsWith('local-'));
    if (localTasks.length === 0) {
      setSyncStatus('synced');
      setSyncError(null);
      return;
    }

    syncingRef.current = true;
    setSyncStatus('syncing');
    setSyncError(null);

    const results = await Promise.allSettled(localTasks.map(async (lt) => {
      const { text, completed } = lt;
      const ref = await addDoc(collection(db, 'tasks'), { text, completed });
      return { oldId: lt.id, newId: ref.id };
    }));

    let anyFailed = false;
    const succeeded = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        succeeded.push(r.value.oldId);
      } else {
        anyFailed = true;
        console.warn('Failed to sync task', localTasks[i], r.reason);
      }
    });

    // Remove local-only tasks that succeeded from state; Firestore snapshot will add the server docs
    if (succeeded.length > 0) {
      setTasks(prev => prev.filter(t => !succeeded.includes(t.id)));
    }

    if (anyFailed) {
      setSyncStatus('failed');
      setSyncError('Some tasks failed to sync. They remain local and will retry later.');
    } else {
      setSyncStatus('synced');
      setSyncError(null);
    }

    syncingRef.current = false;
  };

  // Auto-sync when we become online
  useEffect(() => {
    if (isOnline) {
      syncLocalTasks().catch(err => {
        console.warn('Auto-sync error', err);
        setSyncStatus('failed');
        setSyncError(String(err));
      });
    } else {
      setSyncStatus('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const text = input.trim();
    setInput('');

    // Optimistic attempt to add to Firestore; on failure fallback to local task
    try {
      await addDoc(collection(db, "tasks"), { text, completed: false });
    } catch (err) {
      console.warn('Add to Firestore failed, saving locally:', err);
      const localTask = { id: 'local-' + Date.now(), text, completed: false };
      setTasks(prev => [localTask, ...prev]);
      setSyncStatus('failed');
      setSyncError('Saved locally — will sync when online');
    }
  };

  const toggleComplete = async (task) => {
    // Optimistically update local state
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));

    // If it's a local-only task, just keep it local
    if (String(task.id).startsWith('local-')) return;

    try {
      await updateDoc(doc(db, "tasks", task.id), { completed: !task.completed });
    } catch (err) {
      console.warn('Update to Firestore failed, change kept locally:', err);
    }
  };

  const handleDelete = async (task, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    // If local-only, just remove locally
    if (String(task.id).startsWith('local-')) {
      setTasks(prev => prev.filter(t => t.id !== task.id));
      return;
    }

    // Optimistically remove locally
    setTasks(prev => prev.filter(t => t.id !== task.id));
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
    } catch (err) {
      console.warn('Failed to delete from Firestore, restoring locally', err);
      // restore task on failure
      setTasks(prev => [task, ...prev]);
    }
  };

  // Dark mode handling
  const [dark, setDark] = useState(() => {
    try {
      const v = localStorage.getItem('dark');
      return v === '1' || (v === null && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) { return false; }
  });
  useEffect(() => {
    try {
      localStorage.setItem('dark', dark ? '1' : '0');
      if (dark) document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    } catch (e) { }
  }, [dark]);

  const doneTasks = tasks.filter(t => t.completed).length;

  return (
    <div className="min-h-screen flex items-center justify-center app-shell">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold">📌 My Task Tracker</h1>
          <div className="flex items-center space-x-3">
            <div className={`text-sm ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>{isOnline ? 'Online' : 'Offline'}</div>
            <button className="btn" onClick={() => syncLocalTasks()} disabled={!isOnline || syncingRef.current}>Sync now</button>
            <button className="btn" onClick={() => setDark(d => !d)} aria-pressed={dark}>{dark ? '🌙' : '☀️'}</button>
          </div>
        </header>

        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            className="flex-1 px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add a task..."
            aria-label="Add task"
          />
          <button className="btn" type="submit">Add</button>
        </form>

        {syncError && <div className="text-sm text-red-500 mb-3">{syncError}</div>}

        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="task-item" onClick={() => toggleComplete(task)}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={!!task.completed} onChange={() => toggleComplete(task)} onClick={(e) => e.stopPropagation()} />
                <div className={`task-text ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.text}</div>
              </div>
              <div className="flex items-center gap-2">
                {String(task.id).startsWith('local-') && <span className="text-xs text-gray-500">local</span>}
                <button className="btn btn-danger" onClick={(e) => handleDelete(task, e)} aria-label={`Delete ${task.text}`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>

        <footer className="mt-6 text-sm text-slate-500">
          Done: {doneTasks} / {tasks.length}
        </footer>
      </div>
    </div>
  );
}

export default App;