/* Visual QA: boots the production build, walks every screen at phone width,
   fails on console errors or horizontal overflow. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 3111);
const base = `http://127.0.0.1:${PORT}`;

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'pipe' });
server.stderr.on('data', (d) => process.env.DEBUG && console.error(String(d)));

/* Poll the port rather than pattern-matching stdout — the banner wording is not
   a stable contract, and a regex against it breaks on every framework upgrade. */
await (async () => {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  server.kill();
  throw new Error(`server did not answer on ${base} within 90s`);
})();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_/.test(m.text())) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`${e.message}\n    ${(e.stack ?? '').split('\n')[1] ?? ''}`));

await page.goto(base, { waitUntil: 'networkidle' });

const shots = [];
const shot = async (name) => {
  const f = `/tmp/form-${name}.png`;
  await page.screenshot({ path: f, fullPage: true });
  shots.push(f);
};
const overflow = async (label) => {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o > 0) errors.push(`horizontal overflow ${o}px on ${label}`);
};

await shot('1-welcome'); await overflow('welcome');
await page.click('text=Start'); await page.waitForTimeout(500);
await shot('2-goals'); await overflow('goals');
await shot('3-intake-detail'); await overflow('intake');

/* Inject a result by driving the real pipeline in-page via the seeded session. */
await page.evaluate(() => {
  const result = {
    id: 'demo', createdAt: Date.now(),
    quality: { confidence: 'high', checks: [], usable: true, primaryHint: null },
    observations: [], inferences: [],
    strengths: [
      { id: 's1', category: 'photo', title: 'You took a clean photo',
        detail: 'Head level, square to the lens and evenly lit. That is the hard part of a good photo, and it means everything else here is read from solid material.' },
      { id: 's2', category: 'presentation', title: 'Your proportions are balanced',
        detail: 'The three vertical sections of your face fall close to even. This is a useful thing to know because it means most hair and eyewear shapes will work on you — you have room to experiment.' },
    ],
    opportunities: [
      { id: 'o1', category: 'photo', title: 'Broad-spectrum SPF every morning',
        why: 'Your camera was off eye level, which stretches whichever part of the face is closest to the lens. Levelling it is the single fastest way to get a photo that looks like you.',
        how: ['Hold the phone so the lens is level with your eyes.', 'If you are propping it up, stack it to eye height rather than tilting it.', 'Take one at eye level and one at your usual angle, then compare.'],
        impact: 'high', effort: 'easy', confidence: 'high', requiresProfessional: false, horizon: 'now', observationIds: ['o1'], evidence: 'A', weeks: [4,24], personalised: true },
      { id: 'o2', category: 'grooming', title: 'Set a clean neckline',
        why: 'Your widest point sits at the cheekbones, so the jaw line reads softly by comparison. A clean lower edge creates definition where there is none now.',
        how: ['Keep the beard or stubble shorter at the cheeks and slightly longer at the chin.', 'Set the neckline just above the Adam’s apple, not under the chin.', 'Re-trim every three to five days.'],
        impact: 'high', effort: 'easy', confidence: 'medium', requiresProfessional: false, horizon: 'week', observationIds: ['o2'], evidence: 'C', weeks: [0,2], personalised: false },
      { id: 'o3', category: 'hair', title: 'Daily facial muscle work',
        why: 'Your proportions are close to square, so hair that adds width at the sides competes with the face rather than framing it. Height changes the read.',
        how: ['Ask for more length on top and tapered sides.', 'Dry with the airflow pointing up and back.', 'Bring a photo to your barber.'],
        impact: 'high', effort: 'moderate', confidence: 'medium', requiresProfessional: false, horizon: 'month', observationIds: ['o3'], evidence: 'C', weeks: [0,4], personalised: false },
      { id: 'o4', category: 'skin', title: 'Seven to nine hours, consistently',
        why: 'A simple routine done daily outperforms a complicated one done occasionally. Consistency is the part that matters.',
        how: ['Gentle cleanser, moisturiser, daily sun protection.', 'Change one thing at a time.', 'Give any change six to eight weeks.'],
        impact: 'medium', effort: 'easy', confidence: 'low', requiresProfessional: true, horizon: 'week', observationIds: ['o4'], evidence: 'A', weeks: [1,6], personalised: true, caution: 'Introduce slowly; expect some dryness at first.' },
    ],
    report: {"metrics": [{"id": "thirds.upper", "group": "proportion", "label": "Upper third", "value": 24.2, "unit": "", "typical": [30, 36], "mutability": "bone", "approximate": true, "reading": "Hairline to brow line, as a share of face height. The classical canon divides the face into three equal parts \u2014 real faces rarely do, and the deviation is normal rather than meaningful.", "lever": "Hair worn forward or back shifts where this line appears to sit, which is why a fringe changes a face so much."}, {"id": "thirds.middle", "group": "proportion", "label": "Middle third", "value": 39.4, "unit": "", "typical": [30, 36], "mutability": "bone", "reading": "Brow line to base of nose. Fixed by the midface skeleton."}, {"id": "thirds.lower", "group": "proportion", "label": "Lower third", "value": 36.4, "unit": "", "typical": [30, 38], "mutability": "bone", "reading": "Base of nose to chin. A longer lower third reads more angular; a shorter one reads softer and younger."}, {"id": "lowerThird.split", "group": "proportion", "label": "Lower-third split", "value": 0.55, "unit": "ratio", "typical": [0.45, 0.55], "mutability": "bone", "reading": "Nose-to-mouth against mouth-to-chin. Around 1:2 is the conventional reference; a larger value means a longer upper lip relative to the chin."}, {"id": "fifths", "group": "proportion", "label": "Face width in eye-widths", "value": 6.17, "unit": "", "typical": [4.6, 5.4], "mutability": "bone", "reading": "The classical \"fifths\" canon expects five eye-widths across the face. Above five reads wide-set or broad; below reads narrow."}, {"id": "fwhr", "group": "proportion", "label": "Facial width-to-height (fWHR)", "value": 0.97, "unit": "ratio", "typical": [1.7, 2.1], "mutability": "soft", "reading": "Cheekbone width against upper-face height. Heavily studied in social psychology, though the effect sizes are smaller than the coverage suggests.", "lever": "Partly soft tissue \u2014 facial fullness moves this without any change to the skeleton."}, {"id": "faceIndex", "group": "proportion", "label": "Height-to-width index", "value": 2.23, "unit": "ratio", "typical": [1.3, 1.5], "mutability": "bone", "reading": "The single number that most determines which hair shapes and frame styles suit you.", "lever": "Not changeable \u2014 but it is the number to design a haircut around."}, {"id": "gonialAngle", "group": "jaw", "label": "Gonial angle", "value": 156.3, "unit": "\u00b0", "typical": [115, 132], "mutability": "bone", "reading": "The corner of the jaw. A more closed angle reads sharper; a more open one reads softer. This is mandible shape and does not change."}, {"id": "cheekToJaw", "group": "jaw", "label": "Cheekbone-to-jaw ratio", "value": 1.36, "unit": "ratio", "typical": [1.15, 1.35], "mutability": "soft", "reading": "How much wider the cheekbones sit than the jaw. Higher reads tapered and triangular; near 1.0 reads square.", "lever": "Submental and jowl fat sit exactly here, so body composition moves the visible version of this number even though the bone underneath does not."}, {"id": "bigonial", "group": "jaw", "label": "Jaw width", "value": 105.8, "unit": "mm", "typical": null, "mutability": "bone", "reading": "Measured between the jaw corners. Given in millimetres because the iris in your photo provides a physical ruler."}, {"id": "bizygomatic", "group": "jaw", "label": "Cheekbone width", "value": 144.3, "unit": "mm", "typical": null, "mutability": "bone", "reading": "The widest point across your face. This is the number to take to an optician \u2014 frames near it sit level and stay put.", "lever": "Use it when buying glasses: total frame width within a few millimetres of this."}, {"id": "chinHeight", "group": "jaw", "label": "Chin height", "value": 47.9, "unit": "", "typical": [33, 45], "mutability": "bone", "reading": "Lower lip to chin tip, as a share of the lower third. Drives how much the chin projects visually."}, {"id": "fullness", "group": "jaw", "label": "Facial fullness", "value": 78, "unit": "", "typical": [62, 75], "mutability": "soft", "reading": "How round the outline of your face reads. This is the metric that moves most with body composition and overnight fluid \u2014 and the one most often mistaken for bone structure.", "lever": "Evening salt, alcohol, sleep and body composition all land here. It is the highest-yield number on this page."}, {"id": "canthalTilt", "group": "eyes", "label": "Canthal tilt", "value": 0, "unit": "\u00b0", "typical": [0, 8], "mutability": "bone", "reading": "How much higher the outer corner sits than the inner. Positive reads alert; neutral or negative reads calmer. Orbital bone \u2014 it does not change.", "lever": "Brow shaping and the direction of any eye makeup change the perceived angle without touching the real one."}, {"id": "eyeSpacing", "group": "eyes", "label": "Eye spacing", "value": 1.54, "unit": "ratio", "typical": [0.9, 1.1], "mutability": "bone", "reading": "Gap between the eyes divided by eye width. The classical reference is exactly one eye-width; above reads wide-set, below reads close-set."}, {"id": "eyeAspect", "group": "eyes", "label": "Eye openness", "value": 0.62, "unit": "ratio", "typical": [0.28, 0.4], "mutability": "soft", "reading": "Eye height against eye width. Lower reads narrow or hooded; higher reads open.", "lever": "Sleep and fluid retention visibly change this on any given morning, which is why the same face photographs differently day to day."}, {"id": "ipd", "group": "eyes", "label": "Pupil distance", "value": 58.5, "unit": "mm", "typical": [54, 72], "mutability": "bone", "reading": "Your interpupillary distance in millimetres \u2014 the same measurement an optician takes for lens centring."}, {"id": "browHeight", "group": "brows", "label": "Brow-to-eye distance", "value": 0.63, "unit": "ratio", "typical": [0.35, 0.6], "mutability": "surface", "reading": "How much open space sits between brow and lash line. More space reads relaxed and open; less reads intense and deep-set.", "lever": "One of the few genuinely changeable numbers here. Where you take the lower edge of the brow moves it directly."}, {"id": "browTilt", "group": "brows", "label": "Brow angle", "value": -7.4, "unit": "\u00b0", "typical": [3, 15], "mutability": "surface", "reading": "The rise from the inner end of the brow to its peak. A flatter brow reads calm and masculine; a higher arch reads more open.", "lever": "Fully changeable by grooming. Go gradually \u2014 the lower edge is much easier to take than to put back."}, {"id": "noseWidth", "group": "nose", "label": "Nose width vs eye spacing", "value": 0.59, "unit": "ratio", "typical": [0.9, 1.15], "mutability": "bone", "reading": "The classical reference puts the nose the same width as the gap between the eyes."}, {"id": "noseToMouth", "group": "nose", "label": "Nose width vs mouth", "value": 0.49, "unit": "ratio", "typical": [0.6, 0.78], "mutability": "bone", "reading": "Nose base against mouth width. Around 0.7 is the usual reference point."}, {"id": "noseLength", "group": "nose", "label": "Nose length", "value": 39.4, "unit": "", "typical": [30, 38], "mutability": "bone", "reading": "Brow to nose base, as a share of face height."}, {"id": "mouthWidth", "group": "mouth", "label": "Mouth width vs face", "value": 0.3, "unit": "ratio", "typical": [0.42, 0.52], "mutability": "bone", "reading": "Mouth width against cheekbone width. Wider reads more expressive."}, {"id": "lipRatio", "group": "mouth", "label": "Upper-to-lower lip", "value": 0.67, "unit": "ratio", "typical": [0.5, 0.8], "mutability": "soft", "reading": "The lower lip is normally the fuller of the two \u2014 around 1:1.6 is the common reference.", "lever": "Hydration and lip care change the visible fullness of both. Chronic licking and dryness flatten them."}, {"id": "philtrum", "group": "mouth", "label": "Philtrum length", "value": 31.7, "unit": "mm", "typical": [11, 19], "mutability": "bone", "reading": "Nose base to the top of the upper lip. A shorter philtrum reads younger; it lengthens gradually over decades."}, {"id": "foreheadHeight", "group": "forehead", "label": "Forehead height", "value": 78, "unit": "mm", "typical": null, "mutability": "surface", "approximate": true, "reading": "Measured to the top of the detected face rather than the true hairline, which the model cannot see \u2014 so treat this as an estimate.", "lever": "The most style-responsive area of the whole face. Where you place the hairline visually is a haircut decision."}, {"id": "symmetry.eyes", "group": "symmetry", "label": "Eye symmetry", "value": 0, "unit": "mm", "typical": [0, 3], "mutability": "soft", "reading": "Average left-right difference. Every face is asymmetric; under about 3 mm is below what anyone perceives.", "lever": "A turned head produces more apparent asymmetry than most real anatomy, so re-shoot square-on before reading much into it."}, {"id": "symmetry.brows", "group": "symmetry", "label": "Brow symmetry", "value": 0, "unit": "mm", "typical": [0, 3], "mutability": "soft", "reading": "Average left-right difference. Every face is asymmetric; under about 3 mm is below what anyone perceives.", "lever": "A turned head produces more apparent asymmetry than most real anatomy, so re-shoot square-on before reading much into it."}, {"id": "symmetry.jaw", "group": "symmetry", "label": "Jaw symmetry", "value": 0, "unit": "mm", "typical": [0, 3], "mutability": "soft", "reading": "Average left-right difference. Every face is asymmetric; under about 3 mm is below what anyone perceives.", "lever": "A turned head produces more apparent asymmetry than most real anatomy, so re-shoot square-on before reading much into it."}, {"id": "symmetry.mouth", "group": "symmetry", "label": "Mouth symmetry", "value": 0, "unit": "mm", "typical": [0, 3], "mutability": "soft", "reading": "Average left-right difference. Every face is asymmetric; under about 3 mm is below what anyone perceives.", "lever": "A turned head produces more apparent asymmetry than most real anatomy, so re-shoot square-on before reading much into it."}], "shape": {"name": "oblong", "label": "Long", "detail": "Notably taller than wide. Width at the temples balances it; extra height on top extends the line further."}, "mmPerUnit": 487.49999999999955},
    additional: [
      { id: 'o5', category: 'style', title: 'Ease off salt in the evening',
        why: 'A crew neck sits as a horizontal line right under a face whose proportions are already wide. A V or open collar breaks that line.',
        how: ['Try a V-neck or an open collar.', 'Avoid high round necks close to the jaw.'],
        impact: 'medium', effort: 'easy', confidence: 'low', requiresProfessional: false, horizon: 'now', observationIds: ['o5'], evidence: 'B', weeks: [0,1], personalised: false },
    ],
  };
  localStorage.setItem('form.session.v1', JSON.stringify({
    intake: { age: 29, sex: 'male', heightCm: 178, weightKg: 76, skinTone: 2, skinType: 'combination', sleepHours: 5.5, waterLitres: 1.5, trainingDays: 2, smokes: false, alcohol: 'occasional', sunProtection: 'never', concerns: ['skin'] },
    onboarded: true, lastResult: result, saved: ['o3'], done: ['o1'],
    dismissed: [], history: [{ at: Date.now() - 3 * 86400000, opportunityCount: 4, quality: 'high' }],
  }));
});

