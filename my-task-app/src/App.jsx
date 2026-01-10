import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, updateDoc, doc } from "firebase/firestore";

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

  const doneTasks = tasks.filter(t => t.completed).length;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>📌 My Task Tracker</h1>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: isOnline ? 'green' : 'gray' }}>{isOnline ? 'Online' : 'Offline'}</div>
          <div style={{ fontSize: 12, color: syncStatus === 'failed' ? 'crimson' : '#666' }}>{syncStatus === 'syncing' ? 'Syncing…' : syncStatus === 'synced' ? 'All synced' : syncStatus === 'failed' ? 'Sync failed' : ''}</div>
        </div>
      </div>
      <form onSubmit={handleAdd} style={{ marginBottom: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Add a task..." />
        <button type="submit">Add</button>
      </form>
      {syncError && <div style={{ color: 'crimson', marginBottom: 8 }}>{syncError}</div>}
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => syncLocalTasks()} disabled={!isOnline || syncingRef.current}>Sync now</button>
      </div>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} onClick={() => toggleComplete(task)}
              style={{ textDecoration: task.completed ? 'line-through' : 'none', cursor: 'pointer', opacity: String(task.id).startsWith('local-') ? 0.8 : 1 }}>
            {task.text} {String(task.id).startsWith('local-') && <small style={{ color: '#888', marginLeft: 8 }}>(local)</small>}
          </li>
        ))}
      </ul>
      <hr />
      <h3>Done: {doneTasks} / {tasks.length}</h3>
    </div>
  );
}

export default App;