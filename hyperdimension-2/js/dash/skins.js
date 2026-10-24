/* ============================================================================
 * HyperDash — dash/skins.js
 * Stile cartoon: tutto disegnato in Canvas 2D con contorni spessi e colori
 * pieni. 40 skin (10 per cubo / nave / palla / wave), 16 palette, 8 scie,
 * 10 mondi a tema.
 * ========================================================================== */
(function (root) {
  'use strict';
  const D = ((root.HD = root.HD || {}).dash = root.HD.dash || {});
  const PI = Math.PI, TAU = PI * 2, { sin, cos, abs, min, max } = Math;
  const OUT = '#1b1230';

  D.COLORS = ['#ffd23f', '#ff5d5d', '#ff9f43', '#7bed4f', '#2ee6a8', '#35c4ff', '#4d7cff', '#a66bff', '#ff6bd5', '#ffffff', '#c9d3e0', '#5a6579', '#a8643a', '#00d4c8', '#ff3b7a', '#1f1f2e'];
  D.SKIN_NAMES = {
    cube: ['Classic', 'Smile', 'Grumpy', 'Robot', 'Kitty', 'Ninja', 'Pixel', 'Skull', 'King', 'Star'],
    ship: ['Rocket', 'UFO', 'Jet', 'Submarine', 'Blimp', 'Hover', 'Bird', 'Shark', 'Dragon', 'Comet'],
    ball: ['Orb', 'Smiley', 'Beach', 'Basket', 'Eight', 'Lady', 'Planet', 'Eyeball', 'Pumpkin', 'Disco'],
    wave: ['Dart', 'Diamond', 'Arrow', 'Paper', 'Bolt', 'Fish', 'Kite', 'Heart', 'Star', 'Shuriken'],
  };
  D.TRAILS = ['None', 'Dust', 'Sparks', 'Fire', 'Bubbles', 'Hearts', 'Stars', 'Rainbow'];
  D.skinCost = (k) => [0, 3, 8, 15, 25, 40, 60, 85, 115, 150][k];
  D.colorCost = (k) => k * 5;               // monete totali
  D.trailCost = (k) => [0, 4, 10, 20, 32, 48, 70, 100][k];

  /* ------------------------------------------------------------ helpers -- */
  function rr(c, x, y, w, h, r) {
    r = min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }
  D.shade = shade; D.rr = rr;
  function fillOut(c, fill, lw) { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke(); }
  function eyes(c, s, kind) {
    const ex = s * 0.2, ey = -s * 0.06, er = s * 0.12;
    for (const sx of [-1, 1]) {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sx * ex, ey, er, 0, TAU); c.fill(); c.lineWidth = s * 0.05; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = OUT; c.beginPath(); c.arc(sx * ex + s * 0.03, ey + s * 0.01, er * 0.5, 0, TAU); c.fill();
      if (kind === 'angry') { c.beginPath(); c.moveTo(sx * ex - sx * er * 1.3, ey - er * 1.5 + (sx < 0 ? 0 : 0)); c.lineTo(sx * ex + sx * er * 1.1, ey - er * 0.7 - sx * -er * 0.0); c.lineWidth = s * 0.08; c.strokeStyle = OUT; c.stroke(); }
    }
  }
  function mouth(c, s, kind) {
    c.strokeStyle = OUT; c.lineWidth = s * 0.06; c.lineCap = 'round'; c.beginPath();
    if (kind === 'smile') c.arc(0, s * 0.08, s * 0.2, 0.15 * PI, 0.85 * PI);
    else if (kind === 'frown') c.arc(0, s * 0.34, s * 0.18, 1.2 * PI, 1.8 * PI);
    else { c.moveTo(-s * 0.15, s * 0.22); c.lineTo(s * 0.15, s * 0.22); }
    c.stroke();
  }
  function star(c, r, ri, n) { c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, q = i % 2 ? ri : r; c.lineTo(cos(a) * q, sin(a) * q); } c.closePath(); }

  /* ---------------------------------------------------------------- cubo -- */
  function drawCube(c, k, s, c1, c2) {
    const h = s / 2, lw = s * 0.09;
    // antenne/orecchie dietro
    if (k === 4) { for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * h * 0.95, -h * 0.7); c.lineTo(sx * h * 0.55, -h * 1.25); c.lineTo(sx * h * 0.2, -h * 0.9); c.closePath(); fillOut(c, c1, lw * 0.9); } }
    if (k === 3) { c.beginPath(); c.moveTo(0, -h); c.lineTo(0, -h * 1.35); c.lineWidth = lw * 0.7; c.strokeStyle = OUT; c.stroke(); c.beginPath(); c.arc(0, -h * 1.42, h * 0.12, 0, TAU); fillOut(c, c2, lw * 0.6); }
    rr(c, -h, -h, s, s, s * 0.14); fillOut(c, c1, lw);
    // luce
    rr(c, -h + lw, -h + lw, s - lw * 2, s * 0.22, s * 0.08); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
    const inner = () => { rr(c, -h * 0.62, -h * 0.62, s * 0.62, s * 0.62, s * 0.08); };
    switch (k) {
      case 0: inner(); fillOut(c, c2, lw * 0.7); eyes(c, s, ''); break;
      case 1: eyes(c, s, ''); mouth(c, s, 'smile'); break;
      case 2: eyes(c, s, 'angry'); mouth(c, s, 'frown'); break;
      case 3: rr(c, -h * 0.78, -h * 0.5, s * 0.78, s * 0.34, s * 0.1); fillOut(c, c2, lw * 0.7); c.fillStyle = '#fff'; for (const sx of [-0.28, 0.28]) { c.beginPath(); c.arc(sx * s, -h * 0.33, s * 0.07, 0, TAU); c.fill(); } mouth(c, s, 'flat'); break;
      case 4: eyes(c, s, ''); c.strokeStyle = OUT; c.lineWidth = s * 0.035; for (const sx of [-1, 1]) for (const dy of [-0.04, 0.06]) { c.beginPath(); c.moveTo(sx * h * 0.55, h * 0.18 + dy * s); c.lineTo(sx * h * 1.1, h * 0.12 + dy * s * 2); c.stroke(); } c.fillStyle = c2; c.beginPath(); c.moveTo(-s * 0.06, s * 0.12); c.lineTo(s * 0.06, s * 0.12); c.lineTo(0, s * 0.2); c.fill(); break;
      case 5: rr(c, -h, -h * 0.5, s, s * 0.28, 0); c.fillStyle = c2; c.fill(); c.strokeStyle = OUT; c.lineWidth = lw * 0.6; c.stroke(); for (const sx of [-1, 1]) { c.fillStyle = '#fff'; c.fillRect(sx * s * 0.2 - s * 0.1, -h * 0.4, s * 0.2, s * 0.08); } break;
      case 6: { const n = 4, q = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) & 1) { c.fillStyle = c2; c.fillRect(-h + i * q + lw * 0.5, -h + j * q + lw * 0.5, q - lw * 0.5, q - lw * 0.5); } c.strokeStyle = OUT; c.lineWidth = lw * 0.7; rr(c, -h, -h, s, s, s * 0.14); c.stroke(); break; }
      case 7: c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(0, -h * 0.1, h * 0.62, 0, TAU); c.fill(); c.lineWidth = lw * 0.6; c.strokeStyle = OUT; c.stroke(); c.fillStyle = OUT; for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * h * 0.28, -h * 0.15, h * 0.18, 0, TAU); c.fill(); } c.fillRect(-h * 0.06, h * 0.12, h * 0.12, h * 0.16); break;
      case 8: c.beginPath(); c.moveTo(-h * 0.8, -h * 0.55); c.lineTo(-h * 0.8, -h * 1.25); c.lineTo(-h * 0.4, -h * 0.85); c.lineTo(0, -h * 1.35); c.lineTo(h * 0.4, -h * 0.85); c.lineTo(h * 0.8, -h * 1.25); c.lineTo(h * 0.8, -h * 0.55); c.closePath(); fillOut(c, '#ffd23f', lw * 0.8); eyes(c, s, ''); mouth(c, s, 'smile'); break;
      case 9: c.save(); c.translate(0, 0); star(c, h * 0.62, h * 0.28, 5); fillOut(c, c2, lw * 0.7); c.restore(); break;
    }
  }

  /* --------------------------------------------------------------- palla -- */
  function drawBall(c, k, s, c1, c2) {
    const r = s / 2, lw = s * 0.09;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); fillOut(c, c1, lw);
    c.save(); c.beginPath(); c.arc(0, 0, r - lw * 0.4, 0, TAU); c.clip();
    c.strokeStyle = OUT; c.lineWidth = lw * 0.7;
    switch (k) {
      case 0: c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fillStyle = c2; c.fill(); c.stroke(); break;
      case 1: break;
      case 2: for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r * 1.2, i * TAU / 3, i * TAU / 3 + TAU / 6); c.closePath(); c.fillStyle = c2; c.fill(); } for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(cos(i * PI / 3) * r, sin(i * PI / 3) * r); c.stroke(); } break;
      case 3: c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); c.stroke(); c.beginPath(); c.arc(-r * 1.15, 0, r * 0.75, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(r * 1.15, 0, r * 0.75, PI - 0.9, PI + 0.9); c.stroke(); break;
      case 4: c.fillStyle = '#1d1d2b'; c.fillRect(-r, -r, s, s); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r * 0.5, 0, TAU); c.fill(); c.fillStyle = OUT; c.font = `900 ${s * 0.5}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('8', 0, s * 0.03); break;
      case 5: c.fillStyle = OUT; c.fillRect(-r * 0.05, -r, r * 0.1, s); for (const [x, y] of [[-0.45, -0.25], [0.45, -0.25], [-0.35, 0.35], [0.35, 0.35]]) { c.beginPath(); c.arc(x * r, y * r, r * 0.17, 0, TAU); c.fill(); } c.fillStyle = OUT; c.beginPath(); c.arc(0, -r * 0.85, r * 0.45, PI, 0); c.fill(); break;
      case 6: c.fillStyle = c2; c.fillRect(-r, -r * 0.18, s, r * 0.36); c.strokeRect(-r, -r * 0.18, s, r * 0.36); c.beginPath(); c.ellipse(0, 0, r * 1.35, r * 0.28, -0.35, 0, TAU); c.stroke(); break;
      case 7: c.fillStyle = '#fff'; c.fillRect(-r, -r, s, s); c.fillStyle = c2; c.beginPath(); c.arc(r * 0.1, 0, r * 0.5, 0, TAU); c.fill(); c.fillStyle = OUT; c.beginPath(); c.arc(r * 0.18, 0, r * 0.25, 0, TAU); c.fill(); c.strokeStyle = '#ff6b6b'; c.lineWidth = lw * 0.3; for (const a of [0.5, 2.2, 3.7]) { c.beginPath(); c.moveTo(cos(a) * r, sin(a) * r); c.lineTo(cos(a) * r * 0.6, sin(a) * r * 0.6); c.stroke(); } break;
      case 8: for (const sx of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(sx * r, 0, r * 0.3, r, 0, 0, TAU); c.stroke(); } c.fillStyle = OUT; c.beginPath(); c.moveTo(-r * 0.55, -r * 0.05); c.lineTo(-r * 0.3, -r * 0.4); c.lineTo(-r * 0.05, -r * 0.05); c.moveTo(r * 0.55, -r * 0.05); c.lineTo(r * 0.3, -r * 0.4); c.lineTo(r * 0.05, -r * 0.05); c.fill(); c.beginPath(); c.moveTo(-r * 0.5, r * 0.3); c.lineTo(-r * 0.25, r * 0.5); c.lineTo(0, r * 0.3); c.lineTo(r * 0.25, r * 0.5); c.lineTo(r * 0.5, r * 0.3); c.stroke(); c.fillStyle = '#4caf50'; c.fillRect(-r * 0.08, -r * 1.05, r * 0.16, r * 0.3); break;
      case 9: for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { c.fillStyle = (i + j) & 1 ? c2 : 'rgba(255,255,255,.55)'; c.fillRect(i * r * 0.4 - r * 0.2, j * r * 0.4 - r * 0.2, r * 0.4, r * 0.4); } c.lineWidth = lw * 0.3; for (let i = -2; i <= 3; i++) { c.beginPath(); c.moveTo(i * r * 0.4 - r * 0.2, -r); c.lineTo(i * r * 0.4 - r * 0.2, r); c.moveTo(-r, i * r * 0.4 - r * 0.2); c.lineTo(r, i * r * 0.4 - r * 0.2); c.stroke(); } break;
    }
    c.restore();
    if (k === 1 || k === 0 || k === 7) { /* faccia o riflesso */ }
    if (k === 1) { eyes(c, s, ''); mouth(c, s, 'smile'); }
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke();
    c.beginPath(); c.arc(-r * 0.35, -r * 0.4, r * 0.18, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
  }

  /* ---------------------------------------------------------------- nave -- */
  function drawShip(c, k, s, c1, c2) {
    const lw = s * 0.08, w = s * 1.15, h = s * 0.55;
    const cubeFace = () => { c.save(); c.translate(w * 0.02, -h * 0.55); drawCube(c, 1, s * 0.5, c2, c1); c.restore(); };
    switch (k % 5) {
      case 0: // razzo
        c.beginPath(); c.moveTo(-w * 0.5, -h * 0.28); c.lineTo(-w * 0.78, -h * 0.75); c.lineTo(-w * 0.35, -h * 0.55); c.lineTo(-w * 0.35, h * 0.55); c.lineTo(-w * 0.78, h * 0.75); c.lineTo(-w * 0.5, h * 0.28); c.closePath(); fillOut(c, c2, lw);
        c.beginPath(); c.moveTo(-w * 0.55, -h * 0.4); c.quadraticCurveTo(0, -h * 0.75, w * 0.62, 0); c.quadraticCurveTo(0, h * 0.75, -w * 0.55, h * 0.4); c.closePath(); fillOut(c, c1, lw);
        cubeFace(); break;
      case 1: // ufo
        cubeFace(); c.beginPath(); c.ellipse(0, h * 0.1, w * 0.58, h * 0.4, 0, 0, TAU); fillOut(c, c1, lw);
        c.fillStyle = c2; for (const x of [-0.35, 0, 0.35]) { c.beginPath(); c.arc(x * w, h * 0.12, h * 0.1, 0, TAU); c.fill(); } break;
      case 2: // jet
        c.beginPath(); c.moveTo(-w * 0.62, -h * 0.7); c.lineTo(-w * 0.3, -h * 0.1); c.lineTo(-w * 0.62, h * 0.0); c.closePath(); fillOut(c, c2, lw);
        c.beginPath(); c.moveTo(w * 0.65, h * 0.05); c.lineTo(w * 0.1, -h * 0.35); c.lineTo(-w * 0.6, -h * 0.25); c.lineTo(-w * 0.5, h * 0.4); c.lineTo(w * 0.3, h * 0.4); c.closePath(); fillOut(c, c1, lw);
        cubeFace(); break;
      case 3: // sottomarino
        c.fillStyle = OUT; c.fillRect(-w * 0.02, -h * 0.9, w * 0.08, h * 0.5); c.fillRect(-w * 0.02, -h * 0.9, w * 0.2, h * 0.1);
        c.beginPath(); rr(c, -w * 0.62, -h * 0.4, w * 1.2, h * 0.85, h * 0.4); fillOut(c, c1, lw);
        c.beginPath(); c.arc(w * 0.1, h * 0.02, h * 0.22, 0, TAU); fillOut(c, '#bfefff', lw * 0.8); c.beginPath(); c.arc(w * 0.1, h * 0.02, h * 0.1, 0, TAU); c.fillStyle = c2; c.fill();
        c.beginPath(); c.moveTo(-w * 0.62, 0); c.lineTo(-w * 0.85, -h * 0.35); c.lineTo(-w * 0.85, h * 0.35); c.closePath(); fillOut(c, c2, lw); break;
      case 4: // dirigibile
        c.beginPath(); c.ellipse(0, -h * 0.1, w * 0.62, h * 0.5, 0, 0, TAU); fillOut(c, c1, lw);
        c.beginPath(); c.moveTo(-w * 0.5, -h * 0.15); c.lineTo(-w * 0.8, -h * 0.55); c.lineTo(-w * 0.8, h * 0.3); c.closePath(); fillOut(c, c2, lw);
        rr(c, -w * 0.18, h * 0.3, w * 0.4, h * 0.3, h * 0.1); fillOut(c, c2, lw * 0.8); cubeFace(); break;
    }
    if (k >= 5) { // decorazioni delle varianti 5-9
      c.save(); c.lineWidth = lw * 0.5; c.strokeStyle = OUT;
      if (k === 5) { c.fillStyle = '#fff'; c.fillRect(-w * 0.25, -h * 0.12, w * 0.5, h * 0.12); }
      if (k === 6) { c.beginPath(); c.moveTo(w * 0.62, -h * 0.05); c.lineTo(w * 0.85, h * 0.05); c.lineTo(w * 0.62, h * 0.15); c.closePath(); fillOut(c, '#ffb020', lw * 0.7); }
      if (k === 7) { c.beginPath(); c.moveTo(-w * 0.1, -h * 0.4); c.lineTo(0, -h * 0.85); c.lineTo(w * 0.12, -h * 0.4); c.closePath(); fillOut(c, c2, lw * 0.8); }
      if (k === 8) { for (const x of [-0.3, 0, 0.3]) { c.beginPath(); c.moveTo(x * w - w * 0.07, -h * 0.35); c.lineTo(x * w, -h * 0.6); c.lineTo(x * w + w * 0.07, -h * 0.35); c.closePath(); fillOut(c, c2, lw * 0.6); } }
      if (k === 9) { c.save(); c.translate(-w * 0.15, h * 0.15); star(c, h * 0.2, h * 0.09, 5); fillOut(c, '#fff', lw * 0.5); c.restore(); }
      c.restore();
    }
  }

  /* ---------------------------------------------------------------- wave -- */
  function drawWave(c, k, s, c1, c2) {
    const r = s * 0.5, lw = s * 0.09;
    c.beginPath();
    switch (k) {
      case 0: c.moveTo(r, 0); c.lineTo(-r * 0.8, -r * 0.8); c.lineTo(-r * 0.4, 0); c.lineTo(-r * 0.8, r * 0.8); break;
      case 1: c.moveTo(r, 0); c.lineTo(0, -r * 0.8); c.lineTo(-r, 0); c.lineTo(0, r * 0.8); break;
      case 2: c.moveTo(r, 0); c.lineTo(0, -r * 0.9); c.lineTo(0, -r * 0.35); c.lineTo(-r, -r * 0.35); c.lineTo(-r, r * 0.35); c.lineTo(0, r * 0.35); c.lineTo(0, r * 0.9); break;
      case 3: c.moveTo(r, 0); c.lineTo(-r, -r * 0.7); c.lineTo(-r * 0.45, 0); c.lineTo(-r, r * 0.7); break;
      case 4: c.moveTo(r * 0.9, -r * 0.2); c.lineTo(-r * 0.1, -r * 0.2); c.lineTo(r * 0.2, -r * 0.9); c.lineTo(-r * 0.9, r * 0.25); c.lineTo(r * 0.05, r * 0.25); c.lineTo(-r * 0.3, r * 0.9); break;
      case 5: c.moveTo(r, 0); c.quadraticCurveTo(0, -r * 0.9, -r * 0.5, 0); c.lineTo(-r, -r * 0.6); c.lineTo(-r, r * 0.6); c.lineTo(-r * 0.5, 0); c.quadraticCurveTo(0, r * 0.9, r, 0); break;
      case 6: c.moveTo(r, 0); c.lineTo(0, -r * 0.7); c.lineTo(-r * 0.9, 0); c.lineTo(0, r * 0.7); break;
      case 7: c.moveTo(r * 0.9, 0); c.bezierCurveTo(r * 0.5, -r, -r * 0.2, -r * 0.9, -r * 0.7, -r * 0.5); c.lineTo(-r * 0.7, r * 0.5); c.bezierCurveTo(-r * 0.2, r * 0.9, r * 0.5, r, r * 0.9, 0); break;
      case 8: star(c, r, r * 0.45, 5); break;
      case 9: for (let i = 0; i < 4; i++) { const a = i * PI / 2; c.lineTo(cos(a) * r, sin(a) * r); c.lineTo(cos(a + PI / 4) * r * 0.25, sin(a + PI / 4) * r * 0.25); } c.closePath(); break;
    }
    c.closePath(); fillOut(c, c1, lw);
    c.beginPath(); c.arc(r * 0.12, 0, r * 0.22, 0, TAU); fillOut(c, c2, lw * 0.7);
    if (k === 5) { c.beginPath(); c.arc(r * 0.45, -r * 0.1, r * 0.08, 0, TAU); c.fillStyle = OUT; c.fill(); }
  }

  /** Disegna il giocatore centrato in (0,0) con dimensione s (px), già ruotato dal chiamante. */
  D.drawPlayer = function (c, mode, skin, s, c1, c2) {
    c.save(); c.lineCap = 'round';
    (mode === 0 ? drawCube : mode === 1 ? drawShip : mode === 2 ? drawBall : drawWave)(c, skin, s, c1, c2);
    c.restore();
  };

  /* --------------------------------------------------------------- mondi -- */
  D.WORLDS = [
    { n: ['Green Meadow', 'Prato Verde'], sky: ['#66d0ff', '#c8f2ff'], far: '#8fdc9a', near: '#4fbf6a', ground: '#7a5230', top: '#4fd05a', block: '#a9714a', blockTop: '#5ed65a', deco: 'clouds', acc: '#ffd23f' },
    { n: ['Sun Desert', 'Deserto'], sky: ['#ffb36b', '#ffe6a8'], far: '#ffcf7a', near: '#f0a24a', ground: '#c9843c', top: '#f2c16b', block: '#d9954d', blockTop: '#f7cf86', deco: 'dunes', acc: '#ff6b3d' },
    { n: ['Ice Land', 'Terra di Ghiaccio'], sky: ['#8fd4ff', '#eaf9ff'], far: '#cdeeff', near: '#9fd9f5', ground: '#6fb0d8', top: '#e8fbff', block: '#7cc3ea', blockTop: '#e8fbff', deco: 'snow', acc: '#4d7cff' },
    { n: ['Wild Jungle', 'Giungla'], sky: ['#2b8a6e', '#8fe0a0'], far: '#2f9e5f', near: '#1f7a4a', ground: '#4a3220', top: '#3fbf5f', block: '#7a5a38', blockTop: '#4cc063', deco: 'vines', acc: '#ffd23f' },
    { n: ['Lava Cave', 'Vulcano'], sky: ['#5a1b2e', '#ff7a3d'], far: '#7a2a2a', near: '#4a1a22', ground: '#2d1318', top: '#ff7a2e', block: '#4b2a30', blockTop: '#ff8a3d', deco: 'embers', acc: '#ffdd55' },
    { n: ['Sunset City', 'Città'], sky: ['#ff8fb1', '#ffd9a0'], far: '#b86a9c', near: '#8a4a86', ground: '#3a2a52', top: '#6a4a9a', block: '#5a3f86', blockTop: '#8f6fd0', deco: 'city', acc: '#35c4ff' },
    { n: ['Deep Space', 'Spazio'], sky: ['#0b0f3a', '#2a1a6a'], far: '#3a2a8a', near: '#25196a', ground: '#1a1450', top: '#6a5aff', block: '#2c2a7a', blockTop: '#6a6aff', deco: 'stars', acc: '#ffd23f' },
    { n: ['Candy Land', 'Dolcilandia'], sky: ['#ffc2e6', '#fff0fa'], far: '#ffb0d8', near: '#ff8cc6', ground: '#d96a9c', top: '#fff', block: '#ff7eb6', blockTop: '#ffd0e8', deco: 'sprinkles', acc: '#35c4ff' },
    { n: ['Abyss', 'Abisso'], sky: ['#073b66', '#0b8aa8'], far: '#0a5a86', near: '#07456a', ground: '#052b45', top: '#17c1c1', block: '#0c5a7a', blockTop: '#2fd0d0', deco: 'bubbles', acc: '#ffd23f' },
    { n: ['4th Dimension', 'Quarta Dimensione'], sky: ['#1a0b3a', '#5a1a8a'], far: '#7a2ab0', near: '#4a1a80', ground: '#240f4a', top: '#ff3dcb', block: '#3a1a6a', blockTop: '#ff6be0', deco: 'hyper', acc: '#00e5ff' },
  ];
  D.DIFF_NAMES = [['Easy', 'Facile'], ['Normal', 'Normale'], ['Hard', 'Difficile'], ['Harder', 'Molto difficile'], ['Insane', 'Folle'], ['Demon', 'Demone']];
  D.diffOf = (i) => Math.min(5, Math.floor(D.levelParams(i).d * 6));
  D.levelName = (i) => {
    const A = ['Sunny', 'Jumpy', 'Spiky', 'Bouncy', 'Zippy', 'Wobbly', 'Rowdy', 'Crazy', 'Snappy', 'Mighty', 'Dizzy', 'Fuzzy', 'Funky', 'Turbo', 'Lucky', 'Sneaky', 'Giga', 'Hyper', 'Atomic', 'Cosmic'];
    const B = ['Run', 'Rush', 'Dash', 'Hop', 'Maze', 'Road', 'Climb', 'Zone', 'Rally', 'Gauntlet', 'Trail', 'Dive', 'Sprint', 'Loop', 'Blitz', 'Chase', 'Surge', 'Drift', 'Storm', 'Fury'];
    return A[(i * 7 + 3) % 20] + ' ' + B[(i * 11 + 5) % 20];
  };
})(typeof window !== 'undefined' ? window : globalThis);
