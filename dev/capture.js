// Runs the real app for one edition with a throwaway save and grabs screenshots:
//   node dev/capture.js <edition> <outDir> [extra command lines...]
// BUDDY_EXE=<path to a built app's exe> runs that build instead (its edition is baked in).
// Uses the --dev command file (see devPoll in main.js). Nothing touches your real save.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const edition = process.argv[2] || 'all';
const out = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'buddies-shots'));
const extra = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'buddies-ud-'));
const ch = { all: 'ironman', cat: 'cat' }[edition] || edition;
fs.writeFileSync(path.join(ud, 'desktop-buddies-save.json'), JSON.stringify({ version: 2, savedAt: Date.now(), settings: { character: ch, sound: false, notifications: false, voice: false }, reminders: [] }));
const cmdFile = path.join(ud, 'cmd.txt');
const exe = process.env.BUDDY_EXE;
const p = spawn(exe || require('electron'), exe ? ['--dev'] : ['.', '--dev', `--edition=${edition}`], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, CAT_USER_DATA: ud, CAT_CMD_FILE: cmdFile, DESKTOP_CAT_NO_HOOK: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
p.stdout.on('data', (d) => process.stdout.write(d));
p.stderr.on('data', (d) => { const t = String(d); if (!/GPU|gpu_|Autofill|DevTools|cache/i.test(t)) process.stderr.write(t); });
const dir = JSON.stringify(out).slice(1, -1).replace(/\\\\/g, '/');
const lines = [
  'sleep {"ms":5000}',
  `capture {"dir":"${dir}","name":"${edition}-hero","around":"cat","r":200}`,
  ...extra.map((l) => l.replace(/\$DIR/g, dir)),
  'quit',
];
setTimeout(() => fs.writeFileSync(cmdFile, lines.join('\n')), 2500);
const kill = setTimeout(() => { console.log('timeout: killing'); p.kill(); }, 90000);
p.on('exit', (code) => { clearTimeout(kill); console.log(`exited ${code}; shots in ${out}`); fs.rmSync(ud, { recursive: true, force: true }); });
