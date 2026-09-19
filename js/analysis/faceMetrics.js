/* Facial measurement engine.
   Input : one frame of MediaPipe Face Landmarker output (478 normalised points)
           + the frame's pixel dimensions (to undo the aspect-ratio squash).
   Output: raw, unit-bearing measurements. Scoring happens elsewhere — this file
           only measures, so the two can be reasoned about (and tested) apart. */

import * as L from './landmarks.js';
import {
  dist, mid, angleOf, angleAt, rotate, distToLine, roundness, extentAlong, round,
} from './geometry.js';

/**
 * Put the face in a canonical frame:
 *  · un-squash normalised coords by the image aspect ratio (so 1 unit = 1 unit),
 *  · roll-correct by the inter-pupil line, so "horizontal" really is horizontal.
 * Every downstream measurement runs on these points.
 */
function canonicalise(lm, w, h) {
  const ar = w / h;
  const pts = lm.map(p => ({ x: p.x * ar, y: p.y, z: p.z ?? 0 }));
  const lc = pts[L.L_IRIS[0]] ?? mid(pts[L.L_EYE_IN], pts[L.L_EYE_OUT]);
  const rc = pts[L.R_IRIS[0]] ?? mid(pts[L.R_EYE_IN], pts[L.R_EYE_OUT]);
  // Angle of the inter-pupil line, folded into [-90, 90] so a mirrored frame
  // (where the eyes swap sides) does not read as a 180° roll.
  let roll = angleOf(lc, rc);
  if (roll > 90) roll -= 180; else if (roll < -90) roll += 180;
  const o = mid(lc, rc);
  // Rotating by +roll brings the eye line back to horizontal (screen coords).
  return { pts: pts.map(p => rotate(p, o, roll)), roll, origin: o };
}

/** Millimetres per canonical unit, from the iris. Returns null if the iris
 *  refinement is unavailable (model loaded without `outputFaceBlendshapes` mesh). */
function mmScale(pts) {
  const li = L.L_IRIS, ri = L.R_IRIS;
  if (!pts[li[4]] || !pts[ri[4]]) return null;
  const dL = dist(pts[li[1]], pts[li[3]]);      // horizontal diameter, left iris
  const dR = dist(pts[ri[1]], pts[ri[3]]);
  const d = (dL + dR) / 2;
  return d > 1e-6 ? L.IRIS_DIAMETER_MM / d : null;
}

/** Head yaw proxy: how far the nose tip sits off the eye-line midpoint,
 *  normalised by half the inter-pupil distance. 0 = square to camera. */
function yawProxy(pts) {
  const lc = pts[L.L_IRIS[0]] ?? pts[L.L_EYE_IN];
  const rc = pts[L.R_IRIS[0]] ?? pts[L.R_EYE_IN];
  const ipd = dist(lc, rc) || 1e-9;
  const centre = mid(lc, rc);
  return (pts[L.NOSE_TIP].x - centre.x) / (ipd / 2);
}

/** Pitch proxy from the vertical placement of the nose tip between the eye line
 *  and the chin. Around 0 when the head is level. */
function pitchProxy(pts) {
  const eye = mid(pts[L.L_EYE_IN], pts[L.R_EYE_IN]);
  const total = pts[L.MENTON].y - eye.y || 1e-9;
  return ((pts[L.NOSE_TIP].y - eye.y) / total) - 0.46;   // 0.46 ≈ level baseline
}

/**
 * Symmetry: fit the midline axis from the midline landmarks, then walk the
 * mirror pairs and measure how unequal their distances to that axis are.
 * Reported in millimetres of mean deviation (not a unitless ratio) so the number
 * means something physical.
 */
