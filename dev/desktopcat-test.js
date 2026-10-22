// Headless test for the standalone Desktop Cat's extras (levels, outfits, focus timer,
// feather wand, gifts): node dev/desktopcat-test.js
'use strict';
const assert = require('assert');
const { Geo } = require('../src/main/geometry');
const { World, DEFAULT_SETTINGS, XP_NEED } = require('../src/main/world');

const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const events = [];
const settings = { ...DEFAULT_SETTINGS, palette: 'tabby', accessory: 'collar', notifications: true };
const w = new World({ geo, data: null, settings, emit: (e) => events.push(e), extras: true });
const DT = 1 / 60;
let cur = { x: 900, y: 500 };
const sec = (s) => Math.round(s * 60);
const tasks = {};
function step(n) {
  for (let i = 0; i < n; i++) {
    w.setCursor(cur, DT);
    w.tick(DT);
    const c = w.cat;
    tasks[c.taskName || '-'] = (tasks[c.taskName || '-'] || 0) + 1;
    for (const k of ['x', 'y', 'z', 'food', 'energy']) assert(Number.isFinite(c[k]), `NaN ${k} in ${c.taskName}`);
    JSON.stringify(w.snapshot());
  }
}
const until = (fn, max) => { let t = 0; while (!fn() && t < max) { step(1); t++; } return fn(); };
const c = () => w.cat;

// ---- the new look
step(sec(8));
let snap = w.snapshot();
assert.strictEqual(snap.extras, true);
assert.strictEqual(snap.cat.palette, 'tabby', 'Desktop Cat is a ginger tabby');
assert.strictEqual(snap.cat.accessory, 'collar', 'wearing the collar & bell');
assert(['green', 'amber'].includes(snap.cat.eyes), 'green or amber eyes');
assert.deepStrictEqual(snap.progress, { level: 1, xp: 0, need: XP_NEED(1) });
console.log('look:', snap.cat.palette, snap.cat.eyes, snap.cat.accessory);

// the classic all-in-one cat has none of it
{
  const classic = new World({ geo, data: null, settings: { ...DEFAULT_SETTINGS }, emit: () => {} });
  const cs = classic.snapshot();
  assert.strictEqual(cs.extras, false);
  assert.strictEqual(cs.cat.accessory, null);
  assert.strictEqual(cs.progress, null);
  classic.command('wear', { item: 'collar' });
  classic.command('focus', { minutes: 25 });
  classic.command('feather');
  assert.strictEqual(classic.focus, null);
  assert.strictEqual(classic.tool, null);
  classic.xp(500);
  assert.strictEqual(classic.progress.level, 1, 'no levels in the classic cat');
  console.log('classic cat unchanged');
}

// ---- the bell jingles while walking
{
  const before = events.filter((e) => e.type === 'sound' && e.name === 'bell').length;
  // (call it from well across the screen, so it has to walk)
  w.command('call', { x: w.cat.x < 800 ? w.cat.x + 600 : w.cat.x - 600, y: 700 });
  step(sec(6));
  const after = events.filter((e) => e.type === 'sound' && e.name === 'bell').length;
  assert(after > before, 'the bell jingles');
  console.log('bell jingles:', after - before);
}

// ---- XP, levels, outfits
{
  c().food = 40;
  w.command('feed', { kind: 'fish', x: 600, y: 600 });
  assert(until(() => w.counters.meals > 0, sec(40)), 'eats');
  assert(w.progress.xp >= 10, 'a meal gives XP');
  w.command('wear', { item: 'bowtie' });
  assert.strictEqual(w.settings.accessory, 'collar', 'bow tie is locked at level 1');
  w.xp(XP_NEED(1));
  assert.strictEqual(w.progress.level, 2, 'level up');
  assert(events.some((e) => e.type === 'notify' && /level 2/.test(e.title)), 'level-up notification');
  assert(events.some((e) => e.type === 'fx' && e.kind === 'confetti'), 'confetti');
  w.command('wear', { item: 'bowtie' });
  assert.strictEqual(w.settings.accessory, 'bowtie', 'unlocked at level 2');
  w.command('wear', { item: 'crown' });
  assert.strictEqual(w.settings.accessory, 'bowtie', 'crown needs level 8');
  w.command('wear', { item: 'none' });
  assert.strictEqual(w.settings.accessory, null, 'outfit off');
  w.command('wear', { item: 'collar' });
  step(sec(4));
  const home = w.homeState();
  assert.strictEqual(home.wardrobe.length, 8);
  assert.strictEqual(home.wardrobe.filter((x) => x.unlocked).length, 2);
  console.log('level', w.progress.level, 'xp', w.progress.xp.toFixed(0), 'outfits unlocked', home.wardrobe.filter((x) => x.unlocked).map((x) => x.k).join(','));
}

