/* Local persistence. Everything the app knows lives here, on the device.
 * No account, no server, no sync — which is what makes the privacy promise
 * on the intro screen true rather than aspirational. */

const KEY = 'looksmaxx.v1';
const MAX_HISTORY = 60;

const blank = () => ({
  profile: { onboarded: false },   // no pre-selected answers — every one must be chosen
  history: [],            // [{ at, overall, potential, domains:{k:score}, coverage }]
  lastResult: null,       // the full result object of the most recent scan
  checks: {},             // { 'YYYY-MM-DD': [protocolId, ...] }
  streak: { count: 0, best: 0, last: null },
  consent: { camera: false, at: null },
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch { return blank(); }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* private mode / quota — the app keeps working in memory */ }
}

export const get = () => state;
export function update(fn) { fn(state); persist(); return state; }
export function reset() { state = blank(); try { localStorage.removeItem(KEY); } catch {} return state; }

export const today = () => new Date().toISOString().slice(0, 10);

export function saveResult(result) {
  return update(s => {
    s.lastResult = result;
    s.history.push({
      at: result.at,
      overall: result.overall,
      potential: result.potential,
      coverage: result.coverage.pct,
      domains: Object.fromEntries(Object.entries(result.domains).map(([k, d]) => [k, d.score])),
    });
    if (s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
  });
}

export function toggleCheck(protocolId) {
  const d = today();
  return update(s => {
    const list = s.checks[d] ?? (s.checks[d] = []);
    const i = list.indexOf(protocolId);
    if (i >= 0) list.splice(i, 1); else list.push(protocolId);
    recomputeStreak(s);
  });
}

export const checkedToday = () => state.checks[today()] ?? [];

/** A day counts toward the streak once anything on it is ticked. */
function recomputeStreak(s) {
  const days = Object.keys(s.checks).filter(d => s.checks[d].length).sort();
  if (!days.length) { s.streak = { count: 0, best: s.streak.best, last: null }; return; }
  let count = 1;
  for (let i = days.length - 1; i > 0; i--) {
    const a = new Date(days[i]), b = new Date(days[i - 1]);
    if (Math.round((a - b) / 86400000) === 1) count++; else break;
  }
  const last = days[days.length - 1];
  const stale = Math.round((new Date(today()) - new Date(last)) / 86400000) > 1;
  s.streak = { count: stale ? 0 : count, best: Math.max(s.streak.best ?? 0, count), last };
}

/** Change between the two most recent scans, for the trend readout. */
export function delta() {
  const h = state.history;
  if (h.length < 2) return null;
  const a = h[h.length - 2], b = h[h.length - 1];
  return { overall: b.overall - a.overall, days: Math.round((b.at - a.at) / 86400000) };
}
