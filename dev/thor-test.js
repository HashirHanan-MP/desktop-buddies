// Headless test for Thor: node dev/thor-test.js
'use strict';
const assert = require('assert');
const { Geo } = require('../src/main/geometry');
const { HeroWorld } = require('../src/main/ironman');
const { Reminders } = require('../src/main/reminders');
const ThorHero = require('../src/main/heroes/thor');

const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const settings = { sound: true, volume: 0.5, notifications: false, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true, voice: true, ...ThorHero.DEFAULTS };
const sounds = {}, fx = {}, beams = {};
const emit = (e) => { if (e.type === 'sound') sounds[e.name] = (sounds[e.name] || 0) + 1; if (e.type === 'fx') fx[e.kind] = (fx[e.kind] || 0) + 1; };
const make = (g, data) => new HeroWorld({ geo: g || geo, data: data || null, settings, emit, sysinfo: () => ({ cpu: 10 }), heroClass: ThorHero });
const w = make();
const DT = 1 / 60;
let cur = { x: 600, y: 400 };
const tasks = {}, poses = {};
const seenBeams = new Set();
function check(world, g) {
  const h = world.hero;
  for (const k of ['x', 'y', 'power', 'armor', 'storm']) assert(Number.isFinite(h[k]), `NaN ${k} in ${h.taskName}`);
  if (h.thrown) assert(Number.isFinite(h.thrown.x) && Number.isFinite(h.thrown.y), `thrown weapon NaN in ${h.taskName}`);
  if (h.mode !== 'held') assert((g || geo).inAny({ x: h.x, y: h.y - 40 }, -5), `hero off screen at ${h.x.toFixed(0)},${h.y.toFixed(0)} (${h.taskName}, ${h.mode})`);
  for (const e of world.enemies) assert(Number.isFinite(e.x) && Number.isFinite(e.y), `enemy NaN (${e.kind})`);
  for (const b of world.beams) if (!seenBeams.has(b)) { seenBeams.add(b); beams[b.kind] = (beams[b.kind] || 0) + 1; }
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

assert.strictEqual(w.character, 'thor');
assert.strictEqual(w.allyCount(1000), 0, 'he fights alone');

w.activate();
step(sec(2));
assert(fx.bifrost >= 1 && beams.bifrost >= 1, 'arrives by Bifrost');
assert.strictEqual(h.mode, 'ground', 'lands on the ground');
step(sec(6));
assert.notStrictEqual(h.taskName, 'arrive', 'arrival finished');
console.log('arrived:', h.taskName, h.pose);
step(sec(60)); // idle life

// every enemy type, in every look (each look fights with its own weapon)
const LOOKS = ['classic', 'ragnarok', 'stormbreaker', 'thunder'];
const KINDS = ['drone', 'walker', 'tank', 'swarm', 'doombot', 'thanos', 'doom', 'kang', 'galactus'];
KINDS.forEach((kind, i) => {
  const look = LOOKS[i % LOOKS.length];
  w.command('setting', { key: 'thorLook', value: look });
  settings.thorLook = look;
  const d = geo.displays[kind === 'tank' ? 1 : 0];
  w.command('spawn', { kind, x: d.work.x + d.work.width * 0.7, y: d.work.y + d.work.height * 0.3 });
  let t = 0;
  while (w.enemies.length && t < sec(kind === 'galactus' ? 180 : 90)) { step(1); t++; }
  console.log(`${kind} (${look}, ${h.weapon}): cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s, thunder=${h.power.toFixed(0)}, health=${h.armor.toFixed(0)}, storm=${h.storm.toFixed(0)}`);
  assert(!w.enemies.length, `${kind} not defeated`);
  step(sec(4));
});
settings.thorLook = 'classic';
assert.strictEqual(h.weapon, 'hammer');
assert(!h.thrown, 'the weapon came home');

// a mixed group: slam, bolts, throws
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

// directed attacks in each look, with and without a target there
for (const look of LOOKS) {
  settings.thorLook = look;
  for (const kind of ['arc', 'bolt', 'throw', 'smash', 'slam', 'god']) {
    h.power = 100;
    if (kind === 'god') h.storm = 100;
    w.command('spawn', { kind: 'walker', x: 900, y: 900 });
    w.command('spawn', { kind: 'walker', x: 1000, y: 900 });
    w.command('spawn', { kind: 'drone', x: 950, y: 500 });
    w.command('attack', { kind, x: 900, y: 1000 });
    step(sec(5));
    w.command('clearEnemies');
    w.command('attack', { kind, x: 700, y: 500 });
    step(sec(3));
  }
  assert(!h.thrown, `${look}: the weapon came home`);
}
settings.thorLook = 'classic';
for (const k of ['arcs', 'bolts', 'throws', 'smashes', 'slams', 'godMode']) assert(w.counters[k] > 0, `${k} used: ${JSON.stringify(w.counters)}`);
for (const k of ['arc', 'bolt', 'chain', 'blast', 'crackle']) assert(beams[k] > 0, `beam ${k} drawn: ${JSON.stringify(beams)}`);
w.command('clearEnemies');
step(sec(3));

// toughness: a 20-point hit only costs him part of it, and feeds the storm
{
  h.setHealth(100);
  h.storm = 10;
  w.hurtHero(20, null);
  assert(h.armor > 85 && h.armor < 95, `toughness: health ${h.armor}`);
  assert(h.storm > 10, 'getting hurt feeds the storm');
}

// knocked out at zero health: dazed, then back up angry
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

// commands (and the ones that need a weapon in the Ragnarok look)
for (const c of ['takeoff', 'land', 'patrol', 'flyby', 'twirl', 'toss', 'storm', 'mead', 'wave', 'thumbsUp', 'repair', 'recharge', 'repair+recharge', 'fillStorm']) { w.command(c, { x: 1000, y: 400 }); step(sec(4)); }
assert(w.counters.mead > 0, 'mead');
assert(h.storm > 95, 'fillStorm');
settings.thorLook = 'ragnarok';
w.command('twirl'); step(sec(2));
assert.notStrictEqual(h.taskName, 'twirl', 'no weapon to twirl in Ragnarok');
settings.thorLook = 'classic';
w.command('bifrost', { x: 1000, y: 400 }); step(sec(2));
assert.strictEqual(geo.displayAt({ x: h.x, y: h.y - 40 }).id, 2, 'Bifrost to the other screen');
w.command('flyTo', { x: 600, y: 400 }); step(sec(10));

// reminders: comes to the centre of the main screen
const fired = [];
const rem = new Reminders([], (a) => { fired.push(a); w.announce({ ...a, header: 'X', quip: 'x', speech: 'x' }); });
rem.add({ inMinutes: 0, text: 'Call the client' });
rem.tick();
step(sec(7));
assert(w.announcement && w.announcement.arrived, 'should reach the briefing spot');
const prim = geo.primary.work;
assert(Math.abs(h.x - (prim.x + prim.width / 2)) < 20, 'at the centre of the main screen');
rem.resolve(fired[0].id, 'done'); w.clearAnnouncement(fired[0].id);
step(sec(4));

// quiet mode
w.command('quiet'); step(sec(8)); assert.strictEqual(h.pose, 'rest');
w.command('quiet'); step(sec(2));

// ---- army attack: alone
w.command('army', { side: 'left', size: 'medium', x: 800, y: 500 });
{
  let t = 0, peak = 0;
  while (w.army && t < sec(240)) { step(1); t++; peak = Math.max(peak, w.enemies.length); }
  console.log(`army (20): done=${!w.army} in ${(t / 60).toFixed(1)}s, peak enemies=${peak}, health=${h.armor.toFixed(0)}`);
  assert(!w.army, 'army should be defeated');
}

// ---- legendary battle: 1000 attackers, one Thor
{
  w.command('army', { side: 'both', size: 'legendary', x: 800, y: 500 });
  let t = 0, peakE = 0;
  const kos = w.counters.reboots || 0, k0 = w.counters.kills, g0 = w.counters.godMode || 0;
  while (w.army && t < sec(600)) {
    w.setCursor(cur, DT); w.tick(DT); t++;
    peakE = Math.max(peakE, w.enemies.length);
    if (t % 30 === 0) check(w);
  }
  console.log(`legendary: done=${!w.army} in ${(t / 60).toFixed(0)}s, kills=${w.counters.kills - k0}, peak enemies=${peakE}, knockdowns=${(w.counters.reboots || 0) - kos}, god of thunder ×${w.counters.godMode - g0}`);
  assert(!w.army, 'the legendary army should be beaten in under 600 s');
  assert(w.counters.kills - k0 >= 1000, 'all 1000 destroyed');
}

// ---- nuke: he stands his ground, gets thrown, gets up
function runNuke(world, g, gz, label) {
  const hh = world.hero;
  hh.power = 100; hh.setHealth(100);
  for (const e of [...world.enemies]) world.kill(e, true);
  const g1 = g.displays[0];
  for (let i = 0; i < 4; i++) world.spawn(i % 2 ? 'walker' : 'drone', { x: g1.work.x + 200 + i * 250, y: g1.work.y + 300 });
  for (let i = 0; i < 30; i++) { world.setCursor(cur, DT); world.tick(DT); }
  world.command('nuke', gz);
  let thrown = false, t = 0;
  while (world.nuke && t < sec(25)) {
    world.setCursor(cur, DT); world.tick(DT); t++;
    if (hh.mode === 'thrown') thrown = true;
    check(world, g);
  }
  for (let i = 0; i < sec(10); i++) { world.setCursor(cur, DT); world.tick(DT); }
  const left = world.enemies.filter((e) => e.x < g1.bounds.x + g1.bounds.width).length;
  console.log(`${label}: enemies left=${left}, thrown=${thrown}, hero ${hh.mode}/${hh.pose}`);
  assert.strictEqual(left, 0, 'everything on the target screen is destroyed');
  assert(thrown, 'the shockwave throws him');
  assert(hh.mode === 'ground' || hh.mode === 'air', 'he recovers');
}
runNuke(w, geo, { x: 700, y: 600 }, 'nuke (2 screens)');

// ---- save & restore, menus, home data
const saved = JSON.parse(JSON.stringify(w.serialize()));
const w2 = make(geo, saved);
assert(Math.abs(w2.hero.storm - h.storm) < 0.01, 'storm restored');
assert(Math.abs(w2.hero.armor - h.armor) < 0.01, 'health restored');
for (let i = 0; i < 60; i++) { w2.setCursor(cur, DT); w2.tick(DT); }
assert.strictEqual(w2.info().name, 'Thor');
for (const look of LOOKS) {
  settings.thorLook = look;
  const items = JSON.stringify(w2.hero.menuItems());
  assert(items.includes(look === 'ragnarok' ? 'Lightning blast' : look === 'classic' ? 'Throw Mjolnir' : 'Throw Stormbreaker'), `${look} menu`);
}
settings.thorLook = 'classic';
assert(w2.homeState().ui.quick.length && w2.homeState().ui.looks.options.length === 4, 'home data with four looks');

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('\ntasks:', top(tasks));
console.log('poses:', top(poses));
console.log('sounds:', top(sounds));
console.log('fx:', top(fx));
console.log('beams:', top(beams));
console.log('counters:', JSON.stringify(w.counters));
console.log('\nOK');
