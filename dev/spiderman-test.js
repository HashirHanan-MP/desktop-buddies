// Headless test for Spider-Man: node dev/spiderman-test.js
'use strict';
const assert = require('assert');
const { Geo } = require('../src/main/geometry');
const { HeroWorld } = require('../src/main/ironman');
const SpiderHero = require('../src/main/heroes/spiderman');
const { Reminders } = require('../src/main/reminders');

const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const settings = { sound: true, volume: 0.5, notifications: false, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true, voice: true, ...SpiderHero.DEFAULTS };
const sounds = {}, fx = {};
const emit = (e) => { if (e.type === 'sound') sounds[e.name] = (sounds[e.name] || 0) + 1; if (e.type === 'fx') fx[e.kind] = (fx[e.kind] || 0) + 1; };
const w = new HeroWorld({ geo, data: null, settings, emit, sysinfo: () => ({ cpu: 10 }), heroClass: SpiderHero });
const DT = 1 / 60;
let cur = { x: 600, y: 400 };
const tasks = {}, poses = {};
let maxSag = -Infinity; // how close a swing came to the floor (negative = above it)

// invariants for one hero, every tick
function check(h, label, g) {
  g = g || geo;
  for (const k of ['x', 'y', 'power', 'armor', 'missiles']) assert(Number.isFinite(h[k]), `${label}: NaN ${k} in ${h.taskName}`);
  if (h.mode !== 'held') assert(g.inAny({ x: h.x, y: h.y - 40 }, -5), `${label}: off screen at ${h.x.toFixed(0)},${h.y.toFixed(0)} (${h.taskName}, ${h.mode})`);
  if (h.mode === 'air' && h.anchor) {
    const floor = h.w.groundAt(h.x, h.y);
    if (h.attach === 'feet') assert(h.y + 105 * h.s <= floor + 1, `${label}: upside-down head through the floor (${h.taskName})`);
    else {
      if (h.pose === 'swing') { maxSag = Math.max(maxSag, h.y - floor); assert(h.y < floor - 1, `${label}: swing arc touched the floor (${h.taskName})`); }
      assert(h.anchor.y < h.y, `${label}: web anchored below him`);
    }
  }
}

function step(n) {
  for (let i = 0; i < n; i++) {
    w.setCursor(cur, DT);
    w.tick(DT);
    const h = w.hero;
    tasks[h.taskName || '-'] = (tasks[h.taskName || '-'] || 0) + 1;
    poses[h.pose] = (poses[h.pose] || 0) + 1;
    check(h, 'main');
    for (const a of w.allies) check(a, a.callsign);
    for (const e of w.enemies) assert(Number.isFinite(e.x) && Number.isFinite(e.y), 'enemy NaN');
    JSON.stringify(w.snapshot());
  }
}
const sec = (s) => Math.round(s * 60);

w.activate();
{
  let t = 0;
  while (w.hero.taskName === 'arrive' && t < sec(8)) { step(1); t++; }
  assert.notStrictEqual(w.hero.taskName, 'arrive', 'arrival takes under 8 s');
  assert.strictEqual(w.hero.mode, 'ground', 'should land after swinging in');
  console.log(`arrival took ${(t / 60).toFixed(1)}s`);
}
console.log('arrived:', w.hero.taskName, w.hero.pose, 'x', w.hero.x.toFixed(0));
step(sec(60)); // idle life

// every enemy type, one at a time: Ultron's army, then every villain ('boss' = Thanos, the old name)
for (const kind of ['drone', 'walker', 'tank', 'swarm', 'doombot', 'thanos', 'doom', 'kang', 'galactus', 'boss']) {
  const d = geo.displays[kind === 'tank' ? 1 : 0];
  w.hero.power = 100; // a breather between fights (web fluid)
  w.command('spawn', { kind, x: d.work.x + d.work.width * 0.7, y: d.work.y + d.work.height * 0.3 });
  let t = 0;
  while (w.enemies.length && t < sec(kind === 'galactus' ? 180 : 90)) { step(1); t++; if (w.hero.armor < 30) w.hero.armor = 80; }
  console.log(`${kind}: cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s, kills=${w.counters.kills}, web=${w.hero.power.toFixed(0)}, impacts=${w.hero.missiles}`);
  assert(!w.enemies.length, `${kind} not defeated`);
  step(sec(4));
}

// directed attacks
for (const kind of ['web', 'impact', 'zipkick', 'yank']) {
  w.hero.power = 100;
  w.command('spawn', { kind: kind === 'yank' ? 'drone' : 'walker', x: 1000, y: 500 });
  step(sec(0.5));
  const e = w.enemies[0];
  const p = e ? w.enemyCenter(e) : { x: 900, y: 300 };
  w.command('attack', { kind, x: p.x, y: p.y });
  step(sec(3));
  w.command('clearEnemies');
}
console.log('directed attacks: webs', w.counters.webs, 'impacts', w.counters.impactWebs, 'zipKicks', w.counters.zipKicks, 'yanks', w.counters.yanks);
assert(w.counters.webs > 0 && w.counters.impactWebs > 0 && w.counters.zipKicks > 0 && w.counters.yanks > 0, 'every move was used');

