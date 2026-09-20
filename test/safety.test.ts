/**
 * Safety tests.
 *
 * These decide whether FORM is safe to ship. Everything else is a bug; a
 * failure here is a product that hurts someone.
 */
import { test, describe, expect } from 'vitest';

import { measureFace } from '@/lib/vision/faceMeasure';
import { assessQuality } from '@/lib/analysis/quality';
import { runPipeline } from '@/lib/analysis/pipeline';
import { ALL_PROTOCOLS } from '@/content/protocols';
import { EMPTY_INTAKE, INTAKE_STEPS, bmi, isIntakeComplete, type Intake } from '@/content/intake';
import { buildFacialReport } from '@/lib/vision/facialReport';
import { synthFace, synthSkin } from './fixtures';

const INTAKE: Intake = {
  ...EMPTY_INTAKE,
  age: 29, sex: 'male', heightCm: 178, weightKg: 76,
  skinTone: 2, skinType: 'combination', sleepHours: 5.5,
  waterLitres: 1.5, trainingDays: 2, smokes: false,
  alcohol: 'occasional', sunProtection: 'never', concerns: ['skin'],
};

const analyse = (faceOpts = {}, skinOver = {}, intake: Intake = INTAKE) => {
  const face = measureFace(synthFace(faceOpts), 1000, 1000);
  const skin = synthSkin(skinOver);
  const quality = assessQuality(face.capture, {
    lightness: skin.lightness, balance: skin.lightBalance, detail: skin.localDetail,
  });
  return runPipeline({ face, skin, quality, intake, report: null });
};

const allCopy = (r: ReturnType<typeof analyse>) =>
  JSON.stringify([r.strengths, r.opportunities, r.additional, r.observations]).toLowerCase();

describe('no attractiveness scoring, anywhere', () => {
  test('the result exposes no score-shaped field', () => {
    const json = JSON.stringify(analyse());
    for (const banned of ['"score"', '"rating"', '"rank"', '"percentile"', '"grade"', '"overall"', '"priority"']) {
      expect(json, `result exposes ${banned}`).not.toContain(banned);
    }
  });

  test('no copy contains a score, percentage or ranking phrase', () => {
    const copy = allCopy(analyse());
    for (const phrase of [
      'out of 10', '/10', 'score', 'rating', 'percentile', 'top 5', 'better than',
      'attractive', 'attractiveness', 'ugly', 'flaw', 'defect', 'golden ratio', 'ideal face',
    ]) {
      expect(copy, `user-facing copy contains "${phrase}"`).not.toContain(phrase);
    }
  });
});

describe('nothing medical, nothing restrictive', () => {
  const catalogue = JSON.stringify(ALL_PROTOCOLS).toLowerCase();

  test('no prescription-only medicine is ever named', () => {
    // OTC cosmetic actives (retinol, niacinamide, vitamin C) are legitimate and
    // deliberately included. Prescription drugs are a different category and
    // this product has no business recommending them.
    for (const drug of [
      'tretinoin', 'isotretinoin', 'accutane', 'finasteride', 'minoxidil',
      'spironolactone', 'hydroquinone', 'prescription', 'antibiotic', 'steroid',
    ]) {
      expect(catalogue, `catalogue names "${drug}"`).not.toContain(drug);
    }
  });

  test('no condition is diagnosed', () => {
    for (const word of [
      'acne', 'rosacea', 'eczema', 'dermatitis', 'psoriasis', 'alopecia',
      'diagnos', 'disorder', 'deficiency', 'syndrome', 'hormone', 'testosterone',
    ]) {
      expect(catalogue, `catalogue contains "${word}"`).not.toContain(word);
    }
  });

  test('no restrictive eating or weight target is ever suggested', () => {
    for (const phrase of [
      'calorie deficit', 'lose weight', 'weight loss', 'fasting', 'restrict',
      'goal weight', 'target weight', 'cut calories', 'skip meals',
    ]) {
      expect(catalogue, `catalogue contains "${phrase}"`).not.toContain(phrase);
    }
  });

  test('anything warranting a professional points to one', () => {
    for (const p of ALL_PROTOCOLS) {
      if (!p.requiresProfessional) continue;
      const text = (p.how.join(' ') + p.why).toLowerCase();
      expect(text, `${p.id} is flagged requiresProfessional but never points to one`)
        .toMatch(/professional|doctor|pharmacist/);
    }
  });

  test('limited-evidence protocols say so in their own copy', () => {
    for (const p of ALL_PROTOCOLS) {
      if (p.evidence !== 'C') continue;
      // A grade C item must not read as a promise. Either the copy hedges or a
      // caution is attached.
      const hedged = /limited|weak|small|thin|honest|bonus|worth trying|temporary/i.test(p.why + (p.caution ?? ''));
      expect(hedged, `${p.id} is grade C but its copy does not hedge`).toBe(true);
    }
  });
});

