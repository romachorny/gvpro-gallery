export const STRINGS = {
  en: {
    presents: 'GenVidPro presents',
    tagline: 'Apps you can try right now',
    live: 'Live app',
    soon: 'Coming soon',
    open: 'Open {name}',
    back: 'Back to the system',
    allApps: 'All apps',
    hintSwipe: 'Swipe to fly to the next planet',
    hintTap: 'Tap the glowing planet to enter',
    hintShake: 'Shake your phone',
    system: 'The GVPro system',
    systemLine: 'Six apps. Two already live.',
    appsTitle: 'All apps',
    contactsTitle: 'Contacts',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    email: 'Email',
    site: 'Studio site',
    copy: 'Copy',
    copied: 'Copied',
    skip: 'Skip intro',
    lang: 'עב',
    prev: 'Previous shot',
    next: 'Next shot',
    shot: 'Shot',
  },
  he: {
    presents: 'GenVidPro מציגה',
    tagline: 'אפליקציות שאפשר לנסות עכשיו',
    live: 'פעילה עכשיו',
    soon: 'בקרוב',
    open: 'לפתוח את {name}',
    back: 'חזרה למערכת',
    allApps: 'כל האפליקציות',
    hintSwipe: 'החליקו לכוכב הבא',
    hintTap: 'געו בכוכב הזוהר כדי להיכנס',
    hintShake: 'נערו את הטלפון',
    system: 'מערכת GVPro',
    systemLine: 'שש אפליקציות. שתיים כבר פעילות.',
    appsTitle: 'כל האפליקציות',
    contactsTitle: 'יצירת קשר',
    whatsapp: 'וואטסאפ',
    telegram: 'טלגרם',
    email: 'אימייל',
    site: 'אתר הסטודיו',
    copy: 'העתקה',
    copied: 'הועתק',
    skip: 'דילוג על הפתיח',
    lang: 'EN',
    prev: 'השוט הקודם',
    next: 'השוט הבא',
    shot: 'שוט',
  },
};

export function detectLang() {
  try {
    const saved = localStorage.getItem('gvpro.lang');
    if (saved === 'he' || saved === 'en') return saved;
  } catch {}
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'he' || q === 'en') return q;
  return (navigator.language || '').toLowerCase().startsWith('he') ? 'he' : 'en';
}

let current = 'en';
export function setLang(lang) {
  current = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  try { localStorage.setItem('gvpro.lang', lang); } catch {}
}
export function getLang() { return current; }
export function t(key, vars) {
  let s = (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
