/**
 * Safety tests.
 *
 * These are the tests that decide whether FORM is safe to ship. Everything else
 * is a bug; a failure here is a product that hurts someone.
 */
import { test, describe } from 'vitest';
import assert from 'node:assert/strict';

import { measureFace } from '@/lib/vision/faceMeasure';
import { assessQuality } from '@/lib/analysis/quality';
import { runPipeline } from '@/lib/analysis/pipeline';
import { RULES, STRENGTH_RULES } from '@/content/rules';
import { DEFAULT_PREFERENCES } from '@/lib/analysis/types';
import { synthFace, synthSkin } from './fixtures';

const analyse = (faceOpts = {}, skinOver = {}, prefs = DEFAULT_PREFERENCES) => {
  const face = measureFace(synthFace(faceOpts), 1000, 1000);
  const skin = synthSkin(skinOver);
  return runPipeline({ face, skin, quality: assessQuality(face.capture, {
    lightness: skin.lightness, balance: skin.lightBalance, detail: skin.localDetail,
  }), preferences: prefs });
};

/** Every string a user could ever read, from one analysis. */
function allCopy(r: ReturnType<typeof analyse>): string {
  return JSON.stringify([
    r.strengths, r.opportunities, r.additional, r.observations, r.inferences,
  ]);
}

describe('§9 — no attractiveness scoring, anywhere', () => {
  test('the result object contains no score-shaped field', () => {
    const r = analyse();
    const json = JSON.stringify(r);
    for (const banned of ['"score"', '"rating"', '"rank"', '"percentile"', '"grade"', '"overall"', '"attractiveness"']) {
      assert.ok(!json.includes(banned), `result exposes ${banned}`);
    }
  });

  test('no copy contains a score, percentage or ranking phrase', () => {
    const copy = allCopy(analyse()).toLowerCase();
    const banned = [
      'out of 10', '/10', 'score', 'rating', 'rank', 'percentile', 'top 5', 'better than',
      'attractive', 'attractiveness', 'ugly', 'flaw', 'defect', 'golden ratio', 'ideal face',
    ];
    for (const phrase of banned) {
      assert.ok(!copy.includes(phrase), `user-facing copy contains "${phrase}"`);
    }
  });

  test('the priority figure is never exported on a recommendation', () => {
    const r = analyse();
    for (const rec of [...r.opportunities, ...r.additional]) {
      assert.ok(!('priority' in rec), 'priority leaked to the UI');
      assert.ok(!('weight' in rec), 'weight leaked to the UI');
    }
  });
});

describe('§3 — no medical claims', () => {
  test('no rule copy names a condition or a drug', () => {
    const copy = JSON.stringify([RULES, STRENGTH_RULES]).toLowerCase();
    const banned = [
      'acne', 'rosacea', 'eczema', 'dermatitis', 'psoriasis', 'alopecia', 'diagnos',
      'minoxidil', 'finasteride', 'retinoid', 'tretinoin', 'accutane', 'prescription',
      'disorder', 'deficiency', 'syndrome', 'hormone', 'testosterone', 'bmi', 'calorie',
      'diet', 'lose weight', 'fasting',
    ];
    for (const word of banned) {
      assert.ok(!copy.includes(word), `rule copy contains "${word}"`);
    }
  });

  test('anything that could need a professional says so neutrally', () => {
    for (const rule of RULES) {
      if (!rule.requiresProfessional) continue;
      const how = rule.how.join(' ').toLowerCase();
      assert.ok(
        how.includes('professional'),
        `${rule.id} is flagged requiresProfessional but never points to one`,
      );
    }
  });
});