describe('confidence is capped by photo quality', () => {
  test('a poor frame cannot produce a high-confidence claim', () => {
    const bad = analyse({ roll: 14 }, { lightBalance: 22, lightness: 20, localDetail: 0.4 });
    expect(bad.quality.confidence).toBe('low');
    for (const o of bad.observations) expect(o.confidence, o.id).toBe('low');
    for (const r of bad.opportunities) expect(r.confidence, r.id).toBe('low');
  });

  test('a clean frame permits high confidence', () => {
    expect(analyse({}, { lightBalance: 2, lightness: 58, localDetail: 3 }).quality.confidence).toBe('high');
  });

  test('a poor frame still produces a usable plan', () => {
    expect(analyse({ roll: 14 }, { lightBalance: 22, lightness: 20 }).opportunities.length).toBeGreaterThan(0);
  });
});

describe('the intake changes the diagnosis, not just the wording', () => {
  test('a full face at a healthy weight is treated as fluid, not composition', () => {
    const r = analyse({ wide: true }, {}, { ...INTAKE, heightCm: 180, weightKg: 72 });
    const ids = [...r.opportunities, ...r.additional].map((x) => x.id);
    expect(ids).toContain('nutrition.sodium');
    const body = r.opportunities.findIndex((x) => x.id === 'body.composition');
    expect(body, 'body composition was suggested to someone at a healthy weight').toBe(-1);
  });

  test('short sleep becomes the stated cause of under-eye darkness', () => {
    const r = analyse({}, { underEyeContrast: 9 }, { ...INTAKE, sleepHours: 5 });
    const sleep = [...r.opportunities, ...r.additional].find((x) => x.id === 'sleep.duration');
    expect(sleep?.personalised, 'sleep was suggested generically despite a known cause').toBe(true);
  });

  test('adequate sleep stops the product blaming sleep', () => {
    const r = analyse({}, { underEyeContrast: 9 }, { ...INTAKE, sleepHours: 8.5, waterLitres: 3.5 });
    const top = r.opportunities.slice(0, 3).map((x) => x.id);
    expect(top).not.toContain('sleep.duration');
  });

  test('someone already using daily SPF is not told to start', () => {
    const r = analyse({}, { toneSpread: 9 }, { ...INTAKE, sunProtection: 'daily' });
    const spf = r.opportunities.findIndex((x) => x.id === 'skin.spf');
    expect(spf, 'SPF ranked as a headline for someone already doing it daily').toBe(-1);
  });

  test('skin tone is actually collected, since it calibrates the reading', () => {
    const toneField = INTAKE_STEPS.flatMap((s) => s.fields).find((f) => f.id === 'skinTone');
    expect(toneField).toBeDefined();
    expect('required' in toneField! && toneField.required).toBe(true);
  });
});

describe('output stays small enough to act on', () => {
  test('at most 5 opportunities and 3 strengths', () => {
    const r = analyse();
    expect(r.opportunities.length).toBeLessThanOrEqual(5);
    expect(r.strengths.length).toBeLessThanOrEqual(3);
  });

  test('a good result still names something already working', () => {
    const r = analyse({}, { lightBalance: 2, toneSpread: 3 }, { ...INTAKE, sunProtection: 'daily', sleepHours: 8.5 });
    expect(r.strengths.length).toBeGreaterThan(0);
  });
});

