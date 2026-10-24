/* Test del motore dash: node tests/dash-engine.js */
'use strict';
require('../js/dash/engine.js');
const D = globalThis.HD.dash;
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + n); } else { fail++; console.log('  \x1b[31m✗ ' + n + '\x1b[0m ' + (x || '')); } };
const lv = (objs, len) => D.prepare({ len: len || 60, objs, speed: 1 });
const floor = () => ({ k: 'b', x: -5, y: -1, w: 200, h: 1 });

console.log('\nCubo');
{
  const L = lv([{ k: 's', x: 20, y: 0, d: 0 }], 40);
  let S = D.simulate(L, () => false);
  ok(S.dead && S.cause === 'spike', 'senza saltare il cubo muore sullo spuntone');
  S = D.simulate(L, (i, s) => s.px > 18.6 && s.px < 18.9);
  ok(S.won, 'un salto ben temporizzato supera lo spuntone');
  const S2 = D.newState(L); let apex = 0;
  for (let i = 0; i < 240; i++) { D.step(S2, L, i === 0 || S2.ground, null); apex = Math.max(apex, S2.py); if (i > 5 && S2.ground) break; }
  ok(apex > 2.4 && apex < 3.0, 'altezza del salto ≈ 2,1 blocchi sopra il centro (apex ' + apex.toFixed(2) + ')');
  // aria: durata del salto ≈ 0.5 s
  const S3 = D.newState(L); let n = 0; D.step(S3, L, true, null); while (!S3.ground && n < 400) { D.step(S3, L, false, null); n++; }
  ok(Math.abs(n / 120 - 0.5) < 0.04, 'durata del salto ≈ 0,5 s (' + (n / 120).toFixed(3) + ' s)');
}
console.log('\nBlocchi');
{
  const L = lv([{ k: 'b', x: 15, y: 0, w: 1, h: 1 }], 40);
  ok(D.simulate(L, () => false).dead, 'schiantarsi di lato contro un blocco = morte');
  const S = D.simulate(L, (i, s) => s.px > 13.6 && s.px < 14.4);
  ok(S.won, 'saltando sopra il blocco e atterrando si prosegue');
  const L2 = lv([{ k: 'b', x: 15, y: 0, w: 6, h: 1 }, { k: 's', x: 22, y: 0, d: 0 }], 40);
  const S2 = D.simulate(L2, (i, s) => (s.px > 13.7 && s.px < 14.3) || (s.px > 21 && s.px < 21.5));
  ok(S2.won, 'salire su una piattaforma e saltare giù sopra uno spuntone');
  // perdono: un cubo che cade con il fondo 0.08 sotto la cima del blocco sale sopra invece di morire
  const L3 = lv([{ k: 'b', x: 15, y: 0, w: 4, h: 1 }], 30);
  const f = D.newState(L3); f.px = 14.46; f.py = 1.5 - 0.08; f.vy = -2; f.ground = false;
  D.step(f, L3, false, null); D.step(f, L3, false, null);
  ok(!f.dead && Math.abs(f.py - 1.5) < 0.05, 'bordo del blocco: scivolata di 0,08 perdonata (si sale sopra)');
  const g = D.newState(L3); g.px = 14.46; g.py = 1.5 - 0.3; g.vy = -2; g.ground = false;
  D.step(g, L3, false, null); D.step(g, L3, false, null);
  ok(g.dead, 'bordo del blocco: affondare di 0,3 resta uno schianto');
}
console.log('\nNave');
{
  const objs = [{ k: 'P', x: 5, y: 1.5, t: 'ship' }];
  const L = lv(objs, 40);
  const hold = D.simulate(L, () => true);
  ok(!hold.dead && hold.won, 'la nave tenendo premuto sale fino al soffitto e scivola senza morire');
  const free = D.simulate(L, () => false);
  ok(!free.dead && free.won, 'la nave lasciata cadere scivola sul pavimento senza morire');
  const wall = lv([{ k: 'P', x: 3, y: 1.5, t: 'ship' }, { k: 'b', x: 20, y: 0, w: 1, h: 6, lay: 2 }], 40);
  ok(D.simulate(wall, () => false).dead, 'la nave contro un muro muore');
}
console.log('\nPalla');
{
  const L = lv([{ k: 'P', x: 4, y: 1.5, t: 'ball' }, { k: 's', x: 20, y: 0, d: 0 }, { k: 's', x: 26, y: 9, d: 1 }], 40);
  ok(D.simulate(L, () => false).dead, 'la palla ferma muore sullo spuntone');
  const S = D.simulate(L, (i, s) => (s.px > 17 && s.px < 17.4) || (s.px > 23.5 && s.px < 23.9));
  ok(S.won, 'la palla inverte la gravità e supera spuntoni a terra e al soffitto');
}
console.log('\nWave');
{
  const L = lv([{ k: 'P', x: 4, y: 1.5, t: 'wave' }], 40);
  const S = D.simulate(L, (i, s) => s.py < 5);
  ok(S.won && !S.dead, 'la wave segue il soffitto/pavimento senza morire');
  const wall = lv([{ k: 'P', x: 4, y: 1.5, t: 'wave' }, { k: 'b', x: 20, y: 0, w: 1, h: 9 }], 40);
  ok(D.simulate(wall, (i, s) => s.py < 5).dead, 'la wave contro un blocco muore');
}
console.log('\nPad, orb, portali, monete, dimensione 4D');
{
  const Lp = lv([{ k: 'p', x: 12, y: 0, d: 0, t: 0 }, { k: 'b', x: 16, y: 0, w: 1, h: 4 }, { k: 'b', x: 17, y: 3.9, w: 3, h: 0.1 }], 40);
  const S = D.newState(Lp); let mx = 0; for (let i = 0; i < 400; i++) { D.step(S, Lp, false, null); mx = Math.max(mx, S.py); }
  ok(mx > 3.5, 'il pad giallo lancia il cubo più in alto del salto (apex ' + mx.toFixed(2) + ')');
  const Lo = lv([{ k: 's', x: 20, y: 0, d: 0 }, { k: 's', x: 21, y: 0, d: 0 }, { k: 's', x: 22, y: 0, d: 0 }, { k: 's', x: 23, y: 0, d: 0 }, { k: 's', x: 24, y: 0, d: 0 }, { k: 's', x: 25, y: 0, d: 0 }, { k: 'o', x: 22.5, y: 2.6, t: 0 }], 40);
  ok(D.simulate(Lo, () => false).dead, 'campo di spuntoni largo: senza orb si muore');
  const Sx = D.simulate(Lo, (i, s) => (s.px > 18.5 && s.px < 18.8) || (s.px > 21.9 && s.px < 22.3));
  ok(Sx.won, 'salto + orb (seconda pressione dentro l\'anello) attraversano il campo di spuntoni');
  const Lg = lv([{ k: 'P', x: 8, y: 1.5, t: 'gf' }, { k: 's', x: 20, y: 9, d: 1 }, { k: 'P', x: 30, y: 8.5, t: 'gn' }], 45);
  const Sg = D.simulate(Lg, (i, s) => s.gf && s.px > 17 && s.px < 17.3);
  ok(Sg.won, 'portale di gravità: si corre sul soffitto e si salta giù');
  const Lc = lv([{ k: 'c', x: 12, y: 0.5, i: 1 }, { k: 'c', x: 14, y: 5, i: 2 }], 30);
  ok(D.simulate(Lc, () => false).coins === 2, 'una moneta a terra viene raccolta, quella in alto no (bitmask ' + D.simulate(Lc, () => false).coins + ')');
  // dimensione 4D: lo spuntone esiste solo nello strato 0
  const Ld = lv([{ k: 's', x: 20, y: 0, d: 0, lay: 0 }, { k: 'P', x: 10, y: 1.5, t: 'd1', lay: 2 }, { k: 'P', x: 30, y: 1.5, t: 'd0', lay: 2 }], 45);
  ok(D.simulate(Ld, () => false).won, 'dimensione 4D: nello strato 1 lo spuntone dello strato 0 è innocuo');
  const Ld2 = lv([{ k: 's', x: 20, y: 0, d: 0, lay: 0 }], 45);
  ok(D.simulate(Ld2, () => false).dead, 'senza portale (strato 0) lo stesso spuntone uccide');
  const Lm = lv([{ k: 'P', x: 6, y: 1.5, t: 'sm' }, { k: 'b', x: 20, y: 0, w: 1, h: 1 }], 40);
  const Sm = D.simulate(Lm, (i, s) => s.px > 18.8 && s.px < 19.5);
  ok(Sm.mini === 1 && Sm.won, 'portale mini: il cubo piccolo salta un blocco');
  const Ls = lv([{ k: 'P', x: 6, y: 1.5, t: 's3' }], 100);
  const Ss = D.simulate(Ls, () => false);
  ok(Ss.won && Ss.t < 120 * 7, 'portale velocità 1,6×: il traguardo arriva prima (' + (Ss.t / 120).toFixed(1) + ' s)');
}
console.log('\nDeterminismo');
{
  const L = lv([{ k: 's', x: 20, y: 0, d: 0 }, { k: 'p', x: 30, y: 0, d: 0, t: 1 }], 60);
  const inp = (i) => i % 97 < 11;
  const a = D.simulate(L, inp), b = D.simulate(L, inp);
  ok(a.px === b.px && a.py === b.py && a.dead === b.dead, 'stessi input → stesso esito esatto');
  const s0 = D.newState(L); for (let i = 0; i < 300; i++) D.step(s0, L, inp(i), null);
  const cl = D.clone(s0); for (let i = 300; i < 500; i++) { D.step(s0, L, inp(i), null); D.step(cl, L, inp(i), null); }
  ok(s0.px === cl.px && s0.py === cl.py, 'clone dello stato: la simulazione prosegue identica');
}
console.log(`\n${pass} superati, ${fail} falliti`); process.exit(fail ? 1 : 0);
