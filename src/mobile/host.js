/*
 * Desktop Buddies — the phone app's "main process". On the desktop, Electron's
 * main.js runs the simulation and streams snapshots to an overlay window; on a
 * phone everything lives in one page: this file runs the same simulation
 * (sim.js, bundled from src/main) and feeds the same overlay renderer
 * (src/renderer/overlay.js) through a stand-in for the `catAPI` bridge.
 *
 * Touch: tap = click, drag = pick up, long-press = the right-click menu.
 * On Android (window.AndroidBridge, see android/) the overlay floats over other
 * apps and lets touches through except on the character ("hit" mode), and takes
 * the whole screen while a menu, panel, tool or the home screen is open.
 */
(function () {
  'use strict';
  const S = window.BuddySim;
  const { World, DEFAULT_SETTINGS } = S.require('main/world.js');
  const { HeroWorld } = S.require('main/ironman.js');
  const HEROES = S.require('main/heroes/index.js');
  const { Reminders } = S.require('main/reminders.js');
  const { Geo } = S.require('main/geometry.js');
  const { editionFor } = S.require('main/editions.js');

  const A = window.AndroidBridge || null; // present inside the Android app
  const EDITION = editionFor(window.BUDDY_EDITION);
  const CHARACTERS = EDITION.characters;
  const APP_NAME = EDITION.appName;
  const SAVE_KEY = `buddies-save-${EDITION.id}`;
  const isHero = (ch) => ch !== 'cat';
  const nameOf = (ch) => (ch === 'cat' ? 'Cat' : HEROES[ch].NAME);

  const ALL_DEFAULTS = {
    ...DEFAULT_SETTINGS,
    character: CHARACTERS[0], voice: true, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true,
    rightClick: 'cat', launchAtLogin: false,
    ...Object.assign({}, ...Object.values(HEROES).map((H) => H.DEFAULTS)),
    ...(EDITION.defaults || {}),
  };

  // ------------------------------------------------------------ the catAPI stand-in
  const handlers = {};
  const emit = (ch, data) => { for (const fn of handlers[ch] || []) { try { fn(data); } catch (e) { console.error(ch, e); } } };
  window.catAPI = {
    on(ch, fn) { (handlers[ch] = handlers[ch] || []).push(fn); },
    send(ch, data) { onSend(ch, data); },
    invoke(ch) { return ch === 'home:get' ? Promise.resolve(homePayload()) : Promise.reject(new Error('blocked')); },
  };

  // ------------------------------------------------------------ screen geometry
  function insets() {
    try { return A ? JSON.parse(A.insets()) : { top: 0, bottom: 0 }; } catch (e) { return { top: 0, bottom: 0 }; }
  }
  function display() {
    const w = window.innerWidth, h = window.innerHeight, ins = insets();
    return { id: 1, bounds: { x: 0, y: 0, width: w, height: h }, workArea: { x: 0, y: ins.top, width: w, height: h - ins.top - ins.bottom }, primary: true, scaleFactor: window.devicePixelRatio || 1 };
  }
  const geo = new Geo();
  geo.set([display()]);
  document.documentElement.style.setProperty('--inset-bottom', `${insets().bottom || 0}px`);

  // ------------------------------------------------------------ save
  function load() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }
  function save() {
    if (!world) return;
    lastSaveAt = Date.now();
    const out = { version: 2, savedAt: Date.now(), settings, reminders: reminders.serialize() };
    for (const [ch, w] of Object.entries(worlds)) out[ch] = w.serialize();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch (e) { /* storage full / blocked */ }
  }

  // ------------------------------------------------------------ worlds
  const data = load();
  const v2 = data && data.version === 2;
  const settings = { ...ALL_DEFAULTS, ...((v2 && data.settings) || {}) };
  if (!CHARACTERS.includes(settings.character)) settings.character = CHARACTERS[0];
  if (EDITION.catExtras && settings.catLook !== 1) {
    settings.catLook = 1;
    Object.assign(settings, EDITION.defaults);
  }
  const worlds = {};
  for (const ch of CHARACTERS) {
    if (ch === 'cat') worlds.cat = new World({ geo, data: v2 ? data.cat : null, settings, desktopItems: () => [], emit: (e) => onWorldEvent(e, 'cat'), extras: !!EDITION.catExtras });
    else worlds[ch] = new HeroWorld({ geo, heroClass: HEROES[ch], data: v2 ? data[ch] : null, settings, emit: (e) => onWorldEvent(e, ch), sysinfo: sysinfo });
  }
  let world = worlds[settings.character];
  if (isHero(settings.character) && !(v2 && data[settings.character])) world.activate();
  const reminders = new Reminders(v2 ? data.reminders : [], onReminder);
  if (v2 && data.savedAt && worlds.cat) { const away = (Date.now() - data.savedAt) / 1000; if (away > 60) worlds.cat.applyAway(away); }
  let lastSaveAt = Date.now();

  function sysinfo() {
    const n = navigator;
    return { platform: 'Android phone', cpu: null, cores: n.hardwareConcurrency || '?', memGB: n.deviceMemory || '?', mem: null, uptime: `${Math.round(performance.now() / 60000)} min` };
  }

  function onWorldEvent(e, from) {
    if (from && worlds[from] !== world && e.type !== 'notify') return;
    if (e.type === 'sound') { if (settings.sound) emit('sound', e); }
    else if (e.type === 'fx') emit('fx', e);
    else if (e.type === 'notify') notify(e.title, e.body);
    else if (e.type === 'focusDone') onFocusDone(e);
  }

  function notify(title, body) {
    if (A) { try { A.notify(String(title), String(body || '')); } catch (e) { /* */ } }
    else console.log('[notify]', title, body);
  }

  // ------------------------------------------------------------ reminders & focus (same as the desktop)
  const CAT_QUIPS = ['I sat right here so you wouldn\'t forget. 🐾', 'Do it now and I\'ll purr for you.', 'Then we can nap. Deal?', 'I\'m not moving until you do it.', 'Meow means now.'];
  const timeLabel = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  function onReminder(a) {
    const ch = settings.character;
    const when = timeLabel(a.time);
    const R = isHero(ch) ? HEROES[ch].REMINDER : null;
    const quips = R ? R.quips : CAT_QUIPS;
    const quip = quips[Math.floor(Math.random() * quips.length)];
    world.announce({
      id: a.id, text: a.text, time: when, character: ch, snoozed: !!a.snoozed,
      header: R ? R.header : `Meow! It's ${when}`, quip,
      speech: R ? R.speech(when, a.text, quip.replace(/[🐾]/gu, '')) : `It's ${when}. ${a.text}.`,
    });
    notify(R ? R.notify(a.text) : `⏰ ${a.text}`, `${when} — ${quip}`);
  }
  function onFocusDone(e) {
    const quips = ['Break time — come play with me!', 'Stretch your legs. I already did.', 'Good work! Now a treat… for me?'];
    const quip = quips[Math.floor(Math.random() * quips.length)];
    world.announce({
      id: '__focus', text: `${e.minutes} minutes of focus — done!`, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), character: 'cat',
      header: '🍅 Focus session complete', quip, speech: `${e.minutes} minutes of focus. Done! ${quip}`,
      buttons: [['Take a break ✓', 'reminderDone', null, true], ['Focus 25 more', 'focus', { minutes: 25 }]],
    });
    notify('🍅 Focus session complete', `${e.minutes} minutes done. ${quip}`);
  }
  function resolveReminder(id, action, minutes) { world.clearAnnouncement(id); reminders.resolve(id, action, minutes); save(); }

  // ------------------------------------------------------------ characters, menu, commands
  function setCharacter(name) {
    if (!CHARACTERS.includes(name) || worlds[name] === world) return;
    const ann = world.announcement;
    world.deactivate(); world.clearAnnouncement();
    settings.character = name;
    world = worlds[name];
    world.activate();
    if (ann) world.announce(ann);
    closeMenu();
    save();
  }

  let menuId = 0, menuOpen = false, lastMenu = 0;
  function openMenu(p) {
    const t = Date.now();
    if (t - lastMenu < 350) return;
    lastMenu = t;
    menuId++;
    menuOpen = true;
    emit('menu:open', {
      id: menuId, x: p.x, y: p.y, ctx: world.contextAt(p), native: false, hook: true, hookNeedsPermission: false,
      character: settings.character,
      heroItems: world.hero ? world.hero.menuItems() : null,
      armyNotes: world.hero ? world.armyNotes() : null,
      heroName: world.hero ? world.H.NAME : null,
      homeLabel: world.hero ? world.H.HOME : 'Cat Home',
      characters: CHARACTERS.map((id) => ({ id, name: nameOf(id) })),
      appName: APP_NAME, shortcut: null, mods: null,
    });
    updateTouch();
  }
  function closeMenu() { if (!menuOpen) return; menuOpen = false; emit('menu:close'); updateTouch(); }

  function handleCmd(name, args) {
    args = args || {};
    switch (name) {
      case 'home': openHome(args.tab); break;
      case 'quit': save(); if (A) A.stop(); break;
      case 'hide': save(); if (A) A.stop(); break;
      case 'show': break;
      case 'putAway': world.command('putAwayToys'); world.command('putAwayBed'); break;
      case 'enableHook': break;
      case 'character': setCharacter(args.name); break;
      case 'setting':
        if (!(args.key in ALL_DEFAULTS) || args.key === 'character') break;
        settings[args.key] = args.value;
        for (const w of Object.values(worlds)) w.onSetting(args.key, args.value);
        break;
      case 'reminderAdd': reminders.add(args); save(); break;
      case 'reminderUpdate': reminders.update(args.id, args.patch); save(); break;
      case 'reminderRemove': if (world.announcement && world.announcement.id === args.id) world.clearAnnouncement(args.id); reminders.remove(args.id); save(); break;
      case 'reminderTest': { const r = reminders.list.find((x) => x.id === args.id); if (r) { closeHome(); onReminder({ id: '__test', text: r.text, time: r.time }); } break; }
      case 'reminderDone': if (args.id === '__test' || args.id === '__focus') world.clearAnnouncement(args.id); else resolveReminder(args.id, 'done'); break;
      case 'reminderSnooze': if (args.id === '__test' || args.id === '__focus') world.clearAnnouncement(args.id); else resolveReminder(args.id, 'snooze', args.minutes || 5); break;
      default: world.command(name, args);
    }
    if (['rename', 'setting', 'adopt', 'resetCat', 'quiet', 'character', 'wear'].includes(name)) save();
    updateTouch();
  }

  function homePayload() {
    return {
      ...world.homeState(), character: settings.character, settings,
      reminders: reminders.serialize(), upcoming: reminders.upcoming(),
      others: Object.fromEntries(Object.entries(worlds).map(([ch, w]) => [ch, w.info()])),
      characters: CHARACTERS.map((id) => ({ id, name: nameOf(id), home: id === 'cat' ? 'Cat Home' : HEROES[id].HOME })),
      appName: APP_NAME, hidden: false, hook: { ok: true }, platform: 'android', shortcut: '', version: '2.2.0',
    };
  }

  // ------------------------------------------------------------ the overlay talks back
  let pressing = null; // { x, y, t, timer } while a finger is down
  function onSend(ch, m) {
    if (ch === 'pointer' && m && typeof m.x === 'number') {
      if (m.type === 'down') pointerDown(m);
      else if (m.type === 'up') pointerUp(m);
    } else if (ch === 'context' && m) openMenu(m);
    else if (ch === 'ui' && m && m.id === menuId) { menuOpen = !!m.open; updateTouch(); }
    else if (ch === 'cmd' && m && typeof m.name === 'string') handleCmd(m.name, m.args);
  }

  // finger down: a press the world sees; held still for a moment it becomes the menu instead
  function pointerDown(p) {
    cursor = { x: p.x, y: p.y };
    world.setCursor(cursor, 0.016);
    world.pointerDown(p, 0);
    if (pressing) clearTimeout(pressing.timer);
    pressing = { x: p.x, y: p.y, t: Date.now() };
    pressing.timer = setTimeout(() => {
      if (!pressing || Math.hypot(cursor.x - pressing.x, cursor.y - pressing.y) > 14) return;
      if (world.cat && world.cat.mode === 'held') return;
      if (world.hero && world.hero.mode === 'held') return;
      world.press = null; // the long press is the menu, not a pick-up or a click
      pressing = null;
      if (A) try { A.vibrate(25); } catch (e) { /* */ }
      openMenu({ x: p.x, y: p.y });
    }, 520);
  }
  function pointerUp(p) {
    cursor = { x: p.x, y: p.y };
    if (pressing) { clearTimeout(pressing.timer); pressing = null; }
    world.pointerUp(p, 0);
  }

  // the cursor is wherever the finger last was
  let cursor = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  window.addEventListener('pointermove', (e) => { cursor = { x: e.clientX, y: e.clientY }; }, true);
  window.addEventListener('pointerdown', (e) => { cursor = { x: e.clientX, y: e.clientY }; }, true);

  // Android forwards touches from the small "hit" window over the character
  window.BuddyHost = {
    touch(type, x, y) {
      cursor = { x, y };
      if (type === 'down') pointerDown({ x, y });
      else if (type === 'up' || type === 'cancel') pointerUp({ x, y });
    },
    back() { if (homeOpen) closeHome(); else if (menuOpen) closeMenu(); else if (world.tool) handleCmd('stopTool'); },
    menu() { openMenu({ x: window.innerWidth / 2, y: window.innerHeight * 0.4 }); },
    home() { openHome(); },
    save,
  };

  // ------------------------------------------------------------ home screen (home.html in a frame)
  let homeOpen = false, homeFrame = null, homeTimer = null, homeReady = false, homeTab = null;
  const STAY_IN_HOME = new Set(['setting', 'rename', 'character', 'wear', 'resetCat', 'adopt', 'enableHook', 'focusStop',
    'reminderAdd', 'reminderUpdate', 'reminderRemove', 'show']);
  const noWorldPress = (el) => { for (const ev of ['pointerdown', 'pointerup']) el.addEventListener(ev, (e) => e.stopPropagation()); };
  function openHome(tab) {
    closeMenu();
    if (!homeFrame) {
      const wrap = document.createElement('div');
      wrap.id = 'mobile-home';
      wrap.innerHTML = '<iframe src="../home/home.html?mobile=1" title="Home"></iframe><button class="mh-close" aria-label="Close">✕</button>';
      document.body.appendChild(wrap);
      homeFrame = wrap;
      wrap.querySelector('.mh-close').addEventListener('click', closeHome);
      noWorldPress(wrap);
    }
    homeFrame.style.display = '';
    homeOpen = true;
    const post = (msg) => { const f = homeFrame.querySelector('iframe'); if (f && f.contentWindow) f.contentWindow.postMessage(msg, '*'); };
    // a tab asked for before home.html has loaded is sent once it asks for its state
    if (tab) { if (homeReady) post({ buddy: 'event', ch: 'home:tab', data: tab }); else homeTab = tab; }
    clearInterval(homeTimer);
    homeTimer = setInterval(() => post({ buddy: 'event', ch: 'home:state', data: homePayload() }), 400);
    updateTouch();
  }
  function closeHome() {
    if (!homeFrame) return;
    homeFrame.style.display = 'none';
    homeOpen = false;
    clearInterval(homeTimer);
    save();
    updateTouch();
  }
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (!m || !m.buddy || !homeFrame) return;
    const f = homeFrame.querySelector('iframe');
    if (m.buddy === 'sheet') homeFrame.querySelector('.mh-close').style.display = m.open ? 'none' : '';
    else if (m.buddy === 'send' && m.ch === 'cmd' && m.data) {
      if (m.data.name === 'home') return;
      handleCmd(m.data.name, m.data.args);
      // the home screen covers the whole phone: get out of the way so the feeding,
      // toy, villain or army can be seen (settings and reminder edits stay put)
      if (!STAY_IN_HOME.has(m.data.name)) closeHome();
    } else if (m.buddy === 'invoke' && m.ch === 'home:get') {
      f.contentWindow.postMessage({ buddy: 'reply', id: m.id, data: homePayload() }, '*');
      homeReady = true;
      if (homeTab) { f.contentWindow.postMessage({ buddy: 'event', ch: 'home:tab', data: homeTab }, '*'); homeTab = null; }
    }
  });

  // ------------------------------------------------------------ Android: where may touches land?
  let touchKey = '', touchMode = '', touchAt = 0;
  function panelsOpen() {
    for (const sel of ['.brief', '.armydlg']) for (const el of document.querySelectorAll(sel)) if (el.style.display !== 'none') return true;
    return false;
  }
  function updateTouch() {
    if (!A) return;
    let mode = 'hit', r = null;
    if (homeOpen) mode = 'focus';
    else if (menuOpen || panelsOpen() || world.tool) mode = 'full';
    else {
      const b = world.hero ? world.heroBox() : world.catBox();
      // a little bigger than the character, in 6-px steps so it isn't moved for every pixel
      if (b && !world.hidden) { const pad = 16, q = (v) => Math.round(v / 6) * 6; r = [q(b.x - pad), q(b.y - pad), q(b.w + pad * 2), q(b.h + pad * 2)]; }
    }
    const key = mode + (r ? r.join(',') : '');
    if (key === touchKey) return;
    // mode changes go through at once; the hit area follows the character at most ~20 times a second
    const now = Date.now();
    if (mode === touchMode && now - touchAt < 50) return;
    touchKey = key; touchMode = mode; touchAt = now;
    try { A.setTouch(mode, r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0, r ? r[3] : 0); } catch (e) { /* */ }
  }

  // ------------------------------------------------------------ "put it away" while a toy is out
  // (a toy follows the finger and takes every touch; phones have no Esc or right-click)
  let putAwayBtn = null;
  function syncPutAway() {
    const show = !!world.tool && !homeOpen && !menuOpen;
    if (!putAwayBtn) {
      if (!show) return;
      putAwayBtn = document.createElement('button');
      putAwayBtn.id = 'mobile-putaway';
      putAwayBtn.textContent = '✕ Put it away';
      putAwayBtn.addEventListener('click', () => handleCmd('stopTool'));
      noWorldPress(putAwayBtn);
      document.body.appendChild(putAwayBtn);
    }
    putAwayBtn.style.display = show ? '' : 'none';
  }

  // ------------------------------------------------------------ main loop
  let lastTick = Date.now(), lastSlow = 0;
  function tick() {
    const t = Date.now();
    const fast = !!(world.wantsFast() || menuOpen);
    if (!fast && t - lastTick < 31) return;
    const gap = (t - lastTick) / 1000;
    lastTick = t;
    if (gap > 5) world.tick(0.016, gap);
    else { const dt = Math.min(gap, 0.1); world.setCursor(cursor, dt); world.tick(dt); }
    emit('state', world.snapshot());
    if (t - lastSaveAt > 20000) save();
    if (t - lastSlow > 1000) {
      lastSlow = t;
      reminders.tick();
      const a = world.announcement;
      if (a && t - a.start > 10 * 60 * 1000) resolveReminder(a.id, 'done');
    }
    syncPutAway();
    updateTouch();
  }

  window.addEventListener('resize', () => {
    geo.set([display()]);
    for (const w of Object.values(worlds)) w.onDisplaysChanged();
    emit('init', { ...display(), platform: 'android', dev: false });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);

  // start once the overlay renderer has registered its handlers
  window.addEventListener('DOMContentLoaded', () => {
    // read reminders aloud with the phone's voice
    if (A && window.CatSound) {
      CatSound.speak = (text, character) => {
        const art = character !== 'cat' && window.HeroArts && HeroArts[character];
        const v = (art && art.voice) || { pitch: 1.45, rate: 1.05 };
        try { A.speak(String(text), v.pitch || 1, v.rate || 1); } catch (e) { /* */ }
      };
    }
    emit('init', { ...display(), platform: 'android', dev: false });
    setInterval(tick, 16);
    if (!(v2 && data.savedAt)) {
      const H = isHero(settings.character) ? HEROES[settings.character] : null;
      setTimeout(() => notify(H ? `${H.NAME} is here!` : '🐱 Your cat is here!', 'Tap to boop, drag to pick up, press and hold for the menu.'), 3000);
    }
  });
})();
