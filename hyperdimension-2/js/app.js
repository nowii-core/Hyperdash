/* ============================================================================
 * HyperDimension — app.js
 * Bootstrap: renderer, camera, gestione input, cambio modalità, intro, aiuto,
 * cicli di aggiornamento/render con qualità adattiva.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD, U = HD.ui, $ = U.$, el = U.el, t = (k) => HD.i18n.t(k);

  const App = (HD.app = {
    r: null, cam: null, mode: null, modeId: null, time: 0, interacting: false,
    panel: null, keys: {}, virtual: { x: 0, z: 0, jump: false, wp: false, wm: false },
    params: new URLSearchParams(location.search),
    ret: null, // modalità a cui tornare (prova livello dall'editor)

    setHint(html) { $('#hint').innerHTML = html || ''; },
    hudTop(html) { const h = $('#hudTop'); if (h._last !== html) { h._last = html; h.innerHTML = html || ''; } },
    toast: U.toast,
  });

  /* ------------------------------------------------------------- start -- */
  function boot() {
    const lang = (App.params.get('lang') || U.store.get('lang') || (navigator.language || 'en')).toLowerCase();
    HD.i18n.lang = lang.startsWith('it') ? 'it' : 'en';
    if (App.params.has('shot')) document.body.classList.add('shot');

    const canvas = $('#gl');
    try {
      App.r = new HD.Renderer(canvas, { preserve: App.params.has('shot') });
    } catch (e) {
      console.error(e);
      const f = $('#fatal'); f.hidden = false;
      f.innerHTML = `<div><h2>${t('webgl.title')}</h2><p>${t('webgl.body')}</p><pre></pre></div>`;
      f.querySelector('pre').textContent = String(e && e.message || e).slice(0, 600);
      return;
    }
    App.cam = new HD.OrbitCamera({ dist: 8, pitch: 0.3 });
    App.panel = $('#panel');
    HD.modes.lab.init && HD.modes.lab.init(App);

    buildChrome();
    bindInput(canvas);
    window.addEventListener('resize', () => App.r.resize());

    // deep links: ?mode=lab|play|physics|editor&level=3 , #lv=...
    const hash = location.hash.match(/lv=([^&]+)/);
    const mode = App.params.get('mode');
    if (hash) {
      try { const lv = JSON.parse(decodeURIComponent(escape(atob(hash[1].replace(/-/g, '+').replace(/_/g, '/'))))); HD.modes.play.loadCustom(lv); start('play'); }
      catch (e) { console.warn('bad level hash', e); start('lab', true); }
    } else if (mode && HD.modes[mode === 'physics' ? 'sandbox' : mode]) start(mode === 'physics' ? 'sandbox' : mode);
    else if (mode === 'dash' || !mode) {
      start('lab', true); showIntro(false);
      HD.dashGame.show('home');
      if (App.params.has('level')) HD.dashGame.startLevel(Math.max(0, Math.min(199, parseInt(App.params.get('level'), 10) - 1 || 0)), App.params.has('practice'));
      else if (App.params.has('screen')) HD.dashGame.show(App.params.get('screen'));
    }
    else { start('lab', true); }
    if (mode && mode !== 'dash' && App.params.has('level')) HD.modes.play.loadLevel(parseInt(App.params.get('level'), 10) - 1 || 0);

    last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ chrome -- */
  const TABS = [['lab', 'lab'], ['play', 'play'], ['sandbox', 'physics'], ['editor', 'editor']];
  const ICONS = { lab: '◈', play: '▶', sandbox: '◉', editor: '✎' };
  function buildChrome() {
    const tabs = $('#tabs'); tabs.innerHTML = '';
    TABS.forEach(([id, key]) => tabs.appendChild(el('button', { 'data-m': id, role: 'tab', text: t('tab.' + key), onclick: () => start(id) })));
    const cards = $('#cards'); cards.innerHTML = '';
    const colors = { lab: '#00e5ff', play: '#3dffa2', sandbox: '#ffb547', editor: '#ff3dcb' };
    TABS.forEach(([id, key]) => {
      const c = el('button', { class: 'card', style: `--c:${colors[id]}`, onclick: () => start(id) }, [
        el('div', { class: 'ic', text: ICONS[id], style: `color:${colors[id]}` }), el('h4', { text: t('tab.' + key) }), el('p', { text: t('card.' + key) }),
      ]);
      cards.appendChild(c);
    });
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.getAttribute('data-i18n')); });
    $('#btnLang').textContent = HD.i18n.lang.toUpperCase();
    $('#btnLang').onclick = toggleLang;
    $('#introBack').onclick = () => HD.dashGame.show('home');
    $('#btnGame').onclick = () => HD.dashGame.show('home');
    $('#btnHelp').onclick = showHelp;
    $('#btnFull').onclick = toggleFull;
    $('#brand').onclick = () => { HD.dashGame.show('home'); };
    document.documentElement.lang = HD.i18n.lang;
  }
  function toggleLang() {
    HD.i18n.lang = HD.i18n.lang === 'it' ? 'en' : 'it'; U.store.set('lang', HD.i18n.lang);
    buildChrome(); if (App.mode && App.mode.build) App.mode.build(App); if (App.mode && App.mode.enter && App.modeId !== 'lab') App.mode.enter(App);
    markTab();
  }
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen(); else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  function markTab() { document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === App.modeId)); }
  function showIntro(show) { $('#intro').classList.toggle('gone', !show); }

  function showHelp() {
    const m = $('#modal'); m.hidden = false;
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<tr><td>${t('help.k' + i)}</td><td>${t('help.d' + i)}</td></tr>`).join('');
    m.innerHTML = `<div class="dlg"><h2>${t('help.title')}</h2><p class="lead">${t('help.lead')}</p><table>${rows}</table><div class="btns"><button class="btn pri" id="hclose">${t('help.close')}</button></div></div>`;
    $('#hclose').onclick = closeModal; m.onclick = (e) => { if (e.target === m) closeModal(); };
  }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }
  App.closeModal = closeModal;
  App.showModal = (html) => { const m = $('#modal'); m.hidden = false; m.innerHTML = html; m.onclick = (e) => { if (e.target === m) closeModal(); }; return m; };

  /* -------------------------------------------------------------- mode -- */
  function start(id, keepIntro) {
    closeModal();
    if (App.mode && App.mode.exit) App.mode.exit(App);
    App.modeId = id; App.mode = HD.modes[id];
    $('#gauge').style.display = 'none'; App.hudTop(''); App.setHint('');
    $('#touch').hidden = true;
    App.cam.yaw = 0.7; App.cam.pitch = 0.3; App.cam.target = [0, 0, 0];
    App.mode.enter(App);
    markTab();
    showIntro(!!keepIntro);
  }
  App.start = start;

  /* ------------------------------------------------------------- input -- */
  function bindInput(canvas) {
    let drag = null;
    const pointers = new Map();
    let pinch = 0;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0, button: e.button, shift: e.shiftKey, alt: e.altKey };
      App.interacting = true;
      if (App.mode.down) App.mode.down(e, App, canvas);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) App.cam.zoom(pinch / d); pinch = d; return;
      }
      if (!drag || e.pointerId !== drag.id) { if (App.mode.hover) App.mode.hover(e, App, canvas); return; }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      const consumed = App.mode.drag && App.mode.drag(dx, dy, e, App, drag);
      if (!consumed) { if (e.button === 1 || (e.buttons & 4)) App.cam.pan(dx, dy); else App.cam.orbit(dx, dy); }
    });
    const up = (e) => {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0;
      if (drag && e.pointerId === drag.id) {
        if (drag.moved < 5 && App.mode.click) App.mode.click(e, App, canvas, drag);
        if (App.mode.up) App.mode.up(e, App, canvas, drag);
        drag = null;
      }
      App.interacting = pointers.size > 0;
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); App.cam.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range') return;
      const k = e.key.toLowerCase();
      App.keys[k] = true; App.keys[e.code] = true;
      if (k === 'h' || k === '?') { $('#modal').hidden ? showHelp() : closeModal(); }
      else if (k === 'f') toggleFull();
      else if (k === 'l') toggleLang();
      else if (k === 'escape') {
        if (!$('#modal').hidden) closeModal();
        else if (!$('#intro').classList.contains('gone')) showIntro(false);
        else if (App.mode.escape && App.mode.escape(App)) { /* gestito dalla modalità */ }
        else showIntro(true);
      }
      if (App.mode.key) App.mode.key(e, App);
      if ((e.code === 'Space' || k.startsWith('arrow')) && e.target === document.body) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { App.keys[e.key.toLowerCase()] = false; App.keys[e.code] = false; });
    window.addEventListener('blur', () => { App.keys = {}; });

    // controlli touch
    if (matchMedia('(pointer: coarse)').matches) App.touch = true;
    const stick = $('#stick'), knob = $('#knob'); let sid = null;
    const setStick = (e) => {
      const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
      App.virtual.x = Math.abs(dx) < 0.12 ? 0 : dx; App.virtual.z = Math.abs(dy) < 0.12 ? 0 : -dy;
    };
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; stick.setPointerCapture(sid); setStick(e); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
    const endStick = (e) => { if (e.pointerId === sid) { sid = null; knob.style.transform = ''; App.virtual.x = App.virtual.z = 0; } };
    stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
    document.querySelectorAll('#tbtns button').forEach((b) => {
      const k = b.dataset.k;
      b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); App.virtual[k] = true; b.classList.add('down'); });
      const off = () => { App.virtual[k] = false; b.classList.remove('down'); };
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
    });
  }

  /* ---------------------------------------------------------- main loop -- */
  let last = 0, fpsAcc = 0, fpsN = 0, lowT = 0, fpsShow = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.body.classList.contains('dash-on')) { last = now; return; }
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    App.time += dt;
    // qualità adattiva: se < 30 fps per 2 s riduci la risoluzione interna
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) {
      const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0;
      if (App.params.has('fps')) $('#fps').textContent = fps.toFixed(0) + ' fps · ' + App.r.w + '×' + App.r.h;
      if (fps < 30) lowT += 0.5; else lowT = Math.max(0, lowT - 0.25);
      if (lowT >= 2 && App.r.quality > 0.5) { App.r.quality = Math.max(0.5, App.r.quality - 0.15); App.r.resize(); lowT = 0; }
    }
    try {
      App.mode.update(dt, App);
      const r = App.r;
      App.cam.update(r.w / r.h);
      r.begin(App.cam, App.time, App.mode.bg ? App.mode.bg(App) : null);
      App.mode.render(r, App);
      r.end();
    } catch (e) {
      console.error(e);
      if (!App._errShown) { App._errShown = true; U.toast('⚠ ' + (e.message || e)); }
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})(window);
