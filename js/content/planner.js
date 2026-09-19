/* Builds the personal plan: turns ranked opportunities into an ordered,
 * de-duplicated protocol list plus a daily checklist.
 *
 * Two deliberate biases:
 *  1. Evidence and speed win ties — the plan opens with things that work and
 *     show up fast, because an abandoned plan has zero effect size.
 *  2. The daily list is capped. A 19-item checklist is a guilt machine, not a
 *     habit. Five is enough to build a streak on. */

import { PROTOCOLS, protocol, EVIDENCE_RANK } from './protocols.js';
import { rankOpportunities } from '../analysis/scoring.js';

const DAILY_CAP = 5;
const PLAN_CAP = 9;

/** How fast a protocol pays off, 0..1 (sooner = higher). */
const speed = (p) => 1 / (1 + p.weeks[0] / 6);

export function buildPlan(result) {
  const opps = rankOpportunities(result, 10);

  /* Score every protocol by the opportunities it serves. A protocol that shows
     up under three weak metrics outranks one that serves a single metric. */
  const tally = new Map();
  opps.forEach((m, rank) => {
    const rankW = 1 / (1 + rank * 0.35);
    for (const id of m.protocols ?? []) {
      const p = PROTOCOLS[id];
      if (!p) continue;
      const prev = tally.get(id) ?? { id, weight: 0, targets: [] };
      prev.weight += m.opportunity * rankW * p.lift * (EVIDENCE_RANK[p.ev] / 3);
      prev.targets.push({ id: m.id, label: m.label, headroom: m.headroom });
      tally.set(id, prev);
    }
  });

  const ranked = [...tally.values()]
    .map(t => {
      const p = protocol(t.id);
      return { ...p, ...t, priority: t.weight * (0.65 + 0.35 * speed(p)) };
    })
    .sort((a, b) => b.priority - a.priority);

  const plan = ranked.slice(0, PLAN_CAP);

  /* Daily checklist: the daily-habit protocols from the plan, strongest
     evidence first, capped so it stays doable. */
  const daily = plan
    .filter(p => p.daily)
    .sort((a, b) => EVIDENCE_RANK[b.ev] - EVIDENCE_RANK[a.ev] || b.priority - a.priority)
    .slice(0, DAILY_CAP);

  /* If the plan is thin on daily habits (a very high scorer), backfill with the
     universal A-grade basics so the checklist is never empty. */
  if (daily.length < 3) {
    for (const id of ['sleep', 'spf', 'cleanse', 'moisturize', 'nutrition']) {
      if (daily.length >= 3) break;
      if (!daily.some(d => d.id === id)) daily.push({ ...protocol(id), targets: [], priority: 0 });
    }
  }

  return {
    plan,
    daily,
    horizon: horizonOf(plan),
    quickWins: plan.filter(p => p.weeks[0] <= 2).slice(0, 3),
  };
}

/** Group the plan into a timeline the user can actually read. */
function horizonOf(plan) {
  const buckets = [
    { key: 'now',   label: 'מיידי — עד שבועיים',  test: p => p.weeks[0] <= 2,               items: [] },
    { key: 'weeks', label: 'שבועות 2–12',          test: p => p.weeks[0] > 2 && p.weeks[0] < 12, items: [] },
    { key: 'long',  label: '3 חודשים ומעלה',       test: p => p.weeks[0] >= 12,              items: [] },
  ];
  for (const p of plan) (buckets.find(b => b.test(p)) ?? buckets[2]).items.push(p);
  return buckets.filter(b => b.items.length);
}
