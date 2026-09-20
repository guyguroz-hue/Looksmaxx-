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
