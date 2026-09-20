/**
 * The protocol library.
 *
 * What changed from the first version: photography and clothing advice is gone.
 * Camera guidance still exists, but as a capture-time gate — not as something
 * the product calls an improvement. What a person came here for is what they
 * can do to themselves, not to their photographs.
 *
 * The line this file holds: cosmetic, over-the-counter and nutritional only.
 * No prescription medicine, no named condition, no restrictive eating, no
 * weight target. Where something could warrant a professional, it says so once
 * and says nothing more.
 *
 * `evidence` is honest rather than flattering:
 *   A — randomised trials or clinical guidelines
 *   B — controlled or cohort studies
 *   C — small studies, mechanism, or practitioner consensus
 */

import type { Category, Confidence, Effort, Impact } from '@/lib/analysis/types';

export type Evidence = 'A' | 'B' | 'C';

export interface Protocol {
  readonly id: string;
  readonly category: Category;
  readonly title: string;
  /** Why it is being suggested to this person specifically. */
  readonly why: string;
  readonly how: readonly string[];
  readonly evidence: Evidence;
  /** Realistic weeks to a visible change. Understating this loses trust once. */
  readonly weeks: readonly [number, number];
  readonly impact: Impact;
  readonly effort: Effort;
  readonly confidence: Confidence;
  readonly horizon: 'now' | 'week' | 'month' | 'optional';
  readonly requiresProfessional?: boolean;
  /** Shown as a plain caution, never hidden behind a disclosure. */
  readonly caution?: string;
}

/* ═════════════════════════════ skin ═════════════════════════════ */

export const SKIN: readonly Protocol[] = [
  {
    id: 'skin.spf',
    category: 'skin',
    title: 'Broad-spectrum SPF every morning',
    why: 'This is the strongest-evidence item in the entire product. A controlled trial following daily users against occasional users measured about a quarter less visible skin ageing over four and a half years.',
    how: [
      'SPF 30 or higher, broad spectrum, every morning — indoors and in winter too.',
      'Two fingers’ length for face and neck. Most people apply under half of what is tested.',
      'Reapply every two hours in direct sun.',
      'A mineral filter (zinc oxide) sits better on reactive skin.',
    ],
    evidence: 'A',
    weeks: [4, 24],
    impact: 'high', effort: 'easy', confidence: 'high', horizon: 'now',
  },
  {
    id: 'skin.moisturise',
    category: 'skin',
    title: 'Moisturise on damp skin, twice daily',
    why: 'A skin barrier holding water reflects light evenly, which is most of what reads as "good skin" in a photograph. It is also the difference between actives working and actives irritating.',
    how: [
      'Apply within a minute of washing, while the skin is still damp.',
      'Look for ceramides, glycerin or hyaluronic acid on the label.',
      'Oily skin needs this too — a light gel, not nothing.',
      'Do not skip the neck.',
    ],
    evidence: 'A',
    weeks: [1, 6],
    impact: 'high', effort: 'easy', confidence: 'high', horizon: 'now',
  },
  {
    id: 'skin.cleanse',
    category: 'skin',
    title: 'Gentle cleanser, morning and night',
    why: 'Over-washing strips the barrier and produces exactly the roughness it was meant to fix. A pH-balanced, fragrance-free cleanser is enough for almost everyone.',
    how: [
      'Lukewarm water. Hot water strips oils.',
      'Thirty seconds with fingertips — no brushes or scrubs.',
      'Pat dry, never rub.',
      'If your skin feels tight afterwards, the cleanser is too strong.',
    ],
    evidence: 'A',
    weeks: [2, 8],
    impact: 'medium', effort: 'easy', confidence: 'high', horizon: 'now',
  },
  {
    id: 'skin.retinol',
    category: 'skin',
    title: 'Over-the-counter retinol at night',
    why: 'The best-supported topical for texture and fine lines. It works by accelerating cell turnover, which is also why it must be introduced slowly — most people who abandon it started too fast.',
    how: [
      'Start at a low strength, twice a week only.',
      'After a month, move to alternate nights. Only then consider nightly.',
      'Sandwich it: moisturiser, then retinol, then moisturiser again.',
      'SPF the next morning is not optional — it raises sun sensitivity.',
      'Stop if irritation persists rather than pushing through it.',
    ],
    evidence: 'A',
    weeks: [12, 26],
    impact: 'high', effort: 'moderate', confidence: 'high', horizon: 'month',
    caution: 'Not for use in pregnancy. Introduce slowly; expect some dryness at first.',
  },
  {
    id: 'skin.niacinamide',
    category: 'skin',
    title: 'Niacinamide for redness and oil',
    why: 'A well-tolerated vitamin B3 derivative that reduces visible redness and supports the barrier. Unusually for an active, it plays well with everything else.',
    how: [
      'Four to five percent is the useful range — higher is not better and can sting.',
      'Apply after cleansing, before moisturiser.',
      'Safe to use morning and night alongside SPF.',
    ],
    evidence: 'B',
    weeks: [4, 12],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'week',
  },
  {
    id: 'skin.vitc',
    category: 'skin',
    title: 'Vitamin C in the morning',
    why: 'An antioxidant that complements sun protection and supports collagen synthesis. The evidence for evening out tone is stronger than the evidence for lines.',
    how: [
      'Apply to clean skin before moisturiser and SPF.',
      'Store it away from light and heat — it oxidises.',
      'Replace it once it turns amber; it has stopped working.',
    ],
    evidence: 'B',
    weeks: [8, 16],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'month',
  },
  {
    id: 'skin.calm',
    category: 'skin',
    title: 'Strip the routine back for two weeks',
    why: 'Persistent redness is more often a barrier that has been over-worked than a problem needing another product. Doing less for a fortnight changes more than adding anything.',
    how: [
      'Stop all acids, scrubs and cleansing brushes for fourteen days.',
      'Keep only: gentle cleanser, moisturiser, SPF.',
      'Avoid very hot water and long steamy showers.',
      'Reintroduce one active at a time, two weeks apart.',
    ],
    evidence: 'B',
    weeks: [2, 8],
    impact: 'high', effort: 'easy', confidence: 'medium', horizon: 'now',
  },
];

