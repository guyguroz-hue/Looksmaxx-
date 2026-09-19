/* Scan orchestration.
 *
 * The important idea here: a single frame is not a measurement. The scanner
 * runs a live loop, gates each frame on capture quality (roll / yaw / pitch /
 * detection confidence), collects only the frames that pass, and fuses them
 * with a median. That is what separates a stable number from one that jitters
 * every time the user breathes. */

import { faceLandmarker, poseLandmarker } from '../lib/mp.js';
import { measureFace } from '../analysis/faceMetrics.js';
import { measureSkin } from '../analysis/skin.js';
import { measureBody } from '../analysis/bodyMetrics.js';
import { median } from '../analysis/geometry.js';

/* A frame must clear all of these to be counted. Loose enough to be usable
   handheld, tight enough that the numbers mean something. */
export const FACE_GATE = { roll: 6, yaw: 0.16, pitch: 0.09 };
const NEEDED_FRAMES = 12;

/** Per-check pass/fail plus a 0..1 score, for the live quality meters. */
export function faceQuality(q) {
  const s = (v, lim) => Math.max(0, 1 - Math.abs(v) / lim);
  const checks = {
    level:    { label: 'ראש ישר',        ok: Math.abs(q.roll) <= FACE_GATE.roll,   v: s(q.roll, FACE_GATE.roll * 1.8) },
    facing:   { label: 'פנים למצלמה',    ok: Math.abs(q.yaw) <= FACE_GATE.yaw,     v: s(q.yaw, FACE_GATE.yaw * 1.8) },
    chin:     { label: 'סנטר במאוזן',    ok: Math.abs(q.pitch) <= FACE_GATE.pitch, v: s(q.pitch, FACE_GATE.pitch * 1.8) },
    distance: { label: 'מרחק מהמצלמה',   ok: q.ipdMm != null,                       v: q.hasIris ? 1 : 0 },
  };
  const pass = Object.values(checks).every(c => c.ok);
  return { checks, pass, score: Object.values(checks).reduce((a, c) => a + c.v, 0) / 4 };
}

/** The single most useful correction to show the user right now. */
export function faceHint(q) {
  if (!q.hasIris) return 'מתקרבים — הפנים צריכות למלא את המסגרת';
  if (Math.abs(q.yaw) > FACE_GATE.yaw)   return q.yaw > 0 ? 'לסובב את הראש מעט שמאלה' : 'לסובב את הראש מעט ימינה';
  if (Math.abs(q.pitch) > FACE_GATE.pitch) return q.pitch > 0 ? 'להרים מעט את הסנטר' : 'להוריד מעט את הסנטר';
  if (Math.abs(q.roll) > FACE_GATE.roll) return 'ליישר את הראש';
  return 'מצוין — להחזיק ככה';
}

/** Fuse a list of per-frame measurement objects by taking the median of every
 *  numeric leaf. Robust to the occasional bad frame in a way a mean is not. */
function fuse(samples) {
  if (!samples.length) return null;
  const out = structuredClone(samples[0]);
  const walk = (node, path) => {
    for (const [k, v] of Object.entries(node)) {
      const p = [...path, k];
      if (v && typeof v === 'object' && !Array.isArray(v)) { walk(v, p); continue; }
      if (typeof v !== 'number') continue;
      const vals = samples.map(s => p.reduce((o, kk) => o?.[kk], s)).filter(Number.isFinite);
      if (vals.length) node[k] = median(vals);
    }
  };
  walk(out, []);
  return out;
}

/**
 * Live face scan.
 * @param {Camera} cam
 * @param {(state)=>void} onTick  called every frame with live quality + progress
 * @returns {Promise<{face, skin, frames, still}>}
 */
