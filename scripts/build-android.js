#!/usr/bin/env node
// Builds the Android app (dist/android/DesktopBuddies.apk) straight from the SDK
// tools — no Gradle: aapt2 → javac → d8 → zipalign → apksigner.
//   node scripts/build-android.js [edition]        (default: all)
// Needs a JDK 17 (JAVA_HOME, default C:\Android\jdk17) and the Android SDK
// (ANDROID_HOME, default C:\Android\sdk) with platforms;android-34 and build-tools;34.0.0.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const edition = process.argv[2] || 'all';
const pkg = require(path.join(ROOT, 'package.json'));
const win = process.platform === 'win32';
const JAVA_HOME = process.env.JAVA_HOME || 'C:\\Android\\jdk17';
const SDK = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || 'C:\\Android\\sdk';
const BT = path.join(SDK, 'build-tools', '34.0.0');
const ANDROID_JAR = path.join(SDK, 'platforms', 'android-34', 'android.jar');
const OUT = path.join(ROOT, 'build', 'android');
const DIST = path.join(ROOT, 'dist', 'android');
const APK = path.join(DIST, 'DesktopBuddies.apk');
const KEYSTORE = process.env.BUDDIES_KEYSTORE || path.join(os.homedir(), '.android', 'debug.keystore');

const exe = (dir, name, bat) => path.join(dir, name + (win ? (bat ? '.bat' : '.exe') : ''));
const env = { ...process.env, JAVA_HOME, PATH: path.join(JAVA_HOME, 'bin') + path.delimiter + process.env.PATH };
function run(cmd, args) {
  console.log('>', path.basename(cmd), args.length > 6 ? args.slice(0, 6).join(' ') + ' …' : args.join(' '));
  execFileSync(cmd, args, { stdio: 'inherit', env, shell: win && cmd.endsWith('.bat') });
}
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
function walk(dir, ext, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out); else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

for (const p of [ANDROID_JAR, BT, JAVA_HOME]) if (!fs.existsSync(p)) { console.error('missing:', p); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. the web layer: simulation bundle + overlay, home and mobile pages
run(process.execPath, [path.join(__dirname, 'build-mobile.js'), edition]);
const www = path.join(OUT, 'assets', 'www');
for (const d of ['mobile', 'renderer', 'home']) copyDir(path.join(ROOT, 'src', d), path.join(www, d));

// 2. resources + manifest
const resZip = path.join(OUT, 'res.zip');
run(exe(BT, 'aapt2'), ['compile', '--dir', path.join(ROOT, 'android', 'res'), '-o', resZip]);
const gen = path.join(OUT, 'gen');
const unsigned = path.join(OUT, 'unsigned.apk');
const [maj, min, patch] = pkg.version.split('.').map(Number);
run(exe(BT, 'aapt2'), ['link', '-I', ANDROID_JAR, '--manifest', path.join(ROOT, 'android', 'AndroidManifest.xml'),
  '--min-sdk-version', '26', '--target-sdk-version', '34',
  '--version-code', String(maj * 10000 + min * 100 + patch), '--version-name', pkg.version,
  '--java', gen, '-o', unsigned, resZip]);
// assets go in with jar, not aapt2 -A: on Windows aapt2 stores them with backslash
// paths (assets/www\mobile\index.html), which Android can't find
run(exe(path.join(JAVA_HOME, 'bin'), 'jar'), ['--update', '--no-manifest', '--file', unsigned, '-C', OUT, 'assets']);

// 3. Java → dex
const classes = path.join(OUT, 'classes');
const sources = [...walk(path.join(ROOT, 'android', 'src'), '.java'), ...walk(gen, '.java')];
run(exe(path.join(JAVA_HOME, 'bin'), 'javac'), ['-nowarn', '--release', '11', '-encoding', 'UTF-8',
  '-classpath', ANDROID_JAR, '-d', classes, ...sources]);
const dex = path.join(OUT, 'dex');
fs.mkdirSync(dex, { recursive: true });
run(exe(BT, 'd8', true), ['--release', '--min-api', '26', '--lib', ANDROID_JAR, '--output', dex, ...walk(classes, '.class')]);
run(exe(path.join(JAVA_HOME, 'bin'), 'jar'), ['--update', '--no-manifest', '--file', unsigned, '-C', dex, 'classes.dex']);

// 4. align + sign (a stable debug key so updates install over the old app)
const aligned = path.join(OUT, 'aligned.apk');
run(exe(BT, 'zipalign'), ['-p', '-f', '4', unsigned, aligned]);
if (!fs.existsSync(KEYSTORE)) {
  fs.mkdirSync(path.dirname(KEYSTORE), { recursive: true });
  run(exe(path.join(JAVA_HOME, 'bin'), 'keytool'), ['-genkeypair', '-keystore', KEYSTORE, '-storepass', 'android',
    '-keypass', 'android', '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=Android Debug,O=Android,C=US']);
}
run(exe(BT, 'apksigner', true), ['sign', '--ks', KEYSTORE, '--ks-pass', 'pass:android', '--ks-key-alias', 'androiddebugkey',
  '--key-pass', 'pass:android', '--out', APK, aligned]);
run(exe(BT, 'apksigner', true), ['verify', APK]);

// every file the phone page loads must be in the APK, under a forward-slash path
const entries = new Set(execFileSync(exe(path.join(JAVA_HOME, 'bin'), 'jar'), ['--list', '--file', APK], { env })
  .toString().split(/\r?\n/).filter(Boolean));
const bad = [...entries].filter((e) => e.includes('\\'));
const page = 'assets/www/mobile/index.html';
const needed = [page, 'assets/www/home/home.html', 'classes.dex'];
const html = fs.readFileSync(path.join(www, 'mobile', 'index.html'), 'utf8');
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) needed.push(path.posix.join('assets/www/mobile', m[1]));
const missing = needed.filter((e) => !entries.has(e));
if (bad.length || missing.length) {
  console.error('APK check failed:', bad.length ? '\n  backslash paths: ' + bad.slice(0, 5).join(', ') : '',
    missing.length ? '\n  missing: ' + missing.join(', ') : '');
  process.exit(1);
}
console.log(`APK check ok: ${needed.length} page files present`);
console.log('\nbuilt', path.relative(ROOT, APK), (fs.statSync(APK).size / 1024 / 1024).toFixed(2) + ' MB');
