/* Turns raw measurements into scores, and — just as importantly — into an
 * honest ceiling. The "potential" score only counts gains on metrics a person
 * can actually move without surgery, so the app never promises a new skull. */

import { METRICS, DOMAINS, resolveBand, readValue } from '../content/metricsCatalog.js';
import { bandScore, weightedMean, clamp } from './geometry.js';

/* How much of the gap to the target band each modifiability tier can realistically
 * close. These numbers are deliberately conservative — an app that over-promises
 * is worse than one that under-promises. */
const CEILING = { fixed: 0.0, soft: 0.55, live: 0.9 };

export const BANDS = [
  { min: 86, key: 'excellent', label: 'מצוין',     status: 'good'  },
  { min: 72, key: 'strong',    label: 'חזק',       status: 'good'  },
  { min: 56, key: 'fair',      label: 'תקין',      status: 'watch' },
  { min: 0,  key: 'focus',     label: 'מוקד שיפור', status: 'focus' },
];
export const bandOf = (score) => BANDS.find(b => score >= b.min) ?? BANDS[BANDS.length - 1];

/**
 * @param {object} bundle  { face, skin, body, bodySide }
 * @param {object} profile { sex: 'm'|'f'|'x' }
 */
export function scoreAll(bundle, profile = {}) {
  const sex = profile.sex ?? 'x';
  const metrics = [];

  for (const def of METRICS) {
    const raw = readValue(bundle, def.from);
    if (raw == null || !Number.isFinite(raw)) {
      metrics.push({ ...def, value: null, score: null, available: false });
      continue;
    }
    const [lo, hi] = resolveBand(def, sex);
    const score = bandScore(raw, lo, hi, def.tol);

    /* Where inside / outside the band the value sits, for the bar's fill.
       Mapped so the target tick always lands at 78% of the track. */
    const span = hi - lo || 1e-9;
    const rel = raw < lo ? (raw - lo) / (def.tol || span) : raw > hi ? (raw - hi) / (def.tol || span) : 0;

    metrics.push({
      ...def, value: raw, score, available: true,
      band: [lo, hi], inBand: raw >= lo && raw <= hi,
      deviation: Math.round(rel * 100) / 100,
      status: bandOf(score).status,
      /* Potential for THIS metric, given what can actually change. */
      potential: Math.round(score + (100 - score) * CEILING[def.mod]),
      headroom: Math.round((100 - score) * CEILING[def.mod]),
    });
  }

  /* ---- domain roll-up ---- */
  const domains = {};
  for (const key of Object.keys(DOMAINS)) {
    const list = metrics.filter(m => m.domain === key && m.available);
    const covered = metrics.filter(m => m.domain === key);
    const score = weightedMean(list.map(m => ({ value: m.score, weight: m.weight })));
    const potential = weightedMean(list.map(m => ({ value: m.potential, weight: m.weight })));
    domains[key] = {
      ...DOMAINS[key],
      score: score == null ? null : Math.round(score),
      potential: potential == null ? null : Math.round(potential),
      measured: list.length, total: covered.length,
      complete: list.length === covered.length,
      metrics: metrics.filter(m => m.domain === key),
    };
  }

  const dl = Object.values(domains).filter(d => d.score != null);
  const overall = weightedMean(dl.map(d => ({ value: d.score, weight: d.weight })));
  const potential = weightedMean(dl.map(d => ({ value: d.potential, weight: d.weight })));

  /* Coverage tells the user how much of the picture they have actually captured —
     a score from a face scan alone is not the same claim as a full scan. */
  const measured = metrics.filter(m => m.available).length;

  return {
    overall: overall == null ? null : Math.round(overall),
    potential: potential == null ? null : Math.round(potential),
    band: overall == null ? null : bandOf(Math.round(overall)),
    domains,
    metrics,
    coverage: {
      measured, total: metrics.length,
      pct: Math.round((measured / metrics.length) * 100),
      missingDomains: Object.values(domains).filter(d => d.score == null).map(d => d.short),
    },
    at: Date.now(),
  };
}

/**
 * Rank what to work on. Sorts by how much score is genuinely reachable,
 * weighted by evidence strength and how quickly the protocol pays off —
 * so the list opens with "sleep" and not with "skeletal jaw angle".
 */
export function rankOpportunities(result, limit = 6) {
  return result.metrics
    .filter(m => m.available && m.headroom > 3)
    .map(m => {
      const domainW = DOMAINS[m.domain].weight;
      const evW = { A: 1.0, B: 0.82, C: 0.6 }[m.ev];
      return { ...m, opportunity: m.headroom * m.weight * domainW * evW };
    })
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, limit);
}

/** Percentage of the achievable gain the user has already banked. */
export function progressToCeiling(result) {
  if (result.overall == null || result.potential == null) return null;
  const gap = result.potential - result.overall;
  return gap <= 0.5 ? 100 : Math.round(clamp((result.overall - 40) / (result.potential - 40)) * 100);
}