// ---- focus timer
{
  w.command('focus', { minutes: 25 });
  assert(w.focus && w.focus.minutes === 25);
  assert(until(() => c().sleeping, sec(30)), 'naps during focus');
  assert.strictEqual(c().taskName, 'focus');
  const p = w.geo.primary.work;
  assert(c().x > p.x + p.width - 200, 'in the corner of the main screen');
  const food = c().food;
  w.command('feather');
  assert.strictEqual(w.tool, null, 'no feather wand while you focus');
  const from = events.length;
  step(sec(10));
  assert.strictEqual(c().food, food, 'needs are paused while you focus');
  assert(!events.slice(from).some((e) => e.type === 'sound' && /meow/.test(e.name)), 'no meowing while you focus');
  const xp0 = w.progress.level * 1000 + w.progress.xp;
  w.focus.until = Date.now() - 1;
  step(2);
  assert.strictEqual(w.focus, null);
  const done = events.find((e) => e.type === 'focusDone');
  assert(done && done.minutes === 25, 'focusDone event for main');
  assert.strictEqual(w.counters.focusMinutes, 25);
  assert(w.progress.level * 1000 + w.progress.xp > xp0, 'focus gives XP');
  // main announces it; the cat comes to the middle of the main screen
  w.announce({ id: '__focus', text: '25-minute focus done', time: 'now' });
  assert(until(() => w.announcement && w.announcement.arrived, sec(20)), 'cat comes to announce the break');
  w.clearAnnouncement('__focus');
  step(sec(3));
  // stopping early
  w.command('focus', { minutes: 50 });
  step(sec(2));
  w.command('focusStop');
  step(sec(4));
  assert.strictEqual(w.focus, null);
  assert.notStrictEqual(c().taskName, 'focus');
  assert.strictEqual(w.counters.focusSessions, 1, 'a stopped session does not count');
  console.log('focus: minutes', w.counters.focusMinutes, 'sessions', w.counters.focusSessions);
}

// ---- feather wand: it leaps up and catches the lure
{
  c().energy = 90;
  w.command('feather');
  assert.strictEqual(w.tool && w.tool.kind, 'feather');
  // dangle the lure above a spot and keep it there
  cur = { x: 800, y: 520 };
  let t = 0;
  while (w.counters.feathersCaught === 0 && t < sec(40)) { cur = { x: 800 + Math.sin(t / 40) * 6, y: 520 }; step(1); t++; }
  assert(w.counters.feathersCaught > 0, 'catches the feather');
  assert.strictEqual(w.snapshot().cat.holding, 'feather', 'holds it in its mouth');
  console.log('feather caught after', (t / 60).toFixed(1), 's');
  cur = { x: 1300, y: 300 };
  step(sec(2));
  assert.strictEqual(w.toyCaught, null, 'the lure gets away when you pull it');
  w.command('feather');
  assert.strictEqual(w.tool, null);
  step(sec(3));
}

// ---- gifts
{
  c().love = 85; c().fun = 85; c().food = 90; c().energy = 90;
  cur = { x: 900, y: 500 };
  c().run(c().taskBringGift(), 'gift', 30);
  assert(until(() => w.ents.gifts.length > 0, sec(60)), 'brings a gift');
  const g = w.ents.gifts[0];
  console.log('gift:', g.kind, 'at', g.x.toFixed(0), g.y.toFixed(0));
  assert(w.isInteractive({ x: g.x, y: g.y - 6 }), 'a gift can be clicked');
  w.pointerDown({ x: g.x, y: g.y - 6 }, 0);
  w.pointerUp({ x: g.x, y: g.y - 6 }, 0);
  assert.strictEqual(w.ents.gifts.length, 0, 'collected');
  assert.strictEqual(w.giftShelf[g.kind], 1);
  assert.strictEqual(w.counters.gifts, 1);
  // interrupted on the way: it drops the gift where it is
  c().run(c().taskBringGift(), 'gift', 30);
  assert(until(() => !!c().carryGift, sec(40)), 'carrying a gift');
  c().food = 40; // hungry enough to drop everything for food
  w.command('feed', { kind: 'kibble', x: 500, y: 500 });
  step(sec(1));
  assert.strictEqual(c().carryGift, null);
  assert.strictEqual(w.ents.gifts.length, 1, 'dropped it');
  // nobody picks it up: it disappears after a while
  w.ents.gifts[0].created = Date.now() - 21 * 60 * 1000;
  step(2);
  assert.strictEqual(w.ents.gifts.length, 0, 'old gifts vanish');
  // it brings gifts on its own when it's happy
  w.lastGiftAt = 0;
  tasks.gift = 0;
  let t = 0;
  while (!(tasks.gift > 0 && (w.ents.gifts.length > 0 || c().carryGift)) && t < sec(1800)) { // (a random pick among its moods: give it time)
    Object.assign(c(), { love: 90, fun: 90, food: 90, energy: 90, clean: 90 }); // a happy, cared-for cat
    step(1); t++;
  }
  assert(tasks.gift > 0, 'brings gifts by itself');
  console.log('gift shelf:', JSON.stringify(w.giftShelf));
}

// ---- save & restore
{
  const saved = JSON.parse(JSON.stringify(w.serialize()));
  const w2 = new World({ geo, data: saved, settings: { ...settings, accessory: w.settings.accessory }, emit: () => {}, extras: true });
  assert.deepStrictEqual(w2.progress, w.progress, 'level and XP restored');
  assert.deepStrictEqual(w2.giftShelf, w.giftShelf, 'gift shelf restored');
  assert.strictEqual(w2.focus, null, 'a focus session does not survive a restart');
  for (let i = 0; i < 60; i++) w2.tick(DT);
  console.log('restored level', w2.progress.level);
}

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('\ntasks:', top(tasks));
console.log('\nOK');
