// Balance probe: the legendary battle for one hero, a few runs, with when Galactus arrives / falls.
//   node dev/legend-probe.js <hero> [suit] [runs]
'use strict';
const { Geo } = require('../src/main/geometry');
const iron = require('../src/main/ironman');

const [heroId = 'ironman', suit = 'classic', runs = '3'] = process.argv.slice(2);
for (let r = 0; r < +runs; r++) {
  const geo = new Geo();
  geo.set([
    { id: 1, bounds: { x: 0, y: 0, width: 1728, height: 1117 }, workArea: { x: 0, y: 33, width: 1728, height: 1026 }, primary: true },
    { id: 2, bounds: { x: 1728, y: 0, width: 1440, height: 900 }, workArea: { x: 1728, y: 30, width: 1440, height: 870 } },
  ]);
  const settings = { autoDefend: true, invasions: 'off', difficulty: 'normal', ironSize: 'small', suit };
  const w = heroId === 'ironman' ? new iron.IronWorld({ geo, data: null, settings, emit: () => {} })
    : new iron.HeroWorld({ geo, data: null, settings, emit: () => {}, heroClass: require(`../src/main/heroes/${heroId}`) });
  const DT = 1 / 60;
  w.activate();
  for (let i = 0; i < 360; i++) { w.setCursor({ x: 800, y: 500 }, DT); w.tick(DT); }
  w.command('army', { side: 'both', size: 'legendary', x: 800, y: 500 });
  let t = 0, gIn = 0, gOut = 0, half = 0;
  while ((w.army || w.allies.length) && t < 60 * 900) {
    w.setCursor({ x: 800, y: 500 }, DT); w.tick(DT); t++;
    if (!gIn && w.enemies.some((e) => e.kind === 'galactus')) gIn = t;
    if (gIn && !gOut && !w.enemies.some((e) => e.kind === 'galactus')) gOut = t;
    if (!half && w.army && w.army.total - w.army.queue.length - w.enemies.length >= 500) half = t;
  }
  console.log(`${heroId}/${suit} run ${r + 1}: done=${!w.army} in ${(t / 60).toFixed(0)}s (500 down at ${(half / 60).toFixed(0)}s, Galactus ${(gIn / 60).toFixed(0)}–${(gOut / 60).toFixed(0)}s), KOs=${w.counters.reboots}`);
}
