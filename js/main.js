/* Application controller: routing, the scan flow, and rendering.
 * Everything below runs client-side; there is no network call other than
 * fetching the model files once. */

import { Camera, explainCameraError } from './scan/camera.js';
import { scanFace, scanBody } from './scan/scanner.js';
import { warmUp, setSources } from './lib/mp.js';
import { scoreAll, rankOpportunities, bandOf, progressToCeiling } from './analysis/scoring.js';
import { buildPlan } from './content/planner.js';
import { COST_LABEL, EVIDENCE_LABEL, protocol } from './content/protocols.js';
import * as store from './lib/store.js';
import { scoreRing, countUp, domainBars, progressLine, metricsTable } from './ui/charts.js';
import { drawFaceOverlay, drawBodyOverlay } from './ui/overlay.js';
import { mountQuiz } from './ui/quiz.js';
import { mountAuth } from './ui/auth.js';
import { deriveSelfReport, bundleFromResult } from './content/profileMetrics.js';
import { isConfigured, currentUser, onAuthChange, saveScan, saveProfile } from './lib/supabase.js';
import { isComplete } from './content/questionnaire.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Wrap a numeric run so bidi does not reverse it inside Hebrew prose:
 *  ranges ("0–2"), signed deltas ("+30") and values with units ("1.7 מ״מ"). */
const n = (v) => `<bdi class="n">${v}</bdi>`;

const DOMAIN_LABELS = {
  harmony: 'הרמוניה', symmetry: 'סימטריה', definition: 'הגדרה',
  skin: 'עור', body: 'הרכב גוף', posture: 'יציבה',
};

/** Hebrew counts: "מדד אחד" for one, "2 מדדים" for the rest. */
const plural = (count, one, many) => (count === 1 ? one : `${n(count)} ${many}`);

/* Session-scoped capture results. Deliberately NOT persisted — the raw frames
   and landmarks die with the page; only the derived numbers are stored. */
const capture = { face: null, skin: null, body: null, bodySide: null, stills: {} };
/** The last assembled scoring bundle — the planner needs it for causal context. */
let lastBundle = {};

let currentScreen = 's-intro';
let abort = null;
const cam = new Camera($('#video'));

/* ══════════════════════════ routing ══════════════════════════ */

function show(id, { push = true } = {}) {
  if (id === currentScreen) return;
  if (currentScreen === 's-scan' && id !== 's-scan') stopScan();
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === id));
  currentScreen = id;
  $('#nav').hidden = (id === 's-intro' || id === 's-quiz');
  $$('.nav__btn').forEach(b => b.toggleAttribute('aria-current', b.dataset.nav === id));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (push) history.replaceState({ id }, '', '#' + id.replace('s-', ''));
  if (id === 's-plan') renderPlan();
  if (id === 's-progress') renderProgress();
}

$$('.nav__btn').forEach(b => b.addEventListener('click', () => {
  const target = b.dataset.nav;
  if ((target === 's-result' || target === 's-plan') && !store.get().lastResult) {
    return toast('צריך לבצע סריקה קודם');
  }
  show(target);
}));

/* ══════════════════════════ toast ══════════════════════════ */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.querySelector('span').textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}

/* ══════════════════════════ onboarding ══════════════════════════ */

$$('.seg').forEach(btn => btn.addEventListener('click', () => {
  $$('.seg').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
  store.update(s => { s.profile.sex = btn.dataset.sex; });
}));

(function restoreProfile() {
  const sex = store.get().profile.sex ?? 'x';
  $$('.seg').forEach(b => b.setAttribute('aria-checked', String(b.dataset.sex === sex)));
})();

$('#go-scan').addEventListener('click', () => startFlow());
(function labelIntroCta() {
  const done = isComplete(store.get().profile);
  const btn = $('#go-scan');
  if (btn) btn.firstChild.textContent = done ? 'להתחיל סריקה ' : 'להתחיל — שאלון קצר ';
})();

/* ══════════════════════════ scan flow ══════════════════════════ */

