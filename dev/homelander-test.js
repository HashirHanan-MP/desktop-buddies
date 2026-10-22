// Headless test for Homelander: node dev/homelander-test.js
'use strict';
const assert = require('assert');
const { Geo } = require('../src/main/geometry');
const { HeroWorld } = require('../src/main/ironman');
const { Reminders } = require('../src/main/reminders');
const HomelanderHero = require('../src/main/heroes/homelander');

const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const settings = { sound: true, volume: 0.5, notifications: false, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true, voice: true, ...HomelanderHero.DEFAULTS };
const sounds = {}, fx = {};
const emit = (e) => { if (e.type === 'sound') sounds[e.name] = (sounds[e.name] || 0) + 1; if (e.type === 'fx') fx[e.kind] = (fx[e.kind] || 0) + 1; };
const make = (g, data) => new HeroWorld({ geo: g || geo, data: data || null, settings, emit, sysinfo: () => ({ cpu: 10 }), heroClass: HomelanderHero });
const w = make();
const DT = 1 / 60;
let cur = { x: 600, y: 400 };
const tasks = {}, poses = {};
function check(world, g) {
  const h = world.hero;
  for (const k of ['x', 'y', 'power', 'armor', 'approval']) assert(Number.isFinite(h[k]), `NaN ${k} in ${h.taskName}`);
  if (h.mode !== 'held') assert((g || geo).inAny({ x: h.x, y: h.y - 40 }, -5), `hero off screen at ${h.x.toFixed(0)},${h.y.toFixed(0)} (${h.taskName}, ${h.mode})`);
  for (const e of world.enemies) assert(Number.isFinite(e.x) && Number.isFinite(e.y), `enemy NaN (${e.kind})`);
}
function step(n, world) {
  world = world || w;
  for (let i = 0; i < n; i++) {
    world.setCursor(cur, DT);
    world.tick(DT);
    const h = world.hero;
    tasks[h.taskName || '-'] = (tasks[h.taskName || '-'] || 0) + 1;
    poses[h.pose] = (poses[h.pose] || 0) + 1;
    check(world);
    JSON.stringify(world.snapshot());
  }
}
const sec = (s) => Math.round(s * 60);
const h = w.hero;

assert.strictEqual(w.character, 'homelander');
assert.strictEqual(w.allyCount(1000), 0, 'he fights alone');

w.activate();
step(sec(8));
assert.strictEqual(h.mode, 'ground', 'should land after arriving');
console.log('arrived:', h.taskName, h.pose);
step(sec(60)); // idle life

// every enemy type, one at a time: Ultron's army, then every villain ('boss' = Thanos, the old name)
for (const kind of ['drone', 'walker', 'tank', 'swarm', 'thanos', 'doom', 'kang', 'galactus', 'boss']) {
  const d = geo.displays[kind === 'tank' ? 1 : 0];
  w.command('spawn', { kind, x: d.work.x + d.work.width * 0.7, y: d.work.y + d.work.height * 0.3 });
  let t = 0;
  while (w.enemies.length && t < sec(kind === 'galactus' ? 180 : 90)) { step(1); t++; }
  console.log(`${kind}: cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s, kills=${w.counters.kills}, heat=${h.power.toFixed(0)}, health=${h.armor.toFixed(0)}, approval=${h.approval.toFixed(0)}`);
  assert(!w.enemies.length, `${kind} not defeated`);
  step(sec(4));
}

// a mixed group: every weapon gets a chance
for (let i = 0; i < 3; i++) {
  w.command('spawn', { kind: 'walker', x: 400 + i * 120, y: 900 });
  w.command('spawn', { kind: 'tank', x: 500 + i * 150, y: 900 });
  w.command('spawn', { kind: 'drone', x: 500 + i * 150, y: 300 });
}
{
  let t = 0;
  while (w.enemies.length && t < sec(120)) { step(1); t++; }
  console.log(`mixed group of 9: cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s`);
  assert(!w.enemies.length, 'mixed group not defeated');
}

