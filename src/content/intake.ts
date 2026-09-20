/**
 * Intake.
 *
 * Every question here has to change something downstream — a target, a metric
 * the camera cannot see, a protocol that gets filtered in or out, or the order.
 * A test asserts none of them is decorative. Questions about taste were removed
 * deliberately: what someone considers their style does not make a reading more
 * accurate, and it cost a screen of attention to collect.
 */

export type Sex = 'male' | 'female' | 'unspecified';
export type SkinType = 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive';
export type Concern = 'skin' | 'jawline' | 'undereye' | 'hair' | 'definition';

export interface Intake {
  age: number | null;
  sex: Sex | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Fitzpatrick I–VI. Calibrates the redness baseline — a real accuracy fix. */
  skinTone: 1 | 2 | 3 | 4 | 5 | 6 | null;
  skinType: SkinType | null;
  sleepHours: number | null;
  waterLitres: number | null;
  trainingDays: number | null;
  smokes: boolean | null;
  alcohol: 'none' | 'occasional' | 'weekly' | 'frequent' | null;
  sunProtection: 'never' | 'sometimes' | 'daily' | null;
  concerns: Concern[];
}

export const EMPTY_INTAKE: Intake = {
  age: null, sex: null, heightCm: null, weightKg: null,
  skinTone: null, skinType: null, sleepHours: null, waterLitres: null,
  trainingDays: null, smokes: null, alcohol: null, sunProtection: null,
  concerns: [],
};

type Field =
  | { kind: 'number'; id: keyof Intake; label: string; unit: string; min: number; max: number; step?: number; placeholder: string; required?: boolean; why?: string }
  | { kind: 'choice'; id: keyof Intake; label: string; required?: boolean; why?: string; options: { value: unknown; label: string; note?: string }[] }
  | { kind: 'multi'; id: keyof Intake; label: string; max: number; why?: string; options: { value: unknown; label: string }[] };

export interface IntakeStep {
  readonly id: string;
  readonly title: string;
  readonly lede: string;
  /** Can be skipped outright; nothing in it is required to produce a reading. */
  readonly optional?: boolean;
  readonly fields: readonly Field[];
}

