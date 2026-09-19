/* The annotated face/body render — the "proof" screen.
 * Every line drawn corresponds to a number the report quotes, so the user can
 * see where a measurement came from instead of trusting a black box. */

import * as L from '../analysis/landmarks.js';

const C = {
  mesh:   'rgba(124, 201, 177, .20)',
  line:   '#7cc9b1',
  axis:   'rgba(236, 231, 220, .45)',
  tickTx: '#ECE7DC',
  halo:   'rgba(5, 7, 10, .72)',
};

const px = (p, w, h) => ({ x: p.x * w, y: p.y * h });

function stroke(ctx, a, b, { color = C.line, width = 1.4, dash = null } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.restore();
}

function label(ctx, text, at, { align = 'center' } = {}) {
  ctx.save();
  ctx.font = '600 13px ui-monospace, "IBM Plex Mono", monospace';
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const pad = 6, x = align === 'center' ? at.x - w / 2 - pad : at.x - pad;
  ctx.fillStyle = C.halo;
  ctx.beginPath();
  ctx.roundRect(x, at.y - 11, w + pad * 2, 22, 6);
  ctx.fill();
  ctx.fillStyle = C.tickTx;
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

/**
 * Draw the face annotation onto a canvas sized to the source image.
 * @param {Array} lm  raw normalised landmarks (original frame orientation)
 */
export function drawFaceOverlay(canvas, img, lm, face, { detail = 'full' } = {}) {
  const w = canvas.width = img.width, h = canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  // darken slightly so the annotation reads on any skin tone / lighting
  ctx.fillStyle = 'rgba(8,10,13,.30)';
  ctx.fillRect(0, 0, w, h);

  const P = (i) => px(lm[i], w, h);

  /* --- face oval --- */
  ctx.save();
  ctx.strokeStyle = C.mesh; ctx.lineWidth = 1.6;
  ctx.beginPath();
  L.FACE_OVAL.forEach((i, k) => { const p = P(i); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
  ctx.closePath(); ctx.stroke();
  ctx.restore();

  if (detail === 'full') {
    /* --- midline --- */
    stroke(ctx, P(L.TRICHION), P(L.MENTON), { color: C.axis, width: 1, dash: [5, 6] });

    /* --- the three horizontal thirds --- */
    const bounds = L.FACE_OVAL.map(P);
    const xL = Math.min(...bounds.map(p => p.x)) - 12;
    const xR = Math.max(...bounds.map(p => p.x)) + 12;
    for (const [i, name] of [[L.TRICHION, ''], [L.GLABELLA, '⅓'], [L.SUBNASALE, '⅔'], [L.MENTON, '']]) {
      const p = P(i);
      stroke(ctx, { x: xL, y: p.y }, { x: xR, y: p.y }, { color: C.axis, width: 1, dash: [3, 5] });
      if (name) label(ctx, name, { x: xR + 18, y: p.y });
    }

    /* --- bizygomatic & bigonial widths --- */
    const zr = P(L.ZYG_R), zl = P(L.ZYG_L);
    stroke(ctx, zr, zl, { width: 2 });
    if (face?.mm?.bizygomatic) label(ctx, `${face.mm.bizygomatic} מ״מ`, { x: (zr.x + zl.x) / 2, y: zr.y - 18 });

    const gr = P(L.GONION_R), gl = P(L.GONION_L);
    stroke(ctx, gr, gl, { width: 2 });
    if (face?.mm?.bigonial) label(ctx, `${face.mm.bigonial} מ״מ`, { x: (gr.x + gl.x) / 2, y: gr.y + 20 });

    /* --- canthal tilt: the eye axes --- */
    stroke(ctx, P(L.R_EYE_IN), P(L.R_EYE_OUT), { width: 2 });
    stroke(ctx, P(L.L_EYE_IN), P(L.L_EYE_OUT), { width: 2 });
    if (face?.ratios?.canthalTilt != null) {
      const o = P(L.L_EYE_OUT);
      label(ctx, `${face.ratios.canthalTilt > 0 ? '+' : ''}${face.ratios.canthalTilt}°`, { x: o.x + 30, y: o.y - 14 });
    }

    /* --- jaw contour, highlighted --- */
    ctx.save();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
    ctx.beginPath();
    [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397].forEach((i, k) => {
      const p = P(i); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    /* --- iris rings: the millimetre ruler --- */
    for (const ring of [L.L_IRIS, L.R_IRIS]) {
      if (!lm[ring[4]]) continue;
      const c = P(ring[0]), e = P(ring[1]);
      const r = Math.hypot(c.x - e.x, c.y - e.y);
      ctx.save();
      ctx.strokeStyle = '#a9decc'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const irisAt = P(L.L_IRIS[0]);
    label(ctx, '11.7 מ״מ · כיול', { x: irisAt.x, y: irisAt.y - 26 });
  }

  return canvas;
}

/** Body annotation: silhouette widths + posture lines. */
export function drawBodyOverlay(canvas, img, lm, body) {
  const w = canvas.width = img.width, h = canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,13,.32)';
  ctx.fillRect(0, 0, w, h);

  const P = (i) => px(lm[i], w, h);
  const S = L.POSE;

  /* skeleton, quiet */
  ctx.save();
  ctx.strokeStyle = C.mesh; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const [a, b] of [[S.L_SHOULDER, S.R_SHOULDER], [S.L_SHOULDER, S.L_HIP], [S.R_SHOULDER, S.R_HIP],
    [S.L_HIP, S.R_HIP], [S.L_HIP, S.L_KNEE], [S.L_KNEE, S.L_ANKLE], [S.R_HIP, S.R_KNEE], [S.R_KNEE, S.R_ANKLE]]) {
    const p = P(a), q = P(b);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
  }
  ctx.restore();

  /* the measured silhouette widths — these are the numbers in the report */
  if (body?.px?.shoulder) {
    const rows = [
      ['shoulderY', 'shoulder', 'כתפיים'],
      ['waistY', 'waist', 'מותן'],
      ['hipY', 'hip', 'ירכיים'],
    ];
    const cx = (P(S.L_HIP).x + P(S.R_HIP).x) / 2;
    for (const [yk, wk, name] of rows) {
      const y = body.px[yk], width = body.px[wk];
      if (!y || !width) continue;
      const a = { x: cx - width / 2, y }, b = { x: cx + width / 2, y };
      stroke(ctx, a, b, { width: 2.4 });
      stroke(ctx, { x: a.x, y: y - 9 }, { x: a.x, y: y + 9 }, { width: 2.4 });
      stroke(ctx, { x: b.x, y: y - 9 }, { x: b.x, y: y + 9 }, { width: 2.4 });
      label(ctx, name, { x: b.x + 46, y });
    }
  }

  /* posture reference: true vertical through the hips */
  const hip = { x: (P(S.L_HIP).x + P(S.R_HIP).x) / 2, y: (P(S.L_HIP).y + P(S.R_HIP).y) / 2 };
  stroke(ctx, { x: hip.x, y: 0 }, { x: hip.x, y: h }, { color: C.axis, width: 1, dash: [5, 7] });

  return canvas;
}
