/*
 * Desktop Buddies — the right-click menu (rendered inside the overlay).
 * The cat's menu is built here; a hero's own items come from the main process
 * (Hero.menuItems) and are wrapped with the shared enemy / army / nuke items.
 */
(function (root) {
  'use strict';
  const api = root.catAPI;
  let rootEl = null, panel = null, flyout = null, flyFor = null;
  let isOpen = false, origin = null, info = null, bounds = null, getState = null, menuId = 0;
  let hoverTimer = null, closeTimer = null, meterTimer = null, lastInside = 0;

  const TOOL_LABEL = { scoop: 'Poop scoop', repair: 'Repair spray', brush: 'Brush', mouse: 'Mouse chase', laser: 'Laser pointer', treat: 'Treat in hand', feather: 'Feather wand' };
  const CHAR_ICON = { cat: '🐱', ironman: '🦾', thor: '⚡', homelander: '🦅', hulk: '👊', spiderman: '🕷️' };
  const isHero = (s) => s.character !== 'cat';
  const artOf = (ch) => (root.HeroArts && root.HeroArts[ch]) || root.HeroArts.ironman;
  const appName = () => (info && info.appName) || 'Desktop Buddies';

  // "Switch to …" for an edition with more than one character
  function switchItems(current) {
    const others = ((info && info.characters) || []).filter((c) => c.id !== current);
    if (!others.length) return [];
    if (others.length === 1) return [{ icon: CHAR_ICON[others[0].id] || '✨', label: `Switch to ${others[0].name}`, cmd: 'character', args: { name: others[0].id } }];
    return [{ icon: '🔁', label: 'Switch character', sub: others.map((c) => ({ icon: CHAR_ICON[c.id] || '✨', label: c.name, cmd: 'character', args: { name: c.id } })) }];
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function init(rootElement, boundsGetter, stateGetter) {
    rootEl = rootElement;
    bounds = boundsGetter;
    getState = stateGetter;
    document.addEventListener('pointermove', () => {
      if (isOpen) lastInside = Date.now();
    });
  }

  function heroItems(s) {
    const n = s.enemies.length;
    const name = (info && info.heroName) || 'the hero';
    const out = [];
    out.push({
      icon: '🎯', label: 'Deploy enemy', badge: n || null, hint: 'right here',
      sub: [
        { icon: '🛸', avatar: 'drone', label: 'Ultron sentry', cmd: 'spawn', args: { kind: 'drone' }, hint: 'flying · twin blasts' },
        { icon: '🤖', avatar: 'walker', label: 'Ultron soldier', cmd: 'spawn', args: { kind: 'walker' }, hint: 'burst fire' },
        { icon: '🦾', avatar: 'tank', label: 'Ultron Prime', cmd: 'spawn', args: { kind: 'tank' }, hint: 'plasma shells · blast fan' },
        { icon: '🐝', avatar: 'mini', label: 'Ultron swarm', cmd: 'spawn', args: { kind: 'swarm' }, hint: '6 kamikaze drones' },
        '-',
        { icon: '💎', avatar: 'thanos', label: 'Thanos', cmd: 'spawn', args: { kind: 'thanos' }, hint: 'boss · Infinity Stones, the snap' },
        { icon: '🟢', avatar: 'doom', label: 'Doctor Doom', cmd: 'spawn', args: { kind: 'doom' }, hint: 'boss · Doombots, lightning storm' },
        { icon: '⏳', avatar: 'kang', label: 'Kang the Conqueror', cmd: 'spawn', args: { kind: 'kang' }, hint: 'boss · time freeze, portals' },
        { icon: '🪐', avatar: 'galactus', label: 'Galactus', cmd: 'spawn', args: { kind: 'galactus' }, hint: 'giant boss · drains power' },
        '-',
        { icon: '🧹', label: n ? `Clear all enemies (${n})` : 'No enemies', cmd: 'clearEnemies', disabled: !n },
      ],
    });
    out.push({ icon: '⚔️', label: 'Army attack…', local: 'army', hint: s.army ? 'battle in progress' : 'pick side & size', disabled: !!s.army });
    out.push({ icon: '☢️', label: s.nuke ? 'Nuke in progress…' : 'Drop a nuke here', cmd: 'nuke', hint: s.nuke ? '' : 'this whole screen', disabled: !!s.nuke, danger: !s.nuke });
    for (const it of (info && info.heroItems) || []) out.push(it);
    out.push({ icon: '⏰', label: 'Reminders…', cmd: 'home', args: { tab: 'reminders' }, hint: 'time + task' });
    out.push(...switchItems(s.character));
    out.push('-');
    out.push({ icon: s.quiet ? '🔋' : '🌙', label: s.quiet ? 'Exit stand-by' : 'Stand-by mode', cmd: 'quiet', hint: s.quiet ? '' : 'no fights, no noise' });
    out.push({ icon: '🏠', label: `${(info && info.homeLabel) || 'HQ'}…`, cmd: 'home', hint: 'stats & settings' });
    if (info && info.hookNeedsPermission) out.push({ icon: '🖱️', label: 'Enable right-click anywhere…', cmd: 'enableHook' });
    out.push({
      icon: '⋯', label: 'More',
      sub: [
        { icon: '👻', label: `Hide ${name}`, cmd: 'hide', hint: 'tray icon brings it back' },
        { icon: '⏻', label: `Quit ${appName()}`, cmd: 'quit', danger: true },
      ],
    });
    return out;
  }

  function items(s, ctx) {
    if (isHero(s)) return heroItems(s, ctx);
    const c = s.cat, e = s.ents, tool = s.tool && s.tool.kind;
    const poops = e.poops.length, scratches = e.scratches.filter((x) => !x.fixing).length, files = e.files.length;
    const st = c.stats;
    const out = [];
    if (c.dead) {
      out.push({ icon: '🌸', label: 'Lay flowers', cmd: 'flowers' });
      out.push({ icon: '🐱', label: 'Adopt a new kitten', cmd: 'adopt', accent: true });
      if (e.grave) out.push({ icon: '🕊️', label: 'Move memorial to Cat Home', cmd: 'removeGrave' });
      out.push('-');
      out.push(...switchItems('cat'));
      out.push({ icon: '🏠', label: 'Cat Home…', cmd: 'home' });
      out.push({ icon: '⏻', label: `Quit ${appName()}`, cmd: 'quit', danger: true });
      return out;
    }
    if (tool) out.push({ icon: '✋', label: `Put away ${TOOL_LABEL[tool] || 'tool'}`, cmd: 'stopTool', accent: true, hint: 'Esc' });
    out.push({
      icon: '🍽️', label: 'Feed', badge: st.food < 35 ? '!' : null, urgent: st.food < 20,
      sub: [
        { icon: '🐟', label: 'Fish', cmd: 'feed', args: { kind: 'fish' }, hint: 'favourite' },
        { icon: '🥣', label: 'Kibble', cmd: 'feed', args: { kind: 'kibble' } },
        { icon: '🍗', label: 'Chicken', cmd: 'feed', args: { kind: 'chicken' }, hint: 'filling' },
        { icon: '🥛', label: 'Milk', cmd: 'feed', args: { kind: 'milk' }, hint: 'a little' },
        '-',
        { icon: '🍤', label: 'Give a treat by hand', cmd: 'treat', hint: 'cursor holds it' },
      ],
    });
    out.push({
      icon: '🧹', label: 'Clean up', badge: poops || null, urgent: poops && st.clean < 30,
      sub: [
        { icon: '🥄', label: poops ? `Scoop poop (${poops})` : 'Nothing to scoop', cmd: 'scoop', disabled: !poops, hint: 'click each one' },
        { icon: '✨', label: 'Clean everything', cmd: 'cleanAll', disabled: !poops },
      ],
    });
    if (c.sleeping) out.push({ icon: '⏰', label: `Wake ${c.name} up`, cmd: 'wake' });
    else out.push({ icon: '🛏️', label: 'Sleep — put a bed here', cmd: 'bed', badge: st.energy < 28 ? '!' : null, urgent: st.energy < 12 });
    out.push({
      icon: '🧶', label: 'Play', badge: st.fun < 25 ? '!' : null,
      sub: [
        { icon: '🐭', label: tool === 'mouse' ? 'Stop mouse chase' : 'Mouse chase', cmd: 'toyMouse', hint: 'your cursor becomes a mouse', checked: tool === 'mouse' },
        { icon: '🔴', label: tool === 'laser' ? 'Stop laser pointer' : 'Laser pointer', cmd: 'laser', checked: tool === 'laser' },
        { icon: '🧶', label: 'Yarn ball', cmd: 'yarn', hint: 'drag & throw it' },
        { icon: '📦', label: 'Cardboard box', cmd: 'box' },
        { icon: '🌿', label: 'Catnip', cmd: 'catnip', hint: 'silly time' },
        { icon: '🪮', label: tool === 'brush' ? 'Put brush away' : 'Brush fur', cmd: 'brush', hint: 'stroke the cat', checked: tool === 'brush' },
        ...(s.extras ? [{ icon: '🪶', label: tool === 'feather' ? 'Put the feather away' : 'Feather wand', cmd: 'feather', hint: 'dangle it — it leaps!', checked: tool === 'feather', disabled: !!s.focus }] : []),
      ],
    });
    if (s.extras) out.push(...extraItems(s));
    out.push({
      icon: '🛠️', label: 'Fix the screen', badge: scratches + files || null,
      sub: [
        { icon: '🧴', label: scratches ? `Repair scratches (${scratches})` : 'No scratches', cmd: 'repair', disabled: !scratches, hint: 'click each one' },
        { icon: '✨', label: 'Fix all scratches', cmd: 'fixAll', disabled: !scratches },
        { icon: '🗂️', label: files ? `Tidy up files (${files})` : 'No files to tidy', cmd: 'tidyFiles', disabled: !files },
        '-',
        { icon: '🪵', label: 'Place a scratching post', cmd: 'post', hint: 'saves your screen' },
      ],
    });
    out.push({ icon: '👋', label: `Call ${c.name} here`, cmd: 'call' });
    out.push({ icon: '⏰', label: 'Reminders…', cmd: 'home', args: { tab: 'reminders' }, hint: 'time + task' });
    out.push(...switchItems('cat'));
    out.push('-');
    out.push({ icon: s.quiet ? '🔔' : '🤫', label: s.quiet ? 'End quiet time' : 'Quiet time', cmd: 'quiet', hint: s.quiet ? '' : 'naps, no mess' });
    out.push({ icon: '🏠', label: 'Cat Home…', cmd: 'home', hint: 'stats & settings' });
    if (info && info.hookNeedsPermission) out.push({ icon: '🖱️', label: 'Enable right-click anywhere…', cmd: 'enableHook' });
    out.push({
      icon: '⋯', label: 'More',
      sub: [
        { icon: '🧺', label: 'Put away toys & bed', cmd: 'putAway' },
        { icon: '👻', label: 'Hide cat', cmd: 'hide', hint: 'tray icon brings it back' },
        { icon: '⏻', label: `Quit ${appName()}`, cmd: 'quit', danger: true },
      ],
    });
    return out;
  }

  // Desktop Cat: the outfits (unlocked by bond level) and the focus timer
  function extraItems(s) {
    const level = s.progress ? s.progress.level : 1;
    const acc = (root.CatArt && CatArt.ACCESSORIES) || {};
    const keys = Object.keys(acc);
    const out = [];
    out.push({
      icon: '👗', label: 'Dress up', hint: `level ${level}`,
      sub: [
        ...keys.map((k, i) => (level >= i + 1
          ? { icon: acc[k].emoji, label: acc[k].label, cmd: 'wear', args: { item: k }, checked: s.cat.accessory === k }
          : { icon: '🔒', label: acc[k].label, hint: `unlocks at level ${i + 1}`, disabled: true })),
        '-',
        { icon: '🚫', label: 'No outfit', cmd: 'wear', args: { item: 'none' }, checked: !s.cat.accessory },
      ],
    });
    if (s.focus) {
      const left = Math.max(1, Math.ceil((s.focus.until - Date.now()) / 60000));
      out.push({ icon: '🍅', label: 'Stop focusing', cmd: 'focusStop', hint: `${left} min left`, accent: true });
    } else {
      out.push({
        icon: '🍅', label: 'Focus timer', hint: `${s.cat.name} naps while you work`,
        sub: [15, 25, 50].map((m) => ({ icon: '⏱️', label: `${m} minutes`, cmd: 'focus', args: { minutes: m }, hint: m === 25 ? 'one pomodoro' : '' })),
      });
    }
    return out;
  }

  function buildList(list, container, isSub) {
    for (const it of list) {
      if (it === '-') { container.appendChild(el('div', 'sep')); continue; }
      const row = el('div', 'item' + (it.disabled ? ' disabled' : '') + (it.danger ? ' danger' : '') + (it.accent ? ' accent' : '') + (it.urgent ? ' urgent' : ''));
      row.appendChild(it.avatar && root.VillainArt ? avatarIcon(it.avatar) : el('span', 'ic', it.icon));
      const lab = el('span', 'lab');
      lab.appendChild(el('span', 'tx', it.label));
      if (it.hint) lab.appendChild(el('span', 'hint', it.hint));
      row.appendChild(lab);
      if (it.checked) row.appendChild(el('span', 'check', '✓'));
      if (it.badge != null) row.appendChild(el('span', 'badge', String(it.badge)));
      if (it.sub) row.appendChild(el('span', 'chev', '›'));
      if (it.sub) {
        row.addEventListener('pointerenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => openFly(row, it.sub), 110); });
        row.addEventListener('pointerdown', (e) => { e.stopPropagation(); openFly(row, it.sub); });
      } else {
        if (!isSub) row.addEventListener('pointerenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(closeFly, 160); });
        row.addEventListener('pointerdown', (e) => e.stopPropagation());
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.disabled) return;
          const o = origin;
          if (it.local) { const inf = info; close(); if (root.CatMenu.onLocal) root.CatMenu.onLocal(it.local, o, inf); return; }
          const args = Object.assign({}, it.args || {}, o ? { x: o.x, y: o.y } : {});
          api.send('cmd', { name: it.cmd, args });
          close();
        });
      }
      container.appendChild(row);
    }
  }

  // a villain's portrait as a menu icon (villains.js draws it)
  function avatarIcon(kind) {
    const c = document.createElement('canvas');
    c.className = 'ic av';
    const d = window.devicePixelRatio || 1, n = 22;
    c.width = n * d; c.height = n * d;
    const x = c.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    root.VillainArt.drawAvatar(x, kind, n, 1.3, { round: true });
    return c;
  }

  // a hero's avatar: its own drawAvatar, or the bust placed like the armored hero's
  function drawHeroAvatar(x, s) {
    const ART = artOf(s.character);
    const T = performance.now() / 1000;
    x.fillStyle = ART.avatarBg || 'rgba(80,200,255,0.12)';
    x.beginPath(); x.arc(23, 23, 23, 0, Math.PI * 2); x.fill();
    x.save(); x.beginPath(); x.arc(23, 23, 23, 0, Math.PI * 2); x.clip();
    if (ART.drawAvatar) ART.drawAvatar(x, s.look || s.suit, T);
    else { x.translate(21, 108); x.scale(0.95, 0.95); ART.drawBust(x, s.look || s.suit, T); }
    x.restore();
  }

  function heroMood(s) {
    const ART = artOf(s.character);
    return ART.menuName ? ART.menuName(s) : s.hero.status;
  }

  function header(s) {
    if (isHero(s)) {
      const h = el('div', 'head');
      const av = document.createElement('canvas');
      av.className = 'avatar';
      const d = window.devicePixelRatio || 1;
      av.width = 46 * d; av.height = 46 * d;
      h.appendChild(av);
      const x = av.getContext('2d');
      x.setTransform(d, 0, 0, d, 0, 0);
      drawHeroAvatar(x, s);
      const t = el('div', 'htx');
      t.appendChild(el('div', 'name', artOf(s.character).name));
      t.appendChild(el('div', 'mood', heroMood(s)));
      h.appendChild(t);
      return h;
    }
    const c = s.cat;
    const h = el('div', 'head');
    const av = document.createElement('canvas');
    av.className = 'avatar';
    const d = window.devicePixelRatio || 1;
    av.width = 46 * d; av.height = 46 * d;
    h.appendChild(av);
    drawAvatar(av, s, d);
    const txt = el('div', 'htx');
    const nm = el('div', 'name', c.name);
    if (s.extras && s.progress && !c.dead) nm.appendChild(el('span', 'lvl', `Lv ${s.progress.level}`));
    txt.appendChild(nm);
    txt.appendChild(el('div', 'mood', c.dead ? 'resting in peace 🌈' : c.mood));
    h.appendChild(txt);
    return h;
  }

  function drawAvatar(cv, s, d) {
    const x = cv.getContext('2d');
    x.setTransform(d, 0, 0, d, 0, 0);
    x.clearRect(0, 0, 46, 46);
    x.fillStyle = 'rgba(140,130,200,0.14)';
    x.beginPath(); x.arc(23, 23, 23, 0, Math.PI * 2); x.fill();
    x.save();
    x.beginPath(); x.arc(23, 23, 23, 0, Math.PI * 2); x.clip();
    x.translate(23, 58);
    x.scale(0.62, 0.62);
    const T = performance.now() / 1000;
    const pose = CatArt.makePose('sitFront', { t: T, T, phase: 0, m: {} });
    const c = s.cat;
    const face = c.dead ? { eyes: 'closed', mouth: 'w' } : c.stats.food < 25 ? { eyes: 'sad', open: 0.8, mouth: 'frown', brows: 'sad' } : c.sleeping ? { eyes: 'closed' } : { eyes: 'normal', open: 1, mouth: 'w', blush: 0.3 };
    CatArt.drawCat(x, pose, face, { T, palette: c.palette, eyes: c.eyes, accessory: c.accessory });
    x.restore();
  }

  function statsOf(s) {
    if (isHero(s)) return Object.fromEntries((s.hero.meters || []).map((m) => [m.k, m.v]));
    return s.cat.stats;
  }

  function meters(s) {
    const m = el('div', 'meters');
    const st = statsOf(s);
    const hm = isHero(s) ? s.hero.meters || [] : null;
    const rows = hm
      ? hm.map((x) => [x.icon, x.k, x.label, x.color, x.invert])
      : [['🍗', 'food', 'Food'], ['⚡', 'energy', 'Energy'], ['🧶', 'fun', 'Fun'], ['🫧', 'clean', 'Clean'], ['❤️', 'health', 'Health']];
    if (hm) m.style.gridTemplateColumns = `repeat(${rows.length}, 1fr)`;
    for (const [ic, k, label, color, invert] of rows) {
      const r = el('div', 'meter');
      r.title = `${label}: ${Math.round(st[k])}%`;
      r.appendChild(el('span', 'mi', ic));
      const bar = el('span', 'bar');
      const fill = el('span', 'fill ' + k);
      fill.dataset.k = k;
      if (invert) fill.dataset.invert = '1'; // low is good here (e.g. rage): no warning
      if (color) { fill.style.background = color; fill.style.color = color; }
      fill.style.width = Math.round(st[k]) + '%';
      if (st[k] < 20 && !invert) fill.classList.add('low');
      bar.appendChild(fill);
      r.appendChild(bar);
      m.appendChild(r);
    }
    return m;
  }

  function refreshMeters() {
    if (!isOpen || !panel) return;
    const s = getState();
    if (!s) return;
    const st = statsOf(s);
    panel.querySelectorAll('.fill').forEach((f) => {
      const v = st[f.dataset.k];
      f.style.width = Math.round(v) + '%';
      f.classList.toggle('low', v < 20 && !f.dataset.invert);
    });
    const mood = panel.querySelector('.mood');
    if (mood && isHero(s)) mood.textContent = heroMood(s);
    else if (mood && s.cat && !s.cat.dead) mood.textContent = s.cat.mood;
    // close if the mouse wandered off for a while
    if (Date.now() - lastInside > 9000) close();
  }

  // Tell main which screen rectangles the menu occupies (only those catch the mouse).
  function report() {
    if (!isOpen) return;
    const B = bounds();
    const rects = [panel, flyout].filter(Boolean).map((e) => {
      const r = e.getBoundingClientRect();
      return { x: B.x + r.left, y: B.y + r.top, w: r.width, h: r.height };
    });
    api.send('ui', { open: true, id: menuId, rects });
  }

  function open(m) {
    const s = getState();
    close(true);
    menuId = m.id || 0;
    if (!s) { api.send('ui', { open: false, id: menuId }); return; }
    info = m;
    origin = { x: m.x, y: m.y };
    isOpen = true;
    lastInside = Date.now();
    const hero = isHero(s);
    panel = el('div', 'menu' + (hero ? ' hero' : ''));
    panel.dataset.theme = hero ? artOf(s.character).theme : s.extras ? 'cozy' : 'cat';
    panel.appendChild(header(s));
    if (hero || !s.cat.dead) panel.appendChild(meters(s));
    const list = el('div', 'list');
    buildList(items(s, m.ctx || {}), list, false);
    panel.appendChild(list);
    if (!m.hook && (hero || !s.cat.dead) && m.shortcut) {
      panel.appendChild(el('div', 'foot', `Tip: ${m.shortcut} opens this menu anywhere`));
    }
    rootEl.appendChild(panel);
    // position: native context menus open down-right, so prefer up-left when we came from a global right-click
    const B = bounds();
    const lx = m.x - B.x, ly = m.y - B.y;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    let left, top;
    if (m.native) { left = lx - w - 10; top = ly - Math.min(h * 0.35, 120); }
    else { left = lx + 8; top = ly + 6; }
    if (left < 8) left = Math.min(lx + 10, B.width - w - 8);
    if (left + w > B.width - 8) left = Math.max(8, lx - w - 10);
    if (top + h > B.height - 8) top = B.height - h - 8;
    if (top < 8) top = 8;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.transformOrigin = `${lx < left ? 0 : w}px ${Math.max(0, Math.min(h, ly - top))}px`;
    requestAnimationFrame(() => panel && panel.classList.add('show'));
    panel.addEventListener('pointerleave', () => { clearTimeout(hoverTimer); });
    meterTimer = setInterval(refreshMeters, 500);
    report();
    setTimeout(report, 220); // again once the pop-in animation has finished
  }

  function openFly(row, sub) {
    if (flyFor === row && flyout) return;
    closeFly();
    flyFor = row;
    row.classList.add('open');
    flyout = el('div', 'menu sub' + (panel && panel.classList.contains('hero') ? ' hero' : ''));
    if (panel) flyout.dataset.theme = panel.dataset.theme;
    const list = el('div', 'list');
    buildList(sub, list, true);
    flyout.appendChild(list);
    rootEl.appendChild(flyout);
    const B = bounds();
    const r = row.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const w = flyout.offsetWidth, h = flyout.offsetHeight;
    let left = p.right + 4;
    if (left + w > B.width - 8) left = p.left - w - 4;
    let top = r.top - 6;
    if (top + h > B.height - 8) top = B.height - h - 8;
    flyout.style.left = Math.max(8, left) + 'px';
    flyout.style.top = Math.max(8, top) + 'px';
    flyout.addEventListener('pointerenter', () => clearTimeout(hoverTimer));
    requestAnimationFrame(() => flyout && flyout.classList.add('show'));
    report();
    setTimeout(report, 220);
  }

  function closeFly() {
    if (flyFor) flyFor.classList.remove('open');
    flyFor = null;
    if (flyout) { flyout.remove(); flyout = null; report(); }
  }

  // silent: main already knows (it asked us to close, or a new menu replaces this one)
  function close(silent) {
    clearTimeout(hoverTimer); clearTimeout(closeTimer); clearInterval(meterTimer);
    const was = isOpen;
    isOpen = false;
    closeFly();
    if (panel) { panel.remove(); panel = null; }
    if (was && !silent) api.send('ui', { open: false, id: menuId });
  }

  function contains(target) {
    return !!(target && ((panel && panel.contains(target)) || (flyout && flyout.contains(target))));
  }

  root.CatMenu = { init, open, close, contains, isOpen: () => isOpen };
})(typeof window !== 'undefined' ? window : globalThis);
