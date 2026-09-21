import { useEffect, useState } from 'react';

const STORAGE_KEY = 'custom-tracking-v2';
const DASHBOARD_RANGE_KEY = 'dashboard-range';

const LEVELS = [
  { key: 'zero', label: 'Zero', score: 0, color: '#10b981' },
  { key: 'light', label: 'Light', score: 1, color: '#eab308' },
  { key: 'medium', label: 'Medium', score: 2, color: '#f97316' },
  { key: 'large', label: 'Large', score: 3, color: '#ef4444' },
  { key: 'extreme', label: 'Extreme', score: 4, color: '#be185d' },
];

const getLevelMeta = (levelKey) => LEVELS.find((level) => level.key === levelKey) || LEVELS[0];

const getLastNDays = (n) => {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
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
  
  let trend, percentChange, trendLabel;
  
  if (avgFirstHalf === 0) {
    if (avgSecondHalf > 0) {
      trend = 'worsening';
      trendLabel = 'Worse';
      percentChange = '';
    } else {
      trend = 'stable';
      trendLabel = 'No change';
      percentChange = '';
    }
  } else {
    percentChange = ((change / avgFirstHalf) * 100).toFixed(1);
    trend = change > 0.1 ? 'worsening' : change < -0.1 ? 'improving' : 'stable';
    trendLabel = trend === 'improving' ? `${Math.abs(percentChange)}% better` : 
                 trend === 'worsening' ? `${percentChange}% worse` : 'No significant change';
  }
  
  return { avgFirstHalf, avgSecondHalf, change, percentChange, trend, trendLabel };
};

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [range, setRange] = useState(7);
  
  useEffect(() => {
    const stored = localStorage.getItem(DASHBOARD_RANGE_KEY);
    if (stored) {
      const parsedRange = parseInt(stored, 10);
      if ([7, 15, 30, 90].includes(parsedRange)) {
        setRange(parsedRange);
      }
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem(DASHBOARD_RANGE_KEY, range.toString());
  }, [range]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const storedItems = data.items || [];
      setItems(storedItems);
      if (storedItems.length > 0 && !selectedItem) {
        setSelectedItem(storedItems[0].id);
      }
    }
  }, [selectedItem]);

  const chartData = (() => {
    const days = getLastNDays(range);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored || !selectedItem) return [];
    const data = JSON.parse(stored);
    const logs = data.logs || {};
    return days.map(day => ({
      date: day,
      level: logs[day]?.[selectedItem] || 'zero',
    }));
  })();

  const metrics = calculateTrendMetrics(chartData);

  const statistics = (() => {
    const counts = { zero: 0, light: 0, medium: 0, large: 0, extreme: 0 };
    chartData.forEach(d => {
      counts[d.level]++;
    });
    return LEVELS.map(level => ({
      ...level,
      count: counts[level.key],
      percentage: ((counts[level.key] / range) * 100).toFixed(0),
    }));
  })();

  const chartHeight = 300;
  const maxScore = Math.max(...chartData.map(d => LEVELS.find(l => l.key === d.level).score), 1);
  
  const getDotSize = () => range === 90 ? 3 : 5;
  const getLabelFrequency = () => {
    if (range <= 7) return 1;
    if (range <= 15) return 2;
    if (range <= 30) return 5;
    return 15;
  };

  const labelFreq = getLabelFrequency();
  const dotSize = getDotSize();
  const viewBoxWidth = range * 10 + 80;
  const viewBoxHeight = chartHeight + 60;

  const pointsData = chartData.map((d, idx) => ({
    x: 50 + idx * 10,
    y: chartHeight - (LEVELS.find(l => l.key === d.level).score / maxScore) * (chartHeight - 20),
    score: LEVELS.find(l => l.key === d.level).score,
    date: d.date,
    idx,
  }));

  const polylinePoints = pointsData.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-4 pt-32">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Dashboard</h1>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Select Item</h2>
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  selectedItem === item.id
                    ? 'bg-sky-500 text-white border-2 border-sky-500'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-transparent hover:border-sky-500'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 mt-6">Time Range</h2>
          <div className="flex flex-wrap gap-2">
            {[7, 15, 30, 90].map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  range === r
                    ? 'bg-sky-500 text-white border-2 border-sky-500'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-transparent hover:border-sky-500'
                }`}
              >
                {r === 30 ? '1 month' : r === 90 ? '3 months' : `${r} days`}
              </button>
            ))}
          </div>
        </div>

        {selectedItem && chartData.length > 0 && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                Last {range} days trend analysis
              </h2>

              <div className="mb-6 overflow-hidden">
                <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} width="100%" height="auto" className="w-full">
                  <defs>
                    <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Y-axis gridlines */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <line
                      key={`grid-${i}`}
                      x1="65"
                      y1={20 + (i * (chartHeight - 20)) / 4}
                      x2={viewBoxWidth - 20}
                      y2={20 + (i * (chartHeight - 20)) / 4}
                      stroke="#e2e8f0"
                      strokeDasharray="4,4"
                      className="dark:stroke-slate-700"
                    />
                  ))}

                  {/* Y-axis labels */}
                  {LEVELS.map((level, idx) => (
                    <text
                      key={`label-${idx}`}
                      x="10"
                      y={chartHeight - (idx * (chartHeight - 20)) / 4 + 5}
                      fontSize="11"
                      fill="#64748b"
                      className="dark:fill-slate-400"
                      textAnchor="start"
                    >
                      {level.label}
                    </text>
                  ))}

                  {/* Polyline */}
                  <polyline
                    points={polylinePoints}
                    fill="url(#trendGradient)"
                    stroke="#0ea5e9"
                    strokeWidth="2.5"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Dots and date labels */}
                  {pointsData.map((p, idx) => (
                    <g key={`point-${idx}`}>
                      <circle cx={p.x} cy={p.y} r={dotSize} fill="#0ea5e9" />
                      {idx % labelFreq === 0 && (
                        <text
                          x={p.x}
                          y={chartHeight + 35}
                          fontSize="10"
                          fill="#64748b"
                          className="dark:fill-slate-400"
                          textAnchor="middle"
                        >
                          {p.date}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-semibold">Overall Trend</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {metrics.trendLabel}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-semibold">
                    First Half Avg
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {metrics.avgFirstHalf.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400 font-semibold">
                    Last Half Avg
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {metrics.avgSecondHalf.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {statistics.map(stat => (
                  <div
                    key={stat.key}
                    className="rounded-lg p-4 text-center"
                    style={{
                      backgroundColor: `${stat.color}20`,
                      borderLeft: `4px solid ${stat.color}`,
                    }}
                  >
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {stat.label}
                    </div>
                    <div className="text-2xl font-bold mt-2" style={{ color: stat.color }}>
                      {stat.count}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {stat.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mt-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Legend</h2>
              <div className="flex flex-wrap gap-4">
                {LEVELS.map(level => (
                  <div key={level.key} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: level.color }}
                    ></div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {level.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
