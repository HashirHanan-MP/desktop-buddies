'use strict';
/*
 * Desktop Buddies — editions. The same code builds several apps: the full
 * "Desktop Buddies" with every character, or a single-character app
 * (Desktop Cat, Desktop Hulk…). The packaged package.json carries
 * `"edition": "<id>"` (set by scripts/build-editions.js); in development
 * use `--edition=<id>` or BUDDY_EDITION=<id>.
 */

const EDITIONS = {
  all: { appName: 'Desktop Buddies', appId: 'app.desktopbuddies', characters: ['cat', 'ironman', 'homelander', 'hulk', 'spiderman'], icon: 'icon.png' },
  // the standalone cat app has its own cat: a ginger tabby with a collar & bell, plus levels,
  // outfits, a focus timer, the feather wand and gifts (World `extras`), its own logo and theme
  cat: {
    appName: 'Desktop Cat', appId: 'app.desktopbuddies.cat', characters: ['cat'], icon: 'icon-desktopcat.png',
    catExtras: true, defaults: { palette: 'tabby', accessory: 'collar' }, trays: { cat: 'tray-desktopcat.png' },
  },
  homelander: { appName: 'Desktop Homelander', appId: 'app.desktopbuddies.homelander', characters: ['homelander'], icon: 'icon-homelander.png' },
  hulk: { appName: 'Desktop Hulk', appId: 'app.desktopbuddies.hulk', characters: ['hulk'], icon: 'icon-hulk.png' },
  spiderman: { appName: 'Desktop Spider-Man', appId: 'app.desktopbuddies.spiderman', characters: ['spiderman'], icon: 'icon-spiderman.png' },
  ironman: { appName: 'Desktop Iron Man', appId: 'app.desktopbuddies.ironman', characters: ['ironman'], icon: 'icon-ironman.png' },
};
for (const [id, e] of Object.entries(EDITIONS)) e.id = id;

function editionFor(id) {
  return EDITIONS[id] || EDITIONS.all;
}

module.exports = { EDITIONS, editionFor };
