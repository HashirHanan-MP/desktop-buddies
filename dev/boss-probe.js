// Balance probe: one hero against one enemy kind, logging the fight every few seconds.
//   node dev/boss-probe.js <hero> <kind> [suit] [seconds] [armorTopUp]
// hero: ironman | homelander | hulk | spiderman
'use strict';
const { Geo } = require('../src/main/geometry');
const iron = require('../src/main/ironman');

const [heroId = 'ironman', kind = 'thanos', suit = 'classic', secs = '180', topUp = '1'] = process.argv.slice(2);
const geo = new Geo();
geo.set([
  { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
  { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
]);
const settings = { sound: false, notifications: false, autoDefend: true, invasions: 'off', difficulty: 'normal', hudCallouts: true, ironSize: 'small', suit, voice: false };
const fx = {};
const emit = (e) => { if (e.type === 'fx') fx[e.kind] = (fx[e.kind] || 0) + 1; };
let w;
if (heroId === 'ironman') w = new iron.IronWorld({ geo, data: null, settings, emit });
else {
  w = new iron.HeroWorld({ geo, data: null, settings, emit, heroClass: require(`../src/main/heroes/${heroId}`) });
}
const DT = 1 / 60;
w.activate();
for (let i = 0; i < 360; i++) { w.setCursor({ x: 600, y: 400 }, DT); w.tick(DT); }
const d = geo.displays[0];
w.hero.power = 100;
w.command('spawn', { kind, x: d.work.x + d.work.width * 0.7, y: d.work.y + d.work.height * 0.3 });
const boss = w.enemies[0];
let t = 0, frozen = 0, ko = w.counters.reboots;
const states = {};
while (w.enemies.length && t < +secs * 60) {
  w.setCursor({ x: 600, y: 400 }, DT); w.tick(DT); t++;
  if (w.hero.frozen > 0) frozen++;
  if (boss && w.enemies.includes(boss)) states[boss.state] = (states[boss.state] || 0) + 1;
  if (topUp === '1' && w.hero.armor < 30) w.hero.armor = 80;
  if (t % 300 === 0) {
    const b = w.enemies.includes(boss) ? boss : null;
    console.log(`t=${(t / 60).toFixed(0)}s boss=${b ? b.hp.toFixed(1) + '/' + b.maxHp : 'dead'} state=${b ? b.state : '-'} enemies=${w.enemies.length} hero power=${w.hero.power.toFixed(0)} armor=${w.hero.armor.toFixed(0)} task=${w.hero.taskName} mode=${w.hero.mode}`);
  }
}
console.log(`${heroId}/${suit} vs ${kind}: cleared=${!w.enemies.length} in ${(t / 60).toFixed(1)}s, KOs=${w.counters.reboots - ko}, frozen ${(frozen / 60).toFixed(1)}s`);
console.log('boss states:', Object.entries(states).map(([k, v]) => `${k}:${(v / 60).toFixed(1)}s`).join(' '));
console.log('fx:', Object.entries(fx).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' '));
