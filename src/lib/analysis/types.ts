/**
 * The analysis contract.
 *
 * The type system is doing safety work here. An `Observation` cannot become a
 * `Recommendation` without passing through an `Inference`, because the three
 * are separate shapes — there is no code path that turns a measurement directly
 * into advice. That separation is the single most important guardrail in the
 * product, so it lives in the types rather than in a convention someone can
 * forget.
 */

import type { Confidence } from '@/lib/vision/types';

export type { Confidence };

export type Category = 'hair' | 'grooming' | 'skin' | 'style' | 'presentation' | 'photo' | 'eyewear' | 'routine';

export type Impact = 'high' | 'medium' | 'low';
export type Effort = 'easy' | 'moderate' | 'involved';

/** Step 1 — what the image actually shows. No interpretation permitted. */
export interface Observation {
  readonly id: string;
  readonly category: Category;
  /** Plain description of what was measured. Never evaluative. */
  readonly observed: string;
  /** The measurement that produced it, for transparency and debugging. */
  readonly evidence: { readonly metric: string; readonly value: number; readonly unit?: string };
  readonly confidence: Confidence;
}

/** Step 2 — what that might mean for presentation. Hedged by construction. */
export interface Inference {
  readonly observationId: string;
  /** Always phrased as an effect on framing, never as a verdict on a person. */
  readonly inferred: string;
  readonly confidence: Confidence;
}

/** Step 3 — something safe the person could try. */
export interface Recommendation {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  /** WHAT / WHY / HOW — the three questions every card must answer. */
  readonly why: string;
  readonly how: readonly string[];
  readonly impact: Impact;
  readonly effort: Effort;
  readonly confidence: Confidence;
  /** When true the UI shows a neutral "a professional can help" note. */
  readonly requiresProfessional: boolean;
  readonly horizon: 'now' | 'week' | 'month' | 'optional';
  readonly observationIds: readonly string[];
  /** A / B / C — stated plainly, because "limited evidence" is information. */
  readonly evidence: 'A' | 'B' | 'C';
  /** Realistic weeks to a visible change. */
  readonly weeks: readonly [number, number];
  readonly caution?: string;
  /** True when `why` was written for this person rather than in general. */
  readonly personalised: boolean;
}

/** Something already working. Named first, on purpose. */
export interface Strength {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  readonly detail: string;
}

export interface PhotoQuality {
  readonly confidence: Confidence;
  readonly checks: readonly QualityCheck[];
  readonly usable: boolean;
  /** The single most useful correction right now, or null when framing is good. */
  readonly primaryHint: string | null;
}

export interface QualityCheck {
  readonly id: string;
  readonly label: string;
  readonly passed: boolean;
  /** 0..1, for the live meter only — never surfaced as a figure. */
  readonly level: number;
  readonly hint: string;
}

export interface AnalysisResult {
  readonly id: string;
  readonly createdAt: number;
  readonly quality: PhotoQuality;
  readonly observations: readonly Observation[];
  readonly inferences: readonly Inference[];
  readonly strengths: readonly Strength[];
  readonly opportunities: readonly Recommendation[];
  /** Everything not surfaced as a headline opportunity, for the full plan. */
  readonly additional: readonly Recommendation[];
}

/** The capture pipeline's explicit states — the UI reacts to these, not timers. */
export type AnalysisState =
  | 'idle'
  | 'capturing'
  | 'validating'
  | 'analyzing'
  | 'generating_insights'
  | 'generating_plan'
  | 'complete'
  | 'error'
  | 'cancelled';
