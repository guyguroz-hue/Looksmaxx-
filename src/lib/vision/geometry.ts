/** Dependency-free 2D geometry. Everything works in normalised image space. */

import type { Point } from './types';

export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Distance in the image plane. MediaPipe's z is a weakly-calibrated relative
 * depth; folding it into lengths adds noise rather than accuracy.
 */
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Angle of a→b from the +x axis, degrees, counter-clockwise positive. */
export const angleOf = (a: Point, b: Point): number =>
  (Math.atan2(-(a.y - b.y), a.x - b.x) * 180) / Math.PI;

/** Interior angle at vertex v between rays v→a and v→b, in degrees. */
export function angleAt(v: Point, a: Point, b: Point): number {
  const u = sub(a, v);
  const w = sub(b, v);
  const denom = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y) || 1e-9;
  const d = (u.x * w.x + u.y * w.y) / denom;
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/** Rotate p around o by `deg` in screen coordinates (y down). */
export function rotate(p: Point, o: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
}

/** Perpendicular distance from p to the infinite line through a and b. */
export function distToLine(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1e-9;
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

export function polyArea(pts: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function polyPerimeter(pts: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i]!, pts[(i + 1) % pts.length]!);
  return s;
}

/** Isoperimetric roundness: 1 for a circle, lower for an elongated outline. */
export const roundness = (pts: readonly Point[]): number =>
  (4 * Math.PI * polyArea(pts)) / (polyPerimeter(pts) ** 2 || 1e-9);

/** Extent of a point set along a unit axis. */
export function extentAlong(pts: readonly Point[], ux: number, uy: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    const t = p.x * ux + p.y * uy;
    if (t < lo) lo = t;
    if (t > hi) hi = t;
  }
  return hi - lo;
}

export const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

export const round = (v: number, d = 1): number => {
  const k = 10 ** d;
  return Math.round(v * k) / k;
};

/** Median — robust to the one bad frame a mean would happily absorb. */
export function median(arr: readonly number[]): number | null {
  const a = arr.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (a.length === 0) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
}

/**
 * Map a value's position relative to a reference band onto 0..1, where 1 means
 * "comfortably inside". Used only to RANK opportunities internally — it is
 * never shown, because a number here would be exactly the attractiveness score
 * this product refuses to produce.
 */
export function bandFit(value: number, lo: number, hi: number, tol: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= lo && value <= hi) return 1;
  const d = value < lo ? lo - value : value - hi;
  return clamp(1 - d / (tol || 1e-9));
}
