import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const PHASES = [
  {
    name: 'Phase 1 — Warm up',
    when: 'Done ✓',
    topics: [
      'Order of operations (PEMDAS)',
      'Fractions: add, take away, times, divide',
      'Decimals and percents',
      'Negative numbers',
      'Exponent rules',
      'Square roots basics',
    ],
  },
  {
    name: 'Phase 2 — QAS topics',
    when: 'July 12 – July 26',
    topics: [
      'Solve for x',
      'Graph y = mx + b',
      'Slope from two points',
      'Word problems: rates, ratios',
      'Probability, mean, median',
      'Sets: union and intersection',
      'Area, perimeter, volume',
    ],
  },
  {
    name: 'Phase 3 — Big algebra',
    when: 'July 27 – August 12',
    topics: [
      'Function notation f(x)',
      'Factoring',
      'Quadratics by factoring',
      'Quadratic formula',
      'Quadratic graphs (parabola)',
      'Multiply polynomials (FOIL)',
      'Polynomial end behavior',
      'Systems of equations',
    ],
  },
  {
    name: 'Phase 4 — Harder topics',
    when: 'August 13 – August 23',
    topics: [
      'Rational equations',
      'Radical equations',
      'Exponential functions',
      'Logarithms basics',
      'Range and domain',
      'Surface area of prisms',
      'Right triangle trig (sin, cos, tan)',
    ],
  },
  {
    name: 'Phase 5 — Test prep',
    when: 'August 24 – August 29',
    topics: [
      'Practice test: Arithmetic + QAS',
      'Practice test: Advanced Algebra',
    ],
  },
];

const ALL = PHASES.flatMap((p) => p.topics);
const TOTAL = ALL.length;
const DEFAULT_DONE = ALL.slice(0, 5);
const STORAGE_KEY = 'math_done_topics';

export default function MathPage() {
  const [done, setDone] = useState(() => new Set(DEFAULT_DONE));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDone(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.warn('Failed to load math progress', e);
    }
    setLoaded(true);
  }, []);

  const save = (nextSet) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...nextSet]));
    } catch (e) {
      console.warn('Failed to save math progress', e);
    }
  };

  const toggle = (topic) => {
    const next = new Set(done);
    if (next.has(topic)) next.delete(topic);
    else next.add(topic);
    setDone(next);
    save(next);
  };

  const reset = () => {
    const empty = new Set();
    setDone(empty);
    save(empty);
  };

  const count = [...done].filter((topic) => ALL.includes(topic)).length;
  const pct = Math.round((count / TOTAL) * 100);

  const ink = '#1f2233';
  const green = '#2ea36b';
  const soft = '#eef0f7';

  return (
    <div style={{ minHeight: '100%', background: '#f7f8fc', color: ink, padding: '22px 16px 40px', maxWidth: 640, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap'); html, body { font-family: 'Nunito', ui-rounded, system-ui, sans-serif; }`}</style>

      <div style={{ background: '#fff', borderRadius: 22, padding: '26px 22px', boxShadow: '0 8px 24px rgba(31,34,51,0.06)', textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#8b90a6', letterSpacing: 0.4 }}>YOU HAVE DONE</div>
        <div style={{ fontSize: 84, fontWeight: 900, lineHeight: 1, color: green, margin: '4px 0 2px' }}>{pct}%</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#8b90a6' }}>{count} of {TOTAL} topics</div>

        <div style={{ background: soft, height: 16, borderRadius: 10, marginTop: 18, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, #57c48a, ${green})`, borderRadius: 10, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#8b90a6', marginTop: 14 }}>Goal: 250+ · Last score: 203</div>
      </div>

      {PHASES.map((phase) => {
        const phaseDone = phase.topics.filter((topic) => done.has(topic)).length;
        return (
          <div key={phase.name} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, padding: '0 4px' }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{phase.name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8b90a6' }}>{phaseDone}/{phase.topics.length} · {phase.when}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 14px rgba(31,34,51,0.05)' }}>
              {phase.topics.map((topic, index) => {
                const isDone = done.has(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggle(topic)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '13px 16px',
                      border: 'none',
                      borderTop: index === 0 ? 'none' : '1px solid #f0f1f6',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{
                      flexShrink: 0,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: isDone ? 'none' : '2.5px solid #d6d9e6',
                      background: isDone ? green : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 15,
                      fontWeight: 900,
                    }}>
                      {isDone ? '✓' : ''}
                    </span>
                    <span style={{
                      fontSize: 15.5,
                      fontWeight: 700,
                      color: isDone ? '#a7abbd' : ink,
                      textDecoration: isDone ? 'line-through' : 'none',
                    }}>{topic}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ textAlign: 'center', fontSize: 14, color: '#8b90a6', fontWeight: 700, marginTop: 8 }}>Tap a circle when you finish a topic. Want to learn one? Just tell me its name.</div>
      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={reset}
          style={{
            border: '2px solid #e2e4ee',
            background: '#fff',
            color: '#8b90a6',
            fontWeight: 800,
            fontSize: 13,
            padding: '8px 18px',
            borderRadius: 20,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Start over
        </button>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 18px',
            background: '#1d4ed8',
            color: '#fff',
            borderRadius: 20,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          Back to tasks
        </Link>
      </div>
    </div>
  );
}
