/* Draws a crude but photometrically plausible face onto a canvas in-page,
   purely to get the detector to fire so we can count the landmarks it returns. */
export const FACE_DRAW = `(canvas) => {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2;
  ctx.fillStyle = '#6b6f78'; ctx.fillRect(0,0,W,H);
  // head
  const g = ctx.createRadialGradient(cx, cy-20, 20, cx, cy, 190);
  g.addColorStop(0,'#e7c3a4'); g.addColorStop(1,'#c99b78');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, 128, 168, 0, 0, 7); ctx.fill();
  // neck + shoulders
  ctx.fillStyle='#c99b78'; ctx.fillRect(cx-46, cy+130, 92, 90);
  // brows
  ctx.fillStyle='#4a3428';
  ctx.beginPath(); ctx.ellipse(cx-52, cy-56, 34, 8, -0.08, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+52, cy-56, 34, 8,  0.08, 0, 7); ctx.fill();
  // eyes
  for (const s of [-1, 1]) {
    ctx.fillStyle='#f6f2ec'; ctx.beginPath(); ctx.ellipse(cx+s*52, cy-28, 28, 14, 0, 0, 7); ctx.fill();
    ctx.fillStyle='#4a3b2f'; ctx.beginPath(); ctx.arc(cx+s*52, cy-28, 12, 0, 7); ctx.fill();
    ctx.fillStyle='#17110c'; ctx.beginPath(); ctx.arc(cx+s*52, cy-28, 5.5, 0, 7); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx+s*52-4, cy-32, 2.5, 0, 7); ctx.fill();
  }
  // nose
  ctx.strokeStyle='#a87f5e'; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx, cy-18); ctx.lineTo(cx-10, cy+34); ctx.lineTo(cx+10, cy+36); ctx.stroke();
  // mouth
  ctx.fillStyle='#a85d55'; ctx.beginPath(); ctx.ellipse(cx, cy+80, 42, 15, 0, 0, 7); ctx.fill();
  ctx.strokeStyle='#8a4a44'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx-42,cy+80); ctx.lineTo(cx+42,cy+80); ctx.stroke();
  // hair
  ctx.fillStyle='#3a2a1f'; ctx.beginPath(); ctx.ellipse(cx, cy-120, 126, 74, 0, Math.PI, 2*Math.PI); ctx.fill();
  return canvas;
}`;
