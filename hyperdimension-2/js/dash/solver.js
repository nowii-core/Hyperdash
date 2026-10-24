/* ============================================================================
 * HyperDimension — dash/solver.js
 * Solver a beam search: gioca il livello decidendo "premuto / rilasciato" ogni
 * DI passi di simulazione (di default 4 = 1/30 s). Se esiste una soluzione
 * anche con questa granularità, il livello è risolvibile da un essere umano.
 * Usato dal generatore (per validare ogni blocco) e dai test.
 * ========================================================================== */
(function (root) {
  'use strict';
  const D = (root.HD = root.HD || {}).dash = (root.HD || {}).dash || {};

  function key(S) {
    const a = Math.round((S.py + 2) * 8), b = Math.round(S.vy * 1.5) + 80;
    const f = (S.mode & 3) | (S.gf << 2) | (S.mini << 3) | (S.layer << 4) | (S.sp << 5) | ((S.ground ? 1 : 0) << 7) | ((S.prev ? 1 : 0) << 8);
    let k = ((a * 256 + b) * 512 + f) * 8 + (S.coins & 7);
    if (S.act.length) k = k * 1009 + (S.act[0] % 1007) + 1;
    return k;
  }

  /**
   * Beam search da `roots` (array di stati) fino a px >= xEnd.
   * opts: { di, K, keepPaths, wantCoin:{x,y} }
   * Ritorna { ok, finals:[nodi], minWidth, nodesByTick }.
   */
  D.solve = function (L, roots, xEnd, opts) {
    opts = opts || {};
    const DI = opts.di || 4, K = opts.K || 64;
    let frontier = roots.map((S) => ({ S: D.clone(S), parent: null, held: false }));
    let minWidth = Infinity, tick = 0, guard = 0;
    const limit = 120 * 200 / DI;
    while (guard++ < limit) {
      const done = frontier.filter((n) => n.S.won || n.S.px >= xEnd);
      if (done.length) return { ok: true, finals: done, minWidth: minWidth === Infinity ? K : minWidth, ticks: tick };
      const seen = new Set(), next = [];
      for (const n of frontier) {
        for (let h = 0; h < 2; h++) {
          const held = h === 0 ? n.S.prev : !n.S.prev;      // prima "continua", poi "cambia"
          const S = D.clone(n.S);
          for (let k = 0; k < DI && !S.dead && !S.won; k++) D.step(S, L, held, null);
          if (S.dead) continue;
          const kk = key(S);
          if (seen.has(kk)) continue;
          seen.add(kk);
          next.push({ S, parent: n, held });
        }
      }
      if (!next.length) return { ok: false, finals: [], minWidth: 0, ticks: tick, failX: frontier.length ? frontier[0].S.px : 0 };
      tick++;
      // larghezza = numero di stati distinti vivi (misura di tolleranza); si ignora il tratto iniziale
      if (next.length < minWidth) minWidth = next.length;
      if (next.length > K) {
        next.sort((a, b) => a.S.py - b.S.py || a.S.vy - b.S.vy);
        const out = [], step = next.length / K;
        for (let i = 0; i < K; i++) out.push(next[Math.floor(i * step)]);
        frontier = out;
      } else frontier = next;
    }
    return { ok: false, finals: [], minWidth: 0, ticks: tick };
  };

  /** Ricostruisce l'elenco di input (uno per tick di DI passi) e i punti della traiettoria. */
  D.pathOf = function (node) {
    const inputs = [], pts = [];
    for (let n = node; n; n = n.parent) { if (n.parent) inputs.push(n.held); pts.push({ held: n.held, x: n.S.px, y: n.S.py, ground: n.S.ground, mode: n.S.mode, coins: n.S.coins }); }
    inputs.reverse(); pts.reverse();
    return { inputs, pts };
  };

  /** Risolve un livello intero dall'inizio. */
  D.solveLevel = function (L, opts) {
    D.prepare(L);
    const S = D.newState(L);
    const r = D.solve(L, [S], L.len, opts);
    if (r.ok) { const p = D.pathOf(r.finals[0]); r.inputs = p.inputs; r.pts = p.pts; }
    return r;
  };

  /** Riproduce una lista di input (ogni elemento vale DI passi). */
  D.replay = function (L, inputs, DI) {
    DI = DI || 4; D.prepare(L);
    const S = D.newState(L);
    for (let i = 0; i < inputs.length && !S.dead && !S.won; i++) for (let k = 0; k < DI && !S.dead && !S.won; k++) D.step(S, L, inputs[i], null);
    return S;
  };
})(typeof window !== 'undefined' ? window : globalThis);