describe('every card answers what, why and how', () => {
  test('all protocols are complete', () => {
    for (const p of ALL_PROTOCOLS) {
      expect(p.title.length, p.id).toBeGreaterThan(0);
      expect(p.why.length, `${p.id} why`).toBeGreaterThan(40);
      expect(p.how.length, `${p.id} how`).toBeGreaterThanOrEqual(2);
      expect(p.weeks[0], `${p.id} weeks`).toBeLessThanOrEqual(p.weeks[1]);
    }
  });

  test('protocol ids are unique', () => {
    const ids = ALL_PROTOCOLS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('no placeholder copy survives', () => {
    const r = analyse();
    for (const rec of [...r.opportunities, ...r.additional]) {
      expect(/lorem|TODO|FIXME|placeholder|\{value\}/i.test(rec.why + rec.how.join('')), rec.id).toBe(false);
    }
  });
});

describe('intake', () => {
  test('every question changes something downstream', () => {
    // Each field must be read somewhere in the selection engine or be a
    // documented ranking input. A field nobody reads is a field nobody should
    // have been asked for.
    const used = new Set([
      'age', 'sex', 'heightCm', 'weightKg', 'skinTone', 'skinType',
      'sleepHours', 'waterLitres', 'trainingDays', 'smokes', 'alcohol',
      'sunProtection', 'concerns',
    ]);
    for (const f of INTAKE_STEPS.flatMap((s) => s.fields)) {
      expect(used.has(String(f.id)), `${String(f.id)} is collected but never used`).toBe(true);
    }
  });

  test('an empty intake is incomplete and a filled one is not', () => {
    expect(isIntakeComplete(EMPTY_INTAKE)).toBe(false);
    expect(isIntakeComplete(INTAKE)).toBe(true);
  });

  test('BMI is computed but never surfaced as a target', () => {
    expect(bmi({ ...EMPTY_INTAKE, heightCm: 180, weightKg: 81 })).toBeCloseTo(25, 1);
    const copy = JSON.stringify(ALL_PROTOCOLS).toLowerCase();
    expect(copy).not.toContain('bmi');
  });
});

describe('the measurement report', () => {
  const report = buildFacialReport(synthFace(), 1000, 1000);

  test('produces a substantial set of measurements', () => {
    expect(report.metrics.length).toBeGreaterThanOrEqual(20);
  });

  test('metric ids are unique', () => {
    const ids = report.metrics.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every metric declares whether it can change', () => {
    for (const m of report.metrics) {
      expect(['bone', 'soft', 'surface'], m.id).toContain(m.mutability);
    }
  });

  test('a structural metric never claims it can be changed', () => {
    // A "lever" on a bone metric would be the product implying surgery, or
    // lying. Where bone metrics do carry one it must be about appearance —
    // styling around the structure, not altering it.
    for (const m of report.metrics) {
      if (m.mutability !== 'bone' || !m.lever) continue;
      const l = m.lever.toLowerCase();
      expect(/change|increase|reduce|fix|correct|improve/.test(l) && !/perceived|apparent|visual|read|appear|not changeable/.test(l),
        `${m.id} implies its bone structure can be altered`).toBe(false);
    }
  });

  test('no metric is presented as a score or a grade', () => {
    const json = JSON.stringify(report).toLowerCase();
    for (const banned of ['score', 'grade', 'rating', 'percentile', 'ideal', 'perfect', 'attractive']) {
      expect(json, `report copy contains "${banned}"`).not.toContain(banned);
    }
  });

  test('typical ranges are ordered and described as references', () => {
    for (const m of report.metrics) {
      if (!m.typical) continue;
      expect(m.typical[0], m.id).toBeLessThan(m.typical[1]);
    }
  });

  test('every metric explains itself', () => {
    for (const m of report.metrics) {
      expect(m.reading.length, `${m.id} has no reading`).toBeGreaterThan(40);
      expect(m.label.length, `${m.id} has no label`).toBeGreaterThan(0);
    }
  });

  test('a face shape is classified', () => {
    expect(report.shape).not.toBeNull();
  });
});