// directed attacks, with and without a target there
for (const kind of ['heat', 'sweep', 'punch', 'ram', 'clap', 'throw']) {
  h.power = 100;
  w.command('spawn', { kind: kind === 'throw' ? 'tank' : 'walker', x: 900, y: 900 });
  w.command('spawn', { kind: 'walker', x: 1000, y: 900 });
  w.command('attack', { kind, x: 900, y: 1000 });
  step(sec(4));
  w.command('clearEnemies');
  w.command('attack', { kind, x: 700, y: 500 });
  step(sec(3));
}
assert(w.counters.sweeps > 0 && w.counters.punches > 0 && w.counters.throws > 0 && w.counters.claps > 0 && w.counters.rams > 0 && w.counters.heatZaps > 0, `every weapon used: ${JSON.stringify(w.counters)}`);
w.command('clearEnemies');
step(sec(3));

// toughness: a 20-point hit only costs him a fraction
{
  h.setHealth(100);
  const a0 = h.approval;
  w.hurtHero(20, null);
  assert(h.armor > 85 && h.armor < 95, `toughness: health ${h.armor}`);
  assert(h.approval < a0, 'getting hurt costs approval');
}

// knocked out at zero health: dazed, then back up
w.command('spawn', { kind: 'drone', x: 800, y: 300 });
step(sec(1));
h.setHealth(1);
w.hurtHero(50, null);
assert.strictEqual(h.taskName, 'reboot');
step(sec(8));
assert.notStrictEqual(h.mode, 'down', 'should get back up');
console.log('knocked out and back:', h.mode, 'health', h.armor.toFixed(0));
w.command('clearEnemies');

// pick up, swing, drop: he stays in the air
step(sec(4));
cur = { x: h.x, y: h.y - 60 }; w.setCursor(cur, DT);
w.pointerDown(cur, 0);
for (let i = 0; i < 40; i++) { cur = { x: cur.x + (i % 8 < 4 ? 30 : -30), y: cur.y - 4 }; step(1); }
assert.strictEqual(h.mode, 'held');
w.pointerUp(cur, 0);
step(2);
assert.strictEqual(h.mode, 'air', 'dropped: he flies');
step(sec(4));
console.log('after drop:', h.mode, h.taskName);

// poke him too much: approval drops
{
  step(sec(6));
  const a0 = h.approval;
  for (let i = 0; i < 6; i++) { const b = w.heroBox(); cur = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; w.setCursor(cur, DT); w.pointerDown(cur, 0); w.pointerUp(cur, 0); step(3); }
  console.log(`pokes: approval ${a0.toFixed(0)} → ${h.approval.toFixed(0)}`);
  assert(h.approval < a0, 'poking lowers approval');
}

// commands
for (const c of ['takeoff', 'land', 'patrol', 'flyby', 'wave', 'pose', 'stare', 'pr', 'thumbsUp', 'repair', 'recharge', 'repair+recharge']) { w.command(c, { x: 1000, y: 400 }); step(sec(4)); }
assert(h.approval > 50, 'press conference helps');
w.command('flyTo', { x: 2500, y: 400 }); step(sec(8));
console.log('flew to second screen:', geo.displayAt({ x: h.x, y: h.y - 40 }).id);

// reminders: comes to the centre of the main screen
const fired = [];
const rem = new Reminders([], (a) => { fired.push(a); w.announce({ ...a, header: 'X', quip: 'x', speech: 'x' }); });
rem.add({ inMinutes: 0, text: 'Call the client' });
rem.tick();
step(sec(7));
assert(w.announcement && w.announcement.arrived, 'should reach the briefing spot');
const prim = geo.primary.work;
assert(Math.abs(h.x - (prim.x + prim.width / 2)) < 20, 'at the centre of the main screen');
console.log('briefing at centre:', h.x.toFixed(0), h.y.toFixed(0), h.pose);
rem.resolve(fired[0].id, 'done'); w.clearAnnouncement(fired[0].id);
step(sec(4));

// quiet mode
w.command('quiet'); step(sec(8)); assert.strictEqual(h.pose, 'powerDown');
w.command('quiet'); step(sec(2));