export async function scanFace(cam, onTick, signal, profile = {}) {
  const detector = await faceLandmarker();
  const samples = [];
  let lastLandmarks = null, lastQuality = null;

  await new Promise((resolve, reject) => {
    const loop = () => {
      if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
      const { w, h } = cam.size;
      if (!w) return requestAnimationFrame(loop);

      let res;
      try { res = detector.detectForVideo(cam.video, performance.now()); }
      catch { return requestAnimationFrame(loop); }

      const lm = res?.faceLandmarks?.[0];
      if (!lm) {
        onTick?.({ found: false, progress: samples.length / NEEDED_FRAMES, hint: 'לא מזוהות פנים במסגרת' });
        return requestAnimationFrame(loop);
      }

      const m = measureFace(lm, w, h);
      const q = faceQuality(m.quality);
      lastLandmarks = lm; lastQuality = m.quality;

      if (q.pass) samples.push(m);

      onTick?.({
        found: true, quality: q, locked: q.pass,
        progress: Math.min(1, samples.length / NEEDED_FRAMES),
        hint: q.pass ? `מודד… ${samples.length}/${NEEDED_FRAMES}` : faceHint(m.quality),
      });

      if (samples.length >= NEEDED_FRAMES) return resolve();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  /* One still, un-mirrored, for the pixel work and the annotated report. */
  const still = cam.grab({ mirror: false });
  const skin = lastLandmarks ? measureSkin(still.imageData, lastLandmarks, profile) : null;

  return {
    face: fuse(samples),
    skin,
    landmarks: lastLandmarks,
    quality: lastQuality,
    frames: samples.length,
    still,
  };
}

/** Pose quality gate — much looser, because full-body framing is harder. */
export function bodyQuality(q, view) {
  const checks = {
    visible: { label: 'הגוף במסגרת',   ok: q.limbsVisible > 0.7, v: q.limbsVisible },
    full:    { label: 'גוף מלא',        ok: q.fullBody,           v: q.fullBody ? 1 : 0.3 },
    mask:    { label: 'זיהוי סילואט',   ok: q.hasMask,            v: q.hasMask ? 1 : 0 },
  };
  if (view === 'front') checks.square = { label: 'ניצב למצלמה', ok: q.squareOn > 0.82, v: q.squareOn };
  const pass = Object.values(checks).every(c => c.ok);
  return { checks, pass, score: Object.values(checks).reduce((a, c) => a + c.v, 0) / Object.keys(checks).length };
}

/**
 * Live body scan. `view` is 'front' or 'side' — the side shot is what unlocks
 * the posture metrics, so the UI asks for both.
 */
export async function scanBody(cam, view, onTick, signal) {
  const detector = await poseLandmarker();
  const samples = [];
  let lastLandmarks = null;
  const NEED = 8;

  await new Promise((resolve, reject) => {
    const loop = () => {
      if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
      const { w, h } = cam.size;
      if (!w) return requestAnimationFrame(loop);

      let res;
      try { res = detector.detectForVideo(cam.video, performance.now()); }
      catch { return requestAnimationFrame(loop); }

      const lm = res?.landmarks?.[0];
      if (!lm) {
        onTick?.({ found: false, progress: samples.length / NEED, hint: 'להתרחק כך שכל הגוף ייכנס למסגרת' });
        return requestAnimationFrame(loop);
      }

      /* The segmentation mask is a Float32 confidence map, same size as the frame. */
      let mask = null;
      const segs = res.segmentationMasks;
      if (segs?.length) { try { mask = segs[0].getAsFloat32Array(); } catch {} }

      const m = measureBody(lm, mask, w, h, view);
      const q = bodyQuality(m.quality, view);
      lastLandmarks = lm;
      if (q.pass) samples.push(m);

      onTick?.({
        found: true, quality: q, locked: q.pass,
        progress: Math.min(1, samples.length / NEED),
        hint: q.pass ? `מודד… ${samples.length}/${NEED}`
          : !m.quality.fullBody ? 'להתרחק — כפות הרגליים חייבות להיכנס למסגרת'
          : view === 'front' && m.quality.squareOn <= 0.82 ? 'להסתובב כך שהכתפיים ניצבות למצלמה'
          : 'להחזיק יציב',
      });

      segs?.forEach(s => { try { s.close(); } catch {} });
      if (samples.length >= NEED) return resolve();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  const still = cam.grab({ mirror: false });
  return { body: fuse(samples), landmarks: lastLandmarks, frames: samples.length, still, view };
}
