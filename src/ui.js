import { t, getLang } from './i18n.js';
import { CONTACTS } from './apps.js';

const $ = (id) => document.getElementById(id);

const ICONS = {
  swipe: `<svg class="ic-swipe" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14h20" opacity=".3"/><path class="hand" d="M12 7.5v8l-2.2-1.8c-.9-.7-2.1.4-1.5 1.3L12 20.5c.6.8 1.5 1.2 2.5 1.2h3.2c1.6 0 2.8-1.2 2.8-2.8V14c0-.8-.6-1.4-1.4-1.4s-1.3.5-1.3 1.2v-.6c0-.8-.6-1.4-1.4-1.4-.7 0-1.3.5-1.3 1.2v-.8c0-.8-.6-1.4-1.4-1.4-.5 0-.9.2-1.2.6V7.5c0-.8-.6-1.4-1.4-1.4S12 6.7 12 7.5z"/></svg>`,
  tap: `<svg class="ic-tap" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle class="ring" cx="14" cy="14" r="6"/><path class="finger" d="M14 11v7.5l-1.6-1.3c-.7-.6-1.7.3-1.2 1.1l2.6 3.8c.5.7 1.2 1 2 1h2.5c1.3 0 2.3-1 2.3-2.3v-4c0-.7-.5-1.2-1.2-1.2s-1.1.4-1.1 1v-.5c0-.7-.5-1.2-1.2-1.2-.6 0-1 .4-1.1 1v-.7c0-.7-.5-1.2-1.2-1.2-.4 0-.8.2-1 .5V11c0-.7-.5-1.2-1.2-1.2S14 10.3 14 11z"/></svg>`,
  shake: `<svg class="ic-shake" viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <g class="phone"><rect x="9" y="4" width="10" height="20" rx="2.2"/><path d="M12.5 20.5h3"/></g><path d="M4.5 10c-1 2.5-1 5.5 0 8M23.5 10c1 2.5 1 5.5 0 8" opacity=".6"/></svg>`,
};

