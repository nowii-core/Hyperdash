/* HyperDimension — test suite (Node, zero dipendenze): node tests/run.js */
'use strict';
require('../js/math4.js');
require('../js/polytopes.js');
require('../js/physics.js');
require('../js/levels.js');
const HD = globalThis.HD;
const { M4, V4 } = HD;

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31m✗ ' + name + '\x1b[0m ' + (extra || '')); }
}
const close = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
function section(t) { console.log('\n' + t); }

/* ------------------------------------------------------------------ math -- */
section('Matematica 4D');
{
  const R = M4.fromAngles([0.3, -0.7, 1.1, 0.9, -0.4, 0.25]);
  ok(close(M4.det(R), 1, 1e-9), 'rotazione composta ha determinante +1');
  const RtR = M4.mul(M4.transpose(R), R);
  let err = 0; for (let i = 0; i < 16; i++) err = Math.max(err, Math.abs(RtR[i] - (i % 5 === 0 ? 1 : 0)));
  ok(err < 1e-12, 'rotazione è ortogonale (RᵀR = I)', 'err=' + err);
  const v = [0.3, -1.2, 2.2, 0.7];
  ok(close(V4.len(M4.apply(R, v)), V4.len(v), 1e-12), 'le rotazioni conservano la lunghezza');
  // le rotazioni di piani disgiunti commutano (XY e ZW), quelle di piani adiacenti no
  const a = M4.mul(M4.plane(0, 1, 0.8), M4.plane(2, 3, 1.3)), b = M4.mul(M4.plane(2, 3, 1.3), M4.plane(0, 1, 0.8));
  let d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(a[i] - b[i]));
  ok(d < 1e-12, 'XY e ZW commutano (piani disgiunti)');
  const c = M4.mul(M4.plane(0, 1, 0.8), M4.plane(0, 3, 1.3)), e = M4.mul(M4.plane(0, 3, 1.3), M4.plane(0, 1, 0.8));
  d = 0; for (let i = 0; i < 16; i++) d = Math.max(d, Math.abs(c[i] - e[i]));
  ok(d > 0.05, 'XY e XW NON commutano (come in 3D)');
  // rotazione di 90° in XW porta l'asse X nell'asse W
  const q = M4.apply(M4.plane(0, 3, Math.PI / 2), [1, 0, 0, 0]);
  ok(close(q[3], 1, 1e-12) && close(q[0], 0, 1e-12), 'rotazione XW di 90° trasforma X in W');
  // Gram-Schmidt ripara la deriva
  let m = M4.identity();
  const step = M4.fromAngles([0.01, 0.02, 0.03, 0.04, 0.05, 0.06]);
  for (let i = 0; i < 20000; i++) m = M4.mul(step, m);
  const m2 = M4.orthonormalize(m), t2 = M4.mul(M4.transpose(m2), m2);
  err = 0; for (let i = 0; i < 16; i++) err = Math.max(err, Math.abs(t2[i] - (i % 5 === 0 ? 1 : 0)));
  ok(err < 1e-12, 'orthonormalize ripristina l\'ortogonalità dopo 20000 passi', 'err=' + err);
  // prodotto vettoriale 4D
  const n = HD.cross4([1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]);
  ok(Math.abs(Math.abs(n[3]) - 1) < 1e-12 && Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) < 1e-12, 'cross4(x,y,z) = ±w');
  const A = [0.3, 1, -2, 0.5], B = [1, 0.2, 0.4, -1], C = [-0.5, 2, 1, 1], N = HD.cross4(A, B, C);
  ok(close(V4.dot(N, A), 0, 1e-12) && close(V4.dot(N, B), 0, 1e-12) && close(V4.dot(N, C), 0, 1e-12), 'cross4 è ortogonale ai tre vettori');
}

