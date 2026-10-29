// WebGL glass renderer, no libraries. One background pass, one quad per bubble,
// one point batch for droplets. Each bubble shader does refraction of the
// backdrop, the icon inside, a thin iridescent film, rim light and highlights.
import { hash } from './field.js';
import { drawPlaceholder, drawIconImage, loadIcon } from './icons.js';

const KIND = { live: 0, building: 1, soon: 2 };
const TILE = 256, COLS = 4, ROWS = 2;

const VS_BG = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`;
const FS_BG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uBg;
uniform float uTime;
void main() {
  vec2 uv = vUv + vec2(sin(uTime * 0.05), cos(uTime * 0.04)) * 0.006;
  vec3 c = texture2D(uBg, uv).rgb;
  float sweep = exp(-pow((vUv.x + vUv.y * 0.35) - fract(uTime * 0.025) * 2.2 + 0.4, 2.0) * 18.0);
  c += vec3(0.02, 0.025, 0.035) * sweep;
  gl_FragColor = vec4(c, 1.0);
}`;

const VS_B = `
attribute vec2 aPos;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uR;
uniform float uExt;
varying vec2 vP;
void main() {
  vP = aPos * uExt;
  vec2 px = uCenter + vec2(vP.x, -vP.y) * uR;
  gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS_B = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vP;
uniform sampler2D uBg;
uniform sampler2D uAtlas;
uniform vec2 uRes;
uniform float uR;
uniform float uTime;
uniform float uSeed;
uniform float uKind;
uniform float uPop;
uniform float uWobble;
uniform float uGlow;
uniform float uAlpha;
uniform vec4 uTile;
uniform float uSpan;
uniform vec3 uTint;
void main() {
  vec2 p = vP;
  float ang = atan(p.y, p.x);
  float wob = 1.0 + uWobble * (0.055 * sin(3.0 * ang + uTime * 13.0 + uSeed) + 0.03 * sin(5.0 * ang - uTime * 9.0));
  float sc = wob * (1.0 + 0.22 * uPop);
  vec2 q = p / sc;
  float d = length(q);
  float aa = 1.6 / (uR * sc);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0, d);
  float live = 1.0 - step(0.5, uKind);
  float frost = step(1.5, uKind);
  float bright = live + (1.0 - live) * mix(0.8, 0.55, frost);

  // soft halo outside the glass (additive: alpha stays 0)
  float halo = exp(-max(d - 1.0, 0.0) * 6.0) * (1.0 - cov) * (1.0 - smoothstep(1.15, 1.44, length(p))) * (0.05 + 0.22 * live + 0.22 * uGlow) * (1.0 - uPop);
  vec3 outC = uTint * halo * uAlpha;
  if (cov <= 0.0) { gl_FragColor = vec4(outC, 0.0); return; }

  float dd = min(d, 0.999);
  float nz = sqrt(1.0 - dd * dd);
  vec3 n = vec3(q, nz);
  vec2 suv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);

  // refraction: the backdrop bends and flips toward the edge, frosted ones blur it
  vec2 off = -q * (1.0 - nz) * 1.25 * vec2(uR / uRes.x, -uR / uRes.y);
  vec3 col = texture2D(uBg, suv + off, frost * 3.2).rgb;
  col *= mix(1.0, 1.35, live);
  col += uTint * (0.025 + 0.05 * (1.0 - nz)) * bright;
  col = mix(col, vec3(0.62, 0.68, 0.76), frost * 0.13);

  // the icon, seen through the front surface (slight lens bulge)
  vec2 iq = q * (1.0 - 0.12 * (1.0 - nz));
  vec2 iuv = vec2(0.5 + iq.x / (2.0 * uSpan), 0.5 - iq.y / (2.0 * uSpan));
  if (iuv.x > 0.0 && iuv.x < 1.0 && iuv.y > 0.0 && iuv.y < 1.0) {
    vec4 ic = texture2D(uAtlas, uTile.xy + iuv * uTile.zw, frost * 0.8);
    float lum = dot(ic.rgb, vec3(0.299, 0.587, 0.114));
    ic.rgb = mix(ic.rgb, vec3(lum) * ic.a, frost * 0.45);
    float m = mix(1.0, 0.6, frost) * (1.0 - uPop);
    col = col * (1.0 - ic.a * m) + ic.rgb * m;
  }

  // thin iridescent film
  float fres = pow(1.0 - nz, 2.2);
  float th = 0.55 * nz + 0.22 * sin(ang * 2.0 + uTime * 0.35 + uSeed) + 0.12 * sin(q.y * 3.0 - uTime * 0.22 + uSeed);
  vec3 film = 0.5 + 0.5 * cos(6.2831 * (th + vec3(0.0, 0.33, 0.67)));
  col += film * fres * mix(0.55, 0.28, frost) * bright;

  // rim, window highlight, pinpoint, caustic
  float rim = smoothstep(0.84, 1.0, d);
  col += vec3(0.9, 0.95, 1.0) * rim * mix(0.45, 0.28, frost) * bright;
  vec2 h = q - vec2(-0.40, 0.52);
  h = mat2(0.819, 0.574, -0.574, 0.819) * h;
  float hl = 1.0 - smoothstep(0.0, 1.0, length(h / vec2(0.40, 0.17)));
  hl *= smoothstep(1.0, 0.82, d);
  col += vec3(1.0) * hl * mix(0.55, 0.3, frost) * (0.6 + 0.4 * bright);
  vec3 L = normalize(vec3(-0.5, 0.6, 0.62));
  float sp = pow(max(dot(reflect(vec3(0.0, 0.0, -1.0), n), L), 0.0), 260.0);
  col += vec3(1.0) * sp * 0.7 * bright;
  float ca = smoothstep(0.5, 0.95, d) * smoothstep(0.1, -0.85, q.y) * smoothstep(-0.9, 0.3, q.x);
  col += mix(uTint, vec3(1.0), 0.35) * ca * 0.32 * bright;
  col += uTint * uGlow * 0.06 + vec3(1.0) * uPop * rim * 0.5;

  float a = cov * uAlpha * (1.0 - uPop) * mix(1.0, 0.9, frost);
  gl_FragColor = vec4(col * a + outC, a);
}`;

