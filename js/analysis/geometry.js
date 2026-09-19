/* Small, dependency-free 2D/3D geometry used by every metric.
   Everything works on {x,y,z} points in normalised [0..1] image space
   unless a function says otherwise. */

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: (a.z ?? 0) + (b.z ?? 0) });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: (a.z ?? 0) * k });
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 });

/** Distance in the image plane. z is deliberately ignored: MediaPipe's z is a
 *  weakly-calibrated relative depth, and mixing it into lengths adds noise. */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed angle of b→a measured from the +x axis, degrees, CCW positive in
 *  screen coords flipped to maths coords (y up). */
export const angleOf = (a, b) => Math.atan2(-(a.y - b.y), a.x - b.x) * 180 / Math.PI;

/** Interior angle at vertex v between rays v→a and v→b, degrees 0..180. */
export function angleAt(v, a, b) {
  const u = sub(a, v), w = sub(b, v);
  const d = (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y) || 1e-9);
  return Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI;
}

/** Rotate p around origin o by deg (screen coords). */
export function rotate(p, o, deg) {
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = p.x - o.x, dy = p.y - o.y;
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c, z: p.z ?? 0 };
}

/** Perpendicular distance from p to the infinite line through a and b. */
export function distToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1e-9;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / L;
}

/** Signed side of the line a→b that p falls on (>0 left, <0 right). */
export const sideOf = (p, a, b) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/** Polygon area (shoelace) and perimeter for a closed ring of points. */
export function polyArea(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}
export function polyPerimeter(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) s += dist(pts[i], pts[(i + 1) % n]);
  return s;
}

/** Isoperimetric roundness: 1 for a perfect circle, →0 for a ragged/elongated
 *  outline. Used as the facial-fullness proxy. */
export const roundness = (pts) => (4 * Math.PI * polyArea(pts)) / (polyPerimeter(pts) ** 2 || 1e-9);

/** Extent of a point set along an arbitrary unit axis. */
export function extentAlong(pts, ux, uy) {
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { const t = p.x * ux + p.y * uy; if (t < lo) lo = t; if (t > hi) hi = t; }
  return hi - lo;
}

/* ---------- scoring helpers ---------- */

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, d = 1) => { const k = 10 ** d; return Math.round(v * k) / k; };

/**
 * Score a measurement against a target band, 0..100.
 * Full marks anywhere inside [lo, hi]; a smooth cosine falloff outside it that
 * reaches 0 at `tol` beyond the edge. Deliberately gentle — a hard cliff would
 * make tiny measurement noise swing the score.
 */
export function bandScore(value, lo, hi, tol) {
  if (!Number.isFinite(value)) return null;
  if (value >= lo && value <= hi) return 100;
  const d = value < lo ? lo - value : value - hi;
  const t = clamp(d / tol);
  return Math.round(100 * (0.5 + 0.5 * Math.cos(Math.PI * t)));
}

/** Weighted mean that silently drops null/NaN entries. */
export function weightedMean(entries) {
  let num = 0, den = 0;
  for (const { value, weight } of entries) {
    if (value == null || !Number.isFinite(value)) continue;
    num += value * weight; den += weight;
  }
  return den ? num / den : null;
}

/** Median of a numeric array (used to fuse multi-frame samples). */
export function median(arr) {
  const a = arr.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
