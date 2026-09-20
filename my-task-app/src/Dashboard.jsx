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

const calculateTrendMetrics = (chartData) => {
  const totalDays = chartData.length;
  const midpoint = Math.floor(totalDays / 2);
  
  const firstHalf = chartData.slice(0, midpoint).map(d => LEVELS.find(l => l.key === d.level).score);
  const secondHalf = chartData.slice(midpoint).map(d => LEVELS.find(l => l.key === d.level).score);
  
  const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  const change = avgSecondHalf - avgFirstHalf;
  const percentChange = ((change / avgFirstHalf) * 100).toFixed(1);
  const trend = change > 0.1 ? 'worsening' : change < -0.1 ? 'improving' : 'stable';
  
  return { avgFirstHalf, avgSecondHalf, change, percentChange, trend };
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

  const trendMetrics = calculateTrendMetrics(chartData);

  const maxScore = LEVELS[LEVELS.length - 1].score;
  const chartHeight = 400;
  const dayWidth = 12; // Width for each day
  const chartWidth = last90Days.length * dayWidth + 100;

  // Generate SVG line chart with better day labels
  const points = chartData
    .map((data, index) => {
      const levelMeta = getLevelMeta(data.level);
      const x = 50 + index * dayWidth;
      const y = chartHeight - (levelMeta.score / maxScore) * (chartHeight - 80) + 40;
      return `${x},${y}`;
    })
    .join(' ');

  const dotElements = chartData
    .map((data, index) => {
      const levelMeta = getLevelMeta(data.level);
      const x = 50 + index * dayWidth;
      const y = chartHeight - (levelMeta.score / maxScore) * (chartHeight - 80) + 40;
      const dateObj = new Date(data.date + 'T00:00:00');
      const dayLabel = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      return (
        <g key={`day-${index}`}>
          {/* Vertical gridline for each day */}
          <line
            x1={x}
            y1="40"
            x2={x}
            y2={chartHeight + 10}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.1"
          />
          
          {/* Dot */}
          <circle
            cx={x}
            cy={y}
            r="5"
            fill={levelMeta.color}
            stroke="white"
            strokeWidth="2"
          />
          
          {/* Day label */}
          <text
            x={x}
            y={chartHeight + 30}
            textAnchor="middle"
            fontSize="11"
            fill="currentColor"
            opacity="0.7"
          >
            {dayLabel}
          </text>
        </g>
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

        {/* Trend Summary */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Overall Trend</p>
            <div className="mt-2 flex items-center gap-2">
              {trendMetrics.trend === 'improving' && (
                <>
                  <span className="text-2xl">📉</span>
                  <div>
                    <p className="text-lg font-bold text-green-600">Improving</p>
                    <p className="text-xs text-green-600">{Math.abs(trendMetrics.percentChange)}% better</p>
                  </div>
                </>
              )}
              {trendMetrics.trend === 'worsening' && (
                <>
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="text-lg font-bold text-red-600">Worsening</p>
                    <p className="text-xs text-red-600">{trendMetrics.percentChange}% worse</p>
                  </div>
                </>
              )}
              {trendMetrics.trend === 'stable' && (
                <>
                  <span className="text-2xl">➡️</span>
                  <div>
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-300">Stable</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">No significant change</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">First 45 Days Avg</p>
            <p className="mt-2 text-3xl font-bold">{trendMetrics.avgFirstHalf.toFixed(1)}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">severity level</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Last 45 Days Avg</p>
            <p className="mt-2 text-3xl font-bold">{trendMetrics.avgSecondHalf.toFixed(1)}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">severity level</p>
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
              height={chartHeight + 60}
              className="text-slate-600 dark:text-slate-300"
              style={{ minWidth: '100%' }}
            >
              {/* Y-axis labels and gridlines */}
              {[0, 1, 2, 3, 4].map((i) => {
                const y = chartHeight - (i / maxScore) * (chartHeight - 80) + 40;
                const levelLabel = LEVELS[i]?.label || i;
                return (
                  <g key={`grid-${i}`}>
                    <line
                      x1="35"
                      y1={y}
                      x2={chartWidth - 20}
                      y2={y}
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                      opacity="0.2"
                    />
                    <text x="20" y={y + 4} fontSize="12" textAnchor="end" opacity="0.6" fontWeight="500">
                      {levelLabel}
                    </text>
                  </g>
                );
              })}

              {/* Area under line (gradient effect) */}
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Fill area under line */}
              <polygon
                points={`50,${chartHeight + 40} ${points} ${50 + (last90Days.length - 1) * dayWidth},${chartHeight + 40}`}
                fill="url(#areaGradient)"
              />

              {/* Line */}
              <polyline
                points={points}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Days and dots */}
              {dotElements}
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
