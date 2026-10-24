/* ============================================================================
 * HyperDimension — dash/engine.js
 * Motore di gioco "dash" deterministico: cubo, nave, palla, wave; spuntoni,
 * seghe, blocchi, pad, orb, portali (modalità, gravità, taglia, velocità,
 * DIMENSIONE 4D) e monete. Nessun accesso al DOM: gira in Node per i test e per
 * il solver che verifica ogni livello.
 *
 * Unità: 1 blocco = 1. x → destra, y → su. Il suolo è y = 0, il soffitto y = C.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = (root.HD = root.HD || {});
  const D = (HD.dash = HD.dash || {});

  const C = (D.C = {
    DT: 1 / 120, BASE: 10.4, SPEEDS: [0.81, 1, 1.24, 1.6],
    G: 67, GBALL: 78, JUMP: 16.8, VMAX: 26,
    SHIP_UP: 40, SHIP_DOWN: 34, SHIP_VMAX: 9.6,
    PAD: [23, 14.5, 17, 31], ORB: [16.8, 11.5, 15, 16.8],
    CEIL: 10, FORGIVE: 0.12,
  });
  const E = 1e-7;
  D.MODES = ['cube', 'ship', 'ball', 'wave'];

  /* ------------------------------------------------------------ prepara -- */
  /** Costruisce gli indici spaziali (per colonna) di un livello. */
  D.prepare = function (L) {
    const n = Math.ceil(L.len) + 40;
    L.solidCols = new Array(n); L.hazCols = new Array(n); L.itemCols = new Array(n);
    L.ceil = L.ceil || C.CEIL;
    L.objs.forEach((o, i) => {
      o.id = i;
      if (o.lay === undefined) o.lay = 2;
      let x0, x1, cols;
      switch (o.k) {
        case 'b': x0 = o.x; x1 = o.x + o.w; cols = L.solidCols; break;
        case 's': x0 = o.x; x1 = o.x + 1; cols = L.hazCols; break;
        case 'w': x0 = o.x - o.r; x1 = o.x + o.r; cols = L.hazCols; break;
        default: x0 = o.x - 1; x1 = o.x + 1; cols = L.itemCols;
      }
      for (let c = Math.max(0, Math.floor(x0 - 0.001)); c <= Math.min(n - 1, Math.floor(x1 - 0.0001)); c++) (cols[c] || (cols[c] = [])).push(o);
    });
    return L;
  };

  D.newState = function (L) {
    return { px: 0, py: 0.5, vy: 0, gf: 0, mode: 0, mini: 0, sp: L.speed === undefined ? 1 : L.speed, layer: 0, ground: true,
      prev: false, dead: false, won: false, coins: 0, act: [], t: 0, hs: 0.5, cause: '' };
  };
  D.clone = function (S, out) {
    out = out || {};
    out.px = S.px; out.py = S.py; out.vy = S.vy; out.gf = S.gf; out.mode = S.mode; out.mini = S.mini; out.sp = S.sp; out.layer = S.layer;
    out.ground = S.ground; out.prev = S.prev; out.dead = S.dead; out.won = S.won; out.coins = S.coins; out.t = S.t; out.hs = S.hs; out.cause = S.cause;
    out.act = S.act.length ? S.act.slice() : [];
    return out;
  };

  /* ------------------------------------------------------------ helpers -- */
  function circleRect(cx, cy, r, x0, y0, x1, y1) {
    const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0, dy = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0;
    return dx * dx + dy * dy < r * r;
  }
  function hasAct(S, id) { const a = S.act; for (let i = 0; i < a.length; i++) if (a[i] === id) return true; return false; }
  function ovItem(o, px, py, hs) {
    switch (o.k) {
      case 'p': { const y0 = o.d ? o.y + 0.7 : o.y, y1 = o.d ? o.y + 1 : o.y + 0.3; return px + hs > o.x + 0.05 && px - hs < o.x + 0.95 && py + hs > y0 && py - hs < y1; }
      case 'o': return circleRect(o.x, o.y, 0.78, px - hs, py - hs, px + hs, py + hs);
      case 'P': return px + hs > o.x - 0.22 && px - hs < o.x + 0.22 && py + hs > o.y - 1.5 && py - hs < o.y + 1.5;
      case 'c': return circleRect(o.x, o.y, 0.6, px - hs, py - hs, px + hs, py + hs);
    }
    return false;
  }
  function hazHit(o, px, py, hs) {
    if (o.k === 's') {
      const w = 0.42, h = o.sm ? 0.28 : 0.52, cx = o.x + 0.5;
      const y0 = o.d ? o.y + 1 - h : o.y, y1 = o.d ? o.y + 1 : o.y + h;
      return px + hs > cx - w / 2 + E && px - hs < cx + w / 2 - E && py + hs > y0 + E && py - hs < y1 - E;
    }
    const k = hs * 0.9; return circleRect(o.x, o.y, o.r * 0.82, px - k, py - k, px + k, py + k);
  }
  const lay = (o, S) => o.lay === 2 || o.lay === S.layer;

  /* --------------------------------------------------------------- orb -- */
  function activateOrb(S, o, ev) {
    const dir = S.gf ? -1 : 1;
    if (o.t === 4) { S.layer ^= 1; S.act.push(o.id); if (ev) ev.push('dim'); return; }   // orb dimensionale 4D
    if (o.t === 0) S.vy = C.ORB[0] * dir;
    else if (o.t === 1) S.vy = C.ORB[1] * dir;
    else if (o.t === 2) { S.gf ^= 1; S.vy = -C.ORB[2] * dir * 0.55; }
    else { S.gf ^= 1; S.vy = C.ORB[3] * -dir; }
    S.ground = false; S.act.push(o.id);
    if (ev) ev.push('orb');
  }

  /* -------------------------------------------------------------- step -- */
  D.step = function (S, L, held, ev) {
    if (S.dead || S.won) return;
    const dt = C.DT, press = held && !S.prev; S.prev = held; S.t++;
    const dir0 = S.gf ? -1 : 1, spd = C.BASE * C.SPEEDS[S.sp];
    const hs = S.mode === 3 ? (S.mini ? 0.14 : 0.22) : (S.mini ? 0.3 : 0.5); S.hs = hs;
    const colMin = Math.max(0, Math.floor(S.px - hs - 0.2)), colMax = Math.floor(S.px + hs + 0.9);
    let used = false;

    // --- orb: la pressione viene consumata se si è dentro un orb
    if (press && S.mode !== 3) {
      for (let c = colMin; c <= colMax && !used; c++) {
        const lst = L.itemCols[c]; if (!lst) continue;
        for (let i = 0; i < lst.length; i++) {
          const o = lst[i];
          if (o.k === 'o' && lay(o, S) && !hasAct(S, o.id) && ovItem(o, S.px, S.py, hs)) { activateOrb(S, o, ev); used = true; break; }
        }
      }
    }

    // --- logica della modalità
    let dir = S.gf ? -1 : 1, vy = S.vy;
    if (S.mode === 0) {
      if (held && S.ground && !used) { vy = C.JUMP * dir; S.ground = false; if (ev) ev.push('jump'); }
      vy -= C.G * dir * dt;
    } else if (S.mode === 1) {
      vy += (held ? C.SHIP_UP : -C.SHIP_DOWN) * dir * dt;
      if (vy > C.SHIP_VMAX) vy = C.SHIP_VMAX; else if (vy < -C.SHIP_VMAX) vy = -C.SHIP_VMAX;
    } else if (S.mode === 2) {
      if (press && S.ground && !used) { S.gf ^= 1; dir = -dir; vy = 0; S.ground = false; if (ev) ev.push('flip'); }
      vy -= C.GBALL * dir * dt;
    } else {
      vy = (held ? 1 : -1) * dir * spd * (S.mini ? 1.6 : 1);
    }
    if (S.mode !== 1 && S.mode !== 3) { if (vy > C.VMAX) vy = C.VMAX; else if (vy < -C.VMAX) vy = -C.VMAX; }

    // --- movimento verticale con risoluzione degli appoggi
    const px = S.px, y0 = S.py; let ny = y0 + vy * dt, landed = false;
    if (S.mode !== 3) {
      for (let c = colMin; c <= colMax; c++) {
        const lst = L.solidCols[c]; if (!lst) continue;
        for (let i = 0; i < lst.length; i++) {
          const b = lst[i];
          if (!lay(b, S)) continue;
          if (!(px + hs > b.x + E && px - hs < b.x + b.w - E)) continue;
          const by0 = b.y, by1 = b.y + b.h;
          if (ny - hs < by1 - E && ny + hs > by0 + E) {
            if (vy <= 0 && y0 - hs >= by1 - 1e-6) { ny = by1 + hs; vy = 0; if (dir === 1) landed = true; }
            else if (vy >= 0 && y0 + hs <= by0 + 1e-6) { ny = by0 - hs; vy = 0; if (dir === -1) landed = true; }
          }
        }
      }
    }
    if (ny - hs < 0) { ny = hs; if (vy < 0) vy = 0; if (dir === 1) landed = true; }
    if (ny + hs > L.ceil) { ny = L.ceil - hs; if (vy > 0) vy = 0; if (dir === -1) landed = true; }
    if (landed && !S.ground && ev) ev.push('land');
    S.ground = landed;

    // --- movimento orizzontale: toccare un blocco di lato = schianto
    const nx = px + spd * dt;
    for (let c = Math.max(0, Math.floor(nx - hs - 0.1)); c <= Math.floor(nx + hs + 0.1); c++) {
      const lst = L.solidCols[c]; if (!lst) continue;
      for (let i = 0; i < lst.length; i++) {
        const b = lst[i];
        if (!lay(b, S)) continue;
        if (nx + hs > b.x + E && nx - hs < b.x + b.w - E && ny + hs > b.y + E && ny - hs < b.y + b.h - E) {
          const lip = dir === 1 ? (b.y + b.h) - (ny - hs) : (ny + hs) - b.y;   // quanto è affondato
          if (S.mode !== 3 && lip <= C.FORGIVE && lip > 0 && ((dir === 1 && vy <= 0) || (dir === -1 && vy >= 0))) {
            ny = dir === 1 ? b.y + b.h + hs : b.y - hs; S.ground = true; vy = 0;
          } else { S.dead = true; S.cause = 'wall'; }
        }
      }
    }
    S.px = nx; S.py = ny; S.vy = vy;
    if (S.dead) { if (ev) ev.push('death'); return; }

    // --- pericoli
    const cm = Math.max(0, Math.floor(nx - hs - 1.2)), cM = Math.floor(nx + hs + 1.2);
    for (let c = cm; c <= cM && !S.dead; c++) {
      const lst = L.hazCols[c]; if (!lst) continue;
      for (let i = 0; i < lst.length; i++) {
        const o = lst[i];
        if (lay(o, S) && hazHit(o, nx, ny, hs)) { S.dead = true; S.cause = o.k === 's' ? 'spike' : 'saw'; break; }
      }
    }
    if (S.dead) { if (ev) ev.push('death'); return; }

    // --- oggetti: pad, orb (pulizia), portali, monete
    const prevAct = S.act, newAct = [];
    for (let i = 0; i < prevAct.length; i++) { const o = L.objs[prevAct[i]]; if (o && ovItem(o, nx, ny, hs)) newAct.push(o.id); }
    S.act = newAct;
    for (let c = cm; c <= cM; c++) {
      const lst = L.itemCols[c]; if (!lst) continue;
      for (let i = 0; i < lst.length; i++) {
        const o = lst[i];
        if (o.k === 'o' || !lay(o, S) || !ovItem(o, S.px, S.py, hs)) continue;
        if (o.k === 'c') { if (!(S.coins & (1 << o.i))) { S.coins |= 1 << o.i; if (ev) ev.push('coin'); } continue; }
        if (hasAct(S, o.id)) continue;
        S.act.push(o.id);
        if (o.k === 'p') {
          const dd = o.d ? -1 : 1;
          if (o.t === 2) { S.gf ^= 1; S.vy = C.PAD[2] * (S.gf ? -1 : 1) * 0.8; }
          else S.vy = C.PAD[o.t] * dd * (S.gf ? 1 : 1);
          S.ground = false; if (ev) ev.push('pad');
        } else portal(S, o, ev);
      }
    }
    if (S.px >= L.len) { S.won = true; if (ev) ev.push('win'); }
  };

  function portal(S, o, ev) {
    const t = o.t;
    if (t === 'cube') S.mode = 0; else if (t === 'ship') S.mode = 1; else if (t === 'ball') S.mode = 2; else if (t === 'wave') S.mode = 3;
    else if (t === 'gn') S.gf = 0; else if (t === 'gf') S.gf = 1;
    else if (t === 'sn') S.mini = 0; else if (t === 'sm') S.mini = 1;
    else if (t === 's0') S.sp = 0; else if (t === 's1') S.sp = 1; else if (t === 's2') S.sp = 2; else if (t === 's3') S.sp = 3;
    else if (t === 'd0') S.layer = 0; else if (t === 'd1') S.layer = 1; else if (t === 'dx') S.layer ^= 1;
    if (S.mode === 3 || S.mode === 1) S.ground = false;
    if (ev) ev.push('portal');
  }

  /** Esegue una partita con una funzione di input (t → held). Utile nei test. */
  D.simulate = function (L, inputFn, maxSteps) {
    const S = D.newState(L); S.py = 0.5;
    for (let i = 0; i < (maxSteps || 120 * 400) && !S.dead && !S.won; i++) D.step(S, L, inputFn(i, S), null);
    return S;
  };
})(typeof window !== 'undefined' ? window : globalThis);
