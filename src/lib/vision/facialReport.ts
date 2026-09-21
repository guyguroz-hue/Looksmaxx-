/**
 * Deep facial measurement.
 *
 * This is the part a person actually came for: real numbers about their own
 * face, grouped the way a practitioner would walk through them.
 *
 * Two rules hold the whole file together.
 *
 * 1. Every metric declares whether it is BONE or SOFT. Gonial angle, canthal
 *    tilt, philtrum length and bizygomatic width do not change without surgery,
 *    and a product that implies otherwise is selling something. What does move:
 *    facial fullness, submental volume, apparent jaw definition, brow shape,
 *    skin. Saying which is which is the difference between an expert and a
 *    salesperson.
 *
 * 2. A `typical` range is a REFERENCE, never a target. Faces vary enormously
 *    and the published ranges skew heavily toward the populations that were
 *    measured. Sitting outside one is information, not a defect — so nothing
 *    here produces a score, a grade, or a distance-from-ideal.
 */

import * as L from './landmarks';
import type { Landmark, Point } from './types';
import { angleAt, dist, distToLine, extentAlong, mid, rotate, round, roundness } from './geometry';

export type Mutability = 'bone' | 'soft' | 'surface';

export interface FacialMetric {
  readonly id: string;
  readonly group: MetricGroup;
  readonly label: string;
  readonly value: number;
  readonly unit: '°' | 'mm' | 'ratio' | '';
  /** Population reference range. Context, never a target. */
  readonly typical: readonly [number, number] | null;
  readonly mutability: Mutability;
  /** What this measurement means, in one sentence a person can use. */
  readonly reading: string;
  /** Present only when something can actually be done about it. */
  readonly lever?: string;
  readonly approximate?: boolean;
}

export type MetricGroup =
  | 'proportion' | 'jaw' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'forehead' | 'symmetry';

export const GROUP_LABEL: Record<MetricGroup, string> = {
  proportion: 'Proportions',
  jaw: 'Jaw & chin',
  eyes: 'Eyes',
  brows: 'Brows',
  nose: 'Nose',
  mouth: 'Mouth & lips',
  forehead: 'Forehead & hairline',
  symmetry: 'Symmetry',
};

export const MUTABILITY_LABEL: Record<Mutability, string> = {
  bone: 'Structural',
  soft: 'Soft tissue — can shift',
  surface: 'Surface — fully changeable',
};

export interface FaceShape {
  readonly name: 'oval' | 'round' | 'square' | 'oblong' | 'heart' | 'diamond';
  readonly label: string;
  readonly detail: string;
}

export interface FacialReport {
  readonly metrics: readonly FacialMetric[];
  readonly shape: FaceShape | null;
  readonly mmPerUnit: number | null;
}

/* ─────────────────────────── helpers ─────────────────────────── */

function canonical(lm: readonly Landmark[], w: number, h: number) {
  const ar = w / h;
  const pts: Point[] = lm.map((p) => ({ x: p.x * ar, y: p.y }));
  const at = (i: number): Point => pts[i] ?? { x: 0, y: 0 };
  const lc = pts[L.L_IRIS[0]] ?? mid(at(L.L_EYE_IN), at(L.L_EYE_OUT));
  const rc = pts[L.R_IRIS[0]] ?? mid(at(L.R_EYE_IN), at(L.R_EYE_OUT));
  let roll = (Math.atan2(-(lc.y - rc.y), lc.x - rc.x) * 180) / Math.PI;
  if (roll > 90) roll -= 180; else if (roll < -90) roll += 180;
  const o = mid(lc, rc);
  return pts.map((p) => rotate(p, o, roll));
}

function scaleMm(pts: readonly Point[]): number | null {
  const a = pts[L.L_IRIS[1]], b = pts[L.L_IRIS[3]];
  const c = pts[L.R_IRIS[1]], d = pts[L.R_IRIS[3]];
  if (!a || !b || !c || !d) return null;
  const px = (dist(a, b) + dist(c, d)) / 2;
  return px > 1e-6 ? L.IRIS_DIAMETER_MM / px : null;
}

/* ─────────────────────────── the report ─────────────────────────── */