/* The default scan is the face alone.
 *
 * Body shots were in here and came out: photographing your own full body needs
 * a tripod, a timer and a mirror-free wall, and most people simply will not do
 * it. The questionnaire recovers the important part — height, weight and a tape
 * measure beat a self-taken photo at waist-to-hip anyway — and the body pass
 * stays available for anyone who wants the posture metrics too. */
const FACE_STEP  = { key: 'face',  title: 'סריקת פנים',   sub: 'להחזיק את הטלפון בגובה העיניים, במרחק של כ-40 ס״מ, באור אחיד מלפנים.', facing: 'user' };
const BODY_STEPS = [
  { key: 'front', title: 'גוף — מלפנים', sub: 'להניח את הטלפון ולהתרחק עד שכל הגוף נכנס למסגרת. עמידה טבעית, ידיים מעט מהגוף.', facing: 'environment' },
  { key: 'side',  title: 'גוף — מהצד',   sub: 'להסתובב 90°. זהו הצילום שחושף את זווית הראש-צוואר — המדד שמשנה את קו הלסת.', facing: 'environment' },
];

let STEPS = [FACE_STEP];
let stepIndex = 0;

/** The questionnaire comes first — it sets the target bands the scan is scored against. */
async function startFlow() {
  if (!isComplete(store.get().profile)) return startQuiz();
  STEPS = [FACE_STEP];
  stepIndex = 0;
  capture.face = capture.skin = null;
  warmUp();
  show('s-scan');
  await runStep();
}

/** Opt-in second pass that unlocks the posture and body-shape metrics. */
async function startBodyScan() {
  STEPS = BODY_STEPS;
  stepIndex = 0;
  capture.body = capture.bodySide = null;
  warmUp();
  show('s-scan');
  await runStep();
}

function startQuiz() {
  show('s-quiz');
  mountQuiz($('#quiz'), {
    answers: store.get().profile,
    onExit: () => show('s-intro'),
    onDone: async (answers) => {
      store.update(st => { st.profile = { ...st.profile, ...answers, onboarded: true }; });
      if (await currentUser()) saveProfile(store.get().profile).catch(() => {});
      startFlow();
    },
  });
}

function stopScan() { abort?.abort(); abort = null; cam.stop(); $('#stage').classList.remove('is-scanning', 'is-locked'); }

async function runStep() {
  const step = STEPS[stepIndex];
  if (!step) return finish();

  $('#scan-step').textContent = STEPS.length > 1
    ? `שלב ${stepIndex + 1} מתוך ${STEPS.length}`
    : 'סריקה';
  $('#scan-h').textContent = step.title;
  $('#scan-sub').textContent = step.sub;
  $('#btn-capture').disabled = true;
  $('#btn-capture').textContent = 'מאתחל…';
  $('#btn-skip').textContent = step.key === 'face' ? 'לא מצליח לסרוק — לדלג' : 'לדלג על השלב';
  $('#scan-prog').style.width = '0%';
  $('#qc').innerHTML = '';
  $('#hint').textContent = 'מאתחל מצלמה…';

  try {
    await cam.start({ facing: step.facing });
  } catch (err) {
    $('#hint').textContent = explainCameraError(err);
    $('#btn-capture').textContent = 'לנסות שוב';
    $('#btn-capture').disabled = false;
    $('#btn-capture').onclick = () => runStep();
    return;
  }

  document.documentElement.style.setProperty('--sweep-h', $('#stage').clientHeight + 'px');
  $('#stage').classList.add('is-scanning');
  abort = new AbortController();

  const onTick = (s) => {
    $('#hint').textContent = s.hint ?? '';
    $('#scan-prog').style.width = Math.round((s.progress ?? 0) * 100) + '%';
    $('#stage').classList.toggle('is-locked', !!s.locked);
    if (s.quality) renderQC(s.quality);
    $('#btn-capture').disabled = true;
    $('#btn-capture').textContent = s.locked ? 'מודד…' : 'ממתין לקליטה יציבה…';
  };

  try {
    if (step.key === 'face') {
      const r = await scanFace(cam, onTick, abort.signal, store.get().profile);
      capture.face = r.face; capture.skin = r.skin;
      capture.stills.face = { still: r.still, landmarks: r.landmarks, face: r.face };
    } else {
      const r = await scanBody(cam, step.key, onTick, abort.signal);
      if (step.key === 'front') capture.body = r.body; else capture.bodySide = r.body;
      capture.stills[step.key] = { still: r.still, landmarks: r.landmarks, body: r.body };
    }
    $('#stage').classList.remove('is-scanning');
    $('#hint').textContent = 'נקלט ✓';
    toast(step.key === 'face' ? 'סריקת פנים הושלמה' : 'הצילום נקלט');
    stepIndex++;
    cam.stop();
    await runStep();
  } catch (err) {
    if (err.name === 'AbortError') return;
    console.error(err);
    /* The only network the app touches is the one-time model download. If that
       is what failed, say so plainly instead of blaming the detection. */
    const offline = !navigator.onLine || /fetch|network|load|import/i.test(err.message ?? '');
    $('#hint').textContent = offline
      ? 'טעינת מודל הזיהוי נכשלה. נדרש חיבור לאינטרנט בסריקה הראשונה בלבד.'
      : 'שגיאה בזיהוי. אפשר לנסות שוב.';
    $('#btn-capture').disabled = false;
    $('#btn-capture').textContent = 'לנסות שוב';
    $('#btn-capture').onclick = () => runStep();
  }
}

