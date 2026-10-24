# 🐱🦾🦅👊🕷️ Desktop Buddies

Little companions that live on your desktop — on **Windows, macOS and Linux**.

- **Cat** — a small white cat with needs, moods and a mess to clean up.
- **Iron Man** — an armored hero who lives on the floor of your screens, flies,
  and fights the enemies you drop on him.
- **Homelander** — flies like he owns the place, burns enemies with heat vision.
- **Hulk** — can't fly, so he leaps; smashes, claps and throws things.
- **Spider-Man** — swings on webs from the top of your screen and webs enemies up.

They live on top of everything (on every monitor) while you keep working
underneath, and they can all **remind you of things**: at the time you set, your
buddy comes to the middle of the main screen and tells you what to do.

Everything is drawn in code and every sound is synthesized — there are no image
or audio assets. (Iron Man, Homelander, Hulk and Spider-Man here are original
fan-made drawings for personal use; the characters belong to Marvel and to
Amazon / The Boys. If you publish this widely, rename them.)

## 📦 Editions — one app per character

The same code builds several separate apps. Each has its own name, icon, tray
icon and save, so you can install any of them (or several side by side):

| App | Character | Build |
|---|---|---|
| **Desktop Cat** | its own ginger tabby, with levels, outfits, focus timer, feather wand & gifts | `node scripts/build-editions.js cat` |
| **Desktop Iron Man** | Iron Man — Mark III, Mark 50 nanotech or the Hulkbuster | `node scripts/build-editions.js ironman` |
| **Desktop Homelander** | Homelander | `node scripts/build-editions.js homelander` |
| **Desktop Hulk** | Hulk | `node scripts/build-editions.js hulk` |
| **Desktop Spider-Man** | Spider-Man | `node scripts/build-editions.js spiderman` |
| **Desktop Buddies** | all five, switch from the menu | `node scripts/build-editions.js all` |

`npm run editions` builds the five single-character apps for the current OS
(add `--win`, `--mac` or `--linux`, and `--x64` to skip arm64). Installers land in
`dist/<edition>/`. To try one without building: `npm run start:hulk` (or
`start:cat`, `start:ironman`, `start:homelander`, `start:spiderman`) — each keeps its own save.

## 🐱 The cat

| | |
|---|---|
| **Pick it up** | Drag the cat: it's carried by the scruff like a mother cat carries a kitten, swings as you move, and lands on its feet where you let go. Shake it and it gets dizzy. |
| **Hunger** | Feed fish, kibble, chicken or milk, or a treat by hand. A hungry cat begs and gets thin; if it starves too long it becomes weak and **dies** — a ghost floats up and a R.I.P. tombstone appears. Lay flowers or adopt a new kitten. |
| **Poop** | It poops, kicks "litter" and runs off. *Clean up → Scoop poop* turns your cursor into a scoop — click each one to collect it. |
| **Sleep** | A sleepy cat shows a 🌙 bubble. *Sleep* places a bed; it circles twice and curls up. |
| **Mouse chase** | Your cursor becomes a toy mouse; the cat stalks, wiggles and pounces. |
| **Mischief** | Scratches the screen and drags pretend files around. Fix with the repair spray and *Tidy up files*. |
| **More** | Laser, yarn, box, catnip, brush, petting & purring, slow blinks, zoomies, moods and thought bubbles. |

## 🧡 Desktop Cat (the standalone cat app)

Desktop Cat is its own app with its own look — not the all-in-one's white cat:

