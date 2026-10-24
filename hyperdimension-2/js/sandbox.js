/* ============================================================================
 * HyperDimension — sandbox.js
 * Fisica 4D dal vivo: ipersfere che rimbalzano in una scatola 4D. La sezione
 * a w = s le mostra come sfere che nascono, crescono, si rimpiccioliscono e
 * spariscono. La gravità può essere inclinata verso la quarta dimensione.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, U = HD.ui, t = (k) => HD.i18n.t(k);
  HD.modes = HD.modes || {};
  const { sin, cos, sqrt, abs, max, min, PI } = Math;

  const SB = (HD.modes.sandbox = {
    id: 'sandbox', sim: null, sliceW: 0, sweep: true, ghosts: true, tilt: 0, timeScale: 1, acc: 0, ui: {},

    reset(n) {
      this.sim = new HD.physics.Sandbox({ seed: (Math.random() * 1e9) | 0, restitution: this.sim ? this.sim.restitution : 0.82 });
      this.sim.setGravityAngle(this.tilt);
      this.sim.spawnRandom(n === undefined ? 14 : n);
    },

    enter(app) {
      if (!this.sim) this.reset(14);
      app.cam.dist = 17; app.cam.pitch = 0.42; app.cam.yaw = 0.7; app.cam.target = [0, 3.4, 0]; app.cam.maxDist = 60;
      this.build(app);
      document.getElementById('gauge').style.display = 'block';
      app.setHint(t('ph.tip'));
    },
    exit() { document.getElementById('gauge').style.display = 'none'; },

    build(app) {
      const p = app.panel; p.innerHTML = ''; p.className = 'sandbox';
      const sim = this.sim;
      p.appendChild(U.h3(t('ph.world')));
      this.ui.count = U.info('');
      p.appendChild(U.btns([
        U.btn(t('ph.add'), () => { if (sim.balls.length < 60) sim.spawnRandom(5); }, 'pri'),
        U.btn(t('ph.shake'), () => { sim.balls.forEach((b) => { b.vel[0] += (Math.random() - 0.5) * 12; b.vel[1] += Math.random() * 9; b.vel[2] += (Math.random() - 0.5) * 12; b.vel[3] += (Math.random() - 0.5) * 12; }); }),
        U.btn(t('ph.clear'), () => { sim.balls.length = 0; }, 'warn'),
      ]));
      p.appendChild(this.ui.count);
      p.appendChild(U.h3(t('ph.gravity')));
      p.appendChild(U.slider(t('ph.tilt'), 0, 90, 1, this.tilt * 180 / PI, (v) => { this.tilt = v * PI / 180; sim.setGravityAngle(this.tilt); }, { w: true, fmt: (v) => v.toFixed(0) + '°' }));
      p.lastChild.firstChild.style.width = '60px';
      p.appendChild(U.slider(t('ph.bounce'), 0.2, 1, 0.01, sim.restitution, (v) => { sim.restitution = v; }));
      p.lastChild.firstChild.style.width = '60px';
      p.appendChild(U.slider(t('ph.slow'), 0.1, 1.5, 0.01, this.timeScale, (v) => { this.timeScale = v; }, { fmt: (v) => v.toFixed(2) + '×' }));
      p.lastChild.firstChild.style.width = '60px';
      p.appendChild(U.h3(t('ph.slice')));
      this.ui.w = U.slider(t('ph.w'), -3.2, 3.2, 0.001, this.sliceW, (v) => { this.sliceW = v; this.sweep = false; this.ui.sweep.set(false); }, { w: true });
      this.ui.w.firstChild.style.width = '60px'; p.appendChild(this.ui.w);
      this.ui.sweep = U.toggle(t('ph.sweep'), this.sweep, (v) => { this.sweep = v; }); p.appendChild(this.ui.sweep);
      p.appendChild(U.toggle(t('ph.ghost'), this.ghosts, (v) => { this.ghosts = v; }));
      p.appendChild(U.info('<br>' + t('ph.pattern')));
    },

    bg() { return { floor: true, floorY: 0, fog: 0.006, top: [0.02, 0.02, 0.07], bot: [0.004, 0.005, 0.016], glow: 1.2 }; },

    update(dt, app) {
      const sim = this.sim, h = 1 / 120;
      this.acc += dt * this.timeScale;
      let g = 0;
      while (this.acc >= h && g++ < 10) { sim.step(h); this.acc -= h; }
      if (this.sweep) this.sliceW = sin(app.time * 0.38) * sim.half[3] * 0.95;
      if (app.mode === this && Math.floor(app.time * 10) % 3 === 0) {
        this.ui.w && this.ui.w.set(max(-3.2, min(3.2, this.sliceW)));
        this.ui.count && (this.ui.count.innerHTML = `<b>${sim.balls.length}</b> ${t('ph.count')}`);
      }
      app.hudTop(`<span class="mono">w = ${this.sliceW.toFixed(2)}</span>`);
      this.drawGauge();
    },

    click(e, app, canvas) {
      const rc = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rc.left) / rc.width) * 2 - 1, ny = -(((e.clientY - rc.top) / rc.height) * 2 - 1);
      const ray = app.cam.ray(nx, ny);
      let best = null, bt = Infinity;
      for (const b of this.sim.balls) {
        const dw = this.sliceW - b.pos[3]; if (abs(dw) >= b.r) continue;
        const rho = sqrt(b.r * b.r - dw * dw);
        const oc = [ray.o[0] - b.pos[0], ray.o[1] - b.pos[1], ray.o[2] - b.pos[2]];
        const bq = oc[0] * ray.d[0] + oc[1] * ray.d[1] + oc[2] * ray.d[2];
        const c = oc[0] ** 2 + oc[1] ** 2 + oc[2] ** 2 - rho * rho, disc = bq * bq - c;
        if (disc < 0) continue;
        const tt = -bq - sqrt(disc); if (tt > 0 && tt < bt) { bt = tt; best = b; }
      }
      if (best) {
        const k = 11 / max(0.5, best.r);
        best.vel[0] += ray.d[0] * k; best.vel[1] += ray.d[1] * k + 5; best.vel[2] += ray.d[2] * k; best.vel[3] += (Math.random() - 0.5) * 9;
      }
    },

    render(r, app) {
      const sim = this.sim, w = this.sliceW, hx = sim.half[0], hz = sim.half[2], H = sim.height;
      // contenitore: la sezione di una scatola 4D è una scatola 3D
      const edge = [0.2, 0.75, 1, 0.75];
      r.box([-hx, 0, -hz], [hx, H, hz], null, edge, r.lw(1.8));
      // spie sulle pareti W: più ci si avvicina ai bordi di W più le pareti si illuminano
      const nw = max(0, (abs(w) - sim.half[3] * 0.6) / (sim.half[3] * 0.4));
      if (nw > 0) { const c = w > 0 ? [1, 0.25, 0.85, 0.7 * nw] : [1, 0.7, 0.15, 0.7 * nw]; r.box([-hx, 0, -hz], [hx, H, hz], [c[0], c[1], c[2], 0.06 * nw], c, r.lw(3), 'glass'); }

      for (const b of sim.balls) {
        const dw = w - b.pos[3], ad = abs(dw);
        if (ad < b.r) {
          const rho = sqrt(b.r * b.r - dw * dw);
          r.sphere([b.pos[0], b.pos[1], b.pos[2]], rho, dw, b.hue, b.rot);
          const c = HD.hsv(b.hue, 0.5, 1);
          r.point([b.pos[0], b.pos[1], b.pos[2]], [c[0], c[1], c[2], 0.5 * rho / b.r], rho * 14);
        } else if (this.ghosts && ad - b.r < 2.6) {
          // ombra: tre cerchi massimi della proiezione, sempre più tenui
          const f = 1 - (ad - b.r) / 2.6, c = dw > 0 ? [1, 0.25, 0.85] : [1, 0.7, 0.15], a = 0.38 * f * f;
          const N = 28, C = [b.pos[0], b.pos[1], b.pos[2]], rr = b.r * (0.55 + 0.45 * f);
          for (let ax = 0; ax < 3; ax++) {
            let prev = null;
            for (let i = 0; i <= N; i++) {
              const ang = (i / N) * PI * 2, s = sin(ang) * rr, co = cos(ang) * rr;
              const q = ax === 0 ? [C[0] + co, C[1] + s, C[2]] : ax === 1 ? [C[0], C[1] + co, C[2] + s] : [C[0] + s, C[1], C[2] + co];
              if (prev) r.line(prev, q, [c[0], c[1], c[2], a], [c[0], c[1], c[2], a], r.lw(1.2)); prev = q;
            }
          }
        }
      }
    },

    drawGauge() {
      const cv = document.getElementById('gauge'), ctx = cv.getContext('2d'), W = cv.width, Hh = cv.height, sim = this.sim, hw = sim.half[3] + 0.4;
      ctx.clearRect(0, 0, W, Hh);
      const y = (w) => Hh * 0.5 - (w / hw) * (Hh * 0.43);
      ctx.fillStyle = 'rgba(160,190,255,.5)'; ctx.font = '600 20px ui-monospace,monospace'; ctx.textAlign = 'center';
      ctx.fillText('+W', W / 2, 26); ctx.fillText('−W', W / 2, Hh - 12);
      ctx.strokeStyle = 'rgba(140,170,230,.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(W * 0.12, y(sim.half[3]), W * 0.76, y(-sim.half[3]) - y(sim.half[3]));
      const lanes = 8;
      sim.balls.forEach((b, i) => {
        const c = HD.hsv(b.hue, 0.55, 1), lane = i % lanes, x = W * 0.16 + (lane / (lanes - 1)) * W * 0.68;
        const hit = abs(this.sliceW - b.pos[3]) < b.r;
        ctx.fillStyle = `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${hit ? 0.95 : 0.35})`;
        ctx.fillRect(x - 3, y(b.pos[3] + b.r), 6, y(b.pos[3] - b.r) - y(b.pos[3] + b.r));
      });
      const py = y(this.sliceW);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(W * 0.04, py); ctx.lineTo(W * 0.96, py); ctx.stroke(); ctx.shadowBlur = 0;
    },
  });
})(window);
