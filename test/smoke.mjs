/* Browser smoke test: boots the real page in Chromium, fails on any console
   error, injects a synthetic scan result and screenshots every screen. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|ERR_TUNNEL|ERR_NAME|net::/.test(m.text())) errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message + '\n    ' + (e.stack||'').split('\n').slice(1,4).join('\n    ')));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const shots = [];
const shot = async (name) => { const f = `/tmp/shot-${name}.png`; await page.screenshot({ path: f, fullPage: true }); shots.push(f); };
await shot('1-intro');

/* Walk the questionnaire: it is now the first thing a real user meets. */
await page.click('#go-scan');
await page.waitForTimeout(500);
await shot('2-quiz');
const quizProbe = await page.evaluate(() => ({
  steps: document.querySelectorAll('.quiz__bar i').length,
  fields: document.querySelectorAll('.qfield').length,
  nextDisabled: document.querySelector('[data-next]')?.disabled,
}));

/* Feed a synthetic result through the real scoring + rendering path. */
const injected = await page.evaluate(async () => {
  const [S, F, PL, store] = await Promise.all([
    import('./js/analysis/scoring.js'), import('./js/analysis/faceMetrics.js'),
    import('./js/content/planner.js'), import('./js/lib/store.js'),
  ]);
  const mk = (await import('./test/synthFace.js')).synthFace;
  const { deriveSelfReport } = await import('./js/content/profileMetrics.js');
  const answers = { age: 29, sex: 'm', height: 178, weight: 84, fitzpatrick: 2,
                    spf: 'never', sleep: 5.5, activity: 'light', concerns: ['skin', 'jawline'] };
  const face = F.measureFace(mk(), 1000, 1000);
  const bundle = { face,
    skin: { underEye: { index: 8.4 }, evenness: 8.8, redness: 5.1, confidence: 1 },
    self: deriveSelfReport(answers) };
  const r = S.scoreAll(bundle, answers);
  const now = Date.now();
  store.update(s => {
    s.profile = { ...answers, onboarded: true };
    s.lastResult = r;
    s.history = [-46, -32, -18, -7, 0].map((d, i) => ({
      at: now + d * 86400000,
      overall: [58, 62, 66, 69, r.overall][i],
      potential: r.potential, coverage: r.coverage.pct,
      domains: Object.fromEntries(Object.entries(r.domains).map(([k, v]) => [k, v.score])),
    }));
  });
  const { plan, daily } = PL.buildPlan(r, bundle);
  return { overall: r.overall, potential: r.potential, plan: plan.length, daily: daily.length,
           coverage: r.coverage.pct, locked: r.coverage.unlockable };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await shot('3-result');

await page.click('[data-nav="s-plan"]'); await page.waitForTimeout(700); await shot('4-plan');
await page.click('[data-nav="s-progress"]'); await page.waitForTimeout(700); await shot('5-progress');

/* open a protocol sheet */
await page.click('[data-nav="s-plan"]'); await page.waitForTimeout(400);
await page.click('#plan-list .rowitem'); await page.waitForTimeout(600); await shot('6-sheet');

/* horizontal overflow check on every screen */
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);

await browser.close(); server.close();

console.log('quiz screen   :', JSON.stringify(quizProbe), quizProbe.nextDisabled === true ? '(Continue correctly gated ✓)' : '(✗ Continue not gated)');
console.log('injected      :', JSON.stringify(injected));
console.log('h-overflow px :', overflow, overflow <= 0 ? '✓' : '✗ HORIZONTAL SCROLL');
console.log('screenshots   :', shots.join(' '));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'console errors: none ✓');
process.exit(errors.length || overflow > 0 ? 1 : 0);