| | |
|---|---|
| **The cat** | A ginger tabby (stripes, white bib, socks and muzzle) wearing a red collar with a golden bell that jingles as it trots. Other coats: tuxedo, calico, siamese, grey tabby. Warm "cozy" menus and Cat Home, its own logo and tray icon. |
| **Bond level** | Meals, petting, play, cleaning up and focusing earn bond points. Every level unlocks an outfit — bow tie, bandana, flower crown, party hat, glasses, scarf, crown (*Dress up* in the menu, or the Wardrobe in Cat Home). |
| **Focus timer** | 15 / 25 / 50 minutes: the cat naps quietly in the corner with a little tomato timer above it (its needs pause), then comes over to say it's break time — take a break or focus 25 more. |
| **Feather wand** | *Play → Feather wand*: a feather dangles from your cursor; hold it above the cat and it leaps straight up to grab it. |
| **Gifts** | A happy, well-loved cat sometimes goes exploring and brings you a present — a feather, a leaf, a sock, a bottle cap… Click it to keep it on the Gift shelf. |

## 🦾 Iron Man

| | |
|---|---|
| **On the ground** | He stands and walks (heavy metal steps) on the bottom of each screen. To go anywhere higher he has to **fly**: crouch, take off, hover, cruise in the classic flight pose, and finish with a superhero landing. |
| **Enemies** | Right-click → *Deploy enemy* (each villain shown with its portrait) drops one of **Ultron's army** — a flying **Ultron sentry** (twin blasts), an **Ultron soldier** (burst fire), **Ultron Prime** (plasma shells and a fan of blasts) or a **swarm** of kamikaze Ultron drones — or a villain boss, who arrives with an intro card and keeps a health bar with his portrait at the top of the screen: **Thanos** (towering, with the Infinity Gauntlet: a stone-powered beam, a Power Stone blast, a Space Stone portal jump, a ground slam — and once per fight, when he's losing, **the snap**: a white flash, every hero loses half their health and some allies turn to dust), **Doctor Doom** (flies; homing mystic bolts, a lightning beam, a lightning storm that strikes the marked floor, a force field, and **Doombots** at his side), **Kang the Conqueror** (steps through time portals, **freezes a hero in time**, opens portals that drop a squad, chrono-bolt bursts and a heavy time blast) or **Galactus**, scaled to most of the screen's height, with a sweeping Power Cosmic eye beam, a **drain** that pulls the heroes' power out of them, a **meteor shower**, homing cosmic orbs and an earthquake stomp. Ground units fall to the floor; flyers swarm around him. Every hero can beat all of them. |
| **Weapons** | **Repulsor** palm blasts, **double hand blast** at close range, homing **micro-missiles** from the shoulders, the **unibeam** from the arc reactor (cuts through a whole line), and a punch when they get too close. He also dodges incoming fire. |
| **Attack here** | Right-click any spot → *Attack here* → fire that weapon at it. Click an enemy to lock it as the priority target. |
| **☢ Nuke** | Right-click → *Drop a nuke here* (or HQ → *Nuke*, per screen). An air-raid siren wails, a laser marks ground zero, and the bomb whistles down onto the floor of that screen. Then a white flash, a ground-burst fireball that climbs into a mushroom cloud with a condensation ring, and a shockwave that sweeps the **whole screen** — every enemy on it is destroyed — and rolls on into your other screens. Iron Man (and the Legion) race to the far side of another screen; when the wave catches them they're **thrown** through the air, tumble, crash and get back up. |
| **⚔ Army attack** | Right-click → *Army attack…* (or HQ → *Army attack*): choose where they come from (left, right, the sky or both sides) and how many: 10, 20, 35, 50, or the **epic** battles — **200** and **1000 (legendary)**. Ultron's legions fill the waves, Thanos, Doctor Doom and Kang lead the later ones, and the legendary battle ends with **Galactus**. A banner tracks how many are left. |
| **🦾 Iron Legion** | When an army arrives Iron Man calls in other suits — 2 for a small army, up to **7** for a big one — each in its own colors with a callsign (MK-XVII, MK-XL…). They fly in, take their own positions and fight alongside him; in an epic battle a destroyed suit is replaced. When the army is beaten they salute and fly home. You can also *Call / Dismiss the Legion* from the Suit menu. |
| **Power & armor** | Flying and weapons drain the arc reactor, standing on the floor recharges it, missiles reload over time. At zero armor the suit goes **offline**, falls and **reboots**. Menu → *Suit* → repair / recharge. |
| **More** | Patrols, fly-bys, area scans, **diagnostics** (your real CPU, memory, battery, uptime in a HUD card), thumbs-up, eight suit colors, random invasions (off by default), difficulty, stand-by mode. Drag him and let go — his thrusters catch him. |
| **HUD look** | His menu and the home window ("HQ") switch to a holographic HUD theme. |