describe('§5 — confidence is capped by photo quality', () => {
  test('a poor frame cannot produce a high-confidence claim', () => {
    // Side-lit, dark, turned and tilted: every gate fails.
    const bad = analyse({ roll: 14 }, { lightBalance: 22, lightness: 20, localDetail: 0.4 });
    assert.equal(bad.quality.confidence, 'low');
    for (const o of bad.observations) {
      assert.equal(o.confidence, 'low', `${o.id} claims ${o.confidence} from a low-quality frame`);
    }
    for (const rec of bad.opportunities) {
      assert.equal(rec.confidence, 'low');
    }
  });

  test('a clean frame permits high confidence', () => {
    const good = analyse({}, { lightBalance: 2, lightness: 58, localDetail: 3 });
    assert.equal(good.quality.confidence, 'high');
  });

  test('quality never silently discards the analysis', () => {
    const bad = analyse({ roll: 14 }, { lightBalance: 22, lightness: 20, localDetail: 0.4 });
    assert.ok(bad.opportunities.length > 0, 'a low-quality photo produced nothing at all');
  });
});

describe('§33 — observed / inferred / recommended stay separate', () => {
  test('every inference traces back to a real observation', () => {
    const r = analyse();
    const ids = new Set(r.observations.map((o) => o.id));
    for (const inf of r.inferences) {
      assert.ok(ids.has(inf.observationId), `inference cites unknown observation ${inf.observationId}`);
    }
  });

  test('every recommendation traces back to an observation', () => {
    const r = analyse();
    const ids = new Set(r.observations.map((o) => o.id));
    for (const rec of [...r.opportunities, ...r.additional]) {
      assert.ok(rec.observationIds.length > 0, `${rec.id} has no evidence`);
      for (const id of rec.observationIds) {
        assert.ok(ids.has(id), `${rec.id} cites unknown observation ${id}`);
      }
    }
  });

  test('observations carry the measurement that produced them', () => {
    for (const o of analyse().observations) {
      assert.ok(o.evidence.metric.length > 0);
      assert.ok(Number.isFinite(o.evidence.value));
    }
  });
});

describe('§8 — output stays small enough to act on', () => {
  test('at most 5 opportunities and 3 strengths', () => {
    const r = analyse();
    assert.ok(r.opportunities.length <= 5, `${r.opportunities.length} opportunities`);
    assert.ok(r.strengths.length <= 3, `${r.strengths.length} strengths`);
  });

  test('a clean capture still surfaces something that already works', () => {
    const r = analyse({}, { lightBalance: 2, lightness: 58 });
    assert.ok(r.strengths.length > 0, 'nothing was named as working');
  });
});

describe('§52 — every card answers what, why and how', () => {
  test('all rules are complete', () => {
    for (const rule of RULES) {
      assert.ok(rule.title.length > 0, `${rule.id} has no title`);
      assert.ok(rule.why.length > 20, `${rule.id} has no why`);
      assert.ok(rule.how.length >= 2, `${rule.id} has fewer than two how-steps`);
      assert.ok(rule.observed(1).length > 0, `${rule.id} has no observation copy`);
      assert.ok(rule.inferred.length > 20, `${rule.id} has no inference copy`);
    }
  });

  test('no placeholder survived into the copy', () => {
    const r = analyse();
    for (const rec of [...r.opportunities, ...r.additional]) {
      assert.ok(!rec.why.includes('{value}'), `${rec.id} shipped an uninterpolated placeholder`);
      assert.ok(!/lorem|TODO|FIXME|placeholder/i.test(rec.why + rec.how.join('')), `${rec.id} contains placeholder copy`);
    }
  });

  test('rule ids are unique', () => {
    const ids = RULES.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('§17 — stated goals change the order, not the findings', () => {
  test('a goal promotes its category', () => {
    const neutral = analyse({}, {}, DEFAULT_PREFERENCES);
    const hairFirst = analyse({ }, {}, { ...DEFAULT_PREFERENCES, goals: ['hair'] });
    assert.deepEqual(
      neutral.observations.map((o) => o.id).sort(),
      hairFirst.observations.map((o) => o.id).sort(),
      'stating a goal changed what was observed — it must only change ordering',
    );
  });
});
