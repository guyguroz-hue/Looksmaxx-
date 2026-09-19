/** Synthetic 478-point faces with controllable geometry, so the engine can be
 *  regression-tested without a camera. */
import type { Landmark } from '@/lib/vision/types';

export function synthFace(
  opts: { roll?: number; outerEyeLift?: number; asymShift?: number; wide?: boolean } = {},
): Landmark[] {
  const { roll = 0, outerEyeLift = 0, asymShift = 0, wide = false } = opts;
  const P: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i: number, x: number, y: number) => { P[i] = { x, y, z: 0 }; };
  const k = wide ? 1.18 : 1;
  const sx = (x: number) => 0.5 + (x - 0.5) * k;

  set(10, 0.5, 0.18); set(9, 0.5, 0.34); set(168, 0.5, 0.36); set(2, 0.5, 0.6);
  set(1, 0.5, 0.55); set(152, 0.5, 0.84); set(13, 0.5, 0.685); set(0, 0.5, 0.665);
  set(14, 0.5, 0.695); set(17, 0.5, 0.725);
  for (const i of [151, 8, 6, 197, 195, 5, 19, 94, 164, 18, 200, 199, 175]) set(i, 0.5, 0.5);

  set(33, sx(0.415), 0.4 + outerEyeLift); set(133, sx(0.463), 0.4);
  set(263, sx(0.585), 0.4 + outerEyeLift); set(362, sx(0.537), 0.4);
  set(159, sx(0.44), 0.385); set(145, sx(0.44), 0.415);
  set(386, sx(0.56), 0.385); set(374, sx(0.56), 0.415);

  const w = 0.024;
  set(468, sx(0.56), 0.4); set(469, sx(0.56) + w / 2, 0.4); set(470, sx(0.56), 0.4 - w / 2);
  set(471, sx(0.56) - w / 2, 0.4); set(472, sx(0.56), 0.4 + w / 2);
  set(473, sx(0.44), 0.4); set(474, sx(0.44) + w / 2, 0.4); set(475, sx(0.44), 0.4 - w / 2);
  set(476, sx(0.44) - w / 2, 0.4); set(477, sx(0.44), 0.4 + w / 2);

  const pairs: [number, number, number, number, number][] = [
    [105, 334, 0.455, 0.545, 0.355], [107, 336, 0.478, 0.522, 0.358], [70, 300, 0.425, 0.575, 0.362],
    [63, 293, 0.44, 0.56, 0.352], [98, 327, 0.478, 0.522, 0.585], [129, 358, 0.472, 0.528, 0.575],
    [64, 294, 0.474, 0.526, 0.57], [61, 291, 0.455, 0.545, 0.69], [40, 270, 0.47, 0.53, 0.668],
    [91, 321, 0.468, 0.532, 0.712], [84, 314, 0.482, 0.518, 0.718], [234, 454, 0.355, 0.645, 0.46],
    [172, 397, 0.395, 0.605, 0.735], [58, 288, 0.375, 0.625, 0.66], [205, 425, 0.44, 0.56, 0.55],
    [116, 345, 0.37, 0.63, 0.5], [123, 352, 0.375, 0.625, 0.53], [147, 376, 0.385, 0.615, 0.7],
    [136, 365, 0.4, 0.6, 0.755], [150, 379, 0.425, 0.575, 0.79], [149, 378, 0.44, 0.56, 0.81],
    [93, 323, 0.355, 0.645, 0.56], [132, 361, 0.36, 0.64, 0.62], [215, 435, 0.42, 0.58, 0.66],
    [138, 367, 0.4, 0.6, 0.69],
  ];
  for (const [a, b, xa, xb, y] of pairs) { set(a, sx(xa) - asymShift, y); set(b, sx(xb), y); }

  const extra: [number, number, number][] = [
    [338, 0.545, 0.19], [297, 0.575, 0.215], [332, 0.6, 0.25], [284, 0.622, 0.29], [251, 0.638, 0.33],
    [389, 0.648, 0.385], [356, 0.648, 0.44], [323, 0.64, 0.5], [361, 0.632, 0.56], [288, 0.625, 0.61],
    [397, 0.605, 0.68], [365, 0.6, 0.735], [379, 0.575, 0.775], [378, 0.56, 0.8], [400, 0.54, 0.818],
    [377, 0.522, 0.832], [148, 0.478, 0.832], [176, 0.46, 0.818], [127, 0.352, 0.385],
    [162, 0.362, 0.33], [21, 0.378, 0.29], [54, 0.4, 0.25], [103, 0.425, 0.215], [67, 0.455, 0.19],
    [109, 0.478, 0.178],
  ];
  for (const [i, x, y] of extra) set(i, sx(x), y);

  if (roll) {
    const r = (roll * Math.PI) / 180;
    const c = Math.cos(r); const s = Math.sin(r);
    const o = { x: 0.5, y: 0.4 };
    for (let i = 0; i < P.length; i++) {
      const p = P[i]!;
      const dx = p.x - o.x; const dy = p.y - o.y;
      P[i] = { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c, z: 0 };
    }
  }
  return P;
}

/** A skin reading with sensible defaults, overridable per test. */
export function synthSkin(over: Partial<import('@/lib/vision/skinRead').SkinReading> = {}) {
  return {
    underEyeContrast: 2, toneSpread: 4, lightBalance: 3, lightness: 58, localDetail: 3,
    ...over,
  };
}