/* ------------------------------------------------------------- polytopes -- */
section('Politopi regolari (caratteristica di Eulero V − E + F − C = 0)');
{
  const expect = {
    tesseract: [16, 32, 8], cell5: [5, 10, 5], cell16: [8, 24, 16], cell24: [24, 96, 24], cell600: [120, 720, 600],
  };
  for (const id in expect) {
    const P = HD.polytopes.get(id), [V, E, C] = expect[id];
    ok(P.verts.length === V && P.edges.length === E && P.cells.length === C, `${P.name}: ${V} vertici, ${E} spigoli, ${C} celle`,
      `got ${P.verts.length}/${P.edges.length}/${P.cells.length}`);
    ok(P.verts.every((v) => close(V4.len(v), 1, 1e-9)), `${P.name}: tutti i vertici sulla 3-sfera unitaria`);
    const f = P.info.f;
    ok(P.verts.length - P.edges.length + f - P.cells.length === 0, `${P.name}: V − E + F − C = 0`);
  }
}

section('Sezioni 3D (iperpiano w = s)');
{
  const T = HD.polytopes.get('tesseract'), I = M4.identity();
  let tv = HD.transformVerts(T, I, 1, [0, 0, 0, 0]);
  let s = HD.slice(T, tv, 0.1);
  ok(s.pts.length === 8 && s.polys.length === 6, 'tesseratto a w=0.1 → cubo (8 punti, 6 facce)');
  ok(s.pts.every((p) => p.every((x) => close(Math.abs(x), 0.5, 1e-9))), 'il cubo ha lato 1 (non è deformato)');
  s = HD.slice(T, tv, 0.9);
  ok(s.pts.length === 0, 'oltre il bordo (w=0.9 > 0.5) la sezione è vuota');
  const R = M4.plane(0, 3, Math.PI / 4);        // rotazione XW di 45°
  tv = HD.transformVerts(T, R, 1, [0, 0, 0, 0]);
  s = HD.slice(T, tv, 0);
  const xs = s.pts.map((p) => p[0]);
  ok(s.pts.length === 8 && close(Math.max(...xs) - Math.min(...xs), Math.SQRT2, 1e-9), 'tesseratto a 45° in XW: sezione = parallelepipedo √2 × 1 × 1');
  const G = M4.fromAngles([0, 0, 0, 0.6, 0.5, 0.4]);   // rotazione generica fuori dagli assi
  s = HD.slice(T, HD.transformVerts(T, G, 1, [0, 0, 0, 0]), 0.1);
  ok(s.pts.length > 8 && s.polys.length >= 8, 'tesseratto ruotato in modo generico: la sezione è un poliedro con più di 8 vertici', 'pts=' + s.pts.length);
  // il volume totale (somma sui w) della sezione non cambia con la rotazione: l'area proiettata in W di una sezione sparisce fuori dai bordi
  const wr = HD.transformVerts(T, G, 1, [0, 0, 0, 0]); let wmax = -9;
  for (let i = 0; i < 16; i++) wmax = Math.max(wmax, wr[i * 4 + 3]);
  ok(HD.slice(T, wr, wmax + 0.01).pts.length === 0 && HD.slice(T, wr, wmax - 0.01).pts.length >= 1, 'la sezione compare esattamente al w del vertice più alto');
  const O = HD.polytopes.get('cell16');
  s = HD.slice(O, HD.transformVerts(O, I, 1, [0, 0, 0, 0]), 0.01);
  ok(s.pts.length === 6 && s.polys.length === 8, '16-cell a w≈0 → ottaedro (6 punti, 8 facce)');
  const H = HD.polytopes.get('cell5');
  s = HD.slice(H, HD.transformVerts(H, I, 1, [0, 0, 0, 0]), 0.2);
  ok(s.pts.length === 4 || s.pts.length === 6, '5-cell: sezione = tetraedro o prisma triangolare', 'pts=' + s.pts.length);
  // le normali delle facce puntano verso l'esterno
  s = HD.slice(T, HD.transformVerts(T, I, 1, [0, 0, 0, 0]), 0.1);
  ok(s.polys.every((p) => { let c = [0, 0, 0]; p.pts.forEach((q) => { c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; }); return (c[0] * p.n[0] + c[1] * p.n[1] + c[2] * p.n[2]) > 0; }),
    'le normali delle facce puntano verso l\'esterno');
}