$('#btn-skip').addEventListener('click', () => {
  stopScan();
  stepIndex++;
  if (stepIndex >= STEPS.length) finish(); else runStep();
});

function renderQC(q) {
  const mount = $('#qc');
  const entries = Object.entries(q.checks);
  if (mount.children.length !== entries.length) {
    mount.innerHTML = entries.map(([k, c]) => `
      <div class="qc__item" data-k="${k}">
        <span class="qc__name">${c.label}</span>
        <span class="qc__val num"></span>
        <span class="qc__bar"><i></i></span>
      </div>`).join('');
  }
  for (const [k, c] of entries) {
    const row = mount.querySelector(`[data-k="${k}"]`);
    if (!row) continue;
    row.dataset.ok = String(c.ok);
    row.querySelector('i').style.width = Math.round(Math.max(0, Math.min(1, c.v)) * 100) + '%';
    row.querySelector('i').style.background = c.ok ? 'var(--seq-500)' : 'var(--st-watch)';
    row.querySelector('.qc__val').textContent = c.ok ? '' : 'לתקן';
  }
}

/** Everything the scorer reads, assembled from the scan and the questionnaire. */
function currentBundle() {
  const answers = store.get().profile;
  const merged = capture.body || capture.bodySide
    ? { ...(capture.body ?? {}),
        ratios: { ...(capture.body?.ratios ?? {}) },
        posture: { ...(capture.body?.posture ?? {}), ...(capture.bodySide?.posture ?? {}) } }
    : undefined;
  return {
    face: capture.face ?? undefined,
    skin: capture.skin ?? undefined,
    body: merged,
    self: deriveSelfReport(answers),     // BMI and tape measurements
  };
}

function finish() {
  stopScan();
  if (!capture.face && !capture.body && !capture.bodySide) {
    toast('לא נקלטה אף סריקה');
    return show('s-intro');
  }
  const answers = store.get().profile;
  const bundle = currentBundle();
  const result = scoreAll(bundle, answers);
  lastBundle = bundle;

  store.saveResult(result);
  renderResult(result);
  show('s-result');

  // Best-effort cloud save; a failure never blocks the user seeing their result.
  saveScan(result).catch(() => {});
}

/* ══════════════════════════ result ══════════════════════════ */

