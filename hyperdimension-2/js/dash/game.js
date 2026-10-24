/* ============================================================================
 * HyperDash — dash/game.js
 * Render cartoon in Canvas 2D, audio procedurale, loop di gioco, menu, selettore
 * livelli, garage, modalità allenamento. Il motore (engine.js) è lo stesso che
 * il solver ha usato per verificare i 200 livelli.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, D = HD.dash;
  const { sin, cos, abs, min, max, floor, PI, atan2 } = Math, TAU = PI * 2;
  const C = D.C, OUT = '#1b1230';
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k]; else if (k.startsWith('on')) e[k] = attrs[k]; else e.setAttribute(k, attrs[k]); }
    (kids || []).forEach((c) => e.appendChild(c));
    return e;
  }

  /* ------------------------------------------------------------- i18n -- */
  const TX = {
    en: { play: 'PLAY', levels: 'LEVELS', garage: 'GARAGE', engine: '4D ENGINE', settings: 'Settings', back: 'Back', world: 'World', coins: 'Coins', done: 'Completed', cont: 'Continue',
      practice: 'Practice', resume: 'Resume', restart: 'Restart', quit: 'Levels', complete: 'LEVEL COMPLETE!', next: 'Next level', replay: 'Replay', attempts: 'Attempts', time: 'Time', best: 'Best',
      tap: 'TAP / SPACE to start', cube: 'Cube', ship: 'Ship', ball: 'Ball', wave: 'Wave', colors: 'Colors', trails: 'Trails', locked: 'coins', music: 'Music', sfx: 'Sound FX', lang: 'Language',
      newunlock: 'New unlock!', tagline: 'Jump. Dash. Switch dimension.', reset: 'Reset progress', sure: 'Delete all progress?', c1: 'Main color', c2: 'Second color',
      help: 'Hold or tap to jump · portals change your form · purple portals swap the 4D layer · collect 3 coins', paused: 'PAUSED', crash: 'Crash!', hint4d: '4D layer', place: 'Checkpoint', remove: 'Remove' },
    it: { play: 'GIOCA', levels: 'LIVELLI', garage: 'GARAGE', engine: 'MOTORE 4D', settings: 'Impostazioni', back: 'Indietro', world: 'Mondo', coins: 'Monete', done: 'Completati', cont: 'Continua',
      practice: 'Allenamento', resume: 'Riprendi', restart: 'Ricomincia', quit: 'Livelli', complete: 'LIVELLO COMPLETATO!', next: 'Livello successivo', replay: 'Rigioca', attempts: 'Tentativi', time: 'Tempo', best: 'Record',
      tap: 'TOCCA / SPAZIO per partire', cube: 'Cubo', ship: 'Nave', ball: 'Palla', wave: 'Wave', colors: 'Colori', trails: 'Scie', locked: 'monete', music: 'Musica', sfx: 'Effetti', lang: 'Lingua',
      newunlock: 'Nuovo sblocco!', tagline: 'Salta. Scatta. Cambia dimensione.', reset: 'Azzera progressi', sure: 'Cancellare tutti i progressi?', c1: 'Colore principale', c2: 'Colore secondario',
      help: 'Tieni premuto o tocca per saltare · i portali cambiano forma · i portali viola scambiano il livello 4D · raccogli 3 monete', paused: 'PAUSA', crash: 'Botto!', hint4d: 'Livello 4D', place: 'Checkpoint', remove: 'Rimuovi' },
  };
  const lg = () => (HD.i18n && HD.i18n.lang === 'it' ? 'it' : 'en');
  const T = (k) => TX[lg()][k] || TX.en[k] || k;
  const worldName = (w) => D.WORLDS[w].n[lg() === 'it' ? 1 : 0];
  const diffName = (d) => D.DIFF_NAMES[d][lg() === 'it' ? 1 : 0];

  /* ---------------------------------------------------------- storage -- */
  const KEY = 'hd.dash.v1';
  let save = { done: {}, best: {}, coins: {}, sel: { cube: 0, ship: 0, ball: 0, wave: 0, c1: 0, c2: 5, trail: 1 }, music: true, sfx: true, last: 0 };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { save = Object.assign(save, s); save.sel = Object.assign({ cube: 0, ship: 0, ball: 0, wave: 0, c1: 0, c2: 5, trail: 1 }, s.sel); } } catch (e) { /* memoria */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* ignora */ } };
  const popc = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
  const totalCoins = () => { let n = 0; for (const k in save.coins) n += popc(save.coins[k]); return n; };
  const totalDone = () => Object.keys(save.done).length;

  /* ------------------------------------------------------------ audio -- */
  const A = { ctx: null, master: null, music: null, step: 0, next: 0, timer: 0, bpm: 132, root: 0 };
  function audioInit() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { return; }
    A.master = A.ctx.createGain(); A.master.gain.value = 0.55; A.master.connect(A.ctx.destination);
    A.mus = A.ctx.createGain(); A.mus.gain.value = save.music ? 0.5 : 0; A.mus.connect(A.master);
    A.sfxg = A.ctx.createGain(); A.sfxg.gain.value = save.sfx ? 1 : 0; A.sfxg.connect(A.master);
    const len = A.ctx.sampleRate * 0.5, buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
  }
  function tone(f, t0, dur, type, vol, dest, slide) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.03);
  }
  function noiseHit(t0, dur, vol, dest, freq) {
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noise; f.type = 'bandpass'; f.frequency.value = freq || 1500; g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function sfx(name) {
    if (!A.ctx || !save.sfx) return; const t = A.ctx.currentTime, d = A.sfxg;
    switch (name) {
      case 'jump': tone(380, t, 0.13, 'square', 0.1, d, 720); break;
      case 'land': tone(140, t, 0.07, 'sine', 0.12, d, 90); break;
      case 'coin': [76, 83, 88].forEach((n, i) => tone(NOTE(n), t + i * 0.06, 0.16, 'triangle', 0.2, d)); break;
      case 'pad': tone(300, t, 0.25, 'sawtooth', 0.09, d, 1200); break;
      case 'orb': tone(520, t, 0.18, 'triangle', 0.18, d, 1040); break;
      case 'portal': tone(220, t, 0.35, 'sawtooth', 0.08, d, 880); tone(330, t + 0.02, 0.35, 'square', 0.05, d, 1320); break;
      case 'dim': for (let i = 0; i < 4; i++) tone(NOTE(72 + i * 5), t + i * 0.045, 0.2, 'sine', 0.16, d); break;
      case 'death': noiseHit(t, 0.35, 0.4, d, 900); tone(220, t, 0.4, 'sawtooth', 0.14, d, 45); break;
      case 'win': [72, 76, 79, 84, 88].forEach((n, i) => tone(NOTE(n), t + i * 0.09, 0.4, 'square', 0.1, d)); break;
      case 'click': tone(660, t, 0.05, 'square', 0.06, d); break;
    }
  }
  const SCALES = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 7, 8]];
  function musicTick() {
    if (!A.ctx || !save.music || !G.musicOn) return;
    const c = A.ctx, spb = 60 / A.bpm / 4;                                  // 16esimi
    while (A.next < c.currentTime + 0.25) {
      const s = A.step, t = A.next, root = 40 + A.root, sc = SCALES[A.scale || 0], bar = floor(s / 16) % 4;
      if (s % 4 === 0) { tone(110, t, 0.12, 'sine', 0.55, A.mus, 40); }                         // kick
      if (s % 4 === 2) noiseHit(t, 0.05, 0.18, A.mus, 7000);                                    // hat
      if (s % 8 === 4) noiseHit(t, 0.12, 0.22, A.mus, 1800);                                    // snare
      if (s % 2 === 0) tone(NOTE(root + [0, 0, 5, 7][bar] - 12 + (s % 8 === 6 ? 12 : 0)), t, spb * 1.6, 'triangle', 0.4, A.mus);   // basso
      const idx = (s * 3 + bar * 2 + (s >> 3)) % 5, oct = (s % 16 < 8 ? 0 : 12) + 12;
      if (s % 2 === 1 || s % 8 === 0) tone(NOTE(root + 12 + oct + sc[idx]), t, spb * 1.4, 'square', 0.07, A.mus);
      A.next += spb; A.step++;
      G.beatT = t;
    }
  }
  function startMusic(world) {
    audioInit(); if (!A.ctx) return;
    A.root = [0, 2, -2, 3, -5, 5, 7, 4, -3, 1][world % 10]; A.scale = world % 3; A.bpm = 124 + (world % 5) * 4;
    if (!A.timer) { A.next = A.ctx.currentTime + 0.05; A.step = 0; A.timer = setInterval(musicTick, 80); }
    G.musicOn = true;
  }
  function stopMusic() { G.musicOn = false; if (A.timer) { clearInterval(A.timer); A.timer = 0; } }

  /* ----------------------------------------------------------- stato -- */
  const G = {
    open: false, screen: 'home', canvas: null, ctx: null, W: 0, H: 0, dpr: 1, L: null, S: null, li: 0, practice: false, attempts: 1, wait: true, state: 'menu',
    held: false, keys: {}, acc: 0, last: 0, parts: [], wave: [], vrot: 0, shake: 0, flash: 0, flashC: '#fff', deadT: 0, cp: null, cps: [], time: 0, ev: [],
    att: { i: 0, list: [3, 47, 104, 160, 192, 71, 131], L: null, S: null, ins: null }, camX: 0, musicOn: false, beatT: 0, coinMask: 0, newUnl: [], cpTimer: 0,
  };
  D.game = G;

  /* ----------------------------------------------------------- render -- */
  const rnd = (n) => { const x = sin(n * 127.1) * 43758.5453; return x - floor(x); };
  const PCOL = { cube: '#ffd23f', ship: '#ff6bd5', ball: '#ff9f43', wave: '#35c4ff', gn: '#35c4ff', gf: '#ffd23f', sn: '#7bed4f', sm: '#ff6bd5', s0: '#ffd23f', s1: '#35c4ff', s2: '#7bed4f', s3: '#ff5d5d', d0: '#ff9f43', d1: '#35e0ff', dx: '#a66bff' };
  const LAYC = ['#ff9f43', '#35e0ff'];

  function view() {
    const s = min(G.H / 12.1, G.W / 15), oy = (G.H - 12.1 * s) / 2;
    return { s, oy, vw: G.W / s };
  }

  function drawBg(c, th, camX, t, v, pulse, layer) {
    const W = G.W, H = G.H, s = v.s;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const base = H - (1.1 * s) - v.oy;
    const hills = (col, par, amp, freq, off, ph) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W + 8; x += 8) { const wx = x / s + camX * par; c.lineTo(x, base - off * s - (sin(wx * freq + ph) * 0.5 + 0.5 + sin(wx * freq * 2.3 + ph * 2) * 0.25) * amp * s); }
      c.lineTo(W, H); c.closePath(); c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(27,18,48,.55)'; c.stroke();
    };
    const d = th.deco;
    if (d === 'stars' || d === 'hyper') {
      for (let i = 0; i < 70; i++) { const x = ((rnd(i) * 40 - camX * 0.05 * (1 + rnd(i + 9))) % 40 + 40) % 40 / 40 * W, y = rnd(i + 3) * H * 0.85, r = (0.5 + rnd(i + 7) * 1.5) * (0.6 + 0.4 * sin(t * 2 + i)); c.fillStyle = '#fff'; c.globalAlpha = 0.5 + 0.5 * rnd(i + 5); c.beginPath(); c.arc(x, y, r * s * 0.045 + 0.5, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
    if (d === 'clouds' || d === 'sprinkles') {
      for (let i = 0; i < 7; i++) {
        const x = (((rnd(i) * 60 - camX * 0.1 * (0.6 + rnd(i + 2)) - t * 0.15) % 60) + 60) % 60 / 60 * (W + 400) - 200, y = (0.5 + rnd(i + 5) * 3) * s + v.oy, r = (1 + rnd(i + 8) * 0.9) * s;
        c.fillStyle = d === 'clouds' ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.7)';
        c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.arc(x + r * 0.6, y + r * 0.1, r * 0.45, 0, TAU); c.arc(x - r * 0.6, y + r * 0.12, r * 0.4, 0, TAU); c.rect(x - r * 0.6, y + r * 0.1, r * 1.2, r * 0.42); c.fill();
      }
    }
    if (d === 'dunes') { c.fillStyle = '#fff6c9'; c.beginPath(); c.arc(W * 0.78, v.oy + 2.4 * s, 1.5 * s, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke(); }
    if (d === 'city') {
      const par = 0.2; for (let i = 0; i < 40; i++) {
        const bw = (1.4 + rnd(i) * 1.8) * s, bx = ((i * 2.4 * s - camX * par * s) % (40 * 2.4 * s) + 40 * 2.4 * s) % (40 * 2.4 * s) - 2 * s, bh = (3 + rnd(i + 4) * 5) * s;
        c.fillStyle = th.far; c.fillRect(bx, base - bh, bw, bh); c.strokeStyle = 'rgba(27,18,48,.6)'; c.lineWidth = 3; c.strokeRect(bx, base - bh, bw, bh);
        c.fillStyle = 'rgba(255,230,140,.8)'; for (let yy = 0.5; yy < bh / s - 0.4; yy += 0.9) for (let xx = 0.3; xx < bw / s - 0.4; xx += 0.7) if (rnd(i * 31 + yy * 7 + xx * 13) > 0.55) c.fillRect(bx + xx * s, base - bh + yy * s, 0.3 * s, 0.4 * s);
      }
    } else if (d === 'hyper') {
      c.save(); c.translate(W * 0.6 - (camX * 0.1 * s) % (W * 0.4), v.oy + 5 * s); c.lineWidth = 3; c.strokeStyle = 'rgba(255,61,203,.35)';
      for (let k = 0; k < 2; k++) { const a = t * 0.3 + k * 0.5, r = (3.2 + k * 1.6) * s; c.save(); c.rotate(a); c.strokeRect(-r / 2, -r / 2, r, r); c.restore(); }
      c.strokeStyle = 'rgba(0,229,255,.35)'; const r1 = 3.2 * s, r2 = 4.8 * s, a1 = t * 0.3, a2 = t * 0.3 + 0.5;
      for (let k = 0; k < 4; k++) { const th2 = k * PI / 2 + PI / 4; c.beginPath(); c.moveTo(cos(th2 + a1) * r1 * 0.7071, sin(th2 + a1) * r1 * 0.7071); c.lineTo(cos(th2 + a2) * r2 * 0.7071, sin(th2 + a2) * r2 * 0.7071); c.stroke(); }
      c.restore();
    } else if (d === 'snow') {
      hills('#f4fcff', 0.08, 5, 0.18, 1.6, 1);
    } else if (d === 'bubbles') {
      for (let i = 0; i < 24; i++) { const x = ((rnd(i) * 30 - camX * 0.15 * (0.5 + rnd(i + 1))) % 30 + 30) % 30 / 30 * W, y = H - ((t * (0.3 + rnd(i + 2) * 0.5) * s + rnd(i + 6) * H) % (H + 40)), r = (0.15 + rnd(i + 3) * 0.4) * s; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); }
    }
    if (d !== 'city') { hills(th.far, 0.12, 4, 0.22, 0.9, 2); }
    hills(th.near, 0.28, 2.6, 0.35, 0.2, 5);
    if (d === 'vines') { c.strokeStyle = '#1f7a4a'; c.lineWidth = 5; for (let i = 0; i < 14; i++) { const x = ((i * 3.1 - camX * 0.4) % 43 + 43) % 43 * s - 2 * s, l = (1.5 + rnd(i) * 3.5) * s; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + sin(t + i) * 8, l / 2, x, l); c.stroke(); c.fillStyle = '#3fbf5f'; c.beginPath(); c.arc(x, l, 7, 0, TAU); c.fill(); } }
    if (d === 'embers') { const gl = c.createLinearGradient(0, H * 0.5, 0, H); gl.addColorStop(0, 'rgba(255,120,40,0)'); gl.addColorStop(1, 'rgba(255,120,40,.55)'); c.fillStyle = gl; c.fillRect(0, H * 0.5, W, H * 0.5); for (let i = 0; i < 30; i++) { const x = ((rnd(i) * 30 - camX * 0.3) % 30 + 30) % 30 / 30 * W, y = H - ((t * (0.5 + rnd(i + 2)) * s * 1.3 + rnd(i + 6) * H) % H); c.fillStyle = `rgba(255,${160 + rnd(i) * 80 | 0},60,${0.4 + 0.5 * rnd(i + 8)})`; c.fillRect(x, y, 4, 4); } }
    if (d === 'snow') { c.fillStyle = '#fff'; for (let i = 0; i < 50; i++) { const x = ((rnd(i) * 50 - camX * 0.3 + sin(t + i) * 0.8) % 50 + 50) % 50 / 50 * W, y = ((t * (0.8 + rnd(i + 2)) * s * 0.9 + rnd(i + 6) * H) % H); c.beginPath(); c.arc(x, y, 2 + rnd(i + 4) * 2, 0, TAU); c.fill(); } }
    if (d === 'sprinkles') { const cols = ['#ff5d5d', '#ffd23f', '#35c4ff', '#7bed4f', '#a66bff']; for (let i = 0; i < 30; i++) { const x = ((rnd(i) * 40 - camX * 0.25) % 40 + 40) % 40 / 40 * W, y = rnd(i + 3) * H * 0.9 + sin(t + i) * 6; c.save(); c.translate(x, y); c.rotate(rnd(i + 7) * 3 + t * 0.4); c.fillStyle = cols[i % 5]; rrect(c, -9, -3, 18, 6, 3); c.fill(); c.restore(); } }
    if (pulse > 0) { c.fillStyle = `rgba(255,255,255,${pulse * 0.08})`; c.fillRect(0, 0, W, H); }
    if (layer === 1) { c.fillStyle = 'rgba(40,200,255,.10)'; c.fillRect(0, 0, W, H); }
  }
  function rrect(c, x, y, w, h, r) { D.rr(c, x, y, w, h, r); }

  function drawWorld(c, L, S, th, camX, t, v) {
    const s = v.s, W = G.W, H = G.H, sx = (x) => (x - camX) * s, sy = (y) => H - v.oy - (y + 1.1) * s;
    const vis0 = camX - 3, vis1 = camX + v.vw + 3;
    // suolo e soffitto
    const gy = sy(0), cy = sy(L.ceil);
    c.fillStyle = th.ground; c.fillRect(0, gy, W, H - gy); c.fillStyle = th.top; c.fillRect(0, gy, W, s * 0.22);
    c.fillStyle = th.ground; c.fillRect(0, 0, W, cy); c.fillStyle = th.top; c.fillRect(0, cy - s * 0.22, W, s * 0.22);
    c.strokeStyle = OUT; c.lineWidth = max(3, s * 0.07); c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.moveTo(0, cy); c.lineTo(W, cy); c.stroke();
    c.strokeStyle = 'rgba(27,18,48,.18)'; c.lineWidth = 2; c.beginPath();
    for (let x = floor(vis0); x < vis1; x += 2) { c.moveTo(sx(x), gy); c.lineTo(sx(x), H); c.moveTo(sx(x), 0); c.lineTo(sx(x), cy); } c.stroke();
    // fine livello
    if (sx(L.len) < W) { c.fillStyle = th.acc; c.fillRect(sx(L.len), 0, W, H); c.strokeStyle = OUT; c.lineWidth = 6; c.strokeRect(sx(L.len), -4, W, H + 8); }
    if (!L._portals) {
      const grp = {}; L._portals = [];
      L.objs.forEach((o) => { if (o.k === 'P') { const k = o.x + '|' + o.t + '|' + o.lay; (grp[k] || (grp[k] = { x: o.x, t: o.t, y0: o.y - 1.5, y1: o.y + 1.5, lay: o.lay }, L._portals.push(grp[k]))); const q = grp[k]; q.y0 = min(q.y0, o.y - 1.5); q.y1 = max(q.y1, o.y + 1.5); } });
    }
    const act = (o) => o.lay === 2 || o.lay === S.layer;
    const dim = (o) => { c.globalAlpha = act(o) ? 1 : 0.22; };
    // blocchi
    for (const o of L.objs) {
      if (o.k !== 'b' || o.x > vis1 || o.x + o.w < vis0) continue;
      dim(o); const x = sx(o.x), y = sy(o.y + o.h), w = o.w * s, h = o.h * s;
      c.fillStyle = th.block; c.fillRect(x, y, w, h);
      c.fillStyle = th.blockTop; c.fillRect(x, y, w, min(h, s * 0.28));
      c.strokeStyle = 'rgba(27,18,48,.28)'; c.lineWidth = 2; c.beginPath();
      for (let i = 1; i < o.w; i++) { c.moveTo(x + i * s, y); c.lineTo(x + i * s, y + h); } for (let j = 1; j < o.h; j++) { c.moveTo(x, y + j * s); c.lineTo(x + w, y + j * s); } c.stroke();
      c.strokeStyle = o.lay === 2 ? OUT : LAYC[o.lay]; c.lineWidth = max(3, s * 0.08); if (!act(o)) c.setLineDash([8, 6]); c.strokeRect(x, y, w, h); c.setLineDash([]);
      if (o.lay !== 2) { c.fillStyle = LAYC[o.lay]; c.globalAlpha *= 0.22; c.fillRect(x, y, w, h); }
    }
    c.globalAlpha = 1;
    // spuntoni
    for (const o of L.objs) {
      if (o.k !== 's' || o.x > vis1 || o.x + 1 < vis0) continue;
      dim(o); const x = sx(o.x), h = (o.sm ? 0.55 : 1) * s, w = s, d = o.d ? -1 : 1, by = o.d ? sy(o.y + 1) : sy(o.y), top = by - d * h;
      c.beginPath(); c.moveTo(x + w * 0.04, by); c.lineTo(x + w / 2, top); c.lineTo(x + w * 0.96, by); c.closePath();
      c.fillStyle = '#3d2d68'; c.fill(); c.lineWidth = max(3, s * 0.08); c.strokeStyle = o.lay === 2 ? OUT : LAYC[o.lay]; c.lineJoin = 'round'; c.stroke();
      c.beginPath(); c.moveTo(x + w * 0.2, by - d * h * 0.1); c.lineTo(x + w / 2, top + d * h * 0.18); c.lineTo(x + w * 0.38, by - d * h * 0.1); c.closePath(); c.fillStyle = '#8f7bd8'; c.fill();
    }
    c.globalAlpha = 1;
    // seghe
    for (const o of L.objs) {
      if (o.k !== 'w' || o.x > vis1 + 2 || o.x < vis0 - 2) continue;
      dim(o); c.save(); c.translate(sx(o.x), sy(o.y)); c.rotate(t * 7 * (o.x % 2 ? 1 : -1)); const r = o.r * s, n = 10;
      c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * PI / n, q = i % 2 ? r * 0.72 : r * 1.0; c.lineTo(cos(a) * q, sin(a) * q); } c.closePath();
      c.fillStyle = '#d7deea'; c.fill(); c.lineWidth = max(3, s * 0.08); c.strokeStyle = o.lay === 2 ? OUT : LAYC[o.lay]; c.lineJoin = 'round'; c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.38, 0, TAU); c.fillStyle = '#ff5d5d'; c.fill(); c.strokeStyle = OUT; c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.12, 0, TAU); c.fillStyle = OUT; c.fill(); c.restore();
    }
    c.globalAlpha = 1;
    // pad
    const PADC = ['#ffd23f', '#ff6bd5', '#35c4ff', '#ff5d5d'];
    for (const o of L.objs) {
      if (o.k !== 'p' || o.x > vis1 || o.x < vis0) continue;
      const x = sx(o.x), by = o.d ? sy(o.y + 1) : sy(o.y), d = o.d ? -1 : 1;
      c.beginPath(); c.moveTo(x + s * 0.1, by); c.quadraticCurveTo(x + s * 0.5, by - d * s * 0.7, x + s * 0.9, by); c.closePath(); c.fillStyle = PADC[o.t]; c.fill(); c.lineWidth = max(3, s * 0.07); c.strokeStyle = OUT; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(x + s * 0.5, by - d * s * 0.16, s * 0.18, s * 0.06, 0, 0, TAU); c.fill();
    }
    // orb
    const ORBC = ['#ffd23f', '#ff6bd5', '#35c4ff', '#7bed4f', '#a66bff'];
    for (const o of L.objs) {
      if (o.k !== 'o' || o.x > vis1 || o.x < vis0) continue;
      dim(o); const used = S.act.indexOf(o.id) >= 0, x = sx(o.x), y = sy(o.y), p = 1 + 0.08 * sin(t * 6 + o.x);
      c.globalAlpha *= used ? 0.35 : 1;
      c.beginPath(); c.arc(x, y, s * 0.62 * p, 0, TAU); c.strokeStyle = ORBC[o.t]; c.lineWidth = s * 0.1; c.globalAlpha *= 0.7; c.stroke(); c.globalAlpha = act(o) ? (used ? 0.35 : 1) : 0.22;
      c.beginPath(); c.arc(x, y, s * 0.3, 0, TAU); c.fillStyle = ORBC[o.t]; c.fill(); c.lineWidth = max(3, s * 0.07); c.strokeStyle = OUT; c.stroke();
      if (o.t === 4) { c.save(); c.translate(x, y); c.rotate(t * 2); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.24); c.rotate(0.6); c.strokeRect(-s * 0.12, -s * 0.12, s * 0.24, s * 0.24); c.restore(); }
    }
    c.globalAlpha = 1;
    // portali
    for (const q of L._portals) {
      if (q.x > vis1 || q.x < vis0) continue;
      const x = sx(q.x), y0 = sy(min(q.y1, L.ceil + 0.6)), y1 = sy(max(q.y0, -0.6)), col = PCOL[q.t], w = s * 0.5, wob = sin(t * 5 + q.x) * s * 0.04;
      c.save(); c.beginPath(); c.moveTo(x - w * 0.5 - wob, y0); c.quadraticCurveTo(x - w * 1.1, (y0 + y1) / 2, x - w * 0.5 + wob, y1); c.lineTo(x + w * 0.5 - wob, y1); c.quadraticCurveTo(x + w * 1.1, (y0 + y1) / 2, x + w * 0.5 + wob, y0); c.closePath();
      const gg = c.createLinearGradient(x - w, 0, x + w, 0); gg.addColorStop(0, col); gg.addColorStop(0.5, 'rgba(255,255,255,.85)'); gg.addColorStop(1, col);
      c.globalAlpha = q.lay === 2 || q.lay === S.layer ? 0.9 : 0.25; c.fillStyle = gg; c.fill(); c.lineWidth = max(3, s * 0.08); c.strokeStyle = OUT; c.stroke(); c.restore();
      // icona
      const iy = (y0 + y1) / 2 > gy - s * 0.2 ? gy - s * 1.5 : max(y0 + s * 1.2, min(y1 - s * 1.2, sy(L.ceil / 2 + 0.5)));
      c.save(); c.translate(x, iy); c.globalAlpha = 1;
      const m = ['cube', 'ship', 'ball', 'wave'].indexOf(q.t);
      if (m >= 0) D.drawPlayer(c, m, 0, s * (m === 3 ? 0.9 : 0.62), '#fff', col);
      else {
        c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 3; c.font = `900 ${s * 0.42}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const txt = q.t === 'gn' ? '↓' : q.t === 'gf' ? '↑' : q.t === 'sn' ? '◯' : q.t === 'sm' ? '•' : q.t[0] === 's' ? '»»'.slice(0, 1 + (+q.t[1] > 1 ? 1 : 0)) + (q.t[1] === '3' ? '»' : '') : q.t === 'd0' ? '0' : q.t === 'd1' ? '1' : '4D';
        c.strokeText(txt, 0, 0); c.fillText(txt, 0, 0);
      }
      c.restore();
    }
    // monete
    for (const o of L.objs) {
      if (o.k !== 'c' || o.x > vis1 || o.x < vis0) continue;
      const got = S.coins & (1 << o.i), x = sx(o.x), y = sy(o.y) + sin(t * 3 + o.i) * s * 0.06, sq = abs(cos(t * 3 + o.i));
      if (got) continue;
      c.save(); c.translate(x, y); c.scale(max(0.2, sq), 1);
      c.beginPath(); c.arc(0, 0, s * 0.36, 0, TAU); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = max(3, s * 0.07); c.strokeStyle = OUT; c.stroke();
      c.beginPath(); c.arc(0, 0, s * 0.24, 0, TAU); c.strokeStyle = '#d18b00'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#fff3a8'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, q = i % 2 ? s * 0.06 : s * 0.15; c.lineTo(cos(a) * q, sin(a) * q); } c.closePath(); c.fill(); c.restore();
    }
  }

  function emit(x, y, vx, vy, life, size, color, kind) { if (G.parts.length < 500) G.parts.push({ x, y, vx, vy, life, max: life, size, color, kind: kind || 'sq', rot: Math.random() * 6 }); }
  function burst(x, y, n, cols, spd, size, life) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = spd * (0.3 + Math.random()); emit(x, y, cos(a) * v, sin(a) * v, (life || 0.7) * (0.6 + Math.random() * 0.6), size * (0.5 + Math.random()), cols[i % cols.length]); } }

  function drawParts(c, camX, v, dt) {
    const s = v.s, H = G.H, ps = G.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life -= dt; if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'sq' || p.kind === 'conf') p.vy -= 18 * dt; if (p.kind === 'bub') p.vy += 1.5 * dt; if (p.kind === 'fire') p.vy += 3 * dt;
      p.rot += dt * 6; const a = p.life / p.max, x = (p.x - camX) * s, y = H - v.oy - (p.y + 1.1) * s, z = p.size * s * (p.kind === 'fire' ? a : 1);
      c.globalAlpha = min(1, a * 1.4); c.fillStyle = p.color; c.strokeStyle = OUT;
      if (p.kind === 'bub') { c.strokeStyle = p.color; c.lineWidth = 2; c.beginPath(); c.arc(x, y, z * 0.6, 0, TAU); c.stroke(); }
      else if (p.kind === 'heart') { c.font = `${z * 2}px system-ui`; c.textAlign = 'center'; c.fillText('♥', x, y); }
      else if (p.kind === 'star') { c.save(); c.translate(x, y); c.rotate(p.rot); c.beginPath(); for (let k = 0; k < 10; k++) { const aa = -PI / 2 + k * PI / 5, q = k % 2 ? z * 0.25 : z * 0.6; c.lineTo(cos(aa) * q, sin(aa) * q); } c.closePath(); c.fill(); c.restore(); }
      else if (p.kind === 'ring') { c.strokeStyle = p.color; c.lineWidth = 5; c.beginPath(); c.arc(x, y, (1 - a) * s * 2.6 + 4, 0, TAU); c.stroke(); }
      else { c.save(); c.translate(x, y); c.rotate(p.rot); c.fillRect(-z / 2, -z / 2, z, z); if (p.kind === 'sq') c.strokeRect(-z / 2, -z / 2, z, z); c.restore(); }
    }
    c.globalAlpha = 1;
  }

  function trailEmit(S, dt, c1, c2) {
    const tr = save.sel.trail, hs = S.hs, cx = S.px - hs * 0.9, cy = S.py;
    if (S.mode === 3 || tr === 0) return;
    const r = () => (Math.random() - 0.5);
    switch (tr) {
      case 1: if (S.ground) emit(cx, S.py - (S.gf ? -hs : hs), -3 - Math.random() * 2, (S.gf ? -1 : 1) * Math.random() * 2, 0.35, 0.14, 'rgba(255,255,255,.8)'); break;
      case 2: emit(cx, cy + r() * hs, -2, r() * 3, 0.4, 0.14, [c1, c2, '#fff'][(Math.random() * 3) | 0]); break;
      case 3: emit(cx, cy + r() * hs, -4, r() * 2 + 1, 0.5, 0.45, ['#ff5d5d', '#ff9f43', '#ffd23f'][(Math.random() * 3) | 0], 'fire'); break;
      case 4: emit(cx, cy + r() * hs, -1.5, 1.5 + Math.random(), 0.8, 0.5, '#bfefff', 'bub'); break;
      case 5: if (Math.random() < 0.5) emit(cx, cy + r() * hs, -2, 1 + Math.random(), 0.8, 0.5, '#ff5d9f', 'heart'); break;
      case 6: if (Math.random() < 0.6) emit(cx, cy + r() * hs, -2.5, r() * 2, 0.6, 0.5, ['#ffd23f', '#fff', '#35c4ff'][(Math.random() * 3) | 0], 'star'); break;
      case 7: { const cols = ['#ff5d5d', '#ff9f43', '#ffd23f', '#7bed4f', '#35c4ff', '#a66bff']; for (let k = 0; k < 2; k++) emit(cx, cy + (k - 0.5) * hs * 0.8, -3, 0, 0.45, 0.2, cols[(S.t / 6 + k) % 6 | 0]); break; }
    }
  }

  function drawPlayerView(c, S, th, camX, t, v, dt) {
    const s = v.s, H = G.H, x = (S.px - camX) * s, y = H - v.oy - (S.py + 1.1) * s, mode = S.mode, sel = save.sel, size = S.hs * 2 * s;
    const c1 = D.COLORS[sel.c1], c2 = D.COLORS[sel.c2], dir = S.gf ? -1 : 1;
    // wave: scia a zig-zag
    if (mode === 3) {
      const w = G.wave; if (!w.length || w[w.length - 1].x < S.px - 0.05) w.push({ x: S.px, y: S.py, l: S.layer }); while (w.length > 0 && w[0].x < S.px - 6) w.shift();
      if (w.length > 1) { for (const [lw, col] of [[size * 0.5, OUT], [size * 0.34, c1], [size * 0.14, '#fff']]) { c.beginPath(); w.forEach((p, i) => { const px = (p.x - camX) * s, py = H - v.oy - (p.y + 1.1) * s; i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.lineTo(x, y); c.lineWidth = lw; c.strokeStyle = col; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); } }
    } else G.wave.length = 0;
    c.save(); c.translate(x, y);
    let rot = 0, fy = 1;
    if (mode === 0) { if (!S.ground) G.vrot += dir * 3.5 * dt; else { const q = PI / 2, tg = Math.round(G.vrot / q) * q; G.vrot += (tg - G.vrot) * min(1, dt * 18); } rot = G.vrot; }
    else if (mode === 1) { rot = max(-0.7, min(0.7, -atan2(S.vy, C.BASE * C.SPEEDS[S.sp]) * 1.2)); fy = dir; }
    else if (mode === 2) { G.vrot += dir * C.BASE * C.SPEEDS[S.sp] * dt / (S.hs); rot = G.vrot; }
    else if (mode === 3) { const a = atan2(S.vy, C.BASE * C.SPEEDS[S.sp]); rot = -a; }
    c.rotate(rot); c.scale(1, fy);
    if (mode === 1) { /* nave: dimensione fissa un poco più grande */ D.drawPlayer(c, 1, sel.ship, size * 1.15, c1, c2); }
    else D.drawPlayer(c, mode, sel[['cube', 'ship', 'ball', 'wave'][mode]], mode === 3 ? size * 2.1 : size, c1, c2);
    c.restore();
    if (G.dimGlow > 0) { c.strokeStyle = LAYC[S.layer]; c.globalAlpha = G.dimGlow; c.lineWidth = 4; c.beginPath(); c.arc(x, y, s * (1.4 - G.dimGlow), 0, TAU); c.stroke(); c.globalAlpha = 1; G.dimGlow -= dt * 2.2; }
    trailEmit(S, dt, c1, c2);
  }

  /* ----------------------------------------------------------- gioco -- */
  function resize() {
    const cv = G.canvas; if (!cv) return; const dpr = min(2, root.devicePixelRatio || 1);
    G.dpr = dpr; G.W = innerWidth; G.H = innerHeight; cv.width = G.W * dpr; cv.height = G.H * dpr; cv.style.width = G.W + 'px'; cv.style.height = G.H + 'px';
  }

  G.startLevel = function (i, practice) {
    G.auto = null;
    audioInit(); G.li = i; G.practice = !!practice; G.L = D.getLevel(i); G.S = D.newState(G.L); G.attempts = 1; G.wait = true; G.state = 'play'; G.parts.length = 0; G.wave.length = 0; G.vrot = 0;
    G.time = 0; G.cp = null; G.cps = []; G.cpTimer = 0; G.deadT = 0; G.acc = 0; G.dimGlow = 0; G.coinMask = 0;
    save.last = i; persist(); showScreen('hud'); const th = D.WORLDS[G.L.world]; startMusic(G.L.world); G.theme = th; updateHud();
  };
  function restart() {
    const L = G.L; G.parts.length = 0; G.wave.length = 0; G.vrot = 0; G.dimGlow = 0;
    if (G.practice && G.cp) { G.S = D.clone(G.cp); G.vrot = 0; G.S.prev = false; } else { G.S = D.newState(L); G.time = 0; }
    G.state = 'play'; G.attempts++; G.deadT = 0; G.acc = 0; G.wait = false; updateHud();
  }
  function onEvents(S, ev) {
    for (const e of ev) {
      const x = S.px, y = S.py, c1 = D.COLORS[save.sel.c1], c2 = D.COLORS[save.sel.c2];
      if (e === 'jump') sfx('jump'); else if (e === 'land') { sfx('land'); for (let k = 0; k < 4; k++) emit(x, y - (S.gf ? -S.hs : S.hs), (Math.random() - 0.5) * 4, Math.random() * 2, 0.35, 0.16, 'rgba(255,255,255,.8)'); }
      else if (e === 'coin') { sfx('coin'); burst(x, y, 14, ['#ffd23f', '#fff'], 5, 0.18, 0.6); G.flash = 0.25; G.flashC = '#ffd23f'; G.coinMask = S.coins; updateHud(); }
      else if (e === 'pad') { sfx('pad'); burst(x, y - S.hs, 10, ['#ffd23f', '#fff'], 4, 0.15, 0.4); }
      else if (e === 'orb') { sfx('orb'); G.parts.push({ x, y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 1, color: '#fff', kind: 'ring', rot: 0 }); }
      else if (e === 'dim') { sfx('dim'); G.dimGlow = 1; G.flash = 0.5; G.flashC = LAYC[S.layer]; burst(x, y, 18, [LAYC[S.layer], '#fff'], 6, 0.2, 0.7); }
      else if (e === 'portal') { sfx('portal'); G.flash = 0.35; G.flashC = '#fff'; G.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 1, color: '#fff', kind: 'ring', rot: 0 }); }
      else if (e === 'death') { sfx('death'); G.shake = 0.5; burst(x, y, 30, [c1, c2, OUT], 9, 0.28, 0.9); G.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 1, color: '#fff', kind: 'ring', rot: 0 }); G.state = 'dead'; G.deadT = 0; }
      else if (e === 'win') { sfx('win'); G.state = 'winning'; G.deadT = 0; for (let k = 0; k < 60; k++) emit(x + 2, 5 + Math.random() * 4, 6 + Math.random() * 6, Math.random() * 10 - 3, 1.6, 0.25, ['#ffd23f', '#ff5d5d', '#35c4ff', '#7bed4f', '#ff6bd5'][k % 5], 'conf'); }
    }
  }

  function placeCp() { if (G.practice && G.state === 'play' && !G.S.dead) { G.cp = D.clone(G.S); G.cps.push(G.cp); G.parts.push({ x: G.S.px, y: G.S.py + 1, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 1, color: '#7bed4f', kind: 'ring', rot: 0 }); } }
  function removeCp() { if (G.practice) { G.cps.pop(); G.cp = G.cps[G.cps.length - 1] || null; } }

  function stepGame(dt) {
    // partita
    if (G.state === 'play' && G.L) {
      if (G.wait) { if (G.held || G.auto) { G.wait = false; G.time = 0; audioInit(); } else return; }
      G.acc += dt; let n = 0;
      while (G.acc >= C.DT && n++ < 12) {
        G.acc -= C.DT; G.ev.length = 0; D.step(G.S, G.L, G.auto ? !!G.auto[floor(G.S.t / 4)] : G.held, G.ev); G.time += C.DT; if (G.ev.length) onEvents(G.S, G.ev);
        if (G.S.dead || G.S.won) break;
      }
      if (G.practice && G.S.ground && G.S.mode === 0 && (G.cpTimer += dt) > 2.2) { G.cpTimer = 0; placeCp(); }
      if ((G.hudT = (G.hudT || 0) + dt) > 0.08) { G.hudT = 0; updateHud(); }
    } else if (G.state === 'dead') {
      G.deadT += dt; if (G.deadT > 0.75) restart();
    } else if (G.state === 'winning') {
      G.deadT += dt; G.S.px += 0; if (G.deadT > 1.3) finishLevel();
    }
  }

  function finishLevel() {
    G.state = 'won'; const i = G.li, S = G.S, before = totalCoins();
    if (!G.practice) {
      save.done[i] = 1; save.best[i] = 100; save.coins[i] = (save.coins[i] || 0) | S.coins; persist();
    }
    const after = totalCoins(); G.newUnl = unlockedBetween(before, after);
    showWin(i, S.coins);
  }
  function unlockedBetween(a, b) {
    const out = [];
    ['cube', 'ship', 'ball', 'wave'].forEach((m) => { for (let k = 1; k < 10; k++) { const c = D.skinCost(k); if (c > a && c <= b) out.push(T(m) + ' ' + D.SKIN_NAMES[m][k]); } });
    for (let k = 1; k < 16; k++) { const c = D.colorCost(k); if (c > a && c <= b) out.push(T('colors') + ' #' + (k + 1)); }
    for (let k = 1; k < 8; k++) { const c = D.trailCost(k); if (c > a && c <= b) out.push(T('trails') + ': ' + D.TRAILS[k]); }
    return out;
  }

  G.autoplay = function (i) { G.startLevel(i, false); const s = D.LEVELDATA[i].s, ins = []; let h = false; s.forEach((n) => { for (let k = 0; k < n; k++) ins.push(h); h = !h; }); G.auto = ins; };
  function onDeath() { const pct = max(0, min(100, floor(G.S.px / G.L.len * 100))); if (!G.practice && pct > (save.best[G.li] || 0)) { save.best[G.li] = pct; persist(); } }

  /* ------------------------------------------------------------ frame -- */
  function frame(ts) {
    if (!G.open) { G.raf = 0; return; }
    G.raf = requestAnimationFrame(frame);
    const dt = min(0.05, (ts - (G.last || ts)) / 1000); G.last = ts; G.clock = (G.clock || 0) + dt;
    const c = G.ctx; c.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    const inGame = G.screen === 'hud' || G.screen === 'win' || G.screen === 'pause';
    let L, S, th;
    if (inGame && G.L) {
      if (G.screen !== 'pause' && G.screen !== 'win') { const wasDead = G.S.dead; stepGame(dt); if (!wasDead && G.S.dead) onDeath(); }
      L = G.L; S = G.S;
    } else {
      // attract mode
      const a = G.att;
      if (!a.L || a.S.dead || a.S.won || a.S.px > a.L.len) {
        const i = a.list[a.i++ % a.list.length]; a.L = D.getLevel(i); a.S = D.newState(a.L);
        const s = D.LEVELDATA[i].s, ins = []; let h = false; s.forEach((n) => { for (let k = 0; k < n; k++) ins.push(h); h = !h; }); a.ins = ins; a.acc = 0;
      }
      a.acc += dt; let n = 0; while (a.acc >= C.DT && n++ < 12 && !a.S.dead && !a.S.won) { a.acc -= C.DT; D.step(a.S, a.L, !!a.ins[floor(a.S.t / 4)], null); }
      L = a.L; S = a.S;
    }
    th = D.WORLDS[L.world];
    const v = view(); const camX = S.px - v.vw * 0.3; G.camX = camX;
    const beat = A.ctx && G.musicOn ? max(0, 1 - ((A.ctx.currentTime - (G.beatT || 0)) * 6)) : 0;
    c.save();
    if (G.shake > 0) { c.translate((Math.random() - 0.5) * G.shake * 22, (Math.random() - 0.5) * G.shake * 22); G.shake = max(0, G.shake - dt * 1.6); }
    drawBg(c, th, camX, G.clock, v, beat, S.layer);
    drawWorld(c, L, S, th, camX, G.clock, v);
    if (!S.dead && G.state !== 'winning' || G.state === 'winning') { if (!S.dead) drawPlayerView(c, S, th, camX, G.clock, v, dt); }
    drawParts(c, camX, v, dt);
    // checkpoint (practice)
    if (G.practice) for (const q of G.cps) { const x = (q.px - camX) * v.s, y = G.H - v.oy - (q.py + 1.1) * v.s; c.fillStyle = '#7bed4f'; c.strokeStyle = OUT; c.lineWidth = 3; c.save(); c.translate(x, y - v.s * 0.7); c.rotate(PI / 4); c.fillRect(-9, -9, 18, 18); c.strokeRect(-9, -9, 18, 18); c.restore(); }
    c.restore();
    if (G.flash > 0) { c.globalAlpha = G.flash * 0.6; c.fillStyle = G.flashC; c.fillRect(0, 0, G.W, G.H); c.globalAlpha = 1; G.flash = max(0, G.flash - dt * 2.5); }
    if (inGame && G.wait && G.screen === 'hud') {
      c.font = `900 ${min(34, G.W / 14)}px "Trebuchet MS",system-ui`; c.textAlign = 'center'; c.lineWidth = 7; c.strokeStyle = OUT; c.fillStyle = '#fff'; const m = T('tap'); c.strokeText(m, G.W / 2, G.H * 0.3 + sin(G.clock * 4) * 4); c.fillText(m, G.W / 2, G.H * 0.3 + sin(G.clock * 4) * 4);
    }
  }

  /* ------------------------------------------------------------- hud -- */
  function updateHud() {
    const h = $('#dhud'); if (!h || !G.L) return;
    const pct = max(0, min(100, floor((G.S.px / G.L.len) * 100)));
    $('#dbar i', h).style.width = pct + '%'; $('#dpct', h).textContent = pct + '%';
    $('#datt', h).textContent = (G.practice ? T('practice') + ' · ' : '') + T('attempts') + ' ' + G.attempts;
    const pips = h.querySelectorAll('.cn'); pips.forEach((p, k) => p.classList.toggle('on', !!(G.S.coins & (1 << k))));
    const lay = $('#dlay', h); lay.style.display = G.L.params.i >= 22 ? 'block' : 'none'; lay.className = 'l' + G.S.layer; lay.textContent = '4D ' + (G.S.layer ? 'B' : 'A');
  }

  /* ------------------------------------------------------------- UI -- */
  const ui = () => $('#dui');
  function showScreen(name) {
    G.screen = name; const u = ui(); if (!u) return;
    u.className = 's-' + name; u.innerHTML = '';
    ({ home, levels: levelsScreen, garage: garageScreen, hud: hudScreen })[name] && ({ home, levels: levelsScreen, garage: garageScreen, hud: hudScreen })[name](u);
    if (name === 'home' || name === 'levels' || name === 'garage') { stopMusic(); G.L = null; }
    sfx('click');
  }
  const btn = (txt, cls, fn) => el('button', { class: 'dbtn ' + (cls || ''), text: txt, onclick: (e) => { audioInit(); sfx('click'); fn(e); } });

  function statBar() { return el('div', { class: 'dstats', html: `<span>🪙 ${totalCoins()}<small>/600</small></span><span>🏁 ${totalDone()}<small>/200</small></span>` }); }

  function home(u) {
    const first = (() => { for (let i = 0; i < 200; i++) if (!save.done[i]) return i; return 0; })();
    const logo = el('div', { class: 'dlogo' }, [el('div', { class: 'dl1', text: 'HYPER' }), el('div', { class: 'dl2', text: 'DASH' }), el('div', { class: 'dtag', text: T('tagline') })]);
    const prev = el('canvas', { class: 'dprev', width: 180, height: 180 }); G.prevCv = prev;
    const row = el('div', { class: 'drow' }, [btn(T('levels'), 'blue', () => showScreen('levels')), btn(T('garage'), 'pink', () => showScreen('garage'))]);
    const main = el('div', { class: 'dmain' }, [
      logo, prev,
      btn('▶  ' + T('play') + (totalDone() ? ' · ' + (first + 1) : ''), 'big green', () => G.startLevel(first, false)),
      row,
      btn('🧊  ' + T('engine'), 'purple', () => { G.close(); HD.app && HD.app.start('lab', true); }),
      el('div', { class: 'dsmall' }, [
        btn(lg() === 'it' ? 'EN' : 'IT', 'mini', () => { HD.i18n.lang = lg() === 'it' ? 'en' : 'it'; HD.ui.store.set('lang', HD.i18n.lang); showScreen('home'); }),
        btn(save.music ? '🎵' : '🔇', 'mini', () => { save.music = !save.music; persist(); if (A.mus) A.mus.gain.value = save.music ? 0.5 : 0; showScreen('home'); }),
        btn(save.sfx ? '🔊' : '🔈', 'mini', () => { save.sfx = !save.sfx; persist(); if (A.sfxg) A.sfxg.gain.value = save.sfx ? 1 : 0; showScreen('home'); }),
        btn('⛶', 'mini', () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else d.requestFullscreen && d.requestFullscreen(); }),
      ]),
      statBar(), el('div', { class: 'dhelp', text: T('help') }),
    ]);
    u.appendChild(main); drawPreview();
  }
  function drawPreview() {
    const cv = G.prevCv; if (!cv || !cv.isConnected) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 180, 180);
    c.save(); c.translate(90, 100 + sin(G.clock * 4) * 8); c.rotate(sin(G.clock * 2) * 0.25); D.drawPlayer(c, 0, save.sel.cube, 100, D.COLORS[save.sel.c1], D.COLORS[save.sel.c2]); c.restore();
    requestAnimationFrame(drawPreview);
  }

  function levelsScreen(u) {
    const w = G.selWorld === undefined ? floor((save.last || 0) / 20) : G.selWorld; G.selWorld = w; const th = D.WORLDS[w];
    const tabs = el('div', { class: 'wtabs' }, D.WORLDS.map((q, k) => el('button', { class: 'wtab' + (k === w ? ' on' : ''), style: `--c:${q.top};--c2:${q.sky[0]}`, text: String(k + 1), onclick: () => { G.selWorld = k; showScreen('levels'); } })));
    const grid = el('div', { class: 'lgrid' });
    for (let j = 0; j < 20; j++) {
      const i = w * 20 + j, m = save.coins[i] || 0, d = D.diffOf(i);
      const b = el('button', { class: 'lbtn d' + d + (save.done[i] ? ' done' : ''), onclick: () => G.startLevel(i, false) }, [
        el('b', { text: String(i + 1) }), el('small', { text: D.levelName(i) }),
        el('span', { class: 'pips', html: [0, 1, 2].map((k) => `<i class="${m & (1 << k) ? 'on' : ''}"></i>`).join('') }),
        el('span', { class: 'lbar' }, [el('i', { style: `width:${save.best[i] || 0}%` })]),
      ]);
      b.title = diffName(d); b.addEventListener('contextmenu', (e) => { e.preventDefault(); G.startLevel(i, true); });
      grid.appendChild(b);
    }
    const head = el('div', { class: 'dhead' }, [btn('◀', 'mini', () => showScreen('home')), el('h2', { text: T('world') + ' ' + (w + 1) + ' · ' + worldName(w) }), statBar()]);
    u.appendChild(el('div', { class: 'dpanel', style: `--wc:${th.top}` }, [head, tabs, grid, el('div', { class: 'dhelp', text: (lg() === 'it' ? 'Tasto destro / pressione lunga: modalità allenamento' : 'Right-click / long-press: practice mode') })]));
    grid.querySelectorAll('.lbtn').forEach((b, j) => { let tm; b.addEventListener('touchstart', () => { tm = setTimeout(() => { G.startLevel(w * 20 + j, true); }, 600); }); b.addEventListener('touchend', () => clearTimeout(tm)); b.addEventListener('touchmove', () => clearTimeout(tm)); });
  }

  function garageScreen(u) {
    const mode = G.gmode || 'cube', mi = ['cube', 'ship', 'ball', 'wave'].indexOf(mode), coins = totalCoins();
    const tabs = el('div', { class: 'gtabs' }, ['cube', 'ship', 'ball', 'wave'].map((m) => el('button', { class: 'gtab' + (m === mode ? ' on' : ''), text: T(m), onclick: () => { G.gmode = m; showScreen('garage'); } })));
    const prev = el('canvas', { class: 'gprev', width: 220, height: 220 });
    const skins = el('div', { class: 'sgrid' });
    for (let k = 0; k < 10; k++) {
      const ok = coins >= D.skinCost(k), cv = el('canvas', { width: 84, height: 84 });
      const cc = cv.getContext('2d'); cc.translate(42, 44); D.drawPlayer(cc, mi, k, 44, D.COLORS[save.sel.c1], D.COLORS[save.sel.c2]);
      const b = el('button', { class: 'sk' + (save.sel[mode] === k ? ' sel' : '') + (ok ? '' : ' lock'), onclick: () => { if (!ok) return; save.sel[mode] = k; persist(); showScreen('garage'); } }, [cv, el('small', { text: ok ? D.SKIN_NAMES[mode][k] : '🔒 ' + D.skinCost(k) + ' ' + T('locked') })]);
      skins.appendChild(b);
    }
    const pal = (key) => el('div', { class: 'pal' }, D.COLORS.map((col, k) => { const ok = coins >= D.colorCost(k); return el('button', { class: 'sw' + (save.sel[key] === k ? ' sel' : '') + (ok ? '' : ' lock'), style: `background:${col}`, title: ok ? '' : D.colorCost(k) + ' ' + T('locked'), onclick: () => { if (!ok) return; save.sel[key] = k; persist(); showScreen('garage'); } }); }));
    const trl = el('div', { class: 'trl' }, D.TRAILS.map((n, k) => { const ok = coins >= D.trailCost(k); return el('button', { class: 'tr' + (save.sel.trail === k ? ' sel' : '') + (ok ? '' : ' lock'), text: ok ? n : '🔒 ' + D.trailCost(k), onclick: () => { if (!ok) return; save.sel.trail = k; persist(); showScreen('garage'); } }); }));
    const head = el('div', { class: 'dhead' }, [btn('◀', 'mini', () => showScreen('home')), el('h2', { text: T('garage') }), statBar()]);
    u.appendChild(el('div', { class: 'dpanel gar' }, [head, tabs, el('div', { class: 'gbody' }, [el('div', { class: 'gleft' }, [prev, el('h4', { text: T('c1') }), pal('c1'), el('h4', { text: T('c2') }), pal('c2'), el('h4', { text: T('trails') }), trl]), el('div', { class: 'gright' }, [skins])])]));
    const loop = () => { if (!prev.isConnected) return; const c = prev.getContext('2d'); c.clearRect(0, 0, 220, 220); c.save(); c.translate(110, 112 + sin(G.clock * 3) * 6); const t = G.clock; if (mi === 0) c.rotate(t * 1.2); else if (mi === 3) c.rotate(sin(t * 2) * 0.6); else if (mi === 1) c.rotate(sin(t * 2) * 0.2); else c.rotate(t * 2); D.drawPlayer(c, mi, save.sel[mode], 120, D.COLORS[save.sel.c1], D.COLORS[save.sel.c2]); c.restore(); requestAnimationFrame(loop); };
    loop();
  }

  function hudScreen(u) {
    const h = el('div', { id: 'dhud' }, [
      el('div', { class: 'ht' }, [el('div', { id: 'dbar' }, [el('i')]), el('b', { id: 'dpct', text: '0%' })]),
      el('div', { class: 'hl' }, [el('span', { class: 'cn' }), el('span', { class: 'cn' }), el('span', { class: 'cn' }), el('span', { id: 'dlay', class: 'l0' })]),
      el('div', { id: 'datt' }),
      el('button', { class: 'dbtn mini hp', text: 'II', onclick: (e) => { e.stopPropagation(); pause(); } }),
    ]);
    if (G.practice) h.appendChild(el('div', { class: 'hcp' }, [el('button', { class: 'dbtn mini', text: '◆', title: T('place'), onclick: (e) => { e.stopPropagation(); placeCp(); } }), el('button', { class: 'dbtn mini', text: '✖', title: T('remove'), onclick: (e) => { e.stopPropagation(); removeCp(); } })]));
    u.appendChild(h); updateHud();
  }
  function pause() {
    if (G.screen !== 'hud') return; G.screen = 'pause'; const u = ui(), name = D.levelName(G.li);
    const p = el('div', { class: 'dmodal' }, [el('div', { class: 'dcard' }, [el('h2', { text: T('paused') }), el('p', { text: (G.li + 1) + ' · ' + name }),
      btn('▶ ' + T('resume'), 'green', () => resume()), btn('↻ ' + T('restart'), 'blue', () => { resume(); G.S = D.newState(G.L); G.cp = null; G.cps = []; G.attempts = 1; G.wait = true; G.parts.length = 0; G.wave.length = 0; }),
      btn(G.practice ? T('play') : T('practice'), 'purple', () => { G.startLevel(G.li, !G.practice); }), btn('☰ ' + T('quit'), 'pink', () => showScreen('levels'))])]);
    u.appendChild(p);
  }
  function resume() { G.screen = 'hud'; const m = $('.dmodal', ui()); m && m.remove(); G.last = 0; }
  function showWin(i, mask) {
    G.screen = 'win'; const u = ui(), got = popc(mask);
    const nxt = i < 199 ? i + 1 : null;
    const unl = G.newUnl.length ? el('div', { class: 'unl', html: '🎁 ' + T('newunlock') + '<br>' + G.newUnl.slice(0, 3).join(' · ') }) : null;
    const card = el('div', { class: 'dcard win' }, [el('h2', { text: T('complete') }), el('p', { text: (i + 1) + ' · ' + D.levelName(i) }),
      el('div', { class: 'wcoins', html: [0, 1, 2].map((k) => `<i class="${mask & (1 << k) ? 'on' : ''}" style="animation-delay:${0.2 + k * 0.25}s"></i>`).join('') }),
      el('div', { class: 'wstat', html: `${T('attempts')}: <b>${G.attempts}</b> · ${T('time')}: <b>${G.time.toFixed(1)}s</b>${G.practice ? ' · ' + T('practice') : ''}` }), unl,
      nxt !== null ? btn('▶ ' + T('next'), 'green', () => G.startLevel(nxt, false)) : null, btn('↻ ' + T('replay'), 'blue', () => G.startLevel(i, G.practice)), btn('☰ ' + T('quit'), 'pink', () => { G.selWorld = floor(i / 20); showScreen('levels'); })].filter(Boolean));
    u.appendChild(el('div', { class: 'dmodal' }, [card]));
  }

  /* --------------------------------------------------------- input -- */
  function press(on) { G.held = on; if (on) audioInit(); }
  function bindInput() {
    const stage = $('#dash');
    stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button,.dpanel,.dcard,a')) return; if (G.screen === 'hud') { press(true); e.preventDefault(); } });
    addEventListener('pointerup', () => { if (G.screen === 'hud') press(false); }); addEventListener('pointercancel', () => press(false));
    addEventListener('blur', () => { press(false); if (G.screen === 'hud') pause(); });
    addEventListener('keydown', (e) => {
      if (!G.open) return; const k = e.key;
      if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') { if (G.screen === 'hud') { press(true); e.preventDefault(); } else if (G.screen === 'win') { /* nulla */ } }
      else if (k === 'Escape' || k === 'p' || k === 'P') { if (G.screen === 'hud') pause(); else if (G.screen === 'pause') resume(); else if (G.screen === 'levels' || G.screen === 'garage') showScreen('home'); e.preventDefault(); }
      else if (k === 'r' || k === 'R') { if (G.screen === 'hud') { G.S = D.newState(G.L); G.cp = null; G.cps = []; G.attempts++; G.parts.length = 0; G.wave.length = 0; G.state = 'play'; } }
      else if ((k === 'z' || k === 'Z') && G.screen === 'hud') placeCp(); else if ((k === 'x' || k === 'X') && G.screen === 'hud') removeCp();
      else if (k === 'f' || k === 'F') { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else d.requestFullscreen && d.requestFullscreen(); }
    });
    addEventListener('keyup', (e) => { const k = e.key; if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') press(false); });
    addEventListener('resize', resize);
  }

  /* ------------------------------------------------------------ api -- */
  let built = false;
  function build() {
    if (built) return; built = true;
    const d = $('#dash'); d.innerHTML = '';
    const cv = el('canvas', { id: 'dcv' }); d.appendChild(cv); d.appendChild(el('div', { id: 'dui' })); G.canvas = cv; G.ctx = cv.getContext('2d'); resize(); bindInput();
  }
  G.show = function (screen) {
    build(); G.open = true; $('#dash').hidden = false; document.body.classList.add('dash-on'); resize();
    if (screen === 'home' || !screen) { G.L = null; G.state = 'menu'; }
    showScreen(screen || 'home'); if (!G.raf) { G.last = 0; G.raf = requestAnimationFrame(frame); }
  };
  G.freeze = function (on) { if (on) { G.open = false; } else if (!G.open) { G.open = true; G.last = 0; G.raf = requestAnimationFrame(frame); } };
  G.close = function () { G.open = false; stopMusic(); const d = $('#dash'); if (d) d.hidden = true; document.body.classList.remove('dash-on'); };
  HD.dashGame = G;
})(window);
