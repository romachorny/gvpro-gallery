export const STRINGS = {
  he: {
    live: 'פעילה',
    building: 'בבנייה',
    soon: 'בקרוב',
    opensSoon: 'האפליקציה תיפתח בקרוב',
    back: 'חזרה',
    shake: 'נערו',
    allApps: 'כל האפליקציות',
    appsTitle: 'כל האפליקציות',
    lang: 'EN',
    langLabel: 'EN English',
    title: 'GVPro · אפליקציות שאפשר לנסות עכשיו',
    stage: 'בועות האפליקציות',
  },
  en: {
    live: 'Live',
    building: 'In the works',
    soon: 'Soon',
    opensSoon: 'Opens soon',
    back: 'Back',
    shake: 'Shake',
    allApps: 'All apps',
    appsTitle: 'All apps',
    lang: 'עב',
    langLabel: 'עב עברית',
    title: 'GVPro · apps you can try right now',
    stage: 'App bubbles',
  },
};

// Hebrew first: Hebrew unless ?lang=en or the visitor chose English before.
export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'he' || q === 'en') return q;
  try {
    const saved = localStorage.getItem('gvpro.lang');
    if (saved === 'he' || saved === 'en') return saved;
  } catch {}
  return 'he';
}

let current = 'he';
export function setLang(lang, { save = false } = {}) {
  current = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  if (save) { try { localStorage.setItem('gvpro.lang', lang); } catch {} }
}
export function getLang() { return current; }
export function t(key) { return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key; }
export function line(app) { return app.line[current] || app.line.en; }
