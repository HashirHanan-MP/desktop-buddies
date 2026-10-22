// Builds a separate app for each edition (src/main/editions.js):
//   node scripts/build-editions.js [--win|--mac|--linux] [--x64] [edition ...]
// With no editions given it builds the single-character apps: cat, homelander, hulk, spiderman.
// `all` is the full Desktop Buddies (every character), `ironman` a Desktop Iron Man.
// Each one gets its own name, app id, icon and save folder; output goes to dist/<edition>/.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EDITIONS } = require('../src/main/editions');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const args = process.argv.slice(2);
const platform = args.find((a) => ['--win', '--mac', '--linux'].includes(a))
  || { win32: '--win', darwin: '--mac', linux: '--linux' }[process.platform];
const x64Only = args.includes('--x64');
const ids = args.filter((a) => !a.startsWith('--'));
const editions = ids.length ? ids : ['cat', 'homelander', 'hulk', 'spiderman'];

for (const id of editions) {
  if (!EDITIONS[id]) { console.error(`unknown edition "${id}" (known: ${Object.keys(EDITIONS).join(', ')})`); process.exit(1); }
}

const cli = require.resolve('electron-builder/cli.js');
const failed = [];
for (const id of editions) {
  const E = EDITIONS[id];
  const icon = `build/${E.icon}`;
  if (!fs.existsSync(path.join(ROOT, icon))) { console.error(`missing ${icon} — run \`npm run icon\` first`); process.exit(1); }
  const cfg = JSON.parse(JSON.stringify(pkg.build));
  cfg.appId = E.appId;
  cfg.productName = E.appName;
  cfg.directories = { ...cfg.directories, output: `dist/${id}` };
  // baked into the packaged package.json: main.js reads `edition`; productName names the save folder
  cfg.extraMetadata = {
    name: id === 'all' ? pkg.name : `desktop-${id}`,
    productName: E.appName,
    edition: id,
    description: `${E.appName} — a desktop companion that lives on your screen.`,
  };
  cfg.mac = { ...cfg.mac, icon, extendInfo: { ...cfg.mac.extendInfo, NSAppleEventsUsageDescription: `${E.appName} listens for right-clicks to open its menu.` } };
  cfg.win = { ...cfg.win, icon };
  cfg.linux = { ...cfg.linux, icon, executableName: cfg.extraMetadata.name, maintainer: E.appName };
  if (x64Only) {
    for (const k of ['mac', 'win', 'linux']) cfg[k].target = cfg[k].target.map((t) => ({ ...t, arch: ['x64'] }));
  }
  const file = path.join(ROOT, 'dist', `.config-${id}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`\n=== ${E.appName} (${id}) ${platform} → dist/${id}/`);
  const r = spawnSync(process.execPath, [cli, '--config', file, platform, '--publish', 'never'], {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
  });
  fs.unlinkSync(file);
  if (r.status !== 0) failed.push(id);
}

if (failed.length) { console.error(`\nfailed: ${failed.join(', ')}`); process.exit(1); }
console.log(`\nbuilt: ${editions.map((id) => EDITIONS[id].appName).join(', ')}`);