export function buildFacialReport(lm: readonly Landmark[], w: number, h: number): FacialReport {
  const p = canonical(lm, w, h);
  const at = (i: number): Point => p[i] ?? { x: 0, y: 0 };
  const mm = scaleMm(p);
  /* Returns null when the iris could not be measured. A length of "0 mm" is
     not a measurement — it is a missing one wearing a number, and rendering it
     tells the reader something false about their own face. */
  const toMm = (v: number): number | null => (mm != null ? round(v * mm, 1) : null);

  const m: FacialMetric[] = [];
  const push = (x: FacialMetric | (Omit<FacialMetric, 'value'> & { value: number | null })) => {
    if (x.value == null || !Number.isFinite(x.value)) return;
    m.push(x as FacialMetric);
  };

  /* ── core lengths ─────────────────────────────────────────────── */
  const oval = L.FACE_OVAL.map(at);
  const bizyg = extentAlong(oval, 1, 0);
  const bigonial = dist(at(L.GONION_R), at(L.GONION_L));
  const faceH = dist(at(L.TRICHION), at(L.MENTON));
  const eyeW = (dist(at(L.R_EYE_OUT), at(L.R_EYE_IN)) + dist(at(L.L_EYE_OUT), at(L.L_EYE_IN))) / 2;
  const icd = dist(at(L.R_EYE_IN), at(L.L_EYE_IN));
  const alar = dist(at(L.ALA_R), at(L.ALA_L));
  const mouthW = dist(at(L.MOUTH_R), at(L.MOUTH_L));

  /* ── vertical proportions ─────────────────────────────────────── */
  const t1 = at(L.GLABELLA).y - at(L.TRICHION).y;
  const t2 = at(L.SUBNASALE).y - at(L.GLABELLA).y;
  const t3 = at(L.MENTON).y - at(L.SUBNASALE).y;
  const tSum = t1 + t2 + t3 || 1e-9;

  push({
    id: 'thirds.upper', group: 'proportion', label: 'Upper third', value: round((t1 / tSum) * 100, 1),
    unit: '', typical: [30, 36], mutability: 'bone', approximate: true,
    reading: 'Hairline to brow line, as a share of face height. The classical canon divides the face into three equal parts — real faces rarely do, and the deviation is normal rather than meaningful.',
    lever: 'Hair worn forward or back shifts where this line appears to sit, which is why a fringe changes a face so much.',
  });
  push({
    id: 'thirds.middle', group: 'proportion', label: 'Middle third', value: round((t2 / tSum) * 100, 1),
    unit: '', typical: [30, 36], mutability: 'bone',
    reading: 'Brow line to base of nose. Fixed by the midface skeleton.',
  });
  push({
    id: 'thirds.lower', group: 'proportion', label: 'Lower third', value: round((t3 / tSum) * 100, 1),
    unit: '', typical: [30, 38], mutability: 'bone',
    reading: 'Base of nose to chin. A longer lower third reads more angular; a shorter one reads softer and younger.',
  });

  const stom = at(L.STOMION);
  const upperLower = (stom.y - at(L.SUBNASALE).y) / ((at(L.MENTON).y - stom.y) || 1e-9);
  push({
    id: 'lowerThird.split', group: 'proportion', label: 'Lower-third split', value: round(upperLower, 2),
    unit: 'ratio', typical: [0.45, 0.55], mutability: 'bone',
    reading: 'Nose-to-mouth against mouth-to-chin. Around 1:2 is the conventional reference; a larger value means a longer upper lip relative to the chin.',
  });

  push({
    id: 'fifths', group: 'proportion', label: 'Face width in eye-widths', value: round(bizyg / (eyeW || 1e-9), 2),
    unit: '', typical: [4.6, 5.4], mutability: 'bone',
    reading: 'The classical "fifths" canon expects five eye-widths across the face. Above five reads wide-set or broad; below reads narrow.',
  });

  const fwhr = bizyg / ((at(L.LIP_UP_TOP).y - at(L.NASION).y) || 1e-9);
  push({
    id: 'fwhr', group: 'proportion', label: 'Facial width-to-height (fWHR)', value: round(fwhr, 2),
    unit: 'ratio', typical: [1.7, 2.1], mutability: 'soft',
    reading: 'Cheekbone width against upper-face height. Heavily studied in social psychology, though the effect sizes are smaller than the coverage suggests.',
    lever: 'Partly soft tissue — facial fullness moves this without any change to the skeleton.',
  });

  const faceIndex = faceH / (bizyg || 1e-9);
  push({
    id: 'faceIndex', group: 'proportion', label: 'Height-to-width index', value: round(faceIndex, 2),
    unit: 'ratio', typical: [1.3, 1.5], mutability: 'bone',
    reading: 'The single number that most determines which hair shapes and frame styles suit you.',
    lever: 'Not changeable — but it is the number to design a haircut around.',
  });

  /* ── jaw & chin ───────────────────────────────────────────────── */
  const gonial = (angleAt(at(L.GONION_R), at(L.RAMUS_R), at(L.MENTON)) +
                  angleAt(at(L.GONION_L), at(L.RAMUS_L), at(L.MENTON))) / 2;
  push({
    id: 'gonialAngle', group: 'jaw', label: 'Gonial angle', value: round(gonial, 1),
    unit: '°', typical: [115, 132], mutability: 'bone',
    reading: 'The corner of the jaw. A more closed angle reads sharper; a more open one reads softer. This is mandible shape and does not change.',
  });
  push({
    id: 'cheekToJaw', group: 'jaw', label: 'Cheekbone-to-jaw ratio', value: round(bizyg / (bigonial || 1e-9), 2),
    unit: 'ratio', typical: [1.15, 1.35], mutability: 'soft',
    reading: 'How much wider the cheekbones sit than the jaw. Higher reads tapered and triangular; near 1.0 reads square.',
    lever: 'Submental and jowl fat sit exactly here, so body composition moves the visible version of this number even though the bone underneath does not.',
  });
  push({
    id: 'bigonial', group: 'jaw', label: 'Jaw width', value: toMm(bigonial),
    unit: 'mm', typical: null, mutability: 'bone',
    reading: 'Measured between the jaw corners. Given in millimetres because the iris in your photo provides a physical ruler.',
  });
  push({
    id: 'bizygomatic', group: 'jaw', label: 'Cheekbone width', value: toMm(bizyg),
    unit: 'mm', typical: null, mutability: 'bone',
    reading: 'The widest point across your face. This is the number to take to an optician — frames near it sit level and stay put.',
    lever: 'Use it when buying glasses: total frame width within a few millimetres of this.',
  });

  const chinH = at(L.MENTON).y - at(L.LIP_DN_BOT).y;
  push({
    id: 'chinHeight', group: 'jaw', label: 'Chin height', value: round((chinH / (t3 || 1e-9)) * 100, 1),
    unit: '', typical: [33, 45], mutability: 'bone',
    reading: 'Lower lip to chin tip, as a share of the lower third. Drives how much the chin projects visually.',
  });

  push({
    id: 'fullness', group: 'jaw', label: 'Facial fullness', value: round(roundness(oval) * 100, 1),
    unit: '', typical: [62, 75], mutability: 'soft',
    reading: 'How round the outline of your face reads. This is the metric that moves most with body composition and overnight fluid — and the one most often mistaken for bone structure.',
    lever: 'Evening salt, alcohol, sleep and body composition all land here. It is the highest-yield number on this page.',
  });

  /* ── eyes ─────────────────────────────────────────────────────── */
  const tilt = (o: Point, i: Point) => (Math.atan2(i.y - o.y, Math.abs(o.x - i.x)) * 180) / Math.PI;
  push({
    id: 'canthalTilt', group: 'eyes', label: 'Canthal tilt',
    value: round((tilt(at(L.R_EYE_OUT), at(L.R_EYE_IN)) + tilt(at(L.L_EYE_OUT), at(L.L_EYE_IN))) / 2, 1),
    unit: '°', typical: [0, 8], mutability: 'bone',
    reading: 'How much higher the outer corner sits than the inner. Positive reads alert; neutral or negative reads calmer. Orbital bone — it does not change.',
    lever: 'Brow shaping and the direction of any eye makeup change the perceived angle without touching the real one.',
  });
  push({
    id: 'eyeSpacing', group: 'eyes', label: 'Eye spacing', value: round(icd / (eyeW || 1e-9), 2),
    unit: 'ratio', typical: [0.9, 1.1], mutability: 'bone',
    reading: 'Gap between the eyes divided by eye width. The classical reference is exactly one eye-width; above reads wide-set, below reads close-set.',
  });
  const eyeOpen = (dist(at(L.R_EYE_UP), at(L.R_EYE_DN)) + dist(at(L.L_EYE_UP), at(L.L_EYE_DN))) / 2;
  push({
    id: 'eyeAspect', group: 'eyes', label: 'Eye openness', value: round(eyeOpen / (eyeW || 1e-9), 2),
    unit: 'ratio', typical: [0.28, 0.4], mutability: 'soft',
    reading: 'Eye height against eye width. Lower reads narrow or hooded; higher reads open.',
    lever: 'Sleep and fluid retention visibly change this on any given morning, which is why the same face photographs differently day to day.',
  });
  push({
    id: 'ipd', group: 'eyes', label: 'Pupil distance', value: toMm(dist(at(L.L_IRIS[0]), at(L.R_IRIS[0]))),
    unit: 'mm', typical: [54, 72], mutability: 'bone',
    reading: 'Your interpupillary distance in millimetres — the same measurement an optician takes for lens centring.',
  });

  /* ── brows ────────────────────────────────────────────────────── */
  const browGap = (Math.abs(at(L.R_BROW_PEAK).y - at(L.R_EYE_UP).y) +
                   Math.abs(at(L.L_BROW_PEAK).y - at(L.L_EYE_UP).y)) / 2;
  push({
    id: 'browHeight', group: 'brows', label: 'Brow-to-eye distance', value: round(browGap / (eyeW || 1e-9), 2),
    unit: 'ratio', typical: [0.35, 0.6], mutability: 'surface',
    reading: 'How much open space sits between brow and lash line. More space reads relaxed and open; less reads intense and deep-set.',
    lever: 'One of the few genuinely changeable numbers here. Where you take the lower edge of the brow moves it directly.',
  });
  const browTilt = (tilt(at(L.R_BROW_IN), at(L.R_BROW_PEAK)) + tilt(at(L.L_BROW_IN), at(L.L_BROW_PEAK))) / 2;
  push({
    id: 'browTilt', group: 'brows', label: 'Brow angle', value: round(browTilt, 1),
    unit: '°', typical: [3, 15], mutability: 'surface',
    reading: 'The rise from the inner end of the brow to its peak. A flatter brow reads calm and masculine; a higher arch reads more open.',
    lever: 'Fully changeable by grooming. Go gradually — the lower edge is much easier to take than to put back.',
  });

  /* ── nose ─────────────────────────────────────────────────────── */
  push({
    id: 'noseWidth', group: 'nose', label: 'Nose width vs eye spacing', value: round(alar / (icd || 1e-9), 2),
    unit: 'ratio', typical: [0.9, 1.15], mutability: 'bone',
    reading: 'The classical reference puts the nose the same width as the gap between the eyes.',
  });
  push({
    id: 'noseToMouth', group: 'nose', label: 'Nose width vs mouth', value: round(alar / (mouthW || 1e-9), 2),
    unit: 'ratio', typical: [0.6, 0.78], mutability: 'bone',
    reading: 'Nose base against mouth width. Around 0.7 is the usual reference point.',
  });
  push({
    id: 'noseLength', group: 'nose', label: 'Nose length', value: round((t2 / (faceH || 1e-9)) * 100, 1),
    unit: '', typical: [30, 38], mutability: 'bone',
    reading: 'Brow to nose base, as a share of face height.',
  });

  /* ── mouth & lips ─────────────────────────────────────────────── */
  push({
    id: 'mouthWidth', group: 'mouth', label: 'Mouth width vs face', value: round(mouthW / (bizyg || 1e-9), 2),
    unit: 'ratio', typical: [0.42, 0.52], mutability: 'bone',
    reading: 'Mouth width against cheekbone width. Wider reads more expressive.',
  });
  const upperLip = dist(at(L.LIP_UP_TOP), at(L.LIP_UP_BOT));
  const lowerLip = dist(at(L.LIP_DN_TOP), at(L.LIP_DN_BOT));
  push({
    id: 'lipRatio', group: 'mouth', label: 'Upper-to-lower lip', value: round(upperLip / (lowerLip || 1e-9), 2),
    unit: 'ratio', typical: [0.5, 0.8], mutability: 'soft',
    reading: 'The lower lip is normally the fuller of the two — around 1:1.6 is the common reference.',
    lever: 'Hydration and lip care change the visible fullness of both. Chronic licking and dryness flatten them.',
  });
  const philtrum = at(L.LIP_UP_TOP).y - at(L.SUBNASALE).y;
  push({
    id: 'philtrum', group: 'mouth', label: 'Philtrum length', value: toMm(philtrum),
    unit: 'mm', typical: [11, 19], mutability: 'bone',
    reading: 'Nose base to the top of the upper lip. A shorter philtrum reads younger; it lengthens gradually over decades.',
  });

  /* ── forehead ─────────────────────────────────────────────────── */
  push({
    id: 'foreheadHeight', group: 'forehead', label: 'Forehead height', value: toMm(t1),
    unit: 'mm', typical: null, mutability: 'surface', approximate: true,
    reading: 'Measured to the top of the detected face rather than the true hairline, which the model cannot see — so treat this as an estimate.',
    lever: 'The most style-responsive area of the whole face. Where you place the hairline visually is a haircut decision.',
  });

  /* ── symmetry, per feature ────────────────────────────────────── */
  const axisPts = L.MIDLINE.map((i) => p[i]).filter((x): x is Point => Boolean(x));
  if (axisPts.length >= 4 && mm != null) {
    const n = axisPts.length;
    const my = axisPts.reduce((s, q) => s + q.y, 0) / n;
    const mx = axisPts.reduce((s, q) => s + q.x, 0) / n;
    let num = 0, den = 0;
    for (const q of axisPts) { num += (q.y - my) * (q.x - mx); den += (q.y - my) ** 2; }
    const a = den ? num / den : 0;
    const A: Point = { x: mx - a * my, y: 0 };
    const B: Point = { x: a + (mx - a * my), y: 1 };

    const groups: [string, string, readonly (readonly [number, number])[]][] = [
      ['symmetry.eyes', 'Eye symmetry', [[33, 263], [133, 362], [159, 386], [145, 374]]],
      ['symmetry.brows', 'Brow symmetry', [[105, 334], [107, 336], [70, 300], [63, 293]]],
      ['symmetry.jaw', 'Jaw symmetry', [[172, 397], [58, 288], [136, 365], [150, 379]]],
      ['symmetry.mouth', 'Mouth symmetry', [[61, 291], [40, 270], [91, 321]]],
    ];
    for (const [id, label, pairs] of groups) {
      const devs = pairs
        .map(([i, j]) => {
          const x = p[i], y = p[j];
          return x && y ? Math.abs(distToLine(x, A, B) - distToLine(y, A, B)) : null;
        })
        .filter((v): v is number => v != null);
      if (devs.length === 0) continue;
      push({
        id, group: 'symmetry', label,
        value: round((devs.reduce((s, v) => s + v, 0) / devs.length) * mm, 1),
        unit: 'mm', typical: [0, 3], mutability: 'soft',
        reading: 'Average left-right difference. Every face is asymmetric; under about 3 mm is below what anyone perceives.',
        lever: 'A turned head produces more apparent asymmetry than most real anatomy, so re-shoot square-on before reading much into it.',
      });
    }
  }

  return { metrics: m, shape: classifyShape(faceIndex, bizyg / (bigonial || 1e-9), roundness(oval)), mmPerUnit: mm };
}

