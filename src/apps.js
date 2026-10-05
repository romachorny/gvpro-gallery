// One app = one planet. To add an app: add an object here.
// To "thaw" a coming-soon app: set status to 'live' and give it a url.
// material: 'chrome' | 'glass' | 'gold' | 'frost'  (frost is used automatically for coming-soon)
export const APPS = [
  {
    id: 'yeshli',
    name: 'Yeshli',
    status: 'live',
    url: 'https://yeshli.base44.app/',
    icon: 'https://yeshli.base44.app/icon.svg',
    material: 'chrome',
    color: '#FFCA16',
    line: { en: 'Your idea. Your app!', he: 'הרעיון שלך. האפליקציה שלך' },
  },
  {
    id: 'tiulio',
    name: 'Tiulio',
    status: 'live',
    url: 'https://tiulio.base44.app/',
    icon: 'https://tiulio.base44.app/apple-touch-icon.png',
    material: 'glass',
    color: '#FFB35C',
    line: { en: 'A magic film with your child inside four seasons', he: 'סרט קסום שבו הילד בתוך ארבע עונות' },
  },
  {
    id: 'coolometer',
    name: 'Coolometer',
    status: 'soon',
    material: 'gold',
    color: '#70B8FF',
    line: { en: 'How cool are you? Get your gold medal.', he: 'עד כמה אתה מגניב? מקבלים מדליית זהב' },
  },
  {
    id: 'three-screens',
    name: 'Three Screens',
    status: 'soon',
    material: 'frost',
    color: '#70B8FF',
    line: { en: 'Your site on desktop, iPhone and Android', he: 'האתר שלך במחשב, באייפון ובאנדרואיד' },
  },
  {
    id: 'order-agent',
    name: 'Order Agent',
    status: 'soon',
    material: 'frost',
    color: '#70B8FF',
    line: { en: 'Takes WhatsApp orders day and night', he: 'מקבל הזמנות בוואטסאפ יומם ולילה' },
  },
  {
    id: 'logo-motion',
    name: 'Logo Motion',
    status: 'soon',
    material: 'frost',
    color: '#70B8FF',
    line: { en: 'Upload a logo, watch it move', he: 'מעלים לוגו ורואים אותו זז' },
  },
];

export const CONTACTS = {
  whatsapp: 'https://wa.me/972539760820?text=gallery',
  email: 'genvidpro@gmail.com',
  telegram: 'https://t.me/GenVidPro',
  site: 'https://genvidpro.com',
  footer: 'GenVidPro · Tel Aviv',
};
