// Deterministic bubble field: layout by status, soft physics (springs to home,
// mutual push, walls), drag and throw, burst and re-inflate. No randomness:
// every "random-looking" value comes from a fixed hash of the bubble index.

export const SIZE = { live: 1, building: 0.74, soon: 0.5 };

// Home positions (0..1 inside the free area), in app order.
// Portrait is the phone layout; landscape is for tablets and desktop.
const HOMES = {
  portrait: [
    [0.24, 0.16], [0.80, 0.36], [0.22, 0.58], [0.74, 0.78],
    [0.86, 0.06], [0.12, 0.92], [0.46, 0.96], [0.94, 0.58],
  ],
  landscape: [
    [0.22, 0.40], [0.48, 0.30], [0.75, 0.48], [0.50, 0.76],
    [0.07, 0.78], [0.92, 0.16], [0.30, 0.86], [0.93, 0.84],
  ],
};

export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createField(apps) {
  const bubbles = apps.map((app, i) => ({
    i, app, status: app.status,
    x: 0, y: 0, vx: 0, vy: 0, r: 0, hx: 0, hy: 0,
    scale: 0, scaleV: 0, target: 1, // inflate spring
    alpha: 1,
    pop: -1,          // -1 idle, 0..1 bursting
    hidden: false,
    inflateAt: 0,     // time (s) when it starts to re-inflate
    wobble: 0,
    glow: 0, glowTarget: 0,
    dragged: false,
    seed: hash(i + 1) * 6.283,
  }));
  const f = {
    bubbles, droplets: [], w: 1, h: 1, top: 0, bottom: 0, rtl: false, t: 0, unit: 1,
    layout(w, h, { top = 64, bottom = 120, rtl = false, fill: fillOpt } = {}) {
      const first = f.w === 1;
      const ow = f.w, oh = f.h;
      f.w = w; f.h = h; f.top = top; f.bottom = bottom; f.rtl = rtl;
      const aw = w - 24, ah = Math.max(200, h - top - bottom);
      const portrait = aw / ah < 1.05;
      const homes = portrait ? HOMES.portrait : HOMES.landscape;
      // Radius of a LIVE bubble: fill ~30% of the free area on phones, less on wide screens.
      const sumSq = bubbles.reduce((s, b) => s + SIZE[b.status] ** 2, 0);
      const fill = fillOpt || (portrait ? 0.34 : 0.22);
      let rl = Math.sqrt((fill * aw * ah) / (Math.PI * sumSq));
      rl = Math.min(rl, ah * 0.2, 170);
      f.unit = rl;
      bubbles.forEach((b, k) => {
        const hm = homes[k % homes.length];
        b.r = rl * SIZE[b.status];
        const hx = rtl ? 1 - hm[0] : hm[0];
        b.hx = 12 + b.r + hx * (aw - 2 * b.r);
        b.hy = top + b.r + hm[1] * (ah - 2 * b.r);
        if (first) { b.x = b.hx; b.y = b.hy; }
        else { b.x = b.x / ow * w; b.y = b.y / oh * h; }
      });
    },
    // Run the simulation without drawing until it settles (used by lite mode and the OG poster).
    settle(seconds = 6) {
      bubbles.forEach((b) => { b.scale = 1; b.scaleV = 0; });
      for (let s = 0; s < seconds * 60; s++) f.step(1 / 60, { still: true });
    },
    // Bubbles rise from below the screen one by one: the opening shot.
    intro() {
      const now = f.t;
      bubbles.forEach((b, k) => {
        b.x = b.hx + (hash(k + 9) - 0.5) * b.r;
        b.y = f.h + b.r + k * 40;
        b.vy = -260 - k * 10; b.vx = 0;
        b.scale = 0; b.scaleV = 0; b.target = 1; b.inflateAt = now + 0.15 + k * 0.12;
        b.hidden = false; b.pop = -1;
      });
    },
    step(dt, { still = false } = {}) {
      f.t += dt;
      const t = f.t;
      const L = 12, R = f.w - 12, T = f.top - 6, B = f.h - f.bottom * 0.85;
      for (const b of bubbles) {
        if (b.hidden && b.pop < 0 && t >= b.inflateAt) { b.hidden = false; b.scale = 0; b.scaleV = 0; }
        // inflate spring (with a little overshoot)
        if (!b.hidden && t >= b.inflateAt) {
          const k = 120, c = 13;
          b.scaleV += (k * (b.target - b.scale) - c * b.scaleV) * dt;
          b.scale += b.scaleV * dt;
        }
        if (b.pop >= 0) {
          b.pop += dt / 0.12;
          if (b.pop >= 1) { b.pop = -1; b.hidden = true; b.scale = 0; b.scaleV = 0; }
        }
        b.wobble *= Math.exp(-dt * 3.2);
        b.glow += (b.glowTarget - b.glow) * Math.min(1, dt * 4);
        if (b.dragged) continue;
        // slow drift around home, unique per bubble but fixed
        const amp = still ? 0 : 0.10 * f.unit;
        const tx = b.hx + Math.sin(t * 0.21 + b.seed) * amp + Math.sin(t * 0.077 + b.seed * 2) * amp * 0.6;
        const ty = b.hy + Math.cos(t * 0.17 + b.seed * 1.3) * amp * 0.8;
        const k = 2.2, c = 1.6;
        b.vx += (k * (tx - b.x) - c * b.vx) * dt;
        b.vy += (k * (ty - b.y) - c * b.vy) * dt;
      }
      // gentle mutual push
      for (let a = 0; a < bubbles.length; a++) {
        const A = bubbles[a]; if (A.hidden) continue;
        for (let c = a + 1; c < bubbles.length; c++) {
          const C = bubbles[c]; if (C.hidden) continue;
          const dx = C.x - A.x, dy = C.y - A.y;
          const min = (A.r * Math.max(A.scale, 0.3) + C.r * Math.max(C.scale, 0.3)) + 6;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 0.01, nx = dx / d, ny = dy / d, over = min - d;
          const ma = A.dragged ? 0 : A.r * A.r, mc = C.dragged ? 0 : C.r * C.r;
          const sum = ma + mc || 1;
          const pa = ma / sum, pc = mc / sum;
          A.x -= nx * over * pa * 0.5; A.y -= ny * over * pa * 0.5;
          C.x += nx * over * pc * 0.5; C.y += ny * over * pc * 0.5;
          const rel = (C.vx - A.vx) * nx + (C.vy - A.vy) * ny;
          if (rel < 0) {
            const j = -rel * 0.9;
            A.vx -= nx * j * pa; A.vy -= ny * j * pa;
            C.vx += nx * j * pc; C.vy += ny * j * pc;
            if (j > 120) { A.wobble = Math.min(1, A.wobble + j / 2000); C.wobble = Math.min(1, C.wobble + j / 2000); }
          }
        }
      }
      for (const b of bubbles) {
        if (b.dragged) continue;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const r = b.r * Math.max(b.scale, 0.2);
        if (b.x < L + r) { b.x = L + r; b.vx = Math.abs(b.vx) * 0.5; }
        if (b.x > R - r) { b.x = R - r; b.vx = -Math.abs(b.vx) * 0.5; }
        if (b.scale > 0.05 && b.y < T + r) { b.y = T + r; b.vy = Math.abs(b.vy) * 0.5; }
        if (b.scale > 0.05 && b.y > B - r) { b.y = B - r; b.vy = -Math.abs(b.vy) * 0.5; }
      }
      // droplets
      const g = 900;
      f.droplets = f.droplets.filter((d) => (d.life -= dt) > 0);
      for (const d of f.droplets) { d.vy += g * dt; d.vx *= Math.exp(-dt * 1.5); d.x += d.vx * dt; d.y += d.vy * dt; }
    },
    hit(x, y) {
      let best = null, bd = Infinity;
      for (const b of bubbles) {
        if (b.hidden || b.pop >= 0) continue;
        const d = Math.hypot(x - b.x, y - b.y);
        const reach = b.r * Math.max(b.scale, 0.6) + (b.status === 'soon' ? 10 : 4);
        if (d < reach && d / reach < bd) { best = b; bd = d / reach; }
      }
      return best;
    },
    burst(b, reinflateAfter = 1.0) {
      if (b.status === 'soon' || b.hidden || b.pop >= 0) return false;
      b.pop = 0;
      b.inflateAt = f.t + reinflateAfter;
      const n = Math.round(18 + b.r * 0.25);
      const sp = 0.9 + b.r / 120;
      for (let k = 0; k < n; k++) {
        const h1 = hash(b.i * 31 + k * 7 + f.droplets.length), h2 = hash(k * 13 + b.i);
        const a = (k / n) * Math.PI * 2 + (h1 - 0.5) * 0.5;
        const rr = b.r * (0.7 + 0.3 * h2);
        const v = (180 + 260 * h2) * sp;
        f.droplets.push({
          x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
          vx: Math.cos(a) * v + b.vx, vy: Math.sin(a) * v - 120 + b.vy,
          life: 0.45 + 0.35 * h1, max: 0.8, size: (3.5 + 6 * h2) * Math.min(1.6, b.r / 70), tint: b.app.tint,
        });
      }
      return true;
    },
    poke(b) { b.wobble = 1; b.vy -= 60; },
  };
  return f;
}
