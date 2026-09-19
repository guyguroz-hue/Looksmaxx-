/* Charts, hand-rolled in SVG. No library — the whole app must stay free,
 * offline-capable and small.
 *
 * Form choices follow the data's job:
 *  · domain scores  → horizontal bars, ONE sequential hue + a target tick.
 *    Not a radar: radars make unequal axes look comparable and are near-
 *    impossible to read precisely, which is the opposite of what a
 *    measurement app owes the reader.
 *  · score over time → single-series line, endpoint direct-label, crosshair.
 *  · the headline    → a meter (ring), which is the right form for one value
 *    against a limit. */

const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}) => {
  const e = document.createElementNS(NS, n);
  for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, v);
  return e;
};

/* Sequential ramp (one hue) — steps read off the validated token set. */
const RAMP = ['#004f3e', '#006952', '#008268', '#269b7e', '#4db497', '#7cc9b1', '#a9decc'];
/** Pick a ramp step by magnitude. Sequential = more is lighter on a dark surface. */
export const rampFor = (score) => RAMP[Math.max(0, Math.min(RAMP.length - 1, 2 + Math.round((score / 100) * 4)))];

/* ============================ score ring (meter) ============================ */

export function scoreRing(mount, { score, potential, size = 268 }) {
  // Remove only a ring we drew before — the mount also holds the score readout
  // (.ring-core), and wiping it would delete the very nodes we animate.
  mount.querySelector(':scope > svg')?.remove();
  const r = size / 2 - 22, c = size / 2;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, 'aria-hidden': 'true' });

  /* tick ring — the instrument tell, 60 minor + 5 major */
  const ticks = el('g', { class: 'ring-ticks' });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, major = i % 12 === 0;
    const r1 = r + 10, r2 = r + (major ? 17 : 14);
    const t = el('line', {
      x1: c + Math.cos(a) * r1, y1: c + Math.sin(a) * r1,
      x2: c + Math.cos(a) * r2, y2: c + Math.sin(a) * r2,
    });
    if (major) t.setAttribute('class', 'major');
    ticks.append(t);
  }
  svg.append(ticks);
  svg.append(el('circle', { class: 'ring-track', cx: c, cy: c, r }));

  /* the ceiling, drawn as a dashed ghost arc behind the value */
  if (potential != null && potential > score) {
    const ghost = el('circle', {
      class: 'ring-ghost', cx: c, cy: c, r,
      'stroke-dasharray': `2 7`,
      'stroke-dashoffset': 0,
      pathLength: 100,
    });
    ghost.setAttribute('stroke-dasharray', `${potential} ${100 - potential}`);
    ghost.setAttribute('stroke-dashoffset', '0');
    svg.append(ghost);
  }

  const prog = el('circle', { class: 'ring-prog', cx: c, cy: c, r, pathLength: 100 });
  prog.setAttribute('stroke-dasharray', '100 100');
  prog.setAttribute('stroke-dashoffset', '100');
  prog.style.stroke = rampFor(score);
  svg.append(prog);
  mount.prepend(svg);

  requestAnimationFrame(() => { prog.setAttribute('stroke-dashoffset', String(100 - score)); });
  return { animate: (v) => prog.setAttribute('stroke-dashoffset', String(100 - v)) };
}