function renderResult(result) {
  $('#score-band').textContent = result.band?.label ?? '—';
  scoreRing($('#ring'), { score: result.overall ?? 0, potential: result.potential });
  countUp($('#score-val'), result.overall ?? 0);

  const d = store.delta();
  const pct = progressToCeiling(result);
  const gain = Math.max(0, (result.potential ?? 0) - (result.overall ?? 0));
  $('#hero-meta').innerHTML = `
    <div class="stat"><b class="num">${result.potential ?? '—'}</b><span>תקרה ריאלית</span></div>
    <div class="stat"><b class="num">+${gain}</b><span>ניתן להשיג</span></div>
    ${pct != null ? `<div class="stat"><b class="num">${pct}%</b><span>מהדרך</span></div>` : ''}
    ${d ? `<div class="stat"><b class="num">${d.overall > 0 ? '+' : ''}${d.overall}</b><span>מאז הסריקה הקודמת</span></div>`
        : `<div class="stat"><b class="num">${result.coverage.pct}%</b><span>כיסוי מדידה</span></div>`}`;

  domainBars($('#domain-bars'), result.domains, { onSelect: openDomain });

  /* Locked domains are an invitation, not a failure — say so in those words. */
  const unlock = $('#unlock-body');
  if (unlock) {
    const locked = result.coverage.lockedDomains ?? [];
    unlock.hidden = locked.length === 0;
    const label = unlock.querySelector('[data-unlock-text]');
    if (label) label.textContent = `סריקת גוף אופציונלית תפתח ${result.coverage.unlockable} מדדים נוספים (${locked.join(' ו')}) — כולל זווית ראש-צוואר, שמשנה את מראה קו הלסת.`;
  }

  /* annotated still */
  const annot = $('#annot');
  annot.innerHTML = '';
  const shot = capture.stills.face ?? capture.stills.front ?? capture.stills.side;
  if (shot) {
    const c = document.createElement('canvas');
    if (capture.stills.face && shot === capture.stills.face) {
      drawFaceOverlay(c, shot.still.canvas, shot.landmarks, shot.face);
    } else {
      drawBodyOverlay(c, shot.still.canvas, shot.landmarks, shot.body);
    }
    annot.append(c);
    $('#annotated-card').hidden = false;
  } else {
    $('#annotated-card').hidden = true;
  }

  /* opportunities */
  const opps = rankOpportunities(result, 6);
  $('#opps').innerHTML = opps.length ? '' : '<p class="small">אין פערים משמעותיים הניתנים לשיפור במדידה הזו.</p>';
  opps.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'rowitem';
    b.innerHTML = `
      <span class="rowitem__idx num">${String(i + 1).padStart(2, '0')}</span>
      <span class="rowitem__body">
        <span class="rowitem__title">${m.label}</span>
        <span class="rowitem__sub">ציון ${n(m.score)} · ניתן לשיפור עד ${n('+' + m.headroom)}</span>
      </span>
      <span class="chip chip--${m.status}"><i class="dot"></i>${bandOf(m.score).label}</span>`;
    b.addEventListener('click', () => openMetric(m));
    $('#opps').append(b);
  });

  /* table view — nothing is gated behind colour or hover */
  const tw = $('#table-wrap');
  tw.innerHTML = '';
  tw.append(metricsTable(result.metrics));
}

$('#toggle-table').addEventListener('click', (e) => {
  const on = $('#table-wrap').classList.toggle('hidden');
  e.currentTarget.setAttribute('aria-expanded', String(!on));
  e.currentTarget.textContent = on ? 'טבלה' : 'הסתרה';
});

$('#go-plan').addEventListener('click', () => show('s-plan'));

/* ══════════════════════════ detail sheet ══════════════════════════ */

function openSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $$('[data-protocol]', $('#sheet-body')).forEach(b =>
    b.addEventListener('click', () => openProtocol(b.dataset.protocol)));
}
function closeSheet() {
  $('#sheet').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
$$('[data-close]').forEach(e => e.addEventListener('click', closeSheet));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

const gradeChip = (ev) => `<span class="grade grade--${ev}"><b>${ev}</b>${EVIDENCE_LABEL[ev]}</span>`;

function openMetric(m) {
  const [lo, hi] = m.band;
  const modLabel = { fixed: 'מבני — לא ניתן לשינוי ללא ניתוח', soft: 'משתנה חלקית (שומן, נוזלים, גיל)', live: 'ניתן לשינוי מלא באורח חיים' }[m.mod];
  openSheet(`
    <div class="eyebrow">${m.domainLabel ?? ''}מדד</div>
    <h2 id="sheet-title">${m.label}</h2>
    <div class="sheet__meta">
      ${gradeChip(m.ev)}
      <span class="chip chip--${m.status}"><i class="dot"></i>${bandOf(m.score).label}</span>
      ${m.approx ? '<span class="chip">הערכה</span>' : ''}
    </div>

    <div class="measure-line"><span>הערך שנמדד</span><b>${n(m.value + m.unit)}</b></div>
    <div class="measure-line"><span>טווח יעד</span><b>${n(lo + '–' + hi + m.unit)}</b></div>
    <div class="measure-line"><span>ציון</span><b>${n(m.score + '/100')}</b></div>
    <div class="measure-line"><span>ניתן לשיפור</span><b>${m.headroom > 0 ? n('+' + m.headroom) : 'אין'}</b></div>
    <div class="measure-line"><span>סוג המדד</span><b style="font-family:var(--font-ui);font-weight:500;font-size:.85rem">${modLabel}</b></div>

    <div class="sheet__section">
      <h3>מה זה אומר</h3>
      <p class="small">${m.what}</p>
      ${m.note ? `<div class="callout" style="margin-top:12px">${m.note}</div>` : ''}
    </div>

    <div class="sheet__section">
      <h3>מה עושים עם זה</h3>
      <div class="rows">
        ${(m.protocols ?? []).map(id => {
          const p = protocol(id); if (!p) return '';
          return `<button class="rowitem" data-protocol="${id}">
            <span class="rowitem__body">
              <span class="rowitem__title">${p.title}</span>
              <span class="rowitem__sub">${n(p.weeks[0] + '–' + p.weeks[1])} שבועות · ${COST_LABEL[p.cost]}</span>
            </span>
            ${gradeChip(p.ev)}
          </button>`;
        }).join('')}
      </div>
    </div>`);
}

function openProtocol(id) {
  const p = protocol(id);
  if (!p) return;
  openSheet(`
    <div class="eyebrow">פרוטוקול</div>
    <h2 id="sheet-title">${p.title}</h2>
    <div class="sheet__meta">
      ${gradeChip(p.ev)}
      <span class="chip">עלות: ${COST_LABEL[p.cost]}</span>
      <span class="chip">${n(p.weeks[0] + '–' + p.weeks[1])} שבועות</span>
      ${p.daily ? '<span class="chip">יומי</span>' : ''}
    </div>
    <p class="lede" style="font-size:var(--fs-sm)">${p.summary}</p>

    <div class="sheet__section">
      <h3>הרקע</h3>
      <p class="small">${p.detail}</p>
    </div>

    <div class="sheet__section">
      <h3>איך מבצעים</h3>
      <ol class="sheet__steps">${p.steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>
    </div>

    <div class="sheet__section">
      <h3>סיכונים ותופעות לוואי</h3>
      <div class="callout callout--care">${p.risk}</div>
    </div>`);
}

function openDomain(domainId) {
  const result = store.get().lastResult;
  const d = result?.domains?.[domainId];
  if (!d) return;
  openSheet(`
    <div class="eyebrow">תחום</div>
    <h2 id="sheet-title">${d.label}</h2>
    <div class="sheet__meta">
      <span class="chip chip--${bandOf(d.score ?? 0).status}"><i class="dot"></i>ציון ${n(d.score ?? '—')}</span>
      ${d.potential > d.score ? `<span class="chip">תקרה ${n(d.potential)}</span>` : ''}
      <span class="chip">${n(d.measured + '/' + d.total)} ${d.total === 1 ? 'מדד' : 'מדדים'}</span>
    </div>
    <div class="rows">
      ${d.metrics.map(m => !m.available
        ? `<div class="rowitem"><span class="rowitem__body"><span class="rowitem__title muted">${m.label}</span><span class="rowitem__sub">לא נמדד</span></span></div>`
        : `<button class="rowitem" data-metric="${m.id}">
             <span class="rowitem__body">
               <span class="rowitem__title">${m.label}</span>
               <span class="rowitem__sub">${n(m.value + m.unit)} · יעד ${n(m.band[0] + '–' + m.band[1] + m.unit)}</span>
             </span>
             <span class="bar-val num">${m.score}</span>
           </button>`).join('')}
    </div>`);
  $$('[data-metric]', $('#sheet-body')).forEach(b => b.addEventListener('click', () => {
    const m = d.metrics.find(x => x.id === b.dataset.metric);
    if (m) openMetric(m);
  }));
}

/* ══════════════════════════ plan ══════════════════════════ */

function renderPlan() {
  const result = store.get().lastResult;
  if (!result) return;
  /* After a reload the raw bundle is gone (it held the landmarks, and those are
     never persisted) — so rebuild the handful of values the causal reasoning
     needs from the stored result instead of silently losing the explanations. */
  const bundle = lastBundle.face ? lastBundle : bundleFromResult(result);
  const { plan, daily, horizon, context, unmeasuredConcerns } = buildPlan(result, bundle);
  const done = store.checkedToday();

  /* daily checklist */
  const mount = $('#daily');
  mount.innerHTML = '';
  daily.forEach(p => {
    const b = document.createElement('button');
    b.className = 'check';
    b.type = 'button';
    b.setAttribute('aria-pressed', String(done.includes(p.id)));
    b.innerHTML = `
      <span class="check__box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      <span class="grow"><span class="check__label">${p.title}</span></span>`;
    b.addEventListener('click', () => {
      store.toggleCheck(p.id);
      renderPlan();
      if (store.checkedToday().length === daily.length) toast('כל הרשימה הושלמה היום 🎯');
    });
    mount.append(b);
  });

  const hit = daily.filter(p => done.includes(p.id)).length;
  $('#daily-fill').style.width = daily.length ? (hit / daily.length) * 100 + '%' : '0%';
  $('#daily-note').textContent = `${hit} מתוך ${daily.length} הושלמו היום`;

  const st = store.get().streak;
  $('#streak').innerHTML = st.count
    ? `<b class="num">${st.count}</b><span class="xs">ימים ברצף</span>`
    : `<span class="xs">להתחיל רצף</span>`;

  /* Why the plan looks the way it does — the questionnaire's payoff, made visible. */
  const notes = $('#plan-context');
  if (notes) {
    const blocks = context.notes.map(t => `<div class="callout" style="margin-bottom:10px">${t}</div>`);
    // The user named something we never measured. Say so plainly and offer the fix.
    if (unmeasuredConcerns.length) {
      const names = unmeasuredConcerns.map(d => DOMAIN_LABELS[d] ?? d).join(' ו');
      blocks.push(`<div class="callout callout--care" style="margin-bottom:10px">
        ציינת ש<b>${names}</b> מה שהכי מפריע לך — אבל זה לא נמדד בסריקת הפנים.
        <button class="btn btn--quiet" id="btn-body-scan-2" style="padding:0;min-height:0;text-decoration:underline">להוסיף סריקת גוף</button>
      </div>`);
    }
    notes.innerHTML = blocks.join('');
    notes.hidden = !blocks.length;
    $('#btn-body-scan-2')?.addEventListener('click', () => startBodyScan());
  }

  /* timeline */
  $('#timeline').innerHTML = horizon.map(g => `
    <div class="tl-group">
      <div class="tl-head"><span>${g.label}</span></div>
      ${g.items.map(p => `<div class="tl-item"><span>${p.title}</span></div>`).join('')}
    </div>`).join('');

  /* full protocol list */
  const list = $('#plan-list');
  list.innerHTML = '';
  plan.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'rowitem';
    b.innerHTML = `
      <span class="rowitem__idx num">${String(i + 1).padStart(2, '0')}</span>
      <span class="rowitem__body">
        <span class="rowitem__title">${p.title}</span>
        <span class="rowitem__sub">${n(p.weeks[0] + '–' + p.weeks[1])} שבועות · ${COST_LABEL[p.cost]} · משפיע על ${plural(p.targets.length, 'מדד אחד', 'מדדים')}</span>
      </span>
      ${gradeChip(p.ev)}`;
    b.addEventListener('click', () => openProtocol(p.id));
    list.append(b);
  });
}

