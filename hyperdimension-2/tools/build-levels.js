// Valida i 200 livelli con il solver e scrive js/dash/leveldata.js
// uso: node tools/build-levels.js [da] [a]   (solo per sviluppo; il gioco non ne ha bisogno)
const path = require('path'), fs = require('fs');
global.HD = {};
['engine', 'solver', 'generator'].forEach((f) => require(path.join('..', 'js', 'dash', f + '.js')));
const D = HD.dash;
const from = +process.argv[2] || 0, to = process.argv[3] !== undefined ? +process.argv[3] : D.NUM_LEVELS - 1;
const MINW = (d) => 2;

function buildValidated(i, stats) {
  let roots = null;
  const chain = [];            // per blocco: {finals:[{pts, root}], x0, x1}
  const lvl = D.buildLevel(i, null, (cx, a) => {
    const L = { objs: cx.objs.concat(cx.chunk.objs), len: cx.chunk.end + 60, speed: cx.p.base, ceil: 10, world: cx.p.world };
    D.prepare(L);
    const rs = roots || [D.newState(L)];
    const r = D.solve(L, rs, cx.chunk.end, { di: 4, K: 48 });
    stats.tries++;
    if (!r.ok || r.minWidth < MINW(cx.p.d)) { stats.fail[cx.chunk.pat] = (stats.fail[cx.chunk.pat] || 0) + 1; return false; }
    const fin = r.finals.map((n) => {
      let rt = n; while (rt.parent) rt = rt.parent;
      let ri = rs.findIndex((q) => Math.abs(q.py - rt.S.py) < 1e-9 && Math.abs(q.vy - rt.S.vy) < 1e-9 && q.layer === rt.S.layer && q.mode === rt.S.mode);
      return { pts: D.pathOf(n).pts, root: ri < 0 ? 0 : ri };
    });
    chain[cx.c] = { fin, x0: cx.objs.length ? 0 : 0, end: cx.chunk.end };
    stats.ok[cx.chunk.pat] = (stats.ok[cx.chunk.pat] || 0) + 1;
    roots = r.finals.map((n) => n.S);
    chain[cx.c].roots = roots;
    return true;
  }, 60);
  // percorso completo: all'indietro lungo la catena
  let k = 0, path = [];
  for (let c = lvl.attempts.length - 1; c >= 0; c--) { const f = chain[c].fin[k]; path = (c > 0 ? f.pts.slice(1) : f.pts).concat(path); k = f.root; }
  if (process.env.DBG) console.log(chain.map((c) => c.fin.length + ":" + c.fin[0].pts.length + "@" + c.fin[0].pts[c.fin[0].pts.length-1].x.toFixed(0)).join(" "));
  lvl.path = path;
  return lvl;
}
function placeCoins(lvl) {
  const out = [], len = lvl.len, pts = lvl.path;
  [0.28, 0.58, 0.86].forEach((f) => {
    const x0 = len * f - 14, x1 = len * f + 14;
    let best = null;
    for (const q of pts) if (q.x > x0 && q.x < x1 && q.x > 16 && (!best || q.y > best.y + 0.001)) best = q;
    if (!best) best = pts.find((q) => q.x > len * f) || pts[pts.length - 1];
    out.push([+best.x.toFixed(2), +best.y.toFixed(2)]);
  });
  return out;
}
module.exports = { buildValidated };
if (require.main === module) {
  const data = {}, stats = { tries: 0, ok: {}, fail: {} };
  const t0 = Date.now();
  for (let i = from; i <= to; i++) {
    const lv = buildValidated(i, stats);
    const ins = lv.path.slice(1).map((q) => (q.held ? 1 : 0)), rl = [];
    let cur = 0, n = 0; for (const b of ins) { if (b === cur) n++; else { rl.push(n); cur = b; n = 1; } } rl.push(n);
    data[i] = { a: lv.attempts, c: placeCoins(lv), s: rl };
    process.stdout.write(`L${i} ${lv.attempts.join(',')} (${((Date.now() - t0) / 1000) | 0}s)\n`);
  }
  console.log(JSON.stringify(stats));
  if (from === 0 && to === D.NUM_LEVELS - 1) {
    fs.writeFileSync(path.join(__dirname, '..', 'js', 'dash', 'leveldata.js'),
      '/* generato da tools/build-levels.js — tabella dei blocchi validati dal solver, monete e soluzione di riferimento (run-length degli input a 30 Hz) */\n(function(r){\'use strict\';(r.HD=r.HD||{}).dash=r.HD.dash||{};r.HD.dash.LEVELDATA=' + JSON.stringify(data) + ';})(typeof window!==\'undefined\'?window:globalThis);\n');
  }
}
