/* Measurement-engine tests. No browser, no camera — synthetic landmark sets with
   known ground truth, so a regression in the geometry is caught immediately. */

import assert from 'node:assert/strict';
import { synthFace } from './synthFace.js';
import { measureFace } from '../js/analysis/faceMetrics.js';
import { measureBody } from '../js/analysis/bodyMetrics.js';
import { rgbToLab } from '../js/analysis/skin.js';
import { scoreAll, rankOpportunities } from '../js/analysis/scoring.js';
import { buildPlan } from '../js/content/planner.js';
import { METRICS, METRIC_BY_ID, resolveBand, readValue } from '../js/content/metricsCatalog.js';
import { PROTOCOLS } from '../js/content/protocols.js';
import { deriveSelfReport, deriveContext, bundleFromResult } from '../js/content/profileMetrics.js';
import { STEPS as QSTEPS, ALL_QUESTIONS, isComplete, validate as qValidate, missingRequired } from '../js/content/questionnaire.js';
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
const ANSWERS = { age: 28, sex: 'm', height: 178, weight: 82, fitzpatrick: 2, spf: 'never', sleep: 5.5 };
const bundle = {
  face: flat,
  skin: { underEye: { index: 9.5 }, evenness: 9.2, redness: 6.2 },
  body: { ratios: { shoulderToWaist: 1.30, waistToHip: 0.96, legToTorso: 1.2 },
          posture: { shoulderTilt: 5.5, hipTilt: 3.2, craniovertebral: 41, trunkLean: 7 } },
  self: deriveSelfReport(ANSWERS),
};
const res = scoreAll(bundle, ANSWERS);
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
});
t('body-scan metrics report as locked, not merely missing', () => {
  const faceOnly = scoreAll({ face: flat, skin: bundle.skin, self: deriveSelfReport(ANSWERS) }, ANSWERS);
  assert.ok(faceOnly.coverage.unlockable > 0, 'nothing marked unlockable');
  assert.ok(faceOnly.coverage.lockedDomains.includes('יציבה'));
  // Coverage is measured against what the user was actually asked for, so a
  // face-only scan must not read as badly incomplete.
  assert.ok(faceOnly.coverage.pct >= 90, `face-only coverage was ${faceOnly.coverage.pct}%`);
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



console.log('\nquestionnaire');
t('every question declares what it affects', () =>
  ALL_QUESTIONS.forEach(q => assert.ok(q.affects?.length, `${q.id} affects nothing`)));
t('question ids are unique', () => {
  const ids = ALL_QUESTIONS.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});
t('an empty form is incomplete', () => assert.equal(isComplete({}), false));
t('the required fields alone complete it', () =>
  assert.equal(isComplete({ age: 28, sex: 'm', height: 175, weight: 72, fitzpatrick: 3, spf: 'never', sleep: 7.5 }), true));
t('out-of-range numbers are rejected', () => {
  assert.ok(qValidate(ALL_QUESTIONS.find(q => q.id === 'age'), 200));
  assert.equal(qValidate(ALL_QUESTIONS.find(q => q.id === 'age'), 28), null);
});
t('optional steps have no required fields', () =>
  QSTEPS.filter(st => !st.required).forEach(st =>
    assert.equal(missingRequired(st, {}).length, 0, st.id)));
t('the pregnancy question only shows where relevant', () => {
  const life = QSTEPS.find(st => st.id === 'life');
  assert.equal(missingRequired(life, { sex: 'm' }).includes('pregnant'), false);
});

console.log('\nprofile-derived values');
t('BMI is computed correctly', () => near(deriveSelfReport({ height: 180, weight: 81 }).bmi, 25.0, 0.1, 'bmi'));
t('waist-to-hip comes from the tape measurements', () =>
  near(deriveSelfReport({ waist: 80, hip: 100 }).waistToHip, 0.8, 0.001, 'whr'));
t('a tape measurement beats a photo estimate', () =>
  assert.equal(readValue({ self: { waistToHip: 0.75 }, body: { ratios: { waistToHip: 0.95 } } },
    METRIC_BY_ID.waistToHip.from), 0.75));
t('BMI is scored on the HEALTH band, not an aesthetic one', () => {
  const [lo, hi] = resolveBand(METRIC_BY_ID.bmi, {});
  assert.equal(lo, 18.5); assert.equal(hi, 24.9);
});
t('underweight scores WORSE than mid-range, never better', () => {
  const m = METRIC_BY_ID.bmi, [lo, hi] = resolveBand(m, {});
  assert.ok(bandScore(16, lo, hi, m.tol) < bandScore(22, lo, hi, m.tol));
  assert.ok(bandScore(16, lo, hi, m.tol) < 50, 'BMI 16 must be scored as a problem');
});
t('the skin band widens with age', () => {
  const young = resolveBand(METRIC_BY_ID.evenness, { age: 20 });
  const older = resolveBand(METRIC_BY_ID.evenness, { age: 60 });
  assert.ok(older[1] > young[1]);
});

console.log('\ncausal context');
t('full face at a NORMAL BMI reads as fluid, not fat', () => {
  const c = deriveContext({ height: 175, weight: 70 }, { face: { ratios: { facialRoundness: 0.8 } } });
  assert.ok(c.flags.includes('puffiness_not_fat'));
});
t('full face at a HIGH BMI reads as adiposity', () => {
  const c = deriveContext({ height: 175, weight: 95 }, { face: { ratios: { facialRoundness: 0.8 } } });
  assert.ok(c.flags.includes('adiposity_driven'));
});
t('dark circles despite good sleep point elsewhere', () => {
  const c = deriveContext({ sleep: 8.5 }, { skin: { underEye: { index: 8 } } });
  assert.ok(c.flags.includes('undereye_not_sleep'));
});
t('the reasons behind a plan survive a reload', () => {
  const a = { age: 29, sex: 'm', height: 178, weight: 84, fitzpatrick: 2, spf: 'never', sleep: 5.5 };
  const live = { face: flat, skin: { underEye: { index: 8.4 }, evenness: 8.8, redness: 5.1 }, self: deriveSelfReport(a) };
  const stored = JSON.parse(JSON.stringify(scoreAll(live, a)));   // what localStorage keeps
  assert.deepEqual(deriveContext(a, bundleFromResult(stored)).flags, deriveContext(a, live).flags);
});
t('the rebuilt bundle carries no landmark data', () => {
  const a = { age: 29, sex: 'm', height: 178, weight: 84, fitzpatrick: 2, spf: 'never', sleep: 5.5 };
  const stored = JSON.parse(JSON.stringify(scoreAll({ face: flat, skin: { underEye: { index: 8 }, evenness: 8 }, self: deriveSelfReport(a) }, a)));
  const json = JSON.stringify(bundleFromResult(stored));
  assert.ok(!json.includes('_pts'), 'landmarks leaked into the rebuilt bundle');
  assert.ok(json.length < 400, `rebuilt bundle unexpectedly large: ${json.length} bytes`);
});

console.log('\nsafety filters');
const mk = (a) => { const b = { face: flat, skin: bundle.skin, self: deriveSelfReport(a) };
  return buildPlan(scoreAll(b, a), b); };
t('pregnancy removes retinoids entirely', () => {
  const { plan, daily } = mk({ age: 31, sex: 'f', height: 165, weight: 60, fitzpatrick: 3, spf: 'never', sleep: 6.5, pregnant: 'yes' });
  assert.ok(!plan.some(p => p.id === 'retinoid'), 'retinoid still in plan');
  assert.ok(!daily.some(p => p.id === 'retinoid'), 'retinoid still in daily list');
});
t('an underweight user is never told to lose fat', () => {
  const { plan, daily } = mk({ age: 19, sex: 'm', height: 180, weight: 55, fitzpatrick: 2, spf: 'never', sleep: 7.5 });
  assert.ok(!plan.some(p => p.id === 'bodyfat'));
  assert.ok(!daily.some(p => p.id === 'bodyfat'));
});
t('daily SPF users are not told to start using SPF', () => {
  const { plan } = mk({ age: 30, sex: 'm', height: 175, weight: 72, fitzpatrick: 2, spf: 'daily', sleep: 7.5 });
  const spf = plan.find(p => p.id === 'spf');
  assert.ok(!spf || plan.indexOf(spf) > 3, 'SPF still ranked high for a daily user');
});
t('a stated concern always reaches the top 3', () => {
  // Body composition dominates this persona's maths, so without the promotion
  // rule a skin-focused user would see four body protocols first.
  const base = { age: 30, sex: 'm', height: 175, weight: 88, fitzpatrick: 2, spf: 'sometimes', sleep: 7.5 };
  const { plan } = mk({ ...base, concerns: ['skin'] });
  const top3 = plan.slice(0, 3).map(p => p.domain);
  assert.ok(top3.includes('skin'), `top 3 were ${top3.join(',')}`);
});
t('promotion does not drop the strongest lever', () => {
  const base = { age: 30, sex: 'm', height: 175, weight: 88, fitzpatrick: 2, spf: 'sometimes', sleep: 7.5 };
  const { plan } = mk({ ...base, concerns: ['skin'] });
  assert.equal(plan[0].id, 'bodyfat', 'the evidence-led top pick was displaced');
});
t('a concern we cannot measure is reported, not silently dropped', () => {
  const base = { age: 30, sex: 'm', height: 175, weight: 80, fitzpatrick: 2, spf: 'sometimes', sleep: 7.5 };
  const { unmeasuredConcerns } = mk({ ...base, concerns: ['posture'] });
  assert.ok(unmeasuredConcerns.includes('posture'));
});
t('no concerns ⇒ nothing reported as unmeasured', () => {
  const base = { age: 30, sex: 'm', height: 175, weight: 80, fitzpatrick: 2, spf: 'sometimes', sleep: 7.5 };
  assert.equal(mk(base).unmeasuredConcerns.length, 0);
});
t('the plan never contains a protocol filtered to zero', () =>
  mk({ age: 31, sex: 'f', height: 165, weight: 60, fitzpatrick: 3, spf: 'never', sleep: 6.5, pregnant: 'yes' })
    .plan.forEach(p => assert.ok(p.factor > 0, p.id)));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
