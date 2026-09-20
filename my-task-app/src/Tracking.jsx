import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'custom-tracking-v1';

const LEVELS = [
  { key: 'zero', label: 'Zero', score: 0, color: 'bg-emerald-500' },
  { key: 'light', label: 'Light', score: 1, color: 'bg-yellow-500' },
  { key: 'medium', label: 'Medium', score: 2, color: 'bg-orange-500' },
  { key: 'large', label: 'Large', score: 3, color: 'bg-red-500' },
  { key: 'extreme', label: 'Extreme', score: 4, color: 'bg-rose-700' },
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getLevelMeta = (levelKey) => LEVELS.find((level) => level.key === levelKey) || LEVELS[0];

const getDefaultItems = () => [{ id: makeId(), name: 'Procrastination' }];

const getThreeMonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function TrackingPage() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState({});
  const [newItemName, setNewItemName] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.items && parsed.items.length > 0) {
          setItems(parsed.items);
          setLogs(parsed.logs || {});
          return;
        }
      }
      const defaults = getDefaultItems();
      setItems(defaults);
      setLogs({});
    } catch (error) {
      console.warn('Could not load tracking data', error);
      const defaults = getDefaultItems();
      setItems(defaults);
      setLogs({});
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, logs }));
    } catch (error) {
      console.warn('Could not save tracking data', error);
    }
  }, [items, logs]);

  const todayKey = getTodayKey();
  const isToday = selectedDate === todayKey;

  const displaySummary = useMemo(() => {
    return items.map((item) => {
      const selectedLevel = logs[selectedDate]?.[item.id] || 'zero';
      const levelMeta = getLevelMeta(selectedLevel);
      return {
        ...item,
        selectedLevel,
        levelMeta,
      };
    });
  }, [items, logs, selectedDate]);

  const changeDate = (daysOffset) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + daysOffset);
    const newDate = date.toISOString().slice(0, 10);
    
    const threeMonthsAgo = getThreeMonthsAgo().toISOString().slice(0, 10);
    if (newDate >= threeMonthsAgo && newDate <= todayKey) {
      setSelectedDate(newDate);
    }
  };

  const canGoBack = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    const prevDate = date.toISOString().slice(0, 10);
    const threeMonthsAgo = getThreeMonthsAgo().toISOString().slice(0, 10);
    return prevDate >= threeMonthsAgo;
  };

  const canGoForward = () => selectedDate < todayKey;

  const addItem = (event) => {
    event.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    const itemExists = items.some(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (itemExists) {
      setNewItemName('');
      return;
    }

    setItems((prev) => [...prev, { id: makeId(), name: trimmed }]);
    setNewItemName('');
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setLogs((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((dateKey) => {
        if (next[dateKey]?.[id]) {
          delete next[dateKey][id];
        }
      });
      return next;
    });
  };

  const setLevel = (itemId, levelKey) => {
    setLogs((prev) => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [itemId]: levelKey,
      },
    }));
  };

  const getHistory = (itemId) => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));

      const key = date.toISOString().slice(0, 10);
      const levelKey = logs[key]?.[itemId] || 'zero';
      const meta = getLevelMeta(levelKey);

      return {
        key,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        levelKey,
        meta,
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Daily check-in</p>
            <h1 className="mt-2 text-3xl font-bold">Track what matters</h1>
          </div>
          <Link
            to="/dashboard"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
          >
            📊 Dashboard
          </Link>
        </div>

        {/* Date Navigation */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => changeDate(-1)}
              disabled={!canGoBack()}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-sky-300 dark:border-slate-700 dark:bg-slate-800"
            >
              ← Previous
            </button>
            <div className="text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Selected date</p>
              <p className="mt-1 text-lg font-bold">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
                {isToday && <span className="ml-2 text-xs text-sky-600 font-semibold">(Today)</span>}
              </p>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  const threeMonthsAgo = getThreeMonthsAgo().toISOString().slice(0, 10);
                  if (newDate >= threeMonthsAgo && newDate <= todayKey) {
                    setSelectedDate(newDate);
                  }
                }}
                min={getThreeMonthsAgo().toISOString().slice(0, 10)}
                max={todayKey}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <button
              type="button"
              onClick={() => changeDate(1)}
              disabled={!canGoForward()}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium transition disabled:opacity-30 disabled:cursor-not-allowed hover:enabled:border-sky-300 dark:border-slate-700 dark:bg-slate-800"
            >
              Next →
            </button>
          </div>
        </div>

        <form onSubmit={addItem} className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
            What do you want to track?
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              placeholder="Example: procrastination"
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-700 dark:bg-slate-800 dark:placeholder:text-slate-500"
            />
            <button type="submit" className="btn">Add tracking item</button>
          </div>
        </form>

        <div className="grid gap-4">
          {displaySummary.map((item) => {
            const history = getHistory(item.id);
            const maxScore = LEVELS[LEVELS.length - 1].score;

            return (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Metric</p>
                    <h2 className="text-xl font-bold">{item.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-sm text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>

                <div className="mb-4 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{isToday ? "Today's level" : "Level for selected date"}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`inline-block h-3 w-3 rounded-full ${item.levelMeta.color}`} />
                    <span className="text-lg font-bold capitalize">{item.levelMeta.label}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((level) => {
                    const selected = item.selectedLevel === level.key;
                    return (
                      <button
                        key={level.key}
                        type="button"
                        onClick={() => setLevel(item.id, level.key)}
                        className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                          selected
                            ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                    <span>Last 7 days</span>
                    <span>{item.selectedLevel}</span>
                  </div>

                  <div className="flex h-24 items-end gap-2">
                    {history.map((day) => {
                      const height = ((day.meta.score / maxScore) * 100) || 8;
                      return (
                        <div key={day.key} className="flex flex-1 flex-col items-center justify-end gap-2">
                          <div
                            className={`w-full rounded-t-xl ${day.meta.color}`}
                            style={{ height: `${Math.max(12, height)}%` }}
                            title={`${day.label}: ${day.meta.label}`}
                          />
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{day.label.slice(0, 3)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