/** Count a number up — the reveal moment. */
export function countUp(node, to, { ms = 1400, from = 0 } = {}) {
  if (!node) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = String(to); return; }
  const t0 = performance.now();
  const tick = (t) => {
    if (!node.isConnected) return;          // the screen re-rendered under us
    const k = Math.min(1, (t - t0) / ms);
    const eased = 1 - Math.pow(1 - k, 4);
    node.textContent = String(Math.round(from + (to - from) * eased));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ============================ domain bars ============================ */

/**
 * Horizontal bars, one sequential hue, with a target tick at the band edge.
 * The value rides the bar end as a direct label; the status word + icon carries
 * identity so nothing depends on colour alone.
 */
export function domainBars(mount, domains, { onSelect } = {}) {
  mount.innerHTML = '';
  const list = Object.values(domains);

  for (const d of list) {
    const row = document.createElement(onSelect ? 'button' : 'div');
    row.className = 'bar-row';
    if (onSelect) { row.type = 'button'; row.addEventListener('click', () => onSelect(d.id)); }

    const head = document.createElement('div');
    head.className = 'bar-head';
    const name = document.createElement('span');
    name.className = 'bar-name';
    name.textContent = d.label;
    const val = document.createElement('span');
    val.className = 'bar-val num';
    val.textContent = d.score == null ? '—' : d.score;
    head.append(name, val);

    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    if (d.score != null) fill.style.background = rampFor(d.score);
    const tick = document.createElement('div');
    tick.className = 'bar-target';
    tick.style.insetInlineStart = '72%';          // where "strong" begins (72/100)
    tick.title = 'יעד';
    track.append(fill, tick);

    /* Separate "not measured yet" from "optional extra". A domain reading
       1/4 looks like a failure; 1/2 measured with 2 optional reads as a choice. */
    const locked = d.lockedCount ?? 0;
    const asked = d.total - locked;
    const counted = asked === d.measured
      ? `${d.measured} מדדים`
      : `${d.measured}/${asked} מדדים`;
    const extra = locked ? ` · ${locked} נוספים בסריקת גוף` : '';

    const note = document.createElement('div');
    note.className = 'bar-note';
    note.textContent = d.score == null
      ? (locked ? `נפתח עם סריקת גוף (${locked} מדדים)` : `לא נמדד`)
      : d.potential > d.score ? `פוטנציאל ${d.potential} · ${counted}${extra}`
      : `${counted}${extra}`;

    row.append(head, track, note);
    mount.append(row);
    if (d.score != null) requestAnimationFrame(() => { fill.style.width = d.score + '%'; });
  }
}

/* ============================ progress line ============================ */

/**
 * Single-series line over time. One series ⇒ no legend box (the title names it);
 * the last point is direct-labelled; a crosshair + tooltip carries the rest.
 */
export function progressLine(mount, history, { potential } = {}) {
  mount.innerHTML = '';
  const pts = history.filter(h => h.overall != null);
  if (pts.length < 2) {
    mount.innerHTML = '<div class="empty"><span class="small">שתי סריקות לפחות דרושות כדי להציג מגמה</span></div>';
    return;
  }

  const W = 520, H = 190, PAD = { t: 18, r: 46, b: 26, l: 34 };
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const xs = pts.map(p => p.at);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = Math.max(0, Math.min(...pts.map(p => p.overall)) - 8);
  const hi = Math.min(100, Math.max(...pts.map(p => p.overall), potential ?? 0) + 8);
  const X = (v) => PAD.l + (x1 === x0 ? iw : ((v - x0) / (x1 - x0)) * iw);
  const Y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'ציון כולל לאורך זמן' });
  svg.style.width = '100%'; svg.style.height = 'auto'; svg.style.overflow = 'visible';
  // Time runs left→right even on an RTL page — the standard for Hebrew charts —
  // so pin the direction instead of inheriting it.
  mount.style.direction = 'ltr';

  /* recessive gridlines: hairline, solid, one step off the surface */
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) / 3) * i;
    svg.append(el('line', { x1: PAD.l, x2: W - PAD.r, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
    const t = el('text', { x: PAD.l - 8, y: Y(v) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 10 });
    t.style.fontFamily = 'var(--font-mono)';
    t.textContent = Math.round(v);
    svg.append(t);
  }

  /* the ceiling as a reference line — not a second series */
  if (potential != null && potential <= hi) {
    svg.append(el('line', {
      x1: PAD.l, x2: W - PAD.r, y1: Y(potential), y2: Y(potential),
      stroke: 'var(--ink-3)', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: .8,
    }));
    const lab = el('text', { x: W - PAD.r + 5, y: Y(potential) + 4, fill: 'var(--ink-3)', 'font-size': 10 });
    lab.style.fontFamily = 'var(--font-mono)';
    lab.textContent = 'תקרה';
    svg.append(lab);
  }

  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.at)},${Y(p.overall)}`).join(' ');
  /* area wash at ~10% — a wash, never a block */
  svg.append(el('path', {
    d: `${d} L${X(pts[pts.length - 1].at)},${PAD.t + ih} L${X(pts[0].at)},${PAD.t + ih} Z`,
    fill: 'var(--seq-400)', opacity: .1,
  }));
  svg.append(el('path', { d, fill: 'none', stroke: 'var(--seq-500)', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  /* markers: ≥8px, each with a 2px surface ring so overlaps stay legible */
  for (const p of pts) {
    svg.append(el('circle', { cx: X(p.at), cy: Y(p.overall), r: 4, fill: 'var(--seq-500)', stroke: 'var(--surface-1)', 'stroke-width': 2 }));
  }

  /* direct-label the endpoint only — a number on every point goes unread */
  const last = pts[pts.length - 1];
  const endLab = el('text', { x: X(last.at) + 9, y: Y(last.overall) + 4, fill: 'var(--ink)', 'font-size': 13, 'font-weight': 600 });
  endLab.style.fontFamily = 'var(--font-mono)';
  endLab.textContent = last.overall;
  svg.append(endLab);

  /* crosshair + tooltip */
  const cross = el('line', { y1: PAD.t, y2: PAD.t + ih, stroke: 'var(--ink-3)', 'stroke-width': 1, opacity: 0 });
  const dot = el('circle', { r: 5.5, fill: 'var(--seq-600)', stroke: 'var(--surface-1)', 'stroke-width': 2, opacity: 0 });
  svg.append(cross, dot);

  const tip = document.createElement('div');
  Object.assign(tip.style, {
    position: 'absolute', pointerEvents: 'none', opacity: '0', transition: 'opacity .12s',
    background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: '10px',
    padding: '7px 11px', fontSize: '12px', whiteSpace: 'nowrap', transform: 'translate(-50%,-125%)',
    boxShadow: 'var(--shadow-2)', zIndex: '5',
  });
  mount.style.position = 'relative';

  const hit = el('rect', { x: PAD.l, y: PAD.t, width: iw, height: ih, fill: 'transparent' });
  hit.style.cursor = 'crosshair';
  const move = (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - box.left) / box.width * W;
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const dd = Math.abs(X(p.at) - px); if (dd < bd) { bd = dd; best = p; } }
    const cx = X(best.at), cy = Y(best.overall);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('opacity', '.45');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('opacity', '1');
    tip.innerHTML = `<b class="num">${best.overall}</b> · ${new Date(best.at).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}`;
    tip.style.insetInlineStart = `${(cx / W) * 100}%`;
    tip.style.insetBlockStart = `${(cy / H) * 100}%`;
    tip.style.opacity = '1';
  };
  const leave = () => { cross.setAttribute('opacity', '0'); dot.setAttribute('opacity', '0'); tip.style.opacity = '0'; };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerleave', leave);
  svg.append(hit);

  mount.append(svg, tip);
}

/* ============================ table view (a11y) ============================ */

/** Every chart ships a table fallback so nothing is gated behind colour or hover. */
export function metricsTable(metrics) {
  const t = document.createElement('table');
  t.className = 'data-table';
  t.innerHTML = `<caption class="sr-only">מדדים מלאים</caption>
    <thead><tr><th>מדד</th><th>ערך</th><th>טווח יעד</th><th>ציון</th></tr></thead><tbody></tbody>`;
  const tb = t.querySelector('tbody');
  for (const m of metrics) {
    if (!m.available) continue;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m.label}</td>
      <td class="num">${m.value}${m.unit ?? ''}</td>
      <td class="num">${m.band[0]}–${m.band[1]}</td>
      <td class="num">${m.score}</td>`;
    tb.append(tr);
  }
  return t;
}
