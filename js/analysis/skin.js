/* Pixel-level skin readouts, sampled from the captured frame.
   These are the metrics that move fastest in real life (sleep, hydration,
   sun protection), which makes them the most motivating ones to track. */

import * as L from './landmarks.js';
import { round } from './geometry.js';

/* ---- colour space ---- */
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

/** sRGB 0..255 → CIE-Lab (D65). */
export function rgbToLab(r, g, b) {
  const R = srgbToLin(r / 255), G = srgbToLin(g / 255), B = srgbToLin(b / 255);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Average Lab over a square patch, discarding the brightest and darkest decile
 * so a stray specular highlight or an eyelash does not drag the mean.
 */
function samplePatch(data, w, h, cx, cy, r) {
  const px = [];
  const x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(w - 1, (cx + r) | 0);
  const y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(h - 1, (cy + r) | 0);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      px.push(rgbToLab(data[i], data[i + 1], data[i + 2]));
    }
  }
  if (px.length < 12) return null;
  px.sort((p, q) => p.L - q.L);
  const cut = Math.floor(px.length * 0.1);
  const core = px.slice(cut, px.length - cut || px.length);
  const n = core.length;
  const mean = core.reduce((s, p) => ({ L: s.L + p.L, a: s.a + p.a, b: s.b + p.b }), { L: 0, a: 0, b: 0 });
  mean.L /= n; mean.a /= n; mean.b /= n;
  const sd = Math.sqrt(core.reduce((s, p) => s + (p.L - mean.L) ** 2, 0) / n);
  return { ...mean, sd, n };
}

/* Neutral-skin a* baselines by Fitzpatrick type, and how much to trust the
 * reading. Erythema is genuinely harder to detect through melanin in the
 * visible spectrum — the honest response is to widen the baseline AND lower
 * confidence for the darkest types, not to pretend one threshold fits everyone.
 * A single hard-coded baseline (which is what this used to be) reads normal
 * skin as inflamed for some people and misses real redness in others. */
const TONE = {
  1: { aBase: 11.0, confidence: 1.00 },
  2: { aBase: 12.0, confidence: 1.00 },
  3: { aBase: 13.0, confidence: 0.95 },
  4: { aBase: 13.5, confidence: 0.85 },
  5: { aBase: 13.0, confidence: 0.70 },
  6: { aBase: 12.0, confidence: 0.55 },
};
const DEFAULT_TONE = { aBase: 12.5, confidence: 0.8 };

/**
 * @param {ImageData} img      the captured still
 * @param {Array}     pts      raw normalised landmarks (NOT canonicalised — we
 *                             need positions in the original frame to index pixels)
 * @param {object}    profile  questionnaire answers; `fitzpatrick` calibrates
 *                             the redness baseline and the confidence figure
 */
export function measureSkin(img, pts, profile = {}) {
  const { data, width: w, height: h } = img;
  const at = (i) => ({ x: pts[i].x * w, y: pts[i].y * h });
  const ipd = Math.hypot(at(L.L_EYE_IN).x - at(L.R_EYE_IN).x, at(L.L_EYE_IN).y - at(L.R_EYE_IN).y);
  const r = Math.max(4, ipd * 0.085);            // patch radius scales with face size

  // Reference skin: the two cheeks (flat, evenly lit, rarely occluded).
  const cheekR = samplePatch(data, w, h, at(L.CHEEK_R).x, at(L.CHEEK_R).y + r, r);
  const cheekL = samplePatch(data, w, h, at(L.CHEEK_L).x, at(L.CHEEK_L).y + r, r);
  const forehead = samplePatch(data, w, h, at(L.GLABELLA).x, at(L.GLABELLA).y - ipd * 0.35, r);

  // Tear-trough patches sit just below the lower lid.
  const ueR = samplePatch(data, w, h, at(L.R_EYE_DN).x, at(L.R_EYE_DN).y + r * 1.15, r * 0.8);
  const ueL = samplePatch(data, w, h, at(L.L_EYE_DN).x, at(L.L_EYE_DN).y + r * 1.15, r * 0.8);

  const ok = (...s) => s.every(Boolean);
  if (!ok(cheekR, cheekL)) return null;

  const cheekL_ = (cheekR.L + cheekL.L) / 2;
  const cheekA  = (cheekR.a + cheekL.a) / 2;
  const cheekB  = (cheekR.b + cheekL.b) / 2;

  /* Under-eye darkness: how much darker + redder the tear trough is than the
     cheek. Combining ΔL with Δa separates a true vascular shadow (darker AND
     redder/bluer) from plain contour shading. */
  let underEye = null;
  if (ok(ueR, ueL)) {
    const dL = cheekL_ - (ueR.L + ueL.L) / 2;
    const dA = (ueR.a + ueL.a) / 2 - cheekA;
    underEye = { deltaL: round(dL, 2), deltaA: round(dA, 2), index: round(dL + Math.max(0, dA) * 0.6, 2) };
  }

  /* Tone evenness: within-patch lightness spread, plus the left↔right and
     cheek↔forehead mismatch. Lower is more even. */
  const within = (cheekR.sd + cheekL.sd + (forehead?.sd ?? cheekR.sd)) / 3;
  const across = Math.abs(cheekR.L - cheekL.L) +
                 (forehead ? Math.abs(cheekL_ - forehead.L) * 0.5 : 0);
  const evenness = round(within + across * 0.5, 2);

  /* Redness / reactivity: cheek a* above the neutral baseline for this skin
     tone. Falls back to a mid baseline when the tone is unknown. */
  const tone = TONE[profile.fitzpatrick] ?? DEFAULT_TONE;
  const redness = round(Math.max(0, cheekA - tone.aBase), 2);

  return {
    underEye,
    evenness,
    redness,
    /* How much this reading should be trusted. Surfaced in the UI rather than
       hidden, because a confident wrong number is worse than an honest soft one. */
    confidence: round(tone.confidence, 2),
    toneKnown: profile.fitzpatrick != null,
    cheek: { L: round(cheekL_, 1), a: round(cheekA, 1), b: round(cheekB, 1) },
    // A rough exposure sanity check — the caller warns the user if it is off.
    exposure: round(cheekL_, 1),
    lit: cheekL_ > 28 && cheekL_ < 88,
    balanced: ok(cheekR, cheekL) && Math.abs(cheekR.L - cheekL.L) < 14,
  };
}
