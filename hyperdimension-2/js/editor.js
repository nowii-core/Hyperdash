/* ============================================================================
 * HyperDimension — editor.js
 * Editor di livelli 4D: si vede la sezione 3D a w = s, si spostano i blocchi in
 * x,y,z e nell'asse W, si prova subito il livello e lo si condivide con un link.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, U = HD.ui, el = U.el, t = (k) => HD.i18n.t(k);
  HD.modes = HD.modes || {};
  const { sin, cos, abs, max, min, sqrt, round, PI } = Math;
  const TYPES = ['s', 'h', 'g', 'i'];

  function defaultLevel() {
    return {
      id: 'custom', name: 'My level', wLimit: 4.5, start: [-4, 0.45, 0, 0],
      boxes: [['s', -6, -1, -4, -6, 6, 0, 4, 6], ['s', 0, 0, -4, -1, 1, 5, 4, 1], ['g', 4, 0, -1, -1, 5.5, 2, 1, 1]],
    };
  }

  const Ed = (HD.modes.editor = {
    id: 'editor', world: null, name: 'My level', sel: null, selStart: false, tool: 'select', addType: 's',
    sliceW: 0, snap: 0.5, dragging: null, ui: {}, init: false,

    load(lv) {
      this.world = HD.buildWorld(lv); this.name = lv.name || 'My level'; this.sel = null; this.selStart = false;
      this.sliceW = this.world.start[3];
    },
    level() { return HD.worldToLevel(this.world, this.name); },

    enter(app) {
      if (!this.world) this.load(U.store.get('editorLevel', null) || defaultLevel());
      app.cam.dist = 17; app.cam.pitch = 0.62; app.cam.yaw = 0.35; app.cam.target = [2, 0, 0]; app.cam.maxDist = 70;
      this.build(app);
      document.getElementById('gauge').style.display = 'none';
      app.setHint(t('ed.tip'));
    },
    exit() { U.store.set('editorLevel', this.level()); },
    escape() { if (this.sel || this.selStart) { this.sel = null; this.selStart = false; this.refreshSel(); return true; } return false; },

    /* ------------------------------ pannello ------------------------------ */
    build(app) {
      const p = app.panel; p.innerHTML = ''; p.className = 'editor';
      p.appendChild(U.h3(t('ed.tools')));
      p.appendChild(U.chips([['select', 'ed.select'], ['add', 'ed.add'], ['start', 'ed.start']].map(([id, k]) => ({ id, label: t(k) })), this.tool, (id) => { this.tool = id; }));
      p.appendChild(U.h3(t('ed.type')));
      p.appendChild(U.chips(TYPES.map((id) => ({ id, label: t('ed.' + id) })), this.addType, (id) => { this.addType = id; }));
      p.appendChild(U.h3(t('ed.slicew')));
      this.ui.w = U.slider('w', -4.5, 4.5, 0.01, this.sliceW, (v) => { this.sliceW = v; }, { w: true }); p.appendChild(this.ui.w);
      this.ui.snap = U.toggle(t('ed.snap'), this.snap > 0, (v) => { this.snap = v ? 0.5 : 0.05; }); p.appendChild(this.ui.snap);
      this.ui.sel = el('div'); p.appendChild(this.ui.sel); this.refreshSel();
      p.appendChild(U.h3('Level'));
      const nm = el('input', { type: 'text', value: this.name, class: 'json', style: 'width:100%;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:inherit' });
      nm.addEventListener('input', () => { this.name = nm.value.slice(0, 40); });
      p.appendChild(nm);
      p.appendChild(U.btns([U.btn(t('ed.test'), () => this.test(), 'pri'), U.btn(t('ed.save'), () => this.save()), U.btn(t('ed.new'), () => { this.load(defaultLevel()); this.build(app); }, 'warn')]));
      p.appendChild(U.btns([U.btn(t('ed.export'), () => this.exportJson()), U.btn(t('ed.share'), () => this.share())]));
      const ta = el('textarea', { class: 'json', placeholder: t('ed.paste') }); p.appendChild(ta);
      p.appendChild(U.btns([U.btn(t('ed.import'), () => this.importJson(ta.value, ta))]));
      p.appendChild(U.info('<br>' + t('ed.tip')));
    },

    refreshSel() {
      const box = this.ui.sel; if (!box) return; box.innerHTML = '';
      const b = this.sel;
      box.appendChild(U.h3(t('ed.sel')));
      if (this.selStart) { box.appendChild(U.info(`<b>${t('ed.start')}</b>: ${this.world.start.map((x) => x.toFixed(2)).join(', ')}`)); return; }
      if (!b) { box.appendChild(U.info(t('ed.none'))); return; }
      const num = (val, onSet) => {
        const i = el('input', { type: 'number', step: 0.5, value: (+val.toFixed(3)) });
        i.addEventListener('change', () => { const v = parseFloat(i.value); if (!isNaN(v)) onSet(v); });
        return i;
      };
      const c = [0, 1, 2, 3].map((k) => (b.base.min[k] + b.base.max[k]) / 2), s = [0, 1, 2, 3].map((k) => b.base.max[k] - b.base.min[k]);
      const set = (k, cv, sv) => { b.base.min[k] = cv - sv / 2; b.base.max[k] = cv + sv / 2; b.min = b.base.min.slice(); b.max = b.base.max.slice(); };
      const grid = el('div', { class: 'field' });
      const names = ['x', 'y', 'z', 'w'];
      grid.appendChild(el('span', { text: '' })); grid.appendChild(el('span', { text: t('ed.pos') })); grid.appendChild(el('span', { text: '' })); grid.appendChild(el('span', { text: t('ed.size') }));
      for (let k = 0; k < 4; k++) {
        grid.appendChild(el('span', { text: names[k], style: k === 3 ? 'color:var(--mg)' : '' }));
        grid.appendChild(num(c[k], (v) => { set(k, v, s[k]); this.refreshSel(); }));
        grid.appendChild(el('span', { text: 'Δ' + names[k], style: k === 3 ? 'color:var(--mg)' : '' }));
        grid.appendChild(num(s[k], (v) => { set(k, c[k], max(0.1, v)); this.refreshSel(); }));
      }
      box.appendChild(grid);
      const typeSel = el('select', {}, TYPES.map((id) => el('option', { value: id, text: t('ed.' + id), selected: b.type === id })));
      typeSel.addEventListener('change', () => { b.type = typeSel.value; });
      const mvSel = el('select', {}, [el('option', { value: '', text: t('ed.static') }), ...['x', 'y', 'z', 'w'].map((a, i) => el('option', { value: i, text: t('ed.move') + ' ' + a, selected: b.mv && b.mv.axis === i }))]);
      mvSel.addEventListener('change', () => {
        if (mvSel.value === '') b.mv = null; else b.mv = { axis: +mvSel.value, amp: (b.mv && b.mv.amp) || 2, speed: (b.mv && b.mv.speed) || 0.8, phase: 0 };
        this.refreshSel();
      });
      const f2 = el('div', { class: 'field w3', style: 'margin-top:8px' }, [el('span', { text: t('ed.type') }), typeSel, el('span', { text: t('ed.move') }), mvSel]);
      box.appendChild(f2);
      if (b.mv) {
        box.appendChild(el('div', { class: 'field w3', style: 'margin-top:6px' }, [
          el('span', { text: t('ed.amp') }), num(b.mv.amp, (v) => { b.mv.amp = max(0.1, v); }),
          el('span', { text: t('ed.speed') }), num(b.mv.speed, (v) => { b.mv.speed = max(0.05, v); }),
        ]));
      }
      box.appendChild(U.btns([
        U.btn(t('ed.dup'), () => this.duplicate()), U.btn(t('ed.allw'), () => { set(3, 0, 12); this.refreshSel(); }), U.btn(t('ed.del'), () => this.remove(), 'warn'),
      ]));
    },

    /* ------------------------------ operazioni ------------------------------ */
    snapv(v) { return this.snap > 0.06 ? round(v / this.snap) * this.snap : round(v * 20) / 20; },
    addBox(type, c, s) {
      const mn = [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2, c[3] - s[3] / 2], mx = [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2, c[3] + s[3] / 2];
      const b = HD.physics.box(mn, mx, type); this.world.boxes.push(b); this.sel = b; this.selStart = false; this.refreshSel(); return b;
    },
    duplicate() {
      const b = this.sel; if (!b) return;
      const n = HD.physics.box(b.base.min.map((v, i) => v + (i === 0 ? 1 : 0)), b.base.max.map((v, i) => v + (i === 0 ? 1 : 0)), b.type, b.mv ? { ...b.mv } : null);
      this.world.boxes.push(n); this.sel = n; this.refreshSel();
    },
    remove() {
      if (!this.sel) return;
      this.world.boxes.splice(this.world.boxes.indexOf(this.sel), 1); this.sel = null; this.refreshSel();
    },
    moveSel(d) {
      const b = this.sel; if (!b) return;
      for (let i = 0; i < 4; i++) { b.base.min[i] += d[i]; b.base.max[i] += d[i]; }
      b.min = b.base.min.slice(); b.max = b.base.max.slice(); this.refreshSel();
    },

    test() {
      const w = this.world;
      if (!w.boxes.some((b) => b.type === 'g')) { U.toast(HD.i18n.lang === 'it' ? 'Aggiungi un blocco Traguardo' : 'Add a Goal box first'); return; }
      U.store.set('editorLevel', this.level());
      HD.modes.play.loadCustom(this.level(), true); HD.app.start('play');
    },
    save() { U.store.set('editorLevel', this.level()); U.toast(t('ed.saved')); },
    json() { return JSON.stringify(this.level()); },
    exportJson() {
      const blob = new Blob([JSON.stringify(this.level(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (this.name || 'level').replace(/[^\w-]+/g, '_') + '.hyperdimension.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    importJson(text, ta) {
      try {
        const lv = JSON.parse(text);
        if (!lv || !Array.isArray(lv.boxes) || !Array.isArray(lv.start)) throw new Error('shape');
        lv.boxes = lv.boxes.filter((b) => Array.isArray(b) && b.length >= 9 && TYPES.includes(b[0]) && b.slice(1, 9).every((x) => typeof x === 'number' && isFinite(x))).slice(0, 300);
        if (!lv.start.every((x) => typeof x === 'number' && isFinite(x)) || lv.start.length !== 4) throw new Error('start');
        this.load(lv); this.build(HD.app); U.toast(t('ed.imported'));
      } catch (e) { U.toast(t('ed.badjson')); }
    },
    share() {
      const b64 = btoa(unescape(encodeURIComponent(this.json()))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const url = location.origin === 'null' || location.protocol === 'file:' ? location.href.split('#')[0].split('?')[0] + '#lv=' + b64 : location.origin + location.pathname + '#lv=' + b64;
      const done = () => U.toast(t('ed.copied') + (location.protocol === 'file:' ? ' (file://)' : ''));
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { prompt('Link', url); });
      else prompt('Link', url);
    },

    /* ------------------------------- input ------------------------------- */
    ray(e, app, canvas) {
      const rc = canvas.getBoundingClientRect();
      return app.cam.ray(((e.clientX - rc.left) / rc.width) * 2 - 1, -(((e.clientY - rc.top) / rc.height) * 2 - 1));
    },
    pick(ray, ghosts) {
      let best = null, bt = Infinity;
      for (const b of this.world.boxes) {
        const inside = this.sliceW >= b.min[3] && this.sliceW <= b.max[3];
        const dw = inside ? 0 : (this.sliceW < b.min[3] ? b.min[3] - this.sliceW : this.sliceW - b.max[3]);
        if (!inside && (!ghosts || dw > 3.6)) continue;
        const tt = HD.rayAABB(ray.o, ray.d, [b.min[0], b.min[1], b.min[2]], [b.max[0], b.max[1], b.max[2]]);
        const score = tt + (inside ? 0 : 1000);
        if (tt >= 0 && score < bt) { bt = score; best = { box: b, t: tt }; }
      }
      return best;
    },
    ground(ray, y) {
      if (abs(ray.d[1]) < 1e-6) return null;
      const tt = (y - ray.o[1]) / ray.d[1]; if (tt < 0) return null;
      return [ray.o[0] + ray.d[0] * tt, y, ray.o[2] + ray.d[2] * tt];
    },

    down(e, app, canvas) {
      if (this.tool !== 'select' || !this.sel || e.button !== 0) { this.dragging = null; return; }
      const ray = this.ray(e, app, canvas), hit = this.pick(ray, true);
      if (hit && hit.box === this.sel) {
        const b = this.sel, y = (b.base.min[1] + b.base.max[1]) / 2, g = this.ground(ray, y);
        if (g) this.dragging = { y, ox: g[0] - (b.base.min[0] + b.base.max[0]) / 2, oz: g[2] - (b.base.min[2] + b.base.max[2]) / 2 };
      } else this.dragging = null;
    },
    drag(dx, dy, e, app, d) {
      if (!this.dragging || !this.sel) return false;
      const canvas = document.getElementById('gl'), ray = this.ray(e, app, canvas), g = this.ground(ray, this.dragging.y);
      if (!g) return true;
      const b = this.sel, cx = (b.base.min[0] + b.base.max[0]) / 2, cz = (b.base.min[2] + b.base.max[2]) / 2;
      const nx = this.snapv(g[0] - this.dragging.ox), nz = this.snapv(g[2] - this.dragging.oz);
      if (nx !== cx || nz !== cz) this.moveSel([nx - cx, 0, nz - cz, 0]);
      return true;
    },
    up() { this.dragging = null; },

    click(e, app, canvas) {
      if (e.button !== 0) return;
      const ray = this.ray(e, app, canvas), hit = this.pick(ray, this.tool === 'select');
      if (this.tool === 'select') {
        this.sel = hit ? hit.box : null; this.selStart = false; this.refreshSel();
        // clic sul punto di partenza?
        if (!hit) {
          const s = this.world.start, dx = s[0] - ray.o[0], dy = s[1] - ray.o[1], dz = s[2] - ray.o[2];
          const tt = dx * ray.d[0] + dy * ray.d[1] + dz * ray.d[2];
          const px = ray.o[0] + ray.d[0] * tt - s[0], py = ray.o[1] + ray.d[1] * tt - s[1], pz = ray.o[2] + ray.d[2] * tt - s[2];
          if (tt > 0 && sqrt(px * px + py * py + pz * pz) < 0.7) { this.selStart = true; this.refreshSel(); }
        }
        return;
      }
      // punto di appoggio: faccia colpita o terreno y=0
      let p, y0 = 0;
      if (hit) {
        p = [ray.o[0] + ray.d[0] * hit.t, ray.o[1] + ray.d[1] * hit.t, ray.o[2] + ray.d[2] * hit.t];
        const b = hit.box; y0 = abs(p[1] - b.max[1]) < 0.02 ? b.max[1] : abs(p[1] - b.min[1]) < 0.02 ? b.min[1] : max(0, p[1]);
        if (abs(p[1] - b.min[1]) < 0.02) y0 = b.min[1];
      } else p = this.ground(ray, 0);
      if (!p) return;
      if (this.tool === 'start') {
        this.world.start = [this.snapv(p[0]), y0 + 0.45, this.snapv(p[2]), this.sliceW]; this.selStart = true; this.sel = null; this.refreshSel(); return;
      }
      const big = this.addType === 'g' ? [1.5, 2, 1.5] : this.addType === 'h' ? [2, 1, 2] : [2, 1, 2];
      const c = [this.snapv(p[0]), y0 + big[1] / 2, this.snapv(p[2]), this.snapv(this.sliceW)];
      this.addBox(this.addType, c, [big[0], big[1], big[2], 3]);
    },

    key(e, app) {
      if (!app.mode || app.mode !== this) return;
      const k = e.key, st = this.snap > 0.06 ? this.snap : 0.25;
      if (k === 'q' || k === 'Q') { this.sliceW = max(-4.5, this.sliceW - 0.25); this.ui.w.set(this.sliceW); }
      else if (k === 'e' || k === 'E') { this.sliceW = min(4.5, this.sliceW + 0.25); this.ui.w.set(this.sliceW); }
      else if (k === 'Delete' || k === 'Backspace') this.remove();
      else if (k === 'd' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.duplicate(); }
      else if (this.sel) {
        const m = { ArrowLeft: [-st, 0, 0, 0], ArrowRight: [st, 0, 0, 0], ArrowUp: [0, 0, -st, 0], ArrowDown: [0, 0, st, 0], PageUp: [0, st, 0, 0], PageDown: [0, -st, 0, 0], '[': [0, 0, 0, -st], ']': [0, 0, 0, st] }[k];
        if (m) { e.preventDefault(); this.moveSel(m); }
      }
    },

    bg() { return { floor: true, floorY: 0, fog: 0.004, top: [0.02, 0.02, 0.07], bot: [0.004, 0.005, 0.016], glow: 1.0 }; },
    update(dt, app) {
      app.hudTop(`<span class="mono">w = ${this.sliceW.toFixed(2)}</span> · ${this.world.boxes.length} blocks`);
      HD.physics.updateBoxes(this.world.boxes, 0);
    },
    render(r, app) {
      const w = this.sliceW;
      HD.renderWorld(r, this.world, w, { time: app.time, selected: this.sel, range: 4 });
      // frecce di corsa dei blocchi mobili
      for (const b of this.world.boxes) if (b.mv && b.mv.axis < 3) {
        const c = [0, 1, 2].map((k) => (b.base.min[k] + b.base.max[k]) / 2), a = b.mv.axis, p0 = c.slice(), p1 = c.slice();
        p0[a] -= b.mv.amp; p1[a] += b.mv.amp;
        r.line(p0, p1, [1, 1, 0.4, 0.8], [1, 1, 0.4, 0.8], r.lw(2)); r.point(p0, [1, 1, 0.4, 1], 8); r.point(p1, [1, 1, 0.4, 1], 8);
      }
      // punto di partenza
      const s = this.world.start, dw = w - s[3], on = abs(dw) < 0.4;
      const col = on ? [0.3, 0.9, 1] : dw > 0 ? [1, 0.7, 0.15] : [1, 0.25, 0.85];
      if (on) r.sphere([s[0], s[1], s[2]], sqrt(0.16 - dw * dw), dw, 0.52, HD.M4.identity());
      r.line([s[0], s[1], s[2]], [s[0], s[1] + 2.6, s[2]], [col[0], col[1], col[2], on ? 1 : 0.35], [col[0], col[1], col[2], 0], r.lw(3));
      r.point([s[0], s[1], s[2]], [col[0], col[1], col[2], on ? 1 : 0.45], 16);
      if (this.selStart) r.box([s[0] - 0.55, s[1] - 0.55, s[2] - 0.55], [s[0] + 0.55, s[1] + 0.55, s[2] + 0.55], null, [1, 1, 1, 1], r.lw(2.4));
      // limiti del mondo in W: indicatore se la sezione è fuori dall'area di gioco
      if (abs(w) > this.world.wLimit) { const c = [1, 0.3, 0.3, 0.9]; r.box([-8, 0, -8], [8, 0.02, 8], null, c, r.lw(2)); }
    },
  });
})(window);
