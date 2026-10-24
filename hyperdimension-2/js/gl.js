/* ============================================================================
 * HyperDimension — gl.js
 * Renderer WebGL2 scritto da zero (nessuna libreria):
 *   • linee spesse con glow (istanziate, espanse nel vertex shader)
 *   • triangoli con griglia neon e vetro fresnel
 *   • sfere istanziate il cui motivo è funzione delle coordinate 4D locali
 *   • punti luminosi, sfondo procedurale con stelle e pavimento a griglia
 *   • post-processing: MSAA, bloom a 2 livelli, tone-mapping, aberrazione cromatica
 * ========================================================================== */
(function (root) {
  'use strict';
  const HD = root.HD;

  /* ---------------------------------------------------------- helper GL -- */
  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      throw new Error('Shader compile error:\n' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    }
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, '#version 300 es\n' + vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program link error: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  /** Buffer dinamico con crescita automatica. */
  class Dyn {
    constructor(gl, stride) {
      this.gl = gl; this.stride = stride; this.cap = 1024; this.arr = new Float32Array(this.cap * stride);
      this.n = 0; this.buf = gl.createBuffer(); this.gpuCap = 0;
    }
    clear() { this.n = 0; }
    ensure(extra) {
      if (this.n + extra <= this.cap) return;
      while (this.n + extra > this.cap) this.cap *= 2;
      const a = new Float32Array(this.cap * this.stride); a.set(this.arr.subarray(0, this.n * this.stride)); this.arr = a;
    }
    upload() {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const used = this.n * this.stride;
      if (this.arr.length > this.gpuCap) { gl.bufferData(gl.ARRAY_BUFFER, this.arr.byteLength, gl.DYNAMIC_DRAW); this.gpuCap = this.arr.length; }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.arr, 0, used);
    }
  }

  /* ------------------------------------------------------------- shader -- */
  const GLSL = {};

  GLSL.fsq_vs = `
    out vec2 vUv;
    void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

  GLSL.bg_fs = `
    in vec2 vUv; out vec4 o;
    uniform vec3 uPos, uF, uR, uU; uniform float uTan, uAspect, uTime, uFloor, uShowFloor, uGlow;
    uniform vec3 uTop, uBot;
    float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    void main(){
      vec2 ndc = vUv*2.0-1.0;
      vec3 d = normalize(uF + uR*ndc.x*uTan*uAspect + uU*ndc.y*uTan);
      float h = d.y*0.5+0.5;
      vec3 col = mix(uBot, uTop, smoothstep(0.0,1.0,h));
      col += uGlow*vec3(0.035,0.018,0.085)*exp(-abs(d.y)*6.0);
      // stelle
      vec3 q = d*140.0; vec3 id = floor(q); float st = hash(id);
      if (st>0.9965){ vec3 f = fract(q)-0.5; float b = smoothstep(0.35,0.0,length(f))*(0.5+0.5*sin(uTime*(1.0+st*4.0)+st*40.0)); col += b*vec3(0.6,0.8,1.0)*(st-0.9965)*220.0; }
      if (uShowFloor>0.5 && d.y<-0.0005){
        float t = (uFloor-uPos.y)/d.y;
        if (t>0.0){
          vec3 p = uPos + d*t; vec2 g = p.xz;
          vec2 gr = abs(fract(g-0.5)-0.5)/fwidth(g);
          float l = 1.0-min(min(gr.x,gr.y),1.0);
          vec2 gr5 = abs(fract(g/5.0-0.5)-0.5)/fwidth(g/5.0);
          float l5 = 1.0-min(min(gr5.x,gr5.y),1.0);
          float fade = exp(-t*0.035);
          col += (l*0.16+l5*0.38)*vec3(0.25,0.7,1.0)*fade;
          col = mix(col, uBot*0.6, 0.55*(1.0-fade));
        }
      }
      o = vec4(col,1.0);
    }`;

  GLSL.line_vs = `
    layout(location=0) in vec2 aC;
    layout(location=1) in vec3 iA; layout(location=2) in vec3 iB;
    layout(location=3) in vec4 iCA; layout(location=4) in vec4 iCB; layout(location=5) in float iW;
    uniform mat4 uVP; uniform vec2 uRes;
    out vec4 vC; out float vE;
    void main(){
      vec4 ca = uVP*vec4(iA,1.0), cb = uVP*vec4(iB,1.0);
      const float NEAR = 0.05;
      if (ca.w<NEAR && cb.w<NEAR){ gl_Position = vec4(2.0,2.0,2.0,1.0); vC=vec4(0); vE=0.0; return; }
      if (ca.w<NEAR) ca = mix(ca,cb,(NEAR-ca.w)/(cb.w-ca.w));
      if (cb.w<NEAR) cb = mix(cb,ca,(NEAR-cb.w)/(ca.w-cb.w));
      vec2 sa = ca.xy/ca.w*uRes*0.5, sb = cb.xy/cb.w*uRes*0.5;
      vec2 d = sb-sa; float l = length(d); d = l>1e-4 ? d/l : vec2(1.0,0.0);
      vec2 n = vec2(-d.y,d.x);
      bool isB = aC.x>0.5; vec4 c = isB?cb:ca; vec2 s = isB?sb:sa;
      float w = iW + 1.5;
      s += n*aC.y*w*0.5 + d*(isB?1.0:-1.0)*w*0.5;
      gl_Position = vec4(s/(uRes*0.5)*c.w, c.z, c.w);
      vC = mix(iCA,iCB,aC.x); vE = aC.y;
    }`;
  GLSL.line_fs = `
    in vec4 vC; in float vE; out vec4 o;
    void main(){ float a = 1.0-smoothstep(0.25,1.0,abs(vE)); o = vec4(vC.rgb*vC.a*a, 0.0); }`;

  GLSL.tri_vs = `
    layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec4 aC;
    uniform mat4 uVP; out vec3 vP; out vec3 vN; out vec4 vC;
    void main(){ vP=aP; vN=aN; vC=aC; gl_Position = uVP*vec4(aP,1.0); }`;
  GLSL.tri_fs = `
    in vec3 vP; in vec3 vN; in vec4 vC; out vec4 o;
    uniform vec3 uCam; uniform float uMode, uTime, uGridScale; uniform vec3 uFogCol; uniform float uFog;
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(uCam-vP);
      if (dot(N,V)<0.0) N=-N;
      float nv = max(dot(N,V),0.0); float fres = pow(1.0-nv,2.5);
      float dist = length(uCam-vP); float fog = exp(-dist*uFog);
      if (uMode<0.5){
        vec3 L = normalize(vec3(0.35,0.85,0.4));
        float dif = max(dot(N,L),0.0)*0.55+0.30;
        vec3 an = abs(N);
        vec2 uv = (an.x>an.y&&an.x>an.z)? vP.yz : (an.y>an.z? vP.xz : vP.xy);
        vec2 g = uv*uGridScale; vec2 gr = abs(fract(g-0.5)-0.5)/fwidth(g);
        float line = 1.0-min(min(gr.x,gr.y),1.0);
        vec3 col = vC.rgb*0.16*dif + vC.rgb*(0.65*line + 0.55*fres);
        col = mix(uFogCol, col, fog);
        o = vec4(col, 1.0);
      } else {
        float a = vC.a*(0.22+0.78*fres);
        vec3 col = vC.rgb*(0.5+1.4*fres);
        o = vec4(col*a, a);
      }
    }`;

  GLSL.pt_vs = `
    layout(location=0) in vec3 aP; layout(location=1) in vec4 aC; layout(location=2) in float aS;
    uniform mat4 uVP; uniform float uScale; out vec4 vC;
    void main(){ vec4 c = uVP*vec4(aP,1.0); gl_Position = c; gl_PointSize = clamp(aS*uScale/max(c.w,0.1), 1.0, 220.0); vC=aC; }`;
  GLSL.pt_fs = `
    in vec4 vC; out vec4 o;
    void main(){ vec2 q = gl_PointCoord*2.0-1.0; float d = dot(q,q); if(d>1.0) discard; float a = exp(-d*3.2); o = vec4(vC.rgb*vC.a*a, 0.0); }`;

  GLSL.sph_vs = `
    layout(location=0) in vec3 aP;
    layout(location=1) in vec3 iC; layout(location=2) in float iR; layout(location=3) in float iDw; layout(location=4) in float iHue;
    layout(location=5) in vec4 iM0; layout(location=6) in vec4 iM1; layout(location=7) in vec4 iM2; layout(location=8) in vec4 iM3;
    uniform mat4 uVP; out vec3 vN; out vec3 vP; out vec4 vU; out float vHue;
    void main(){
      vec3 p = iC + aP*iR; vP = p; vN = aP;
      mat4 M = mat4(iM0,iM1,iM2,iM3);
      float r4 = sqrt(iR*iR + iDw*iDw);
      vU = (M*vec4(aP*iR, iDw))/max(r4,1e-4);
      vHue = iHue;
      gl_Position = uVP*vec4(p,1.0);
    }`;
  GLSL.sph_fs = `
    in vec3 vN; in vec3 vP; in vec4 vU; in float vHue; out vec4 o;
    uniform vec3 uCam; uniform float uTime;
    vec3 pal(float t){ return 0.5+0.5*cos(6.28318*(t+vec3(0.0,0.33,0.67))); }
    void main(){
      vec3 N = normalize(vN); vec3 V = normalize(uCam-vP);
      float nv = max(dot(N,V),0.0); float fres = pow(1.0-nv,2.2);
      vec4 u = vU*6.0;
      vec4 g = abs(fract(u-0.5)-0.5)/max(fwidth(u),vec4(1e-4));
      float l = 1.0-min(min(g.x,g.y),min(g.z,g.w));
      vec3 base = pal(vHue + vU.w*0.35);
      float dif = max(dot(N,normalize(vec3(0.35,0.85,0.4))),0.0)*0.6+0.25;
      vec3 col = base*0.28*dif + base*l*0.95 + vec3(0.8,0.9,1.0)*fres*0.7;
      o = vec4(col,1.0);
    }`;

  GLSL.bright_fs = `
    in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform float uThr;
    void main(){ vec3 c = texture(uT,vUv).rgb; float l = max(c.r,max(c.g,c.b)); float k = clamp((l-uThr)/(uThr*0.8+1e-3),0.0,1.0); o = vec4(c*k*k,1.0); }`;
  GLSL.blur_fs = `
    in vec2 vUv; out vec4 o; uniform sampler2D uT; uniform vec2 uDir;
    void main(){
      vec3 c = texture(uT,vUv).rgb*0.2270270270;
      c += (texture(uT,vUv+uDir*1.3846153846).rgb + texture(uT,vUv-uDir*1.3846153846).rgb)*0.3162162162;
      c += (texture(uT,vUv+uDir*3.2307692308).rgb + texture(uT,vUv-uDir*3.2307692308).rgb)*0.0702702703;
      o = vec4(c,1.0);
    }`;
  GLSL.comp_fs = `
    in vec2 vUv; out vec4 o;
    uniform sampler2D uS, uB1, uB2; uniform float uBloom, uAb, uTime, uVig, uExposure;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 d = vUv-0.5; float r2 = dot(d,d);
      vec2 off = d*r2*uAb;
      vec3 s = vec3(texture(uS,vUv+off).r, texture(uS,vUv).g, texture(uS,vUv-off).b);
      vec3 b = texture(uB1,vUv).rgb*0.9 + texture(uB2,vUv).rgb*1.3;
      vec3 c = (s + b*uBloom)*uExposure;
      c = aces(c);
      c *= 1.0 - uVig*r2*1.6;
      float n = fract(sin(dot(vUv*vec2(1731.0,947.0)+uTime,vec2(12.9898,78.233)))*43758.5453);
      c += (n-0.5)/255.0;
      o = vec4(pow(c,vec3(1.0/2.2)),1.0);
    }`;

  /* --------------------------------------------------------- icosfera -- */
  function icosphere(level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
      .map((p) => { const l = Math.hypot(p[0], p[1], p[2]); return [p[0] / l, p[1] / l, p[2] / l]; });
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let i = 0; i < level; i++) {
      const cache = new Map(), nf = [];
      const mid = (a, b) => {
        const k = a < b ? a + '_' + b : b + '_' + a;
        if (cache.has(k)) return cache.get(k);
        const m = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2];
        const l = Math.hypot(m[0], m[1], m[2]); v.push([m[0] / l, m[1] / l, m[2] / l]);
        cache.set(k, v.length - 1); return v.length - 1;
      };
      for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      f = nf;
    }
    const pos = new Float32Array(v.length * 3); v.forEach((p, i) => pos.set(p, i * 3));
    const idx = new Uint16Array(f.length * 3); f.forEach((t3, i) => idx.set(t3, i * 3));
    return { pos, idx };
  }

  /* ------------------------------------------------------------ Renderer -- */
  class Renderer {
    constructor(canvas, opts) {
      opts = opts || {};
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
      if (!gl) throw new Error('WebGL2 non disponibile');
      this.gl = gl; this.canvas = canvas;
      this.quality = opts.quality || 1;
      this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('EXT_color_buffer_half_float');
      gl.getExtension('OES_texture_float_linear');
      this.time = 0; this.bloom = 0.6; this.ab = 0.010; this.vig = 0.55; this.exposure = 1.0;
      this._build();
      this.resize();
    }

    _build() {
      const gl = this.gl;
      this.pBg = program(gl, GLSL.fsq_vs, GLSL.bg_fs);
      this.pLine = program(gl, GLSL.line_vs, GLSL.line_fs);
      this.pTri = program(gl, GLSL.tri_vs, GLSL.tri_fs);
      this.pPt = program(gl, GLSL.pt_vs, GLSL.pt_fs);
      this.pSph = program(gl, GLSL.sph_vs, GLSL.sph_fs);
      this.pBright = program(gl, GLSL.fsq_vs, GLSL.bright_fs);
      this.pBlur = program(gl, GLSL.fsq_vs, GLSL.blur_fs);
      this.pComp = program(gl, GLSL.fsq_vs, GLSL.comp_fs);
      this.emptyVao = gl.createVertexArray();

      // linee
      this.lines = new Dyn(gl, 15);
      this.vaoLine = gl.createVertexArray(); gl.bindVertexArray(this.vaoLine);
      const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lines.buf);
      const S = 60;
      [[1, 3, 0], [2, 3, 12], [3, 4, 24], [4, 4, 40], [5, 1, 56]].forEach(([loc, n, off]) => {
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, S, off); gl.vertexAttribDivisor(loc, 1);
      });

      // triangoli: opaco e vetro
      this.tris = new Dyn(gl, 10); this.glass = new Dyn(gl, 10);
      this.vaoTri = this._triVao(this.tris); this.vaoGlass = this._triVao(this.glass);

      // punti
      this.pts = new Dyn(gl, 8);
      this.vaoPt = gl.createVertexArray(); gl.bindVertexArray(this.vaoPt); gl.bindBuffer(gl.ARRAY_BUFFER, this.pts.buf);
      [[0, 3, 0], [1, 4, 12], [2, 1, 28]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 32, off); });

      // sfere istanziate
      const ico = icosphere(3);
      this.icoCount = ico.idx.length;
      this.spheres = new Dyn(gl, 24);
      this.vaoSph = gl.createVertexArray(); gl.bindVertexArray(this.vaoSph);
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, ico.pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ico.idx, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spheres.buf);
      [[1, 3, 0], [2, 1, 12], [3, 1, 16], [4, 1, 20], [5, 4, 24], [6, 4, 40], [7, 4, 56], [8, 4, 72]].forEach(([loc, n, off]) => {
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 96, off); gl.vertexAttribDivisor(loc, 1);
      });
      gl.bindVertexArray(null);
    }

    _triVao(dyn) {
      const gl = this.gl, v = gl.createVertexArray();
      gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, dyn.buf);
      [[0, 3, 0], [1, 3, 12], [2, 4, 24]].forEach(([loc, n, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 40, off); });
      return v;
    }

    /* ---------------------------------------------------- framebuffers -- */
    _tex(w, h, fmt) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (fmt === 'f16') gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    _fbo(tex) {
      const gl = this.gl, f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return f;
    }

    resize() {
      const gl = this.gl, c = this.canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.quality;
      const w = Math.max(2, Math.floor(c.clientWidth * dpr)), h = Math.max(2, Math.floor(c.clientHeight * dpr));
      if (w === this.w && h === this.h) return;
      c.width = w; c.height = h; this.w = w; this.h = h; this.px = w / Math.max(1, c.clientWidth);
      // distruggi vecchie risorse
      if (this.res) { for (const k of this.res.del) k(); }
      const del = [];
      let fmt = this.floatOK ? 'f16' : 'u8';
      let sceneTex = this._tex(w, h, fmt), sceneFbo = this._fbo(sceneTex);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteTexture(sceneTex); gl.deleteFramebuffer(sceneFbo); fmt = 'u8'; this.floatOK = false;
        sceneTex = this._tex(w, h, fmt); sceneFbo = this._fbo(sceneTex);
      }
      // MSAA
      let msFbo = null;
      try {
        const rbC = gl.createRenderbuffer(), rbD = gl.createRenderbuffer();
        const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbC);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, fmt === 'f16' ? gl.RGBA16F : gl.RGBA8, w, h);
        gl.bindRenderbuffer(gl.RENDERBUFFER, rbD);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
        msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbC);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('ms');
        del.push(() => { gl.deleteRenderbuffer(rbC); gl.deleteRenderbuffer(rbD); gl.deleteFramebuffer(msFbo); });
      } catch (e) {
        msFbo = null;
        const rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbD);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFbo);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
        del.push(() => gl.deleteRenderbuffer(rbD));
      }
      const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1), qw = Math.max(2, w >> 2), qh = Math.max(2, h >> 2);
      const mk = (ww, hh2) => { const t = this._tex(ww, hh2, fmt), f = this._fbo(t); del.push(() => { gl.deleteTexture(t); gl.deleteFramebuffer(f); }); return { t, f, w: ww, h: hh2 }; };
      const A = mk(hw, hh), B = mk(hw, hh), C = mk(qw, qh), D = mk(qw, qh);
      del.push(() => { gl.deleteTexture(sceneTex); gl.deleteFramebuffer(sceneFbo); });
      this.res = { sceneTex, sceneFbo, msFbo, A, B, C, D, del };
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    /* ------------------------------------------------------- frame API -- */
    begin(cam, time, bg) {
      const gl = this.gl;
      this.resize();
      this.time = time; this.cam = cam; this.bgOpts = bg || {};
      this.lines.clear(); this.tris.clear(); this.glass.clear(); this.pts.clear(); this.spheres.clear();
    }

    /** Converte pixel CSS in pixel fisici. */
    lw(css) { return css * (this.px || 1); }

    /** Linea: a,b in 3D; ca,cb = [r,g,b,a]; width in pixel. */
    line(a, b, ca, cb, width) {
      const L = this.lines; L.ensure(1);
      const o = L.n * 15, A = L.arr;
      A[o] = a[0]; A[o + 1] = a[1]; A[o + 2] = a[2]; A[o + 3] = b[0]; A[o + 4] = b[1]; A[o + 5] = b[2];
      A[o + 6] = ca[0]; A[o + 7] = ca[1]; A[o + 8] = ca[2]; A[o + 9] = ca[3];
      A[o + 10] = cb[0]; A[o + 11] = cb[1]; A[o + 12] = cb[2]; A[o + 13] = cb[3];
      A[o + 14] = width || 1.5; L.n++;
    }
    /** Punto luminoso. */
    point(p, c, size) {
      const P = this.pts; P.ensure(1); const o = P.n * 8, A = P.arr;
      A[o] = p[0]; A[o + 1] = p[1]; A[o + 2] = p[2]; A[o + 3] = c[0]; A[o + 4] = c[1]; A[o + 5] = c[2]; A[o + 6] = c[3]; A[o + 7] = size; P.n++;
    }
    /** Triangolo (3 vertici, normale unica, colore). target: 'opaque' | 'glass'. */
    tri(p0, p1, p2, n, col, target) {
      const D = target === 'glass' ? this.glass : this.tris; D.ensure(3);
      const A = D.arr; let o = D.n * 10;
      for (const p of [p0, p1, p2]) {
        A[o++] = p[0]; A[o++] = p[1]; A[o++] = p[2]; A[o++] = n[0]; A[o++] = n[1]; A[o++] = n[2];
        A[o++] = col[0]; A[o++] = col[1]; A[o++] = col[2]; A[o++] = col[3];
      }
      D.n += 3;
    }
    /** Poligono convesso come ventaglio di triangoli. */
    poly(pts, n, col, target) {
      for (let i = 1; i < pts.length - 1; i++) this.tri(pts[0], pts[i], pts[i + 1], n, col, target);
    }
    /** Parallelepipedo allineato agli assi: facce + (opz.) spigoli luminosi. */
    box(mn, mx, col, edgeCol, edgeW, target) {
      const [x0, y0, z0] = mn, [x1, y1, z1] = mx;
      const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const F = [[[0, 3, 2, 1], [0, 0, -1]], [[4, 5, 6, 7], [0, 0, 1]], [[0, 4, 7, 3], [-1, 0, 0]], [[1, 2, 6, 5], [1, 0, 0]], [[0, 1, 5, 4], [0, -1, 0]], [[3, 7, 6, 2], [0, 1, 0]]];
      if (col) for (const [q, n] of F) { this.tri(v[q[0]], v[q[1]], v[q[2]], n, col, target); this.tri(v[q[0]], v[q[2]], v[q[3]], n, col, target); }
      if (edgeCol) {
        const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (const [a, b] of E) this.line(v[a], v[b], edgeCol, edgeCol, edgeW || 2);
      }
    }
    /** Sfera con motivo 4D. rot = M4 (row-major) dell'orientazione. */
    sphere(c, rho, dw, hue, rot) {
      const S = this.spheres; S.ensure(1); const A = S.arr, o = S.n * 24;
      A[o] = c[0]; A[o + 1] = c[1]; A[o + 2] = c[2]; A[o + 3] = rho; A[o + 4] = dw; A[o + 5] = hue;
      // M = Rᵀ in column-major per GLSL: colonna j di M = riga j di Rᵀ^T... M*v = Rᵀ v → M[r][c] = R[c][r]; GLSL column-major: elemento (c*4+r) = M[r][c] = R[c][r] = rot[c*4+r]
      // quindi basta copiare rot (row-major) così com'è: A[o+6+c*4+r] = rot[c*4+r]
      for (let i = 0; i < 16; i++) A[o + 6 + i] = rot[i];
      A[o + 22] = 0; A[o + 23] = 0;
      S.n++;
    }

    /* ------------------------------------------------------------ draw -- */
    end() {
      const gl = this.gl, R = this.res, cam = this.cam, bg = this.bgOpts;
      const target = R.msFbo || R.sceneFbo;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, this.w, this.h);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.depthMask(true);
      gl.clearColor(0, 0, 0, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // sfondo
      {
        const p = this.pBg; gl.useProgram(p.p);
        const b = cam.basis(), u = p.u;
        gl.uniform3fv(u.uPos, cam.eyePos); gl.uniform3fv(u.uF, b.f); gl.uniform3fv(u.uR, b.r); gl.uniform3fv(u.uU, b.u);
        gl.uniform1f(u.uTan, Math.tan(cam.fov / 2)); gl.uniform1f(u.uAspect, cam.aspect); gl.uniform1f(u.uTime, this.time);
        gl.uniform1f(u.uFloor, bg.floorY !== undefined ? bg.floorY : 0); gl.uniform1f(u.uShowFloor, bg.floor ? 1 : 0);
        gl.uniform1f(u.uGlow, bg.glow !== undefined ? bg.glow : 1);
        gl.uniform3fv(u.uTop, bg.top || [0.012, 0.016, 0.05]); gl.uniform3fv(u.uBot, bg.bot || [0.003, 0.004, 0.012]);
        gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      const fogCol = bg.bot || [0.003, 0.004, 0.012];

      // opaco
      if (this.tris.n) {
        const p = this.pTri; gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uVP, false, cam.vp); gl.uniform3fv(p.u.uCam, cam.eyePos);
        gl.uniform1f(p.u.uMode, 0); gl.uniform1f(p.u.uTime, this.time); gl.uniform1f(p.u.uGridScale, bg.gridScale || 1);
        gl.uniform3fv(p.u.uFogCol, fogCol); gl.uniform1f(p.u.uFog, bg.fog !== undefined ? bg.fog : 0.012);
        this.tris.upload(); gl.bindVertexArray(this.vaoTri); gl.drawArrays(gl.TRIANGLES, 0, this.tris.n);
      }
      // sfere
      if (this.spheres.n) {
        const p = this.pSph; gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uVP, false, cam.vp); gl.uniform3fv(p.u.uCam, cam.eyePos); gl.uniform1f(p.u.uTime, this.time);
        this.spheres.upload(); gl.bindVertexArray(this.vaoSph);
        gl.drawElementsInstanced(gl.TRIANGLES, this.icoCount, gl.UNSIGNED_SHORT, 0, this.spheres.n);
      }
      // trasparenti (vetro, linee, punti): senza scrittura di profondità
      gl.depthMask(false); gl.enable(gl.BLEND);
      if (this.glass.n) {
        const p = this.pTri; gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uVP, false, cam.vp); gl.uniform3fv(p.u.uCam, cam.eyePos);
        gl.uniform1f(p.u.uMode, 1); gl.uniform1f(p.u.uFog, 0);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        this.glass.upload(); gl.bindVertexArray(this.vaoGlass); gl.drawArrays(gl.TRIANGLES, 0, this.glass.n);
      }
      gl.blendFunc(gl.ONE, gl.ONE);
      if (this.lines.n) {
        const p = this.pLine; gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uVP, false, cam.vp); gl.uniform2f(p.u.uRes, this.w, this.h);
        // lo spessore è espresso in pixel CSS: scala col rapporto dei pixel fisici
        this.lines.upload(); gl.bindVertexArray(this.vaoLine);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.lines.n);
      }
      if (this.pts.n) {
        const p = this.pPt; gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.uVP, false, cam.vp); gl.uniform1f(p.u.uScale, this.h * 0.5 / Math.tan(cam.fov / 2) * 0.012);
        this.pts.upload(); gl.bindVertexArray(this.vaoPt); gl.drawArrays(gl.POINTS, 0, this.pts.n);
      }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.disable(gl.DEPTH_TEST);

      // risolve MSAA
      if (R.msFbo) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.sceneFbo);
        gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      }

      // bloom
      const pass = (prog, dst, setup) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
        gl.viewport(0, 0, dst ? dst.w : this.w, dst ? dst.h : this.h);
        gl.useProgram(prog.p); setup(prog.u);
        gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      const bind = (unit, tex, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); };
      pass(this.pBright, R.A, (u) => { bind(0, R.sceneTex, u.uT); gl.uniform1f(u.uThr, 0.8); });
      const blur = (src, dst, w, h, dx, dy) => pass(this.pBlur, dst, (u) => { bind(0, src.t, u.uT); gl.uniform2f(u.uDir, dx / w, dy / h); });
      blur(R.A, R.B, R.A.w, R.A.h, 1.4, 0); blur(R.B, R.A, R.A.w, R.A.h, 0, 1.4);
      blur(R.A, R.C, R.C.w, R.C.h, 2.2, 0); blur(R.C, R.D, R.C.w, R.C.h, 0, 2.2);
      blur(R.D, R.C, R.C.w, R.C.h, 2.2, 0); blur(R.C, R.D, R.C.w, R.C.h, 0, 2.2);
      pass(this.pComp, null, (u) => {
        bind(0, R.sceneTex, u.uS); bind(1, R.A.t, u.uB1); bind(2, R.D.t, u.uB2);
        gl.uniform1f(u.uBloom, this.bloom); gl.uniform1f(u.uAb, this.ab); gl.uniform1f(u.uTime, this.time % 7);
        gl.uniform1f(u.uVig, this.vig); gl.uniform1f(u.uExposure, this.exposure);
      });
    }
  }

  HD.Renderer = Renderer;

  /* ------------------------------------------------------------- colori -- */
  /** Palette: hue 0..1 → [r,g,b] */
  HD.hsv = function (h, s, v) {
    h = ((h % 1) + 1) % 1;
    const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t];
      case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q];
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