/** Face shape, the way a barber or optician uses the term. */
function classifyShape(index: number, cheekToJaw: number, round_: number): FaceShape | null {
  if (!Number.isFinite(index)) return null;
  if (index >= 1.5) {
    return { name: 'oblong', label: 'Long',
      detail: 'Notably taller than wide. Width at the temples balances it; extra height on top extends the line further.' };
  }
  if (index <= 1.25) {
    if (cheekToJaw < 1.12) {
      return { name: 'square', label: 'Square',
        detail: 'Jaw and cheekbones carry similar width, with a strong horizontal line. Softer, textured hair shapes contrast it well.' };
    }
    return { name: 'round', label: 'Round',
      detail: 'Width and height are close, with a soft outline. Height on top and shorter sides lengthen the read.' };
  }
  if (cheekToJaw >= 1.32) {
    return { name: 'heart', label: 'Heart / tapered',
      detail: 'Wide through the cheekbones, narrowing to the chin. Weight kept lower and fuller balances the taper.' };
  }
  if (round_ < 0.66) {
    return { name: 'diamond', label: 'Diamond',
      detail: 'Widest at the cheekbones with a narrower forehead and jaw. Fringes and width at the temples balance it.' };
  }
  return { name: 'oval', label: 'Oval',
    detail: 'Balanced height to width with an even taper. The most forgiving shape for hair and frames — most styles will work.' };
}
