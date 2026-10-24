/* ============================================================================
 * HyperDimension — ui.js
 * Traduzioni (IT/EN) e piccoli helper per costruire i pannelli senza framework.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD;

  const dict = {
    en: {
      tagline: 'Step into the fourth dimension.',
      sub: 'A 4D graphics and physics engine written from scratch. Slice a tesseract, bounce hyperspheres, walk around walls through W — all in your browser, with zero dependencies.',
      foot: 'No install · no server · no build step — just open index.html · Press H for help',
      'tab.lab': 'Lab', 'tab.play': 'Play', 'tab.physics': 'Physics', 'tab.editor': 'Editor',
      'card.lab': 'Explore tesseracts, 600-cells and Hopf fibrations. Rotate in all six planes and slice them live.',
      'card.play': 'Six puzzles. A wall that stops you in 3D can be walked around in 4D.',
      'card.physics': 'Hyperspheres bouncing in a 4D box. Tilt gravity into the fourth dimension.',
      'card.editor': 'Build your own 4D levels, test them instantly and share them with a link.',
      // lab
      'lab.shape': 'Shape', 'lab.view': 'View', 'lab.rot': 'Rotation (6 planes)', 'lab.slice': 'Hyperplane slice', 'lab.opts': 'Options',
      'view.overlay': 'Overlay', 'view.proj': 'Projection', 'view.slice': 'Section', 'view.side': 'Side by side',
      'lab.auto': 'Auto-rotate', 'lab.sweep': 'Sweep the slice', 'lab.faces': 'Section faces', 'lab.verts': 'Vertices',
      'lab.w': 'slice w', 'lab.scale': 'size', 'lab.dist': 'perspective',
      'lab.reset': 'Reset', 'lab.random': 'Random spin',
      'lab.tip': '<b>Drag</b> orbit · <b>Shift+drag</b> rotate XW/YW · <b>Alt+Shift+drag</b> rotate ZW · <b>Wheel</b> zoom',
      'shape.tesseract': 'Tesseract', 'shape.cell5': '5-cell', 'shape.cell16': '16-cell', 'shape.cell24': '24-cell', 'shape.cell600': '600-cell', 'shape.duoprism': '8-8 Duoprism', 'shape.hopf': 'Hopf fibration',
      'lab.facts': 'vertices · edges · faces · cells',
      'lab.euler': 'Euler characteristic of S³',
      'fact.tesseract': 'The 4D cube: 8 cubic cells. Its middle slice is a cube; rotate in XW and it stretches into a box.',
      'fact.cell5': 'The 4D simplex: 5 tetrahedra. The slice morphs between a tetrahedron and a triangular prism.',
      'fact.cell16': 'Dual of the tesseract: 16 tetrahedral cells. Its middle slice is an octahedron.',
      'fact.cell24': 'Exists only in 4D — no 3D analogue. 24 octahedra, self-dual. Slices include a truncated octahedron.',
      'fact.cell600': 'The 4D icosahedron: 600 tetrahedra, 120 vertices. The largest regular polytope you can slice live.',
      'fact.duoprism': 'Cartesian product of two octagons: 8 + 8 octagonal prisms.',
      'fact.hopf': 'Great circles of the 3-sphere, each linked with every other. Slicing shows the circles piercing W.',
      // play
      'play.levels': 'Levels', 'play.custom': 'Custom level', 'play.restart': 'Restart', 'play.next': 'Next level', 'play.retry': 'Retry',
      'play.menu': 'Menu', 'play.complete': 'Level complete', 'play.time': 'time', 'play.deaths': 'falls',
      'play.controls': '<b>WASD</b> move · <b>Space</b> jump · <b>Q / E</b> shift in W · <b>Drag</b> look · <b>R</b> restart',
      'play.wnote': 'You see only the 3D slice at your current <b>w</b>. Pink = objects at higher w, amber = lower w.',
      'play.ghosts': 'Show nearby W-ghosts', 'play.back': 'Back to editor', 'play.testing': 'Testing custom level',
      'lv.first-steps.name': 'First Steps', 'lv.first-steps.hint': 'Ordinary 3D platforming. Reach the green zone.',
      'lv.thin-wall.name': 'The Thin Wall', 'lv.thin-wall.hint': 'The wall is thick in x, y, z — but only 2 thin in W. Hold E (or Q) to step sideways through the 4th dimension.',
      'lv.ghost-bridge.name': 'Ghost Bridge', 'lv.ghost-bridge.hint': 'The pit has no floor… at w=0. Look for pink ghosts: the bridge lives at w≈2.5.',
      'lv.w-slalom.name': 'W-Slalom', 'lv.w-slalom.hint': 'Each wall has a gap at a different W. Weave: up, down, up.',
      'lv.dimension-stairs.name': 'Dimension Stairs', 'lv.dimension-stairs.hint': 'Each step exists only in half of W. Jump, and shift W in mid-air.',
      'lv.ferryman.name': 'The Ferryman', 'lv.ferryman.hint': 'Wait for the moving platform to drift into your W, hop on, ride it across — and beware the lava.',
      // physics
      'ph.world': 'World', 'ph.add': '+ 5 balls', 'ph.clear': 'Clear', 'ph.shake': 'Shake', 'ph.gravity': 'Gravity', 'ph.tilt': 'tilt → W', 'ph.bounce': 'bounce', 'ph.slow': 'time',
      'ph.slice': 'Slice', 'ph.sweep': 'Sweep slice', 'ph.ghost': 'Show shadows of other W', 'ph.w': 'slice w', 'ph.count': 'hyperspheres',
      'ph.tip': 'Balls pop in and out of existence as the slice moves through them. <b>Click</b> a ball to kick it. <b>Drag</b> to orbit.',
      'ph.pattern': 'The pattern on each ball is its own 4D surface: it morphs as you move through W.',
      // editor
      'ed.tools': 'Tool', 'ed.select': 'Select', 'ed.add': 'Add box', 'ed.start': 'Set start',
      'ed.type': 'Type', 'ed.s': 'Solid', 'ed.h': 'Lava', 'ed.g': 'Goal', 'ed.i': 'Ice',
      'ed.sel': 'Selected box', 'ed.pos': 'center', 'ed.size': 'size', 'ed.none': 'Nothing selected — click a box, or use “Add box”.',
      'ed.dup': 'Duplicate', 'ed.del': 'Delete', 'ed.allw': 'Span all W', 'ed.move': 'Moving', 'ed.axis': 'axis', 'ed.amp': 'range', 'ed.speed': 'speed', 'ed.static': 'Static',
      'ed.test': '▶ Play-test', 'ed.save': 'Save', 'ed.load': 'Load', 'ed.new': 'New', 'ed.export': 'Export JSON', 'ed.import': 'Import', 'ed.share': 'Copy share link',
      'ed.saved': 'Saved in this browser', 'ed.loaded': 'Loaded', 'ed.copied': 'Link copied', 'ed.imported': 'Imported', 'ed.badjson': 'Invalid JSON',
      'ed.slicew': 'slice w', 'ed.snap': 'Snap to grid',
      'ed.tip': '<b>Click</b> select/place · <b>Drag</b> selected box on the ground · <b>Q/E</b> slice W · <b>Del</b> delete · <b>Arrows</b> nudge · <b>[ ]</b> move in W · <b>PgUp/PgDn</b> move in Y',
      'ed.paste': 'Paste level JSON here…',
      // help
      'help.title': 'How it works', 'help.lead': 'Your screen is 2D, your world is 3D — and this one is 4D. You always see a 3D slice (a hyperplane at w) or a perspective projection.',
      'help.close': 'Close',
      'help.k1': 'Drag', 'help.d1': 'Orbit the camera', 'help.k2': 'Wheel / pinch', 'help.d2': 'Zoom',
      'help.k3': 'Shift + drag', 'help.d3': 'Lab: rotate the object in XW / YW (Alt: ZW)',
      'help.k4': 'WASD · Space', 'help.d4': 'Play: move and jump', 'help.k5': 'Q / E', 'help.d5': 'Play / Editor: move through the 4th dimension (W)',
      'help.k6': 'R', 'help.d6': 'Restart level', 'help.k7': 'H · F · L', 'help.d7': 'Help · fullscreen · language', 'help.k8': 'Esc', 'help.d8': 'Back to menu',
      'webgl.title': 'WebGL2 is required', 'webgl.body': 'Your browser or device does not expose WebGL2. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled.',
    },
    it: {
      tagline: 'Entra nella quarta dimensione.',
      sub: 'Un motore grafico e fisico 4D scritto da zero. Taglia un tesseratto, fai rimbalzare ipersfere, aggira i muri passando per W — tutto nel browser, senza dipendenze.',
      foot: 'Nessuna installazione · nessun server · nessuna build — basta aprire index.html · Premi H per l’aiuto',
      'tab.lab': 'Laboratorio', 'tab.play': 'Gioca', 'tab.physics': 'Fisica', 'tab.editor': 'Editor',
      'card.lab': 'Esplora tesseratti, 600-celle e fibrazioni di Hopf. Ruotali nei sei piani e tagliali dal vivo.',
      'card.play': 'Sei puzzle. Un muro che ti blocca in 3D si aggira in 4D.',
      'card.physics': 'Ipersfere che rimbalzano in una scatola 4D. Inclina la gravità nella quarta dimensione.',
      'card.editor': 'Costruisci i tuoi livelli 4D, provali subito e condividili con un link.',
      'lab.shape': 'Forma', 'lab.view': 'Vista', 'lab.rot': 'Rotazione (6 piani)', 'lab.slice': 'Sezione con iperpiano', 'lab.opts': 'Opzioni',
      'view.overlay': 'Sovrapposta', 'view.proj': 'Proiezione', 'view.slice': 'Sezione', 'view.side': 'Affiancate',
      'lab.auto': 'Rotazione automatica', 'lab.sweep': 'Scorri la sezione', 'lab.faces': 'Facce della sezione', 'lab.verts': 'Vertici',
      'lab.w': 'w sezione', 'lab.scale': 'dimensione', 'lab.dist': 'prospettiva',
      'lab.reset': 'Reimposta', 'lab.random': 'Rotazione casuale',
      'lab.tip': '<b>Trascina</b> orbita · <b>Shift+trascina</b> ruota XW/YW · <b>Alt+Shift+trascina</b> ruota ZW · <b>Rotella</b> zoom',
      'shape.tesseract': 'Tesseratto', 'shape.cell5': '5-celle', 'shape.cell16': '16-celle', 'shape.cell24': '24-celle', 'shape.cell600': '600-celle', 'shape.duoprism': 'Duoprisma 8-8', 'shape.hopf': 'Fibrazione di Hopf',
      'lab.facts': 'vertici · spigoli · facce · celle',
      'lab.euler': 'Caratteristica di Eulero di S³',
      'fact.tesseract': 'Il cubo 4D: 8 celle cubiche. La sezione centrale è un cubo; ruotando in XW si allunga in un parallelepipedo.',
      'fact.cell5': 'Il simplesso 4D: 5 tetraedri. La sezione si trasforma tra un tetraedro e un prisma triangolare.',
      'fact.cell16': 'Duale del tesseratto: 16 celle tetraedriche. La sezione centrale è un ottaedro.',
      'fact.cell24': 'Esiste solo in 4D, senza analogo 3D. 24 ottaedri, autoduale. Tra le sezioni c’è l’ottaedro troncato.',
      'fact.cell600': 'L’icosaedro 4D: 600 tetraedri, 120 vertici. Il politopo regolare più grande tagliabile dal vivo.',
      'fact.duoprism': 'Prodotto cartesiano di due ottagoni: 8 + 8 prismi ottagonali.',
      'fact.hopf': 'Cerchi massimi della 3-sfera, ognuno concatenato con tutti gli altri. La sezione mostra i cerchi che bucano W.',
      'play.levels': 'Livelli', 'play.custom': 'Livello personalizzato', 'play.restart': 'Ricomincia', 'play.next': 'Livello successivo', 'play.retry': 'Riprova',
      'play.menu': 'Menu', 'play.complete': 'Livello completato', 'play.time': 'tempo', 'play.deaths': 'cadute',
      'play.controls': '<b>WASD</b> muovi · <b>Spazio</b> salta · <b>Q / E</b> sposta in W · <b>Trascina</b> guarda · <b>R</b> ricomincia',
      'play.wnote': 'Vedi solo la sezione 3D al tuo <b>w</b> attuale. Rosa = oggetti a w maggiore, ambra = w minore.',
      'play.ghosts': 'Mostra i fantasmi in W', 'play.back': 'Torna all’editor', 'play.testing': 'Prova del livello personalizzato',
      'lv.first-steps.name': 'Primi passi', 'lv.first-steps.hint': 'Platform 3D classico. Raggiungi la zona verde.',
      'lv.thin-wall.name': 'Il muro sottile', 'lv.thin-wall.hint': 'Il muro è spesso in x, y, z — ma sottilissimo in W. Tieni premuto E (o Q) per fare un passo di lato nella quarta dimensione.',
      'lv.ghost-bridge.name': 'Il ponte fantasma', 'lv.ghost-bridge.hint': 'Nel baratro non c’è pavimento… a w=0. Cerca i fantasmi rosa: il ponte vive a w≈2.5.',
      'lv.w-slalom.name': 'Slalom in W', 'lv.w-slalom.hint': 'Ogni muro ha un varco a un W diverso. Zigzaga: su, giù, su.',
      'lv.dimension-stairs.name': 'Scale dimensionali', 'lv.dimension-stairs.hint': 'Ogni gradino esiste solo in metà di W. Salta e sposta W a mezz’aria.',
      'lv.ferryman.name': 'Il traghettatore', 'lv.ferryman.hint': 'Aspetta che la piattaforma mobile arrivi al tuo W, salta su, attraversa — e attento alla lava.',
      'ph.world': 'Mondo', 'ph.add': '+ 5 sfere', 'ph.clear': 'Svuota', 'ph.shake': 'Scuoti', 'ph.gravity': 'Gravità', 'ph.tilt': 'inclina → W', 'ph.bounce': 'rimbalzo', 'ph.slow': 'tempo',
      'ph.slice': 'Sezione', 'ph.sweep': 'Scorri la sezione', 'ph.ghost': 'Mostra le ombre degli altri W', 'ph.w': 'w sezione', 'ph.count': 'ipersfere',
      'ph.tip': 'Le sfere compaiono e spariscono mentre la sezione le attraversa. <b>Clicca</b> una sfera per colpirla. <b>Trascina</b> per orbitare.',
      'ph.pattern': 'Il disegno su ogni sfera è la sua superficie 4D: cambia mentre ti muovi in W.',
      'ed.tools': 'Strumento', 'ed.select': 'Seleziona', 'ed.add': 'Aggiungi blocco', 'ed.start': 'Imposta partenza',
      'ed.type': 'Tipo', 'ed.s': 'Solido', 'ed.h': 'Lava', 'ed.g': 'Traguardo', 'ed.i': 'Ghiaccio',
      'ed.sel': 'Blocco selezionato', 'ed.pos': 'centro', 'ed.size': 'dimensioni', 'ed.none': 'Nessuna selezione — clicca un blocco o usa «Aggiungi blocco».',
      'ed.dup': 'Duplica', 'ed.del': 'Elimina', 'ed.allw': 'Tutto W', 'ed.move': 'Mobile', 'ed.axis': 'asse', 'ed.amp': 'corsa', 'ed.speed': 'velocità', 'ed.static': 'Fisso',
      'ed.test': '▶ Prova', 'ed.save': 'Salva', 'ed.load': 'Carica', 'ed.new': 'Nuovo', 'ed.export': 'Esporta JSON', 'ed.import': 'Importa', 'ed.share': 'Copia link',
      'ed.saved': 'Salvato in questo browser', 'ed.loaded': 'Caricato', 'ed.copied': 'Link copiato', 'ed.imported': 'Importato', 'ed.badjson': 'JSON non valido',
      'ed.slicew': 'w sezione', 'ed.snap': 'Aggancia alla griglia',
      'ed.tip': '<b>Clic</b> seleziona/posiziona · <b>Trascina</b> il blocco sul terreno · <b>Q/E</b> W della sezione · <b>Canc</b> elimina · <b>Frecce</b> sposta · <b>[ ]</b> sposta in W · <b>PagSu/PagGiù</b> sposta in Y',
      'ed.paste': 'Incolla qui il JSON del livello…',
      'help.title': 'Come funziona', 'help.lead': 'Lo schermo è 2D, il mondo è 3D — e questo è 4D. Vedi sempre una sezione 3D (un iperpiano a w) oppure una proiezione prospettica.',
      'help.close': 'Chiudi',
      'help.k1': 'Trascina', 'help.d1': 'Orbita la camera', 'help.k2': 'Rotella / pizzico', 'help.d2': 'Zoom',
      'help.k3': 'Shift + trascina', 'help.d3': 'Laboratorio: ruota l’oggetto in XW / YW (Alt: ZW)',
      'help.k4': 'WASD · Spazio', 'help.d4': 'Gioco: muovi e salta', 'help.k5': 'Q / E', 'help.d5': 'Gioco / Editor: muoviti nella quarta dimensione (W)',
      'help.k6': 'R', 'help.d6': 'Ricomincia il livello', 'help.k7': 'H · F · L', 'help.d7': 'Aiuto · schermo intero · lingua', 'help.k8': 'Esc', 'help.d8': 'Torna al menu',
      'webgl.title': 'Serve WebGL2', 'webgl.body': 'Il browser o il dispositivo non espone WebGL2. Prova con una versione recente di Chrome, Edge, Firefox o Safari con accelerazione hardware attiva.',
    },
  };

  const I18N = (HD.i18n = {
    lang: 'en',
    t(k) { return (dict[this.lang] && dict[this.lang][k]) || dict.en[k] || k; },
  });

  /* ---------------------------------------------------------- DOM utils -- */
  const $ = (s, r) => (r || document).querySelector(s);
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach((c) => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  HD.ui = {
    $, el,
    h3(text) { return el('h3', { text }); },
    info(html) { return el('div', { class: 'info', html }); },
    chips(items, current, onPick) {
      const wrap = el('div', { class: 'chips' });
      items.forEach((it) => {
        const b = el('button', { class: 'chip' + (it.id === current ? ' on' : ''), text: it.label, onclick: () => {
          wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); b.classList.add('on'); onPick(it.id);
        } });
        wrap.appendChild(b);
      });
      return wrap;
    },
    slider(label, min, max, step, value, onInput, o) {
      o = o || {};
      const val = el('span', { class: 'val' });
      const inp = el('input', { type: 'range', min, max, step, value });
      const fmt = o.fmt || ((v) => (+v).toFixed(2));
      const upd = () => { val.textContent = fmt(parseFloat(inp.value)); };
      inp.addEventListener('input', () => { upd(); onInput(parseFloat(inp.value)); });
      upd();
      const row = el('div', { class: 'row' + (o.w ? ' w' : '') }, [el('label', { text: label }), inp, val]);
      row.set = (v) => { inp.value = v; upd(); };
      row.input = inp;
      return row;
    },
    toggle(label, value, onChange) {
      const t = el('div', { class: 'toggle' + (value ? ' on' : '') }, [el('span', { text: label }), el('i')]);
      t.addEventListener('click', () => { t.classList.toggle('on'); onChange(t.classList.contains('on')); });
      t.set = (v) => t.classList.toggle('on', !!v);
      return t;
    },
    btn(label, onClick, cls) { return el('button', { class: 'btn' + (cls ? ' ' + cls : ''), text: label, onclick: onClick }); },
    btns(list) { return el('div', { class: 'btns' }, list); },
    toast(msg) {
      const t = $('#toast'); t.textContent = msg; t.classList.add('show');
      clearTimeout(HD.ui._tt); HD.ui._tt = setTimeout(() => t.classList.remove('show'), 1800);
    },
    store: {
      get(k, d) { try { const v = localStorage.getItem('hd.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem('hd.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    },
  };
})(window);
