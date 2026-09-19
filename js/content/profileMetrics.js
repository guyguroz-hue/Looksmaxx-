/* Turns questionnaire answers into measurable values and into causal context.
 *
 * This is what lets the initial scan be face-only: height and weight carry most
 * of what a body photo was being asked to infer, and a tape measure beats a
 * selfie at waist-to-hip anyway. */

import { round } from '../analysis/geometry.js';

/** Metric values derived from the answers, merged into the scoring bundle. */
export function deriveSelfReport(a = {}) {
  const out = {};

  if (a.height > 0 && a.weight > 0) {
    const m = a.height / 100;
    out.bmi = round(a.weight / (m * m), 1);
  }
  if (a.waist > 0 && a.hip > 0) out.waistToHip = round(a.waist / a.hip, 3);
  if (a.sleep != null) out.sleepHours = Number(a.sleep);

  return out;
}

/**
 * Causal context — not scored, but it changes what the app *says*.
 *
 * The headline case: high facial fullness at a normal BMI is not a fat problem.
 * Telling that person to cut calories is both useless and harmful; the real
 * suspects are sodium, alcohol, sleep and fluid retention. The camera cannot
 * tell those apart. The questionnaire can.
 */
export function deriveContext(answers = {}, bundle = {}) {
  const a = answers;
  const self = deriveSelfReport(a);
  const ctx = { flags: [], notes: [] };

  const roundness = bundle?.face?.ratios?.facialRoundness;
  const bmi = self.bmi;

  if (roundness != null && bmi != null) {
    const fullFace = roundness > 0.76;
    if (fullFace && bmi < 25) {
      ctx.flags.push('puffiness_not_fat');
      ctx.notes.push('מלאות הפנים גבוהה למרות BMI תקין — הסיבה הסבירה היא אגירת נוזלים (נתרן, אלכוהול, שינה), לא שומן. הפחתת קלוריות לא תעזור כאן.');
    } else if (fullFace && bmi >= 27) {
      ctx.flags.push('adiposity_driven');
      ctx.notes.push('מלאות הפנים עולה בקנה אחד עם הרכב הגוף — הפחתת שומן הדרגתית היא המנוף המרכזי.');
    }
  }

  const underEye = bundle?.skin?.underEye?.index;
  if (underEye != null && underEye > 4.5) {
    if (a.sleep != null && a.sleep < 7) {
      ctx.flags.push('undereye_sleep');
      ctx.notes.push('העיגולים בולטים ואתה ישן פחות מ-7 שעות. זו הסיבה הראשונה לבדוק, והיא גם המהירה ביותר לתיקון.');
    } else if (a.sleep != null && a.sleep >= 7.5) {
      ctx.flags.push('undereye_not_sleep');
      ctx.notes.push('העיגולים בולטים למרות שינה מספקת — כדאי לבדוק אלרגיות, נוזלים או נטייה גנטית, לא עוד שעות שינה.');
    }
  }

  const evenness = bundle?.skin?.evenness;
  if (evenness != null && evenness > 6.5 && a.spf === 'never') {
    ctx.flags.push('sun_damage_untreated');
    ctx.notes.push('אחידות הגוון נמוכה ואינך משתמש בקרם הגנה. זה המנוף עם הראיות החזקות ביותר בכל הרשימה.');
  }
  if (a.spf === 'daily') ctx.flags.push('spf_already');

  if (a.smoking === 'yes') {
    ctx.flags.push('smoker');
    ctx.notes.push('עישון מאיץ את הזדקנות העור ומצמצם זרימת דם לעור — הוא פועל נגד כל שאר הפרוטוקולים כאן.');
  }
  if (a.alcohol === 'often') ctx.flags.push('alcohol_high');
  if (a.pregnant === 'yes') ctx.flags.push('pregnant');
  if (a.activity === 'none') ctx.flags.push('sedentary');
  if (a.activity === 'moderate' || a.activity === 'high') ctx.flags.push('trains_already');
  if (a.age >= 40) ctx.flags.push('age_40_plus');
  if (bmi != null && bmi < 18.5) {
    ctx.flags.push('underweight');
    ctx.notes.push('ה-BMI מתחת לטווח הבריא. האפליקציה לא תמליץ על הפחתת שומן במצב הזה — כדאי להתייעץ עם איש מקצוע.');
  }

  ctx.self = self;
  ctx.concerns = a.concerns ?? [];
  return ctx;
}

/* Metric id → where deriveContext expects to read it in a bundle. */
const CONTEXT_PATHS = {
  facialRoundness: ['face', 'ratios', 'facialRoundness'],
  underEye:        ['skin', 'underEye', 'index'],
  evenness:        ['skin', 'evenness'],
  redness:         ['skin', 'redness'],
};

/**
 * Rebuild the few values deriveContext needs from a stored result.
 *
 * The raw bundle lives only in page memory — by design, since it holds the
 * landmarks. But the *reasons* behind a plan have to survive a reload, or the
 * user loses the most useful thing the questionnaire bought them the moment
 * they close the tab. The stored result keeps id/value pairs, which is enough.
 */
export function bundleFromResult(result) {
  const out = {};
  for (const m of result?.metrics ?? []) {
    const path = CONTEXT_PATHS[m.id];
    if (!path || m.value == null) continue;
    let node = out;
    for (const key of path.slice(0, -1)) node = (node[key] ??= {});
    node[path[path.length - 1]] = m.value;
  }
  return out;
}