function symmetry(pts, mm) {
  const axisPts = L.MIDLINE.map(i => pts[i]).filter(Boolean);
  if (axisPts.length < 4) return null;
  // least-squares vertical line: x = a*y + b (robust for a near-vertical axis)
  const n = axisPts.length;
  const my = axisPts.reduce((s, p) => s + p.y, 0) / n;
  const mx = axisPts.reduce((s, p) => s + p.x, 0) / n;
  let num = 0, den = 0;
  for (const p of axisPts) { num += (p.y - my) * (p.x - mx); den += (p.y - my) ** 2; }
  const a = den ? num / den : 0;
  const A = { x: a * 0 + (mx - a * my), y: 0 };
  const B = { x: a * 1 + (mx - a * my), y: 1 };

  const devs = [];
  for (const [i, j] of L.MIRROR_PAIRS) {
    const p = pts[i], q = pts[j];
    if (!p || !q) continue;
    devs.push(Math.abs(distToLine(p, A, B) - distToLine(q, A, B)));
  }
  if (!devs.length) return null;
  devs.sort((x, y) => x - y);
  const meanDev = devs.reduce((s, v) => s + v, 0) / devs.length;
  const worstDev = devs[devs.length - 1];
  return {
    meanMm: mm ? meanDev * mm : null,
    worstMm: mm ? worstDev * mm : null,
    meanRel: meanDev,                       // canonical units, scale-free fallback
  };
}

/** Mean gonial (jaw) angle across both sides. */
function gonialAngle(pts) {
  const r = angleAt(pts[L.GONION_R], pts[L.RAMUS_R], pts[L.MENTON]);
  const l = angleAt(pts[L.GONION_L], pts[L.RAMUS_L], pts[L.MENTON]);
  return (r + l) / 2;
}

/** Canthal tilt: how much higher the outer corner sits than the inner one.
 *  Positive = upward ("hunter") tilt, negative = downward. Averaged over both
 *  eyes. Measured along each eye's own axis, so it is sign-correct on either
 *  side and immune to a mirrored frame. */
function canthalTilt(pts) {
  const tilt = (outer, inner) =>
    Math.atan2(inner.y - outer.y, Math.abs(outer.x - inner.x)) * 180 / Math.PI;
  return (tilt(pts[L.R_EYE_OUT], pts[L.R_EYE_IN]) +
          tilt(pts[L.L_EYE_OUT], pts[L.L_EYE_IN])) / 2;
}

/**
 * Measure everything. `mm` is millimetres per canonical unit; when the iris is
 * unavailable every mm figure comes back null and only the ratios survive —
 * which is exactly the honest degradation we want.
 */