/* ══════════════════════════ progress ══════════════════════════ */

function renderProgress() {
  const s = store.get();
  progressLine($('#chart-progress'), s.history, { potential: s.lastResult?.potential });

  const d = store.delta();
  const chip = $('#trend-chip');
  if (d) {
    const up = d.overall > 0, flat = d.overall === 0;
    chip.className = 'chip ' + (flat ? '' : up ? 'chip--good' : 'chip--watch');
    chip.innerHTML = `<i class="dot"></i>${flat ? 'ללא שינוי' : n((up ? '+' : '') + d.overall) + ' נק׳'}`;
  } else chip.className = 'chip hidden';

  $('#history').innerHTML = s.history.length
    ? [...s.history].reverse().map(h => `
        <div class="rowitem">
          <span class="rowitem__body">
            <span class="rowitem__title">${new Date(h.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span class="rowitem__sub">כיסוי ${n(h.coverage + '%')} · תקרה ${n(h.potential ?? '—')}</span>
          </span>
          <span class="bar-val num">${h.overall ?? '—'}</span>
        </div>`).join('')
    : '<div class="empty"><span class="small">אין עדיין סריקות</span></div>';
}

$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `looksmaxx-${store.today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('הנתונים יוצאו');
});

$('#btn-wipe').addEventListener('click', async () => {
  if (!confirm('למחוק את כל הנתונים? הפעולה אינה הפיכה.')) return;
  // If there is an account, the cloud rows go too — a delete button that leaves
  // data on a server is a lie.
  try {
    if (await currentUser()) {
      const { deleteRemote } = await import('./lib/supabase.js');
      await deleteRemote();
    }
  } catch { toast('המחיקה המקומית בוצעה; מחיקת הענן נכשלה'); }
  store.reset();
  capture.face = capture.skin = capture.body = capture.bodySide = null;
  capture.stills = {};
  lastBundle = {};
  refreshAuth?.();
  toast('הכול נמחק');
  show('s-intro');
});

/* ══════════════════════════ boot ══════════════════════════ */

/* Optional self-hosting: <body data-mp-module="..." data-mp-wasm="..."
   data-mp-face="..." data-mp-pose="..."> overrides the default CDN sources. */
(function applySourceOverrides() {
  const d = document.body.dataset;
  const o = {};
  for (const k of ['module', 'wasm', 'face', 'pose']) {
    const v = d['mp' + k[0].toUpperCase() + k.slice(1)];
    if (v) o[k] = v;
  }
  if (Object.keys(o).length) setSources(o);
})();

let refreshAuth = null;

(function boot() {
  const last = store.get().lastResult;
  if (last) {
    renderResult(last);
    $('#annotated-card').hidden = true;   // the still is never persisted
    show('s-result', { push: false });
  }

  // The account panel lives on the result screen and again under Progress.
  const authMounts = [$('#auth'), $('#auth-progress')].filter(Boolean);
  refreshAuth = () => authMounts.forEach(m => mountAuth(m, { onChange: () => renderProgress() }));
  refreshAuth();

  /* A magic link lands back on this page already authenticated, so the session
     can appear without any click. Re-render and pull the history down. */
  if (isConfigured()) {
    onAuthChange(async (user) => {
      refreshAuth();
      if (!user) return;
      toast('מחובר — מסנכרן');
      try {
        const { pushLocal, fetchAll } = await import('./lib/supabase.js');
        const st = store.get();
        await pushLocal({ answers: st.profile, history: st.history });
        const remote = await fetchAll();
        if (remote) store.update(x => {
          const seen = new Set(x.history.map(h => h.at));
          for (const h of remote.history) if (!seen.has(h.at)) x.history.push(h);
          x.history.sort((a, b) => a.at - b.at);
          if (remote.answers && Object.keys(remote.answers).length) {
            x.profile = { ...remote.answers, ...x.profile };
          }
        });
        renderProgress();
      } catch { /* offline is not an error state here */ }
    });
  }

  $('#btn-body-scan')?.addEventListener('click', () => startBodyScan());
  $('#btn-edit-quiz')?.addEventListener('click', () => startQuiz());

  if ('requestIdleCallback' in window) requestIdleCallback(() => warmUp());
})();
