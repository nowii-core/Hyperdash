// Verifica: per tutti i 200 livelli, la soluzione di riferimento vince e raccoglie le 3 monete
global.HD = {};
['engine', 'solver', 'generator', 'leveldata'].forEach((f) => require('../js/dash/' + f + '.js'));
const D = HD.dash; let bad = 0, tot = 0;
for (let i = 0; i < D.NUM_LEVELS; i++) {
  const L = D.getLevel(i), s = D.LEVELDATA[i].s, inputs = [];
  let h = false; s.forEach((n) => { for (let k = 0; k < n; k++) inputs.push(h); h = !h; });
  const S = D.replay(L, inputs.concat(Array(400).fill(false)), 4);
  const ok = S.won && (S.coins & 7) === 7; tot++;
  if (!ok) { bad++; console.log('FAIL level', i, 'won', S.won, 'dead', S.dead, 'x', S.px.toFixed(1), 'coins', S.coins); }
}
console.log(bad ? `${bad}/${tot} livelli NON validi` : `OK: ${tot} livelli risolvibili con 3 monete`);
process.exit(bad ? 1 : 0);
