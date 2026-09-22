import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from './firebase';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import SyncStatus from './components/SyncStatus';
import { reportListenerError, reportSnapshot, trackWrite } from './sync';

const ITEMS_COLLECTION = 'trackingItems';
const LOGS_COLLECTION = 'trackingLogs';
const SETTINGS_DOC = doc(db, 'settings', 'dashboard');

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 15, label: '15 days' },
  { days: 30, label: '1 month' },
];

const VIEWS = [
  { key: 'smoothed', label: 'Smoothed' },
  { key: 'daily', label: 'Daily' },
];

const LEVELS = [
  { key: 'zero', label: '0', score: 0 },
  { key: 'light', label: '1', score: 1 },
  { key: 'medium', label: '2', score: 2 },
  { key: 'large', label: '3', score: 3 },
  { key: 'extreme', label: '4', score: 4 },
];

const SCORE_BY_KEY = Object.fromEntries(LEVELS.map((level) => [level.key, level.score]));
const MAX_SCORE = LEVELS.length - 1;
const SMOOTHING_WINDOW = 3;
const STEADY_THRESHOLD = 0.2;
const SERIES_SLOTS = 8;

const CHART_HEIGHT = 320;
const END_LABEL_MIN_GAP = 14;

// Color follows the item's position in the full list, so hiding a line never repaints the others.
const seriesColor = (index) =>
  index < SERIES_SLOTS ? `var(--series-${index + 1})` : 'var(--series-other)';

// Tracking keys days by UTC date (toISOString), so count back from that same key.
const getLastNDays = (n, offset = 0) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const days = [];
  for (let i = n - 1 + offset; i >= offset; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
};

const formatDay = (dayKey, options) =>
  new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });

const average = (values) => {
  const logged = values.filter((value) => value != null);
  return logged.length ? logged.reduce((sum, value) => sum + value, 0) / logged.length : null;
};

const scoresFor = (logs, days, itemId) => days.map((day) => SCORE_BY_KEY[logs[day]?.[itemId]] ?? null);

const levelNear = (score) => LEVELS[Math.round(score)].label;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// Consecutive runs of logged days; an unlogged day breaks the line instead of pretending to be Zero.
const runsOf = (values) => {
  const runs = [];
  let run = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push(index);
    }
  });
  if (run.length) runs.push(run);
  return runs;
};

const describeChange = (series, rangeLabel) => {
  if (series.avg == null) return 'Nothing logged in this period';
  if (series.prevAvg == null) return `No data for the previous ${rangeLabel}`;
  const change = series.avg - series.prevAvg;
  if (Math.abs(change) < STEADY_THRESHOLD) return `→ Steady vs previous ${rangeLabel}`;
  const direction = change > 0 ? '▲ Up' : '▼ Down';
  return `${direction} ${Math.abs(change).toFixed(1)} vs previous ${rangeLabel}`;
};

function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === option.value
              ? 'bg-sky-500 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LineKey({ color, muted = false }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-0.5 w-4 shrink-0 rounded-full ${muted ? 'opacity-30' : ''}`}
      style={{ backgroundColor: color }}
    />
  );
}