## 🦅 Homelander

| | |
|---|---|
| **Flight** | Flies like he owns the sky — no thrusters, just a flag cape that hangs, flutters and streams behind him. Hovers with arms crossed, cruises fist-first, lands softly or with a one-knee "meteor" landing. Drop him and he simply stays in the air, annoyed. |
| **Weapons** | **Heat vision** zaps and a long **sweeping beam** that scorches a whole line of enemies (and the floor), a **super punch** that sends them flying, a **flying ram** through a line, a **sonic clap** that stuns, and **grab & throw** — he lifts a tank overhead and hurls it into the crowd. |
| **Approval** | His third meter is his public approval rating: wins and press conferences raise it, getting hurt or poked lowers it — and below 35% he gets faster and meaner. He takes less than half the damage anyone else would; at zero he lies dazed, then gets up furious. |
| **Fights alone** | No allies — he beats a 1000-unit legendary army on his own. The nuke? He doesn't run; he crosses his arms and gets thrown anyway. |
| **More** | Waves to fans, poses for the camera, checks his hair, stares at your cursor. Looks: classic, midnight, white gala. His home is *Vought Tower*. |

## 👊 Hulk

| | |
|---|---|
| **Leaps** | Hulk can't fly. He stomps along the floor (dust on every step) and gets everywhere else in giant leaps — onto flyers, to other screens, to the reminder spot — landing with a floor smash that dazes whatever stands nearby. |
| **Smashing** | Punch combos that launch robots, a **ground smash** shockwave along the floor, a **thunderclap** that blows flyers away and wipes out incoming shots, a **leap-swat** that turns a drone into a missile, **boulders** ripped out of the floor, and **grab & throw** a tank at the biggest group. |
| **Rage** | Rage builds while he fights and when he's hurt and boosts his damage; at 100% he goes on a 9-second **HULK SMASH** rampage. Health regenerates fast; stamina pays for leaps and smashes. |
| **Knocked out** | He collapses and turns into a small, apologetic **Bruce Banner** — then grows back with a gamma flash and a roar. *Hulk → Bruce Banner* in the menu does it on purpose. |
| **More** | "HULK NOT TOY!" when you pick him up; dropped, he smashes the floor. Sleeps sitting up in quiet mode. Skins: green, grey, savage. His home is *Gamma Base*. |

## 🕷️ Spider-Man

