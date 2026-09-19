/* Measurement-engine tests. No browser, no camera — synthetic landmark sets with
   known ground truth, so a regression in the geometry is caught immediately. */

import assert from 'node:assert/strict';
import { synthFace } from './synthFace.js';
import { measureFace } from '../js/analysis/faceMetrics.js';
import { measureBody } from '../js/analysis/bodyMetrics.js';
import { rgbToLab } from '../js/analysis/skin.js';
import { scoreAll, rankOpportunities } from '../js/analysis/scoring.js';
import { buildPlan } from '../js/content/planner.js';
import { METRICS, METRIC_BY_ID, resolveBand } from '../js/content/metricsCatalog.js';
import { PROTOCOLS } from '../js/content/protocols.js';
import { bandScore, median } from '../js/analysis/geometry.js';

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + '\n      ' + e.message); fail++; }
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, expected ${b} ±${tol}`);

console.log('\ngeometry & scoring');
t('bandScore is 100 inside the band', () => assert.equal(bandScore(5, 4, 6, 2), 100));
t('bandScore decays outside the band', () => assert.ok(bandScore(8, 4, 6, 2) < 20));
t('bandScore returns null for NaN', () => assert.equal(bandScore(NaN, 0, 1, 1), null));
t('median rejects an outlier', () => assert.equal(median([10, 12, 99]), 12));

console.log('\nface geometry');
const flat = measureFace(synthFace(), 1000, 1000);
t('level face reads ~0° roll', () => near(flat.quality.roll, 0, 0.5, 'roll'));
t('iris calibration engages', () => assert.equal(flat.quality.hasIris, true));
t('IPD lands in the human range', () => assert.ok(flat.quality.ipdMm > 45 && flat.quality.ipdMm < 80));
t('symmetric face ⇒ ~0 mm deviation', () => near(flat.mm.symMeanDev, 0, 0.4, 'symMeanDev'));
t('level eyes ⇒ ~0° canthal tilt', () => near(flat.ratios.canthalTilt, 0, 0.5, 'tilt'));

t('raised outer canthi ⇒ POSITIVE tilt', () =>
  assert.ok(measureFace(synthFace({ outerEyeLift: -0.01 }), 1000, 1000).ratios.canthalTilt > 5));
t('dropped outer canthi ⇒ NEGATIVE tilt', () =>
  assert.ok(measureFace(synthFace({ outerEyeLift: 0.01 }), 1000, 1000).ratios.canthalTilt < -5));

t('roll is detected at the right magnitude', () =>
  near(Math.abs(measureFace(synthFace({ roll: 12 }), 1000, 1000).quality.roll), 12, 1, 'roll'));

/* The property that matters most: a tilted head must not change the anatomy. */
const upright = measureFace(synthFace({ outerEyeLift: -0.01 }), 1000, 1000);
const tilted  = measureFace(synthFace({ outerEyeLift: -0.01, roll: 12 }), 1000, 1000);
t('canthal tilt is roll-invariant', () => near(tilted.ratios.canthalTilt, upright.ratios.canthalTilt, 0.4, 'tilt'));
t('bizygomatic width is roll-invariant', () => near(tilted.mm.bizygomatic, upright.mm.bizygomatic, 1.5, 'width'));

const asym = measureFace(synthFace({ asymShift: 0.008 }), 1000, 1000);
t('an induced shift shows up as asymmetry', () => assert.ok(asym.mm.symMeanDev > 2.5));
t('asymmetry is roll-invariant', () =>
  near(measureFace(synthFace({ asymShift: 0.008, roll: 12 }), 1000, 1000).mm.symMeanDev, asym.mm.symMeanDev, 0.4, 'asym'));

console.log('\ncolour');
t('mid-grey has zero chroma', () => { const g = rgbToLab(128, 128, 128); near(g.a, 0, 0.01, 'a'); near(g.b, 0, 0.01, 'b'); });
t('mid-grey lightness ≈ 53.6', () => near(rgbToLab(128, 128, 128).L, 53.6, 0.3, 'L'));

console.log('\nbody silhouette');
const W = 200, H = 400;
const mask = new Float32Array(W * H);
const widthAt = (y) => y < 80 ? 34 : y < 110 ? 80 : y < 190 ? 80 - (y - 110) / 80 * 30 : y < 230 ? 50 + (y - 190) / 40 * 16 : 60;
for (let y = 0; y < H; y++) { const wd = widthAt(y); for (let x = Math.round(100 - wd / 2); x < Math.round(100 + wd / 2); x++) mask[y * W + x] = 1; }
const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, z: 0, visibility: 1 }));
const set = (i, x, y) => lm[i] = { x: x / W, y: y / H, z: 0, visibility: 1 };
set(0, 100, 50); set(7, 92, 52); set(8, 108, 52);
set(11, 140, 105); set(12, 60, 105); set(23, 124, 235); set(24, 76, 235);
set(27, 112, 392); set(28, 88, 392);
const body = measureBody(lm, mask, W, H, 'front');
t('shoulder width read from the silhouette', () => near(body.px.shoulder, 80, 4, 'shoulder'));
t('waist found at the narrowest point', () => near(body.px.waist, 50, 3, 'waist'));
t('V-taper ratio computed', () => near(body.ratios.shoulderToWaist, 1.6, 0.12, 'S:W'));
t('level shoulders ⇒ ~0° tilt', () => near(body.posture.shoulderTilt, 0, 0.5, 'tilt'));
t('square-on detection', () => assert.ok(body.quality.squareOn > 0.9));

console.log('\ncatalogue integrity');
t('every metric path is unique', () => {
  const ids = METRICS.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
});
t('every referenced protocol exists', () => {
  for (const m of METRICS) for (const p of m.protocols ?? []) assert.ok(PROTOCOLS[p], `missing protocol ${p} (from ${m.id})`);
});
t('every protocol is reachable from some metric', () => {
  const ref = new Set(METRICS.flatMap(m => m.protocols ?? []));
  for (const id of Object.keys(PROTOCOLS)) assert.ok(ref.has(id), `orphan protocol ${id}`);
});
t('every band is ordered lo ≤ hi for each build', () => {
  for (const m of METRICS) for (const sex of ['m', 'f', 'x']) {
    const [lo, hi] = resolveBand(m, sex);
    assert.ok(lo <= hi, `${m.id}/${sex}`);
  }
});
t('sex-specific bands actually differ', () => {
  const m = METRIC_BY_ID.waistToHip;
  assert.notDeepEqual(resolveBand(m, 'm'), resolveBand(m, 'f'));
});
t('every protocol carries evidence, cost, weeks and risk', () => {
  for (const [id, p] of Object.entries(PROTOCOLS)) {
    assert.ok(['A', 'B', 'C'].includes(p.ev), `${id} evidence`);
    assert.ok(['free', 'low', 'mid', 'high'].includes(p.cost), `${id} cost`);
    assert.ok(Array.isArray(p.weeks) && p.weeks[0] <= p.weeks[1], `${id} weeks`);
    assert.ok(p.risk && p.steps?.length, `${id} risk/steps`);
  }
});

console.log('\nscoring & planning');
const bundle = {
  face: flat,
  skin: { underEye: { index: 9.5 }, evenness: 9.2, redness: 6.2 },
  body: { ratios: { shoulderToWaist: 1.30, waistToHip: 0.96, legToTorso: 1.2 },
          posture: { shoulderTilt: 5.5, hipTilt: 3.2, craniovertebral: 41, trunkLean: 7 } },
};
const res = scoreAll(bundle, { sex: 'm' });
t('overall score is in range', () => assert.ok(res.overall >= 0 && res.overall <= 100));
t('potential is never below the score', () => assert.ok(res.potential >= res.overall));
t('full bundle ⇒ 100% coverage', () => assert.equal(res.coverage.pct, 100));
t('SKELETAL metrics never promise headroom', () => {
  for (const m of res.metrics) if (m.mod === 'fixed' && m.available) assert.equal(m.headroom, 0, m.id);
});
t('lifestyle metrics with a gap DO have headroom', () => {
  const live = res.metrics.filter(m => m.mod === 'live' && m.available && m.score < 90);
  assert.ok(live.length && live.every(m => m.headroom > 0));
});
t('a face-only scan degrades to partial coverage', () => {
  const partial = scoreAll({ face: flat }, { sex: 'x' });
  assert.ok(partial.coverage.pct < 100 && partial.overall != null);
  assert.ok(partial.coverage.missingDomains.length > 0);
});
t('an empty bundle does not throw', () => {
  const empty = scoreAll({}, { sex: 'x' });
  assert.equal(empty.overall, null);
});
t('opportunities are ranked and bounded', () => {
  const o = rankOpportunities(res, 6);
  assert.ok(o.length <= 6);
  for (let i = 1; i < o.length; i++) assert.ok(o[i - 1].opportunity >= o[i].opportunity);
});
const { plan, daily, horizon } = buildPlan(res);
t('a plan is produced', () => assert.ok(plan.length > 0 && plan.length <= 9));
t('the daily list stays doable (≤5)', () => assert.ok(daily.length >= 3 && daily.length <= 5));
t('every daily item is a daily-habit protocol', () => daily.forEach(d => assert.ok(PROTOCOLS[d.id].daily, d.id)));
t('the plan is sorted by priority', () => {
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].priority >= plan[i].priority);
});
t('the timeline covers every plan item', () =>
  assert.equal(horizon.reduce((s, g) => s + g.items.length, 0), plan.length));
t('a high scorer still gets a daily list', () => {
  const great = scoreAll({ face: flat, skin: { underEye: { index: 1 }, evenness: 2, redness: 0.5 },
    body: { ratios: { shoulderToWaist: 1.7, waistToHip: 0.87, legToTorso: 1.2 },
            posture: { shoulderTilt: 0.5, hipTilt: 0.4, craniovertebral: 62, trunkLean: 1 } } }, { sex: 'm' });
  assert.ok(buildPlan(great).daily.length >= 3);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
