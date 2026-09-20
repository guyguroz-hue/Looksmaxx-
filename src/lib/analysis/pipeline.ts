/**
 * The analysis pipeline.
 *
 *   quality → measurement → intake → selection → confidence cap → priority
 *
 * Two properties are enforced here rather than left to discipline:
 *
 * 1. Photo quality caps confidence. A finding cannot claim certainty the
 *    photograph does not support, because the cap is applied after selection
 *    and the selector has no way to override it.
 *
 * 2. The priority figure never leaves this module. It is computed, sorted on,
 *    and discarded — what the UI receives is `high` / `medium` / `low`. A
 *    number on screen is how an appearance tool becomes a scoring tool.
 */

import type { FaceMeasurements } from '@/lib/vision/faceMeasure';
import type { SkinReading } from '@/lib/vision/skinRead';
import { select, strengths } from '@/content/selectors';
import type { Evidence, Protocol } from '@/content/protocols';
import type { Intake } from '@/content/intake';
import type {
  AnalysisResult, Confidence, Effort, Impact, Observation, PhotoQuality, Recommendation,
} from './types';

const RANK: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
const BY_RANK: readonly Confidence[] = ['low', 'medium', 'high'];

function cap(claimed: Confidence, quality: Confidence): Confidence {
  return BY_RANK[Math.min(RANK[claimed], RANK[quality])] ?? 'low';
}

const IMPACT_W: Record<Impact, number> = { high: 3, medium: 2, low: 1 };
const EFFORT_W: Record<Effort, number> = { easy: 1, moderate: 1.8, involved: 3 };
const CONF_W: Record<Confidence, number> = { high: 1, medium: 0.7, low: 0.4 };
const EVIDENCE_W: Record<Evidence, number> = { A: 1, B: 0.8, C: 0.55 };

/** How much of a stated concern each category serves. */
const CONCERN_MAP: Record<string, readonly Protocol['category'][]> = {
  skin: ['skin'],
  jawline: ['grooming', 'presentation'],
  undereye: ['skin', 'routine'],
  definition: ['presentation', 'grooming'],
  hair: ['hair'],
};

export interface PipelineInput {
  readonly report: import('@/lib/vision/facialReport').FacialReport | null;
  readonly face: FaceMeasurements;
  readonly skin: SkinReading | null;
  readonly quality: PhotoQuality;
  readonly intake: Intake;
}

export function runPipeline({ face, skin, quality, intake, report }: PipelineInput): AnalysisResult {
  const ctx = { face, skin, intake };
  const findings = select(ctx);

  const concernCats = new Set(
    (intake.concerns ?? []).flatMap((c) => CONCERN_MAP[c] ?? []),
  );

  const observations: Observation[] = [];
  const scored = findings.map((f) => {
    const p = f.protocol;
    const confidence = cap(p.confidence, quality.confidence);
    if (f.observation) {
      observations.push({ ...f.observation, confidence: cap(f.observation.confidence, quality.confidence) });
    }

    const rec: Recommendation = {
      id: p.id,
      category: p.category,
      title: p.title,
      why: f.personalWhy ?? p.why,
      how: p.how,
      impact: p.impact,
      effort: p.effort,
      confidence,
      requiresProfessional: p.requiresProfessional ?? false,
      horizon: p.horizon,
      observationIds: f.observation ? [f.observation.id] : [],
      evidence: p.evidence,
      weeks: p.weeks,
      caution: p.caution,
      /** True when the copy was written for this person's measurements. */
      personalised: Boolean(f.personalWhy),
    };

    const relevance = concernCats.has(p.category) ? 1.5 : 1;
    const priority =
      (IMPACT_W[p.impact] * CONF_W[confidence] * EVIDENCE_W[p.evidence] * relevance * f.boost) /
      EFFORT_W[p.effort];

    return { rec, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const ranked = scored.map((s) => s.rec);

  // Dedupe observations by id, keeping the first (highest-priority) instance.
  const seen = new Set<string>();
  const uniqueObs = observations.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)));

  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    quality,
    observations: uniqueObs,
    inferences: [],
    strengths: strengths(ctx).slice(0, 3),
    // Three to five headline items. More than that and nothing gets done.
    opportunities: ranked.slice(0, 5),
    additional: ranked.slice(5),
    report: report ?? null,
  };
}

/* ─────────────────── labels ─────────────────── */

export const IMPACT_LABEL: Record<Impact, string> = {
  high: 'High impact', medium: 'Medium impact', low: 'Low impact',
};
export const EFFORT_LABEL: Record<Effort, string> = {
  easy: 'Easy', moderate: 'Moderate', involved: 'More effort',
};
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence',
};
export const HORIZON_LABEL: Record<Recommendation['horizon'], string> = {
  now: 'Start now', week: 'This week', month: 'This month', optional: 'Optional',
};
export const CATEGORY_LABEL: Record<Recommendation['category'], string> = {
  hair: 'Hair', grooming: 'Grooming', skin: 'Skin', style: 'Style',
  presentation: 'Face & posture', photo: 'Photo', eyewear: 'Eyewear', routine: 'Habits',
};

/** Weeks until a visible change, phrased the way a person would say it. */
export function timeframe(weeks: readonly [number, number]): string {
  const [lo, hi] = weeks;
  if (lo === 0) return hi <= 1 ? 'Within a day or two' : `Within ${hi} weeks`;
  if (lo >= 12) return `${Math.round(lo / 4)}–${Math.round(hi / 4)} months`;
  return `${lo}–${hi} weeks`;
}

export function groupByHorizon(recs: readonly Recommendation[]) {
  const order: Recommendation['horizon'][] = ['now', 'week', 'month', 'optional'];
  return order
    .map((h) => ({ horizon: h, label: HORIZON_LABEL[h], items: recs.filter((r) => r.horizon === h) }))
    .filter((g) => g.items.length > 0);
}
