/**
 * The analysis pipeline (§31).
 *
 *   quality → extraction → confidence → interpretation → recommendation → priority
 *
 * Two properties are enforced here rather than left to discipline:
 *
 * 1. Photo quality caps confidence. A rule cannot claim "high confidence" from
 *    a badly lit, angled frame, because the cap is applied after the rule runs
 *    and the rule has no way to override it.
 *
 * 2. The priority figure never leaves this module. It is computed, sorted on,
 *    and discarded — what the UI receives is `high` / `medium` / `low`. A number
 *    on screen is how an appearance tool becomes a scoring tool.
 */

import type { FaceMeasurements } from '@/lib/vision/faceMeasure';
import type { SkinReading } from '@/lib/vision/skinRead';
import { RULES, STRENGTH_RULES, type RuleContext } from '@/content/rules';
import type {
  AnalysisResult, Confidence, Effort, Impact, Inference,
  Observation, PhotoQuality, Recommendation, Strength, UserPreferences,
} from './types';

const CONFIDENCE_RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const RANK_CONFIDENCE: readonly Confidence[] = ['low', 'medium', 'high'];

/** Never claim more certainty than the photograph supports. */
function capConfidence(rule: Confidence, quality: Confidence): Confidence {
  const capped = Math.min(CONFIDENCE_RANK[rule], CONFIDENCE_RANK[quality]);
  return RANK_CONFIDENCE[capped] ?? 'low';
}

const IMPACT_WEIGHT: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const EFFORT_WEIGHT: Record<Effort, number> = { easy: 1, moderate: 1.8, involved: 3 };
const CONFIDENCE_WEIGHT: Record<Confidence, number> = { high: 1, medium: 0.7, low: 0.4 };

/** Internal only. See the note at the top of this file. */
function priority(r: Recommendation, prefs: UserPreferences): number {
  const relevance = prefs.goals.length === 0 ? 1 : prefs.goals.includes(r.category) ? 1.6 : 0.75;
  return (
    (IMPACT_WEIGHT[r.impact] * CONFIDENCE_WEIGHT[r.confidence] * relevance) / EFFORT_WEIGHT[r.effort]
  );
}

export interface PipelineInput {
  readonly face: FaceMeasurements;
  readonly skin: SkinReading | null;
  readonly quality: PhotoQuality;
  readonly preferences: UserPreferences;
}

export function runPipeline(input: PipelineInput): AnalysisResult {
  const { face, skin, quality, preferences } = input;
  const ctx: RuleContext = { face, skin, wearsGlasses: preferences.wearsGlasses };

  const observations: Observation[] = [];
  const inferences: Inference[] = [];
  const recommendations: Recommendation[] = [];

  for (const rule of RULES) {
    const value = rule.read(ctx);
    if (value == null || !Number.isFinite(value)) continue;
    if (!rule.fires(value, ctx)) continue;

    const confidence = capConfidence(rule.confidence, quality.confidence);

    observations.push({
      id: rule.id,
      category: rule.category,
      observed: rule.observed(value),
      evidence: { metric: rule.metric, value: Math.round(value * 1000) / 1000, unit: rule.unit },
      confidence,
    });

    inferences.push({ observationId: rule.id, inferred: rule.inferred, confidence });

    recommendations.push({
      id: rule.id,
      category: rule.category,
      title: rule.title,
      // A rule may interpolate its own measurement into the copy.
      why: rule.why.replace('{value}', formatValue(value, rule.unit)),
      how: rule.how,
      impact: rule.impact,
      effort: rule.effort,
      confidence,
      requiresProfessional: rule.requiresProfessional ?? false,
      horizon: rule.horizon,
      observationIds: [rule.id],
    });
  }

  const ranked = recommendations
    .map((r) => ({ r, p: priority(r, preferences) }))
    .sort((a, b) => b.p - a.p)
    .map(({ r }) => r);

  const strengths: Strength[] = STRENGTH_RULES.filter((s) => s.fires(ctx)).map((s) => ({
    id: s.id,
    category: s.category,
    title: s.title,
    detail: s.detail,
  }));

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    quality,
    observations,
    inferences,
    // 2–3 strengths, 3–5 opportunities. More than that and nothing gets done.
    strengths: strengths.slice(0, 3),
    opportunities: ranked.slice(0, 5),
    additional: ranked.slice(5),
  };
}

function formatValue(v: number, unit?: string): string {
  return unit === 'mm' ? `${v.toFixed(0)} mm` : v.toFixed(2);
}

/* ─────────────────── labels ─────────────────── */

export const IMPACT_LABEL: Record<Impact, string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
};

export const EFFORT_LABEL: Record<Effort, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  involved: 'More effort',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export const HORIZON_LABEL: Record<Recommendation['horizon'], string> = {
  now: 'Now',
  week: 'This week',
  month: 'This month',
  optional: 'Optional',
};

export const CATEGORY_LABEL: Record<Recommendation['category'], string> = {
  hair: 'Hair',
  grooming: 'Grooming',
  skin: 'Skin',
  style: 'Style',
  presentation: 'Presentation',
  photo: 'Photos',
  eyewear: 'Eyewear',
  routine: 'Routine',
};

/** Group the plan by when it is worth doing (§16). */
export function groupByHorizon(recs: readonly Recommendation[]) {
  const order: Recommendation['horizon'][] = ['now', 'week', 'month', 'optional'];
  return order
    .map((h) => ({ horizon: h, label: HORIZON_LABEL[h], items: recs.filter((r) => r.horizon === h) }))
    .filter((g) => g.items.length > 0);
}
