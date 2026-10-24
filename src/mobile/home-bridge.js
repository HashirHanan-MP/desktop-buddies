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
    html.mobile #hookRow, html.mobile label.row:has([data-k="rightClick"]), html.mobile label.row:has([data-k="launchAtLogin"]) { display: none !important; }
    html.mobile select, html.mobile input[type="time"] { pointer-events: none; }
    .msheet-bg { position: fixed; inset: 0; z-index: 99999; background: rgba(10, 10, 25, 0.45); display: flex; align-items: flex-end; justify-content: center; }
    .msheet { width: min(420px, 100%); max-height: 72vh; display: flex; flex-direction: column; background: var(--card, #fff); color: var(--fg, #222);
      border-radius: 18px 18px 0 0; box-shadow: 0 -6px 30px rgba(0, 0, 0, 0.25); padding: 6px 0 calc(10px + env(safe-area-inset-bottom, 0px)); }
    .msheet h3 { margin: 10px 18px 6px; font: 700 15px system-ui, sans-serif; }
    .msheet .opts { overflow-y: auto; padding: 0 8px; }
    .msheet .opt { display: block; width: 100%; text-align: left; border: 0; background: none; color: inherit; font: 15px system-ui, sans-serif;
      padding: 13px 12px; border-radius: 10px; }
    .msheet .opt.on { background: var(--hover, #eee); color: var(--accent, #7a66ff); font-weight: 700; }
    .msheet .opt:disabled { opacity: 0.4; }
    .msheet .cols { display: flex; gap: 10px; padding: 0 14px; height: 46vh; }
    .msheet .col { position: relative; flex: 1; overflow-y: auto; border-radius: 12px; background: var(--bg, #f5f5fa); }
    .msheet .col .opt { text-align: center; font-size: 20px; padding: 10px; font-variant-numeric: tabular-nums; }
    .msheet .col .opt small { font-size: 12px; opacity: 0.55; margin-left: 6px; }
    .msheet .preview { text-align: center; font: 700 26px system-ui, sans-serif; margin: 2px 0 8px; font-variant-numeric: tabular-nums; }
    .msheet .bar { display: flex; gap: 10px; padding: 10px 14px 0; }
    .msheet .bar button { flex: 1; border: 0; border-radius: 12px; padding: 13px; font: 700 15px system-ui, sans-serif; background: var(--hover, #eee); color: inherit; }
    .msheet .bar button.ok { background: var(--accent, #7a66ff); color: #fff; }
    .msheet .bar button.warn { background: var(--warn, #e5484d); color: #fff; }
    .msheet p { margin: 4px 18px 8px; font: 15px/1.45 system-ui, sans-serif; }`;
  document.head.appendChild(css);

  // The overlay WebView lives in a background service, which can't open Android's own
  // pop-ups: <select> lists, the time picker and confirm() boxes do nothing. Those
  // controls ignore taps here (see the CSS above) and get in-page sheets instead.
  function sheet(title, build) {
    const bg = document.createElement('div');
    bg.className = 'msheet-bg';
    const box = document.createElement('div');
    box.className = 'msheet';
    if (title) { const h = document.createElement('h3'); h.textContent = title; box.appendChild(h); }
    bg.appendChild(box);
    // the host's close (✕) button sits over the sheet's buttons: hide it meanwhile
    const tellHost = (open) => window.parent.postMessage({ buddy: 'sheet', open }, '*');
    const close = () => { bg.remove(); tellHost(!!document.querySelector('.msheet-bg')); };
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    build(box, close);
    document.body.appendChild(bg);
    tellHost(true);
  }
  function button(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }
  function bar(...buttons) {
    const d = document.createElement('div');
    d.className = 'bar';
    d.append(...buttons);
    return d;
  }
  function commit(input, value) {
    if (input.value === value) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function labelFor(input) {
    const l = input.closest('label');
    const t = l && (l.querySelector('span') || l.firstChild);
    return (t && t.textContent.trim()) || (input.type === 'time' ? 'Time' : 'Choose');
  }

  function pickOption(sel) {
    sheet(labelFor(sel), (box, close) => {
      const opts = document.createElement('div');
      opts.className = 'opts';
      for (const o of sel.options) {
        if (o.hidden) continue;
        const b = button(o.textContent, 'opt' + (o.value === sel.value ? ' on' : ''), () => { close(); commit(sel, o.value); });
        b.disabled = o.disabled;
        opts.appendChild(b);
      }
      box.append(opts, bar(button('Cancel', '', close)));
      setTimeout(() => { const on = opts.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' }); }, 0);
    });
  }

  function pickTime(input) {
    const pad = (n) => String(n).padStart(2, '0');
    let [h, m] = (input.value || '').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) { const d = new Date(Date.now() + 10 * 60000); h = d.getHours(); m = d.getMinutes(); }
    const fmt = () => `${(h % 12) || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
    sheet(labelFor(input), (box, close) => {
      const preview = document.createElement('div');
      preview.className = 'preview';
      preview.textContent = fmt();
      const cols = document.createElement('div');
      cols.className = 'cols';
      const column = (count, cur, set, hint) => {
        const c = document.createElement('div');
        c.className = 'col';
        for (let i = 0; i < count; i++) {
          const b = button(pad(i), 'opt' + (i === cur ? ' on' : ''), (e) => {
            for (const x of c.children) x.classList.remove('on');
            e.currentTarget.classList.add('on');
            set(i); preview.textContent = fmt();
          });
          if (hint) b.appendChild(Object.assign(document.createElement('small'), { textContent: hint(i) }));
          c.appendChild(b);
        }
        cols.appendChild(c);
        setTimeout(() => { const on = c.querySelector('.on'); if (on) c.scrollTop = on.offsetTop - c.clientHeight / 2 + on.offsetHeight / 2; }, 0);
      };
      column(24, h, (v) => { h = v; }, (i) => `${(i % 12) || 12} ${i < 12 ? 'AM' : 'PM'}`);
      column(60, m, (v) => { m = v; });
      box.append(preview, cols, bar(button('Cancel', '', close), button('Set time', 'ok', () => { close(); commit(input, `${pad(h)}:${pad(m)}`); })));
    });
  }

  // which picker-type control is under the finger (they ignore taps themselves)
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.msheet-bg')) return;
    for (const el of document.querySelectorAll('select, input[type="time"]')) {
      if (el.disabled || !el.offsetParent) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      e.preventDefault(); e.stopPropagation();
      if (el.tagName === 'SELECT') pickOption(el); else pickTime(el);
      return;
    }
  }, true);

  // confirm(): answer "no" now, ask in a sheet, and on "yes" repeat the tap that asked
  let lastTap = null, allowNext = false;
  document.addEventListener('click', (e) => { lastTap = e.target; }, true);
  window.confirm = (msg) => {
    if (allowNext) { allowNext = false; return true; }
    const target = lastTap;
    sheet('', (box, close) => {
      const p = document.createElement('p');
      p.textContent = String(msg);
      box.append(p, bar(button('Cancel', '', close), button('Yes', 'warn', () => {
        close();
        allowNext = true;
        if (target && target.isConnected) target.click();
        allowNext = false;
      })));
    });
    return false;
  };
  window.alert = (msg) => {
    sheet('', (box, close) => {
      const p = document.createElement('p');
      p.textContent = String(msg);
      box.append(p, bar(button('OK', 'ok', close)));
    });
  };
})();
