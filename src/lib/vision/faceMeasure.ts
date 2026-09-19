/**
 * Facial measurement.
 *
 * This file only MEASURES. It produces no verdict, no score and no ranking —
 * those live in the analysis pipeline, where they can be reasoned about (and
 * constrained) separately. Every number here is an observation with a unit.
 */

import * as L from './landmarks';
import type { Landmark, Point } from './types';
import { angleAt, angleOf, dist, distToLine, extentAlong, mid, rotate, round, roundness } from './geometry';

export interface CaptureGeometry {
  /** Head roll in degrees, after folding into [-90, 90]. */
  readonly roll: number;
  /** Yaw proxy, 0 when square to the camera. */
  readonly yaw: number;
  /** Pitch proxy, ~0 when the head is level. */
  readonly pitch: number;
  readonly hasIris: boolean;
  readonly mmPerUnit: number | null;
  readonly interpupillaryMm: number | null;
}

export interface FaceMeasurements {
  readonly capture: CaptureGeometry;
  /** Absolute millimetres, available only when the iris gave us a scale. */
  readonly mm: {
    readonly faceHeight: number | null;
    readonly bizygomatic: number | null;
    readonly bigonial: number | null;
    readonly alarWidth: number | null;
    readonly mouthWidth: number | null;
    readonly interocular: number | null;
    readonly eyeWidth: number | null;
    readonly asymmetryMean: number | null;
    readonly asymmetryWorst: number | null;
  };
  /** Unitless relationships. */
  readonly ratios: Record<string, number>;
}

/**
 * Put the face in a canonical frame: undo the aspect-ratio squash, then
 * roll-correct by the inter-pupil line so "horizontal" really is horizontal.
 * Without this, tilting your head changes your measurements.
 */
function canonicalise(lm: readonly Landmark[], w: number, h: number) {
  const ar = w / h;
  const pts: Point[] = lm.map((p) => ({ x: p.x * ar, y: p.y }));
  const at = (i: number): Point => pts[i] ?? { x: 0, y: 0 };

  const lc = pts[L.L_IRIS[0]] ?? mid(at(L.L_EYE_IN), at(L.L_EYE_OUT));
  const rc = pts[L.R_IRIS[0]] ?? mid(at(L.R_EYE_IN), at(L.R_EYE_OUT));

  let roll = angleOf(lc, rc);
  if (roll > 90) roll -= 180;
  else if (roll < -90) roll += 180;

  const origin = mid(lc, rc);
  return { pts: pts.map((p) => rotate(p, origin, roll)), roll };
}

/**
 * Millimetres per canonical unit, from the iris.
 *
 * The horizontal iris diameter is ~11.7 mm in adults with very little variation
 * across age, sex or ethnicity, which makes it a physical ruler that happens to
 * be inside every photograph. Without it a "measurement" is just pixels.
 */
function mmScale(pts: readonly Point[]): number | null {
  const l1 = pts[L.L_IRIS[1]];
  const l3 = pts[L.L_IRIS[3]];
  const r1 = pts[L.R_IRIS[1]];
  const r3 = pts[L.R_IRIS[3]];
  if (!l1 || !l3 || !r1 || !r3) return null;
  const d = (dist(l1, l3) + dist(r1, r3)) / 2;
  return d > 1e-6 ? L.IRIS_DIAMETER_MM / d : null;
}

function yawProxy(pts: readonly Point[]): number {
  const lc = pts[L.L_IRIS[0]] ?? pts[L.L_EYE_IN];
  const rc = pts[L.R_IRIS[0]] ?? pts[L.R_EYE_IN];
  const tip = pts[L.NOSE_TIP];
  if (!lc || !rc || !tip) return 0;
  const ipd = dist(lc, rc) || 1e-9;
  return (tip.x - mid(lc, rc).x) / (ipd / 2);
}

/**
 * Where the nose tip sits between the eye line and the chin, minus the value a
 * level head produces. Positive means the camera was below eye level.
 *
 * The baseline is measured, not guessed: 0.2945 is what the shipped
 * FaceLandmarker model returns for a level, square-on face. Calibrate it again
 * if the model version changes — a wrong constant here silently fails every
 * capture on the chin gate.
 */
const LEVEL_PITCH_BASELINE = 0.2945;

function pitchProxy(pts: readonly Point[]): number {
  const li = pts[L.L_EYE_IN];
  const ri = pts[L.R_EYE_IN];
  const tip = pts[L.NOSE_TIP];
  const chin = pts[L.MENTON];
  if (!li || !ri || !tip || !chin) return 0;
  const eye = mid(li, ri);
  const total = chin.y - eye.y || 1e-9;
  return (tip.y - eye.y) / total - LEVEL_PITCH_BASELINE;
}

/**
 * Left/right difference, reported in millimetres of mean deviation.
 *
 * Presented in the product as a *camera-angle* signal, never as a flaw: every
 * human face is asymmetric, and a few degrees of yaw produces more apparent
 * asymmetry than most real anatomy does.
 */
