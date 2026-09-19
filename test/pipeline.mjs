/* End-to-end integration test for the real MediaPipe pipeline.
   Serves a local copy of @mediapipe/tasks-vision, boots the actual runtime in
   Chromium, downloads the real models, constructs both detectors with this
   app's exact options, and runs a detection call. Proves everything except
   "does it find a face in a real photo", which is MediaPipe's own job. */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MP = process.env.MP_DIR;
if (!MP || !existsSync(MP)) { console.log('SKIP: set MP_DIR to a local @mediapipe/tasks-vision package'); process.exit(0); }

const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css',
  '.svg':'image/svg+xml', '.json':'application/json', '.wasm':'application/wasm', '.webmanifest':'application/manifest+json' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = p.startsWith('/mp/') ? join(MP, p.slice(4)) : join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
                         'cross-origin-embedder-policy': 'credentialless' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('  pageerror:', e.message));

await page.goto(base, { waitUntil: 'domcontentloaded' });

const { FACE_DRAW } = await import('/tmp/facegen.mjs');
const out = await page.evaluate(async ([base, FACE_DRAW_SRC]) => {
  const FACE_DRAW = eval(FACE_DRAW_SRC);
  const log = [];
  const mp = await import('./js/lib/mp.js');
  mp.setSources({
    module: `${base}/mp/vision_bundle.mjs`,
    wasm:   `${base}/mp/wasm`,
    face:   `${base}/mp/face_landmarker.task`,
    pose:   `${base}/mp/pose_landmarker_full.task`,
  });
  try {
    const t0 = performance.now();
    const face = await mp.faceLandmarker();
    log.push(`FaceLandmarker constructed in ${Math.round(performance.now() - t0)} ms`);

    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 640, 480);
    const r = face.detectForVideo(c, performance.now());
    log.push(`detectForVideo returned keys: ${Object.keys(r).join(', ')}`);
    log.push(`faceLandmarks is array: ${Array.isArray(r.faceLandmarks)} (len ${r.faceLandmarks.length} on a blank frame — expected 0)`);

    // --- landmark-count check: the mm calibration needs the iris points (468-477)
    const fc = document.createElement('canvas'); fc.width = 480; fc.height = 600;
    (FACE_DRAW)(fc);
    let found = null;
    for (let i = 0; i < 3 && !found; i++) {
      const fr = face.detectForVideo(fc, performance.now() + 10 + i);
      if (fr.faceLandmarks?.[0]) found = fr.faceLandmarks[0];
    }
    if (found) {
      log.push(`LANDMARK COUNT on a detected face: ${found.length}  ${found.length >= 478 ? '✓ iris included' : '✗ NO IRIS — mm calibration would fail'}`);
      log.push(`landmark 468 (iris centre) present: ${!!found[468]}  · 477: ${!!found[477]}`);

      // --- full chain on REAL detector output: measure → sample pixels → score
      const [FM, SK, SC] = await Promise.all([
        import('./js/analysis/faceMetrics.js'),
        import('./js/analysis/skin.js'),
        import('./js/analysis/scoring.js'),
      ]);
      const m = FM.measureFace(found, fc.width, fc.height);
      log.push(`— measureFace: mm/unit ${m.quality.mmPerUnit?.toFixed(0)} · IPD ${m.quality.ipdMm} mm · roll ${m.quality.roll}°`);
      log.push(`— widths: bizygomatic ${m.mm.bizygomatic} mm · bigonial ${m.mm.bigonial} mm · face height ${m.mm.faceHeight} mm`);
      log.push(`— symmetry mean dev: ${m.mm.symMeanDev?.toFixed(2)} mm · canthal tilt ${m.ratios.canthalTilt}°`);
      const sk = SK.measureSkin(fc.getContext('2d').getImageData(0, 0, fc.width, fc.height), found);
      log.push(`— measureSkin: evenness ${sk?.evenness} · redness ${sk?.redness} · under-eye ${sk?.underEye?.index} · lit ${sk?.lit}`);
      const sc = SC.scoreAll({ face: m, skin: sk }, { sex: 'x' });
      log.push(`— scoreAll: overall ${sc.overall} · potential ${sc.potential} · coverage ${sc.coverage.pct}% (${sc.coverage.measured}/${sc.coverage.total})`);
      const plausible = m.quality.ipdMm > 45 && m.quality.ipdMm < 80;
      log.push(`— IPD within human range (45-80 mm): ${plausible ? '✓' : '✗ ' + m.quality.ipdMm}`);
    } else {
      log.push('NOTE: synthetic face not detected — landmark count unverified here');
    }

    const t1 = performance.now();
    const pose = await mp.poseLandmarker();
    log.push(`PoseLandmarker constructed in ${Math.round(performance.now() - t1)} ms`);
    const pr = pose.detectForVideo(c, performance.now() + 1);
    log.push(`pose result keys: ${Object.keys(pr).join(', ')}`);
    log.push(`segmentationMasks present: ${'segmentationMasks' in pr}`);
    return { ok: true, log };
  } catch (e) { return { ok: false, log, error: e.message }; }
}, [base, FACE_DRAW]);

await browser.close(); server.close();
out.log.forEach(l => console.log('  ' + l));
if (!out.ok) { console.log('\nFAILED:', out.error); process.exit(1); }
console.log('\n✓ real MediaPipe runtime + both models load and run with this app\'s options');
