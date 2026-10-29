// The app list. One object = one bubble, in this order.
//
// status decides size, brightness and what a tap does:
//   'live'      large, brightest. Tap: the bubble bursts, then `url` opens.
//   'building'  medium. Tap: the bubble bursts, then a card says it opens soon.
//   'soon'      small and frosted. Never bursts. Tap: a wobble plus name, line and "soon".
//
// Every app lives at <name>.gvpro.app in the end:
//   url   where the app opens today
//   home  its future address on gvpro.app
// Since 29.10.2026 every live app opens on its own gvpro.app address (url === home).
//
// Icons: drop public/icons/<id>.png (1024 px square, rounded corners) and rebuild.
// Until the file exists a neutral glass placeholder with the initial is drawn.

export const LINK_TARGET = 'url'; // 'url' | 'home'

export const APPS = [
  {
    id: 'yeshli',
    name: 'Yeshli',
    status: 'live',
    url: 'https://yeshli.gvpro.app/',
    home: 'https://yeshli.gvpro.app/',
    tint: '#FFCA16',
    line: { he: 'בונים אפליקציה מתוך רעיון', en: 'Build an app from your idea' },
  },
  {
    id: 'tiulio',
    name: 'Tiulio',
    status: 'live',
    url: 'https://tiulio.gvpro.app/',
    home: 'https://tiulio.gvpro.app/',
    tint: '#FF9E6B',
    line: { he: 'סרט קסום עם הילד שלכם בארבעה עולמות, ומראה קסומה', en: 'A magic film with your child in four worlds, plus a magic mirror' },
  },
  {
    id: 'site',
    name: 'GVP Site',
    status: 'live',
    url: 'https://site.gvpro.app/',
    home: 'https://site.gvpro.app/',
    tint: '#7FD4FF',
    line: { he: 'בונים אתר בכמה דקות', en: 'Build a website in minutes' },
  },
  {
    id: 'tamnun',
    name: 'Tamnun AI',
    status: 'live',
    url: 'https://tamnun.gvpro.app/',
    home: 'https://tamnun.gvpro.app/',
    tint: '#B69CFF',
    line: { he: 'עוזר אישי שמפעילים בקול', en: 'A personal assistant you run by voice' },
  },
  {
    id: 'idmatch',
    name: 'IDMatch',
    status: 'live',
    url: 'https://idmatch.gvpro.app/',
    home: 'https://idmatch.gvpro.app/',
    tint: '#6FE3C1',
    line: { he: 'היכרויות רק עם אנשים מאומתים', en: 'Dating with verified people only' },
  },
  {
    id: 'coolometer',
    name: 'Coolometer',
    status: 'live',
    url: 'https://coolometer.gvpro.app/',
    home: 'https://coolometer.gvpro.app/',
    tint: '#FF7EB6',
    line: { he: 'כמה אתם מגניבים? מדליית זהב לפרופיל שלכם', en: 'How cool are you? A gold medal for your profile' },
  },
  {
    id: 'tnua',
    name: 'Tnua',
    status: 'live',
    url: 'https://tnua.gvpro.app/',
    home: 'https://tnua.gvpro.app/',
    tint: '#8CF07A',
    line: { he: 'אוטובוסים ומשמרות בזמן אמת לחברות הסעה', en: 'Live buses and shifts for transport companies' },
  },
  {
    id: 'merkaba',
    name: 'Merkaba',
    status: 'soon',
    home: 'https://merkaba.gvpro.app/',
    tint: '#9FB4C8',
    // Placeholder: Roma will give the real line.
    line: { he: 'פרטים בקרוב', en: 'Details coming soon' },
  },
];

// Where a tap on this app should go right now (null if it has nowhere to go yet).
export function linkOf(app) {
  if (app.status !== 'live') return null;
  return (LINK_TARGET === 'home' ? app.home : app.url) || app.url || null;
}
