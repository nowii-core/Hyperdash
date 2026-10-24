/* ============================================================================
 * HyperDimension — play.js
 * Modalità gioco. Il giocatore è un'ipersfera in R^4: vede la sezione 3D del
 * mondo all'altezza w del proprio centro. Gli oggetti vicini in W compaiono
 * come "fantasmi" (rosa = w maggiore, ambra = w minore).
 * Esporta anche HD.renderWorld, usato dall'editor.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, U = HD.ui, t = (k) => HD.i18n.t(k);
  HD.modes = HD.modes || {};
  const { sin, cos, abs, min, max, sqrt, PI } = Math;

  const COL = {
    s: [0.05, 0.5, 1.0], h: [1.0, 0.1, 0.18], g: [0.15, 1.0, 0.5], i: [0.45, 0.9, 1.0],
  };
  const EDGE = { s: [0.2, 0.85, 1.0], h: [1.0, 0.35, 0.3], g: [0.4, 1.0, 0.7], i: [0.7, 1.0, 1.0] };
  const UP_COL = [1.0, 0.25, 0.85];   // oggetti a w maggiore
  const DN_COL = [1.0, 0.7, 0.15];    // oggetti a w minore
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  /** Disegna il mondo come sezione 3D a w = `w`, più i fantasmi degli oggetti vicini in W. */
  HD.renderWorld = function (r, world, w, o) {
    o = o || {};
    const range = o.range || 3.6, time = o.time || 0;
    for (const b of world.boxes) {
      const mn = [b.min[0], b.min[1], b.min[2]], mx = [b.max[0], b.max[1], b.max[2]];
      const inside = w >= b.min[3] && w <= b.max[3];
      const pulse = b.type === 'g' ? 0.75 + 0.45 * sin(time * 3.2) : b.type === 'h' ? 0.8 + 0.35 * sin(time * 5) : 1;
      if (inside) {
        const base = COL[b.type].map((c) => c * pulse);
        // vicino al bordo in W l'oggetto sta per sparire: i bordi virano a rosa/ambra
        const dMin = w - b.min[3], dMax = b.max[3] - w;
        let ec = EDGE[b.type].slice();
        const near = min(dMin, dMax);
        if (near < 0.9) ec = mix(ec, dMax < dMin ? UP_COL : DN_COL, 1 - near / 0.9);
        r.box(mn, mx, [base[0], base[1], base[2], 1], [ec[0], ec[1], ec[2], 1.15], r.lw(2.2));
        if (o.selected === b) r.box([mn[0] - 0.04, mn[1] - 0.04, mn[2] - 0.04], [mx[0] + 0.04, mx[1] + 0.04, mx[2] + 0.04], null, [1, 1, 1, 1.4], r.lw(3));
      } else if (o.ghosts !== false) {
        const dw = w < b.min[3] ? b.min[3] - w : w - b.max[3];
        if (dw > range) continue;
        const f = pow1(1 - dw / range);
        const dir = w < b.min[3] ? UP_COL : DN_COL;
        const c = mix(dir, b.type === 'h' ? [1, 0.1, 0.1] : b.type === 'g' ? [0.2, 1, 0.5] : dir, b.type === 's' || b.type === 'i' ? 0 : 0.55);
        r.box(mn, mx, [c[0], c[1], c[2], 0.12 * f], [c[0], c[1], c[2], 0.5 * f + 0.06], r.lw(1.4), 'glass');
        if (o.selected === b) r.box(mn, mx, null, [1, 1, 1, 0.9], r.lw(2.4));
      }
    }
  };
  function pow1(x) { return x * x * (3 - 2 * x); }

  /** Y della superficie solida direttamente sotto p nella sezione corrente (o null). */
  function groundBelow(world, p, radius) {
    let best = null;
    for (const b of world.boxes) {
      if (b.type === 'h' || b.type === 'g') continue;
      if (p[3] < b.min[3] || p[3] > b.max[3]) continue;
      if (p[0] < b.min[0] - 0.05 || p[0] > b.max[0] + 0.05 || p[2] < b.min[2] - 0.05 || p[2] > b.max[2] + 0.05) continue;
      if (b.max[1] <= p[1] - radius + 0.2 && (best === null || b.max[1] > best)) best = b.max[1];
    }
    return best;
  }

  const Play = (HD.modes.play = {
    id: 'play',
    level: 0, world: null, pl: null, name: '', hint: '', customLevel: null, fromEditor: false,
    simT: 0, acc: 0, time: 0, deaths: 0, state: 'run', stateT: 0, parts: [], ghosts: true, started: false, hintT: 0,
    done: U.store.get('done', {}), ui: {},

    /* ---- caricamento ---- */
    loadLevel(i) {
      i = max(0, min(HD.levels.length - 1, i | 0));
      this.level = i; this.customLevel = null; this.fromEditor = false;
      const lv = HD.levels[i];
      this.name = t('lv.' + lv.id + '.name'); this.hint = t('lv.' + lv.id + '.hint');
      this.setWorld(HD.buildWorld(lv));
    },
    loadCustom(lv, fromEditor) {
      this.customLevel = lv; this.level = -1; this.fromEditor = !!fromEditor;
      this.name = lv.name || t('play.custom'); this.hint = t('play.testing');
      this.setWorld(HD.buildWorld(lv));
    },
    setWorld(world) {
      this.world = world; this.restart(true);
      if (HD.app.modeId === 'play') { this.build(HD.app); HD.app.setHint(this.hint); this.hintT = 0; }
    },
    restart(fresh) {
      const w = this.world;
      w.boxes.forEach((b) => { b.min = b.base.min.slice(); b.max = b.base.max.slice(); b.delta = [0, 0, 0, 0]; });
      this.pl = HD.physics.newPlayer(w.start);
      this.simT = 0; this.acc = 0; this.time = 0; this.state = 'run'; this.stateT = 0; this.parts = [];
      if (fresh) this.deaths = 0;
      this.started = false;
      HD.app.closeModal && HD.app.closeModal();
      const cam = HD.app && HD.app.cam; if (cam) { cam.target = [w.start[0], w.start[1] + 0.6, w.start[2]]; }
    },

    /* ---- ciclo di vita ---- */
    enter(app) {
      if (!this.world) this.loadLevel(0);
      app.cam.dist = 11.5; app.cam.yaw = 0.3; app.cam.pitch = 0.5; app.cam.maxDist = 34;
      app.cam.target = [this.pl.pos[0], this.pl.pos[1] + 0.6, this.pl.pos[2]];
      this.build(app);
      $g().style.display = 'block';
      if (app.touch) document.getElementById('touch').hidden = false;
      app.setHint(this.hint); this.hintT = 0;
    },
    exit(app) { $g().style.display = 'none'; document.getElementById('touch').hidden = true; },
    escape(app) {
      if (this.fromEditor) { app.start('editor'); return true; }
      return false;
    },

    build(app) {
      const p = app.panel; p.innerHTML = ''; p.className = 'play';
      if (this.fromEditor) {
        p.appendChild(U.btns([U.btn('← ' + t('play.back'), () => app.start('editor'), 'pri'), U.btn(t('play.restart'), () => this.restart(true))]));
        p.appendChild(U.info(t('play.controls')));
        p.appendChild(U.info('<br>' + t('play.wnote')));
        return;
      }
      p.appendChild(U.h3(t('play.levels')));
      HD.levels.forEach((lv, i) => {
        const done = this.done[lv.id];
        const b = U.el('button', { class: 'lvl' + (i === this.level ? ' on' : '') + (done ? ' done' : ''), onclick: () => { this.loadLevel(i); this.build(app); app.setHint(this.hint); } }, [
          U.el('span', { class: 'n', text: done ? '✓' : String(i + 1) }), U.el('span', { class: 't', text: t('lv.' + lv.id + '.name') }),
          U.el('span', { class: 's', text: done ? done.toFixed(1) + 's' : '' }),
        ]);
        p.appendChild(b);
      });
      p.appendChild(U.h3(' '));
      p.appendChild(U.toggle(t('play.ghosts'), this.ghosts, (v) => { this.ghosts = v; }));
      p.appendChild(U.btns([U.btn(t('play.restart') + ' (R)', () => this.restart(true))]));
      p.appendChild(U.info('<br>' + t('play.controls')));
      p.appendChild(U.info('<br>' + t('play.wnote')));
    },

    bg() { return { floor: false, fog: 0.018, top: [0.018, 0.014, 0.06], bot: [0.004, 0.004, 0.016], glow: 1.4 }; },

    key(e, app) {
      const k = e.key.toLowerCase();
      if (k === 'r') this.restart(false);
      if (k === 'n' && this.state === 'won') this.next();
    },

    next() {
      if (this.level >= 0 && this.level < HD.levels.length - 1) { this.loadLevel(this.level + 1); HD.app.closeModal(); }
      else HD.app.start('lab');
    },

    /* ---- simulazione ---- */
    readInput(app) {
      const K = app.keys, V = app.virtual;
      let f = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0) + V.z;
      let rt = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0) + V.x;
      const yaw = app.cam.yaw;
      let mx = -sin(yaw) * f + cos(yaw) * rt, mz = -cos(yaw) * f - sin(yaw) * rt;
      const l = sqrt(mx * mx + mz * mz); if (l > 1) { mx /= l; mz /= l; }
      const mw = ((K.e || K[']'] || V.wp) ? 1 : 0) - ((K.q || K['['] || V.wm) ? 1 : 0);
      return { mx, mz, mw, jump: !!(K[' '] || K.Space || K.space || V.jump) };
    },

    update(dt, app) {
      const pl = this.pl, world = this.world;
      this.stateT += dt;
      if (this.state === 'run') {
        const inp = this.readInput(app);
        if (!this.started && (inp.mx || inp.mz || inp.mw || inp.jump)) this.started = true;
        if (this.started) this.time += dt;
        if (inp.mw && this.hintT < 99) this.hintT = 99;
        this.acc += dt;
        const h = 1 / 120;
        let guard = 0;
        while (this.acc >= h && guard++ < 12) {
          this.acc -= h; this.simT += h;
          HD.physics.updateBoxes(world.boxes, this.simT);
          const wasGround = pl.onGround;
          HD.physics.stepPlayer(pl, inp, world, h);
          if (!wasGround && pl.onGround) this.burst(pl.pos, 6, [0.5, 0.9, 1], 1.5);
          if (pl.dead || pl.won) break;
        }
        if (pl.dead) { this.state = 'dead'; this.stateT = 0; this.burst(pl.pos, 70, [1, 0.25, 0.3], 5); }
        else if (pl.won) {
          this.state = 'won'; this.stateT = 0; this.burst(pl.pos, 140, [0.3, 1, 0.65], 6);
          this.onWin(app);
        }
      } else if (this.state === 'dead' && this.stateT > 0.8) { this.deaths++; const d = this.deaths; this.restart(false); this.deaths = d; }
      // particelle
      for (const p of this.parts) { p.life -= dt; p.v[1] -= 6 * dt; for (let i = 0; i < 3; i++) p.p[i] += p.v[i] * dt; }
      this.parts = this.parts.filter((p) => p.life > 0);

      // camera che segue
      const c = app.cam, tg = c.target, k = 1 - Math.exp(-dt * 7);
      const target = pl.dead ? tg : [pl.pos[0], pl.pos[1] + 0.6, pl.pos[2]];
      for (let i = 0; i < 3; i++) tg[i] += (target[i] - tg[i]) * k;
      this.hintT += dt;
      if (this.hintT > 22 && this.hintT < 98) { app.setHint(''); this.hintT = 100; }

      const mm = Math.floor(this.time / 60), ss = (this.time % 60).toFixed(1).padStart(4, '0');
      app.hudTop(`<div class="big">${this.name}</div><span class="mono">w ${pl.pos[3] >= 0 ? '+' : ''}${pl.pos[3].toFixed(2)}</span> · ${mm}:${ss} · ${t('play.deaths')} ${this.deaths}`);
      this.drawGauge(app);
    },

    burst(p, n, col, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed * (0.3 + Math.random());
        this.parts.push({ p: [p[0], p[1], p[2]], v: [sin(b) * cos(a) * s, sin(b) * sin(a) * s + 1.5, cos(b) * s], life: 0.6 + Math.random() * 0.9, max: 1.5, c: col });
      }
    },

    onWin(app) {
      const lv = this.level >= 0 ? HD.levels[this.level] : null;
      if (lv) {
        const prev = this.done[lv.id];
        if (!prev || this.time < prev) { this.done[lv.id] = this.time; U.store.set('done', this.done); }
      }
      const last = this.level === HD.levels.length - 1;
      setTimeout(() => {
        if (HD.app.modeId !== 'play' || this.state !== 'won') return;
        const btns = this.fromEditor
          ? `<button class="btn" id="wRetry">${t('play.retry')}</button><button class="btn pri" id="wBack">← ${t('play.back')}</button>`
          : `<button class="btn" id="wRetry">${t('play.retry')}</button>` + (last || this.level < 0 ? `<button class="btn pri" id="wMenu">${t('play.menu')}</button>` : `<button class="btn pri" id="wNext">${t('play.next')} →</button>`);
        const m = HD.app.showModal(`<div class="dlg win"><h2>${t('play.complete')}</h2><div class="lead">${this.name}</div><div class="stats"><div><b>${this.time.toFixed(1)}s</b>${t('play.time')}</div><div><b>${this.deaths}</b>${t('play.deaths')}</div></div><div class="btns">${btns}</div></div>`);
        const g = (id) => m.querySelector(id);
        g('#wRetry') && (g('#wRetry').onclick = () => this.restart(true));
        g('#wNext') && (g('#wNext').onclick = () => this.next());
        g('#wMenu') && (g('#wMenu').onclick = () => { HD.app.closeModal(); HD.app.start('lab', true); });
        g('#wBack') && (g('#wBack').onclick = () => HD.app.start('editor'));
        if (HD.app.modeId === 'play' && !this.fromEditor) this.build(HD.app);
      }, 900);
    },

    /* ---- rendering ---- */
    render(r, app) {
      const pl = this.pl, w = pl.pos[3];
      HD.renderWorld(r, this.world, w, { time: app.time, ghosts: this.ghosts });

      // beacon sull'obiettivo
      for (const b of this.world.boxes) if (b.type === 'g') {
        const inside = w >= b.min[3] && w <= b.max[3];
        const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2, top = b.max[1];
        const a = inside ? 0.9 : 0.25;
        r.line([cx, top, cz], [cx, top + 7, cz], [0.3, 1, 0.65, a], [0.3, 1, 0.65, 0], r.lw(5));
        for (let k = 0; k < 6; k++) {
          const ph = (app.time * 0.5 + k / 6) % 1;
          r.point([cx + sin(k * 2.1 + app.time) * 0.5, top + ph * 5, cz + cos(k * 2.1 + app.time) * 0.5], [0.4, 1, 0.7, a * (1 - ph)], 7);
        }
      }

      if (this.state !== 'dead') {
        // ombra/marcatore a terra
        const gy = groundBelow(this.world, pl.pos, pl.r);
        if (gy !== null) {
          const h = max(0, pl.pos[1] - pl.r - gy), a = max(0, 1 - h / 6) * 0.9, rad = 0.55 + h * 0.05;
          const col = [0.3, 0.9, 1, a];
          let prev = null;
          for (let i = 0; i <= 28; i++) {
            const ang = (i / 28) * PI * 2, q = [pl.pos[0] + cos(ang) * rad, gy + 0.025, pl.pos[2] + sin(ang) * rad];
            if (prev) r.line(prev, q, col, col, r.lw(2)); prev = q;
          }
        }
        // giocatore: il motivo sulla superficie cambia con w
        const rot = HD.M4.fromAngles([0, 0, 0, w * 0.55 + app.time * 0.2, 0, 0]);
        r.sphere([pl.pos[0], pl.pos[1], pl.pos[2]], pl.r, 0, 0.52 + 0.06 * w, rot);
        r.point([pl.pos[0], pl.pos[1], pl.pos[2]], [0.3, 0.8, 1, 0.9], 20);
        // anello W: rosa se w>0, ambra se w<0
        const wc = w >= 0 ? UP_COL : DN_COL, wa = min(1, abs(w) / 1.2) * 0.9 + 0.1;
        let prev = null;
        for (let i = 0; i <= 32; i++) {
          const ang = (i / 32) * PI * 2 + app.time * 0.8, q = [pl.pos[0] + cos(ang) * 0.68, pl.pos[1] + 0.02 * sin(ang * 3), pl.pos[2] + sin(ang) * 0.68];
          if (prev) r.line(prev, q, [wc[0], wc[1], wc[2], wa], [wc[0], wc[1], wc[2], wa], r.lw(2)); prev = q;
        }
      }
      for (const p of this.parts) { const a = max(0, p.life / p.max); r.point(p.p, [p.c[0], p.c[1], p.c[2], a], 7 * a + 2); }
    },

    /* ---- radar di W ---- */
    drawGauge(app) {
      const cv = $g(), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, pl = this.pl, wl = this.world.wLimit + 0.5;
      ctx.clearRect(0, 0, W, H);
      const y = (w) => H * 0.5 - (w / wl) * (H * 0.43);
      ctx.fillStyle = 'rgba(160,190,255,.5)'; ctx.font = '600 20px ui-monospace,monospace'; ctx.textAlign = 'center';
      ctx.fillText('+W', W / 2, 26); ctx.fillText('−W', W / 2, H - 12);
      ctx.strokeStyle = 'rgba(140,170,230,.25)'; ctx.lineWidth = 2;
      for (let k = -4; k <= 4; k++) { const yy = y(k); ctx.beginPath(); ctx.moveTo(W * 0.1, yy); ctx.lineTo(W * (k % 2 ? 0.2 : 0.3), yy); ctx.stroke(); }
      // intervalli solidi vicini
      const near = this.world.boxes.filter((b) =>
        pl.pos[0] > b.min[0] - 1.8 && pl.pos[0] < b.max[0] + 1.8 && pl.pos[2] > b.min[2] - 1.8 && pl.pos[2] < b.max[2] + 1.8 &&
        pl.pos[1] > b.min[1] - 1.6 && pl.pos[1] < b.max[1] + 1.6);
      const cols = { s: '0,200,255', h: '255,70,80', g: '60,255,160', i: '170,240,255' };
      near.forEach((b) => {
        const y0 = y(min(b.max[3], wl)), y1 = y(max(b.min[3], -wl));
        ctx.fillStyle = `rgba(${cols[b.type]},.38)`; ctx.fillRect(W * 0.38, y0, W * 0.3, y1 - y0);
        ctx.strokeStyle = `rgba(${cols[b.type]},.95)`; ctx.lineWidth = 2; ctx.strokeRect(W * 0.38, y0, W * 0.3, y1 - y0);
      });
      // marcatore del giocatore
      const py = y(pl.pos[3]);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(W * 0.3, py); ctx.lineTo(W * 0.78, py); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W * 0.1, py - 9); ctx.lineTo(W * 0.28, py); ctx.lineTo(W * 0.1, py + 9); ctx.fill();
      ctx.shadowBlur = 0;
    },
  });

  function $g() { return document.getElementById('gauge'); }
})(window);
