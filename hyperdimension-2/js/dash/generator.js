/* ============================================================================
 * HyperDimension — dash/generator.js
 * Generatore procedurale di livelli "dash". Ogni livello è composto da blocchi
 * ("chunk": corsa piatta + un pattern + corsa piatta). I pattern vengono scelti
 * e dimensionati in base alla difficoltà; offline (tools/build-levels.js) ogni
 * blocco viene validato dal solver e, se impossibile, rigenerato con un altro
 * "tentativo". La tabella dei tentativi è salvata in js/dash/leveldata.js,
 * così a runtime i livelli si ricostruiscono identici senza solver.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = (root.HD = root.HD || {}), D = (HD.dash = HD.dash || {});
  const CEIL = 10, SPEEDS = [0.81, 1, 1.24, 1.6];
  D.NUM_LEVELS = 200; D.WORLD_SIZE = 20;

  /* ------------------------------------------------------------- random -- */
  function hash(a, b, c) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647 + 1442695040) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h = Math.imul(h ^ (h >>> 16), 2246822519);
    return (h ^ (h >>> 15)) >>> 0;
  }
  function RNG(seed) {
    let s = seed >>> 0;
    const f = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { f, range: (a, b) => a + f() * (b - a), int: (a, b) => a + Math.floor(f() * (b - a + 1)), pick: (arr) => arr[Math.floor(f() * arr.length)], chance: (p) => f() < p };
  }
  D.hash = hash; D.RNG = RNG;

  /* ------------------------------------------------------------ builder -- */
  function Builder(x) { this.o = []; this.x = x; }
  Builder.prototype = {
    block(x, y, w, h, lay) { if (h > 0.01 && w > 0.01) this.o.push({ k: 'b', x, y, w, h, lay: lay === undefined ? 2 : lay }); },
    spike(x, y, d, sm, lay) { this.o.push({ k: 's', x, y: y || 0, d: d || 0, sm: sm ? 1 : 0, lay: lay === undefined ? 2 : lay }); },
    spikes(x, y, n, d, sm, lay) { for (let i = 0; i < n; i++) this.spike(x + i, y, d, sm, lay); },
    saw(x, y, r, lay) { this.o.push({ k: 'w', x, y, r, lay: lay === undefined ? 2 : lay }); },
    pad(x, y, t, d) { this.o.push({ k: 'p', x, y: y || 0, t, d: d || 0, lay: 2 }); },
    orb(x, y, t, lay) { this.o.push({ k: 'o', x, y, t, lay: lay === undefined ? 2 : lay }); },
    portal(x, y, t) { this.o.push({ k: 'P', x, y, t, lay: 2 }); },
    /** colonna di portali uguali che copre tutta l'altezza */
    col(x, t) { for (const y of [1.5, 4.5, 7.5, 8.5]) this.portal(x, y, t); },
  };
  function mirror(objs) {
    return objs.map((o) => {
      const m = Object.assign({}, o);
      switch (o.k) {
        case 'b': m.y = CEIL - (o.y + o.h); break;
        case 's': m.y = CEIL - o.y - 1; m.d = o.d ^ 1; break;
        case 'p': m.y = CEIL - o.y - 1; m.d = o.d ^ 1; break;
        default: m.y = CEIL - o.y;
      }
      return m;
    });
  }
  const maxRun = (sp) => Math.max(1, Math.floor(4.53 * sp - 1.42 - 0.6) + 1);   // spuntoni consecutivi superabili con un salto

  /* ------------------------------------------------------------ pattern -- */
  const P = {};

  P.spikes = (B, r, p) => {
    const groups = r.int(2, 3 + (p.d > 0.4 ? 1 : 0));
    const mx = Math.min(maxRun(p.sp), p.d < 0.15 ? 2 : 3);
    for (let g = 0; g < groups; g++) {
      const n = r.int(1, mx), sm = p.d > 0.3 && n === 1 && r.chance(0.25);
      B.spikes(B.x, 0, n, 0, sm); B.x += n + r.range(3.6, 6.8) * Math.max(1, p.sp * 0.9);
    }
    B.x -= 2;
  };

  P.blockHop = (B, r, p) => {
    const n = 3 + Math.floor(p.d * 3) + r.int(0, 1); let h = 1;
    B.x += 1;
    for (let k = 0; k < n; k++) {
      const w = r.pick([1, 2, 2]);
      h = Math.max(1, Math.min(2.5, h + r.pick([-1, 0, 0, 1])));
      B.block(B.x, 0, w, h);
      if (p.d > 0.5 && r.chance(0.3)) B.spike(B.x + (w > 1 ? r.int(0, w - 1) : 0), h, 0, 1);
      const gap = Math.min(r.range(1.6, 3.3) * Math.max(1, p.sp * 0.85), 4.4 * p.sp);
      const gx = B.x + w;
      if (gap > 1.2) B.spikes(gx + 0.3, 0, Math.max(1, Math.floor(gap - 0.6)), 0, 0);
      B.x = gx + gap;
    }
    B.x += 1;
  };

  P.staircase = (B, r, p) => {
    const H = Math.min(4, 2 + Math.floor(p.d * 3)), w = Math.max(2.6, 2.4 * p.sp);
    for (let k = 1; k <= H; k++) { B.block(B.x, 0, w, k); if (p.d > 0.4 && k === H) B.spike(B.x + w - 1, k, 0, 1); B.x += w; }
    B.x += 1.2;
    B.spikes(B.x + 1.5, 0, r.int(1, Math.min(2, maxRun(p.sp))), 0, 0); B.x += 4.5 * Math.max(1, p.sp);
    if (p.d > 0.55) { B.spikes(B.x, 0, 1, 0, 0); B.x += 4; }
  };

  P.platformSpikes = (B, r, p) => {
    const w = r.int(5, 8) + (p.sp > 1.2 ? 2 : 0);
    B.block(B.x, 0, w, 1);
    const n = r.int(1, 2); let sx = B.x + 2.6;
    for (let k = 0; k < n; k++) { B.spikes(sx, 1, r.int(1, 2), 0, 0); sx += 3.6 * Math.max(1, p.sp * 0.9) + 1; }
    B.x += Math.max(w, sx - B.x + 1) + 2;
  };

  P.padJump = (B, r, p) => {
    const strip = Math.min(4 + Math.floor(p.d * 3), Math.floor(6.4 * p.sp - 1));
    B.pad(B.x + 1, 0, 0, 0);
    if (r.chance(0.5 + p.d * 0.3)) { B.spikes(B.x + 3.4, 0, strip, 0, 0); B.x += strip + 8 * Math.max(1, p.sp * 0.7); }
    else { B.block(B.x + 6 * p.sp, 0, 1.4, 3.4); B.spike(B.x + 6 * p.sp + 0.2, 3.4, 0, 1); B.x += 6 * p.sp + 7; }
  };

  P.orbField = (B, r, p) => {
    const n = Math.min(5 + Math.floor(p.d * 4), Math.floor(9 * Math.max(1, p.sp * 0.9)));
    B.spikes(B.x + 2, 0, n, 0, 0);
    const orbs = n > 6 ? 2 : 1;
    for (let k = 0; k < orbs; k++) B.orb(B.x + 2 + 1.4 + (k * (n - 3)) / Math.max(1, orbs - 1 || 1) * (orbs > 1 ? 1 : 0) + (orbs === 1 ? (n - 3) / 2 : 0), 2.5 + r.range(-0.25, 0.4), p.d > 0.6 && r.chance(0.3) ? 1 : 0);
    B.x += n + 6;
  };

  P.saws = (B, r, p) => {
    const n = r.int(2, 3 + (p.d > 0.5 ? 1 : 0));
    for (let k = 0; k < n; k++) {
      const rad = r.pick([0.5, 0.65, 0.8]);
      B.saw(B.x + 1, rad * 0.95, rad);
      if (r.chance(0.35 + p.d * 0.2)) B.spikes(B.x + 3.3, 0, 1, 0, 0);
      B.x += 4.2 + r.range(1.8, 3.4) * Math.max(1, p.sp * 0.9);
    }
    B.x -= 2;
  };

  P.gravityRun = (B, r, p) => {
    const x0 = B.x;
    B.col(x0 + 0.5, 'gf');
    const T = new Builder(x0 + 9);
    const inner = r.pick(['spikes', 'blockHop', 'platformSpikes', 'saws']);
    P[inner](T, r, Object.assign({}, p, { d: Math.min(1, p.d * 0.85) }));
    for (const o of mirror(T.o)) B.o.push(o);
    B.col(T.x + 1, 'gn'); B.x = T.x + 9;
  };

  P.speedBurst = (B, r, p) => {
    const x0 = B.x, to = r.pick(p.base < 2 ? [2, 3] : [3]);
    B.col(x0 + 0.5, 's' + to);
    const T = new Builder(x0 + 5), sp2 = SPEEDS[to];
    P.spikes(T, r, Object.assign({}, p, { sp: sp2, d: Math.min(1, p.d * 0.8) }));
    for (const o of T.o) B.o.push(o);
    B.col(T.x + 1, 's' + p.base); B.x = T.x + 4;
  };

  P.ship = (B, r, p) => {
    const x0 = B.x; B.col(x0 + 0.5, 'ship');
    let x = x0 + 8;
    const n = r.int(4, 6 + Math.floor(p.d * 5));
    const gap = 5.8 - p.d * 2.2 + r.range(-0.15, 0.15);
    let cy = r.range(4, 6);
    for (let k = 0; k < n; k++) {
      const w = r.pick([1, 1.5, 2, 3]), dc = r.range(-1, 1) * Math.min(3.2, 1.2 + 2.2 * p.d);
      cy = Math.max(gap / 2 + 0.2, Math.min(CEIL - gap / 2 - 0.2, cy + dc));
      B.block(x, 0, w, cy - gap / 2); B.block(x, cy + gap / 2, w, CEIL - (cy + gap / 2));
      if (p.d > 0.35 && r.chance(0.4)) B.spike(x + (w > 1 ? r.range(0, w - 1) : 0), cy - gap / 2, 0, 1);
      if (p.d > 0.5 && r.chance(0.3)) B.spike(x + (w > 1 ? r.range(0, w - 1) : 0), cy + gap / 2 - 1, 1, 1);
      x += w + r.range(6.4, 9.2) * Math.max(1, p.sp * 0.9);
    }
    B.col(x + 2, 'cube'); B.x = x + 9;
  };

  P.ball = (B, r, p) => {
    const x0 = B.x; B.col(x0 + 0.5, 'ball');
    let x = x0 + 9, prev = 1;      // la palla parte sul pavimento: l'ostacolo "sul soffitto" non la tocca
    const n = r.int(4, 5 + Math.floor(p.d * 4));
    for (let k = 0; k < n; k++) {
      const side = r.chance(0.5) ? 1 : 0, T = new Builder(x), kind = r.pick(p.d < 0.3 ? ['s', 's', 't'] : ['s', 't', 'w', 's']);
      let w = 1;
      if (kind === 's') { w = r.int(1, 3); T.spikes(x, 0, w, 0, 0); }
      else if (kind === 't') { w = r.pick([1, 2]); T.block(x, 0, w, r.pick([2, 3, 4])); if (r.chance(0.4)) T.spike(x, 0, 0, 1); }
      else { w = 2; T.saw(x + 1, 0.8, 0.8); }
      const o = side ? mirror(T.o) : T.o; for (const q of o) B.o.push(q);
      const need = side !== prev;
      x += w + (need ? r.range(7, 9.4) : r.range(4.6, 7.2)) * Math.max(1, p.sp * 0.9); prev = side;
    }
    B.col(x + 1, 'cube'); B.col(x + 1.4, 'gn'); B.x = x + 9;
  };

  P.wave = (B, r, p) => {
    const x0 = B.x; B.col(x0 + 0.5, 'wave');
    const g = 4.4 - p.d * 1.3 + r.range(-0.1, 0.1), len = r.int(24, 34 + Math.floor(p.d * 16));
    const start = x0 + 8;
    let cy = r.range(g / 2 + 0.3, CEIL - g / 2 - 0.3), dir = r.chance(0.5) ? 1 : -1, x = 0;
    const segs = [];
    while (x < len) {
      const L = r.range(2.2, 5.5); if (cy + dir * L > CEIL - g / 2 - 0.1) dir = -1; else if (cy + dir * L < g / 2 + 0.1) dir = 1;
      segs.push({ x0: x, x1: x + L, c0: cy, c1: cy + dir * L }); cy += dir * L; x += L; dir = -dir;
    }
    const centre = (u) => { for (const s of segs) if (u <= s.x1) return s.c0 + (s.c1 - s.c0) * ((u - s.x0) / (s.x1 - s.x0)); return segs[segs.length - 1].c1; };
    const step = 0.5;
    for (let u = 0; u < len; u += step) {
      const a = centre(u), b = centre(u + step), lo = Math.max(a, b) - g / 2, hi = Math.min(a, b) + g / 2;
      B.block(start + u, 0, step, lo); B.block(start + u, hi, step, CEIL - hi);
    }
    const ex = start + len + 3; B.col(ex, 'cube'); B.x = ex + 8;
  };

  P.miniHole = (B, r, p) => {
    const x0 = B.x; B.col(x0 + 0.5, 'sm');
    B.spikes(x0 + 5, 0, r.int(1, 2), 0, 0);
    const wx = x0 + 5 + 6 + r.range(1, 3);
    B.block(wx, 0.72, r.int(3, 5), CEIL - 0.72);
    if (p.d > 0.5) B.spikes(wx + 0.5, 0, 1, 0, 1);
    B.col(wx + 9, 'sn'); B.x = wx + 14;
  };

  P.dimOrbWall = (B, r, p) => {
    const x0 = B.x, hi = r.chance(0.5) ? 2.4 : 1.0;
    B.orb(x0 + 1.2, hi, 4);
    B.block(x0 + 6, 0, 1.2, CEIL, 0);                       // muro pieno: esiste solo nello strato 0
    B.spikes(x0 + 10, 0, r.int(1, 2), 0, 0, 1);              // spuntoni solo nello strato 1
    B.orb(x0 + 15, r.chance(0.5) ? 2.4 : 1.0, 4);
    B.block(x0 + 19, 0, 1.2, CEIL, 1);                       // muro pieno: solo nello strato 1
    B.spikes(x0 + 23, 0, 1, 0, 0, 0);
    B.x = x0 + 28;
  };

  P.dimBridge = (B, r, p) => {
    const x0 = B.x, n = Math.min(r.int(6, 8), Math.floor(8 * p.sp));
    B.orb(x0 + 1.2, 1.0, 4);
    B.spikes(x0 + 5, 0, n, 0, 0);                            // fossa di spuntoni, sempre presente
    B.block(x0 + 4.4, 0, n + 1.2, 0.62, 1);                 // ponte: esiste solo nello strato 1
    B.orb(x0 + 5 + n + 2, 1.0, 4);
    B.x = x0 + 5 + n + 8;
  };

  P.dimHop = (B, r, p) => {
    const x0 = B.x;
    B.col(x0 + 0.5, 'd1');
    B.spikes(x0 + 5, 0, r.int(1, 2), 0, 0, 0); B.spikes(x0 + 9, 0, r.int(1, 2), 0, 0, 1); B.spikes(x0 + 14, 0, 1, 0, 0, 0);
    B.col(x0 + 16, 'd0');
    B.spikes(x0 + 21, 0, r.int(1, 2), 0, 0, 0);
    B.x = x0 + 26;
  };

  P.gauntlet = (B, r, p) => {         // due pattern semplici uno dopo l'altro, senza respiro
    const a = r.pick(['spikes', 'blockHop', 'padJump', 'saws', 'orbField']), b = r.pick(['spikes', 'platformSpikes', 'staircase']);
    P[a](B, r, p); B.x -= 1.5; P[b](B, r, p);
  };

  /* ------------------------------------------------------------- catalogo -- */
  const POOL = [
    { id: 'spikes', min: 0, w: 3.0 }, { id: 'blockHop', min: 1, w: 2.4 }, { id: 'staircase', min: 3, w: 1.6 },
    { id: 'platformSpikes', min: 4, w: 1.8 }, { id: 'padJump', min: 6, w: 1.6 }, { id: 'orbField', min: 9, w: 1.6 },
    { id: 'saws', min: 12, w: 1.3 }, { id: 'ship', min: 10, w: 1.5, special: 1 }, { id: 'gravityRun', min: 16, w: 1.3 },
    { id: 'speedBurst', min: 18, w: 0.9 }, { id: 'dimOrbWall', min: 22, w: 1.3, dim: 1 }, { id: 'ball', min: 26, w: 1.2, special: 1 },
    { id: 'dimBridge', min: 30, w: 1.1, dim: 1 }, { id: 'miniHole', min: 32, w: 0.8 }, { id: 'dimHop', min: 36, w: 0.9, dim: 1 },
    { id: 'wave', min: 40, w: 1.3, special: 1 }, { id: 'gauntlet', min: 55, w: 1.5 },
  ];
  // la prima volta che una novità compare, la si mostra in un blocco "da tutorial"
  const FORCED = { 6: 'padJump', 9: 'orbField', 10: 'ship', 12: 'saws', 16: 'gravityRun', 18: 'speedBurst', 22: 'dimOrbWall', 26: 'ball', 30: 'dimBridge', 32: 'miniHole', 36: 'dimHop', 40: 'wave' };

  D.levelParams = function (i) {
    const d = Math.min(1, (i / 199) * 0.92 + 0.04 * Math.sin(i * 1.7) + 0.02);
    const fast = Math.max(0, Math.min(0.85, (i - 55) / 130)), base = i < 6 ? 1 : (hash(i, 3, 5) % 1000) / 1000 < fast ? 2 : (i % 11 === 5 && i > 12 ? 0 : 1);
    return {
      i, world: Math.floor(i / D.WORLD_SIZE), j: i % D.WORLD_SIZE, d: Math.max(0.02, d), base,
      target: 120 + i * 1.1, stars: 1 + Math.floor(i / 22),
    };
  };

  function choose(ctx, r, c) {
    if (c === 1 && FORCED[ctx.i]) return POOL.find((q) => q.id === FORCED[ctx.i]);
    const cand = POOL.filter((q) => q.min <= ctx.i && !(q.special && ctx.specials >= (ctx.i > 90 ? 3 : 2)) && q.id !== ctx.last);
    if (!cand.length) cand.push(POOL[0]);
    let tot = 0; const ws = cand.map((q) => { let w = q.w; if (q.special && ctx.i > 60) w *= 1.3; if (ctx.i - q.min < 8) w *= 1.8; if (q.special && ctx.specials === 0 && ctx.chunks > 2) w *= 2; tot += w; return w; });
    let t = r.f() * tot; for (let k = 0; k < cand.length; k++) { t -= ws[k]; if (t <= 0) return cand[k]; }
    return cand[cand.length - 1];
  }

  /** Genera un blocco. ctx = {i, p, x, last, chunks, specials}. */
  D.genChunk = function (ctx, c, a) {
    const r = RNG(hash(ctx.i * 7919 + 13, c * 104729 + 5, a * 1299709 + 77));
    const p = ctx.p, sp = SPEEDS[p.base];
    const B = new Builder(ctx.x);
    B.x += c === 0 ? 14 : r.range(4, 6.5);
    const pat = choose(ctx, r, c);
    P[pat.id](B, r, { d: p.d, sp, i: ctx.i, world: p.world, base: p.base });
    B.x += r.range(3.2, 5);
    return { objs: B.o, end: B.x, pat: pat.id, special: !!pat.special };
  };

  /**
   * Costruisce il livello i. `attempts[c]` = tentativo da usare per il blocco c (default 0).
   * `validate(level, chunk, c, a)` opzionale: se restituisce falso il blocco viene rigenerato.
   */
  D.buildLevel = function (i, attempts, validate, maxAttempts) {
    const p = D.levelParams(i), objs = [], used = [];
    const ctx = { i, p, x: 0, last: '', chunks: 0, specials: 0 };
    let c = 0;
    while (ctx.x < p.target) {
      let a = attempts && attempts[c] !== undefined ? attempts[c] : 0, chunk;
      for (;;) {
        chunk = D.genChunk(ctx, c, a);
        if (!validate || validate({ objs, p, chunk, c }, a)) break;
        a++; if (a > (maxAttempts || 40)) throw new Error('level ' + i + ' chunk ' + c + ': nessun tentativo valido');
      }
      for (const o of chunk.objs) objs.push(o);
      used.push(a); ctx.x = chunk.end; ctx.last = chunk.pat; ctx.chunks++; if (chunk.special) ctx.specials++;
      c++;
    }
    return { idx: i, len: ctx.x + 6, speed: p.base, ceil: CEIL, world: p.world, params: p, objs, attempts: used };
  };

  /** Livello giocabile (usa la tabella validata se presente + le monete). */
  D.getLevel = function (i) {
    const data = D.LEVELDATA && D.LEVELDATA[i];
    const lv = D.buildLevel(i, data ? data.a : null);
    if (data && data.c) data.c.forEach((q, k) => lv.objs.push({ k: 'c', x: q[0], y: q[1], i: k, lay: q[2] === undefined ? 2 : q[2] }));
    D.prepare(lv);
    return lv;
  };

  D.PATTERNS = P;
})(typeof window !== 'undefined' ? window : globalThis);
