/*
 * Desktop Buddies — lets the home window (home.html) run inside the phone app.
 * On the desktop Electron's preload provides `catAPI`, so this does nothing; on
 * the phone home.html sits in a frame of the overlay page and talks to the
 * mobile host (src/mobile/host.js) with postMessage.
 */
(function () {
  'use strict';
  if (window.catAPI || window.parent === window) return;
  const handlers = {};
  const waiting = {};
  let seq = 0;
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || !m.buddy) return;
    if (m.buddy === 'event') for (const fn of handlers[m.ch] || []) fn(m.data);
    else if (m.buddy === 'reply' && waiting[m.id]) { waiting[m.id](m.data); delete waiting[m.id]; }
  });
  window.catAPI = {
    on(ch, fn) { (handlers[ch] = handlers[ch] || []).push(fn); },
    send(ch, data) { window.parent.postMessage({ buddy: 'send', ch, data }, '*'); },
    invoke(ch) {
      return new Promise((resolve) => {
        const id = ++seq;
        waiting[id] = resolve;
        window.parent.postMessage({ buddy: 'invoke', ch, id }, '*');
      });
    },
  };
  // a phone is narrower than the desktop home window
  document.documentElement.classList.add('mobile');
  const css = document.createElement('style');
  css.textContent = `
    html.mobile body { min-width: 0; }
    html.mobile .hero { padding: 8px 12px; gap: 8px; }
    html.mobile #portrait { width: 120px; height: 76px; }
    html.mobile .name { font-size: 19px; }
    html.mobile main { padding: 10px 12px 28px; }
    html.mobile .tabs { overflow-x: auto; padding: 0 8px; }
    html.mobile .tabs button { padding: 10px 9px; white-space: nowrap; }
    html.mobile .grid { grid-template-columns: repeat(3, 1fr); }
    html.mobile .stats { grid-template-columns: repeat(2, 1fr); }
    html.mobile .wardrobe { grid-template-columns: repeat(3, 1fr); }
    html.mobile .gifts { grid-template-columns: repeat(3, 1fr); }
    html.mobile .row { flex-wrap: wrap; }
    html.mobile .row small { max-width: none; }
    html.mobile select { max-width: 100%; }
    html.mobile .switcher { padding: 8px 10px 0; }
    html.mobile .actions #quitBtn { display: none; }
    html.mobile #hookRow, html.mobile label.row:has([data-k="rightClick"]), html.mobile label.row:has([data-k="launchAtLogin"]) { display: none !important; }`;
  document.head.appendChild(css);
})();