export function createUI({ apps, onShot, onHint, onLang, onAllApps }) {
  const titles = $('titles'), label = $('shot-label'), title = $('shot-title'), line = $('shot-line');
  const dots = $('dots');
  const hint = $('hint'), hintIcon = $('hint-icon'), hintText = $('hint-text');
  const card = $('card'), flood = $('flood');
  let currentHint = null;
  let hintTimer = 0;

  // Dots
  const dotEls = [];
  for (let i = 0; i <= apps.length; i++) {
    const b = document.createElement('button');
    b.className = 'dot' + (i > 0 && apps[i - 1].status === 'live' ? ' live' : '');
    b.type = 'button';
    b.innerHTML = '<i></i>';
    b.addEventListener('click', () => onShot(i));
    dots.appendChild(b);
    dotEls.push(b);
  }

  function setShot(i, { instant = false } = {}) {
    dotEls.forEach((d, k) => d.classList.toggle('active', k === i));
    dotEls.forEach((d, k) => d.setAttribute('aria-label', k === 0 ? t('system') : apps[k - 1].name));
    const show = () => {
      if (i === 0) {
        label.textContent = 'GenVidPro';
        title.textContent = t('system');
        line.textContent = t('tagline');
        document.documentElement.style.setProperty('--accent', '#FFCA16');
      } else {
        const a = apps[i - 1];
        label.textContent = a.status === 'live' ? t('live') : t('soon');
        title.textContent = a.name;
        line.textContent = a.line[getLang()] || a.line.en;
        document.documentElement.style.setProperty('--accent', a.status === 'live' ? '#FFCA16' : '#70B8FF');
      }
      titles.classList.add('show');
    };
    if (instant) { show(); return; }
    titles.classList.remove('show');
    setTimeout(show, 260);
  }

  function showTitles(v) { titles.classList.toggle('show', v); }

  // Hints
  function showHint(kind) {
    if (currentHint === kind) return;
    currentHint = kind;
    hintIcon.innerHTML = ICONS[kind];
    hintText.textContent = kind === 'swipe' ? t('hintSwipe') : kind === 'tap' ? t('hintTap') : t('hintShake');
    hint.hidden = false;
    hint.dataset.kind = kind;
    clearTimeout(hintTimer);
    requestAnimationFrame(() => requestAnimationFrame(() => hint.classList.add('show')));
  }
  function hideHint() {
    if (!currentHint) return;
    currentHint = null;
    hint.classList.remove('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { if (!currentHint) hint.hidden = true; }, 500);
  }
  hint.addEventListener('click', (e) => { e.stopPropagation(); const k = hint.dataset.kind; onHint(k); });

  // Card
  const cardIcon = $('card-icon'), cardLabel = $('card-label'), cardTitle = $('card-title'), cardLine = $('card-line');
  const cardOpen = $('card-open'), cardBack = $('card-back');
  function openCard(app, color) {
    document.documentElement.style.setProperty('--accent', color || app.color);
    cardLabel.textContent = app.status === 'live' ? t('live') : t('soon');
    cardTitle.textContent = app.name;
    cardLine.textContent = app.line[getLang()] || app.line.en;
    cardOpen.textContent = t('open', { name: app.name });
    cardOpen.href = app.url || '#';
    cardBack.textContent = t('back');
    cardIcon.hidden = true;
    if (app.icon) {
      cardIcon.onload = () => { cardIcon.hidden = false; };
      cardIcon.onerror = () => { cardIcon.hidden = true; };
      cardIcon.src = app.icon;
    }
    flood.classList.add('on');
    card.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('show')));
  }
  function closeCard() {
    card.classList.remove('show');
    flood.classList.remove('on');
    setTimeout(() => { card.hidden = true; }, 600);
  }
  function floodOnly(on) { flood.classList.toggle('on', on); }

  // Static text
  function applyStatic() {
    $('intro-label').textContent = t('presents');
    $('intro-skip').textContent = t('skip');
    $('all-apps-btn').textContent = t('allApps');
    $('lang-btn').textContent = t('lang');
    $('apps-label').textContent = t('appsTitle');
    $('apps-title').textContent = t('system');
    $('apps-line').textContent = t('systemLine');
    $('contacts-label').textContent = t('contactsTitle');
    $('contacts-title').textContent = 'GenVidPro';
    $('footer').textContent = CONTACTS.footer;
    document.title = getLang() === 'he' ? 'GVPro — אפליקציות שאפשר לנסות עכשיו' : 'GVPro — apps you can try right now';
    renderList();
    renderContacts();
    cardBack.textContent = t('back');
    if (currentHint) { const k = currentHint; currentHint = null; showHint(k); }
  }

  function renderList() {
    const ul = $('app-list');
    ul.innerHTML = '';
    apps.forEach((a) => {
      const li = document.createElement('li');
      const live = a.status === 'live';
      const row = document.createElement(live ? 'a' : 'div');
      row.className = 'app-row';
      if (live) { row.href = a.url; row.target = '_blank'; row.rel = 'noopener'; }
      row.innerHTML = `<span class="app-orb ${live ? 'live' : 'soon'}"></span>
        <span><span class="app-name">${a.name}</span><p class="app-line">${a.line[getLang()] || a.line.en}</p></span>
        <span class="status ${live ? 'live' : 'soon'}">${live ? t('live') : t('soon')}</span>`;
      li.appendChild(row);
      ul.appendChild(li);
    });
  }

  function renderContacts() {
    const ul = $('contact-list');
    ul.innerHTML = '';
    const rows = [
      ['whatsapp', CONTACTS.whatsapp, 'wa.me/972539760820'],
      ['telegram', CONTACTS.telegram, 't.me/GenVidPro'],
      ['site', CONTACTS.site, 'genvidpro.com'],
    ];
    rows.forEach(([k, href, text]) => {
      const li = document.createElement('li');
      li.className = 'contact-row';
      li.innerHTML = `<div><div class="label">${t(k)}</div><a href="${href}" target="_blank" rel="noopener">${text}</a></div>`;
      ul.appendChild(li);
    });
    const li = document.createElement('li');
    li.className = 'contact-row';
    li.innerHTML = `<div><div class="label">${t('email')}</div><div class="email-wrap"><span class="email-text" id="email-text">${CONTACTS.email}</span><button class="chip" type="button" id="copy-email">${t('copy')}</button></div></div>`;
    ul.appendChild(li);
    $('copy-email').addEventListener('click', async () => {
      const b = $('copy-email');
      try { await navigator.clipboard.writeText(CONTACTS.email); } catch {
        const r = document.createRange(); r.selectNodeContents($('email-text'));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); } catch {}
      }
      b.textContent = t('copied');
      setTimeout(() => { b.textContent = t('copy'); }, 1600);
    });
  }

  $('lang-btn').addEventListener('click', () => onLang());
  $('all-apps-btn').addEventListener('click', () => onAllApps());

  return { setShot, showTitles, showHint, hideHint, openCard, closeCard, floodOnly, applyStatic, get hint() { return currentHint; } };
}
