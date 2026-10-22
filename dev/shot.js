// Renders a dev page offscreen and saves a PNG (for checking artwork without opening a window):
//   npx electron dev/shot.js "dev/gallery.html?mode=hero&hero=hulk&freeze=1.3" out.png [width] [waitMs]
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [page, out, width, wait] = process.argv.slice(2);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const [file, query] = page.split('?');
  const url = pathToFileURL(path.resolve(file)).href + (query ? '?' + query : '');
  const win = new BrowserWindow({ show: false, width: +width || 1400, height: 900, webPreferences: { offscreen: true } });
  await win.loadURL(url);
  await new Promise((r) => setTimeout(r, +wait || 800));
  const h = await win.webContents.executeJavaScript('Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');
  win.setContentSize(+width || 1400, Math.min(4000, h));
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.resolve(out), img.toPNG());
  console.log(`wrote ${out} (${img.getSize().width}×${img.getSize().height})`);
  app.quit();
});
