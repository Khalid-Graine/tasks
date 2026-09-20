import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'tracking-dashboard-v1';

const defaultStats = {
  tasks: 3,
  targetTasks: 5,
  water: 5,
  workouts: 2,
  focus: 72,
};

const metricConfig = [
  { key: 'tasks', label: 'Tasks done', suffix: ' tasks', accent: 'bg-sky-500' },
  { key: 'water', label: 'Water', suffix: ' glasses', accent: 'bg-cyan-500' },
  { key: 'workouts', label: 'Workouts', suffix: ' sessions', accent: 'bg-emerald-500' },
  { key: 'focus', label: 'Focus', suffix: '%', accent: 'bg-violet-500' },
];

export default function TrackingPage() {
  const [stats, setStats] = useState(defaultStats);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setStats({ ...defaultStats, ...parsed });
      }
    } catch (error) {
      console.warn('Could not load tracking data', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      console.warn('Could not save tracking data', error);
    }
  }, [stats]);

  const completion = useMemo(() => {
    const taskPercent = (stats.tasks / stats.targetTasks) * 100;
    const waterPercent = (stats.water / 8) * 100;
    const focusPercent = stats.focus;
    const avg = (taskPercent + waterPercent + focusPercent) / 3;
    return Math.min(100, Math.round(avg));
  }, [stats]);

  const updateStat = (key, amount) => {
    setStats((prev) => {
      const nextValue = Math.max(0, prev[key] + amount);
      if (key === 'focus') return { ...prev, focus: Math.min(100, nextValue) };
      if (key === 'tasks' || key === 'water' || key === 'workouts') return { ...prev, [key]: nextValue };
      return prev;
    });
  };

  const resetStats = () => setStats(defaultStats);

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Overview</p>
            <h1 className="mt-1 text-2xl font-bold">Tracking</h1>
          </div>
          <button className="btn" onClick={resetStats} type="button">Reset</button>
        </div>

        <div className="mb-6 rounded-3xl bg-gradient-to-r from-sky-500 to-indigo-500 p-5 text-white shadow-lg shadow-sky-200/50 dark:shadow-sky-900/25">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-sky-100">Daily progress</p>
              <h2 className="mt-2 text-4xl font-black">{completion}%</h2>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/40 bg-white/10 text-lg font-bold">
              {completion}%
            </div>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${completion}%` }} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricConfig.map((metric) => {
            const value = stats[metric.key];
            const label = metric.key === 'tasks' ? `${value}/${stats.targetTasks}` : metric.key === 'water' ? `${value}/8` : metric.key === 'focus' ? `${value}%` : `${value}`;

            return (
              <div key={metric.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{metric.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${metric.accent}`} />
                </div>
                <div className="text-3xl font-bold">{label}</div>
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-sm" type="button" onClick={() => updateStat(metric.key, -1)}>-</button>
                  <button className="btn btn-sm" type="button" onClick={() => updateStat(metric.key, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Habit tracker</h3>
            <div className="space-y-3">
              {[
                { key: 'tasks', label: 'Completed tasks', value: stats.tasks, goal: stats.targetTasks, unit: 'done' },
                { key: 'water', label: 'Hydration', value: stats.water, goal: 8, unit: 'glasses' },
                { key: 'workouts', label: 'Movement', value: stats.workouts, goal: 3, unit: 'sessions' },
                { key: 'focus', label: 'Focus score', value: stats.focus, goal: 100, unit: '%' },
              ].map((item) => {
                const ratio = Math.min(100, (item.value / item.goal) * 100);
                return (
                  <div key={item.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{item.label}</span>
                      <span className="text-slate-500 dark:text-slate-400">{item.value}{item.unit}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Today's wins</h3>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> {stats.tasks >= stats.targetTasks ? 'Target reached for tasks' : `${stats.targetTasks - stats.tasks} tasks left to hit goal`}</li>
              <li className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" /> {stats.water >= 8 ? 'Hydration goal completed' : `${8 - stats.water} glasses to go`}</li>
              <li className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" /> {stats.focus >= 80 ? 'Great focus today' : 'Build momentum with one more deep work session'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
