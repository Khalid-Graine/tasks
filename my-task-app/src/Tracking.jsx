import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  deleteField,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import SyncStatus from './components/SyncStatus';
import { reportListenerError, reportSnapshot, trackWrite } from './sync';

export const ITEMS_COLLECTION = 'trackingItems';
export const LOGS_COLLECTION = 'trackingLogs';

const LEVELS = [
  { key: 'zero', label: '0', score: 0, color: 'bg-emerald-500', hex: '#10b981' },
  { key: 'light', label: '1', score: 1, color: 'bg-yellow-500', hex: '#eab308' },
  { key: 'medium', label: '2', score: 2, color: 'bg-orange-500', hex: '#f97316' },
  { key: 'large', label: '3', score: 3, color: 'bg-red-500', hex: '#ef4444' },
  { key: 'extreme', label: '4', score: 4, color: 'bg-rose-700', hex: '#be123c' },
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getLevelMeta = (levelKey) => LEVELS.find((level) => level.key === levelKey) || null;

const DEMO_DAYS = 90;

// Each metric gets its own shape over the window so the dashboard trends differ.
// t runs 0 (oldest day) -> 1 (today).
const DEMO_SHAPES = {
  Procrastination: (t) => 3.6 - 2.9 * t,
  Motivation: (t) => 0.7 + 2.5 * t,
  Focus: (t) => 2 + Math.sin(t * 7) * 1.1,
  Daydreaming: (t) => 1 + 2.3 * t,
};

const DEMO_ITEM_NAMES = Object.keys(DEMO_SHAPES);

const getThreeMonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Deterministic jitter so a given day/metric always gets the same wobble.
const pseudoRandom = (seed) => {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

const buildDemoLogs = (items) => {
  const logs = {};

  items.forEach((item, itemIndex) => {
    const shape = DEMO_SHAPES[item.name];
    if (!shape) return;

    for (let i = DEMO_DAYS - 1; i >= 0; i--) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().slice(0, 10);

      const t = (DEMO_DAYS - 1 - i) / (DEMO_DAYS - 1);
      const jitter = (pseudoRandom(i + itemIndex * 97) - 0.5) * 1.5;
      const score = Math.min(LEVELS.length - 1, Math.max(0, Math.round(shape(t) + jitter)));

      logs[dateKey] = { ...(logs[dateKey] || {}), [item.id]: LEVELS[score].key };
    }
  });

  return logs;
};

// One-time write of the demo metrics plus DEMO_DAYS of history, in a single batch
// (4 items + 90 day-docs stays well under Firestore's 500-write batch limit).
const seedDemoData = async () => {
  const batch = writeBatch(db);

  const items = DEMO_ITEM_NAMES.map((name) => {
    const ref = doc(collection(db, ITEMS_COLLECTION));
    batch.set(ref, { name });
    return { id: ref.id, name };
  });

  const logs = buildDemoLogs(items);
  Object.entries(logs).forEach(([dateKey, dayLevels]) => {
    batch.set(doc(db, LOGS_COLLECTION, dateKey), dayLevels, { merge: true });
  });

  await batch.commit();
};

export default function TrackingPage() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState({});
  const [newItemName, setNewItemName] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [editing, setEditing] = useState(false);

  const seedAttempted = useRef(false);
  const dateInputRef = useRef(null);

  // Firestore is the source of truth; its IndexedDB cache covers offline/refresh.
  useEffect(() => {
    const unsubItems = onSnapshot(
      collection(db, ITEMS_COLLECTION),
      (snap) => {
        reportSnapshot(snap);
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(loaded);

        // First ever run: plant the demo metrics and their history.
        if (loaded.length === 0 && !snap.metadata.fromCache && !seedAttempted.current) {
          seedAttempted.current = true;
          trackWrite('demo data', seedDemoData);
        }
      },
      (error) => reportListenerError('tracking items', error)
    );

    const unsubLogs = onSnapshot(
      collection(db, LOGS_COLLECTION),
      (snap) => {
        reportSnapshot(snap);
        const loaded = {};
        snap.docs.forEach((d) => {
          loaded[d.id] = d.data();
        });
        setLogs(loaded);
      },
      (error) => reportListenerError('tracking logs', error)
    );

    return () => {
      unsubItems();
      unsubLogs();
    };
  }, []);

  const todayKey = getTodayKey();
  const isToday = selectedDate === todayKey;

  const hiddenItems = useMemo(() => items.filter((item) => item.archived), [items]);

  const displaySummary = useMemo(() => {
    return items.filter((item) => !item.archived).map((item) => {
      const selectedLevel = logs[selectedDate]?.[item.id] || null;
      const levelMeta = selectedLevel ? getLevelMeta(selectedLevel) : null;
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

  // Tapping the date opens the native picker; the input itself stays invisible.
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  };

  const addItem = (event) => {
    event.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;

    const existing = items.find(
      (item) => item.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (existing) {
      // Re-adding a hidden item's name brings the old one (and its history) back.
      if (existing.archived) restoreItem(existing.id);
      setNewItemName('');
      return;
    }

    trackWrite(`add "${trimmed}"`, () => addDoc(collection(db, ITEMS_COLLECTION), { name: trimmed }));
    setNewItemName('');
  };

  // Hiding only flags the item; its logs stay, so the Dashboard keeps its history.
  const archiveItem = (id) => {
    const name = items.find((item) => item.id === id)?.name ?? 'item';
    trackWrite(`hide "${name}"`, () =>
      setDoc(doc(db, ITEMS_COLLECTION, id), { archived: true }, { merge: true })
    );
  };

  const restoreItem = (id) => {
    const name = items.find((item) => item.id === id)?.name ?? 'item';
    trackWrite(`restore "${name}"`, () =>
      setDoc(doc(db, ITEMS_COLLECTION, id), { archived: deleteField() }, { merge: true })
    );
  };

  const setLevel = (itemId, levelKey) => {
    trackWrite(`log ${selectedDate}`, () =>
      setDoc(doc(db, LOGS_COLLECTION, selectedDate), { [itemId]: levelKey }, { merge: true })
    );
  };

  const arrowButtonClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition duration-150 hover:enabled:bg-slate-100 hover:enabled:text-sky-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:enabled:bg-slate-800';

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Daily check-in</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-2xl font-bold sm:text-3xl">Track what matters</h1>
            <Link
              to="/dashboard"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-sky-600"
            >
              <span aria-hidden="true">📊</span>
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        <SyncStatus />

        {/* Date Navigation */}
        <div className="mb-6 flex items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            disabled={!canGoBack()}
            aria-label="Previous day"
            className={arrowButtonClass}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={openDatePicker}
            aria-label="Choose a date"
            className="relative min-w-0 flex-1 rounded-2xl px-2 py-1 text-center transition hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <span className="block truncate text-xl font-bold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </span>
            <span className={`block text-xs font-semibold text-sky-600 ${isToday ? '' : 'invisible'}`}>Today</span>
            <input
              ref={dateInputRef}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
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
              className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            />
          </button>

          <button
            type="button"
            onClick={() => changeDate(1)}
            disabled={!canGoForward()}
            aria-label="Next day"
            className={arrowButtonClass}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
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
            <button type="submit" className="btn justify-center">Add tracking item</button>
          </div>
        </form>

        {(displaySummary.length > 0 || editing) && (
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Your items</h2>
            <button
              type="button"
              onClick={() => setEditing((on) => !on)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                editing
                  ? 'bg-sky-500 text-white hover:bg-sky-600'
                  : 'text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800'
              }`}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>
        )}

        <div className="grid gap-4">
          {displaySummary.map((item) => {
            return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex min-w-0 items-center gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => archiveItem(item.id)}
                      aria-label={`Hide ${item.name}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition hover:bg-red-600"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="h-3.5 w-3.5">
                        <path d="M6 12h12" />
                      </svg>
                    </button>
                  )}
                  <h3 className="truncate text-lg font-bold">{item.name}</h3>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                    <span className={`h-2 w-2 rounded-full ${item.levelMeta ? item.levelMeta.color : 'bg-slate-300 dark:bg-slate-600'}`} />
                    {item.levelMeta ? item.levelMeta.label : 'Not set'}
                  </span>
                </div>

                <div
                  className={`mt-3 flex flex-nowrap gap-1.5 transition-opacity duration-200 ${
                    editing ? 'pointer-events-none opacity-40' : ''
                  }`}
                >
                  {LEVELS.map((level) => {
                    const selected = item.selectedLevel === level.key;
                    const faded = item.selectedLevel && !selected;
                    return (
                      <button
                        key={level.key}
                        type="button"
                        onClick={() => setLevel(item.id, level.key)}
                        disabled={editing}
                        aria-pressed={selected}
                        className={`flex min-h-[38px] min-w-0 flex-1 items-center justify-center rounded-full border px-1 text-[13px] transition-all duration-200 ease-out ${
                          selected
                            ? 'scale-105 border-sky-500 bg-sky-500 font-bold text-white shadow-md'
                            : 'border-slate-200 bg-white font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        } ${faded ? 'opacity-40 hover:opacity-70' : 'opacity-100'}`}
                      >
                        <span className="truncate">{level.label}</span>
                      </button>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>

        {hiddenItems.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hidden items</h2>
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {hiddenItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate text-slate-500 dark:text-slate-400">{item.name}</span>
                  <button
                    type="button"
                    onClick={() => restoreItem(item.id)}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-sky-600 transition hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-slate-800"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