export function measureFace(landmarks, w, h) {
  const { pts, roll } = canonicalise(landmarks, w, h);
  const mm = mmScale(pts);
  const toMm = (v) => (mm != null ? round(v * mm, 1) : null);

  const oval = L.FACE_OVAL.map(i => pts[i]);
  const eyeL = pts[L.L_IRIS[0]] ?? mid(pts[L.L_EYE_IN], pts[L.L_EYE_OUT]);
  const eyeR = pts[L.R_IRIS[0]] ?? mid(pts[L.R_EYE_IN], pts[L.R_EYE_OUT]);

  /* --- primary lengths (canonical units) --- */
  const ipd        = dist(eyeL, eyeR);
  const faceH      = dist(pts[L.TRICHION], pts[L.MENTON]);
  const bizyg      = extentAlong(oval, 1, 0);                 // widest horizontal extent
  const bigonial   = dist(pts[L.GONION_R], pts[L.GONION_L]);
  const bitemporal = dist(pts[L.ZYG_R], pts[L.ZYG_L]);
  const alar       = dist(pts[L.ALA_R], pts[L.ALA_L]);
  const mouthW     = dist(pts[L.MOUTH_R], pts[L.MOUTH_L]);
  const eyeWR      = dist(pts[L.R_EYE_OUT], pts[L.R_EYE_IN]);
  const eyeWL      = dist(pts[L.L_EYE_OUT], pts[L.L_EYE_IN]);
  const eyeW       = (eyeWR + eyeWL) / 2;
  const icd        = dist(pts[L.R_EYE_IN], pts[L.L_EYE_IN]);  // inner-canthal
  const upperLipH  = dist(pts[L.LIP_UP_TOP], pts[L.LIP_UP_BOT]);
  const lowerLipH  = dist(pts[L.LIP_DN_TOP], pts[L.LIP_DN_BOT]);

  /* --- vertical thirds (trichion approximated, see landmarks.js) --- */
  const t1 = pts[L.GLABELLA].y - pts[L.TRICHION].y;
  const t2 = pts[L.SUBNASALE].y - pts[L.GLABELLA].y;
  const t3 = pts[L.MENTON].y - pts[L.SUBNASALE].y;
  const tSum = t1 + t2 + t3 || 1e-9;
  const thirds = [t1 / tSum, t2 / tSum, t3 / tSum];
  const thirdsDev = Math.max(...thirds.map(v => Math.abs(v - 1 / 3))) * 3;  // 0 = perfect

  /* --- lower-third split: subnasale→stomion vs stomion→menton (target 1:2) --- */
  const lt1 = pts[L.STOMION].y - pts[L.SUBNASALE].y;
  const lt2 = pts[L.MENTON].y - pts[L.STOMION].y;
  const lowerThirdRatio = lt2 > 1e-9 ? lt1 / lt2 : null;

  /* --- vertical fifths: face width should divide into five eye-widths --- */
  const fifthsRatio = eyeW > 1e-9 ? bizyg / (5 * eyeW) : null;

  const sym = symmetry(pts, mm);

  return {
    /* capture quality — the caller gates on these before trusting anything */
    quality: {
      roll: round(roll, 1),
      yaw: round(yawProxy(pts), 3),
      pitch: round(pitchProxy(pts), 3),
      hasIris: mm != null,
      mmPerUnit: mm,
      ipdMm: toMm(ipd),
    },

    /* absolute measurements, millimetres */
    mm: {
      faceHeight: toMm(faceH),
      bizygomatic: toMm(bizyg),
      bigonial: toMm(bigonial),
      alarWidth: toMm(alar),
      mouthWidth: toMm(mouthW),
      interocular: toMm(icd),
      eyeWidth: toMm(eyeW),
      upperLip: toMm(upperLipH),
      lowerLip: toMm(lowerLipH),
      symMeanDev: sym?.meanMm ?? null,
      symWorstDev: sym?.worstMm ?? null,
    },

    /* the scored ratios & angles */
    ratios: {
      thirdsBalance:   round(1 - Math.min(1, thirdsDev), 3),
      thirds:          thirds.map(v => round(v, 3)),
      lowerThirdRatio: lowerThirdRatio != null ? round(lowerThirdRatio, 3) : null,
      fifthsBalance:   fifthsRatio != null ? round(fifthsRatio, 3) : null,
      fwhr:            round(bizyg / (pts[L.LIP_UP_TOP].y - pts[L.NASION].y || 1e-9), 3),
      cheekToJaw:      round(bizyg / (bigonial || 1e-9), 3),
      jawToFace:       round(bigonial / (bizyg || 1e-9), 3),
      midfaceRatio:    round(t2 / (bizyg || 1e-9), 3),
      canthalTilt:     round(canthalTilt(pts), 2),
      gonialAngle:     round(gonialAngle(pts), 1),
      eyeSpacing:      round(icd / (eyeW || 1e-9), 3),
      noseToInterocular: round(alar / (icd || 1e-9), 3),
      noseToMouth:     round(alar / (mouthW || 1e-9), 3),
      mouthToFace:     round(mouthW / (bizyg || 1e-9), 3),
      lipRatio:        round(upperLipH / (lowerLipH || 1e-9), 3),
      facialRoundness: round(roundness(oval), 3),
      faceIndex:       round(faceH / (bizyg || 1e-9), 3),
      symmetryRel:     sym ? round(sym.meanRel / (bizyg || 1e-9), 4) : null,
    },

    /* kept for the annotated overlay */
    _pts: pts,
  };
}