// knocked out at zero health, gets back up
w.command('spawn', { kind: 'drone', x: 800, y: 300 });
step(sec(1));
w.hero.armor = 1;
w.hurtHero(50, null);
assert.strictEqual(w.hero.taskName, 'reboot');
step(sec(9));
assert.notStrictEqual(w.hero.mode, 'down', 'should get back up');
console.log('recovered:', w.hero.mode, 'health', w.hero.armor.toFixed(0));
w.command('clearEnemies');

// pick up, swing, drop: he catches a web
const h = w.hero;
step(sec(3));
if (h.mode === 'air') { w.command('land'); step(sec(3)); }
{ const b = h.box(); cur = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; } w.setCursor(cur, DT);
w.pointerDown(cur, 0);
for (let i = 0; i < 40; i++) { cur = { x: cur.x + (i % 8 < 4 ? 30 : -30), y: cur.y - 6 }; step(1); }
assert.strictEqual(h.mode, 'held');
w.pointerUp(cur, 0);
step(sec(1));
console.log('after drop:', h.mode, h.taskName, h.anchor ? 'on a web' : 'no web');
step(sec(4));
// with no web fluid he just falls
const mid = () => { const b = h.box(); return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; };
cur = mid(); w.setCursor(cur, DT); step(1); cur = mid(); w.setCursor(cur, DT);
w.pointerDown(cur, 0); cur = { x: cur.x + 40, y: cur.y - 200 }; step(5);
assert.strictEqual(h.mode, 'held');
h.power = 0;
w.pointerUp(cur, 0);
step(sec(3));
assert.strictEqual(h.mode, 'ground', 'falls to the floor');
h.power = 100;

// commands
for (const c of ['patrol', 'flip', 'thumbsUp', 'repair', 'recharge']) { w.command(c, { x: 1000, y: 400 }); step(sec(5)); }
w.command('hang', { x: 900, y: 500 });
assert.strictEqual(h.taskName, 'hang');
{ let t = 0; while (!(h.mode === 'air' && h.attach === 'feet') && t < sec(9)) { step(1); t++; } }
console.log('hang command:', h.mode, h.attach, h.pose, 'at', h.x.toFixed(0), h.y.toFixed(0));
assert(h.mode === 'air' && h.attach === 'feet', 'hangs upside-down');
step(sec(8));
// swing across the screens: where is he when the trip ends?
function swingTrip(p) {
  w.command('swingTo', p);
  assert.strictEqual(h.taskName, 'flyTo', 'the trip starts');
  let t = 0, at = null;
  while (h.taskName === 'flyTo' && t < sec(14)) { step(1); t++; if (h.pose === 'hang' && !h.vx && !h.vy && Math.abs(h.x - p.x) < 8) at = { x: h.x, y: h.y }; }
  return { t: t / 60, display: geo.displayAt({ x: h.x, y: h.y - 40 }).id, at };
}
let trip = swingTrip({ x: 2500, y: 400 });
console.log(`swung to the second screen in ${trip.t.toFixed(1)}s: display ${trip.display}, hung at ${trip.at && trip.at.y.toFixed(0)}`);
assert.strictEqual(trip.display, 2, 'reached the second screen');
assert(trip.at && Math.abs(trip.at.y - 400) < 8, 'hung at the spot');
trip = swingTrip({ x: 500, y: 900 });
assert.strictEqual(trip.display, 1, 'and back');

// reminders: comes to the centre of the main screen
const fired = [];
const rem = new Reminders([], (a) => { fired.push(a); w.announce({ ...a, header: 'x', quip: 'x', speech: 'x' }); });
rem.add({ inMinutes: 0, text: 'Call the client' });
rem.tick();
step(sec(9));
assert(w.announcement && w.announcement.arrived, 'Spidey should reach the briefing spot');
const prim = geo.primary.work;
assert(Math.abs(h.x - (prim.x + prim.width / 2)) < 20, 'at the centre of the main screen');
console.log('briefing at centre:', h.x.toFixed(0), h.y.toFixed(0), h.pose);
rem.resolve(fired[0].id, 'done'); w.clearAnnouncement(fired[0].id);
step(sec(4));

// quiet mode: a nap upside-down in the corner
w.command('quiet'); step(sec(9));
console.log('quiet:', h.pose, h.attach);
assert(h.pose === 'sleepUpside' || h.pose === 'sit', 'naps');
w.command('quiet'); step(sec(3));

// ---- army attack: the Spider-Verse joins, wins, then leaves
w.command('army', { side: 'left', size: 'medium', x: 800, y: 500 });
{
  let t = 0, maxAllies = 0, maxEnemies = 0;
  while ((w.army || w.allies.length) && t < sec(240)) {
    step(1); t++;
    maxAllies = Math.max(maxAllies, w.allies.length);
    maxEnemies = Math.max(maxEnemies, w.enemies.length);
    if (w.hero.armor < 30) w.hero.armor = 80;
    for (const a of w.allies) if (a.armor < 25) a.armor = 70;
  }
  console.log(`army: done=${!w.army} in ${(t / 60).toFixed(1)}s, peak enemies=${maxEnemies}, spider-verse=${maxAllies}, allies left=${w.allies.length}, armiesWon=${w.counters.armiesWon}`);
  assert(!w.army, 'army should be defeated');
  assert.strictEqual(maxAllies, 3, 'a medium army calls 3 spiders');
  assert.strictEqual(w.allies.length, 0, 'the Spider-Verse swings home afterwards');
}

