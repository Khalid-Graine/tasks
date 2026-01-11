import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

const STORAGE_KEY = 'supplements_v2';

export default function Supplements() {
  const [data, setData] = useState(() => {
    try {
      // migrate old format if present
      const old = localStorage.getItem('supplements');
      if (old && !localStorage.getItem(STORAGE_KEY)) {
        const items = JSON.parse(old) || [];
        const migrated = { items, history: {} };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      const v = localStorage.getItem(STORAGE_KEY);
      return v ? JSON.parse(v) : { items: [], history: {} };
    } catch (e) {
      return { items: [], history: {} };
    }
  });

  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => todayKey());
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDose, setEditDose] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }, [data]);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const it = { id: Date.now().toString(), name: name.trim(), dose: dose.trim(), createdAt: Date.now() };
    setData(prev => ({ ...prev, items: [it, ...prev.items] }));
    setName(''); setDose('');
  };

  const remove = (id) => {
    setData(prev => {
      const items = prev.items.filter(i => i.id !== id);
      // remove id from all history entries
      const history = Object.fromEntries(Object.entries(prev.history).map(([k, v]) => [k, v.filter(x => x !== id)]));
      return { items, history };
    });
  };

  const toggleTaken = (id) => {
    setData(prev => {
      const hk = selectedDate;
      const day = prev.history[hk] ? [...prev.history[hk]] : [];
      const idx = day.indexOf(id);
      if (idx === -1) day.push(id); else day.splice(idx, 1);
      return { ...prev, history: { ...prev.history, [hk]: day } };
    });
  };

  const isTaken = (id, dateKey = selectedDate) => {
    return (data.history[dateKey] || []).includes(id);
  };

  const changeDate = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    setSelectedDate(todayKey(d));
  };

  const countTakenFor = (id, days = 7) => {
    const now = new Date(selectedDate + 'T00:00:00');
    let count = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const k = todayKey(d);
      if ((data.history[k] || []).includes(id)) count++;
    }
    return count;
  };

  const recentDays = (n) => {
    const arr = [];
    const now = new Date(selectedDate + 'T00:00:00');
    for (let i = 0; i < n; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      arr.push(todayKey(d));
    }
    return arr;
  };

  const totalTakenToday = (data.history[selectedDate] || []).length;
  const totalSupplements = data.items.length;
  const progressPercent = totalSupplements === 0 ? 0 : Math.round((totalTakenToday / totalSupplements) * 100);

  return (
    <div className="min-h-screen flex items-center justify-center app-shell">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg">
        <header className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">💊 Supplements</h1>
            <div className="flex items-center gap-2">
              <Link to="/" className="btn">Back to Tasks</Link>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button className="btn" onClick={() => changeDate(-1)}>Yesterday</button>
              <button className="btn" onClick={() => setSelectedDate(todayKey())}>Today</button>
              <button className="btn" onClick={() => changeDate(1)}>Tomorrow</button>
            </div>

            <div className="flex items-center gap-3">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 rounded-md border" />
              <div className="text-sm text-slate-500">Taken: {totalTakenToday}</div>
            </div>
          </div>
        </header>

        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">Today's progress</div>
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div className="bg-sky-500 h-3" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-1">{progressPercent}% — {totalTakenToday} / {totalSupplements}</div>
        </div>

        <form onSubmit={add} className="flex gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplement name" className="flex-1 px-3 py-2 rounded-md border" />
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (e.g., 500mg)" className="px-3 py-2 rounded-md border w-32" />
          <button className="btn" type="submit">Add</button>
        </form>

        <ul className="space-y-3">
          {data.items.map(it => (
            <li key={it.id} className="task-item flex items-center justify-between">
              <div className="flex items-center gap-3" onClick={() => { if (!editingId) toggleTaken(it.id); }}>
                <input type="checkbox" checked={isTaken(it.id)} onChange={() => toggleTaken(it.id)} onClick={(e) => e.stopPropagation()} />

                {editingId === it.id ? (
                  <div className="flex flex-col">
                    <input className="px-2 py-1 rounded border mb-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    <input className="px-2 py-1 rounded border text-xs" value={editDose} onChange={(e) => setEditDose(e.target.value)} placeholder="Dose" />
                  </div>
                ) : (
                  <div className={`${isTaken(it.id) ? 'line-through text-slate-400' : ''}`}>
                    <div className="font-medium">{it.name}</div>
                    {it.dose && <div className="text-xs text-slate-500">{it.dose}</div>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {editingId === it.id ? (
                  <>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); /* save */
                        setData(prev => ({ ...prev, items: prev.items.map(x => x.id === it.id ? { ...x, name: editName, dose: editDose } : x) }));
                        setEditingId(null);
                      }}>Save</button>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); setEditingId(it.id); setEditName(it.name); setEditDose(it.dose || ''); }}>Edit</button>
                    <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); remove(it.id); }}>Delete</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        <section className="mt-6">
          <h2 className="font-semibold mb-2">Statistics</h2>
          <div className="text-sm text-slate-500 mb-2">Showing counts over the last 7 and 30 days (relative to {selectedDate}).</div>
          <div className="space-y-2">
            {data.items.map(it => {
              const c7 = countTakenFor(it.id, 7);
              const c30 = countTakenFor(it.id, 30);
              return (
                <div key={it.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-slate-500">{it.dose}</div>
                  </div>
                  <div className="text-sm text-slate-600">7d: {c7} — 30d: {c30}</div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-6 text-sm text-slate-500">Supplements: {data.items.length}</footer>
      </div>
    </div>
  );
}
