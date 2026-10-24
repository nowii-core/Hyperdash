/* ============================================================================
 * HyperDimension — polytopes.js
 * Generatori di politopi 4D (5-cell, tesseratto, 16-cell, 24-cell, 600-cell,
 * duoprismi, fibrazione di Hopf) e slicer: sezione 3D esatta tramite un
 * iperpiano w = s, calcolata cella per cella.
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD;
  const { sqrt, sin, cos, atan2, PI, abs } = Math;
  const PHI = (1 + sqrt(5)) / 2;
  const EPS = 1e-6;

  /* ----------------------------------------------------------- utilità -- */
  function dist2(a, b) {
    const x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2], w = a[3] - b[3];
    return x * x + y * y + z * z + w * w;
  }

  /** Spigoli = tutte le coppie di vertici alla distanza minima (politopi regolari). */
  function edgesByMinDistance(verts) {
    let dmin = Infinity;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = dist2(verts[i], verts[j]);
        if (d < dmin) dmin = d;
      }
    }
    const edges = [];
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        if (abs(dist2(verts[i], verts[j]) - dmin) < 1e-6) edges.push([i, j]);
      }
    }
    return edges;
  }

  /** Celle = insiemi di vertici che massimizzano il prodotto scalare con una normale. */
  function cellsByNormals(verts, normals) {
    return normals.map((n) => {
      let best = -Infinity;
      for (const v of verts) best = Math.max(best, v[0] * n[0] + v[1] * n[1] + v[2] * n[2] + v[3] * n[3]);
      const cell = [];
      verts.forEach((v, i) => {
        if (abs(v[0] * n[0] + v[1] * n[1] + v[2] * n[2] + v[3] * n[3] - best) < 1e-6) cell.push(i);
      });
      return cell;
    });
  }

  /** Politopi simpliciali: le celle sono i 4-cliques del grafo degli spigoli. */
  function cellsByCliques(nv, edges) {
    const adj = Array.from({ length: nv }, () => new Set());
    for (const [a, b] of edges) { adj[a].add(b); adj[b].add(a); }
    const cells = [];
    for (const [i, j] of edges) {
      for (const k of adj[i]) {
        if (k <= j || !adj[j].has(k)) continue;
        for (const l of adj[i]) {
          if (l <= k || !adj[j].has(l) || !adj[k].has(l)) continue;
          cells.push([i, j, k, l]);
        }
      }
    }
    return cells;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permutations(rest).forEach((p) => out.push([x].concat(p)));
    });
    return out;
  }

  function parity(p) {
    let inv = 0;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) inv++;
    return inv % 2;
  }

  function uniqueVerts(list) {
    const out = [];
    for (const v of list) {
      if (!out.some((u) => dist2(u, v) < 1e-9)) out.push(v);
    }
    return out;
  }

  /** Prepara per ogni cella gli indici degli spigoli che le appartengono. */
  function finalize(P) {
    P.cellEdges = (P.cells || []).map((cell) => {
      const set = new Set(cell);
      const idx = [];
      P.edges.forEach((e, k) => { if (set.has(e[0]) && set.has(e[1])) idx.push(k); });
      return idx;
    });
    // Raggio circoscritto (per scalare il disegno in modo uniforme)
    let r2 = 0;
    for (const v of P.verts) r2 = Math.max(r2, v[0] * v[0] + v[1] * v[1] + v[2] * v[2] + v[3] * v[3]);
    P.radius = sqrt(r2);
    return P;
  }

  /* ---------------------------------------------------------- generatori -- */
  const gen = {};

  gen.cell5 = function () {
    const s = 1 / sqrt(3.2), q = 1 / sqrt(5);
    const verts = [
      [1, 1, 1, -q], [1, -1, -1, -q], [-1, 1, -1, -q], [-1, -1, 1, -q], [0, 0, 0, 4 * q],
    ].map((v) => v.map((x) => x * s));
    const edges = [];
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) edges.push([i, j]);
    const cells = cellsByCliques(5, edges);
    return finalize({ name: '5-cell', verts, edges, cells, info: { v: 5, e: 10, f: 10, c: 5 } });
  };

  gen.tesseract = function () {
    const verts = [];
    for (let i = 0; i < 16; i++) {
      verts.push([(i & 1 ? 0.5 : -0.5), (i & 2 ? 0.5 : -0.5), (i & 4 ? 0.5 : -0.5), (i & 8 ? 0.5 : -0.5)]);
    }
    const edges = [];
    for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) if (!(i & (1 << b))) edges.push([i, i | (1 << b)]);
    const normals = [];
    for (let a = 0; a < 4; a++) for (const s of [-1, 1]) { const n = [0, 0, 0, 0]; n[a] = s; normals.push(n); }
    const cells = cellsByNormals(verts, normals);
    return finalize({ name: 'Tesseract', verts, edges, cells, info: { v: 16, e: 32, f: 24, c: 8 } });
  };

  gen.cell16 = function () {
    const verts = [];
    for (let a = 0; a < 4; a++) for (const s of [-1, 1]) { const v = [0, 0, 0, 0]; v[a] = s; verts.push(v); }
    const edges = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ((i >> 1) !== (j >> 1)) edges.push([i, j]);
    const cells = cellsByCliques(8, edges);
    return finalize({ name: '16-cell', verts, edges, cells, info: { v: 8, e: 24, f: 32, c: 16 } });
  };

  gen.cell24 = function () {
    const list = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
        const v = [0, 0, 0, 0]; v[a] = sa / sqrt(2); v[b] = sb / sqrt(2); list.push(v);
      }
    }
    const verts = list;
    const edges = edgesByMinDistance(verts);
    const normals = [];
    for (let a = 0; a < 4; a++) for (const s of [-1, 1]) { const n = [0, 0, 0, 0]; n[a] = s; normals.push(n); }
    for (let i = 0; i < 16; i++) normals.push([(i & 1 ? 0.5 : -0.5), (i & 2 ? 0.5 : -0.5), (i & 4 ? 0.5 : -0.5), (i & 8 ? 0.5 : -0.5)]);
    const cells = cellsByNormals(verts, normals);
    return finalize({ name: '24-cell', verts, edges, cells, info: { v: 24, e: 96, f: 96, c: 24 } });
  };

  gen.cell600 = function () {
    const list = [];
    for (let a = 0; a < 4; a++) for (const s of [-1, 1]) { const v = [0, 0, 0, 0]; v[a] = s; list.push(v); }
    for (let i = 0; i < 16; i++) list.push([(i & 1 ? 0.5 : -0.5), (i & 2 ? 0.5 : -0.5), (i & 4 ? 0.5 : -0.5), (i & 8 ? 0.5 : -0.5)]);
    const base = [PHI / 2, 0.5, 1 / (2 * PHI), 0];
    const perms = permutations([0, 1, 2, 3]).filter((p) => parity(p) === 0);
    for (const p of perms) {
      for (let sg = 0; sg < 8; sg++) {
        const v = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) v[p[k]] = base[k];
        // i segni valgono solo sulle tre componenti non nulle
        let bit = 0;
        for (let k = 0; k < 3; k++) { if ((sg >> bit++) & 1) v[p[k]] = -v[p[k]]; }
        list.push(v);
      }
    }
    const verts = uniqueVerts(list);
    const edges = edgesByMinDistance(verts);
    const cells = cellsByCliques(verts.length, edges);
    return finalize({ name: '600-cell', verts, edges, cells, info: { v: 120, e: 720, f: 1200, c: 600 } });
  };

  /** Duoprisma p-q: prodotto cartesiano di un p-gono e un q-gono. */
  gen.duoprism = function (p, q) {
    p = p || 8; q = q || 8;
    const verts = [], id = (i, j) => i * q + j;
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < q; j++) {
        const a = (2 * PI * i) / p, b = (2 * PI * j) / q;
        verts.push([cos(a) / sqrt(2), sin(a) / sqrt(2), cos(b) / sqrt(2), sin(b) / sqrt(2)]);
      }
    }
    const edges = [];
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < q; j++) {
        edges.push([id(i, j), id((i + 1) % p, j)]);
        edges.push([id(i, j), id(i, (j + 1) % q)]);
      }
    }
    const cells = [];
    for (let i = 0; i < p; i++) { // prismi q-gonali
      const c = []; for (let j = 0; j < q; j++) { c.push(id(i, j)); c.push(id((i + 1) % p, j)); } cells.push(c);
    }
    for (let j = 0; j < q; j++) { // prismi p-gonali
      const c = []; for (let i = 0; i < p; i++) { c.push(id(i, j)); c.push(id(i, (j + 1) % q)); } cells.push(c);
    }
    return finalize({ name: p + '-' + q + ' duoprism', verts, edges, cells, info: { v: p * q, e: 2 * p * q, f: 0, c: p + q } });
  };

  /** Fibrazione di Hopf: la 3-sfera riempita di cerchi massimi intrecciati. */
  gen.hopf = function () {
    const verts = [], edges = [];
    const etas = [PI / 10, PI / 5, (3 * PI) / 10, PI / 4 + PI / 8, PI / 2 - PI / 12];
    const NF = 14, NP = 44;
    for (const eta of etas) {
      for (let f = 0; f < NF; f++) {
        const x0 = (2 * PI * f) / NF + eta * 0.5, base = verts.length;
        for (let k = 0; k < NP; k++) {
          const t = (2 * PI * k) / NP;
          verts.push([cos(eta) * cos(x0 + t), cos(eta) * sin(x0 + t), sin(eta) * cos(t), sin(eta) * sin(t)]);
        }
        for (let k = 0; k < NP; k++) edges.push([base + k, base + ((k + 1) % NP)]);
      }
    }
    return finalize({ name: 'Hopf fibration', verts, edges, cells: [], info: { v: verts.length, e: edges.length, f: 0, c: 0 } });
  };

  HD.polytopes = {
    gen,
    list: [
      { id: 'tesseract', make: () => gen.tesseract() },
      { id: 'cell5', make: () => gen.cell5() },
      { id: 'cell16', make: () => gen.cell16() },
      { id: 'cell24', make: () => gen.cell24() },
      { id: 'cell600', make: () => gen.cell600() },
      { id: 'duoprism', make: () => gen.duoprism(8, 8) },
      { id: 'hopf', make: () => gen.hopf() },
    ],
    cache: {},
    get(id) {
      if (!this.cache[id]) this.cache[id] = this.list.find((p) => p.id === id).make();
      return this.cache[id];
    },
  };

  /* -------------------------------------------------------------- slicer -- */
  /**
   * Ruota i vertici con la matrice 4D `rot`, li scala di `scale` e li trasla di `off`.
   * Restituisce Float64Array [x,y,z,w, ...].
   */
  HD.transformVerts = function (P, rot, scale, off, out) {
    const n = P.verts.length;
    out = out && out.length === n * 4 ? out : new Float64Array(n * 4);
    const tmp = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const v = P.verts[i];
      HD.M4.applyTo(rot, v[0], v[1], v[2], v[3], tmp);
      out[i * 4] = tmp[0] * scale + off[0];
      out[i * 4 + 1] = tmp[1] * scale + off[1];
      out[i * 4 + 2] = tmp[2] * scale + off[2];
      out[i * 4 + 3] = tmp[3] * scale + off[3];
    }
    return out;
  };

  /**
   * Taglia il politopo con l'iperpiano w = s.
   * Ritorna { pts:[[x,y,z],...], polys:[{pts:[[x,y,z]...], n:[nx,ny,nz]}] }.
   * pts contiene tutti i punti di intersezione degli spigoli (anche per oggetti senza celle).
   */
  HD.slice = function (P, tv, s) {
    const ne = P.edges.length;
    const cross = new Array(ne);
    const pts = [];
    for (let k = 0; k < ne; k++) {
      const a = P.edges[k][0], b = P.edges[k][1];
      const wa = tv[a * 4 + 3] - s, wb = tv[b * 4 + 3] - s;
      if ((wa < 0) !== (wb < 0)) {
        const t = wa / (wa - wb);
        const p = [
          tv[a * 4] + (tv[b * 4] - tv[a * 4]) * t,
          tv[a * 4 + 1] + (tv[b * 4 + 1] - tv[a * 4 + 1]) * t,
          tv[a * 4 + 2] + (tv[b * 4 + 2] - tv[a * 4 + 2]) * t,
        ];
        cross[k] = p; pts.push(p);
      } else cross[k] = null;
    }
    const polys = [];
    if (pts.length >= 3 && P.cellEdges.length) {
      let cx = 0, cy = 0, cz = 0;
      for (const p of pts) { cx += p[0]; cy += p[1]; cz += p[2]; }
      cx /= pts.length; cy /= pts.length; cz /= pts.length;
      for (let ci = 0; ci < P.cellEdges.length; ci++) {
        const ce = P.cellEdges[ci];
        const cp = [];
        for (const k of ce) {
          const p = cross[k];
          if (!p) continue;
          let dup = false;
          for (const q of cp) {
            if (abs(q[0] - p[0]) < EPS && abs(q[1] - p[1]) < EPS && abs(q[2] - p[2]) < EPS) { dup = true; break; }
          }
          if (!dup) cp.push(p);
        }
        if (cp.length >= 3) {
          const poly = orderPolygon(cp, [cx, cy, cz]);
          if (poly) { poly.ci = ci; polys.push(poly); }
        }
      }
    }
    return { pts, polys };
  };

  /** Ordina i punti di un poligono convesso 3D e ne calcola la normale (verso l'esterno). */
  function orderPolygon(pts, center) {
    let mx = 0, my = 0, mz = 0;
    for (const p of pts) { mx += p[0]; my += p[1]; mz += p[2]; }
    mx /= pts.length; my /= pts.length; mz /= pts.length;
    // normale: coppia di raggi con prodotto vettoriale massimo
    let best = 0, n = null;
    const r = pts.map((p) => [p[0] - mx, p[1] - my, p[2] - mz]);
    for (let i = 0; i < r.length; i++) {
      for (let j = i + 1; j < r.length; j++) {
        const c = [
          r[i][1] * r[j][2] - r[i][2] * r[j][1],
          r[i][2] * r[j][0] - r[i][0] * r[j][2],
          r[i][0] * r[j][1] - r[i][1] * r[j][0],
        ];
        const l = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
        if (l > best) { best = l; n = c; }
      }
    }
    if (!n || best < 1e-18) return null;
    const nl = sqrt(best); n = [n[0] / nl, n[1] / nl, n[2] / nl];
    // verso l'esterno rispetto al centro della sezione
    if (n[0] * (mx - center[0]) + n[1] * (my - center[1]) + n[2] * (mz - center[2]) < 0) n = [-n[0], -n[1], -n[2]];
    // base nel piano del poligono
    let u = r[0]; let ul = sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]);
    if (ul < 1e-12) { u = r[1]; ul = sqrt(u[0] * u[0] + u[1] * u[1] + u[2] * u[2]); }
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const withAng = pts.map((p, i) => ({
      p, a: atan2(r[i][0] * v[0] + r[i][1] * v[1] + r[i][2] * v[2], r[i][0] * u[0] + r[i][1] * u[1] + r[i][2] * u[2]),
    }));
    withAng.sort((a, b) => a.a - b.a);
    return { pts: withAng.map((x) => x.p), n };
  }
})(typeof window !== 'undefined' ? window : globalThis);