// ---- legendary battle: 1000 attackers, never more than 5 friends
{
  w.command('army', { side: 'both', size: 'legendary', x: 800, y: 500 });
  assert(w.army && w.army.total === 1000, 'legendary army has 1000 units');
  let t = 0, peakE = 0, peakA = 0;
  const k0 = w.counters.kills;
  while ((w.army || w.allies.length) && t < sec(600)) {
    step(1); t++;
    peakE = Math.max(peakE, w.enemies.length); peakA = Math.max(peakA, w.allies.length);
  }
  console.log(`legendary: done=${!w.army} in ${(t / 60).toFixed(0)}s, kills=${w.counters.kills - k0}, peak enemies=${peakE}, spider-verse=${peakA}, KOs=${w.counters.reboots}`);
  assert(!w.army, 'the legendary army should be beaten in under 600 s');
  assert(w.counters.kills - k0 >= 1000, 'all 1000 stopped');
  assert(peakA <= 5, 'at most 5 Spider-Verse friends');
  assert(peakE <= 45, 'front line stays manageable');
}

// ---- nuke on screen 1 with two screens: he swings to screen 2 and gets thrown by the wave
function runNuke(world, gz, label, g) {
  const hh = world.hero;
  hh.power = 100; hh.armor = 100;
  for (const e of [...world.enemies]) world.kill(e, true);
  const g1 = g.displays[0];
  for (let i = 0; i < 4; i++) world.spawn(i % 2 ? 'walker' : 'drone', { x: g1.work.x + 200 + i * 250, y: g1.work.y + 300 });
  if (g.displays[1]) world.spawn('drone', { x: g.displays[1].work.x + 400, y: 300 });
  for (let i = 0; i < 30; i++) { world.setCursor(cur, DT); world.tick(DT); }
  const onTarget = world.enemies.filter((e) => e.x < g1.bounds.x + g1.bounds.width).length;
  world.command('nuke', gz);
  assert(world.nuke, 'nuke started');
  let thrown = false, escaped = false, t = 0;
  const k0 = world.counters.kills;
  while (world.nuke && t < sec(25)) {
    world.setCursor(cur, DT); world.tick(DT); t++;
    if (hh.mode === 'thrown') thrown = true;
    if (!world.nuke || !world.nuke.detonated) { const d = g.displayAt({ x: hh.x, y: hh.y - 40 }); if (d && d.id !== g1.id) escaped = true; }
    check(hh, label, g);
  }
  for (let i = 0; i < sec(10); i++) { world.setCursor(cur, DT); world.tick(DT); check(hh, label, g); }
  const left = world.enemies.filter((e) => e.x < g1.bounds.x + g1.bounds.width).length;
  console.log(`${label}: on-target enemies ${onTarget}→${left}, escaped=${escaped}, thrown=${thrown}, hero ${hh.mode}/${hh.pose} health=${hh.armor.toFixed(0)}, kills +${world.counters.kills - k0}`);
  assert.strictEqual(left, 0, 'everything on the target screen is destroyed');
  assert(thrown, 'the shockwave throws him');
  assert(hh.mode === 'ground' || hh.mode === 'air', 'he recovers');
  return escaped;
}
assert(runNuke(w, { x: 700, y: 600 }, 'nuke (2 screens)', geo), 'he escapes to the other screen');
{
  const geo1 = new Geo();
  geo1.set([{ id: 1, bounds: geo.displays[0].bounds, workArea: geo.displays[0].work, primary: true }]);
  const w1 = new HeroWorld({ geo: geo1, data: null, settings, emit: () => {}, heroClass: SpiderHero });
  w1.activate();
  for (let i = 0; i < sec(7); i++) { w1.setCursor(cur, DT); w1.tick(DT); check(w1.hero, 'single', geo1); }
  runNuke(w1, { x: 500, y: 600 }, 'nuke (1 screen)', geo1);
}

// save & restore
const saved = JSON.parse(JSON.stringify(w.serialize()));
const w2 = new HeroWorld({ geo, data: saved, settings, emit: () => {}, heroClass: SpiderHero });
for (let i = 0; i < 120; i++) { w2.tick(DT); check(w2.hero, 'restored'); }
assert.strictEqual(w2.hero.missiles, saved.hero.missiles, 'impact webs restored');
assert(Math.abs(w2.hero.power - saved.hero.power) < 5, 'web fluid restored');

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('\ntasks:', top(tasks));
console.log('poses:', top(poses));
console.log('sounds:', top(sounds));
console.log('fx:', top(fx));
console.log('closest swing to the floor:', maxSag.toFixed(1), 'px (negative = above)');
console.log('counters:', JSON.stringify(w.counters));
console.log('\nOK');
