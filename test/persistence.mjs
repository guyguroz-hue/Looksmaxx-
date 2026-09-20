/* Proves the reported bug is gone: answers survive a reload, and a returning
   visitor is not shown the form again. */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT ?? 3177);
const base = `http://127.0.0.1:${PORT}`;
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'pipe' });
await (async () => {
  const end = Date.now() + 90000;
  while (Date.now() < end) {
    try { if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  server.kill(); throw new Error('server did not start');
})();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const fail = [];

await page.goto(base, { waitUntil: 'networkidle' });
await page.click('text=Start'); await page.waitForTimeout(400);

// Step 1
await page.fill('#f-age', '34');
await page.click('button:has-text("Male")');
await page.fill('#f-heightCm', '181');
await page.fill('#f-weightKg', '79');
await page.click('button:has-text("Continue")'); await page.waitForTimeout(400);
// Step 2
await page.click('button:has-text("Olive / medium")');
await page.click('button:has-text("Strong sun only")');
await page.click('button:has-text("6–7")');
await page.click('button:has-text("Continue")'); await page.waitForTimeout(400);

const onOptional = await page.locator('text=Skip — take the photo').count();
if (!onOptional) fail.push('optional step did not appear, or has no skip');

await page.click('text=Skip — take the photo'); await page.waitForTimeout(700);
const landed = page.url();
if (!landed.includes('/scan')) fail.push(`skip did not reach /scan (got ${landed})`);

const savedNotice = await page.locator('text=Using your saved answers').count();
if (!savedNotice) fail.push('scan screen does not acknowledge saved answers');

// THE BUG: reload and reopen the form — answers must come back.
await page.goto(base + '/onboarding', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const back = await page.evaluate(() => ({
  age: document.querySelector('#f-age')?.value,
  height: document.querySelector('#f-heightCm')?.value,
  weight: document.querySelector('#f-weightKg')?.value,
  sexChecked: [...document.querySelectorAll('[role="radio"]')].find(b => b.getAttribute('aria-checked') === 'true')?.textContent?.trim(),
}));
if (back.age !== '34') fail.push(`age not restored: got "${back.age}"`);
if (back.height !== '181') fail.push(`height not restored: got "${back.height}"`);
if (back.weight !== '79') fail.push(`weight not restored: got "${back.weight}"`);
if (back.sexChecked !== 'Male') fail.push(`sex not restored: got "${back.sexChecked}"`);

// A returning visitor should not be routed back into the form.
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const cta = (await page.locator('a:has-text("Take a photo")').count()) > 0;
if (!cta) fail.push('welcome still sends a returning visitor to the form');

await browser.close(); server.kill();
console.log('restored:', JSON.stringify(back));
console.log(fail.length ? 'FAILURES:\n  ' + fail.join('\n  ') : 'persistence + returning-user flow: all checks passed ✓');
process.exit(fail.length ? 1 : 0);
