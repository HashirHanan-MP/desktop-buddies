// Renders the app icons and tray icons from the real artwork: `npm run icon`
//   build/icon.png (1024², the cat — Desktop Buddies & Desktop Cat), build/icon-<hero>.png (1024², one per hero edition)
//   build/tray-<character>.png (64²)
// Hero icons come from HeroArts[id].drawIcon / drawTray (src/renderer/heroes/*.js).
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HEROES = ['thor', 'homelander', 'hulk', 'spiderman'];

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<script src="../src/renderer/catArt.js"></script>
<script src="../src/renderer/props.js"></script>
<script src="../src/renderer/ironArt.js"></script>
${HEROES.map((h) => `<script src="../src/renderer/heroes/${h}.js"></script>`).join('\n')}
<script>
  const out = {};
  function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }
  function roundedSquare(x, top, bottom) {
    const r = 220;
    x.beginPath(); x.moveTo(r, 40); x.arcTo(984, 40, 984, 984, r); x.arcTo(984, 984, 40, 984, r); x.arcTo(40, 984, 40, 40, r); x.arcTo(40, 40, 984, 40, r); x.closePath();
    const g = x.createLinearGradient(0, 40, 0, 984); g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fill();
  }

  // ---- the cat (Desktop Buddies, Desktop Cat)
  {
    const c = canvas(1024), x = c.getContext('2d');
    roundedSquare(x, '#b9a8ff', '#7a66ff');
    x.save(); x.clip();
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath(); x.ellipse(512, 1010, 470, 150, 0, 0, Math.PI * 2); x.fill();
    x.translate(512, 975);
    x.scale(11.5, 11.5);
    const pose = CatArt.makePose('sitFront', { t: 0, T: 0.4, phase: 0, m: { tailUp: 1 } });
    CatArt.drawCat(x, pose, { eyes: 'normal', open: 1, pupil: 0.7, mouth: 'w', blush: 0.6, lookX: 0, lookY: 0.1 }, { T: 0.4, palette: 'white', eyes: 'blue' });
    x.restore();
    out['icon.png'] = c;
  }

  // ---- tray: cat face
  {
    const c = canvas(64), t1 = c.getContext('2d');
    t1.translate(32, 82); t1.scale(1.55, 1.55);
    CatArt.drawCat(t1, CatArt.makePose('sitFront', { t: 0, T: 0.4, phase: 0, m: {} }), { eyes: 'normal', open: 1, pupil: 0.8, mouth: 'w' }, { T: 0.4, palette: 'white', eyes: 'blue' });
    out['tray-cat.png'] = c;
  }

  // ---- tray: arc reactor
  {
    const c = canvas(64), t2 = c.getContext('2d');
    const R = 30;
    t2.translate(32, 32);
    t2.beginPath(); t2.arc(0, 0, R, 0, Math.PI * 2); t2.fillStyle = '#1a2230'; t2.fill();
    t2.lineWidth = 3; t2.strokeStyle = '#9aa6b8'; t2.stroke();
    const gg = t2.createRadialGradient(0, 0, 2, 0, 0, R - 4); gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.35, '#bff6ff'); gg.addColorStop(1, '#2aa6e0');
    t2.beginPath(); t2.arc(0, 0, R - 6, 0, Math.PI * 2); t2.fillStyle = gg; t2.fill();
    t2.strokeStyle = 'rgba(20,40,60,0.6)'; t2.lineWidth = 2.4;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; t2.beginPath(); t2.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); t2.lineTo(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7)); t2.stroke(); }
    t2.beginPath(); t2.arc(0, 0, 9, 0, Math.PI * 2); t2.fillStyle = '#ffffff'; t2.fill();
    out['tray-ironman.png'] = c;
  }

  // ---- Iron Man edition icon: the suit on a HUD-blue tile
  {
    const c = canvas(1024), x = c.getContext('2d');
    roundedSquare(x, '#123a5c', '#060d18');
    x.save(); x.clip();
    const g = x.createRadialGradient(512, 560, 40, 512, 560, 520);
    g.addColorStop(0, 'rgba(90,220,255,0.45)'); g.addColorStop(1, 'rgba(90,220,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    x.translate(470, 1790); x.scale(16.5, 16.5);
    IronArt.drawBust(x, 'classic', 0.4);
    x.restore();
    out['icon-ironman.png'] = c;
  }

  // ---- the standalone Desktop Cat: its own tabby logo
  if (CatArt.drawEditionIcon) { const c = canvas(1024); CatArt.drawEditionIcon(c.getContext('2d'), 1024); out['icon-desktopcat.png'] = c; }
  if (CatArt.drawEditionTray) { const c = canvas(64); CatArt.drawEditionTray(c.getContext('2d'), 64); out['tray-desktopcat.png'] = c; }

  // ---- the heroes draw their own (Iron Man's can replace the bust above)
  for (const id of ['ironman', ...${JSON.stringify(HEROES)}]) {
    const A = window.HeroArts && HeroArts[id];
    if (A && A.drawIcon) { const c = canvas(1024); A.drawIcon(c.getContext('2d'), 1024); out['icon-' + id + '.png'] = c; }
    if (A && A.drawTray) { const c = canvas(64); A.drawTray(c.getContext('2d'), 64); out['tray-' + id + '.png'] = c; }
  }

  window.done = Object.fromEntries(Object.entries(out).map(([k, c]) => [k, c.toDataURL('image/png')]));
</script></body></html>`;

app.whenReady().then(async () => {
  const tmp = path.join(__dirname, '_icon.html');
  fs.writeFileSync(tmp, html);
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, webPreferences: { offscreen: true } });
  await win.loadFile(tmp);
  const files = await win.webContents.executeJavaScript('window.done');
  const outDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(outDir, { recursive: true });
  for (const [f, url] of Object.entries(files)) fs.writeFileSync(path.join(outDir, f), Buffer.from(url.split(',')[1], 'base64'));
  fs.unlinkSync(tmp);
  console.log('wrote', Object.keys(files).map((f) => 'build/' + f).join(', '));
  app.quit();
});
