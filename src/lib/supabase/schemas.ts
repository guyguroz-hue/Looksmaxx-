/**
 * Runtime validation for anything read back out of the database (§32).
 *
 * Rows are external input: they were written by an earlier version of this app,
 * possibly a different one, possibly by hand. Casting them would mean a schema
 * change three months from now surfaces as a blank screen with no explanation.
 * Parsing means a bad row is dropped and the rest still renders.
 */

import { z } from 'zod';

const confidence = z.enum(['high', 'medium', 'low']);
const category = z.enum([
  'hair', 'grooming', 'skin', 'style', 'presentation', 'photo', 'eyewear', 'routine',
]);

export const strengthSchema = z.object({
  id: z.string(),
  category,
  title: z.string(),
  detail: z.string(),
});

export const recommendationSchema = z.object({
  id: z.string(),
  category,
  title: z.string(),
  why: z.string(),
  how: z.array(z.string()),
  impact: z.enum(['high', 'medium', 'low']),
  effort: z.enum(['easy', 'moderate', 'involved']),
  confidence,
  requiresProfessional: z.boolean(),
  horizon: z.enum(['now', 'week', 'month', 'optional']),
  observationIds: z.array(z.string()),
  evidence: z.enum(['A', 'B', 'C']),
  weeks: z.tuple([z.number(), z.number()]),
  caution: z.string().optional(),
  personalised: z.boolean(),
});

export const analysisRowSchema = z.object({
  taken_at: z.string(),
  quality: confidence,
  strengths: z.unknown(),
  opportunities: z.unknown(),
});

/** Parse a jsonb column into a typed array, dropping entries that don't fit. */
export function parseList<T>(raw: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const parsed = schema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