/* ═══════════════════════ facial exercise ═══════════════════════ */

export const FACIAL: readonly Protocol[] = [
  {
    id: 'facial.exercise',
    category: 'presentation',
    title: 'Daily facial muscle work',
    why: 'A systematic review found every included study reported some improvement in facial appearance — but all were small, none were well controlled, and the overall evidence is weak. It is free and safe, so it is worth trying with honest expectations rather than high ones.',
    how: [
      'Ten to fifteen minutes a day, five days a week.',
      'Isometric holds for the cheeks and jaw: contract, hold five seconds, release.',
      'Work slowly. Speed does nothing here and can deepen expression lines.',
      'Give it eight weeks before judging it.',
    ],
    evidence: 'C',
    weeks: [8, 20],
    impact: 'low', effort: 'moderate', confidence: 'low', horizon: 'month',
    caution: 'Evidence is genuinely limited. Treat any change as a bonus rather than the plan.',
  },
  {
    id: 'facial.lymphatic',
    category: 'presentation',
    title: 'Morning lymphatic massage',
    why: 'Overnight fluid settles in the face and is at its most visible on waking. A few minutes of light drainage shifts it faster than waiting does — a temporary effect, but a real and same-morning one.',
    how: [
      'Light pressure only — this moves fluid just under the skin, not muscle.',
      'Work from the centre of the face outward, then down the sides of the neck.',
      'Two to three minutes on clean skin with a little moisturiser for slip.',
      'A chilled spoon or roller under the eyes helps the same mechanism.',
    ],
    evidence: 'C',
    weeks: [0, 1],
    impact: 'medium', effort: 'easy', confidence: 'low', horizon: 'now',
  },
  {
    id: 'facial.posture',
    category: 'presentation',
    title: 'Unwind forward head position',
    why: 'A head carried forward shortens the visible line between chin and neck, which reads as less definition regardless of what is underneath. It is the only item here that changes the jawline the same day.',
    how: [
      'Chin tucks: draw the chin straight back, hold five seconds, ten times, three times a day.',
      'Doorway chest stretch, thirty seconds, twice daily.',
      'Raise your screen so its top edge is at eye level.',
      'Stand up every forty-five minutes.',
      'If you have ongoing neck pain or numbness, a qualified professional should assess it rather than an app.',
    ],
    evidence: 'A',
    weeks: [3, 12],
    impact: 'high', effort: 'easy', confidence: 'medium', horizon: 'week',
    requiresProfessional: true,
  },
];

/* ═══════════════════════════ nutrition ═══════════════════════════ */