function asymmetry(pts: readonly Point[], mm: number | null) {
  const axis = L.MIDLINE.map((i) => pts[i]).filter((p): p is Point => Boolean(p));
  if (axis.length < 4) return null;

  const n = axis.length;
  const my = axis.reduce((s, p) => s + p.y, 0) / n;
  const mx = axis.reduce((s, p) => s + p.x, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of axis) {
    num += (p.y - my) * (p.x - mx);
    den += (p.y - my) ** 2;
  }
  const a = den ? num / den : 0;
  const A: Point = { x: mx - a * my, y: 0 };
  const B: Point = { x: a + (mx - a * my), y: 1 };

  const devs: number[] = [];
  for (const pair of L.MIRROR_PAIRS) {
    const p = pts[pair[0]];
    const q = pts[pair[1]];
    if (!p || !q) continue;
    devs.push(Math.abs(distToLine(p, A, B) - distToLine(q, A, B)));
  }
  if (devs.length === 0) return null;
  devs.sort((x, y) => x - y);
  const meanDev = devs.reduce((s, v) => s + v, 0) / devs.length;
  return {
    meanMm: mm != null ? meanDev * mm : null,
    worstMm: mm != null ? devs[devs.length - 1]! * mm : null,
  };
}

export function measureFace(lm: readonly Landmark[], w: number, h: number): FaceMeasurements {
  const { pts, roll } = canonicalise(lm, w, h);
  const mm = mmScale(pts);
  const toMm = (v: number): number | null => (mm != null ? round(v * mm, 1) : null);
  const at = (i: number): Point => pts[i] ?? { x: 0, y: 0 };

  const oval = L.FACE_OVAL.map(at);
  const eyeL = pts[L.L_IRIS[0]] ?? mid(at(L.L_EYE_IN), at(L.L_EYE_OUT));
  const eyeR = pts[L.R_IRIS[0]] ?? mid(at(L.R_EYE_IN), at(L.R_EYE_OUT));

  const ipd = dist(eyeL, eyeR);
  const faceH = dist(at(L.TRICHION), at(L.MENTON));
  const bizyg = extentAlong(oval, 1, 0);
  const bigonial = dist(at(L.GONION_R), at(L.GONION_L));
  const alar = dist(at(L.ALA_R), at(L.ALA_L));
  const mouthW = dist(at(L.MOUTH_R), at(L.MOUTH_L));
  const eyeW = (dist(at(L.R_EYE_OUT), at(L.R_EYE_IN)) + dist(at(L.L_EYE_OUT), at(L.L_EYE_IN))) / 2;
  const icd = dist(at(L.R_EYE_IN), at(L.L_EYE_IN));

  /* Vertical thirds. NOTE: FaceMesh has no hairline point — landmark 10 is the
     top of the detected oval, which sits below the true trichion. Anything
     derived from it is reported as approximate and never as a proportion
     "standard". */
  const t1 = at(L.GLABELLA).y - at(L.TRICHION).y;
  const t2 = at(L.SUBNASALE).y - at(L.GLABELLA).y;
  const t3 = at(L.MENTON).y - at(L.SUBNASALE).y;
  const tSum = t1 + t2 + t3 || 1e-9;
  const thirds = [t1 / tSum, t2 / tSum, t3 / tSum] as const;
  const thirdsSpread = Math.max(...thirds.map((v) => Math.abs(v - 1 / 3))) * 3;

  const tiltOf = (outer: Point, inner: Point): number =>
    (Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x)) * 180) / Math.PI;

  const asym = asymmetry(pts, mm);

  return {
    capture: {
      roll: round(roll, 1),
      yaw: round(yawProxy(pts), 3),
      pitch: round(pitchProxy(pts), 3),
      hasIris: mm != null,
      mmPerUnit: mm,
      interpupillaryMm: toMm(ipd),
    },
    mm: {
      faceHeight: toMm(faceH),
      bizygomatic: toMm(bizyg),
      bigonial: toMm(bigonial),
      alarWidth: toMm(alar),
      mouthWidth: toMm(mouthW),
      interocular: toMm(icd),
      eyeWidth: toMm(eyeW),
      asymmetryMean: asym?.meanMm ?? null,
      asymmetryWorst: asym?.worstMm ?? null,
    },
    ratios: {
      thirdsSpread: round(thirdsSpread, 3),
      upperThird: round(thirds[0], 3),
      middleThird: round(thirds[1], 3),
      lowerThird: round(thirds[2], 3),
      widthToHeight: round(bizyg / (faceH || 1e-9), 3),
      cheekToJaw: round(bizyg / (bigonial || 1e-9), 3),
      jawAngle: round(
        (angleAt(at(L.GONION_R), at(L.RAMUS_R), at(L.MENTON)) +
          angleAt(at(L.GONION_L), at(L.RAMUS_L), at(L.MENTON))) / 2,
        1,
      ),
      canthalTilt: round(
        (tiltOf(at(L.R_EYE_OUT), at(L.R_EYE_IN)) + tiltOf(at(L.L_EYE_OUT), at(L.L_EYE_IN))) / 2,
        2,
      ),
      eyeSpacing: round(icd / (eyeW || 1e-9), 3),
      noseToMouth: round(alar / (mouthW || 1e-9), 3),
      mouthToFace: round(mouthW / (bizyg || 1e-9), 3),
      fullness: round(roundness(oval), 3),
      browToEye: round(
        (Math.abs(at(L.R_BROW_PEAK).y - at(L.R_EYE_UP).y) +
          Math.abs(at(L.L_BROW_PEAK).y - at(L.L_EYE_UP).y)) / (2 * (eyeW || 1e-9)),
        3,
      ),
    },
  };
}
