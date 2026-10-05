// Calm static scene for weak devices, missing WebGL or reduced motion.
export function createLiteScene({ root, apps }) {
  root.hidden = false;
  root.innerHTML = '';
  const stars = document.createElement('div');
  stars.className = 'lite-stars';
  stars.style.backgroundImage = `url(${starField()})`;
  root.appendChild(stars);
  const radii = [16, 22, 28, 34, 40, 46];
  radii.forEach((r) => {
    const o = document.createElement('div');
    o.className = 'lite-orbit';
    o.style.width = o.style.height = r * 2 + 'vmin';
    root.appendChild(o);
  });
  const core = document.createElement('div');
  core.className = 'lite-core';
  root.appendChild(core);
  const planetEls = apps.map((a, i) => {
    const el = document.createElement('div');
    el.className = 'lite-planet ' + (a.status === 'live' ? 'live' : 'soon');
    const ang = (i * 1.07 + 0.6);
    const r = radii[i];
    // orbit plane tilted: y squashed
    el.style.left = `calc(50% + ${Math.cos(ang) * r}vmin)`;
    el.style.top = `calc(42% + ${Math.sin(ang) * r * 0.47}vmin)`;
    root.appendChild(el);
    return el;
  });
  return {
    setShot(i) { planetEls.forEach((el, k) => el.classList.toggle('active', k === i - 1)); },
    pick(x, y) {
      let best = -1, bestD = 60;
      planetEls.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    },
  };
}

function starField() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 1.1 + 0.2;
    g.fillStyle = `rgba(220,230,255,${0.3 + Math.random() * 0.7})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c.toDataURL();
}

export function noiseDataUrl(size = 160) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