export const NUTRITION: readonly Protocol[] = [
  {
    id: 'nutrition.protein',
    category: 'routine',
    title: 'Protein at every meal',
    why: 'Skin, hair and nails are built from it. Low intake shows up as thinning hair and slower healing long before anything else.',
    how: [
      'Aim for a palm-sized portion at each main meal.',
      'Spread it across the day rather than loading one meal.',
      'Eggs, fish, dairy, legumes and tofu all count.',
    ],
    evidence: 'A',
    weeks: [8, 20],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'week',
  },
  {
    id: 'nutrition.omega3',
    category: 'routine',
    title: 'Oily fish twice a week',
    why: 'Omega-3 fats are structural components of the skin barrier. The effect is slow and unglamorous, and it compounds.',
    how: [
      'Salmon, sardines or mackerel, twice a week.',
      'A supplement is a reasonable substitute if you do not eat fish.',
      'Walnuts and flaxseed contribute, less efficiently.',
    ],
    evidence: 'B',
    weeks: [8, 24],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'month',
  },
  {
    id: 'nutrition.sodium',
    category: 'routine',
    title: 'Ease off salt in the evening',
    why: 'A salty dinner shows up as facial and eyelid fluid the next morning and softens the jaw line. It reverses within a day or two, which makes it the quickest change in this list.',
    how: [
      'Cut processed and heavily salted food at the evening meal specifically.',
      'Add potassium: leafy greens, avocado, banana.',
      'Skip instant soups, cured meat and bottled sauces at night.',
    ],
    evidence: 'B',
    weeks: [0, 1],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'now',
  },
  {
    id: 'nutrition.water',
    category: 'routine',
    title: 'Water across the day',
    why: 'Mild dehydration deepens the hollow under the eyes and flattens how skin reflects light. Steady intake beats a large amount at once.',
    how: [
      'Spread it through the day rather than drinking it all at once.',
      'Pale straw-coloured urine is the practical marker.',
      'Increase on training days and in heat.',
    ],
    evidence: 'B',
    weeks: [0, 2],
    impact: 'medium', effort: 'easy', confidence: 'medium', horizon: 'now',
  },
  {
    id: 'nutrition.alcohol',
    category: 'routine',
    title: 'Fewer drinking days',
    why: 'Alcohol widens facial blood vessels, holds fluid and fragments sleep even when it makes falling asleep easier. All three land on the same measurements this app reads.',
    how: [
      'Set specific alcohol-free days rather than a vague reduction.',
      'A glass of water between drinks.',
      'Nothing in the three hours before bed.',
    ],
    evidence: 'B',
    weeks: [1, 6],
    impact: 'medium', effort: 'moderate', confidence: 'medium', horizon: 'week',
  },
  {
    id: 'nutrition.smoking',
    category: 'routine',
    title: 'Stopping smoking',
    why: 'Smoking narrows the vessels feeding the skin and accelerates the breakdown of its structural proteins. It works directly against every other item in this plan.',
    how: [
      'Your doctor or pharmacist can set you up with what actually works.',
      'Skin blood flow begins improving within weeks of stopping.',
    ],
    evidence: 'A',
    weeks: [4, 52],
    impact: 'high', effort: 'involved', confidence: 'high', horizon: 'month',
    requiresProfessional: true,
  },
];

/* ═════════════════════════════ sleep ═════════════════════════════ */

export const SLEEP: readonly Protocol[] = [
  {
    id: 'sleep.duration',
    category: 'routine',
    title: 'Seven to nine hours, at a consistent time',
    why: 'In a controlled experiment, the same people were rated as looking less healthy and more tired after one short night than after a full one. Nothing else in this product moves the face faster.',
    how: [
      'A fixed wake time matters more than a fixed bedtime.',
      'Cool and dark: 18–20°C, blackout if you can.',
      'No caffeine within eight hours of sleeping.',
      'Screens down for the last hour.',
    ],
    evidence: 'A',
    weeks: [0, 2],
    impact: 'high', effort: 'moderate', confidence: 'high', horizon: 'now',
  },
  {
    id: 'sleep.position',
    category: 'routine',
    title: 'Sleep on your back',
    why: 'Sustained one-sided pressure through the night is associated with compression lines and morning asymmetry. The evidence is thin, but the cost of trying is nothing.',
    how: [
      'A pillow under the knees makes back-sleeping easier to hold.',
      'A silk pillowcase reduces friction if you stay a side-sleeper.',
      'If you do sleep on one side, alternate.',
    ],
    evidence: 'C',
    weeks: [8, 24],
    impact: 'low', effort: 'moderate', confidence: 'low', horizon: 'optional',
  },
];

