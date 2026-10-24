// esegue tutte le suite: node tests/all.js
const { execSync } = require('child_process');
for (const f of ['run.js', 'dash-engine.js', 'dash-levels.js']) { console.log('> ' + f); console.log(execSync('node ' + __dirname + '/' + f, { encoding: 'utf8' }).split('\n').slice(-3).join('\n')); }