/* --------------------------------------------------------------- physics -- */
section('Collisioni 4D');
{
  const b = HD.physics.box([0, 0, 0, 0], [2, 2, 2, 2]);
  const c = HD.physics.sphereVsBox([3.2, 1, 1, 1], 1.5, b);
  ok(c && close(c.pen, 0.3, 1e-9) && close(c.n[0], 1, 1e-9), 'sfera vs faccia: penetrazione 0.3 lungo +X');
  ok(HD.physics.sphereVsBox([5, 1, 1, 1], 1.5, b) === null, 'nessuna collisione a distanza');
  const k = HD.physics.sphereVsBox([3, 3, 1, 1], 1.5, b);
  ok(k && close(k.pen, 1.5 - Math.SQRT2, 1e-9) && close(k.n[0], Math.SQRT1_2, 1e-9), 'sfera vs spigolo: normale diagonale');
  const k4 = HD.physics.sphereVsBox([3, 3, 3, 3], 2.5, b);
  ok(k4 && close(k4.pen, 2.5 - 2, 1e-9) && close(k4.n[3], 0.5, 1e-9), 'sfera vs vertice 4D: normale (½,½,½,½)');
  const ins = HD.physics.sphereVsBox([1, 1, 1, 0.3], 0.4, b);
  ok(ins && close(ins.n[3], -1, 1e-9) && close(ins.pen, 0.7, 1e-9), 'centro dentro la scatola: espulsione lungo W');
}

section('Giocatore: il muro 3D si aggira nella quarta dimensione');
{
  const lv = HD.levels.find((l) => l.id === 'thin-wall');
  function run(useW) {
    const world = HD.buildWorld(lv), pl = HD.physics.newPlayer(world.start);
    let t = 0;
    for (let i = 0; i < 120 * 14 && !pl.won && !pl.dead; i++) {
      const dt = 1 / 120; t += dt;
      HD.physics.updateBoxes(world.boxes, t);
      let mw = 0;
      if (useW) {
        if (pl.pos[0] < 2.2) mw = pl.pos[3] < 2.0 ? 1 : 0;          // sali in W prima del muro
        else if (pl.pos[0] > 5.4) mw = pl.pos[3] > 0.05 ? -1 : 0;    // torna a W=0 dopo il muro
        else mw = 0;
        if (pl.pos[0] >= 2.2 && pl.pos[0] <= 5.4 && pl.pos[3] < 1.6) mw = 1;
      }
      HD.physics.stepPlayer(pl, { mx: 0, mz: 0, mw, jump: false, ...{ mx: 1 } }, world, dt);
    }
    return pl;
  }
  const flat = run(false), viaW = run(true);
  ok(!flat.won && flat.pos[0] < 3, 'restando in W=0 il muro blocca il giocatore', 'x=' + flat.pos[0].toFixed(2));
  ok(viaW.won, 'passando per W ≈ 2 il giocatore aggira il muro e raggiunge l\'obiettivo');
}