/* ═══════════════════════ grooming & hair ═══════════════════════ */

export const GROOMING: readonly Protocol[] = [
  {
    id: 'grooming.jawline',
    category: 'grooming',
    title: 'Set a clean neckline',
    why: 'A defined lower edge creates a visible boundary where the face currently fades into the neck. The evidence here is practitioner consensus rather than trials, but it is same-day, reversible and costs nothing to test on yourself.',
    how: [
      'Set the neckline just above the Adam’s apple — not under the chin.',
      'Keep the sides shorter than the chin to lengthen rather than widen.',
      'Re-trim every three to five days; a grown-out edge undoes it.',
    ],
    evidence: 'C',
    weeks: [0, 2],
    impact: 'high', effort: 'easy', confidence: 'medium', horizon: 'now',
  },
  {
    id: 'grooming.brows',
    category: 'grooming',
    title: 'Tidy the brow line',
    why: 'Brows are the top edge of the frame around the eyes, and their shape carries more of the upper face than their size suggests. This is styling consensus rather than trial evidence — but it is reversible within weeks, which makes it cheap to test.',
    how: [
      'Follow the shape you have rather than creating a new one.',
      'A clear gel keeps direction consistent and takes ten seconds.',
      'One professional shape teaches you the line; maintain it yourself after.',
    ],
    evidence: 'C',
    weeks: [0, 2],
    impact: 'medium', effort: 'easy', confidence: 'low', horizon: 'week',
  },
  {
    id: 'hair.framing',
    category: 'hair',
    title: 'Cut for your proportions',
    why: 'Hair changes the perceived height and width of a face more than anything else short of surgery, and it grows back — which makes it the lowest-risk experiment in the plan.',
    how: [
      'Broader proportions: height on top, shorter at the sides.',
      'Longer proportions: keep width at the temples, avoid extra height.',
      'Bring photographs to the appointment. Descriptions do not survive translation.',
      'Maintain every four to six weeks.',
    ],
    evidence: 'C',
    weeks: [0, 4],
    impact: 'high', effort: 'moderate', confidence: 'medium', horizon: 'month',
  },
  {
    id: 'hair.scalp',
    category: 'hair',
    title: 'Look after the scalp, not just the hair',
    why: 'Hair grows out of skin, and that skin responds to the same basics as the rest. The evidence here is limited to mechanism rather than trials, but the steps are free and carry no downside.',
    how: [
      'Wash to the scalp rather than only the lengths.',
      'A few minutes of massage while washing.',
      'Avoid very hot water and aggressive towel-drying.',
      'Persistent flaking, itching or a change in density is worth showing to a qualified professional — that is outside what a photograph can tell you.',
    ],
    evidence: 'C',
    weeks: [4, 12],
    impact: 'low', effort: 'easy', confidence: 'low', horizon: 'optional',
    requiresProfessional: true,
  },
];

/* ═══════════════════════ body composition ═══════════════════════ */

export const BODY: readonly Protocol[] = [
  {
    id: 'body.composition',
    category: 'routine',
    title: 'Steady training and enough protein',
    why: 'Facial fullness tracks body composition, which is why this appears in a face-focused plan at all. Gradual is the whole point: fast changes cost muscle and show in the skin.',
    how: [
      'Two or more strength sessions a week, progressing the load.',
      'Around 150 minutes of moderate activity across the week.',
      'Keep protein high enough to hold muscle.',
      'Judge by how clothes fit and how training feels, not by daily weighing.',
    ],
    evidence: 'A',
    weeks: [8, 24],
    impact: 'high', effort: 'involved', confidence: 'medium', horizon: 'month',
    caution: 'This is about habits, not a target number. Crash approaches work against the skin and hair you are trying to improve, and cost muscle on the way.',
  },
];

export const ALL_PROTOCOLS: readonly Protocol[] = [
  ...SKIN, ...FACIAL, ...NUTRITION, ...SLEEP, ...GROOMING, ...BODY,
];

export const PROTOCOL_BY_ID: ReadonlyMap<string, Protocol> = new Map(
  ALL_PROTOCOLS.map((p) => [p.id, p]),
);

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  A: 'Strong evidence',
  B: 'Moderate evidence',
  C: 'Limited evidence',
};
