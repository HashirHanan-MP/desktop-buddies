/* Desktop Buddies — home window: character switcher, care / hero status, reminders, settings. */
(function () {
  'use strict';
  const api = window.catAPI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  let state = null;
  let editingName = false;
  let tab = 'cat';

  const cmd = (name, args) => api.send('cmd', { name, args: args || {} });
  const setting = (key, value) => cmd('setting', { key, value });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // ------------------------------------------------------------ static content
  const NEEDS = [['food', 'Food', '#ff9f43'], ['energy', 'Energy', '#5d7cf0'], ['fun', 'Fun', '#ff5fa2'], ['clean', 'Clean', '#2ec4b6'], ['health', 'Health', '#4cd964'], ['love', 'Love', '#ff6b8b']];
  const isHero = (ch) => ch && ch !== 'cat';
  const artOf = (ch) => (window.HeroArts && window.HeroArts[ch]) || window.HeroArts.ironman;
  const QUICK = [
    ['🐟', 'Fish', 'feed', { kind: 'fish' }], ['🍤', 'Treat', 'treat'], ['🛏️', 'Bed', 'bed'], ['⏰', 'Wake', 'wake'],
    ['🐭', 'Mouse', 'toyMouse', null, 'mouse'], ['🔴', 'Laser', 'laser', null, 'laser'], ['🧶', 'Yarn', 'yarn'], ['📦', 'Box', 'box'],
    ['✨', 'Clean all', 'cleanAll'], ['🧴', 'Fix all', 'fixAll'], ['🗂️', 'Tidy files', 'tidyFiles'], ['👋', 'Call', 'call'],
  ];
  const ENEMIES = [['🛸', 'Drone', 'drone'], ['🤖', 'Walker', 'walker'], ['🛞', 'Tank', 'tank'], ['🐝', 'Swarm', 'swarm'], ['👾', 'Boss', 'boss'], ['🧹', 'Clear', null]];
  const STATS = [['meals', 'meals eaten'], ['treats', 'treats'], ['pets', 'pets'], ['poopsCleaned', 'poops scooped'], ['scratchesFixed', 'scratches fixed'], ['filesTidied', 'files tidied'], ['miceCaught', 'mice caught'], ['laserPounces', 'laser pounces'], ['naps', 'naps']];
  const FUR = { white: '#ffffff', cream: '#f6e3c6', silver: '#c9cdd8', ginger: '#f5a65b', black: '#34353f' };
  const EYES = { blue: '#6cb6ff', green: '#8bd06a', amber: '#f3b443', odd: 'linear-gradient(90deg,#6cb6ff 50%,#f3b443 50%)' };

  function bars(container, defs) {
    for (const [k, label, color] of defs) {
      const row = el('div', 'need');
      row.dataset.k = k;
      row.append(el('span', 'lbl', label), el('span', 'bar'), el('span', 'pct'));
      const fill = el('span', 'fill');
      fill.style.background = color;
      row.querySelector('.bar').appendChild(fill);
      container.appendChild(row);
    }
  }
  function quick(container, defs) {
    for (const [e, label, name, args, toolKind] of defs) {
      const b = el('button', 'qa');
      b.dataset.tool = toolKind || '';
      b.append(el('span', 'e', e), el('span', '', label));
      b.addEventListener('click', () => cmd(name, args));
      container.appendChild(b);
    }
  }
  function stats(container, defs) {
    for (const [k, label] of defs) {
      const d = el('div', 'stat');
      d.dataset.k = k;
      d.append(el('b', '', '0'), el('span', '', label));
      container.appendChild(d);
    }
  }
  function swatches(container, map, key, titleFn) {
    for (const [k, col] of Object.entries(map)) {
      const b = el('button', 'sw');
      b.title = titleFn ? titleFn(k) : k; b.dataset.v = k; b.style.background = col;
      b.addEventListener('click', (ev) => { ev.preventDefault(); setting(key, k); });
      container.appendChild(b);
    }
  }

  bars($('#needs'), NEEDS);
  quick($('#quick'), QUICK);
  for (const [e, label, kind] of ENEMIES) {
    const b = el('button', 'qa');
    b.append(el('span', 'e', e), el('span', '', label));
    b.addEventListener('click', () => (kind ? cmd('spawn', { kind }) : cmd('clearEnemies')));
    $('#ironEnemies').appendChild(b);
  }
  stats($('#stats'), STATS);
  const armyNote = () => {
    const notes = state && state.ui && state.ui.armyNotes;
    $('#armyNote').textContent = notes ? notes[$('#armySize').value] || '' : '';
  };
  $('#armySize').addEventListener('change', armyNote);
  armyNote();
  $('#armyGo').addEventListener('click', () => cmd('army', { side: $('#armySide').value, size: $('#armySize').value, display: $('#armyScreen').value }));
  let screensKey = '';
  function renderScreens(list) {
    const key = JSON.stringify(list);
    if (key === screensKey) return;
    screensKey = key;
    const sel = $('#armyScreen');
    const prev = sel.value;
    sel.innerHTML = '';
    for (const d of list) sel.add(new Option(d.label, d.id));
    if (prev) sel.value = prev;
    const box = $('#nukeBtns');
    box.innerHTML = '';
    for (const d of list) {
      const b = el('button', 'qa nukebtn');
      b.append(el('span', 'e', '☢️'), el('span', '', d.label));
      b.addEventListener('click', () => cmd('nuke', { display: d.id }));
      box.appendChild(b);
    }
  }
  swatches($('#fur'), FUR, 'palette');
  swatches($('#eyes'), EYES, 'eyes', (k) => (k === 'odd' ? 'odd-eyed' : k));

  // ------------------------------------------------------------ the hero parts, rebuilt when the character changes
  function buildHero(s) {
    const ui = s.ui || {};
    const sb = $('#suitBars');
    sb.innerHTML = '';
    bars(sb, (s.hero.meters || []).map((m) => [m.k, m.label, m.color]));
    const q = $('#ironQuick');
    q.innerHTML = '';
    quick(q, ui.quick || []);
    const st = $('#ironStats');
    st.innerHTML = '';
    stats(st, ui.stats || []);
    const sw = $('#suits');
    sw.innerHTML = '';
    if (ui.looks) swatches(sw, Object.fromEntries(ui.looks.options.map(([k, , col]) => [k, col])), ui.looks.key, (k) => (ui.looks.options.find((o) => o[0] === k) || [k, k])[1]);
    $('#looksRow').style.display = ui.looks ? '' : 'none';
    $('#heroSize').dataset.k = ui.sizeKey || 'ironSize';
    const help = $('#heroHelp');
    help.innerHTML = '';
    for (const [title, html] of ui.help || []) {
      help.appendChild(el('h4', '', title));
      const para = el('p');
      para.innerHTML = html; // our own static guide text
      help.appendChild(para);
    }
    armyNote();
  }

  let switchKey = '';
  function renderSwitcher(s) {
    const list = s.characters || [];
    const key = JSON.stringify(list.map((c) => c.id));
    const box = $('#switcher');
    box.style.display = list.length > 1 ? '' : 'none';
    if (key === switchKey) return;
    switchKey = key;
    box.innerHTML = '';
    avs.length = 0;
    for (const c of list) {
      const b = el('button', 'char');
      b.dataset.char = c.id;
      const cv = document.createElement('canvas');
      cv.width = 32 * dpr; cv.height = 32 * dpr;
      const sp = el('span');
      sp.append(el('b', '', c.name), el('small', 'csub'));
      b.append(cv, sp);
      b.addEventListener('click', () => cmd('character', { name: c.id }));
      box.appendChild(b);
      avs.push({ cv, x: cv.getContext('2d'), who: c.id });
    }
  }

  // ------------------------------------------------------------ tabs & switcher
  function showTab(name) {
    tab = name;
    $$('.tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === name));
    $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  api.on('home:tab', (t) => showTab(t));

  // ------------------------------------------------------------ settings inputs
  $$('[data-k]').forEach((input) => {
    if (input.classList.contains('need') || input.classList.contains('stat')) return;
    input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
      setting(input.dataset.k, input.type === 'checkbox' ? input.checked : input.type === 'range' ? +input.value : input.value);
    });
  });
  const nameEl = $('#name');
  nameEl.addEventListener('focus', () => { editingName = true; });
  nameEl.addEventListener('blur', () => { editingName = false; if (nameEl.value.trim()) cmd('rename', { name: nameEl.value.trim() }); });
  nameEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameEl.blur(); if (e.key === 'Escape' && state && state.cat) { nameEl.value = state.cat.name; nameEl.blur(); } });
  $('#hookBtn').addEventListener('click', () => cmd('enableHook'));
  $('#reset').addEventListener('click', () => { if (confirm(`Rehome ${state && state.cat ? state.cat.name : 'your cat'} and adopt a brand-new kitten?`)) cmd('resetCat'); });
  $('#hideBtn').addEventListener('click', () => cmd(state && state.hidden ? 'show' : 'hide'));
  $('#quitBtn').addEventListener('click', () => cmd('quit'));
  for (const ev of ['dragover', 'drop']) window.addEventListener(ev, (e) => e.preventDefault());

  // ------------------------------------------------------------ reminders
  const pad = (n) => String(n).padStart(2, '0');
  const nowHM = (plus) => { const d = new Date(Date.now() + (plus || 0) * 60000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  $('#remTime').value = nowHM(10);
  function addReminder() {
    const text = $('#remText').value.trim();
    const time = $('#remTime').value;
    if (!text) { $('#remText').focus(); $('#remText').classList.add('shake'); setTimeout(() => $('#remText').classList.remove('shake'), 400); return; }
    if (!time) return;
    cmd('reminderAdd', { time, text, repeat: $('#remRepeat').value });
    $('#remText').value = '';
  }
  $('#remAdd').addEventListener('click', addReminder);
  $('#remText').addEventListener('keydown', (e) => { if (e.key === 'Enter') addReminder(); });
  $$('.rem-quick button').forEach((b) => b.addEventListener('click', () => {
    const m = +b.dataset.min;
    cmd('reminderAdd', { inMinutes: m, text: $('#remText').value.trim() || `${m >= 60 ? m / 60 + '-hour' : m + '-minute'} timer is up` });
    $('#remText').value = '';
  }));

  function dayLabel(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((dt - today) / 86400000);
    return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  let remKey = '';
  function renderReminders(list, upcoming, character) {
    const box = $('#remList');
    const key = JSON.stringify(list.map((r) => [r.id, r.time, r.text, r.repeat, r.enabled, r.done, r.snoozeUntil, r.date])) + character;
    const focused = box.contains(document.activeElement);
    if (key !== remKey && !focused) {
      remKey = key;
      box.innerHTML = '';
      for (const r of list) {
        const row = el('div', 'rem' + (r.enabled ? '' : ' off'));
        const t = el('input'); t.type = 'time'; t.value = r.time;
        t.addEventListener('change', () => t.value && cmd('reminderUpdate', { id: r.id, patch: { time: t.value } }));
        const tx = el('input', 'rem-text'); tx.value = r.text; tx.maxLength = 200;
        tx.addEventListener('change', () => tx.value.trim() && cmd('reminderUpdate', { id: r.id, patch: { text: tx.value.trim() } }));
        tx.addEventListener('keydown', (e) => { if (e.key === 'Enter') tx.blur(); });
        const rp = el('select');
        for (const [v, l] of [['once', 'Once'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends']]) rp.add(new Option(l, v));
        rp.value = r.repeat;
        rp.addEventListener('change', () => cmd('reminderUpdate', { id: r.id, patch: { repeat: rp.value } }));
        const on = el('input', 'toggle'); on.type = 'checkbox'; on.checked = r.enabled; on.title = r.enabled ? 'On' : 'Off';
        on.addEventListener('change', () => cmd('reminderUpdate', { id: r.id, patch: { enabled: on.checked } }));
        const test = el('button', 'icon test', '▶'); test.title = 'Preview now';
        test.addEventListener('click', () => cmd('reminderTest', { id: r.id }));
        const del = el('button', 'icon del', '✕'); del.title = 'Delete';
        del.addEventListener('click', () => cmd('reminderRemove', { id: r.id }));
        const metaText = r.done ? 'done' : r.snoozeUntil ? `snoozed until ${new Date(r.snoozeUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : r.repeat === 'once' && r.date ? dayLabel(r.date) : '';
        row.append(t, tx, rp, on, test, del, el('div', 'rem-meta', metaText));
        box.appendChild(row);
      }
    }
    $('#remEmpty').style.display = list.length ? 'none' : '';
    const nx = $('#remNext');
    if (upcoming) {
      const d = new Date(upcoming.at);
      const mins = Math.round((upcoming.at - Date.now()) / 60000);
      const rel = mins < 60 ? `in ${Math.max(0, mins)} min` : mins < 1440 ? `in ${Math.floor(mins / 60)} h ${mins % 60} min` : d.toLocaleDateString([], { weekday: 'short' });
      nx.textContent = (character === 'ironman' ? 'NEXT MISSION · ' : 'Next: ') + `${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (${rel}) — ${upcoming.text}`;
      nx.style.display = '';
    } else nx.style.display = 'none';
  }

  // ------------------------------------------------------------ apply state
  function ageText(born, until) {
    const ms = (until || Date.now()) - born;
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000);
    if (d >= 1) return `${d} day${d > 1 ? 's' : ''} old`;
    if (h >= 1) return `${h} hour${h > 1 ? 's' : ''} old`;
    return `${Math.max(1, m)} minute${m > 1 ? 's' : ''} old`;
  }

  function setBars(container, values, low) {
    for (const row of container.children) {
      const v = Math.round(values[row.dataset.k] || 0);
      row.querySelector('.fill').style.width = v + '%';
      row.querySelector('.pct').textContent = v + '%';
      row.classList.toggle('low', v < (low || 20));
    }
  }

  function apply(s) {
    const prevChar = state && state.character;
    state = s;
    const ch = s.character;
    document.body.dataset.platform = s.platform;
    document.body.dataset.character = ch;
    document.body.dataset.theme = isHero(ch) ? artOf(ch).theme : 'cat';
    renderSwitcher(s);
    const me = (s.characters || []).find((c) => c.id === ch);
    if (ch !== prevChar) {
      if (tab !== 'reminders' && tab !== 'settings' && tab !== 'help') showTab(isHero(ch) ? 'suit' : 'cat');
      document.title = `${s.appName || 'Desktop Buddies'} — ${me ? me.home : 'Home'}`;
      if (isHero(ch)) buildHero(s);
    }
    $$('.char').forEach((b) => {
      b.classList.toggle('on', b.dataset.char === ch);
      const o = s.others && s.others[b.dataset.char];
      if (o) b.querySelector('.csub').textContent = b.dataset.char === 'cat' ? (o.dead ? 'resting' : o.name) : o.status;
    });
    $('#quitBtn').textContent = `Quit ${s.appName || 'Desktop Buddies'}`;
    if (isHero(ch)) {
      const h = s.hero;
      $('#heroName').textContent = artOf(ch).name;
      $('#age').textContent = h.title || '';
      $('#mood').textContent = h.status;
      setBars($('#suitBars'), Object.fromEntries((h.meters || []).map((m) => [m.k, m.v])));
      for (const d of $('#ironStats').children) d.querySelector('b').textContent = (s.counters[d.dataset.k] || 0).toLocaleString();
      renderScreens(s.displays || []);
      $('#armyGo').disabled = !!s.army;
      $('#armyGo').textContent = s.army ? 'Battle in progress…' : 'Launch';
      $$('.nukebtn').forEach((b) => { b.disabled = !!s.nuke; });
      const lk = s.ui && s.ui.looks && s.ui.looks.key;
      $$('#suits .sw').forEach((b) => b.classList.toggle('on', !!lk && b.dataset.v === s.settings[lk]));
    } else if (s.cat) {
      const c = s.cat;
      if (!editingName) nameEl.value = c.name;
      $('#age').textContent = c.dead ? `lived ${ageText(c.born, c.died).replace(' old', '')}` : ageText(c.born);
      $('#mood').textContent = c.dead ? 'resting in peace' : c.mood;
      setBars($('#needs'), c.stats);
      if (c.dead) $$('#needs .need').forEach((r) => r.classList.remove('low'));
      for (const b of $('#quick').children) b.classList.toggle('on', !!b.dataset.tool && s.tool === b.dataset.tool);
      for (const d of $('#stats').children) d.querySelector('b').textContent = (s.counters[d.dataset.k] || 0).toLocaleString();
      $$('#fur .sw').forEach((b) => b.classList.toggle('on', b.dataset.v === s.settings.palette));
      $$('#eyes .sw').forEach((b) => b.classList.toggle('on', b.dataset.v === c.eyes));
      renderMemorial(s.memorial || []);
    }
    $$('select[data-k], input[data-k]').forEach((input) => {
      if (document.activeElement === input) return;
      const v = s.settings[input.dataset.k];
      if (input.type === 'checkbox') input.checked = !!v;
      else if (v != null) input.value = v;
    });
    $('#hideBtn').textContent = s.hidden ? 'Show' : 'Hide';
    const mac = s.platform === 'darwin';
    const hk = s.hook || {};
    $('#hookRow').style.display = s.settings.rightClick === 'cat' ? 'none' : '';
    $('#hookStatus').textContent = hk.ok ? 'Active — right-click anywhere opens the menu.'
      : hk.reason === 'permission' ? (mac ? 'Needs Accessibility permission (System Settings → Privacy & Security → Accessibility).' : 'Not available.')
      : hk.reason === 'unavailable' ? 'Not available on this system — right-click the character or use the tray icon.'
      : 'Not running.';
    $('#hookBtn').style.display = hk.ok ? 'none' : '';
    $$('.sc').forEach((e) => { e.textContent = s.shortcut || ''; });
    renderReminders(s.reminders || [], s.upcoming, ch);
  }

  let memKey = '';
  function renderMemorial(list) {
    const key = JSON.stringify(list);
    if (key === memKey) return;
    memKey = key;
    const box = $('#memorial');
    box.innerHTML = '';
    $('#memEmpty').style.display = list.length ? 'none' : '';
    for (const m of [...list].reverse()) {
      const d = el('div', 'mem');
      const cv = document.createElement('canvas');
      cv.width = 108; cv.height = 88;
      const t = el('div');
      t.appendChild(el('b', '', (m.cause === 'rehomed' ? '🏡 ' : '🌈 ') + m.name));
      const days = Math.max(1, Math.round((m.died - m.born) / 86400000));
      t.appendChild(el('span', '', `${new Date(m.born).toLocaleDateString()} – ${new Date(m.died).toLocaleDateString()} · ${days} day${days > 1 ? 's' : ''}${m.cause === 'rehomed' ? ' · rehomed' : ''}`));
      d.append(cv, t);
      box.appendChild(d);
      const x = cv.getContext('2d');
      x.translate(54, 80); x.scale(1.1, 1.1);
      CatArt.drawCat(x, CatArt.makePose('curl', { t: 0, T: 1, phase: 0, m: {} }), { eyes: 'closed' }, { T: 1, palette: m.palette, eyes: m.eyes });
    }
  }

  // ------------------------------------------------------------ live portraits
  const dpr = window.devicePixelRatio || 1;
  const pc = $('#portrait');
  pc.width = 150 * dpr; pc.height = 95 * dpr;
  const px = pc.getContext('2d');
  const avs = $$('canvas[data-av]').map((cv) => { cv.width = 32 * dpr; cv.height = 32 * dpr; return { cv, x: cv.getContext('2d'), who: cv.dataset.av }; });

  function drawCatPortrait(ctx, c, T, scale) {
    const st = c.stats;
    let name = 'sitFront', face = { eyes: 'normal', mouth: 'w', blush: 0.3, lookY: 0.1 };
    if (c.dead) { name = 'curl'; face = { eyes: 'closed' }; ctx.globalAlpha = 0.5; }
    else if (c.sleeping) { name = 'curl'; face = { eyes: 'closed' }; }
    else if (st.health < 30) { name = 'lieSide'; face = { eyes: 'sad', open: 0.4, mouth: 'frown', sweat: 1 }; }
    else if (st.food < 20) face = { eyes: 'sparkle', mouth: 'o', pupil: 1 };
    else if (st.energy < 25) face = { eyes: 'normal', open: 0.4, mouth: 'w' };
    else if (st.fun > 70 && st.love > 50) face = { eyes: 'happy', mouth: 'smile', blush: 0.6 };
    if (!c.dead && !c.sleeping && Math.sin(T * 0.9) > 0.985) face = Object.assign({}, face, { open: 0.05 });
    const pose = CatArt.makePose(name, { t: T, T, phase: 0, m: { tailUp: st.fun > 50 ? 0.8 : 0.2, thin: st.food < 25 ? (25 - st.food) / 25 : 0 } });
    ctx.scale(scale, scale);
    CatArt.drawCat(ctx, pose, face, { T, palette: c.palette, eyes: c.eyes });
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    // gentle when the window isn't in front
    const gap = document.hidden ? 1000 : document.hasFocus() ? 50 : 200;
    if (!state || now - last < gap) return;
    last = now;
    const T = now / 1000;
    px.setTransform(dpr, 0, 0, dpr, 0, 0);
    px.clearRect(0, 0, 150, 95);
    px.save();
    if (isHero(state.character)) {
      const ART = artOf(state.character);
      const look = state.ui && state.ui.looks ? state.settings[state.ui.looks.key] : null;
      px.fillStyle = ART.shadowTint || 'rgba(90,220,255,0.14)';
      px.beginPath(); px.ellipse(75, 91, 40, 4, 0, 0, Math.PI * 2); px.fill();
      px.translate(75, 91);
      if (ART.drawPortrait) ART.drawPortrait(px, state, T, look);
      else {
        px.scale(0.92, 0.92);
        const pose = state.hero.mode === 'down' ? 'down' : Math.sin(T * 0.25) > 0.6 ? 'thumbsUp' : 'stand';
        const rig = ART.makeRig(pose, { t: T % 4, T, phase: 0, m: {} });
        rig.turn = Math.max(rig.turn, 0.55);
        ART.drawHero(px, rig, { suit: look, look, T });
      }
    } else if (state.cat) {
      px.fillStyle = 'rgba(0,0,0,0.1)';
      px.beginPath(); px.ellipse(75, 88, 46, 5, 0, 0, Math.PI * 2); px.fill();
      px.translate(75, 88);
      drawCatPortrait(px, state.cat, T, 1.15);
    }
    px.restore();
    for (const a of avs) {
      a.x.setTransform(dpr, 0, 0, dpr, 0, 0);
      a.x.clearRect(0, 0, 32, 32);
      a.x.save();
      if (isHero(a.who)) {
        const ART = artOf(a.who);
        const key = ART.lookKey;
        const look = key ? state.settings[key] : null;
        a.x.scale(32 / 46, 32 / 46);
        if (ART.drawAvatar) ART.drawAvatar(a.x, look, T);
        else { a.x.translate(21, 108); a.x.scale(0.95, 0.95); ART.drawBust(a.x, look, T); }
      } else {
        a.x.translate(16, 41); a.x.scale(0.52, 0.52);
        CatArt.drawCat(a.x, CatArt.makePose('sitFront', { t: T, T, phase: 0, m: {} }), { eyes: 'normal', blush: 0.3 }, { T, palette: state.settings.palette, eyes: (state.cat && state.cat.eyes) || 'blue' });
      }
      a.x.restore();
    }
  }
  requestAnimationFrame(frame);

  api.on('home:state', apply);
  api.invoke('home:get').then(apply);
})();