function TrendChart({ days, series, view }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const showEndLabels = width >= 520;
  const margin = { top: 12, right: showEndLabels ? 112 : 16, bottom: 32, left: 60 };
  const plotWidth = Math.max(width - margin.left - margin.right, 10);
  const plotHeight = CHART_HEIGHT - margin.top - margin.bottom;
  const lastIndex = days.length - 1;

  const x = (index) => margin.left + (lastIndex === 0 ? plotWidth / 2 : (index / lastIndex) * plotWidth);
  const y = (score) => margin.top + plotHeight - (score / MAX_SCORE) * plotHeight;

  const maxTicks = Math.max(2, Math.floor(plotWidth / 64));
  const tickStep = Math.ceil(days.length / maxTicks);
  const tickIndexes = days.map((_, index) => index).filter((index) => (lastIndex - index) % tickStep === 0);

  // Each line ends on its latest logged value; labels that would collide fall back to the legend.
  const endPoints = series
    .map((line) => {
      const index = line.values.findLastIndex((value) => value != null);
      return index < 0 ? null : { line, index, y: y(line.values[index]) };
    })
    .filter(Boolean);

  const endLabels = [];
  if (showEndLabels) {
    [...endPoints]
      .sort((a, b) => a.y - b.y)
      .forEach((point) => {
        const previous = endLabels[endLabels.length - 1];
        if (!previous || point.y - previous.y >= END_LABEL_MIN_GAP) endLabels.push(point);
      });
  }

  const indexAt = (clientX) => {
    const rect = svgRef.current.getBoundingClientRect();
    return clamp(Math.round(((clientX - rect.left - margin.left) / plotWidth) * lastIndex), 0, lastIndex);
  };

  const handleKeyDown = (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step) {
      event.preventDefault();
      setActive((current) => clamp((current ?? lastIndex) + step, 0, lastIndex));
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  const readout =
    active == null
      ? []
      : series
          .map((line) => ({ line, value: line.values[active] }))
          .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const tooltipOnLeft = active != null && x(active) > width / 2;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        role="group"
        aria-label={`Trend lines for ${series.map((line) => line.name).join(', ')}. Use the left and right arrow keys to read each day.`}
        tabIndex={0}
        className="touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
        onPointerMove={(event) => setActive(indexAt(event.clientX))}
        onPointerDown={(event) => setActive(indexAt(event.clientX))}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(lastIndex)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKeyDown}
      >
        {LEVELS.map((level) => (
          <g key={level.key}>
            <line
              x1={margin.left}
              x2={margin.left + plotWidth}
              y1={y(level.score)}
              y2={y(level.score)}
              strokeWidth="1"
              className={level.score === 0 ? 'stroke-slate-300 dark:stroke-slate-600' : 'stroke-slate-200 dark:stroke-slate-700'}
            />
            <text
              x={margin.left - 12}
              y={y(level.score)}
              dy="0.35em"
              textAnchor="end"
              fontSize="12"
              className="fill-slate-500 tabular-nums dark:fill-slate-400"
            >
              {level.label}
            </text>
          </g>
        ))}

        {tickIndexes.map((index) => (
          <text
            key={days[index]}
            x={x(index)}
            y={margin.top + plotHeight + 22}
            textAnchor="middle"
            fontSize="12"
            className="fill-slate-500 tabular-nums dark:fill-slate-400"
          >
            {formatDay(days[index], { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {active != null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={margin.top}
            y2={margin.top + plotHeight}
            strokeWidth="1"
            className="stroke-slate-400 dark:stroke-slate-500"
          />
        )}

        {series.map((line) =>
          runsOf(line.values).map((run) =>
            run.length === 1 ? (
              <circle key={`${line.id}-${run[0]}`} cx={x(run[0])} cy={y(line.values[run[0]])} r="3" fill={line.color} />
            ) : (
              <path
                key={`${line.id}-${run[0]}`}
                d={run.map((index, i) => `${i ? 'L' : 'M'}${x(index)},${y(line.values[index])}`).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          )
        )}

        {endPoints.map(({ line, index }) => (
          <circle
            key={`end-${line.id}`}
            cx={x(index)}
            cy={y(line.values[index])}
            r="4"
            fill={line.color}
            stroke="var(--chart-surface)"
            strokeWidth="2"
          />
        ))}

        {endLabels.map(({ line, y: labelY }) => (
          <text
            key={`label-${line.id}`}
            x={margin.left + plotWidth + 12}
            y={labelY}
            dy="0.35em"
            fontSize="12"
            fontWeight="500"
            className="fill-slate-700 dark:fill-slate-200"
          >
            {truncate(line.name, 14)}
          </text>
        ))}

        {active != null &&
          readout
            .filter(({ value }) => value != null)
            .map(({ line, value }) => (
              <circle
                key={`active-${line.id}`}
                cx={x(active)}
                cy={y(value)}
                r="4"
                fill={line.color}
                stroke="var(--chart-surface)"
                strokeWidth="2"
              />
            ))}
      </svg>

      {active != null && (
        <div
          className="pointer-events-none absolute z-10 min-w-44 rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            top: margin.top,
            left: x(active),
            transform: tooltipOnLeft ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
        >
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatDay(days[active], { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <ul className="space-y-1.5">
            {readout.map(({ line, value }) => (
              <li key={line.id} className="flex items-center gap-2">
                <LineKey color={line.color} />
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {value == null ? '—' : view === 'daily' ? levelNear(value) : value.toFixed(1)}
                </span>
                <span className="truncate text-slate-600 dark:text-slate-300">{line.name}</span>
                {value != null && view === 'smoothed' && (
                  <span className="ml-auto pl-2 text-xs text-slate-500 dark:text-slate-400">≈ {levelNear(value)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState({});
  const [range, setRange] = useState(7);
  const [view, setView] = useState('smoothed');
  const [hidden, setHidden] = useState([]);

  useEffect(() => {
    const unsubSettings = onSnapshot(
      SETTINGS_DOC,
      (snap) => {
        const settings = snap.data() ?? {};
        if (RANGES.some((option) => option.days === settings.range)) setRange(settings.range);
        if (VIEWS.some((option) => option.key === settings.view)) setView(settings.view);
        if (Array.isArray(settings.hidden)) setHidden(settings.hidden);
      },
      (error) => reportListenerError('dashboard settings', error)
    );

    const unsubItems = onSnapshot(
      collection(db, ITEMS_COLLECTION),
      (snap) => {
        reportSnapshot(snap);
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      unsubSettings();
      unsubItems();
      unsubLogs();
    };
  }, []);

  // Settings are written on click rather than in an effect, so a snapshot arriving
  // from another device can't bounce straight back into another write.
  const saveSettings = (label, patch) =>
    trackWrite(label, () => setDoc(SETTINGS_DOC, patch, { merge: true }));

  const changeRange = (days) => {
    setRange(days);
    saveSettings('dashboard range', { range: days });
  };

  const changeView = (key) => {
    setView(key);
    saveSettings('dashboard view', { view: key });
  };

  const toggleSeries = (id) => {
    const next = hidden.includes(id) ? hidden.filter((hiddenId) => hiddenId !== id) : [...hidden, id];
    setHidden(next);
    saveSettings('dashboard lines', { hidden: next });
  };

  const rangeLabel = RANGES.find((option) => option.days === range).label;

  const days = useMemo(() => getLastNDays(range), [range]);

  const series = useMemo(() => {
    const smoothingDays = getLastNDays(range + SMOOTHING_WINDOW - 1);
    const previousDays = getLastNDays(range, range);

    return items.map((item, index) => {
      const daily = scoresFor(logs, days, item.id);
      const extended = scoresFor(logs, smoothingDays, item.id);
      const smoothed = days.map((_, i) => average(extended.slice(i, i + SMOOTHING_WINDOW)));

      return {
        ...item,
        color: seriesColor(index),
        daily,
        values: view === 'smoothed' ? smoothed : daily,
        avg: average(daily),
        prevAvg: average(scoresFor(logs, previousDays, item.id)),
        logged: daily.filter((value) => value != null).length,
        hidden: hidden.includes(item.id),
      };
    });
  }, [items, logs, days, range, view, hidden]);

  const visible = series.filter((line) => !line.hidden);

  return (
    <div className="min-h-screen bg-slate-100 px-4 pb-10 pt-6 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Trends</p>
            <h1 className="mt-2 text-3xl font-bold">Dashboard</h1>
          </div>
          <Link
            to="/tracking"
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
          >
            ✏️ Log today
          </Link>
        </div>

        <SyncStatus />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SegmentedControl
            label="Time range"
            options={RANGES.map((option) => ({ value: option.days, label: option.label }))}
            value={range}
            onChange={changeRange}
          />
          <SegmentedControl
            label="Line style"
            options={VIEWS.map((option) => ({ value: option.key, label: option.label }))}
            value={view}
            onChange={changeView}
          />
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-800">
            <p className="font-medium">Nothing to chart yet.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add something to track on the{' '}
              <Link to="/tracking" className="text-sky-600 hover:underline">Tracking page</Link>.
            </p>
          </div>
        ) : (
          <>
            <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-800">
              <div className="mb-4">
                <h2 className="text-lg font-bold">Everything you track, last {rangeLabel}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {view === 'smoothed'
                    ? `Each point is the average of the last ${SMOOTHING_WINDOW} days, so the direction is easier to see.`
                    : 'The level you logged each day. Gaps are days with nothing logged.'}
                </p>
              </div>

              {series.length >= 2 && (
                <div className="mb-4 flex flex-wrap gap-2" aria-label="Show or hide lines">
                  {series.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      aria-pressed={!line.hidden}
                      onClick={() => toggleSeries(line.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition ${
                        line.hidden
                          ? 'border-dashed border-slate-300 text-slate-400 hover:border-slate-400 dark:border-slate-600 dark:text-slate-500'
                          : 'border-slate-200 text-slate-700 hover:border-sky-300 dark:border-slate-600 dark:text-slate-200'
                      }`}
                    >
                      <LineKey color={line.color} muted={line.hidden} />
                      {line.name}
                    </button>
                  ))}
                </div>
              )}

              {visible.length === 0 ? (
                <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                  All lines are hidden. Pick one above to show it.
                </p>
              ) : (
                <TrendChart days={days} series={visible} view={view} />
              )}
            </section>

            {visible.length > 0 && (
              <section aria-label="Trend summary" className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {visible.map((line) => (
                  <div key={line.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <LineKey color={line.color} />
                      <h3 className="truncate font-semibold">{line.name}</h3>
                    </div>
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Average level</p>
                    <p className="mt-0.5 text-3xl font-semibold">
                      {line.avg == null ? '—' : line.avg.toFixed(1)}
                      {line.avg != null && (
                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                          ≈ {levelNear(line.avg)}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{describeChange(line, rangeLabel)}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {line.logged} of {range} days logged
                    </p>
                  </div>
                ))}
              </section>
            )}

            {visible.length > 0 && (
              <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:px-6 dark:border-slate-800 dark:bg-slate-800">
                <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300">
                  View as table
                </summary>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm tabular-nums">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                        {visible.map((line) => (
                          <th key={line.id} scope="col" className="py-2 pr-4 font-medium">{line.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...days].reverse().map((day) => {
                        const index = days.indexOf(day);
                        return (
                          <tr key={day} className="border-b border-slate-100 last:border-0 dark:border-slate-700/60">
                            <th scope="row" className="py-2 pr-4 font-normal text-slate-500 dark:text-slate-400">
                              {formatDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </th>
                            {visible.map((line) => (
                              <td key={line.id} className="py-2 pr-4">
                                {line.daily[index] == null ? '—' : levelNear(line.daily[index])}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