| | |
|---|---|
| **Web-swinging** | Spider-Man can't fly either: he swings in pendulum arcs from webs stuck to the top of your screen (never dipping into the floor), zips straight to exact spots, flips and lands in a three-point crouch, and hangs upside-down from a thread. Drop him and he catches a web. |
| **Fighting** | **Web shots** stick enemies in place (webbed flyers sink, webbed walkers can't shoot), **web-zip kicks**, **web-yank** a drone down and slam it, whirl a walker overhead and fling it, **impact webs** that snare a whole group, spider-sense dodges and punch/kick combos. |
| **Spider-Verse** | In an army battle up to 5 other spider-heroes swing in — Miles, Gwen, 2099, Noir, the black suit, Iron Spider… A worn-out ally taps out through a portal and a fresh one arrives. |
| **More** | Delivers reminders hanging upside-down in the middle of the screen; naps upside-down in a corner in quiet mode. Meters: web fluid, health, impact webs. Seven suits. |

## ⏰ Reminders

Home window → **Reminders**: pick a time and type what you need to do
(once, every day, weekdays or weekends), or use a quick 5/15/30/60-minute timer.
At that time your buddy comes to the **center of your main screen** — the cat
runs over and meows, Iron Man flies in and delivers a *mission briefing* — shows
the task and **reads it aloud**. Press **Done** or **Snooze** 5/15 min. A system
notification is sent too. Missed by a few minutes (computer asleep)? It still fires.

## Run it

Requires **Node.js 22+** (Electron 45's installer needs it).

```bash
cd desktop-cat
npm install
npm start
```

Find the app in the **menu-bar / system-tray** icon. Upgrading from "Desktop Cat"?
Your cat comes along automatically.

### macOS: right-click anywhere

macOS only lets apps see clicks outside their own windows with **Accessibility**
permission. Without it everything still works — right-click **the character**,
use the menu-bar icon, or press **⌘⌥⇧K** — but to right-click *anywhere*, open
the menu → **Enable right-click anywhere…** and switch on *Desktop Buddies* (or
*Electron* when running from source) in System Settings → Privacy & Security →
Accessibility. On Windows and Linux no permission is needed.

## Build installers

```bash
npm run icon                                  # (re)draw every app & tray icon into build/
node scripts/build-editions.js --win --x64    # Desktop Cat / Homelander / Hulk / Spider-Man
node scripts/build-editions.js all            # the all-in-one Desktop Buddies
```

Per platform: `.exe` installer + portable `.exe` on Windows, `.dmg` + `.zip` on a
Mac, `.AppImage` + `.deb` on Linux. `npm run dist:win` (etc.) still builds the plain
all-in-one app with the settings in package.json.

The GitHub Actions workflow (`.github/workflows/build.yml`) builds every edition on
all three systems: push a tag like `v3.0.0` or run it manually, then download the
installers from the run's *Artifacts*. Builds are unsigned (macOS: right-click →
*Open* the first time; Windows: SmartScreen may ask to confirm).

## 📱 Android

The buddies also run on Android phones, drawn **over your other apps** like on a
desktop. The same simulation and drawings run in a WebView (`src/mobile/`: `host.js`
stands in for the Electron main process); a small Java shell (`android/`) puts it in
a "display over other apps" overlay with a foreground service.

```bash
npm run android            # → dist/android/DesktopBuddies.apk (all-in-one edition)
```

Needs JDK 17 (`JAVA_HOME`) and the Android SDK (`ANDROID_HOME`) with
`platforms;android-34` and `build-tools;34.0.0`. There is no Gradle: the script calls
aapt2, javac, d8, zipalign and apksigner directly, and signs with
`~/.android/debug.keystore` (made on first build). Android icons come from
`python scripts/make-android-icons.py`.

On the phone: install the APK (allow installs from your browser / file manager),
open **Desktop Buddies**, allow *Display over other apps*, tap **Start buddies**.
Tap a buddy to boop it, drag to carry it, press and hold for its menu; the
notification has Menu, Home and Stop. Touches anywhere else go to the app below.
Android 12+ only lets touches pass through an overlay that is at most 80% opaque, so
the buddies are drawn slightly see-through until you open a menu.

To try the phone layout in a desktop browser, serve `src/` (e.g.
`python -m http.server -d src 8771`) after `npm run mobile` and open
`http://localhost:8771/mobile/index.html`.

**iOS** doesn't allow apps to draw over other apps, so an iPhone version can only show
the buddies inside its own app (the same `src/mobile` page in a WKWebView). Building it
needs a Mac with Xcode.

## Controls

| Do this | Cat | Heroes |
|---|---|---|
| Right-click (anywhere / on it) | care menu | hero menu |
| ⌘⌥⇧K / Ctrl+Alt+Shift+K | menu at the cursor | menu at the cursor |
| Drag | carry by the scruff | carry them — Iron Man & Homelander hover, Hulk smashes down, Spider-Man webs up |
| Click | boop | quips |
| Hover | needs card | the hero's meters |
| Stroke back & forth | petting, purring | — |
| Click an enemy | — | lock target |
| Esc (needs global hook) | put tool away | snooze a briefing |

## Platform notes

- **Linux:** needs a compositor for transparency (plain i3/openbox: run `picom`).
  The app runs through X11/XWayland (it relaunches itself with
  `--ozone-platform=x11` on Wayland); on a pure Wayland session cursor-following
  may be limited — an "on Xorg" session works best. The tray needs AppIndicator
  support (GNOME: the *AppIndicator* extension); launching the app again also
  brings a hidden buddy back.
- **Windows:** the overlay is 1px shorter than the screen so Windows doesn't treat it
  as a fullscreen app.

## How it works

```
src/main/main.js       Electron main: overlays per display, click-through, tray, menu, IPC,
                       character switching, reminders, saving (+ import from "Desktop Cat")
src/main/editions.js   Which app this is (Desktop Buddies / Cat / Homelander / Hulk / Spider-Man)
src/main/world.js      Cat simulation: needs, generator "tasks" brain, entities, tools
src/main/ironman.js    Hero world: floor per screen, enemy AI, projectiles, beams, damage,
                       stun / knock-back / grab, nuke, armies, allies — plus Iron Man himself
src/main/heroes/       Homelander, Hulk, Spider-Man: Hero subclasses (moves, weapons, lines, UI)
src/main/reminders.js  Reminder scheduling (once / daily / weekdays / weekends, snooze)
src/main/geometry.js   Multi-monitor union, clamping, routing across screen edges
src/main/sysinfo.js    CPU / memory / uptime for the hero's diagnostics
src/main/hook.js       Optional global mouse/keyboard hook (uiohook-napi, listen-only)
src/renderer/catArt.js    Procedural cat: skeleton, 27 blended poses, faces
src/renderer/ironArt.js   Procedural armored hero (21 poses, 2-bone IK), enemies, beams, explosions, nuke
src/renderer/heroes/      Procedural Homelander, Hulk, Spider-Man (poses, looks, effects, sounds, icons)
src/renderer/overlay.js   Draws the world as depth-sorted sprites; briefing & diagnostics panels
src/renderer/ironScene.js Hero / enemy / projectile rendering for whichever hero is out
src/renderer/menu.js      Right-click menu for each character
src/renderer/sound.js     Synthesized sounds + text-to-speech for reminders
src/home/                 Home window (Cat Home / HQ), reminders editor
```

### Developing

- `npm test` — headless cat, multi-monitor and hero/combat/army/nuke/reminder tests for
  every hero (each including a full 1000-unit battle).
- `dev/gallery.html` — every pose, face, prop, hero pose and enemy (serve the folder,
  e.g. `python3 -m http.server`, then open `/dev/gallery.html?mode=iron`, or
  `?mode=hero&hero=hulk`). `npx electron dev/shot.js "dev/gallery.html?mode=hero&hero=spiderman" out.png`
  saves it as a PNG without opening a window.
- `node dev/capture.js <edition> <dir> [commands…]` runs the real app with a throwaway save
  and saves screenshots.
- `npm run dev` with `CAT_CMD_FILE=/tmp/cmd.txt` drives the app from a file
  (`character {"name":"ironman"}`, `spawn {"kind":"boss","x":900,"y":400}`,
  `reminderAdd {"inMinutes":0,"text":"Test"}`, `capture {"dir":"/tmp"}` …) — see `devPoll`.
- `CAT_USER_DATA=/some/dir` uses a separate save; `DESKTOP_CAT_NO_HOOK=1` skips the global hook.

## Ideas for later

More characters (a Venom, a Thor…), kitten → adult growth, sitting on top of windows, reacting to
typing, achievements, a boss-rush mode, buddies that meet each other, calendar import
for reminders.
