/* GVPro install banner, standard v2 (docs/install-banner.md in romachorny/gvpro-gallery).
 * Copy this file as is into every gvpro.app app and load it in <head>, before the app's own scripts:
 *   <script src="/install-banner.js?v=2" data-name="Coolometer" data-icon="/icon-192.png" defer></script>
 * Android/Chrome: catches beforeinstallprompt, shows a glass banner at the bottom, Install calls prompt().
 * iOS Safari: no install event exists, the banner explains Share, then Add to Home Screen.
 * Never shown when already installed (display-mode standalone) or for 14 days after the x.
 * While it is visible, <html> has class gvp-install-on and --gvp-install-h is its height plus margin,
 * so an app can lift its own bottom controls: bottom: calc(22px + var(--gvp-install-h, 0px)).
 * Both show and hide fire a 'gvp-install-change' event on window (relayout canvases on it). */
(function () {
  if (window.__gvpInstall) return;
  var me = document.currentScript || {};
  var data = me.dataset || {};
  var KEY = 'gvp-install-dismissed';
  var SNOOZE_MS = 14 * 86400000;
  var bip = null, el = null;
  var standalone = function () {
    return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  };
  var ua = navigator.userAgent;
  var ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  var iosSafari = ios && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
  var snoozed = function () {
    try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS; } catch (e) { return false; }
  };
  var name = function () {
    var m = document.querySelector('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]');
    return data.name || (m && m.content) || document.title.split(/[|·—-]/)[0].trim() || 'this app';
  };
  var icon = function () {
    var l = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel="icon"][type="image/png"]');
    return data.icon || (l && l.href) || '';
  };

  var CSS = '#gvp-install{position:fixed;z-index:2147483000;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));'
    + 'max-width:520px;margin:0 auto;display:flex;align-items:center;gap:12px;padding:10px 8px 10px 12px;box-sizing:border-box;'
    + 'border-radius:20px;border:1px solid rgba(255,255,255,.18);background:rgba(22,22,28,.55);color:#fff;'
    + '-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);'
    + 'box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12);'
    + 'font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;direction:ltr;text-align:left;'
    + 'transform:translateY(16px);opacity:0;transition:transform .25s ease,opacity .25s ease}'
    + '#gvp-install.on{transform:none;opacity:1}'
    + '#gvp-install img{display:block;max-width:none;width:40px;height:40px;border-radius:10px;flex:0 0 auto}'
    + '#gvp-install .gvp-t{flex:1 1 auto;min-width:0}'
    + '#gvp-install b{display:block;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '#gvp-install small{display:block;font-size:12.5px;color:rgba(255,255,255,.72);margin-top:2px}'
    + '#gvp-install .gvp-go{flex:0 0 auto;min-height:40px;padding:0 18px;border:0;border-radius:999px;background:#fff;color:#111;font:600 14px/1 inherit;font-family:inherit;cursor:pointer}'
    + '#gvp-install button{position:static;margin:0;box-shadow:none;display:inline-flex;align-items:center;justify-content:center}'
    + '#gvp-install .gvp-x{flex:0 0 auto;width:40px;height:40px;border:0;border-radius:50%;background:transparent;color:rgba(255,255,255,.75);font-size:18px;line-height:1;cursor:pointer}'
    + '#gvp-install .gvp-x:hover,#gvp-install .gvp-x:focus-visible{background:rgba(255,255,255,.12)}'
    + '@media (prefers-reduced-motion:reduce){#gvp-install{transition:none}}'
    + '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#gvp-install{background:rgba(22,22,28,.92)}}';

  function hide() {
    if (!el) return;
    el.remove(); el = null;
    document.documentElement.classList.remove('gvp-install-on');
    document.documentElement.style.removeProperty('--gvp-install-h');
    dispatchEvent(new Event('gvp-install-change'));
  }
  function show() {
    if (el || standalone() || snoozed() || !(bip || iosSafari) || !document.body) return;
    if (!document.getElementById('gvp-install-css')) {
      var st = document.createElement('style'); st.id = 'gvp-install-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    el = document.createElement('div');
    el.id = 'gvp-install'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Install app'); el.lang = 'en';
    var src = icon();
    if (src) { var img = document.createElement('img'); img.src = src; img.alt = ''; el.appendChild(img); }
    var t = document.createElement('div'); t.className = 'gvp-t';
    var b = document.createElement('b'); b.textContent = 'Install ' + name();
    var s = document.createElement('small');
    s.textContent = bip ? 'Opens from your home screen, like an app' : 'Tap Share, then Add to Home Screen';
    t.appendChild(b); t.appendChild(s); el.appendChild(t);
    if (bip) {
      var go = document.createElement('button'); go.type = 'button'; go.className = 'gvp-go'; go.textContent = 'Install';
      go.onclick = function () {
        var e = bip; bip = null; hide();
        if (!e) return;
        e.prompt();
        Promise.resolve(e.userChoice).then(function (c) {
          if (!c || c.outcome !== 'accepted') { try { localStorage.setItem(KEY, String(Date.now())); } catch (x) {} }
        }).catch(function () {});
      };
      el.appendChild(go);
    }
    var x = document.createElement('button'); x.type = 'button'; x.className = 'gvp-x'; x.textContent = '✕';
    x.setAttribute('aria-label', 'Not now'); x.title = 'Not now';
    x.onclick = function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} hide(); };
    el.appendChild(x);
    document.body.appendChild(el);
    var h = el.getBoundingClientRect().height + 12;
    document.documentElement.style.setProperty('--gvp-install-h', Math.ceil(h) + 'px');
    document.documentElement.classList.add('gvp-install-on');
    dispatchEvent(new Event('gvp-install-change'));
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (el) el.classList.add('on'); }); });
  }
  function later(ms) {
    var run = function () { setTimeout(show, ms); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  }

  addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); bip = e; later(600); });
  addEventListener('appinstalled', function () { bip = null; hide(); });
  if (iosSafari && !standalone()) later(1500);
  window.__gvpInstall = { show: show, hide: hide, get event() { return bip; } };
})();
