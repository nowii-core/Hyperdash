/* ============================================================================
 * HyperDimension — math4.js
 * Matematica 4D (vettori, rotazioni nei 6 piani, prodotto vettoriale 4D)
 * e utilità 3D (matrici column-major per WebGL, camera orbitale, raggi).
 * Nessuna dipendenza. Funziona nel browser (window.HD) e in Node (globalThis.HD).
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = (root.HD = root.HD || {});
  const { sin, cos, sqrt, abs, min, max, tan, PI } = Math;

  /** I sei piani di rotazione di R^4: coppie di assi (x=0, y=1, z=2, w=3). */
  HD.PLANES = [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3]];
  HD.PLANE_NAMES = ['XY', 'XZ', 'YZ', 'XW', 'YW', 'ZW'];

  /* ------------------------------------------------------------------ V4 -- */
  const V4 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s, a[3] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3],
    len: (a) => sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3]),
    dist: (a, b) => V4.len(V4.sub(a, b)),
    norm(a) { const l = V4.len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; },
    lerp: (a, b, t) => [
      a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t,
    ],
  };
  HD.V4 = V4;

  /* ------------------------------------------------------------------ M4 -- */
  /** Matrici 4x4 row-major in Float64Array. m[r*4+c]. */
  const M4 = {
    identity() {
      return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },
    mul(a, b) {
      const o = new Float64Array(16);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          o[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] +
                         a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
        }
      }
      return o;
    },
    apply(m, v) {
      return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + m[3] * v[3],
        m[4] * v[0] + m[5] * v[1] + m[6] * v[2] + m[7] * v[3],
        m[8] * v[0] + m[9] * v[1] + m[10] * v[2] + m[11] * v[3],
        m[12] * v[0] + m[13] * v[1] + m[14] * v[2] + m[15] * v[3],
      ];
    },
    /** Come apply ma scrive in `out` (niente allocazioni nel loop caldo). */
    applyTo(m, x, y, z, w, out) {
      out[0] = m[0] * x + m[1] * y + m[2] * z + m[3] * w;
      out[1] = m[4] * x + m[5] * y + m[6] * z + m[7] * w;
      out[2] = m[8] * x + m[9] * y + m[10] * z + m[11] * w;
      out[3] = m[12] * x + m[13] * y + m[14] * z + m[15] * w;
      return out;
    },
    transpose(m) {
      const o = new Float64Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[j * 4 + i] = m[i * 4 + j];
      return o;
    },
    /** Rotazione di angolo t nel piano (i,j): l'asse i ruota verso l'asse j. */
    plane(i, j, t) {
      const m = M4.identity(), c = cos(t), s = sin(t);
      m[i * 4 + i] = c; m[i * 4 + j] = -s;
      m[j * 4 + i] = s; m[j * 4 + j] = c;
      return m;
    },
    /** Rotazione composta dai 6 angoli (XY,XZ,YZ,XW,YW,ZW). */
    fromAngles(a) {
      let m = M4.identity();
      for (let k = 0; k < 6; k++) {
        if (a[k] !== 0) m = M4.mul(M4.plane(HD.PLANES[k][0], HD.PLANES[k][1], a[k]), m);
      }
      return m;
    },
    /** Gram-Schmidt sulle righe: corregge la deriva numerica. */
    orthonormalize(m) {
      const o = new Float64Array(16);
      for (let r = 0; r < 4; r++) {
        let v = [m[r * 4], m[r * 4 + 1], m[r * 4 + 2], m[r * 4 + 3]];
        for (let p = 0; p < r; p++) {
          const u = [o[p * 4], o[p * 4 + 1], o[p * 4 + 2], o[p * 4 + 3]];
          const d = V4.dot(v, u);
          v = [v[0] - d * u[0], v[1] - d * u[1], v[2] - d * u[2], v[3] - d * u[3]];
        }
        v = V4.norm(v);
        o[r * 4] = v[0]; o[r * 4 + 1] = v[1]; o[r * 4 + 2] = v[2]; o[r * 4 + 3] = v[3];
      }
      return o;
    },
    det(m) {
      // sviluppo di Laplace sulla prima riga
      let d = 0;
      for (let k = 0; k < 4; k++) {
        const idx = [0, 1, 2, 3].filter((i) => i !== k);
        const a = [1, 2, 3].map((r) => idx.map((c) => m[r * 4 + c]));
        d += (k % 2 ? -1 : 1) * m[k] * det3(a[0], a[1], a[2]);
      }
      return d;
    },
    /** Scrive m (row-major, 64 bit) in out (column-major, 32 bit) per gl.uniformMatrix4fv. */
    toGL(m, out) {
      out = out || new Float32Array(16);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out[c * 4 + r] = m[r * 4 + c];
      return out;
    },
  };
  HD.M4 = M4;

  function det3(a, b, c) {
    return a[0] * (b[1] * c[2] - b[2] * c[1]) -
           a[1] * (b[0] * c[2] - b[2] * c[0]) +
           a[2] * (b[0] * c[1] - b[1] * c[0]);
  }

  /**
   * Prodotto vettoriale generalizzato in 4D: dati tre vettori restituisce il vettore
   * perpendicolare a tutti e tre (la normale di un iperpiano). n·x = det[x;a;b;c].
   */
  HD.cross4 = function (a, b, c) {
    const n = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const idx = [0, 1, 2, 3].filter((i) => i !== k);
      const d = det3(idx.map((i) => a[i]), idx.map((i) => b[i]), idx.map((i) => c[i]));
      n[k] = (k % 2 ? -1 : 1) * d;
    }
    return n;
  };

  /* ------------------------------------------------------------------ M3 -- */
  /** Matrici 4x4 column-major (Float32Array) per la parte 3D / WebGL. */
  const M3 = {
    perspective(fovy, aspect, near, far, o) {
      o = o || new Float32Array(16);
      const f = 1 / tan(fovy / 2), nf = 1 / (near - far);
      o.fill(0);
      o[0] = f / aspect; o[5] = f;
      o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
      return o;
    },
    lookAt(eye, c, up, o) {
      o = o || new Float32Array(16);
      let zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
      let l = sqrt(zx * zx + zy * zy + zz * zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = sqrt(xx * xx + xy * xy + xz * xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
      o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
      o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
      o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
      o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
      o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
      o[15] = 1;
      return o;
    },
    mul(a, b, o) {
      o = o || new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                         a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
      }
      return o;
    },
  };
  HD.M3 = M3;

  /* -------------------------------------------------------- OrbitCamera -- */
  class OrbitCamera {
    constructor(o) {
      o = o || {};
      this.yaw = o.yaw !== undefined ? o.yaw : 0.7;
      this.pitch = o.pitch !== undefined ? o.pitch : 0.35;
      this.dist = o.dist || 6;
      this.minDist = o.minDist || 1.5;
      this.maxDist = o.maxDist || 40;
      this.target = (o.target || [0, 0, 0]).slice();
      this.fov = o.fov || (55 * PI) / 180;
      this.near = 0.05;
      this.far = 300;
      this.proj = new Float32Array(16);
      this.view = new Float32Array(16);
      this.vp = new Float32Array(16);
      this.eyePos = [0, 0, 0];
      this.aspect = 1;
    }
    eye() {
      const cp = cos(this.pitch);
      return [
        this.target[0] + this.dist * cp * sin(this.yaw),
        this.target[1] + this.dist * sin(this.pitch),
        this.target[2] + this.dist * cp * cos(this.yaw),
      ];
    }
    update(aspect) {
      this.aspect = aspect;
      this.eyePos = this.eye();
      M3.perspective(this.fov, aspect, this.near, this.far, this.proj);
      M3.lookAt(this.eyePos, this.target, [0, 1, 0], this.view);
      M3.mul(this.proj, this.view, this.vp);
    }
    /** Base ortonormale della camera: avanti, destra, su. */
    basis() {
      const e = this.eye(), t = this.target;
      let fx = t[0] - e[0], fy = t[1] - e[1], fz = t[2] - e[2];
      let l = sqrt(fx * fx + fy * fy + fz * fz) || 1; fx /= l; fy /= l; fz /= l;
      let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0; // f x up(0,1,0)
      l = sqrt(rx * rx + ry * ry + rz * rz) || 1; rx /= l; ry /= l; rz /= l;
      const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
      return { f: [fx, fy, fz], r: [rx, ry, rz], u: [ux, uy, uz] };
    }
    /** Raggio dal pixel in coordinate normalizzate (-1..1). */
    ray(nx, ny) {
      const b = this.basis(), th = tan(this.fov / 2);
      const d = [
        b.f[0] + b.r[0] * nx * th * this.aspect + b.u[0] * ny * th,
        b.f[1] + b.r[1] * nx * th * this.aspect + b.u[1] * ny * th,
        b.f[2] + b.r[2] * nx * th * this.aspect + b.u[2] * ny * th,
      ];
      const l = sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]) || 1;
      return { o: this.eyePos.slice(), d: [d[0] / l, d[1] / l, d[2] / l] };
    }
    orbit(dx, dy) {
      this.yaw -= dx * 0.0065;
      this.pitch = max(-1.5, min(1.5, this.pitch + dy * 0.0065));
    }
    zoom(f) { this.dist = max(this.minDist, min(this.maxDist, this.dist * f)); }
    pan(dx, dy) {
      const b = this.basis(), k = this.dist * 0.0016;
      for (let i = 0; i < 3; i++) this.target[i] += (-b.r[i] * dx + b.u[i] * dy) * k;
    }
  }
  HD.OrbitCamera = OrbitCamera;

  /** Intersezione raggio / AABB 3D (metodo degli slab). Ritorna t o -1. */
  HD.rayAABB = function (o, d, bmin, bmax) {
    let t0 = 0, t1 = Infinity;
    for (let i = 0; i < 3; i++) {
      if (abs(d[i]) < 1e-9) {
        if (o[i] < bmin[i] || o[i] > bmax[i]) return -1;
      } else {
        let a = (bmin[i] - o[i]) / d[i], b = (bmax[i] - o[i]) / d[i];
        if (a > b) { const t = a; a = b; b = t; }
        t0 = max(t0, a); t1 = min(t1, b);
        if (t0 > t1) return -1;
      }
    }
    return t0;
  };

  HD.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  HD.lerp = (a, b, t) => a + (b - a) * t;
  HD.TAU = PI * 2;
})(typeof window !== 'undefined' ? window : globalThis);
