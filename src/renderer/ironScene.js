/*
 * Desktop Buddies — overlay renderer for the hero (Iron Man, Homelander, Hulk,
 * Spider-Man), the allies, enemies, projectiles and the nuke.
 * Created by overlay.js with shared helpers (sprites, particles, bounds).
 *
 * Each hero's look comes from HeroArts[character] (ironArt.js, heroes/*.js):
 *   name, theme             menu header / CSS theme ('iron', 'vought', 'gamma', 'spider')
 *   makeRig(pose, c), lerpRig(a, b, k), drawHero(ctx, rig, { look, T, h })
 *   points(rig)             hero-local attach points: { reactor, palms[], head, eyes?, hand? }
 *   drawBust(ctx, look, T)  avatar for menus and the home window
 *   box                     sprite size in hero units (default 300)
 *   callout(ctx, text, x, y, alpha, tone, h)   words above the head (default: HUD text)
 *   cardTitle(h)            first line of the hover status card
 *   trail(h, rig, toG, spawn, S, now)          particles while moving fast
 *   loop                    engine sound loop while airborne ('thrust' | null)
 *   drawShot(ctx, p, x, y, T)  → true if it drew this projectile kind
 *   beamColors(b)           → { halo, core } for this hero's beams
 *   drawWorld(ctx, s, h, pts, T)  full-screen extras (web lines…); worldBusy(s) keeps that layer alive
 *   expandFx(e, S, spawn)   → true if it handled this fx event
 *   drawEnemyOverlay(ctx, e, T, cy)  drawn over an enemy (e.g. web on a stunned one; e.stun, e.stunKind)
 */
