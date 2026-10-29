// DOM around the bubbles: caption, Shake pill, SOON toast, BUILDING card, app list, language.
import { t, getLang, line } from './i18n.js';
import { linkOf } from './apps.js';
import { hasIcon, iconUrl, placeholderDataUrl } from './icons.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function iconSrc(app) { return hasIcon(app.id) ? iconUrl(app.id) : placeholderDataUrl(app); }

export function createUI({ apps, onShake, onLang, onAllApps, onCardClose }) {
  const caption = $('caption'), capLabel = $('cap-label'), capName = $('cap-name'), capLine = $('cap-line');
  const toast = $('toast'), card = $('card');
  let toastTimer = 0, capTimer = 0, capApp = null;

  function setCaption(app, { instant = false } = {}) {
    capApp = app;
    clearTimeout(capTimer);
    const fill = () => {
      if (!app) { caption.classList.remove('show'); return; }
      capLabel.textContent = t(app.status);
      capLabel.dataset.status = app.status;
      capName.textContent = app.name;
      capLine.textContent = line(app);
      caption.classList.add('show');
    };
    if (instant) { fill(); return; }
    caption.classList.remove('show');
    capTimer = setTimeout(fill, 320);
  }

  function showToast(app, x, y, stageRect) {
    $('toast-name').textContent = app.name;
    $('toast-line').textContent = line(app);
    $('toast-soon').textContent = t('soon');
    toast.hidden = false;
    toast.classList.remove('show');
    const tw = Math.min(260, stageRect.width - 32);
    toast.style.width = tw + 'px';
    const th = toast.offsetHeight;
    let left = Math.max(16, Math.min(stageRect.width - tw - 16, x - tw / 2));
    let top = y - th - 14;
    if (top < 70) top = y + 14 + 8;
    toast.style.left = left + 'px';
    toast.style.top = top + 'px';
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2800);
  }
  function hideToast() {
    toast.classList.remove('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 350);
  }

  let lastFocus = null;
  function openCard(app) {
    lastFocus = document.activeElement;
    $('card-icon').src = iconSrc(app);
    $('card-label').textContent = t(app.status);
    $('card-label').dataset.status = app.status;
    $('card-title').textContent = app.name;
    $('card-line').textContent = line(app);
    $('card-soon').textContent = t('opensSoon');
    $('card-back').textContent = t('back');
    card.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
    $('card-back').focus({ preventScroll: true });
  }
  function closeCard() {
    if (card.hidden) return;
    card.classList.remove('show');
    setTimeout(() => { card.hidden = true; }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    onCardClose && onCardClose();
  }
  $('card-back').addEventListener('click', closeCard);
  card.addEventListener('click', (e) => { if (e.target === card) closeCard(); });

  function shaking(on) { $('shake').classList.toggle('active', on); }

  function renderList() {
    const ul = $('app-list');
    ul.innerHTML = '';
    for (const a of apps) {
      const href = linkOf(a);
      const li = document.createElement('li');
      li.innerHTML = `<${href ? 'a' : 'div'} class="app-row"${href ? ` href="${esc(href)}" rel="noopener"` : ''}>
        <img class="app-icon" src="${iconSrc(a)}" alt="" width="44" height="44" loading="lazy">
        <span class="app-text"><span class="app-name">${esc(a.name)}</span><span class="app-line">${esc(line(a))}</span></span>
        <span class="status" data-status="${a.status}">${esc(t(a.status))}</span>
      </${href ? 'a' : 'div'}>`;
      ul.appendChild(li);
    }
  }

  function applyStatic() {
    $('all-apps-btn').textContent = t('allApps');
    $('lang-btn').textContent = t('lang');
    $('lang-btn').setAttribute('aria-label', t('langLabel'));
    $('shake-text').textContent = t('shake');
    $('shake').setAttribute('aria-label', t('shakeLabel'));
    $('apps-title').textContent = t('appsTitle');
    $('stage').setAttribute('aria-label', t('stage'));
    document.title = t('title');
    renderList();
    if (capApp) setCaption(capApp, { instant: true });
    if (!toast.hidden) hideToast();
    if (!card.hidden) closeCard();
  }

  $('lang-btn').addEventListener('click', (e) => { e.stopPropagation(); onLang(); });
  $('all-apps-btn').addEventListener('click', (e) => { e.stopPropagation(); onAllApps(); });
  $('shake').addEventListener('click', (e) => { e.stopPropagation(); onShake('pill'); });
  for (const id of ['shake', 'lang-btn', 'all-apps-btn', 'toast', 'card']) {
    $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  return {
    setCaption, showToast, hideToast, openCard, closeCard, shaking, applyStatic,
    get cardOpen() { return !card.hidden; },
  };
}