section('Tutti i livelli sono risolvibili (bot automatico)');
{
/** Il bot salta solo se davanti non c'è terreno o c'è un ostacolo (come un giocatore umano). */
function shouldJump(world, pl, dirx, dirz) {
  if (!pl.onGround) return false;
  const l = Math.hypot(dirx, dirz); if (l < 1e-6) return false;
  const ux = dirx / l, uz = dirz / l;
  const solid = world.boxes.filter((b) => b.type === 's' || b.type === 'i');
  const probe = (d, dy) => { const p = [pl.pos[0] + ux * d, pl.pos[1] + dy, pl.pos[2] + uz * d, pl.pos[3]]; return solid.some((b) => HD.physics.sphereVsBox(p, pl.r, b)); };
  const groundAhead = probe(0.7, -0.12);
  const blocked = probe(0.35, 0.05);
  return !groundAhead || blocked;
}

  // waypoint: [x, z, w, saltaSempre]
  const plans = {
    'first-steps': [[15, 0, 0, true]],
    'thin-wall': [[2.0, 0, 2.2], [5.6, 0, 2.2], [9, 0, 0]],
    'ghost-bridge': [[1.4, 0, 2.5], [10.6, 0, 2.5], [13, 0, 0]],
    'w-slalom': [[2.2, 0, 2.2], [5.5, 0, -2.2], [9.5, 0, -2.2], [10.2, 0, 2.2], [13, 0, 2.2], [15.2, 0, 0]],
    'dimension-stairs': [[2.4, 0, 1.0, true], [6.8, 0, 1.0, true], [8.5, 0, -1.0, true], [10.8, 0, -1.0, true], [12.5, 0, 1.0, true], [14.8, 0, 1.0, true], [16.5, 0, -1.0, true], [18.8, 0, -1.0, true], [21, 0, 0, true]],
    'ferryman': null, // gestito a parte (richiede di aspettare il traghetto)
  };
  function simulate(lv, plan, maxT) {
    const world = HD.buildWorld(lv), pl = HD.physics.newPlayer(world.start);
    let t = 0, wp = 0;
    const dt = 1 / 120;
    while (t < maxT && !pl.won && !pl.dead && wp < plan.length) {
      t += dt; HD.physics.updateBoxes(world.boxes, t);
      const [tx, tz, tw, jmp] = plan[wp];
      const dx = tx - pl.pos[0], dz = tz - pl.pos[2], dw = tw - pl.pos[3];
      const dl = Math.hypot(dx, dz) || 1;
      const inp = { mx: dx / dl * (Math.hypot(dx, dz) > 0.2 ? 1 : 0), mz: dz / dl * (Math.hypot(dx, dz) > 0.2 ? 1 : 0), mw: Math.abs(dw) > 0.1 ? Math.sign(dw) : 0, jump: !!jmp && shouldJump(world, pl, dx, dz) };
      HD.physics.stepPlayer(pl, inp, world, dt);
      if (Math.hypot(dx, dz) < 0.45 && Math.abs(dw) < 0.4) wp++;
    }
    return { pl, t };
  }
  for (const lv of HD.levels) {
    if (!plans[lv.id]) continue;
    const r = simulate(lv, plans[lv.id], 60);
    ok(r.pl.won, `livello «${lv.id}» completato dal bot in ${r.t.toFixed(1)} s`, r.pl.dead ? '(morto)' : 'pos=' + r.pl.pos.map((x) => x.toFixed(2)));
  }
  // Traghettatore: aspetta che il traghetto sia vicino, sale, scende a destinazione
  {
    const lv = HD.levels.find((l) => l.id === 'ferryman'), world = HD.buildWorld(lv), pl = HD.physics.newPlayer(world.start);
    const ferry = world.boxes.find((b) => b.mv);
    let t = 0, phase = 0; const dt = 1 / 120;
    while (t < 90 && !pl.won && !pl.dead) {
      t += dt; HD.physics.updateBoxes(world.boxes, t);
      const fw = (ferry.min[3] + ferry.max[3]) / 2;
      let inp = { mx: 0, mz: 0, mw: 0, jump: false };
      if (phase === 0) {            // attendi il traghetto vicino a W=-3.4 e salta a bordo
        pl.pos[3] += 0; inp.mx = pl.pos[0] < 1.0 ? 1 : 0;
        if (pl.pos[0] >= 1.0 && Math.abs(fw - pl.pos[3]) < 0.5 && ferry.delta[3] < 0) { phase = 1; }
      }
      if (phase === 1) { inp.mx = pl.pos[0] < 3.0 ? 1 : 0; if (pl.riding === ferry && pl.pos[0] >= 2.8) phase = 2; }
      if (phase === 2) {            // sul traghetto: aspetta di arrivare a W alto
        inp.mx = 0; inp.mw = 0;
        if (fw > 2.4) phase = 3;
      }
      if (phase === 3) { inp.mx = pl.pos[0] < 5.6 ? 1 : 0; inp.mw = pl.pos[3] < 3.8 ? 1 : 0; if (pl.pos[0] >= 5.6) phase = 4; }
      if (phase === 4) { inp.mx = pl.pos[0] < 9.9 ? 1 : 0; inp.mw = pl.pos[3] < 3.8 ? 1 : (pl.pos[3] > 4.6 ? -1 : 0); }
      HD.physics.stepPlayer(pl, inp, world, dt);
    }
    ok(pl.won, `livello «ferryman» completato dal bot in ${t.toFixed(1)} s`, pl.dead ? '(morto, phase ' + phase + ')' : 'phase ' + phase + ' pos=' + pl.pos.map((x) => x.toFixed(2)));
  }
}

