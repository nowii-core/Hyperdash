/* ============================================================================
 * HyperDimension — levels.js
 * Sei livelli-puzzle che insegnano la quarta dimensione, un concetto alla volta.
 * Formato compatto: ogni box è [tipo, x0,y0,z0,w0, x1,y1,z1,w1, (mv)]
 *   tipo: s solido · h letale · g obiettivo · i ghiaccio
 *   mv:   {axis:0..3, amp, speed, phase}  (piattaforma mobile)
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD;
  const W = 6; // i pavimenti coprono tutto l'asse W giocabile

  const raw = [
    {
      id: 'first-steps', wLimit: 4.5,
      start: [-3, 0.45, 0, 0],
      boxes: [
        ['s', -4.5, -1, -3, -W, 4, 0, 3, W],
        ['s', 5, -1, -2, -W, 8, 0.8, 2, W],
        ['s', 9, -1, -2, -W, 12, 1.6, 2, W],
        ['s', 13, -1, -2, -W, 17, 2.4, 2, W],
        ['g', 14.6, 2.4, -0.8, -1.2, 16, 3.8, 0.8, 1.2],
      ],
    },
    {
      id: 'thin-wall', wLimit: 4.5,
      start: [-3, 0.45, 0, 0],
      boxes: [
        ['s', -4.5, -1, -4, -W, 12, 0, 4, W],
        ['s', 3, 0, -4, -1, 4.2, 8, 4, 1],            // il muro: sottile in W
        ['g', 8.5, 0, -1, -0.7, 10, 2.2, 1, 0.7],
      ],
    },
    {
      id: 'ghost-bridge', wLimit: 4.5,
      start: [-3, 0.45, 0, 0],
      boxes: [
        ['s', -4.5, -1, -2.5, -W, 2, 0, 2.5, W],
        ['s', 2, -1, -1.2, 1.6, 10, 0, 1.2, 3.4],     // il ponte esiste solo a W ≈ 2.5
        ['s', 10, -1, -2.5, -W, 14.5, 0, 2.5, W],
        ['g', 12.5, 0, -0.8, -0.8, 14, 2.2, 0.8, 0.8],
      ],
    },
    {
      id: 'w-slalom', wLimit: 4.5,
      start: [-3, 0.45, 0, 0],
      boxes: [
        ['s', -4.5, -1, -3, -W, 17, 0, 3, W],
        ['s', 3, 0, -3, -W, 4, 8, 3, 1],               // aperto per W > 1.4
        ['s', 7, 0, -3, -1, 8, 8, 3, W],               // aperto per W < -1.4
        ['s', 11, 0, -3, -W, 12, 8, 3, 1],             // aperto per W > 1.4
        ['g', 14.5, 0, -1, -0.8, 16, 2.2, 1, 0.8],
      ],
    },
    {
      id: 'dimension-stairs', wLimit: 4.5,
      start: [-2.5, 0.45, 0, 0],
      boxes: [
        ['s', -4, -1, -2.5, -W, 1.8, 0, 2.5, W],
        ['s', 3, -1, -2, 0.6, 6, 1.0, 2, W],           // piattaforme alternate: W > 0.6
        ['s', 7, -1, -2, -W, 10, 2.0, 2, -0.6],        //                         W < -0.6
        ['s', 11, -1, -2, 0.6, 14, 3.0, 2, W],
        ['s', 15, -1, -2, -W, 18, 4.0, 2, -0.6],
        ['s', 19, -1, -2.5, -W, 24, 5.0, 2.5, W],
        ['g', 21, 5.0, -0.8, -1, 23, 6.4, 0.8, 1],
      ],
    },
    {
      id: 'ferryman', wLimit: 4.5,
      start: [-2, 0.45, 0, -3.4],
      boxes: [
        ['s', -4, -1, -2, -W, 1.5, 0, 2, -1.6],
        ['s', 1.6, -1, -1.6, -0.9, 5, 0, 1.6, 0.9, { axis: 3, amp: 3.5, speed: 0.75, phase: 0 }],
        ['s', 5, -1, -2.4, 1.6, 11, 0, 2.4, W],
        ['h', 7.6, 0, -2.4, 1.6, 8.4, 3.2, 2.4, 3.2],  // lava: si aggira solo a W alto
        ['g', 9.4, 0, -0.9, 3.6, 10.6, 2.2, 0.9, 5.6],
      ],
    },
  ];

  /** Costruisce la lista di box fisici da un livello compatto. */
  HD.buildWorld = function (lv) {
    const boxes = lv.boxes.map((b) =>
      HD.physics.box([b[1], b[2], b[3], b[4]], [b[5], b[6], b[7], b[8]], b[0], b[9] || null));
    return { boxes, wLimit: lv.wLimit || 4.5, voidY: lv.voidY, start: lv.start.slice(), name: lv.name };
  };

  /** Serializza un mondo (dall'editor) nel formato compatto. */
  HD.worldToLevel = function (world, name) {
    return {
      id: 'custom', name: name || 'Custom', wLimit: world.wLimit || 4.5, start: world.start.slice(),
      boxes: world.boxes.map((b) => {
        const a = [b.type, ...b.base.min, ...b.base.max];
        if (b.mv) a.push(b.mv);
        return a;
      }),
    };
  };

  HD.levels = raw;
})(typeof window !== 'undefined' ? window : globalThis);
