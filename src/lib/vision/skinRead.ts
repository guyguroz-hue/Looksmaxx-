/**
 * Pixel-level skin readings.
 *
 * These describe how the image looks, not how skin *is*. Everything downstream
 * is worded as a lighting-and-presentation observation, and nothing here may
 * produce a dermatological claim.
 */

import * as L from './landmarks';
import type { Landmark } from './types';
import { round } from './geometry';

const srgbToLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export interface Lab { readonly L: number; readonly a: number; readonly b: number }

export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLin(r / 255);
  const G = srgbToLin(g / 255);
  const B = srgbToLin(b / 255);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

interface Patch extends Lab { readonly sd: number; readonly n: number }

/** Trimmed mean over a square patch — a specular highlight should not set the tone. */
function samplePatch(
  data: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number,
): Patch | null {
  const px: Lab[] = [];
  const x0 = Math.max(0, Math.round(cx - r));
  const x1 = Math.min(w - 1, Math.round(cx + r));
  const y0 = Math.max(0, Math.round(cy - r));
  const y1 = Math.min(h - 1, Math.round(cy + r));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if ((data[i + 3] ?? 0) < 200) continue;
      px.push(rgbToLab(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0));
    }
  }
  if (px.length < 12) return null;
  px.sort((p, q) => p.L - q.L);
  const cut = Math.floor(px.length * 0.1);
  const core = px.slice(cut, px.length - cut || px.length);
  const n = core.length;
  const mean = core.reduce((s, p) => ({ L: s.L + p.L, a: s.a + p.a, b: s.b + p.b }), { L: 0, a: 0, b: 0 });
  const m = { L: mean.L / n, a: mean.a / n, b: mean.b / n };
  const sd = Math.sqrt(core.reduce((s, p) => s + (p.L - m.L) ** 2, 0) / n);
  return { ...m, sd, n };
}

export interface SkinReading {
  /** How much darker/redder the tear trough is than the cheek. */
  readonly underEyeContrast: number | null;
  /** Lightness spread across the face — texture plus uneven lighting, mixed. */
  readonly toneSpread: number | null;
  /** Left/right lightness difference. High means the light is one-sided. */
  readonly lightBalance: number;
  readonly lightness: number;
  readonly localDetail: number;
}

export function readSkin(
  img: { data: Uint8ClampedArray; width: number; height: number },
  pts: readonly Landmark[],
): SkinReading | null {
  const { data, width: w, height: h } = img;
  const at = (i: number) => {
    const p = pts[i];
    return p ? { x: p.x * w, y: p.y * h } : null;
  };

  const li = at(L.L_EYE_IN);
  const ri = at(L.R_EYE_IN);
  if (!li || !ri) return null;
  const ipd = Math.hypot(li.x - ri.x, li.y - ri.y);
  const r = Math.max(4, ipd * 0.085);

  const cR = at(L.CHEEK_R);
  const cL = at(L.CHEEK_L);
  const gl = at(L.GLABELLA);
  if (!cR || !cL) return null;

  const cheekR = samplePatch(data, w, h, cR.x, cR.y + r, r);
  const cheekL = samplePatch(data, w, h, cL.x, cL.y + r, r);
  if (!cheekR || !cheekL) return null;
  const forehead = gl ? samplePatch(data, w, h, gl.x, gl.y - ipd * 0.35, r) : null;

  const eR = at(L.R_EYE_DN);
  const eL = at(L.L_EYE_DN);
  const ueR = eR ? samplePatch(data, w, h, eR.x, eR.y + r * 1.15, r * 0.8) : null;
  const ueL = eL ? samplePatch(data, w, h, eL.x, eL.y + r * 1.15, r * 0.8) : null;

  const cheekLight = (cheekR.L + cheekL.L) / 2;

  let underEye: number | null = null;
  if (ueR && ueL) {
    const dL = cheekLight - (ueR.L + ueL.L) / 2;
    const dA = (ueR.a + ueL.a) / 2 - (cheekR.a + cheekL.a) / 2;
    underEye = round(dL + Math.max(0, dA) * 0.6, 2);
  }

  const within = (cheekR.sd + cheekL.sd + (forehead?.sd ?? cheekR.sd)) / 3;
  const across = forehead ? Math.abs(cheekLight - forehead.L) * 0.5 : 0;

  return {
    underEyeContrast: underEye,
    toneSpread: round(within + across * 0.5, 2),
    lightBalance: round(Math.abs(cheekR.L - cheekL.L), 2),
    lightness: round(cheekLight, 1),
    localDetail: round(within, 2),
  };
}
