import { useEffect, useState } from 'react';

const STORAGE_KEY = 'custom-tracking-v1';

const LEVELS = [
  { key: 'zero', label: 'Zero', score: 0, color: '#10b981' },
  { key: 'light', label: 'Light', score: 1, color: '#eab308' },
  { key: 'medium', label: 'Medium', score: 2, color: '#f97316' },
  { key: 'large', label: 'Large', score: 3, color: '#ef4444' },
  { key: 'extreme', label: 'Extreme', score: 4, color: '#be185d' },
];

const getLevelMeta = (levelKey) => LEVELS.find((level) => level.key === levelKey) || LEVELS[0];

const getLast90Days = () => {
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
};

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.items && parsed.items.length > 0) {
          setItems(parsed.items);
          setLogs(parsed.logs || {});
          setSelectedItem(parsed.items[0].id);
        }
      }
    } catch (error) {
      console.warn('Could not load tracking data', error);
    }
  }, []);

  const last90Days = getLast90Days();
  const currentItem = items.find((item) => item.id === selectedItem);

  if (!currentItem) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Dashboard</p>
          <h1 className="mt-2 text-3xl font-bold">No tracking data yet</h1>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Go to the Tracking page to start tracking items.</p>
        </div>
      </div>
    );
  }

  const chartData = last90Days.map((date) => ({
    date,
    level: logs[date]?.[selectedItem] || 'zero',
  }));

  const maxScore = LEVELS[LEVELS.length - 1].score;
  const chartHeight = 300;
  const chartWidth = Math.max(1200, last90Days.length * 6);

  // Generate SVG line chart
  const points = chartData
    .map((data, index) => {
      const levelMeta = getLevelMeta(data.level);
      const x = (index / (last90Days.length - 1)) * (chartWidth - 60) + 30;
      const y = chartHeight - (levelMeta.score / maxScore) * (chartHeight - 60) + 30;
      return `${x},${y}`;
    })
    .join(' ');

  const dotElements = chartData
    .map((data, index) => {
      const levelMeta = getLevelMeta(data.level);
      const x = (index / (last90Days.length - 1)) * (chartWidth - 60) + 30;
      const y = chartHeight - (levelMeta.score / maxScore) * (chartHeight - 60) + 30;
      return (
        <circle
          key={`dot-${index}`}
          cx={x}
          cy={y}
          r="4"
          fill={levelMeta.color}
          stroke="white"
          strokeWidth="2"
        />
      );
    });

  const labelElements = chartData
    .filter((_, index) => index % Math.ceil(last90Days.length / 15) === 0)
    .map((data, index) => {
      const actualIndex = index * Math.ceil(last90Days.length / 15);
      const x = (actualIndex / (last90Days.length - 1)) * (chartWidth - 60) + 30;
      const date = new Date(data.date);
      const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return (
        <text key={`label-${index}`} x={x} y={chartHeight + 20} textAnchor="middle" fontSize="12" fill="currentColor">
          {label}
        </text>
      );
    });

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Analytics</p>
          <h1 className="mt-2 text-3xl font-bold">Tracking Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Last 90 days trend analysis</p>
        </div>

        {/* Item Selector */}
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Select tracked item
          </label>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selectedItem === item.id
                    ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4">
            <h2 className="text-xl font-bold">{currentItem.name} Trend</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Last 90 days · Higher means more severe
            </p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {LEVELS.map((level) => {
              const count = chartData.filter((d) => d.level === level.key).length;
              const percentage = ((count / chartData.length) * 100).toFixed(1);
              return (
                <div key={level.key} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: level.color }} />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{level.label}</span>
                  </div>
                  <p className="mt-1 text-lg font-bold">{count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{percentage}%</p>
                </div>
              );
            })}
          </div>

          {/* SVG Chart */}
          <div className="overflow-x-auto rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
            <svg
              width={chartWidth}
              height={chartHeight + 40}
              className="text-slate-600 dark:text-slate-300"
              style={{ minWidth: '100%' }}
            >
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map((i) => {
                const y = chartHeight - (i / maxScore) * (chartHeight - 60) + 30;
                return (
                  <g key={`grid-${i}`}>
                    <line
                      x1="30"
                      y1={y}
                      x2={chartWidth - 30}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                      opacity="0.2"
                    />
                    <text x="10" y={y + 4} fontSize="11" textAnchor="end" opacity="0.6">
                      {i}
                    </text>
                  </g>
                );
              })}

              {/* Line */}
              <polyline
                points={points}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dots */}
              {dotElements}

              {/* Labels */}
              {labelElements}
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-6">
            <p className="mb-3 text-sm font-medium">Severity Scale</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {LEVELS.map((level) => (
                <div key={level.key} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: level.color }} />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{level.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