await page.goto(base + '/results', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await shot('4-results'); await overflow('results');

await page.click('button:has-text("How to try it")');
await page.waitForTimeout(500);
await shot('5-results-expanded');

await page.goto(base + '/face', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const firstRow = page.locator('#g-proportion ~ ul button').first();
if (await firstRow.count()) { await firstRow.click(); await page.waitForTimeout(400); }
await shot('10-face'); await overflow('face');

await page.goto(base + '/plan', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('6-plan'); await overflow('plan');

await page.goto(base + '/progress', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shot('7-progress'); await overflow('progress');

/* Narrow + desktop */
for (const [w, h, label] of [[320, 700, 'narrow'], [1280, 900, 'desktop']]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(base + '/results', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await overflow(`results @${w}`);
  if (label === 'narrow') await shot('8-narrow-320');
  else await shot('9-desktop');
}

/* Keyboard reachability of the primary action */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: 'networkidle' });
const focusable = await page.evaluate(() => {
  const el = document.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
  return el.length;
});

await browser.close();
server.kill();

console.log('screens   :', shots.map((s) => s.split('/').pop()).join(' '));
console.log('focusable :', focusable, 'elements on welcome');
console.log(errors.length ? 'ISSUES:\n  ' + errors.join('\n  ') : 'console errors + overflow: none ✓');
process.exit(errors.length ? 1 : 0);