(function (root) {
  'use strict';
  const { clamp, lerp, smooth } = CatArt.util;
  const A = IronArt;
  const artFor = (ch) => (root.HeroArts && root.HeroArts[ch]) || root.HeroArts.ironman;

  function create(env) {
    const { Sprite, inB, spawn } = env;
    const V = root.VillainArt || null; // the enemies' own drawings (villains.js)
    const enemySprites = new Map();
    const views = new Map(); // hero id -> HeroView
    let lastNuke = null;
    let ashAt = 0;

    // ---------------------------------------------------------------- one suit on screen
    function HeroView(id) {
      const sprite = new Sprite();
      const shadow = new Sprite();
      const R = { rig: null, key: '', from: null, blendStart: 0, blendDur: 0.2, hoverSince: 0, trailAt: 0, pts: null };

      function interp(now, h) {
        if (h.mode === 'held') return { x: h.x, y: h.y, dist: h.dist };
        const snaps = env.snaps();
        const rt = now - 40;
        const find = (s) => (id === 'main' ? s.hero : s.allies && s.allies.find((x) => x.id === id));
        for (let i = snaps.length - 1; i > 0; i--) {
          if (snaps[i - 1].t > rt) continue;
          const a = find(snaps[i - 1]), b = find(snaps[i]);
          if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) > 300) break;
          const k = clamp((rt - snaps[i - 1].t) / Math.max(1, snaps[i].t - snaps[i - 1].t), 0, 1.25);
          return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), dist: lerp(a.dist, b.dist, k) };
        }
        return { x: h.x, y: h.y, dist: h.dist };
      }

      function buildRig(ART, h, now, T, S, gx, gy) {
        const name = h.mode === 'held' ? 'held' : h.mode === 'down' ? 'down' : h.mode === 'thrown' ? 'stagger' : h.pose;
        let aim = null;
        if (h.aim) {
          const sh = { x: gx + h.facing * -10.5 * S, y: gy - 74 * S };
          const dx = (h.aim.x - sh.x) * h.facing, dy = h.aim.y - sh.y, d = Math.hypot(dx, dy) || 1;
          aim = { x: dx / d, y: dy / d };
        }
        const sp = Math.hypot(h.vx, h.vy) || 1;
        const c = {
          t: (now - h.poseStart) / 1000, T, phase: (h.dist / (30 * S)) * Math.PI * 2, aim,
          m: { air: h.mode === 'air', charge: h.charge, beam: h.beam, lean: clamp(h.vx * h.facing / (400 * S), -1, 1), climb: clamp(-h.vy / sp, -1, 1), swing: h.swing, eyes: h.eyes, reactor: h.mode === 'down' ? 0.15 : undefined, h },
        };
        const live = ART.makeRig(name, c);
        live.eyes = name === 'down' || name === 'powerDown' ? live.eyes : h.eyes;
        if (h.mode === 'thrown') live.rot = h.spin * h.facing;
        if (name !== R.key) {
          R.from = R.rig || live; R.blendStart = now; R.key = name;
          R.blendDur = name === 'land' || name === 'held' || name === 'stagger' ? 0.12 : name === 'fly' ? 0.28 : 0.2;
        }
        const k = smooth(clamp((now - R.blendStart) / (R.blendDur * 1000), 0, 1));
        const rig = k >= 1 ? live : ART.lerpRig(R.from, live, k);
        R.rig = rig;
        return rig;
      }

      function render(s, h, now, T, main) {
        const ART = artFor(s.character);
        if (R.art !== ART) { R.art = ART; R.rig = null; R.key = ''; }
        const S = s.s * (h.body || 1);
        const hp = interp(now, h);
        const gx = hp.x, gy = hp.y;
        // floor shadow
        const ground = h.ground == null ? gy : h.ground;
        const height = Math.max(0, ground - gy);
        shadow.size(120 * S, 20 * S, 60 * S, 10 * S);
        if (height < 420 * S && h.mode !== 'held' && shadow.place(gx, ground, Math.round(ground) - 5)) {
          const c = shadow.begin();
          const k = 1 - height / (420 * S);
          c.fillStyle = `rgba(0,0,0,${0.18 * k})`;
          c.beginPath(); c.ellipse(0, 0, (h.pose === 'down' ? 46 : 22) * S * (0.5 + 0.5 * k), 4.5 * S * (0.5 + 0.5 * k), 0, 0, Math.PI * 2); c.fill();
        } else shadow.hide();

        const box = ART.box || 300;
        sprite.size(box * S, box * S, box * S / 2, box * S * 0.633);
        if (!sprite.place(gx, gy, Math.round(gy) + 10)) { R.rig = null; R.key = ''; R.pts = null; return null; }
        const rig = buildRig(ART, h, now, T, S, gx, gy);
        const ctx = sprite.begin();
        ctx.save();
        ctx.scale(S * h.facing, S);
        ART.drawHero(ctx, rig, { suit: h.suit || s.suit, look: h.ally ? h.suit : s.look, T, h });
        ctx.restore();
        if (now - h.hitAt < 130) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.fillRect(0, 0, sprite.c.width, sprite.c.height);
          ctx.restore();
        }
        const P = ART.points(rig);
        const toG = (p) => ({ x: gx + p.x * S * h.facing, y: gy + p.y * S });
        R.pts = { reactor: toG(P.reactor || P.head), palms: P.palms.map(toG), head: toG(P.head), at: now };
        R.pts.palm = R.pts.palms[0];
        R.pts.eyes = P.eyes ? toG(P.eyes) : R.pts.head;
        R.pts.hand = P.hand ? toG(P.hand) : R.pts.palm;
        if (ART.trail) ART.trail(h, rig, toG, spawn, S, now, R);
        else if ((h.mode === 'air' || h.mode === 'thrown') && h.speed > 160 * S && now - R.trailAt > 40) {
          R.trailAt = now;
          const fp = toG({ x: rig.legs[0].foot.x, y: rig.legs[0].foot.y });
          spawn({ kind: h.mode === 'thrown' ? 'smoke' : 'thrust', x: fp.x - h.vx * 0.02, y: fp.y - h.vy * 0.02, n: 1, small: true, color: '120,220,255', life: 0.6 });
        }
        // HUD callouts (+ status card for the main suit)
        ctx.save();
        ctx.scale(S, S);
        const top = h.mode === 'thrown' ? -110 : P.head.y - 20;
        const hx = h.mode === 'thrown' ? 0 : h.facing * P.head.x;
        const hud = h.hud || [];
        const say = ART.callout || ((c2, text, x, y, a, tone, hh) => A.hudText(c2, text, x, y, a, tone === 'warn' ? '#ffb347' : hh.ally ? '#c9f3ff' : null));
        const lineH = ART.calloutHeight || 17;
        hud.forEach((x, i) => {
          const age = (Date.now() - x.start) / 1000;
          const a = clamp(Math.min(age / 0.15, (2.6 - age) / 0.4), 0, 1);
          say(ctx, x.text, hx, top - (hud.length - 1 - i) * lineH, a, x.tone, h);
        });
        if (h.ally && !hud.length && h.mode !== 'thrown') say(ctx, h.callsign, hx, top + 2, 0.55, 'tag', h);
        if (main && hover(s, gx, gy, S, h) && !hud.length) (ART.card || statusCard)(ctx, h, hx, top + 4, ART);
        ctx.restore();
        return { gx, gy, here: inB({ x: gx, y: gy - 50 * S }, 40) };
      }

      function hover(s, gx, gy, S, h) {
        const c = s.cursor;
        const inside = Math.abs(c.x - gx) < (h.pose === 'fly' ? 50 : 20) * S && c.y < gy + 4 * S && c.y > gy - 100 * S && h.mode !== 'held';
        if (!inside) { R.hoverSince = 0; return false; }
        if (!R.hoverSince) R.hoverSince = Date.now();
        return Date.now() - R.hoverSince > 400;
      }

      function dispose() { sprite.destroy(); shadow.destroy(); }
      function hide() { sprite.hide(); shadow.hide(); R.rig = null; R.key = ''; R.pts = null; }
      return { render, dispose, hide, R };
    }

    // the hover card: the hero's meters in a little HUD box (a hero can bring its own)
    function statusCard(ctx, h, x, bottom, ART) {
      const meters = h.meters || [];
      const w = 92, hh = 20 + meters.length * 10;
      ctx.save();
      ctx.translate(x - w / 2, bottom - hh);
      ctx.fillStyle = 'rgba(6,18,30,0.82)';
      ctx.fillRect(0, 0, w, hh);
      ctx.strokeStyle = 'rgba(110,225,255,0.9)'; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, hh - 1);
      ctx.font = '600 8px ui-monospace, Menlo, Consolas, monospace';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#8ff0ff';
      ctx.fillText(((ART && ART.cardTitle ? ART.cardTitle(h) : 'MK-XLII') + ' · ' + h.status.toUpperCase()).slice(0, 28), 6, 8);
      const rows = meters.map((m) => [m.short || m.label.slice(0, 3).toUpperCase(), m.v, m.color, m.invert]);
      rows.forEach(([l, v, col, inv], i) => {
        const y = 19 + i * 10;
        ctx.fillStyle = 'rgba(143,240,255,0.8)'; ctx.fillText(l, 6, y);
        ctx.fillStyle = 'rgba(143,240,255,0.15)'; ctx.fillRect(26, y - 2.5, w - 34, 5);
        ctx.fillStyle = v < 20 && !inv ? '#ff4d5e' : col; ctx.fillRect(26, y - 2.5, (w - 34) * clamp(v / 100, 0, 1), 5);
      });
      ctx.restore();
    }

    function renderHeroes(s, now, T) {
      const all = [s.hero, ...(s.allies || [])];
      const seen = new Set();
      let thrust = 0;
      for (const h of all) {
        seen.add(h.id);
        let v = views.get(h.id);
        if (!v) { v = HeroView(h.id); views.set(h.id, v); }
        const r = v.render(s, h, now, T, h.id === 'main');
        if (r && r.here && (h.mode === 'air' || h.mode === 'held' || h.mode === 'thrown')) {
          thrust = Math.max(thrust, h.mode === 'held' ? 0.15 : 0.35 + Math.min(0.65, h.speed / (700 * s.s)));
        }
      }
      const ART = artFor(s.character);
      CatSound.setLoop('thrust', ART.loop === null ? 0 : thrust);
      for (const [id, v] of views) if (!seen.has(id)) { v.dispose(); views.delete(id); }
    }

    // ---------------------------------------------------------------- enemies
    // sprite box and centre of each enemy kind (Ultron's army and the villains: villains.js)
    const ENEMY_INFO = (V && V.INFO) || {};
    const infoOf = (kind) => ENEMY_INFO[kind] || { box: { w: 60, h: 60, ax: 30, ay: 50 }, cy: 0, r: 22 };

    function renderEnemies(s, now, T) {
      const S = s.s;
      const ART = artFor(s.character);
      const seen = new Set();
      const ageOf = (e) => (now - e.born) / 1000;
      for (const e of s.enemies) {
        seen.add(e.id);
        const info = infoOf(e.kind);
        const box = info.box;
        let sp = enemySprites.get(e.id);
        if (!sp) { sp = new Sprite(); enemySprites.set(e.id, sp); }
        const cy = info.cy;
        // tumbling (knocked flying / thrown): a square canvas around its middle so nothing is cut off
        if (e.spin) { const m = Math.max(box.w, box.h) * 1.25; sp.size(m * S, m * S, m * S / 2, m * S / 2 - cy * S); }
        else sp.size(box.w * S, box.h * S, box.ax * S, box.ay * S);
        const k = clamp((Date.now() - s.t) / 1000, 0, 0.05);
        const x = e.x + e.vx * k, y = e.y + (e.air || e.launch ? e.vy * k : 0);
        if (!sp.place(x, y, Math.round(y) + (e.air || e.launch || e.grabbed ? 2000 : 0))) continue;
        // the giant is a big canvas: redraw it ~20 times a second unless it was just hit
        if (e.kind === 'galactus' && now - (sp.lastDraw || 0) < 50 && now - e.hitAt > 130 && !sp.flashed && s.lockId !== e.id) continue;
        sp.lastDraw = now;
        sp.flashed = now - e.hitAt < 110;
        const ctx = sp.begin();
        ctx.save();
        ctx.scale(S, S);
        const grow = clamp(ageOf(e) / 0.35, 0, 1);
        if (grow < 1) { ctx.scale(0.4 + 0.6 * grow, 0.4 + 0.6 * grow); ctx.globalAlpha = grow; }
        if (e.spin) { ctx.translate(0, cy); ctx.rotate(e.spin); ctx.translate(0, -cy); }
        A.drawEnemy(ctx, e, T);
        if (ART.drawEnemyOverlay) ART.drawEnemyOverlay(ctx, e, T, cy);
        ctx.restore();
        if (sp.flashed) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = 'source-atop';
          // the giant is hit almost non-stop: a fainter flash keeps him from washing out
          ctx.fillStyle = e.kind === 'galactus' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)';
          ctx.fillRect(0, 0, sp.c.width, sp.c.height);
          ctx.restore();
        }
        if (s.lockId === e.id) {
          ctx.save(); ctx.scale(S, S);
          A.reticle(ctx, 0, cy, info.r, T);
          ctx.restore();
        }
      }
      for (const [id, sp] of enemySprites) if (!seen.has(id)) { sp.destroy(); enemySprites.delete(id); }
    }

    // ---------------------------------------------------------------- the nuke
    function nukeState(s) {
      if (s.nuke) lastNuke = s.nuke;
      const n = s.nuke || lastNuke;
      if (!n) return null;
      const t = Date.now();
      if (t - n.det > 20000) { lastNuke = null; return null; }
      return n;
    }

    function nukeShake(n) {
      if (!n || !n.det) return 0;
      const t = (Date.now() - n.det) / 1000;
      if (t < 0 || t > 2.2) return 0;
      // the shake arrives with the shockwave
      const B = env.bounds();
      const cx = B.x + B.width / 2, cy = B.y + B.height / 2;
      const dd = Math.max(0, Math.hypot(cx - n.x, cy - n.y) - Math.hypot(B.width, B.height) / 2);
      const arrive = dd / n.speed;
      if (t < arrive) return 0;
      return Math.max(0, 1 - (t - arrive) / 1.6) * (dd > 0 ? 7 : 14);
    }

    function drawNuke(ctx, s, n, T) {
      const B = env.bounds();
      const W = env.work() || B;
      const t = Date.now();
      const here = inB(n);
      const floor = W.y + W.height;
      const R = Math.min(B.height * 0.3, B.width * 0.2, 340) * Math.max(0.8, s.s);
      // how high the cloud climbs: most of the way up the screen
      const H = Math.max(R * 1.4, (floor - B.y) * 0.6);
      if (!n.detonated || t < n.det) {
        if (!here) return;
        // warning: pulsing red vignette, ground-zero marker, falling bomb
        const pulse = 0.5 + 0.5 * Math.sin(t / 1000 * 7);
        const g = ctx.createRadialGradient(B.x + B.width / 2, B.y + B.height / 2, Math.min(B.width, B.height) * 0.25, B.x + B.width / 2, B.y + B.height / 2, Math.hypot(B.width, B.height) * 0.6);
        g.addColorStop(0, 'rgba(255,0,0,0)');
        g.addColorStop(1, `rgba(255,20,20,${0.22 + 0.28 * pulse})`);
        ctx.fillStyle = g;
        ctx.fillRect(B.x, B.y, B.width, B.height);
        A.drawNukeTarget(ctx, n.x, n.y, T, 1, B.y);
        if (t >= n.dropAt) {
          const k = clamp((t - n.dropAt) / (n.det - n.dropAt), 0, 1);
          const top = B.y - 90;
          const by = lerp(top, n.y, k * k);
          // speed streaks behind the bomb
          const tail = Math.min(by - top, 60 + 260 * k);
          const sg = ctx.createLinearGradient(0, by - 70 - tail, 0, by - 60);
          sg.addColorStop(0, 'rgba(230,230,235,0)');
          sg.addColorStop(1, 'rgba(230,230,235,0.55)');
          ctx.fillStyle = sg;
          ctx.fillRect(n.x - 9, by - 70 - tail, 18, tail);
          ctx.save(); ctx.scale(1.25, 1.25);
          A.drawBomb(ctx, n.x / 1.25, by / 1.25, T);
          ctx.restore();
        }
        return;
      }
      const dt = (t - n.det) / 1000;
      const r = dt * n.speed;
      // white flash (full on ground-zero screen, softer elsewhere)
      if (dt < 1.2) {
        const dd = here ? 0 : Math.max(0, Math.hypot(B.x + B.width / 2 - n.x, B.y + B.height / 2 - n.y) - Math.hypot(B.width, B.height) / 2);
        const a = clamp(1 - dt / 1.1, 0, 1) * (here ? 1 : clamp(1 - dd / 2500, 0.25, 0.7));
        ctx.fillStyle = `rgba(255,250,235,${a})`;
        ctx.fillRect(B.x, B.y, B.width, B.height);
      }
      if (here) {
        A.drawScorch(ctx, n.x, floor, R * 2.4, clamp(dt / 1.5, 0, 1) * clamp(1 - (dt - 12) / 8, 0, 1), dt);
        A.drawMushroom(ctx, n.x, floor, dt, R, H);
        // heat tint
        if (dt < 6) {
          ctx.fillStyle = `rgba(255,120,30,${0.18 * clamp(1 - dt / 6, 0, 1)})`;
          ctx.fillRect(B.x, B.y, B.width, B.height);
        }
      }
      if (r < n.rMax + 400) {
        A.drawShockwave(ctx, n.x, n.y, r, dt);
        A.drawDustWall(ctx, n.x, floor, r, dt, B.x, B.x + B.width);
      }
      // fallout: ash and embers drift down over ground zero
      if (here && dt > 1.2 && dt < 15 && t - ashAt > 70) {
        ashAt = t;
        spawn({ kind: 'ash', x: B.x + Math.random() * B.width, y: B.y + Math.random() * B.height * 0.3, n: 2, speed: 25, g: 18, life: 6, size: 1.2 });
        if (dt < 5) spawn({ kind: 'ember', x: n.x + (Math.random() - 0.5) * R * 2, y: n.y - Math.random() * H, n: 1, speed: 60, rise: 40, life: 1.6, size: 1.4 });
      }
    }

    // ---------------------------------------------------------------- fx layer (beams, projectiles, nuke)
    function fxBusy(s) {
      if (s.beams && s.beams.length) return true;
      const ART = artFor(s.character);
      if (ART.worldBusy && ART.worldBusy(s)) return true;
      if (nukeState(s)) return true;
      return !!(s.shots && s.shots.some((p) => inB(p, 80)));
    }

    function drawFx(ctx, s, now, T) {
      const S = s.s;
      const n = nukeState(s);
      if (n) drawNuke(ctx, s, n, T);
      const k = clamp((Date.now() - s.t) / 1000, 0, 0.06);
      const ART = artFor(s.character);
      if (ART.drawWorld) {
        for (const h of [s.hero, ...(s.allies || [])]) {
          const v = views.get(h.id);
          ART.drawWorld(ctx, s, h, v && v.R.pts && now - v.R.pts.at < 200 ? v.R.pts : null, T);
        }
      }
      for (const p of s.shots || []) {
        const x = p.x + p.vx * k, y = p.y + p.vy * k;
        if (!inB({ x, y }, 40)) continue;
        if (p.owner === 'enemy' && V && V.drawShot(ctx, p, x, y, T)) continue;
        if (ART.drawShot && ART.drawShot(ctx, p, x, y, T)) continue;
        if (p.kind === 'laser') A.drawLaser(ctx, x, y, p.vx, p.vy);
        else if (p.kind === 'shell') A.drawShell(ctx, x, y, T);
        else A.drawMissile(ctx, x, y, Math.atan2(p.vy, p.vx), T, p.kind === 'emissile');
        if ((p.kind === 'missile' || p.kind === 'emissile') && Math.random() < 0.35) spawn({ kind: 'smoke', x: x - p.vx * 0.015, y: y - p.vy * 0.015, n: 1, small: true });
      }
      for (const b of s.beams || []) {
        let x1 = b.x1, y1 = b.y1;
        const v = b.owner !== 'enemy' && views.get(b.owner);
        if (v && v.R.pts && now - v.R.pts.at < 200) {
          const st = v.R.pts[b.from || (b.kind === 'unibeam' ? 'reactor' : 'palm')] || v.R.pts.palm;
          x1 = st.x; y1 = st.y;
        }
        const age = (Date.now() - b.start) / 1000;
        const life = clamp(1 - age / b.dur, 0, 1);
        if (b.owner === 'enemy' && V && V.drawBeam(ctx, b, x1, y1, S, age, life, T)) continue;
        const own = b.owner !== 'enemy' && ART.beamColors ? ART.beamColors(b) : null;
        const halo = own ? own.halo : b.owner === 'enemy' ? '255,40,60' : '120,225,255';
        const core = own ? own.core : b.owner === 'enemy' ? 'rgba(255,220,220,0.95)' : null;
        ctx.save();
        if (b.kind === 'blast') {
          ctx.globalAlpha = life;
          A.drawBeam(ctx, x1, y1, b.x2, b.y2, b.w * S * (0.6 + 0.6 * (1 - life)), age, halo, core);
        } else {
          ctx.globalAlpha = b.kind === 'repulsor' ? Math.min(1, life * 1.8) : Math.min(1, life * 4, age * 8);
          A.drawBeam(ctx, x1, y1, b.x2, b.y2, b.w * S, age, halo, core);
        }
        ctx.restore();
      }
    }

    // ---------------------------------------------------------------- fx events from the simulation
    function expandFx(e, S, ch) {
      const ART = artFor(ch);
      if (ART.expandFx && ART.expandFx(e, S, spawn)) return true;
      if (V && V.expandFx(e, S, spawn)) return true;
      switch (e.kind) {
        case 'explosion': {
          const z = (e.size || 1) * S;
          spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 1.4 * z, life: 0.35, color: '255,200,120' });
          spawn({ kind: 'fire', x: e.x, y: e.y, n: Math.round(5 + 4 * (e.size || 1)), spread: 14 * z, size: z, life: 0.7 });
          spawn({ kind: 'smoke', x: e.x, y: e.y, n: Math.round(4 + 3 * (e.size || 1)), spread: 18 * z, size: z, life: 1.6, rise: 30 });
          spawn({ kind: 'debris', x: e.x, y: e.y, n: Math.round(6 + 6 * (e.size || 1)), speed: 220 * z, size: z, life: 1.1, g: 600 });
          spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: z, life: 0.5 });
          return true;
        }
        case 'nuke':
          // the big one: fire, debris thrown far, embers
          spawn({ kind: 'fire', x: e.x, y: e.y, n: 26, spread: 80 * S, size: 5 * S, life: 1.4 });
          spawn({ kind: 'debris', x: e.x, y: e.y, n: 60, speed: 900 * S, size: 1.6 * S, life: 2.4, g: 500 });
          spawn({ kind: 'ember', x: e.x, y: e.y, n: 40, speed: 500 * S, size: 1.5, life: 2.2, g: 120 });
          return true;
        case 'impact':
          spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 0.8 * S, life: 0.25 });
          spawn({ kind: 'spark', x: e.x, y: e.y, n: 6, speed: 160 * S, size: S, life: 0.35, color: '160,235,255' });
          return true;
        case 'spark':
        case 'hitspark':
          spawn({ kind: 'spark', x: e.x, y: e.y, n: e.kind === 'hitspark' ? 9 : 5, speed: 180 * S, size: S, life: 0.4 });
          if (e.kind === 'hitspark') spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 0.7 * S, life: 0.2, color: '255,200,120' });
          return true;
        case 'flash':
          spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: (e.size || 1) * S, life: 0.35, color: e.color });
          return true;
        case 'shockwave': {
          const z = (e.size || 1) * S;
          spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: 1.4 * z, life: 0.55, flat: 0.25 });
          spawn({ kind: 'dust', x: e.x, y: e.y - 2, n: 10, spread: 30 * z, size: z, life: 0.7 });
          return true;
        }
        case 'portal':
          spawn({ kind: 'portal', x: e.x, y: e.y, n: 1, size: S, life: 0.6 });
          return true;
        case 'scan':
          spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 3 * S, life: 1.6, color: '110,225,255', stagger: 0.35 });
          return true;
        case 'repair':
          spawn({ kind: 'sparkle', x: e.x, y: e.y, n: 12, spread: 30 * S, color: '#8ff0ff' });
          return true;
        default:
          return false;
      }
    }

    function busyHere(s) {
      const S = s.s;
      for (const h of [s.hero, ...(s.allies || [])]) if (inB({ x: h.x, y: h.y - 50 * S }, 200 * S) || (h.line && inB({ x: h.line.x2, y: h.line.y2 }, 0))) return true;
      if (s.enemies.some((e) => inB(e, 120 * S))) return true;
      return fxBusy(s) || !!s.announce || !!s.diag || !!s.army;
    }

    function wantFps(s) {
      const h = s.hero;
      // a huge battle is a lot to draw: 40fps still looks smooth and saves a third
      if (s.army && s.army.total >= 200 && !nukeState(s)) return 40;
      if (s.enemies.length || (s.shots && s.shots.length) || (s.beams && s.beams.length) || h.mode !== 'ground' || (h.hud && h.hud.length) || (s.allies && s.allies.length) || nukeState(s)) return 60;
      if (h.speed > 1 || (h.pose !== 'stand' && h.pose !== 'powerDown')) return 40;
      return 12;
    }

    function render(s, now, T) {
      renderEnemies(s, now, T);
      renderHeroes(s, now, T);
      env.shake(nukeShake(nukeState(s)));
    }

    function dispose() {
      for (const v of views.values()) v.dispose();
      views.clear();
      for (const sp of enemySprites.values()) sp.destroy();
      enemySprites.clear();
      lastNuke = null;
      env.shake(0);
      CatSound.setLoop('thrust', 0);
    }

    return { render, drawFx, fxBusy, expandFx, busyHere, wantFps, dispose, nukeState };
  }

  root.IronScene = { create };
})(typeof window !== 'undefined' ? window : globalThis);
