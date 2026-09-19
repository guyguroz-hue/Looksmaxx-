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
import { deriveContext } from './profileMetrics.js';

const DAILY_CAP = 5;
const PLAN_CAP = 9;

/** How fast a protocol pays off, 0..1 (sooner = higher). */
const speed = (p) => 1 / (1 + p.weeks[0] / 6);

/* Which domains each stated concern maps to, so "what bothers you most"
   reorders the plan without touching the score. */
const CONCERN_DOMAINS = {
  skin: ['skin'], undereye: ['skin'], jawline: ['definition'],
  body: ['body'], posture: ['posture'], hair: ['harmony'], teeth: ['harmony'],
};

/**
 * Safety and relevance filters driven by the questionnaire. Returning a number
 * scales the protocol's priority; returning 0 removes it entirely.
 */
function profileFactor(p, ctx, answers) {
  // Hard safety gate: retinoids are contraindicated in pregnancy.
  if (ctx.flags.includes('pregnant') && p.id === 'retinoid') return 0;

  // Don't tell someone to start what they already do daily.
  if (ctx.flags.includes('spf_already') && p.id === 'spf') return 0.15;

  // Never push fat loss on someone already under a healthy BMI.
  if (ctx.flags.includes('underweight') && p.id === 'bodyfat') return 0;

  // Puffiness at a normal BMI is a fluid problem, not a fat problem.
  if (ctx.flags.includes('puffiness_not_fat')) {
    if (p.id === 'bodyfat') return 0.25;
    if (['sodium', 'alcohol', 'sleep', 'hydration'].includes(p.id)) return 1.8;
  }
  if (ctx.flags.includes('adiposity_driven') && p.id === 'bodyfat') return 1.5;

  // Under-eyes with adequate sleep: stop recommending more sleep, look elsewhere.
  if (ctx.flags.includes('undereye_not_sleep')) {
    if (p.id === 'sleep') return 0.3;
    if (['allergy', 'eye_care', 'hydration'].includes(p.id)) return 1.6;
  }
  if (ctx.flags.includes('undereye_sleep') && p.id === 'sleep') return 2.0;
  if (ctx.flags.includes('sun_damage_untreated') && p.id === 'spf') return 2.0;

  // Already training: the lever is progression, not starting.
  if (ctx.flags.includes('trains_already') && ['cardio', 'strength'].includes(p.id)) return 0.7;
  if (ctx.flags.includes('sedentary') && ['cardio', 'strength'].includes(p.id)) return 1.3;

  if (ctx.flags.includes('alcohol_high') && p.id === 'alcohol') return 1.7;
  if (ctx.flags.includes('smoker') && p.id === 'gentle_routine') return 1.2;

  // Retinoids and actives get less appropriate the younger the user is.
  if ((answers.age ?? 30) < 20 && ['retinoid', 'vitc'].includes(p.id)) return 0.4;
  if ((answers.age ?? 30) >= 40 && p.id === 'retinoid') return 1.3;

  if (answers.skinType === 'sensitive' && ['retinoid'].includes(p.id)) return 0.6;
  if (answers.skinType === 'sensitive' && p.id === 'gentle_routine') return 1.4;

  return 1;
}

export function buildPlan(result, bundle = {}) {
  const answers = result.profile ?? {};
  const ctx = deriveContext(answers, bundle);
  const concernDomains = new Set((answers.concerns ?? []).flatMap(c => CONCERN_DOMAINS[c] ?? []));
  const opps = rankOpportunities(result, 10);

  /* Score every protocol by the opportunities it serves. A protocol that shows
     up under three weak metrics outranks one that serves a single metric. */
  const tally = new Map();
  opps.forEach((m, rank) => {
    const rankW = 1 / (1 + rank * 0.35);
    // A domain the user named as their main concern gets a real but bounded
    // boost — enough to reorder the plan, not enough to bury a stronger lever.
    const concernW = concernDomains.has(m.domain) ? 1.45 : 1;
    for (const id of m.protocols ?? []) {
      const p = PROTOCOLS[id];
      if (!p) continue;
      const prev = tally.get(id) ?? { id, weight: 0, targets: [] };
      prev.weight += m.opportunity * rankW * concernW * p.lift * (EVIDENCE_RANK[p.ev] / 3);
      prev.targets.push({ id: m.id, label: m.label, headroom: m.headroom });
      tally.set(id, prev);
    }
  });

  const ranked = [...tally.values()]
    .map(t => {
      const p = protocol(t.id);
      const factor = profileFactor(p, ctx, answers);
      return { ...p, ...t, factor, priority: t.weight * (0.65 + 0.35 * speed(p)) * factor };
    })
    .filter(p => p.factor > 0)          // safety filters remove, they do not demote
    .sort((a, b) => b.priority - a.priority);

  /* Guaranteed representation.
   *
   * A stated concern gets a weight boost, but weights alone are not enough: if
   * body composition dominates the maths, someone who said "my skin is what
   * bothers me" can still get four body protocols before anything they asked
   * about. That reads as not listening. So rather than inflate the boost until
   * it distorts the evidence, we promote the best concern-matched protocol into
   * the top three — the ranking stays honest, and the person still sees the
   * thing they came for. */
  let plan = ranked.slice(0, PLAN_CAP);
  if (concernDomains.size) {
    const matches = (p) => (p.targets ?? []).some(t => {
      const metric = result.metrics.find(m => m.id === t.id);
      return metric && concernDomains.has(metric.domain);
    });
    const inTop = plan.slice(0, 3).some(matches);
    if (!inTop) {
      const best = ranked.find(matches);
      if (best) {
        plan = [...plan.filter(p => p.id !== best.id)];
        plan.splice(2, 0, { ...best, promoted: true });
        plan = plan.slice(0, PLAN_CAP);
      }
    }
  }

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
      const p = protocol(id);
      if (profileFactor(p, ctx, answers) === 0) continue;   // never backfill past a safety gate
      if (!daily.some(d => d.id === id)) daily.push({ ...p, targets: [], priority: 0 });
    }
  }

  /* A concern that maps only to locked metrics is the one case where the body
     scan is worth actively suggesting — the user has told us it matters and we
     have not measured it. */
  const measuredDomains = new Set(result.metrics.filter(m => m.available).map(m => m.domain));
  const unmeasuredConcerns = [...concernDomains].filter(d => !measuredDomains.has(d));

  return {
    plan,
    daily,
    context: ctx,
    unmeasuredConcerns,
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