export const INTAKE_STEPS: readonly IntakeStep[] = [
  {
    id: 'you',
    title: 'About you',
    lede: 'Four numbers. They decide which reference ranges your reading is measured against.',
    fields: [
      { kind: 'number', id: 'age', label: 'Age', unit: 'years', min: 16, max: 90, placeholder: '28', required: true,
        why: 'Skin texture and tone shift with age. Holding a 45-year-old to a 20-year-old reference measures age, not care.' },
      { kind: 'choice', id: 'sex', label: 'Sex', required: true,
        why: 'Changes which grooming protocols are relevant and the healthy body-composition range used.',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
          { value: 'unspecified', label: 'Prefer not to say' },
        ] },
      { kind: 'number', id: 'heightCm', label: 'Height', unit: 'cm', min: 130, max: 220, placeholder: '178', required: true },
      { kind: 'number', id: 'weightKg', label: 'Weight', unit: 'kg', min: 35, max: 200, placeholder: '76', required: true,
        why: 'With height, this separates facial fullness caused by fluid from fullness caused by body composition. Those two need opposite advice, and a photo cannot tell them apart.' },
    ],
  },
  {
    id: 'skin',
    title: 'Skin and sleep',
    lede: 'Three taps. The first one improves the pixel reading itself, not just the advice.',
    fields: [
      { kind: 'choice', id: 'skinTone', label: 'Skin tone', required: true,
        why: 'Redness is measured against a neutral-skin baseline. One baseline for every tone reads normal skin as inflamed for some people and misses real redness in others.',
        options: [
          { value: 1, label: 'Very fair', note: 'Always burns' },
          { value: 2, label: 'Fair', note: 'Burns easily' },
          { value: 3, label: 'Light–medium', note: 'Sometimes burns' },
          { value: 4, label: 'Olive / medium', note: 'Rarely burns' },
          { value: 5, label: 'Brown', note: 'Very rarely burns' },
          { value: 6, label: 'Deep brown / black', note: 'Almost never burns' },
        ] },
      { kind: 'choice', id: 'sunProtection', label: 'Sun protection', required: true,
        why: 'If tone reads uneven and you use none, that is the highest-evidence change available to you. If you already use it daily, the cause is elsewhere.',
        options: [
          { value: 'never', label: 'Almost never' },
          { value: 'sometimes', label: 'Strong sun only' },
          { value: 'daily', label: 'Every day' },
        ] },
      { kind: 'choice', id: 'sleepHours', label: 'Sleep on a typical night', required: true,
        why: 'The fastest-moving input to under-eye contrast and facial fluid. If yours is short, most of what you see has one cause.',
        options: [
          { value: 4.5, label: 'Under 5 hours' },
          { value: 5.5, label: '5–6' },
          { value: 6.5, label: '6–7' },
          { value: 7.5, label: '7–8' },
          { value: 8.5, label: '8 or more' },
        ] },
    ],
  },
  {
    /* Everything here sharpens the reading, and nothing here blocks it. The
       skip is a single tap, and the results screen offers these again later —
       a long form before anyone has seen value is how intake screens get
       abandoned. */
    id: 'more',
    title: 'Anything else?',
    lede: 'Optional, and skippable in one tap. Each answer makes the plan more specific.',
    optional: true,
    fields: [
      { kind: 'choice', id: 'skinType', label: 'Skin type',
        options: [
          { value: 'dry', label: 'Dry' }, { value: 'oily', label: 'Oily' },
          { value: 'combination', label: 'Combination' }, { value: 'normal', label: 'Normal' },
          { value: 'sensitive', label: 'Sensitive' },
        ] },
      { kind: 'choice', id: 'trainingDays', label: 'Training days per week',
        options: [
          { value: 0, label: 'None' }, { value: 2, label: '1–2' },
          { value: 4, label: '3–4' }, { value: 6, label: '5+' },
        ] },
      { kind: 'choice', id: 'waterLitres', label: 'Water per day',
        options: [
          { value: 0.75, label: 'Under 1L' }, { value: 1.5, label: '1–2L' },
          { value: 2.5, label: '2–3L' }, { value: 3.5, label: 'Over 3L' },
        ] },
      { kind: 'choice', id: 'alcohol', label: 'Alcohol',
        options: [
          { value: 'none', label: 'None' }, { value: 'occasional', label: 'Occasionally' },
          { value: 'weekly', label: 'Weekly' }, { value: 'frequent', label: 'Several times a week' },
        ] },
      { kind: 'choice', id: 'smokes', label: 'Smoke or vape?',
        options: [{ value: false, label: 'No' }, { value: true, label: 'Yes' }] },
      { kind: 'multi', id: 'concerns', label: 'What matters most to you?', max: 3,
        options: [
          { value: 'skin', label: 'Skin' }, { value: 'jawline', label: 'Jaw & neck' },
          { value: 'undereye', label: 'Under-eye' }, { value: 'definition', label: 'Definition' },
          { value: 'hair', label: 'Hair' },
        ] },
    ],
  },
];

export const REQUIRED_FIELDS: readonly (keyof Intake)[] = INTAKE_STEPS
  .flatMap((s) => s.fields)
  .filter((f) => 'required' in f && f.required)
  .map((f) => f.id);

export const isIntakeComplete = (i: Intake): boolean =>
  REQUIRED_FIELDS.every((k) => i[k] !== null && i[k] !== undefined);

export function missingIn(step: IntakeStep, i: Intake): (keyof Intake)[] {
  return step.fields
    .filter((f) => 'required' in f && f.required && (i[f.id] === null || i[f.id] === undefined))
    .map((f) => f.id);
}

/** Body-mass index, used only against the HEALTH range — never as a target. */
export function bmi(i: Intake): number | null {
  if (!i.heightCm || !i.weightKg) return null;
  const m = i.heightCm / 100;
  return Math.round((i.weightKg / (m * m)) * 10) / 10;
}
