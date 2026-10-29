// App icons. Real files live at public/icons/<id>.png; the build lists which exist
// (see vite.config.js), so the page only asks for files that are there.
// Without a file a neutral glass tile with the app initial is drawn instead.

/* global __ICONS__ */
const AVAILABLE = new Set(typeof __ICONS__ !== 'undefined' ? __ICONS__ : []);
export const hasIcon = (id) => AVAILABLE.has(id);
export const iconUrl = (id) => `/icons/${id}.png`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Neutral glass placeholder: rounded square, soft light, the initial in the middle.
export function drawPlaceholder(ctx, x, y, s, app, { letter = true } = {}) {
  const r = s * 0.225;
  ctx.save();
  roundRect(ctx, x, y, s, s, r);
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.5, 'rgba(200,214,232,0.22)');
  g.addColorStop(1, 'rgba(140,160,190,0.30)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  const hl = ctx.createRadialGradient(x + s * 0.3, y + s * 0.2, 0, x + s * 0.3, y + s * 0.2, s * 0.8);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, s, s);
  ctx.restore();
  ctx.save();
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
  ctx.lineWidth = Math.max(1, s / 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.stroke();
  if (letter) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${Math.round(s * 0.5)}px Inter, system-ui, -apple-system, 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(app.name.charAt(0).toUpperCase(), x + s / 2, y + s * 0.53);
  }
  ctx.restore();
}

export function drawIconImage(ctx, img, x, y, s) {
  ctx.save();
  roundRect(ctx, x, y, s, s, s * 0.225);
  ctx.clip();
  ctx.drawImage(img, x, y, s, s);
  ctx.restore();
}

export function loadIcon(app) {
  if (!hasIcon(app.id)) return Promise.resolve(null);
  return new Promise((res) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = iconUrl(app.id);
  });
}

// Small data URL of a tile, for lite mode and the list.
export function placeholderDataUrl(app, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawPlaceholder(c.getContext('2d'), 0, 0, size, app);
  return c.toDataURL('image/png');
}
