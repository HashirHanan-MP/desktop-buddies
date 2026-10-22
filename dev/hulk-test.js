// Headless test for the Hulk: node dev/hulk-test.js
'use strict';
const assert = require('assert');
const { Geo } = require('../src/main/geometry');
const { HeroWorld } = require('../src/main/ironman');
const HulkHero = require('../src/main/heroes/hulk');
const { Reminders } = require('../src/main/reminders');

const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const settings = { sound: true, volume: 0.5, notifications: false, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true, voice: true, ...HulkHero.DEFAULTS };
const sounds = {}, fx = {};
const emit = (e) => { if (e.type === 'sound') sounds[e.name] = (sounds[e.name] || 0) + 1; if (e.type === 'fx') fx[e.kind] = (fx[e.kind] || 0) + 1; };
const w = new HeroWorld({ geo, data: null, settings, emit, sysinfo: () => ({ cpu: 10 }), heroClass: HulkHero });
const DT = 1 / 60;
let cur = { x: 600, y: 400 };
const tasks = {}, poses = {};
const onScreen = (g, h, label) => {
  if (h.mode !== 'held') assert(g.inAny({ x: h.x, y: h.y - 40 }, -5), `${label || ''} hulk off screen at ${h.x.toFixed(0)},${h.y.toFixed(0)} (${h.taskName}, ${h.mode})`);
};
function step(n) {
  for (let i = 0; i < n; i++) {
    w.setCursor(cur, DT);
    w.tick(DT);
    const h = w.hero;
    tasks[h.taskName || '-'] = (tasks[h.taskName || '-'] || 0) + 1;
    poses[h.pose] = (poses[h.pose] || 0) + 1;
    for (const k of ['x', 'y', 'power', 'armor', 'rage']) assert(Number.isFinite(h[k]), `NaN ${k} in ${h.taskName}`);
    onScreen(geo, h);
    for (const e of w.enemies) assert(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy NaN');
    JSON.stringify(w.snapshot());
  }
}
const sec = (s) => Math.round(s * 60);
const h = w.hero;

assert.strictEqual(w.character, 'hulk');
assert(h.s > w.s * 1.3, 'Hulk is bigger than the others');
w.activate();
// (wait for the arrival itself: right after it he may already be off on an idle leap)
for (let t = 0; t < sec(10) && h.taskName === 'arrive'; t++) step(1);
assert.strictEqual(h.mode, 'ground', `should land after arriving (${h.taskName}/${h.mode})`);
console.log('arrived:', h.taskName, h.pose);
step(sec(60)); // idle life
assert(tasks.hop || tasks.visit || tasks.stroll, 'he moves around when idle');

// every enemy type, one at a time — including flyers he has to leap at
for (const kind of ['drone', 'walker', 'tank', 'swarm', 'boss']) {
  const d = geo.displays[kind === 'tank' ? 1 : 0];
  w.command('spawn', { kind, x: d.work.x + d.work.width * 0.7, y: d.work.y + d.work.height * 0.3 });
  let t = 0;
  while (w.enemies.length && t < sec(90)) { step(1); t++; if (h.armor < 30) h.armor = 80; }
  console.log(`${kind}: cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s, kills=${w.counters.kills}, stamina=${h.power.toFixed(0)}, rage=${h.rage.toFixed(0)}, health=${h.armor.toFixed(0)}`);
  assert(!w.enemies.length, `${kind} not defeated`);
  step(sec(4));
}

// directed attacks, with and without enemies near the spot
for (const kind of ['smash', 'clap', 'boulder', 'punch', 'leap']) {
  h.power = 100;
  w.command('spawn', { kind: 'walker', x: 1000, y: 500 });
  step(sec(0.5));
  w.command('attack', { kind, x: 1000, y: 900 });
  step(sec(4));
  w.command('clearEnemies');
}
for (const k of ['smashes', 'claps', 'boulders', 'leaps']) assert(w.counters[k] > 0, `used ${k}`);

// damage is cut down (and makes him angry)
{
  h.setHealth(100); h.rage = 0;
  w.hurtHero(20, null);
  assert(h.armor > 85 && h.armor < 100, `tough skin: 20 damage → health ${h.armor.toFixed(1)}`);
  assert(h.rage > 5, 'getting hurt makes him angry');
}

// knocked out: he turns into Banner for a moment, then back
w.command('spawn', { kind: 'drone', x: 800, y: 300 });
step(sec(1));
h.setHealth(1);
w.hurtHero(50, null);
assert.strictEqual(h.taskName, 'reboot');
let sawBanner = false;
for (let i = 0; i < sec(9); i++) { step(1); if (h.form === 'banner') sawBanner = true; }
assert(sawBanner, 'turns into Bruce Banner while knocked out');
assert.notStrictEqual(h.mode, 'down', 'should get back up');
assert.strictEqual(h.form, 'hulk');
console.log('recovered:', h.mode, 'health', h.armor.toFixed(0), 'rage', h.rage.toFixed(0));
w.command('clearEnemies');

// pick up, swing, drop: he falls and smashes the floor
step(sec(3));
cur = { x: h.x, y: h.y - 60 * h.s }; w.setCursor(cur, DT);
w.pointerDown(cur, 0);
for (let i = 0; i < 40; i++) { cur = { x: cur.x + (i % 8 < 4 ? 30 : -30), y: cur.y - 6 }; step(1); }
assert.strictEqual(h.mode, 'held');
w.pointerUp(cur, 0);
assert.strictEqual(h.mode, 'fall', 'dropped: he falls (no flying)');
for (let t = 0; t < sec(3) && h.mode === 'fall'; t++) step(1);
assert.strictEqual(h.mode, 'ground', 'falls to the floor');
step(sec(1.5));
console.log('after drop:', h.mode, h.taskName, h.pose);

// commands
for (const c of ['patrol', 'roar', 'flex', 'calm', 'repair', 'recharge', 'thumbsUp', 'takeoff']) { w.command(c, { x: 1000, y: 400 }); step(sec(5)); }
assert(h.rage < 50, 'calm down lowers the rage');
w.command('banner');
assert.strictEqual(h.taskName, 'banner', 'Banner request accepted');
for (let t = 0; t < sec(5) && h.form !== 'banner'; t++) step(1); // he lands first if mid-leap
assert.strictEqual(h.form, 'banner', 'turns into Banner on request');
for (let t = 0; t < sec(12) && h.taskName === 'banner'; t++) step(1);
assert.strictEqual(h.form, 'hulk', 'and back');
const before = `${h.taskName}/${h.taskPrio}/${h.mode}/${h.pose}`;
w.command('leapTo', { x: 2500, y: 400 });
assert.strictEqual(h.taskName, 'leap', `leap command accepted (was ${before})`);
for (let t = 0; t < sec(8) && h.taskName === 'leap'; t++) step(1);
assert.strictEqual(geo.displayAt({ x: h.x, y: h.y - 40 }).id, 2, `leaps to the second screen (was ${before}, now ${h.taskName}/${h.mode} x=${h.x.toFixed(0)})`);
console.log('leapt to second screen at', h.x.toFixed(0));

// reminders: he comes to the middle of the main screen
const fired = [];
const rem = new Reminders([], (a) => { fired.push(a); w.announce({ ...a, header: 'HULK SAYS:', quip: 'x', speech: 'x' }); });
rem.add({ inMinutes: 0, text: 'Call the client' });
rem.tick();
step(sec(6));
assert(w.announcement && w.announcement.arrived, 'hulk should reach the reminder spot');
const prim = geo.primary.work;
assert(Math.abs(h.x - (prim.x + prim.width / 2)) < 20, 'at the centre of the main screen');
console.log('briefing at centre:', h.x.toFixed(0), h.y.toFixed(0), h.pose);
rem.resolve(fired[0].id, 'done'); w.clearAnnouncement(fired[0].id);
step(sec(3));

// quiet mode
w.command('quiet'); step(sec(6)); assert.strictEqual(h.pose, 'sleep');
w.command('quiet'); step(sec(2));
assert.notStrictEqual(h.pose, 'sleep');

// ---- army attack: no allies, he wins alone
w.command('army', { side: 'left', size: 'medium', x: 800, y: 500 });
{
  let t = 0, maxAllies = 0, maxEnemies = 0;
  while (w.army && t < sec(240)) {
    step(1); t++;
    maxAllies = Math.max(maxAllies, w.allies.length);
    maxEnemies = Math.max(maxEnemies, w.enemies.length);
    if (h.armor < 30) h.armor = 80;
  }
  console.log(`army: done=${!w.army} in ${(t / 60).toFixed(1)}s, peak enemies=${maxEnemies}, allies=${maxAllies}, armiesWon=${w.counters.armiesWon}`);
  assert(!w.army, 'army should be defeated');
  assert.strictEqual(maxAllies, 0, 'Hulk fights alone');
}

// ---- legendary battle: 1000 attackers, alone, in under 600 s
{
  w.command('army', { side: 'both', size: 'legendary', x: 800, y: 500 });
  assert(w.army && w.army.total === 1000, 'legendary army has 1000 units');
  let t = 0, peakE = 0, kos = w.counters.reboots;
  const k0 = w.counters.kills;
  while (w.army && t < sec(600)) {
    w.setCursor(cur, DT); w.tick(DT); t++;
    peakE = Math.max(peakE, w.enemies.length);
    if (t % 30 === 0) onScreen(geo, h, 'legendary');
  }
  console.log(`legendary: done=${!w.army} in ${(t / 60).toFixed(0)}s, kills=${w.counters.kills - k0}, peak enemies=${peakE}, knockouts=${w.counters.reboots - kos}`);
  assert(!w.army, 'the legendary army should be beaten in under 600 s');
  assert(w.counters.kills - k0 >= 1000, 'all 1000 destroyed');
  assert(peakE <= 45, 'front line stays manageable');
}
step(sec(4));

// ---- nuke on screen 1 with two screens: he leaps to screen 2 and gets thrown by the wave
function runNuke(world, g, gz, label) {
  const hh = world.hero;
  hh.power = 100; hh.setHealth(100);
  for (const e of [...world.enemies]) world.kill(e, true);
  const g1 = g.displays[0];
  for (let i = 0; i < 4; i++) world.spawn(i % 2 ? 'walker' : 'drone', { x: g1.work.x + 200 + i * 250, y: g1.work.y + 300 });
  if (g.displays[1]) world.spawn('drone', { x: g.displays[1].work.x + 400, y: 300 });
  for (let i = 0; i < 30; i++) { world.setCursor(cur, DT); world.tick(DT); }
  world.command('nuke', gz);
  assert(world.nuke, 'nuke started');
  let thrown = false, escaped = false, t = 0;
  while (world.nuke && t < sec(25)) {
    world.setCursor(cur, DT); world.tick(DT); t++;
    if (hh.mode === 'thrown') thrown = true;
    if (!world.nuke || !world.nuke.detonated) { const d = g.displayAt({ x: hh.x, y: hh.y - 40 }); if (d && d.id !== g1.id) escaped = true; }
    for (const k of ['x', 'y', 'armor']) assert(Number.isFinite(hh[k]), 'NaN ' + k);
    onScreen(g, hh, label);
  }
  for (let i = 0; i < sec(10); i++) { world.setCursor(cur, DT); world.tick(DT); onScreen(g, hh, label); }
  const left = world.enemies.filter((e) => e.x < g1.bounds.x + g1.bounds.width).length;
  console.log(`${label}: enemies left on ground zero=${left}, escaped=${escaped}, thrown=${thrown}, hulk ${hh.mode}/${hh.pose} health=${hh.armor.toFixed(0)} rage=${hh.rage.toFixed(0)}`);
  assert.strictEqual(left, 0, 'everything on the target screen is destroyed');
  assert(thrown, 'the shockwave throws him');
  assert(hh.mode === 'ground' || hh.mode === 'air', 'he recovers');
  return escaped;
}
assert(runNuke(w, geo, { x: 700, y: 600 }, 'nuke (2 screens)'), 'he escapes to the other screen');
{
  const geo1 = new Geo();
  geo1.set([{ id: 1, bounds: geo.displays[0].bounds, workArea: geo.displays[0].work, primary: true }]);
  const w1 = new HeroWorld({ geo: geo1, data: null, settings, emit: () => {}, heroClass: HulkHero });
  w1.activate();
  for (let i = 0; i < sec(6); i++) { w1.setCursor(cur, DT); w1.tick(DT); }
  runNuke(w1, geo1, { x: 500, y: 600 }, 'nuke (1 screen)');
}

// ---- save & restore
h.rage = 42;
const saved = JSON.parse(JSON.stringify(w.serialize()));
const w2 = new HeroWorld({ geo, data: saved, settings, emit: () => {}, heroClass: HulkHero });
assert.strictEqual(Math.round(w2.hero.rage), 42, 'rage is saved');
assert.strictEqual(Math.round(w2.hero.armor), Math.round(h.armor), 'health is saved');
for (let i = 0; i < 60; i++) w2.tick(DT);
assert(w2.hero.menuItems().length >= 3 && w2.homeState().ui.quick.length, 'menu and home data');

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('\ntasks:', top(tasks));
console.log('poses:', top(poses));
console.log('sounds:', top(sounds));
console.log('fx:', top(fx));
console.log('counters:', JSON.stringify(w.counters));
console.log('\nOK');