const VS_D = `
attribute vec4 aD; // x, y, size, alpha (device px)
uniform vec2 uRes;
varying float vA;
void main() {
  vA = aD.w;
  gl_PointSize = aD.z;
  gl_Position = vec4(aD.x / uRes.x * 2.0 - 1.0, 1.0 - aD.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS_D = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying float vA;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = length(c);
  if (d > 1.0) discard;
  float nz = sqrt(1.0 - d * d);
  float rim = pow(1.0 - nz, 2.0);
  float hl = 1.0 - smoothstep(0.0, 0.45, length(c - vec2(-0.35, -0.35)));
  vec3 col = vec3(0.8, 0.9, 1.0) * (0.15 + 0.7 * rim) + vec3(1.0) * hl * 0.9;
  float a = vA * (0.25 + 0.6 * rim + 0.6 * hl) * (1.0 - smoothstep(0.85, 1.0, d));
  gl_FragColor = vec4(col * a, a);
}`;

function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

// Studio backdrop: near black with soft coloured light, a horizon band and bokeh.
// The structure is what the glass refracts, so it reads as glass.
export function paintBackdrop(ctx, S, { bright = false } = {}) {
  ctx.fillStyle = bright ? '#0a0d18' : '#040509';
  ctx.fillRect(0, 0, S, S);
  const glow = (x, y, r, c) => {
    const g = ctx.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  };
  const k = bright ? 2.2 : 1;
  glow(0.18, 0.12, 0.6, `rgba(40,110,150,${0.32 * k})`);
  glow(0.88, 0.3, 0.55, `rgba(110,70,170,${0.28 * k})`);
  glow(0.5, 1.02, 0.6, `rgba(190,120,50,${0.22 * k})`);
  glow(0.55, 0.55, 0.35, `rgba(60,80,140,${0.12 * k})`);
  // horizon band
  const hb = ctx.createLinearGradient(0, S * 0.5, 0, S * 0.8);
  hb.addColorStop(0, 'rgba(255,255,255,0)');
  hb.addColorStop(0.5, `rgba(170,190,230,${0.07 * k})`);
  hb.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hb; ctx.fillRect(0, S * 0.5, S, S * 0.3);
  // bokeh
  for (let i = 0; i < 46; i++) {
    const x = hash(i * 3 + 1) * S, y = hash(i * 5 + 2) * S, r = (2 + hash(i * 7 + 3) * 10) * S / 1024;
    const a = (0.05 + hash(i * 11 + 4) * 0.18) * (bright ? 1.6 : 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
    const warm = hash(i * 13) > 0.6;
    g.addColorStop(0, warm ? `rgba(255,210,150,${a})` : `rgba(180,215,255,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 6.283); ctx.fill();
  }
}

export function createGlass({ canvas, field, apps, og = false, keep = false }) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, powerPreference: 'default', preserveDrawingBuffer: og || keep });
  if (!gl) throw new Error('no webgl');

  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  const pBg = prog(VS_BG, FS_BG), pB = prog(VS_B, FS_B), pD = prog(VS_D, FS_D);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const MAXD = 600;
  const dData = new Float32Array(MAXD * 4);
  const dBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, dBuf);
  gl.bufferData(gl.ARRAY_BUFFER, dData.byteLength, gl.DYNAMIC_DRAW);

  function texFrom(c) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // backdrop texture (power of two so it can be mip-blurred for frosted glass)
  const bgC = document.createElement('canvas');
  bgC.width = bgC.height = 1024;
  paintBackdrop(bgC.getContext('2d'), 1024, { bright: og });
  const bgTex = texFrom(bgC);

  // icon atlas
  const atlas = document.createElement('canvas');
  atlas.width = TILE * COLS; atlas.height = TILE * ROWS;
  const actx = atlas.getContext('2d');
  const images = new Array(apps.length).fill(null);
  let atlasTex = null;
  const ICON = 150, IX = (TILE - ICON) / 2, IY = 22;
  function paintAtlas() {
    actx.clearRect(0, 0, atlas.width, atlas.height);
    apps.forEach((a, i) => {
      const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE;
      if (images[i]) drawIconImage(actx, images[i], x + IX, y + IY, ICON);
      else drawPlaceholder(actx, x + IX, y + IY, ICON, a, { letter: !og });
      if (!og && a.status !== 'soon') {
        actx.fillStyle = 'rgba(255,255,255,0.92)';
        actx.font = `500 30px Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;
        actx.textAlign = 'center'; actx.textBaseline = 'alphabetic';
        actx.fillText(a.name, x + TILE / 2, y + 214, TILE - 16);
      }
    });
    if (atlasTex) gl.deleteTexture(atlasTex);
    atlasTex = texFrom(atlas);
  }
  paintAtlas();
  apps.forEach((a, i) => loadIcon(a).then((img) => { if (img) { images[i] = img; paintAtlas(); } }));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => paintAtlas());

  const tints = apps.map((a) => hexRGB(a.tint || '#9FB4C8'));
  let W = 1, H = 1, dpr = 1;

  function resize(w, h, ratio) {
    W = w; H = h; dpr = ratio;
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(time) {
    const rw = canvas.width, rh = canvas.height;
    gl.disable(gl.BLEND);
    gl.useProgram(pBg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    let loc = gl.getAttribLocation(pBg.p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(pBg.u.uBg, 0);
    gl.uniform1f(pBg.u.uTime, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(pB.p);
    loc = gl.getAttribLocation(pB.p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    const u = pB.u;
    gl.uniform1i(u.uBg, 0); gl.uniform1i(u.uAtlas, 1);
    gl.uniform2f(u.uRes, rw, rh);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uExt, 1.45);
    const order = field.bubbles.slice().sort((a, b) => (b.status === 'soon') - (a.status === 'soon') || a.dragged - b.dragged);
    for (const b of order) {
      if (b.hidden || b.scale < 0.01) continue;
      const i = b.i;
      gl.uniform2f(u.uCenter, b.x * dpr, b.y * dpr);
      gl.uniform1f(u.uR, b.r * b.scale * dpr * (1 + b.glow * 0.04));
      gl.uniform1f(u.uSeed, b.seed);
      gl.uniform1f(u.uKind, KIND[b.status]);
      gl.uniform1f(u.uPop, b.pop >= 0 ? b.pop : 0);
      gl.uniform1f(u.uWobble, b.wobble);
      gl.uniform1f(u.uGlow, b.glow);
      gl.uniform1f(u.uAlpha, Math.min(1, b.scale * 1.5));
      const tx = (i % COLS) / COLS, ty = Math.floor(i / COLS) / ROWS;
      if (b.status === 'soon' || og) {
        // icon only
        gl.uniform4f(u.uTile, tx + IX / atlas.width, ty + IY / atlas.height, ICON / atlas.width, ICON / atlas.height);
        gl.uniform1f(u.uSpan, 0.6);
      } else {
        gl.uniform4f(u.uTile, tx, ty, TILE / atlas.width, TILE / atlas.height);
        gl.uniform1f(u.uSpan, 0.66);
      }
      const t = tints[i]; gl.uniform3f(u.uTint, t[0], t[1], t[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    const ds = field.droplets;
    if (ds.length) {
      const n = Math.min(MAXD, ds.length);
      for (let k = 0; k < n; k++) {
        const d = ds[k];
        const life = Math.max(0, d.life / d.max);
        dData[k * 4] = d.x * dpr; dData[k * 4 + 1] = d.y * dpr;
        dData[k * 4 + 2] = Math.max(1, d.size * dpr * (0.5 + 0.5 * life) * 2);
        dData[k * 4 + 3] = Math.min(1, life * 1.6);
      }
      gl.useProgram(pD.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, dBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, dData.subarray(0, n * 4));
      const dl = gl.getAttribLocation(pD.p, 'aD');
      gl.enableVertexAttribArray(dl);
      gl.vertexAttribPointer(dl, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(pD.u.uRes, rw, rh);
      gl.drawArrays(gl.POINTS, 0, n);
    }
  }

  return { gl, resize, render, get dpr() { return dpr; } };
}
