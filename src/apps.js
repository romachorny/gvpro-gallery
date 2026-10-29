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
// Flip LINK_TARGET to 'home' once the subdomains are live, and every link follows.
//
// Icons: drop public/icons/<id>.png (1024 px square, rounded corners) and rebuild.
// Until the file exists a neutral glass placeholder with the initial is drawn.

export const LINK_TARGET = 'url'; // 'url' | 'home'

export const APPS = [
  {
    id: 'yeshli',
    name: 'Yeshli',
    status: 'live',
    url: 'https://yeshli.base44.app/',
    home: 'https://yeshli.gvpro.app/',
    tint: '#FFCA16',
    line: { he: 'בונים אפליקציה מתוך רעיון', en: 'Build an app from your idea' },
  },
  {
    id: 'tiulio',
    name: 'Tiulio',
    status: 'live',
    url: 'https://tiulio.base44.app/',
    home: 'https://tiulio.gvpro.app/',
    tint: '#FF9E6B',
    line: { he: 'סרט קסום עם הילד שלכם בארבעה עולמות, ומראה קסומה', en: 'A magic film with your child in four worlds, plus a magic mirror' },
  },
  {
    id: 'site',
    name: 'GVP Site',
    status: 'live',
    url: 'https://app.genvidpro.com/',
    home: 'https://site.gvpro.app/',
    tint: '#7FD4FF',
    line: { he: 'בונים אתר בכמה דקות', en: 'Build a website in minutes' },
  },
  {
    id: 'tamnun',
    name: 'Tamnun AI',
    status: 'building',
    home: 'https://tamnun.gvpro.app/',
    tint: '#B69CFF',
    line: { he: 'עוזר אישי שמפעילים בקול', en: 'A personal assistant you run by voice' },
  },
  {
    id: 'idmatch',
    name: 'IDMatch',
    status: 'soon',
    home: 'https://idmatch.gvpro.app/',
    tint: '#9FB4C8',
    line: { he: 'היכרויות רק עם אנשים מאומתים', en: 'Dating with verified people only' },
  },
  {
    id: 'coolometer',
    name: 'Coolometer',
    status: 'soon',
    home: 'https://coolometer.gvpro.app/',
    tint: '#9FB4C8',
    line: { he: 'כמה אתם מגניבים? מדליית זהב לפרופיל שלכם', en: 'How cool are you? A gold medal for your profile' },
  },
  {
    id: 'tnua',
    name: 'Tnua',
    status: 'soon',
    home: 'https://tnua.gvpro.app/',
    tint: '#9FB4C8',
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