section('Sandbox: urti ipersfera-ipersfera');
{
  const sb = new HD.physics.Sandbox({ restitution: 1, friction: 0, gravity: 0, half: [50, 0, 50, 50], height: 100 });
  const a = sb.addBall([-3, 50, 0, 0], [2, 0, 0, 0], 1, 1), c = sb.addBall([3, 50, 0.5, 0.3], [-1, 0, 0, 0], 1, 2);
  const p0 = sb.momentum(), e0 = 0.5 * 1 * 4 + 0.5 * 2 * 1;
  for (let i = 0; i < 600; i++) sb.step(1 / 120);
  const p1 = sb.momentum();
  const e1 = [a, c].reduce((s, b) => s + 0.5 * b.m * (b.vel[0] ** 2 + b.vel[1] ** 2 + b.vel[2] ** 2 + b.vel[3] ** 2), 0);
  ok(p0.every((x, i) => close(x, p1[i], 1e-9)), 'quantità di moto conservata in 4D');
  ok(close(e0, e1, 1e-9), 'energia cinetica conservata nell\'urto elastico', e0 + ' vs ' + e1);
  ok(a.vel[0] < 0, 'la sfera leggera rimbalza indietro');
}
{
  const sb = new HD.physics.Sandbox({ seed: 7 });
  sb.spawnRandom(14);
  let e0 = sb.energy(), maxE = e0;
  for (let i = 0; i < 120 * 20; i++) { sb.step(1 / 120); maxE = Math.max(maxE, sb.energy()); }
  const inside = sb.balls.every((b) => Math.abs(b.pos[0]) <= sb.half[0] + 1e-6 && Math.abs(b.pos[2]) <= sb.half[2] + 1e-6 && Math.abs(b.pos[3]) <= sb.half[3] + 1e-6 && b.pos[1] >= b.r - 1e-6);
  ok(inside, '14 ipersfere per 20 s restano dentro il contenitore 4D');
  ok(maxE <= e0 * 1.02 + 1, 'l\'energia non cresce mai (nessun "esplosione" numerica)', `e0=${e0.toFixed(1)} max=${maxE.toFixed(1)}`);
  const rot = sb.balls.every((b) => { const t = M4.mul(M4.transpose(b.rot), b.rot); let er = 0; for (let i = 0; i < 16; i++) er = Math.max(er, Math.abs(t[i] - (i % 5 === 0 ? 1 : 0))); return er < 1e-6; });
  ok(rot, 'le orientazioni 4D restano ortogonali');
  ok(sb.balls.some((b) => b.spin.some((x) => Math.abs(x) > 1e-3)), 'l\'attrito mette in rotazione le sfere (bivettore ≠ 0)');
}
{
  // gravità nella quarta dimensione: la sfera cade lungo -W e si ferma sulla parete W
  const sb = new HD.physics.Sandbox({ restitution: 0.3, friction: 0.1 });
  sb.setGravityAngle(Math.PI / 2);
  const b = sb.addBall([0, 4, 0, 1.0], [0, 0, 0, 0], 0.6);
  for (let i = 0; i < 120 * 6; i++) sb.step(1 / 120);
  ok(Math.abs(b.pos[3] - (-sb.half[3] + 0.6)) < 0.02 && Math.abs(b.pos[1] - 4) < 1e-6, 'con gravità lungo W la sfera cade in W (y invariata) e si posa sulla parete W');
}

console.log(`\n${pass} superati, ${fail} falliti`);
process.exit(fail ? 1 : 0);