// ---- army attack: alone
w.command('army', { side: 'left', size: 'medium', x: 800, y: 500 });
{
  let t = 0, peak = 0;
  while (w.army && t < sec(240)) { step(1); t++; peak = Math.max(peak, w.enemies.length); assert.strictEqual(w.allies.length, 0, 'no allies'); }
  console.log(`army (20): done=${!w.army} in ${(t / 60).toFixed(1)}s, peak enemies=${peak}, health=${h.armor.toFixed(0)}`);
  assert(!w.army, 'army should be defeated');
}

// ---- legendary battle: 1000 attackers, one Homelander
{
  w.command('army', { side: 'both', size: 'legendary', x: 800, y: 500 });
  assert(w.army && w.army.total === 1000, 'legendary army has 1000 units');
  let t = 0, peakE = 0, kos = w.counters.reboots;
  const k0 = w.counters.kills;
  while (w.army && t < sec(600)) {
    w.setCursor(cur, DT); w.tick(DT); t++;
    peakE = Math.max(peakE, w.enemies.length);
    if (t % 30 === 0) check(w);
  }
  console.log(`legendary: done=${!w.army} in ${(t / 60).toFixed(0)}s, kills=${w.counters.kills - k0}, peak enemies=${peakE}, knockdowns=${w.counters.reboots - kos}`);
  assert(!w.army, 'the legendary army should be beaten in under 600 s');
  assert(w.counters.kills - k0 >= 1000, 'all 1000 destroyed');
}

// ---- nuke: he stays, gets thrown, gets up; everything on that screen is gone
function runNuke(world, g, gz, label) {
  const hh = world.hero;
  hh.power = 100; hh.setHealth(100);
  for (const e of [...world.enemies]) world.kill(e, true);
  const g1 = g.displays[0];
  for (let i = 0; i < 4; i++) world.spawn(i % 2 ? 'walker' : 'drone', { x: g1.work.x + 200 + i * 250, y: g1.work.y + 300 });
  for (let i = 0; i < 30; i++) { world.setCursor(cur, DT); world.tick(DT); }
  world.command('nuke', gz);
  assert(world.nuke, 'nuke started');
  let thrown = false, t = 0;
  while (world.nuke && t < sec(25)) {
    world.setCursor(cur, DT); world.tick(DT); t++;
    if (hh.mode === 'thrown') thrown = true;
    check(world, g);
  }
  for (let i = 0; i < sec(10); i++) { world.setCursor(cur, DT); world.tick(DT); }
  const left = world.enemies.filter((e) => e.x < g1.bounds.x + g1.bounds.width).length;
  console.log(`${label}: enemies left on target=${left}, thrown=${thrown}, hero ${hh.mode}/${hh.pose} health=${hh.armor.toFixed(0)}`);
  assert.strictEqual(left, 0, 'everything on the target screen is destroyed');
  assert(thrown, 'the shockwave throws him');
  assert(hh.mode === 'ground' || hh.mode === 'air', 'he recovers');
}
runNuke(w, geo, { x: 700, y: 600 }, 'nuke (2 screens)');
{
  const geo1 = new Geo();
  geo1.set([{ id: 1, bounds: geo.displays[0].bounds, workArea: geo.displays[0].work, primary: true }]);
  const w1 = make(geo1);
  w1.activate();
  for (let i = 0; i < sec(8); i++) { w1.setCursor(cur, DT); w1.tick(DT); }
  runNuke(w1, geo1, { x: 500, y: 600 }, 'nuke (1 screen)');
}

// ---- save & restore
const saved = JSON.parse(JSON.stringify(w.serialize()));
const w2 = make(geo, saved);
assert(Math.abs(w2.hero.approval - h.approval) < 0.01, 'approval restored');
assert(Math.abs(w2.hero.armor - h.armor) < 0.01, 'health restored');
for (let i = 0; i < 60; i++) { w2.setCursor(cur, DT); w2.tick(DT); }
assert.strictEqual(w2.info().name, 'Homelander');
assert(w2.hero.menuItems().length >= 3 && w2.homeState().ui.quick.length, 'menu and home data');

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('\ntasks:', top(tasks));
console.log('poses:', top(poses));
console.log('sounds:', top(sounds));
console.log('fx:', top(fx));
console.log('counters:', JSON.stringify(w.counters));
console.log('\nOK');
