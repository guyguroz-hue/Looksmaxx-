/* Body measurement engine.
   Pose landmarks give the skeleton; the segmentation mask gives the *silhouette*,
   which is what actually carries waist and hip width — joints alone cannot.
   Scanning the mask row by row is the trick that makes a free, on-device
   shoulder-to-waist ratio possible. */

import { POSE } from './landmarks.js';
import { round, clamp } from './geometry.js';

/**
 * Width of the subject at image row `y`, in pixels, read off the segmentation
 * mask. Takes the widest contiguous run so a raised arm or a background blob
 * does not inflate the measurement.
 */
function silhouetteWidth(mask, w, h, y, threshold = 0.5) {
  const row = Math.round(clamp(y, 0, h - 1));
  let best = 0, bestStart = -1, run = 0, start = -1;
  for (let x = 0; x < w; x++) {
    if (mask[row * w + x] > threshold) {
      if (run === 0) start = x;
      run++;
      if (run > best) { best = run; bestStart = start; }
    } else run = 0;
  }
  return { width: best, centre: best ? bestStart + best / 2 : null };
}

/** Scan a band of rows and return the narrowest / widest run inside it. */
function scanBand(mask, w, h, y0, y1, pick) {
  const step = Math.max(1, Math.round((y1 - y0) / 24));
  let chosen = null;
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += step) {
    const r = silhouetteWidth(mask, w, h, y);
    if (!r.width) continue;
    if (!chosen || (pick === 'min' ? r.width < chosen.width : r.width > chosen.width)) {
      chosen = { ...r, y };
    }
  }
  return chosen;
}

const angleFromHorizontal = (a, b) =>
  Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180;

/**
 * @param {Array}  lm    33 normalised pose landmarks
 * @param {Float32Array|Uint8Array} mask  segmentation confidence, w*h, 0..1
 * @param {'front'|'side'} view
 */
export function measureBody(lm, mask, w, h, view = 'front') {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h, v: lm[i].visibility ?? 1 });
  const shoulderL = P(POSE.L_SHOULDER), shoulderR = P(POSE.R_SHOULDER);
  const hipL = P(POSE.L_HIP), hipR = P(POSE.R_HIP);
  const ankleL = P(POSE.L_ANKLE), ankleR = P(POSE.R_ANKLE);

  const shoulderMid = { x: (shoulderL.x + shoulderR.x) / 2, y: (shoulderL.y + shoulderR.y) / 2 };
  const hipMid = { x: (hipL.x + hipR.x) / 2, y: (hipL.y + hipR.y) / 2 };
  const torsoH = Math.abs(hipMid.y - shoulderMid.y) || 1e-9;

  const out = { view, quality: {}, px: {}, ratios: {}, posture: {} };

  /* ---------- posture (works from the skeleton alone) ---------- */
  const shoulderTilt = angleFromHorizontal(shoulderL, shoulderR);
  const hipTilt = angleFromHorizontal(hipL, hipR);
  out.posture.shoulderTilt = round(shoulderTilt > 90 ? 180 - shoulderTilt : shoulderTilt, 1);
  out.posture.hipTilt = round(hipTilt > 90 ? 180 - hipTilt : hipTilt, 1);

  if (view === 'side') {
    /* Forward head carriage: how far the ear sits ahead of the shoulder,
       as a share of torso height. The standard clinical screen, minus the
       goniometer. */
    const ear = P(POSE.L_EAR).v > P(POSE.R_EAR).v ? P(POSE.L_EAR) : P(POSE.R_EAR);
    const sh = P(POSE.L_SHOULDER).v > P(POSE.R_SHOULDER).v ? shoulderL : shoulderR;
    out.posture.forwardHead = round(Math.abs(ear.x - sh.x) / torsoH, 3);
    out.posture.craniovertebral = round(
      Math.atan2(Math.abs(sh.y - ear.y), Math.abs(ear.x - sh.x)) * 180 / Math.PI, 1);
    // Pelvis→shoulder lean off vertical.
    out.posture.trunkLean = round(
      Math.atan2(Math.abs(shoulderMid.x - hipMid.x), torsoH) * 180 / Math.PI, 1);
  } else {
    // Head tilt relative to the shoulder line.
    const nose = P(POSE.NOSE);
    out.posture.headShift = round((nose.x - shoulderMid.x) / (Math.abs(shoulderL.x - shoulderR.x) || 1e-9), 3);
  }

  /* ---------- silhouette widths (need the mask) ---------- */
  if (mask) {
    const shoulderRow = shoulderMid.y + torsoH * 0.06;      // just below the acromion
    const waistBand = [hipMid.y - torsoH * 0.42, hipMid.y - torsoH * 0.12];
    const hipBand = [hipMid.y - torsoH * 0.02, hipMid.y + torsoH * 0.22];

    const sh = silhouetteWidth(mask, w, h, shoulderRow);
    const waist = scanBand(mask, w, h, waistBand[0], waistBand[1], 'min');
    const hip = scanBand(mask, w, h, hipBand[0], hipBand[1], 'max');

    out.px = {
      shoulder: sh.width || null,
      waist: waist?.width ?? null,
      hip: hip?.width ?? null,
      waistY: waist?.y ?? null,
      hipY: hip?.y ?? null,
      shoulderY: Math.round(shoulderRow),
    };

    if (sh.width && waist?.width) out.ratios.shoulderToWaist = round(sh.width / waist.width, 3);
    if (waist?.width && hip?.width) out.ratios.waistToHip = round(waist.width / hip.width, 3);
    if (sh.width && hip?.width) out.ratios.shoulderToHip = round(sh.width / hip.width, 3);
  }

  /* ---------- proportion ---------- */
  const ankleY = Math.max(ankleL.y, ankleR.y);
  if (Number.isFinite(ankleY) && ankleY > hipMid.y) {
    out.ratios.legToTorso = round((ankleY - hipMid.y) / torsoH, 3);
  }
  out.ratios.torsoAspect = round(torsoH / (Math.abs(shoulderL.x - shoulderR.x) || 1e-9), 3);

  /* ---------- capture quality ---------- */
  const vis = [POSE.L_SHOULDER, POSE.R_SHOULDER, POSE.L_HIP, POSE.R_HIP]
    .map(i => lm[i].visibility ?? 1);
  out.quality = {
    limbsVisible: round(vis.reduce((s, v) => s + v, 0) / vis.length, 2),
    fullBody: (ankleL.v > 0.5 || ankleR.v > 0.5),
    hasMask: !!mask,
    // A square-on front shot has near-equal shoulder-to-hip diagonals.
    squareOn: round(1 - Math.min(1, Math.abs(
      Math.hypot(shoulderL.x - hipR.x, shoulderL.y - hipR.y) -
      Math.hypot(shoulderR.x - hipL.x, shoulderR.y - hipL.y)) / (torsoH || 1e-9)), 2),
  };

  return out;
}
