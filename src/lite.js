// Lite mode: no WebGL, low memory or reduced motion. Same layout (settled once,
// no animation loop), CSS glass bubbles as real buttons, same tap rules.
import { hash } from './field.js';
import { iconSrc } from './ui.js';
import { paintBackdrop } from './glass.js';

export function createLite({ root, field, onTap }) {
  root.hidden = false;
  root.innerHTML = '';
  const bg = document.createElement('canvas');
  bg.width = bg.height = 512;
  paintBackdrop(bg.getContext('2d'), 512);
  root.style.backgroundImage = `url(${bg.toDataURL('image/jpeg', 0.8)})`;
  const els = field.bubbles.map((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `lb ${b.status}`;
    el.style.setProperty('--tint', b.app.tint);
    el.setAttribute('aria-label', b.app.name);
    el.innerHTML = `<span class="lb-film"></span><img class="lb-icon" alt="" src="${iconSrc(b.app)}">${b.status !== 'soon' ? `<span class="lb-name">${b.app.name}</span>` : ''}<span class="lb-hl"></span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); onTap(b, el); });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.appendChild(el);
    return el;
  });
  function place() {
    field.settle(5);
    field.bubbles.forEach((b, k) => {
      const el = els[k];
      el.style.width = el.style.height = b.r * 2 + 'px';
      el.style.left = b.x - b.r + 'px';
      el.style.top = b.y - b.r + 'px';
      el.style.setProperty('--phase', (hash(k + 3) * -8).toFixed(2) + 's');
    });
  }
  place();
  function pop(b) {
    const el = els[b.i];
    el.classList.remove('wobble', 'inflate');
    el.classList.add('pop');
    setTimeout(() => { el.classList.remove('pop'); el.classList.add('gone'); }, 300);
    setTimeout(() => { el.classList.remove('gone'); el.classList.add('inflate'); }, 1300);
  }
  function wobble(b) {
    const el = els[b.i];
    el.classList.remove('wobble'); void el.offsetWidth; el.classList.add('wobble');
  }
  function spotlight(i) { els.forEach((el, k) => el.classList.toggle('spot', k === i)); }
  return { place, pop, wobble, spotlight, els };
}

export function noiseDataUrl(size = 160) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (hash(i * 0.37) * 255) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}
