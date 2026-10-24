/* ============================================================================
 * HyperDimension — physics.js
 * Fisica 4D: ipersfere vs iper-parallelepipedi (AABB a 4 assi), urti elastici
 * ipersfera-ipersfera con impulsi in R^4, gravità, attrito e rotazione
 * (velocità angolare = bivettore a 6 componenti nei piani XY,XZ,YZ,XW,YW,ZW).
 * Deterministico, senza dipendenze: gira identico nel browser e in Node.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD;
  const { sqrt, abs, min, max, sin, cos } = Math;
  const P = (HD.physics = {});

  P.GRAVITY = 22;

  /* ------------------------------------------------------------------ box -- */
  /** Crea una scatola 4D. type: 's' solido, 'h' letale, 'g' obiettivo, 'i' ghiaccio. */
  P.box = function (min4, max4, type, mv) {
    return {
      min: min4.slice(), max: max4.slice(), type: type || 's',
      mv: mv || null, // {axis, amp, speed, phase}
      base: { min: min4.slice(), max: max4.slice() },
      delta: [0, 0, 0, 0],
    };
  };

  /** Aggiorna posizione delle scatole mobili al tempo t e memorizza lo spostamento. */
  P.updateBoxes = function (boxes, t) {
    for (const b of boxes) {
      if (!b.mv) continue;
      const off = b.mv.amp * sin(b.mv.speed * t + (b.mv.phase || 0));
      const ax = b.mv.axis;
      const nmin = b.base.min[ax] + off, nmax = b.base.max[ax] + off;
      b.delta = [0, 0, 0, 0];
      b.delta[ax] = nmin - b.min[ax];
      b.min[ax] = nmin; b.max[ax] = nmax;
    }
  };

  /** Punto più vicino al centro p sulla scatola e penetrazione di una ipersfera di raggio r. */
  P.sphereVsBox = function (p, r, b) {
    const d = [0, 0, 0, 0];
    let d2 = 0;
    for (let i = 0; i < 4; i++) {
      const c = p[i] < b.min[i] ? b.min[i] : p[i] > b.max[i] ? b.max[i] : p[i];
      d[i] = p[i] - c; d2 += d[i] * d[i];
    }
    if (d2 > r * r) return null;
    if (d2 > 1e-12) {
      const dl = sqrt(d2);
      return { n: [d[0] / dl, d[1] / dl, d[2] / dl, d[3] / dl], pen: r - dl };
    }
    // centro dentro la scatola: espelli lungo l'asse di minima penetrazione
    let bi = 0, bs = 1, bp = Infinity;
    for (let i = 0; i < 4; i++) {
      const lo = p[i] - b.min[i], hi = b.max[i] - p[i];
      if (lo < bp) { bp = lo; bi = i; bs = -1; }
      if (hi < bp) { bp = hi; bi = i; bs = 1; }
    }
    const n = [0, 0, 0, 0]; n[bi] = bs;
    return { n, pen: bp + r };
  };

  /** Sovrapposizione ipersfera/scatola (senza normale). */
  P.overlaps = function (p, r, b) { return !!P.sphereVsBox(p, r, b); };

  /* --------------------------------------------------------------- player -- */
  P.newPlayer = function (pos) {
    return { pos: pos.slice(), vel: [0, 0, 0, 0], r: 0.4, onGround: false, coyote: 0, riding: null, dead: false, won: false, jumpBuf: 0 };
  };

  /**
   * Un passo di simulazione per il giocatore.
   * input: { mx, mz (-1..1 in coordinate di mondo), mw (-1..1), jump:boolean }
   */
  P.stepPlayer = function (pl, input, world, dt) {
    const SPEED = 5.2, WSPEED = 4.2, ACC = 38, JUMP = 8.2;
    const boxes = world.boxes;
    if (pl.dead || pl.won) return;

    // trascinamento dalla piattaforma su cui si è appoggiati
    if (pl.riding) { for (let i = 0; i < 4; i++) pl.pos[i] += pl.riding.delta[i]; }

    // accelerazione orizzontale e in W
    const tx = input.mx * SPEED, tz = input.mz * SPEED, tw = input.mw * WSPEED;
    const k = min(1, ACC * dt * (pl.onGround ? 1 : 0.55));
    const ice = pl.onGround && pl.riding && pl.riding.type === 'i';
    const kk = ice ? k * 0.12 : k;
    pl.vel[0] += (tx - pl.vel[0]) * kk;
    pl.vel[2] += (tz - pl.vel[2]) * kk;
    pl.vel[3] += (tw - pl.vel[3]) * min(1, ACC * dt * 0.8);
    pl.vel[1] -= P.GRAVITY * dt;
    if (pl.vel[1] < -40) pl.vel[1] = -40;

    pl.coyote = max(0, pl.coyote - dt);
    pl.jumpBuf = input.jump ? 0.12 : max(0, pl.jumpBuf - dt);
    if (pl.jumpBuf > 0 && (pl.onGround || pl.coyote > 0)) {
      pl.vel[1] = JUMP; pl.onGround = false; pl.coyote = 0; pl.jumpBuf = 0; pl.riding = null;
    }

    for (let i = 0; i < 4; i++) pl.pos[i] += pl.vel[i] * dt;

    // limiti del mondo in W e caduta nel vuoto
    const wl = world.wLimit || 5;
    if (pl.pos[3] > wl) { pl.pos[3] = wl; pl.vel[3] = min(0, pl.vel[3]); }
    if (pl.pos[3] < -wl) { pl.pos[3] = -wl; pl.vel[3] = max(0, pl.vel[3]); }
    if (pl.pos[1] < (world.voidY !== undefined ? world.voidY : -14)) { pl.dead = true; return; }

    let grounded = false, riding = null;
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (const b of boxes) {
        if (b.type === 'h' || b.type === 'g') continue;
        const c = P.sphereVsBox(pl.pos, pl.r, b);
        if (!c) continue;
        any = true;
        for (let i = 0; i < 4; i++) pl.pos[i] += c.n[i] * c.pen;
        const vn = pl.vel[0] * c.n[0] + pl.vel[1] * c.n[1] + pl.vel[2] * c.n[2] + pl.vel[3] * c.n[3];
        if (vn < 0) for (let i = 0; i < 4; i++) pl.vel[i] -= vn * c.n[i];
        if (c.n[1] > 0.55) { grounded = true; riding = b; }
      }
      if (!any) break;
    }
    if (grounded) { pl.onGround = true; pl.coyote = 0.1; pl.riding = riding; }
    else { pl.onGround = false; pl.riding = null; }

    for (const b of boxes) {
      if (b.type === 'h' && P.overlaps(pl.pos, pl.r * 0.85, b)) { pl.dead = true; return; }
      if (b.type === 'g' && P.overlaps(pl.pos, pl.r, b)) { pl.won = true; return; }
    }
  };

  /* -------------------------------------------------------------- sandbox -- */
  /**
   * Mondo sandbox: ipersfere che rimbalzano dentro una scatola 4D con gravità.
   * Le sfere ruotano (bivettore) per attrito sui contatti.
   */
  P.Sandbox = class {
    constructor(opts) {
      opts = opts || {};
      this.half = opts.half || [5, 0, 5, 3.2];      // semi-estensione X, (Y non usata), Z, W
      this.height = opts.height || 9;
      this.restitution = opts.restitution !== undefined ? opts.restitution : 0.82;
      this.friction = opts.friction !== undefined ? opts.friction : 0.18;
      this.gravity = opts.gravity !== undefined ? opts.gravity : 12;
      this.gdir = [0, -1, 0, 0];                     // direzione della gravità (unitaria)
      this.balls = [];
      this.seed = opts.seed || 12345;
      this.time = 0;
    }
    /** Ruota la gravità dal piano Y (a=0) verso l'asse W (a=π/2): le sfere "cadono" nella 4ª dimensione. */
    setGravityAngle(a) { this.gdir = [0, -Math.cos(a), 0, -Math.sin(a)]; }
    rand() { // LCG deterministico
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }
    addBall(pos, vel, r, mass) {
      const b = {
        pos: pos.slice(), vel: (vel || [0, 0, 0, 0]).slice(), r: r || 0.6,
        m: mass || (r || 0.6) ** 4,
        rot: HD.M4.identity(), spin: [0, 0, 0, 0, 0, 0], hue: this.rand(),
      };
      this.balls.push(b);
      return b;
    }
    spawnRandom(n) {
      for (let i = 0; i < n; i++) {
        const r = 0.45 + this.rand() * 0.45;
        this.addBall(
          [(this.rand() * 2 - 1) * (this.half[0] - r), 2 + this.rand() * (this.height - 3), (this.rand() * 2 - 1) * (this.half[2] - r), (this.rand() * 2 - 1) * (this.half[3] - r)],
          [(this.rand() * 2 - 1) * 3, 0, (this.rand() * 2 - 1) * 3, (this.rand() * 2 - 1) * 3], r);
      }
    }
    /** Energia totale (cinetica + potenziale + rotazionale): utile per i test. */
    energy() {
      let e = 0;
      for (const b of this.balls) {
        const v2 = b.vel[0] ** 2 + b.vel[1] ** 2 + b.vel[2] ** 2 + b.vel[3] ** 2;
        e += 0.5 * b.m * v2 - b.m * this.gravity * (this.gdir[0] * b.pos[0] + this.gdir[1] * b.pos[1] + this.gdir[2] * b.pos[2] + this.gdir[3] * b.pos[3]);
      }
      return e;
    }
    momentum() {
      const p = [0, 0, 0, 0];
      for (const b of this.balls) for (let i = 0; i < 4; i++) p[i] += b.m * b.vel[i];
      return p;
    }
    /** Applica attrito di contatto: il moto tangenziale genera rotazione. */
    _spinFromContact(b, n, vt) {
      // bivettore n ^ vt, componenti nei piani (0,1),(0,2),(1,2),(0,3),(1,3),(2,3)
      const k = this.friction * 0.6 / b.r;
      for (let q = 0; q < 6; q++) {
        const i = HD.PLANES[q][0], j = HD.PLANES[q][1];
        b.spin[q] += k * (n[i] * vt[j] - n[j] * vt[i]);
      }
    }
    step(dt) {
      const bs = this.balls;
      this.time += dt;
      const hx = this.half[0], hz = this.half[2], hw = this.half[3], H = this.height;
      for (const b of bs) {
        for (let i = 0; i < 4; i++) b.vel[i] += this.gravity * this.gdir[i] * dt;
        for (let i = 0; i < 4; i++) b.pos[i] += b.vel[i] * dt;
        // pareti: x, z, w in [-h, h]; pavimento y=0; soffitto y=H
        const walls = [[0, -hx, 1], [0, hx, -1], [2, -hz, 1], [2, hz, -1], [3, -hw, 1], [3, hw, -1], [1, 0, 1], [1, H, -1]];
        for (const [ax, pos, dir] of walls) {
          const pen = dir > 0 ? (pos + b.r) - b.pos[ax] : b.pos[ax] - (pos - b.r);
          if (pen > 0) {
            b.pos[ax] += dir * pen;
            const vn = b.vel[ax] * dir;
            if (vn < 0) {
              const n = [0, 0, 0, 0]; n[ax] = dir;
              const vt = b.vel.slice(); vt[ax] = 0;
              b.vel[ax] = -b.vel[ax] * this.restitution;
              // attrito: smorza la componente tangenziale proporzionalmente all'impatto
              const f = 1 - min(0.5, this.friction * (-vn) * 0.12);
              for (let i = 0; i < 4; i++) if (i !== ax) b.vel[i] *= f;
              this._spinFromContact(b, n, vt);
            }
          }
        }
      }
      // urti ipersfera-ipersfera
      for (let i = 0; i < bs.length; i++) {
        for (let j = i + 1; j < bs.length; j++) {
          const a = bs[i], c = bs[j];
          const d = [c.pos[0] - a.pos[0], c.pos[1] - a.pos[1], c.pos[2] - a.pos[2], c.pos[3] - a.pos[3]];
          const dl2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] + d[3] * d[3];
          const rr = a.r + c.r;
          if (dl2 >= rr * rr) continue;
          const dl = sqrt(dl2) || 1e-9;
          const n = [d[0] / dl, d[1] / dl, d[2] / dl, d[3] / dl];
          const pen = rr - dl, mt = a.m + c.m;
          for (let k = 0; k < 4; k++) { a.pos[k] -= n[k] * pen * (c.m / mt); c.pos[k] += n[k] * pen * (a.m / mt); }
          const rv = [c.vel[0] - a.vel[0], c.vel[1] - a.vel[1], c.vel[2] - a.vel[2], c.vel[3] - a.vel[3]];
          const vn = rv[0] * n[0] + rv[1] * n[1] + rv[2] * n[2] + rv[3] * n[3];
          if (vn < 0) {
            const jimp = (-(1 + this.restitution) * vn) / (1 / a.m + 1 / c.m);
            for (let k = 0; k < 4; k++) { a.vel[k] -= (jimp * n[k]) / a.m; c.vel[k] += (jimp * n[k]) / c.m; }
            const vt = [rv[0] - vn * n[0], rv[1] - vn * n[1], rv[2] - vn * n[2], rv[3] - vn * n[3]];
            this._spinFromContact(a, n, vt);
            this._spinFromContact(c, [-n[0], -n[1], -n[2], -n[3]], [-vt[0], -vt[1], -vt[2], -vt[3]]);
          }
        }
      }
      // integrazione della rotazione
      for (const b of bs) {
        const s = b.spin;
        if (s[0] || s[1] || s[2] || s[3] || s[4] || s[5]) {
          b.rot = HD.M4.mul(HD.M4.fromAngles([s[0] * dt, s[1] * dt, s[2] * dt, s[3] * dt, s[4] * dt, s[5] * dt]), b.rot);
          for (let q = 0; q < 6; q++) s[q] *= 1 - min(1, 0.35 * dt);
        }
      }
      if (((this.time * 60) | 0) % 90 === 0) for (const b of bs) b.rot = HD.M4.orthonormalize(b.rot);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
