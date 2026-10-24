/* ============================================================================
 * HyperDimension — lab.js
 * Laboratorio: proiezione prospettica 4D→3D, sezione 3D con iperpiano mobile,
 * rotazioni nei sei piani. Tutta la matematica è nella CPU (math4/polytopes).
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, U = HD.ui, t = (k) => HD.i18n.t(k);
  HD.modes = HD.modes || {};

  const SHAPES = ['tesseract', 'cell5', 'cell16', 'cell24', 'cell600', 'duoprism', 'hopf'];
  const DEF_SPEED = [0.05, 0, 0.07, 0.31, 0.23, 0.17];

  const Lab = (HD.modes.lab = {
    id: 'lab',
    shape: 'cell600', view: 'overlay',
    angles: [0.2, 0, 0.4, 0.5, 0.3, 0.2], speeds: DEF_SPEED.slice(), auto: true,
    sweep: true, sliceW: 0, scale: 1.7, dist: 4.4, faces: true, verts: true,
    tv: null, ui: {}, idle: 0, frame: 0,

    enter(app) {
      this.app = app;
      app.cam.dist = 8.2; app.cam.target = [0, 0, 0]; app.cam.pitch = 0.3;
      this.build(app);
      app.setHint(t('lab.tip'));
    },
    exit() {},

    build(app) {
      const p = app.panel; p.innerHTML = ''; p.className = 'lab';
      const P = HD.polytopes.get(this.shape);
      p.appendChild(U.h3(t('lab.shape')));
      p.appendChild(U.chips(SHAPES.map((id) => ({ id, label: t('shape.' + id) })), this.shape, (id) => { this.setShape(id); }));
      this.ui.facts = U.info(''); this.ui.facts.style.marginTop = '10px'; p.appendChild(this.ui.facts);
      p.appendChild(U.h3(t('lab.view')));
      p.appendChild(U.chips(['overlay', 'proj', 'slice', 'side'].map((id) => ({ id, label: t('view.' + id) })), this.view, (id) => { this.view = id; }));
      p.appendChild(U.h3(t('lab.rot')));
      HD.PLANE_NAMES.forEach((name, i) => {
        const s = U.slider(name, -3.1416, 3.1416, 0.001, this.angles[i], (v) => { this.angles[i] = v; }, { w: name.includes('W'), fmt: (v) => ((v * 180) / Math.PI).toFixed(0) + '°' });
        this.ui['a' + i] = s; p.appendChild(s);
      });
      p.appendChild(U.btns([
        U.btn(t('lab.random'), () => { this.speeds = this.speeds.map(() => (Math.random() - 0.5) * 0.9); this.auto = true; this.ui.auto.set(true); }),
        U.btn(t('lab.reset'), () => { this.angles = [0.2, 0, 0.4, 0.5, 0.3, 0.2]; this.speeds = DEF_SPEED.slice(); this.sliceW = 0; this.ui.w.set(0); }),
      ]));
      p.appendChild(U.h3(t('lab.slice')));
      this.ui.w = U.slider(t('lab.w'), -2.5, 2.5, 0.001, this.sliceW, (v) => { this.sliceW = v; this.sweep = false; this.ui.sweep.set(false); }, { w: true });
      this.ui.w.firstChild.style.width = '50px';
      p.appendChild(this.ui.w);
      this.ui.sweep = U.toggle(t('lab.sweep'), this.sweep, (v) => { this.sweep = v; });
      p.appendChild(this.ui.sweep);
      p.appendChild(U.h3(t('lab.opts')));
      this.ui.auto = U.toggle(t('lab.auto'), this.auto, (v) => { this.auto = v; });
      p.appendChild(this.ui.auto);
      p.appendChild(U.toggle(t('lab.faces'), this.faces, (v) => { this.faces = v; }));
      p.appendChild(U.toggle(t('lab.verts'), this.verts, (v) => { this.verts = v; }));
      p.appendChild(U.slider(t('lab.scale'), 0.8, 2.4, 0.01, this.scale, (v) => { this.scale = v; }));
      p.appendChild(U.slider(t('lab.dist'), 2.4, 9, 0.01, this.dist, (v) => { this.dist = v; }));
      this.refreshFacts();
    },

    setShape(id) { this.shape = id; this.tv = null; this.refreshFacts(); },
    refreshFacts() {
      if (!this.ui.facts) return;
      const P = HD.polytopes.get(this.shape), i = P.info;
      this.ui.facts.innerHTML = `<b>${t('shape.' + this.shape)}</b> — ${t('fact.' + this.shape)}<br><span class="kbd">${i.v} · ${i.e} · ${i.f || '—'} · ${i.c || '—'}</span> ${t('lab.facts')}` +
        (i.f ? `<br><span class="kbd">${i.v} − ${i.e} + ${i.f} − ${i.c} = 0</span> ${t('lab.euler')}` : '');
    },

    update(dt, app) {
      this.frame++;
      if (this.auto) for (let i = 0; i < 6; i++) {
        this.angles[i] += this.speeds[i] * dt;
        if (this.angles[i] > Math.PI) this.angles[i] -= 2 * Math.PI;
        if (this.angles[i] < -Math.PI) this.angles[i] += 2 * Math.PI;
      }
      const P = HD.polytopes.get(this.shape);
      if (this.sweep) {
        const amp = P.radius * this.scale * 0.92;
        this.sliceW = Math.sin(app.time * 0.42) * amp;
      }
      if (this.frame % 5 === 0 && app.panel.className === 'lab') {
        for (let i = 0; i < 6; i++) this.ui['a' + i] && this.ui['a' + i].set(this.angles[i]);
        this.ui.w && this.ui.w.set(Math.max(-2.5, Math.min(2.5, this.sliceW)));
      }
      this.idle += dt;
      if (this.idle > 2.5 && !app.interacting) app.cam.yaw += dt * 0.12;
    },

    drag(dx, dy, ev, app) {
      this.idle = 0;
      if (ev.shiftKey || ev.button === 2) {
        if (ev.altKey) { this.angles[5] += dx * 0.006; this.angles[2] += dy * 0.006; }
        else { this.angles[3] += dx * 0.006; this.angles[4] += dy * 0.006; }
        this.auto = false; this.ui.auto && this.ui.auto.set(false);
        return true;
      }
      return false;
    },

    render(r, app) {
      const P = HD.polytopes.get(this.shape), cam = app.cam;
      const R = HD.M4.fromAngles(this.angles);
      const sc = this.scale;
      this.tv = HD.transformVerts(P, R, sc, [0, 0, 0, 0], this.tv);
      const tv = this.tv, nv = P.verts.length;
      const side = this.view === 'side', offP = side ? -3.2 : 0, offS = side ? 3.2 : 0;
      const d = Math.max(this.dist, sc * P.radius + 0.45);
      const showP = this.view !== 'slice', showS = this.view !== 'proj';
      const lw = r.lw(this.shape === 'hopf' ? 1.1 : 1.7);
      const dense = P.edges.length > 1000;
      const den = Math.min(1, 34 / Math.sqrt(P.edges.length));   // più spigoli → linee più tenui

      // ---- proiezione prospettica 4D → 3D ----
      if (showP) {
        const pos = new Float32Array(nv * 3), col = new Array(nv), ok = new Uint8Array(nv);
        for (let i = 0; i < nv; i++) {
          const w = tv[i * 4 + 3], k = d / (d - w);
          if (d - w < 0.15) { ok[i] = 0; continue; }
          ok[i] = 1;
          pos[i * 3] = tv[i * 4] * k + offP; pos[i * 3 + 1] = tv[i * 4 + 1] * k; pos[i * 3 + 2] = tv[i * 4 + 2] * k;
          const wn = Math.max(-1, Math.min(1, w / (sc * P.radius)));
          const h = 0.5 + 0.38 * (wn * 0.5 + 0.5);
          const rgb = HD.hsv(h, 0.78, 1);
          const a = (this.view === 'overlay' ? 0.55 : 0.95) * (0.45 + 0.55 * Math.min(1, k * 0.7)) * den * den * 1.6;
          col[i] = [rgb[0], rgb[1], rgb[2], a];
        }
        for (const [a, b] of P.edges) {
          if (!ok[a] || !ok[b]) continue;
          r.line([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], col[a], col[b], lw);
        }
        if (this.verts && !dense) {
          const ps = (nv > 60 ? 3.2 : 7) * Math.max(0.6, den * 1.2);
          for (let i = 0; i < nv; i++) if (ok[i]) { const c = col[i]; r.point([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], [c[0], c[1], c[2], 1.0], ps * (0.7 + 0.5 * Math.min(2, d / (d - tv[i * 4 + 3])))); }
        }
      }

      // ---- sezione 3D (iperpiano w = s) ----
      if (showS) {
        const s = HD.slice(P, tv, this.sliceW);
        const nc = Math.max(1, P.cells.length);
        if (this.faces) {
          for (const poly of s.polys) {
            const rgb = HD.hsv(0.45 + 0.5 * (poly.ci / nc), 0.55, 1);
            const pts = poly.pts.map((q) => [q[0] + offS, q[1], q[2]]);
            r.poly(pts, poly.n, [rgb[0], rgb[1], rgb[2], 0.55 * Math.min(1, 3.2 / Math.sqrt(Math.max(1, s.polys.length)))], 'glass');
          }
        }
        const np = Math.max(1, s.polys.length), ea = Math.min(1, 0.2 + 1.7 / Math.sqrt(np));
        for (const poly of s.polys) {
          const n = poly.pts.length, hc = HD.hsv(0.45 + 0.5 * (poly.ci / nc), 0.35, 1);
          const ec = [hc[0], hc[1], hc[2], ea];
          for (let i = 0; i < n; i++) {
            const a = poly.pts[i], b = poly.pts[(i + 1) % n];
            r.line([a[0] + offS, a[1], a[2]], [b[0] + offS, b[1], b[2]], ec, ec, r.lw(np > 60 ? 1.6 : 2.4));
          }
        }
        for (const q of s.pts) r.point([q[0] + offS, q[1], q[2]], [1, 1, 1, 1.0], (this.shape === 'hopf' ? 6 : 9) * Math.max(0.45, den) * (s.pts.length > 100 ? 0.5 : 1));
        // piano di taglio: un anello che indica dove siamo
        this._hudSlice = s.pts.length;
      }
      app.hudTop(`<span class="mono">w = ${this.sliceW.toFixed(2)}</span>`);
    },
  });
})(window);
