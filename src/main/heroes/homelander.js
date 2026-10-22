'use strict';
/*
 * Desktop Buddies — Homelander (fan-made, for personal use; the character
 * belongs to his creators). A flying, near-invulnerable corporate superhero.
 *
 * He flies everywhere (no thrusters — just the cape), hovers with his arms
 * crossed and fights with heat vision (quick zaps, and a long sweeping beam
 * that cuts through whole lines of enemies), a super punch that sends things
 * flying, a flying ram, a sonic clap that stuns, and grab-and-throw (a tank
 * hurled into the others).
 *
 * Meters: power = heat vision, armor = health (he only feels a fraction of
 * every hit), approval = his public approval rating: wins raise it, getting
 * hurt or poked lowers it, and a low rating makes him faster and meaner.
 * He fights alone — no allies, ever.
 */
const { Hero, ENEMY, util } = require('../ironman');
const { rand, chance, clamp, dist, num, segDist, isBoss } = util;

const TOUGH = 0.45; // share of incoming damage that actually lands
const LOOKS = [['classic', 'Classic (flag cape)'], ['midnight', 'Midnight ops'], ['gala', 'White gala suit']];

class HomelanderHero extends Hero {
  constructor(w, d, o) {
    super(w, d, o);
    d = d || {};
    this.callsign = 'HOMELANDER';
    this.approval = clamp(num(d.approval, 72), 0, 100);
    this.heat = 0;          // eye glow 0..1 (heat vision charging / firing)
    this.firing = false;    // heat vision on: no recharge
    this.face = null;       // expression override for the renderer
    this.holding = null;    // id of the enemy held over his head
    this.cd = { heat: 0, sweep: 0, punch: 0, ram: 0, clap: 0, grab: 0, dodge: 0, blast: 0, missiles: 0, unibeam: 0 };
    this.lastKills = w.counters ? w.counters.kills : 0;
  }

  // health: he only feels a fraction of every hit (and every hit hurts his image)
  get armor() { return this._armor; }
  set armor(v) {
    if (this._armor != null && v < this._armor && v < 100 && !this.rawArmor) {
      const lost = (this._armor - v) * TOUGH;
      v = this._armor - lost;
      if (this.approval != null) this.approval = clamp(this.approval - lost * 0.18, 0, 100);
    }
    this._armor = v;
  }

  // set health without the toughness discount (healing, knockout recovery, tests)
  setHealth(v) { this.rawArmor = true; this.armor = v; this.rawArmor = false; }

  get mad() { return this.approval < 35; }
  dmgMul() { return this.mad ? 1.3 : 1; }
  eyePoint() { return { x: this.x + this.facing * 5 * this.s, y: this.y - 87 * this.s }; }
  hands() { return { x: this.x + this.facing * 2 * this.s, y: this.y - 103 * this.s }; }

  run(gen, name, prio) {
    if (!this.inTask) { this.firing = false; this.face = null; this.holding = null; }
    super.run(gen, name, prio);
  }

  startHold() {
    if (this.mode === 'down') return;
    this.firing = false; this.holding = null;
    super.startHold();
    this.face = 'angry';
  }

  throwBy(vx, vy, dmg) {
    this.firing = false; this.holding = null;
    super.throwBy(vx, vy, dmg);
    if (this.mode === 'thrown') this.face = 'dazed';
  }

  // ------------------------------------------------------------ meters
  tickMeters(dt) {
    const w = this.w;
    // cooldowns run faster when he's angry
    if (this.mad) for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt * 0.5);
    if (!this.firing) this.power += (w.army ? 9 : w.enemies.length ? 4.5 : 9) * dt;
    if (this.mode !== 'down') this.setHealth(this.armor + (w.enemies.length ? 0.6 : 3) * dt);
    // wins raise his approval; otherwise it drifts back toward "liked"
    const k = w.counters.kills;
    if (k > this.lastKills) { this.approval += Math.min(4, (k - this.lastKills) * 0.4); }
    this.lastKills = k;
    this.approval += (62 - this.approval) * 0.004 * dt;
    if (!this.firing && this.heat > 0) this.heat = Math.max(0, this.heat - dt * 2.5);
    this.power = clamp(this.power, 0, 100);
    this.setHealth(clamp(this.armor, 0, 100));
    this.approval = clamp(this.approval, 0, 100);
  }

  // ------------------------------------------------------------ movement: flight without thrusters
  * walkTo(tx, o = {}) {
    const s = this.s;
    tx = this.w.clampFloorX(tx, this.x, this.y);
    let t = 0;
    while (Math.abs(tx - this.x) > 2) {
      const dir = Math.sign(tx - this.x);
      this.facing = dir;
      const step = Math.min(Math.abs(tx - this.x), 48 * s * this.dt);
      this.x += dir * step;
      this.dist += step;
      this.setPose('walk');
      t += this.dt;
      if (t > (o.timeout || 20) || (o.until && o.until())) break;
      yield;
    }
    this.setPose('stand');
  }

  airPose() {
    if (this.aim) return;
    const s = this.s;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 230 * s && Math.abs(this.vx) > Math.abs(this.vy) * 0.55) this.setPose('fly');
    else if (this.vy < -150 * s && Math.abs(this.vx) < 140 * s) this.setPose('flyUp');
    else this.setPose('hover');
  }

  * takeOff(height) {
    if (this.mode === 'air') return;
    const s = this.s;
    this.setPose('crouch');
    yield* this.wait(0.18);
    this.mode = 'air';
    this.vy = -320 * s;
    this.w.sound('whoosh', this);
    this.w.fx('shockwave', this.x, this.y, { size: 0.5 });
    const target = { x: this.x, y: this.y - (height || rand(140, 240)) * s };
    let t = 0;
    while (t < 1.2 && this.steer(target.x, target.y, 380 * s) > 6) { t += this.dt; yield; }
  }

  * land(x) {
    const s = this.s, w = this.w;
    if (this.mode === 'ground') return;
    const tx = x == null ? this.x : x;
    const g = w.groundAt(tx, this.y);
    if (g - this.y > 160 * s && chance(0.45)) {
      // the dramatic version: drops like a meteor, one knee down
      yield* this.flyTo({ x: tx, y: g - 80 * s }, { speed: 480, near: 14 });
      let t = 0;
      while (this.y < w.groundAt(this.x, this.y) - 1 && t < 1) {
        this.vy = Math.min(1000 * s, this.vy + 2800 * s * this.dt);
        this.vx *= 0.9;
        this.x += this.vx * this.dt; this.y += this.vy * this.dt;
        this.setPose('hover');
        t += this.dt;
        yield;
      }
      this.y = w.groundAt(this.x, this.y);
      this.vx = this.vy = 0;
      this.mode = 'ground';
      this.setPose('land');
      w.sound('landing', this);
      w.fx('shockwave', this.x, this.y, { size: 1.2 });
      yield* this.wait(0.9);
      this.setPose('stand');
      yield* this.wait(0.2);
    } else {
      // floats down like he owns the place
      yield* this.flyTo({ x: tx, y: g - 30 * s }, { speed: 260, near: 8 });
      let t = 0;
      while (this.y < w.groundAt(this.x, this.y) - 1 && t < 2) {
        this.steer(this.x, w.groundAt(this.x, this.y), 70 * s, 600 * s);
        this.setPose('hover');
        t += this.dt;
        yield;
      }
      this.y = w.groundAt(this.x, this.y);
      this.vx = this.vy = 0;
      this.mode = 'ground';
      this.setPose('stand');
      w.sound('thud', this);
      yield* this.wait(0.3);
    }
  }

  // ------------------------------------------------------------ weapons
  aimAt(tp) {
    this.aim = { x: tp.x, y: tp.y };
    this.aimArm = 'near';
    this.faceTo(tp);
  }

  * heatZap(tp, enemy, shots) {
    const w = this.w, s = this.s;
    for (let i = 0; i < (shots || 1); i++) {
      if (enemy && (enemy.hp <= 0 || !w.enemies.includes(enemy))) break;
      const t0 = enemy ? w.enemyCenter(enemy) : tp;
      this.aimAt(t0);
      this.setPose(this.mode === 'air' ? 'heatAir' : 'heat');
      this.face = 'angry';
      let t = 0;
      while (t < 0.16) { this.heat = Math.max(this.heat, t / 0.16); this.holdPosition(); t += this.dt; yield; }
      if (this.power < 2.5) { this.say(this.line('heatLow'), 'warn'); break; }
      this.power -= 2.5;
      const from = this.eyePoint();
      const alive = enemy && w.enemies.includes(enemy);
      const target = alive ? w.enemyCenter(enemy) : tp;
      const victim = alive && chance(0.93) ? enemy : w.firstEnemyOnLine(from, target, 1.2);
      let to = target;
      if (victim) {
        to = w.enemyCenter(victim);
        w.damage(victim, 2.6 * this.dmgMul(), from);
        w.fx('heatHit', to.x, to.y, {});
      } else if (enemy) {
        const ang = Math.atan2(target.y - from.y, target.x - from.x) + rand(-0.1, 0.1);
        to = { x: from.x + Math.cos(ang) * 900 * s, y: from.y + Math.sin(ang) * 900 * s };
      } else w.fx('heatHit', to.x, to.y, {});
      const b = w.addBeam('heat', from, to, 0.2, 3.2, this.id);
      b.from = 'eyes';
      this.firing = true;
      w.counters.shotsFired++;
      w.count('heatZaps');
      w.sound('heatZap', this);
      t = 0;
      while (t < 0.2) { this.heat = 1; this.holdPosition(); t += this.dt; yield; }
      this.firing = false;
    }
    this.firing = false;
    this.aim = null;
    this.face = null;
  }

  // the long beam: sweeps across every enemy in front of him
  * heatSweep(tp) {
    const w = this.w, s = this.s;
    this.aim = null;
    this.faceTo(tp);
    this.setPose(this.mode === 'air' ? 'heatAir' : 'heat');
    this.face = 'angry';
    this.say(this.line('sweep'));
    w.sound('heatCharge', this);
    let t = 0;
    while (t < 0.4) { this.heat = t / 0.4; this.holdPosition(); t += this.dt; yield; }
    if (this.power < 18) { this.say(this.line('heatLow'), 'warn'); this.face = null; return; }
    this.power -= 20;
    this.cd.sweep = w.army ? 3 : 6;
    w.count('sweeps');
    // local angles (mirrored so the front is −π/2…π/2) of every enemy ahead
    const e0 = this.eyePoint();
    const loc = (p) => Math.atan2(p.y - e0.y, (p.x - e0.x) * this.facing);
    const ahead = w.enemies.map((e) => w.enemyCenter(e)).filter((c) => (c.x - e0.x) * this.facing > -10 * s && dist(c, e0) < 1700 * s);
    let a0, a1;
    if (ahead.length) { const as = ahead.map(loc); a0 = Math.min(...as) - 0.12; a1 = Math.max(...as) + 0.12; } else { const a = loc(tp); a0 = a - 0.25; a1 = a + 0.25; }
    a0 = clamp(a0, -1.45, 1.45); a1 = clamp(a1, -1.45, 1.45);
    if (a1 - a0 < 0.3) { const m = (a0 + a1) / 2; a0 = m - 0.15; a1 = m + 0.15; }
    if (chance(0.5)) [a0, a1] = [a1, a0];
    const dur = clamp(Math.abs(a1 - a0) * 0.85, 0.7, 1.5);
    const beam = w.addBeam('sweep', e0, e0, dur + 0.05, 5, this.id);
    beam.from = 'eyes';
    w.sound('heatBeam', this);
    this.firing = true;
    t = 0;
    let burnAt = 0;
    while (t < dur) {
      const k = t / dur;
      const la = a0 + (a1 - a0) * (k * k * (3 - 2 * k));
      const ang = Math.atan2(Math.sin(la), Math.cos(la) * this.facing);
      const f = this.eyePoint();
      let L = 1700 * s;
      // the beam stops where it meets the floor (and scorches it)
      const g = w.groundAt(f.x + Math.cos(ang) * 200 * s, f.y);
      if (Math.sin(ang) > 0.02) L = Math.min(L, (g - f.y) / Math.sin(ang));
      const end = { x: f.x + Math.cos(ang) * L, y: f.y + Math.sin(ang) * L };
      beam.x1 = f.x; beam.y1 = f.y; beam.x2 = end.x; beam.y2 = end.y;
      for (const e of [...w.enemies]) {
        const c = w.enemyCenter(e);
        if (segDist(c, f, end) < (14 + (isBoss(e) ? Math.max(40, ENEMY[e.kind].r - 20) : 12)) * s) w.damage(e, 46 * this.dt * this.dmgMul(), f, true);
      }
      if (t - burnAt > 0.08 && L < 1700 * s) { burnAt = t; w.fx('heatHit', end.x, end.y, { burn: 1 }); }
      this.heat = 1;
      this.holdPosition();
      t += this.dt;
      yield;
    }
    this.firing = false;
    this.face = null;
    yield* this.wait(0.25);
  }

  // close in and hit it hard enough to send it flying
  * superPunch(e) {
    const w = this.w, s = this.s;
    if (!w.enemies.includes(e)) return;
    const c0 = w.enemyCenter(e);
    const side = this.x < c0.x ? -1 : 1;
    const spot = () => { const c = w.enemyCenter(e); return { x: c.x + side * 42 * s, y: Math.min(w.groundAt(c.x, c.y), c.y + 60 * s) }; };
    // a moving / falling target can slip away during the approach: close in again once
    for (let i = 0; i < 2; i++) {
      yield* this.flyTo(spot(), { speed: 720, near: 20, timeout: 2.5, until: () => e.hp <= 0 || !w.enemies.includes(e) || dist(spot(), this) < 24 * s });
      if (e.hp <= 0 || !w.enemies.includes(e)) return;
      if (dist(w.enemyCenter(e), this.chest()) < 100 * s) break;
    }
    const c = w.enemyCenter(e);
    this.faceTo(c);
    this.setPose('punch');
    this.face = 'angry';
    yield* this.wait(0.14);
    if (e.hp > 0 && w.enemies.includes(e) && dist(w.enemyCenter(e), this.chest()) < 110 * s) {
      w.damage(e, 6.5 * this.dmgMul(), this.chest());
      if (e.hp > 0) w.launchEnemy(e, this.facing * 780 * s, -430 * s, { dmg: 2 });
      w.fx('impact', c.x, c.y, {});
      w.fx('flash', c.x, c.y, { size: 1.2, color: '255,230,180' });
      w.sound('punchBig', e);
      w.count('punches');
    }
    yield* this.wait(0.25);
    this.face = null;
  }

  // fly straight through a line of enemies
  * ram(target) {
    const w = this.w, s = this.s;
    if (!w.enemies.includes(target)) return;
    if (this.mode !== 'air') yield* this.takeOff(90);
    if (!w.enemies.includes(target)) return;
    const c = w.enemyCenter(target);
    const start = this.chest();
    const d0 = Math.hypot(c.x - start.x, c.y - start.y) || 1;
    const dir = { x: (c.x - start.x) / d0, y: (c.y - start.y) / d0 };
    const disp = w.geo.displayAt(c) || w.geo.nearestDisplay(c);
    const endC = { x: c.x + dir.x * 280 * s, y: c.y + dir.y * 280 * s };
    const end = {
      x: clamp(endC.x, disp.work.x + 60 * s, disp.work.x + disp.work.width - 60 * s),
      y: clamp(endC.y + 62 * s, disp.work.y + 140 * s, w.groundAt(endC.x, endC.y) - 4 * s),
    };
    this.say(this.line('ram'));
    this.face = 'angry';
    w.sound('whoosh', this);
    const hit = {};
    let t = 0;
    while (t < 1.6 && this.steer(end.x, end.y, 1150 * s, 6000 * s) > 30 * s) {
      this.setPose('fly');
      const ch = this.chest();
      for (const e of [...w.enemies]) {
        if (hit[e.id] || e.grabbed) continue;
        if (dist(w.enemyCenter(e), ch) < (30 + (isBoss(e) ? Math.max(40, ENEMY[e.kind].r - 20) : 14)) * s) {
          hit[e.id] = 1;
          w.damage(e, 6 * this.dmgMul(), ch);
          if (e.hp > 0) w.launchEnemy(e, dir.x * 620 * s, Math.min(-200, dir.y * 400) * s, { dmg: 1 });
          w.fx('impact', ch.x, ch.y, {});
          w.sound('punchBig', e);
        }
      }
      t += this.dt;
      yield;
    }
    this.cd.ram = 5;
    w.count('rams');
    this.face = null;
    yield* this.hoverFor(0.25);
  }

  // sonic clap: a cone of air that knocks things back and leaves them dazed
  * clap(tp) {
    const w = this.w, s = this.s;
    this.aim = null;
    this.faceTo(tp);
    this.setPose('clap');
    yield* this.wait(0.32);
    const ch = this.chest();
    let ang = Math.atan2(tp.y - ch.y, tp.x - ch.x);
    if (Math.cos(ang) * this.facing < 0.2) ang = Math.atan2(Math.sin(ang), this.facing * 0.5);
    for (const e of [...w.enemies]) {
      if (e.grabbed) continue;
      const c = w.enemyCenter(e);
      const d = dist(c, ch);
      let da = Math.atan2(c.y - ch.y, c.x - ch.x) - ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      if (d < 320 * s && (Math.abs(da) < 0.85 || d < 70 * s)) {
        w.damage(e, 3 * this.dmgMul(), ch);
        if (e.hp <= 0) continue;
        w.stunEnemy(e, 2.2, 'daze');
        const k = 1 - d / (330 * s);
        w.launchEnemy(e, Math.cos(ang) * 520 * k * s, (e.air ? Math.sin(ang) * 320 : -260) * k * s);
      }
    }
    w.fx('clap', ch.x + this.facing * 10 * s, ch.y, { ang });
    w.sound('clap', this);
    this.cd.clap = 5;
    w.count('claps');
    yield* this.wait(0.3);
  }

  // lift a ground unit over his head and hurl it into the others
  * grabThrow(e) {
    const w = this.w, s = this.s;
    const ok = () => e.hp > 0 && w.enemies.includes(e) && !e.launch && !e.air && (!e.grabbed || e.grabbed === this.id);
    if (!ok()) return;
    const side = this.x < e.x ? -1 : 1;
    const spot = () => ({ x: e.x + side * 26 * s, y: w.groundAt(e.x, e.y) - 6 * s });
    yield* this.flyTo(spot(), { speed: 640, near: 16, timeout: 3, until: () => !ok() });
    if (!ok()) return;
    this.faceTo(e);
    this.setPose('lift');
    this.holding = e.id;
    this.say(this.line('grab'));
    w.sound('hit', e);
    const hold = () => { const hp = this.hands(); w.holdEnemy(e, this, hp.x, hp.y + 2 * s); };
    // up into the air with it
    if (this.mode !== 'air') { this.mode = 'air'; this.vy = -200 * s; }
    let t = 0;
    const top = (w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary).work.y;
    const up = { x: this.x, y: Math.max(this.y - 170 * s, top + 260 * s) };
    while (t < 0.7 && w.enemies.includes(e)) { this.steer(up.x, up.y, 300 * s); this.setPose('lift'); hold(); t += this.dt; yield; }
    if (!w.enemies.includes(e)) { this.holding = null; return; }
    // aim at the biggest crowd
    const others = w.enemies.filter((q) => q !== e && !q.grabbed);
    let best = null, bn = -1;
    for (const q of others) {
      const c = w.enemyCenter(q);
      const n = others.filter((r) => dist(w.enemyCenter(r), c) < 140 * s).length;
      if (n > bn) { bn = n; best = c; }
    }
    const target = best || { x: this.x + this.facing * 400 * s, y: w.groundAt(this.x + this.facing * 400 * s, this.y) };
    this.faceTo(target);
    this.setPose('throw');
    t = 0;
    while (t < 0.22 && w.enemies.includes(e)) { this.holdPosition(); hold(); t += this.dt; yield; }
    this.holding = null;
    if (!w.enemies.includes(e)) return;
    const g = 1500 * s;
    const dx = target.x - e.x, dy = target.y - e.y;
    const ft = clamp(Math.abs(dx) / (950 * s), 0.3, 0.9);
    w.launchEnemy(e, dx / ft, dy / ft - 0.5 * g * ft, { thrown: { dmg: 10 * this.dmgMul(), r: 95 }, spin: this.facing * 9 });
    w.sound('whoosh', this);
    this.cd.grab = w.army ? 5 : 8;
    w.count('throws');
    yield* this.wait(0.35);
  }

  // ------------------------------------------------------------ brain
  choose() {
    const w = this.w;
    if (this.mode === 'down') return [this.taskReboot(), 'reboot', 99];
    if (w.nuke && !w.nuke.passed) return [this.taskEvacuate(), 'evacuate', 98];
    if (w.quiet) return [this.taskQuiet(), 'quiet', 95];
    if (w.announcement) return [this.taskAnnounce(), 'announce', 96];
    if (w.enemies.length && (w.settings.autoDefend !== false || w.lockId)) return [this.taskCombat(), 'combat', 80];
    if (this.mode === 'air') {
      const r = Math.random();
      if (r < 0.45) return [this.land(), 'land', 30];
      if (r < 0.7) return [this.taskHover(rand(3, 6)), 'hover', 20];
      return [this.taskPatrol(), 'patrol', 20];
    }
    const opts = [];
    const add = (wt, fn, name) => { if (wt > 0) opts.push([wt, fn, name]); };
    add(2.4, () => this.taskIdle(rand(3, 7), 'stand'), 'idle');
    add(2, () => this.taskIdle(rand(3, 7), 'cross'), 'cross');
    add(1, () => this.taskIdle(rand(2.5, 5), 'idleLook'), 'look');
    add(0.6, () => this.taskIdle(rand(2, 3), 'hair'), 'hair');
    add(1.6, () => this.taskStroll(), 'stroll');
    add(1.2, () => this.taskPatrol(), 'patrol');
    add(0.6, () => this.taskFlyBy(), 'flyby');
    add(1, () => this.taskHop(), 'hover');
    add(0.8, () => this.taskWave(), 'wave');
    add(0.6, () => this.taskCamera(), 'camera');
    add(this.mad ? 1.6 : 0.4, () => this.taskStare(), 'stare');
    add(w.geo.displays.length > 1 ? 0.6 : 0, () => this.taskVisit(), 'visit');
    let r = Math.random() * opts.reduce((a, o) => a + o[0], 0);
    for (const [wt, fn, name] of opts) { r -= wt; if (r <= 0) return [fn(), name, 10]; }
    return [this.taskIdle(3), 'idle', 10];
  }

  * taskIdle(dur, pose) {
    if (this.mode === 'air') yield* this.land();
    this.setPose(pose || 'stand');
    if (pose === 'hair' && chance(0.5)) this.say(this.line('hair'));
    yield* this.wait(dur);
    this.setPose('stand');
  }

  * taskHover(dur) {
    if (this.mode !== 'air') yield* this.takeOff(rand(100, 180));
    yield* this.hoverFor(dur);
  }

  * taskHop() {
    yield* this.takeOff(rand(90, 170));
    if (chance(0.4)) this.say(this.line('hover'));
    yield* this.hoverFor(rand(2, 4));
    yield* this.land();
  }

  * taskScan() { yield* this.taskHop(); }

  * taskWave() {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    this.faceTo({ x: this.x + (chance(0.5) ? 1 : -1) * 100, y: this.y });
    this.setPose('wave');
    this.face = 'grin';
    this.say(this.line('fans'));
    w.fx('fans', this.x, this.y - 100 * this.s, {});
    this.approval = clamp(this.approval + 2, 0, 100);
    yield* this.wait(2.2);
    this.face = null;
    this.setPose('stand');
  }

  * taskCamera() {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    this.faceTo(w.cursor);
    this.setPose('camera');
    this.face = 'grin';
    this.say(this.line('camera'));
    yield* this.wait(0.6);
    w.fx('camera', this.x, this.y - 70 * this.s, {});
    w.sound('cameraClick', this);
    this.approval = clamp(this.approval + 2, 0, 100);
    yield* this.wait(1.8);
    this.face = null;
    this.setPose('stand');
  }

  // stares at your cursor a little too long
  * taskStare() {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    this.setPose('stare');
    this.face = 'stare';
    let t = 0;
    while (t < 3.2) {
      this.faceTo(w.cursor);
      this.aim = { x: w.cursor.x, y: w.cursor.y };
      if (t > 2.4) this.heat = Math.max(this.heat, 0.35);
      t += this.dt;
      yield;
    }
    if (chance(0.6)) this.say(this.line('stare'));
    this.aim = null;
    this.face = null;
    this.setPose('stand');
    yield* this.wait(0.6);
  }

  * taskArrive() {
    const w = this.w, s = this.s;
    const d = w.geo.primary;
    this.x = d.work.x + d.work.width * rand(0.35, 0.65);
    this.y = d.work.y + 140 * s;
    this.mode = 'air';
    this.vx = 0; this.vy = 120 * s;
    this.setPose('hover');
    w.sound('voughtSting', this);
    // floats down, arms crossed, cape billowing
    const g = w.groundAt(this.x, this.y);
    let t = 0;
    while (this.y < g - 40 * s && t < 6) { this.steer(this.x, g - 30 * s, 150 * s, 500 * s); this.setPose('hover'); t += this.dt; yield; }
    yield* this.land(this.x);
    this.face = 'grin';
    this.say(this.line('arrive'));
    this.setPose('wave');
    yield* this.wait(1.6);
    this.face = null;
    this.setPose('stand');
  }

  * taskAnnounce() {
    const w = this.w, s = this.s;
    const a = w.announcement;
    if (!a) return;
    const d = w.geo.primary;
    const spot = { x: d.work.x + d.work.width / 2, y: d.work.y + d.work.height * 0.62 };
    this.say(this.line('announce'));
    w.sound('voughtSting', this);
    yield* this.flyTo(spot, { speed: 560, near: 8, timeout: 12 });
    a.arrived = true;
    this.facing = 1;
    w.dirty();
    while (w.announcement === a) {
      this.steer(spot.x, spot.y, 80 * s);
      const early = w.now - a.start < 2600;
      this.setPose(early ? 'present' : 'hover');
      this.face = early ? 'grin' : null;
      yield;
    }
    this.face = null;
    this.say(this.line('announceDone'));
    yield* this.hoverFor(0.8);
    yield* this.land();
  }

  * taskQuiet() {
    const w = this.w, s = this.s;
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    const tx = d.work.x + d.work.width - 60 * s;
    if (this.mode === 'air' || Math.abs(tx - this.x) > 280 * s) {
      yield* this.flyTo({ x: tx, y: w.groundAt(tx, this.y) - 110 * s }, { speed: 460, near: 20, timeout: 8 });
      yield* this.land(tx);
    } else yield* this.walkTo(tx, { until: () => !w.quiet });
    this.facing = -1;
    this.setPose('powerDown');
    this.face = 'calm';
    this.say(this.line('quiet'));
    while (w.quiet) { this.face = 'calm'; yield; }
    this.face = null;
    this.setPose('stand');
    this.say(this.line('unquiet'));
    yield* this.wait(0.8);
  }

  // knocked out (it happens… rarely): dazed on the floor, then up and furious
  * taskReboot() {
    const w = this.w, s = this.s;
    this.aim = null; this.heat = 0; this.firing = false; this.holding = null;
    this.say(this.line('ko'), 'warn');
    w.sound('thud', this);
    if (this.mode === 'air' || this.y < this.ground() - 2) {
      this.mode = 'fall';
      while (this.mode === 'fall') yield;
    }
    this.mode = 'down';
    this.setPose('down');
    this.face = 'dazed';
    this.approval = clamp(this.approval - 12, 0, 100);
    let t = 0;
    while (t < 3.5) {
      this.face = 'dazed';
      if (chance(0.05)) w.fx('dazed', this.x, this.y - 20 * s, {});
      t += this.dt;
      yield;
    }
    this.setHealth(Math.max(this.armor, 55));
    this.mode = 'ground';
    this.setPose('crouch');
    this.face = 'angry';
    yield* this.wait(0.5);
    this.setPose('stand');
    this.heat = 0.7;
    this.say(this.line('koUp'), 'warn');
    w.sound('heatCharge', this);
    yield* this.wait(0.8);
    this.face = null;
  }

  * taskRecover() {
    this.setPose('down');
    this.face = 'dazed';
    yield* this.wait(0.7);
    this.setPose('crouch');
    this.face = 'angry';
    yield* this.wait(0.4);
    this.setPose('stand');
    this.face = null;
    this.say(this.line('recover'));
    yield* this.wait(0.6);
  }

  // a nuke? He doesn't run. He crosses his arms and watches it come.
  * taskEvacuate() {
    const w = this.w, s = this.s;
    const n = w.nuke;
    if (!n) return;
    this.aim = null; this.heat = 0; this.firing = false;
    this.say(this.line('evacuate'), 'warn');
    this.faceTo(n);
    while (w.nuke && !w.nuke.detonated) {
      if (this.mode === 'air') { this.steer(this.x, this.y, 60 * s); this.setPose('hover'); } else this.setPose('cross');
      this.faceTo(n);
      yield;
    }
    this.say(this.line('brace'), 'warn');
    while (w.nuke && !w.nuke.passed) {
      if (this.mode === 'air') this.steer(this.x, this.y, 60 * s);
      this.setPose('brace');
      yield;
    }
  }

  // dropped: he simply stays up there, annoyed
  release() {
    if (this.mode !== 'held') return;
    const w = this.w, s = this.s;
    this.vx = clamp(w.cursorVel.x * 0.5, -900 * s, 900 * s);
    this.vy = clamp(w.cursorVel.y * 0.5, -900 * s, 900 * s);
    this.swing = 0;
    this.mode = 'air';
    w.sound('whoosh', this);
    this.run(this.taskStabilize(), 'stabilize', 60);
  }

  * taskStabilize() {
    const s = this.s;
    const hx = this.x + this.vx * 0.2, hy = Math.min(this.y + this.vy * 0.2, this.ground() - 30 * s);
    let t = 0;
    while (t < 0.7) { this.steer(hx, hy, 300 * s, 1800 * s); t += this.dt; yield; }
    this.face = 'angry';
    this.say(this.line('dropped'));
    this.approval = clamp(this.approval - 3, 0, 100);
    yield* this.hoverFor(1);
    this.face = null;
  }

  * taskGreet(byUser) {
    const w = this.w;
    this.faceTo(w.cursor);
    const recent = this.clicks.filter((t) => Date.now() - t < 3000).length;
    if (byUser && recent >= 4) {
      this.setPose(this.mode === 'air' ? 'hover' : 'stare');
      this.face = 'angry';
      this.heat = 0.6;
      this.approval = clamp(this.approval - 4, 0, 100);
      this.say(this.line('poke'), 'warn');
      w.sound('heatCharge', this);
    } else {
      if (this.mode !== 'air') this.setPose(chance(0.5) ? 'wave' : 'camera');
      this.face = 'grin';
      if (byUser) { this.say(this.line('greet')); this.approval = clamp(this.approval + 1, 0, 100); }
      w.sound('cameraClick', this);
    }
    if (this.mode === 'air') yield* this.hoverFor(1.4); else yield* this.wait(1.4);
    this.face = null;
    if (this.mode !== 'air') this.setPose('stand');
  }

  * taskPressConference() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    this.faceTo({ x: this.x + 100, y: this.y });
    this.setPose('present');
    this.face = 'grin';
    this.say(this.line('pr'));
    w.sound('crowdCheer', this);
    for (let i = 0; i < 4; i++) { w.fx('camera', this.x + rand(-60, 60) * s, this.y - rand(40, 110) * s, {}); w.sound('cameraClick', this); yield* this.wait(0.5); }
    this.setPose('wave');
    w.fx('fans', this.x, this.y - 100 * s, {});
    this.approval = clamp(this.approval + 25, 0, 100);
    yield* this.wait(1.6);
    this.face = null;
    this.setPose('stand');
  }

  // ------------------------------------------------------------ combat
  * taskCombat() {
    const w = this.w, s = this.s;
    this.say(w.enemies.some(isBoss) ? this.line('heavyThreat') : this.line('threat'), 'warn');
    w.sound('voughtSting', this);
    let engaged = 0;
    while (w.enemies.length) {
      if (w.announcement) return;
      const target = w.pickTarget(this);
      if (!target) { yield; continue; }
      this.targetId = target.id;
      const tc = w.enemyCenter(target);
      engaged++;
      const near = w.enemies.filter((e) => !e.grabbed && dist(w.enemyCenter(e), this.chest()) < 240 * s).length;
      const ground = w.enemies.filter((e) => !e.air && !e.launch && !e.grabbed);
      const army = !!w.army;
      // close-range moves first
      if (this.cd.clap <= 0 && near >= 3) { yield* this.clap(tc); continue; }
      if (this.cd.grab <= 0 && (target.kind === 'tank' || target.kind === 'walker') && ground.length >= 3 && !target.launch && !target.grabbed) { yield* this.grabThrow(target); continue; }
      // get into position: above and to the side, eyes on the target
      const dx = this.x - tc.x;
      const side = Math.abs(dx) < 40 * s ? (chance(0.5) ? 1 : -1) : Math.sign(dx);
      const range = (ENEMY[target.kind].giant ? 480 : isBoss(target) ? 360 : army ? 300 : 250) * s;
      if (this.mode !== 'air') yield* this.takeOff(rand(110, 190));
      if (!w.enemies.includes(target)) continue;
      {
        const d = w.geo.displayAt(tc) || w.geo.nearestDisplay(tc);
        const want = {
          x: clamp(tc.x + side * range, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s),
          y: clamp((target.air ? tc.y : tc.y - 110 * s) - rand(10, 80) * s + 62 * s, d.work.y + 150 * s, w.groundAt(tc.x, tc.y) - 30 * s),
        };
        let t = 0;
        const moveFor = rand(0.3, 0.7);
        while (t < moveFor && w.enemies.includes(target)) { this.steer(want.x, want.y, 420 * s); t += this.dt; yield; }
      }
      if (!w.enemies.includes(target)) continue;
      const t2 = w.enemyCenter(target);
      const dd = dist(t2, this.chest());
      const inLine = w.enemiesInCone(this, t2, 0.25).length;
      if (this.cd.sweep <= 0 && this.power >= 20 && (isBoss(target) || inLine >= 3 || w.enemies.length >= 5 || army) && engaged > 1) {
        yield* this.heatSweep(t2);
      } else if (this.cd.ram <= 0 && inLine >= 2 && chance(0.55)) {
        yield* this.ram(target);
      } else if (dd < 110 * s || this.power < 6 || ((target.kind === 'tank' || target.kind === 'walker') && chance(0.3))) {
        yield* this.superPunch(target);
      } else {
        yield* this.heatZap(t2, target, Math.floor(rand(2, 4)));
      }
    }
    // victory
    this.face = 'grin';
    this.approval = clamp(this.approval + 6, 0, 100);
    this.say(this.line('victory'));
    w.sound('crowdCheer', this);
    if (this.mode === 'air') yield* this.land();
    this.face = 'grin';
    this.setPose('camera');
    yield* this.wait(1.6);
    this.face = null;
    this.setPose('stand');
  }

  * taskAttackAt(kind, p) {
    const w = this.w, s = this.s;
    const near = w.enemies.filter((e) => !e.grabbed && dist(w.enemyCenter(e), p) < 140 * s);
    const closest = near.sort((a, b) => dist(w.enemyCenter(a), p) - dist(w.enemyCenter(b), p))[0] || null;
    if (kind === 'sweep') {
      if (this.mode !== 'air') yield* this.takeOff(120);
      yield* this.heatSweep(p);
    } else if (kind === 'punch') {
      if (closest) yield* this.superPunch(closest);
      else {
        yield* this.flyTo({ x: p.x - this.facing * 40 * s, y: Math.min(w.groundAt(p.x, p.y), p.y + 60 * s) }, { speed: 640, near: 16, timeout: 3 });
        this.faceTo(p); this.setPose('punch'); w.sound('punchBig', this); w.fx('impact', p.x, p.y, {});
        yield* this.wait(0.35);
      }
    } else if (kind === 'ram') {
      if (closest) yield* this.ram(closest);
      else { if (this.mode !== 'air') yield* this.takeOff(100); yield* this.flyTo({ x: p.x, y: p.y + 62 * s }, { speed: 1000, near: 20, timeout: 3 }); }
    } else if (kind === 'clap') {
      if (dist(p, this.chest()) > 260 * s) yield* this.flyTo({ x: p.x + (this.x < p.x ? -1 : 1) * 160 * s, y: Math.min(w.groundAt(p.x, p.y), p.y + 62 * s) }, { speed: 560, near: 20, timeout: 4 });
      yield* this.clap(p);
    } else if (kind === 'throw') {
      const g = closest && !closest.air ? closest : w.enemies.filter((e) => !e.air && !e.grabbed).sort((a, b) => dist(a, p) - dist(b, p))[0];
      if (g) yield* this.grabThrow(g);
      else this.say(this.line('nothingToThrow'));
    } else {
      yield* this.heatZap(p, closest, 2);
    }
    yield* this.wait(0.4);
  }

  // ------------------------------------------------------------ UI
  statusText() {
    const w = this.w;
    if (w.quiet) return 'off duty';
    if (this.mode === 'thrown') return 'caught in the blast';
    if (w.nuke && !w.nuke.passed) return 'unimpressed by the nuke';
    if (w.army) return 'fighting an army — alone';
    if (this.mode === 'down') return 'dazed';
    if (this.mode === 'held') return 'being carried (furious)';
    if (w.enemies.length) return this.mad ? 'furious' : 'saving the day';
    if (this.armor < 30) return 'bleeding?!';
    if (this.power < 20) return 'eyes need a rest';
    if (this.mad) return 'brooding';
    if (this.mode === 'air') return 'flying';
    if (this.approval > 85) return 'basking in adoration';
    return 'smiling for the fans';
  }

  meters() {
    return [
      { k: 'power', label: 'Heat vision', short: 'HEAT', icon: '👀', v: this.power, color: '#ff4a3d' },
      { k: 'armor', label: 'Health', short: 'HP', icon: '❤️', v: this.armor, color: '#e8c75a' },
      { k: 'approval', label: 'Approval', short: 'APR', icon: '⭐', v: this.approval, color: '#6f9bff' },
    ];
  }

  onCommand(name, at, a, free) {
    const w = this.w, s = this.s;
    switch (name) {
      case 'attack':
        if (free) this.interrupt(this.taskAttackAt(a.kind || 'heat', at), 'attack', 85);
        break;
      case 'takeoff': if (free && this.mode !== 'air') this.interrupt(this.taskHover(rand(3, 5)), 'hover', 50); break;
      case 'land': if (free && this.mode === 'air') this.interrupt(this.land(), 'land', 50); break;
      case 'flyTo':
      case 'call':
        if (free) this.interrupt((function* () { yield* this.flyTo(at, { speed: 520, near: 10 }); yield* this.hoverFor(1.2); yield* this.land(); }).call(this), 'flyTo', 50);
        break;
      case 'patrol': if (free) this.interrupt(this.taskPatrol(), 'patrol', 50); break;
      case 'flyby': if (free) this.interrupt(this.taskFlyBy(), 'flyby', 50); break;
      case 'wave': if (free) this.interrupt(this.taskWave(), 'wave', 50); break;
      case 'pose': if (free) this.interrupt(this.taskCamera(), 'camera', 50); break;
      case 'stare': if (free) this.interrupt(this.taskStare(), 'stare', 50); break;
      case 'pr': if (free) this.interrupt(this.taskPressConference(), 'pr', 55); break;
      case 'thumbsUp': if (free) this.interrupt(this.taskGreet(false), 'greet', 50); break;
      case 'repair':
        this.setHealth(100);
        this.say(this.line('healed')); w.fx('repair', this.x, this.y - 50 * s, {}); w.sound('crowdCheer', this);
        break;
      case 'recharge':
        this.power = 100; this.heat = 0.8;
        this.say(this.line('recharged')); w.fx('flash', this.x + this.facing * 5 * s, this.y - 87 * s, { size: 1.2, color: '255,60,40' }); w.sound('heatCharge', this);
        break;
      default: return false;
    }
    return true;
  }

  menuItems() {
    const h = this, w = this.w;
    const air = h.mode === 'air';
    const look = w.settings[HomelanderHero.LOOK_KEY] || 'classic';
    return [
      {
        icon: '💥', label: 'Attack here',
        sub: [
          { icon: '👀', label: 'Heat vision', cmd: 'attack', args: { kind: 'heat' }, hint: 'quick zaps' },
          { icon: '🔥', label: 'Heat-vision sweep', cmd: 'attack', args: { kind: 'sweep' }, disabled: h.power < 20, hint: 'cuts a whole line' },
          { icon: '👊', label: 'Super punch', cmd: 'attack', args: { kind: 'punch' }, hint: 'sends it flying' },
          { icon: '✈️', label: 'Flying ram', cmd: 'attack', args: { kind: 'ram' } },
          { icon: '👏', label: 'Sonic clap', cmd: 'attack', args: { kind: 'clap' }, hint: 'stuns everything near' },
          { icon: '🏋️', label: 'Grab & throw', cmd: 'attack', args: { kind: 'throw' }, hint: 'a tank makes a fine missile' },
        ],
      },
      {
        icon: '🦅', label: 'Flight',
        sub: [
          air ? { icon: '🛬', label: 'Land', cmd: 'land' } : { icon: '🦅', label: 'Take off & hover', cmd: 'takeoff' },
          { icon: '📍', label: 'Fly here', cmd: 'flyTo' },
          { icon: '🔄', label: 'Patrol the skies', cmd: 'patrol' },
          { icon: '💨', label: 'Fly-by', cmd: 'flyby' },
        ],
      },
      {
        icon: '⭐', label: 'Public image', badge: h.approval < 35 || h.armor < 30 ? '!' : null,
        sub: [
          { icon: '👋', label: 'Wave to the fans', cmd: 'wave' },
          { icon: '📸', label: 'Pose for the camera', cmd: 'pose' },
          { icon: '🎤', label: `Press conference (${Math.round(h.approval)}% approval)`, cmd: 'pr', hint: 'approval way up' },
          { icon: '👁️', label: 'Stare', cmd: 'stare', hint: 'unsettling' },
          '-',
          { icon: '❤️', label: `Shake it off (${Math.round(h.armor)}% health)`, cmd: 'repair' },
          { icon: '👀', label: `Rest the eyes (${Math.round(h.power)}% heat)`, cmd: 'recharge' },
          '-',
          ...LOOKS.map(([k, l]) => ({ icon: '🎨', label: l, cmd: 'setting', args: { key: HomelanderHero.LOOK_KEY, value: k }, checked: look === k })),
        ],
      },
    ];
  }

  trayItems() {
    return [['Patrol the skies', 'patrol'], ['Press conference', 'pr'], ['Heal & recharge', 'repair+recharge']];
  }

  snapExtra() {
    return { heat: this.heat, approval: this.approval, face: this.face, holding: this.holding };
  }

  serialize() {
    return { power: this.power, armor: this.armor, approval: this.approval, x: this.x, y: this.y };
  }
}

HomelanderHero.ID = 'homelander';
HomelanderHero.NAME = 'Homelander';
HomelanderHero.BODY = 1.05;
HomelanderHero.SIZE_KEY = 'homelanderSize';
HomelanderHero.LOOK_KEY = 'homelanderLook';
HomelanderHero.DEFAULTS = { homelanderSize: 'small', homelanderLook: 'classic' };
HomelanderHero.ALLIES = null; // he doesn't need anybody
HomelanderHero.WELCOME = 'Right-click Homelander for his menu — deploy enemies, launch an army or set a reminder. He\'s always watching.';
HomelanderHero.HOME = 'Vought Tower';

HomelanderHero.LINES = {
  threat: ['Oh, look. Visitors.', 'Somebody\'s about to have a very bad day.', 'Stand back. This is what I do.', 'Cameras on? Good.'],
  heavyThreat: 'A big one. Make sure they get my good side.',
  victory: ['You\'re welcome, America.', 'And that\'s why they love me.', 'Was there ever any doubt?', 'Clean. Like it never happened.', 'Another win. Write that down.'],
  bossDown: 'Not so big now, are you?',
  bossBeam: 'Is that supposed to hurt?',
  locked: (label) => `The ${label.toLowerCase()}? You're mine.`,
  invasion: 'We have uninvited guests.',
  army: (total) => (total >= 1000 ? 'A thousand of them? Adorable.' : `${total} of them. One of me. Unfair — for them.`),
  armyBoss: 'Send the big ones. I don\'t care.',
  milestone: (m, done) => (m === 1 ? `${done} down. Not even breathing hard.` : m === 2 ? 'Halfway. Smile for the cameras!' : `${done}! Look at them run!`),
  callAllies: 'I don\'t need a team.',
  allyReplace: 'I don\'t need a team.',
  allyDown: () => 'Nobody else matters.',
  formUp: 'I work alone.',
  armyWon: 'An entire army. Me. Alone. Remember that.',
  nukeStill: 'They\'re still coming? Fine. More for me.',
  nukeClear: 'Not a scratch. Well… almost.',
  thrown: ['Huh—!', 'That\'s… new.', 'WHOA—', 'Okay, that one—'],
  recover: ['That was nothing.', 'Did anyone film that? Delete it.', 'I meant to do that.', 'Still the strongest one here.'],
  evacuate: 'A nuke? Let it come.',
  evacuateAlly: 'Stay put.',
  brace: 'I\'m not going anywhere.',
  armorLow: 'Am I… bleeding?',
  greet: ['Hey there, fan.', 'You\'re the real hero. Really.', 'Smile! You\'re with Homelander.', 'Need an autograph?', 'I\'m always watching. Always.', 'Great to see you. Truly.'],
  poke: ['Careful.', 'Don\'t. Touch. The suit.', 'I\'m being patient. For now.', 'You don\'t want to see me angry.', 'Do that again. I dare you.'],
  held: ['Put. Me. Down.', 'Do you know who I am?', 'This is not a good idea.', 'I can fly, genius.'],
  dropped: ['Don\'t ever do that again.', 'We\'re going to talk about that.', 'I\'ll let it slide. Once.'],
  heatLow: 'Eyes need a second.',
  sweep: ['Heat vision.', 'Hold still.', 'Let me light this up.'],
  ram: ['Coming through.', 'Out of my way.'],
  grab: ['Up you go.', 'Catch!', 'I\'ll just borrow this.'],
  nothingToThrow: 'Nothing worth throwing.',
  hair: ['Perfect. As usual.', 'Can\'t look bad on camera.'],
  hover: ['Better view from up here.', 'Everyone\'s looking up. As they should.'],
  fans: ['Love you too!', 'Thank you! Thank you!', 'For you, America!', 'You\'re the real heroes!'],
  camera: ['Get my good side.', 'Smile for the camera.', 'Make sure that one trends.'],
  stare: ['…', 'I see you.', 'Just looking. Don\'t mind me.'],
  arrive: 'Hello, America.',
  announce: 'A message for you. From me.',
  announceDone: 'Good. I knew I could count on you.',
  quiet: 'Fine. I\'ll be quiet. For you.',
  unquiet: 'Miss me?',
  ko: 'Ngh—!',
  koUp: 'Who. Did. That.',
  pr: ['Thank you. Thank you all.', 'America, I\'m here for you.', 'No questions. Just applause.'],
  healed: 'Good as new. Always.',
  recharged: 'Eyes on. Literally.',
};

HomelanderHero.REMINDER = {
  header: 'A MESSAGE FROM HOMELANDER',
  quips: [
    'America is counting on you. So am I.',
    'You don\'t want to disappoint me.',
    'Do it now. I\'ll be watching.',
    'The real heroes finish their to-do lists.',
    'I believe in you. Don\'t make me stop.',
    'Chop chop. And smile while you do it.',
  ],
  speech: (when, text, quip) => `Hey. It's ${when}. ${text}. ${quip}`,
  notify: (text) => `🦅 ${text}`,
};

HomelanderHero.UI = {
  title: 'America\'s #1 superhero',
  quick: [['🦅', 'Patrol', 'patrol'], ['💨', 'Fly-by', 'flyby'], ['👋', 'Wave', 'wave'], ['📸', 'Pose', 'pose'], ['🎤', 'Press conf.', 'pr'], ['🔥', 'Heat sweep', 'attack', { kind: 'sweep' }], ['❤️', 'Heal', 'repair'], ['👀', 'Rest eyes', 'recharge']],
  stats: [['kills', 'threats down'], ['drones', 'Ultron drones'], ['walkers', 'Ultron soldiers'], ['tanks', 'Ultron heavies'], ['bosses', 'villains beaten'], ['thanos', 'Thanos'], ['doom', 'Doctor Doom'], ['kang', 'Kang'], ['galactus', 'Galactus'], ['armiesWon', 'armies beaten (alone)'], ['nukes', 'nukes shrugged off'], ['waves', 'waves cleared'], ['heatZaps', 'heat-vision zaps'], ['sweeps', 'heat sweeps'], ['punches', 'super punches'], ['throws', 'things thrown'], ['rams', 'flying rams'], ['claps', 'sonic claps'], ['reboots', 'knockdowns']],
  looks: {
    key: 'homelanderLook',
    options: [
      ['classic', 'Classic (flag cape)', 'linear-gradient(135deg,#1c2b63 50%,#b22234 50%)'],
      ['midnight', 'Midnight ops', 'linear-gradient(135deg,#1b1d24 50%,#5a5f6b 50%)'],
      ['gala', 'White gala suit', 'linear-gradient(135deg,#f2f0ea 50%,#d4af37 50%)'],
    ],
  },
  armyNote: (n, size) => (size === 'legendary' ? 'No team, no backup: Homelander takes on all 1000 by himself. Expect a lot of heat vision.'
    : size === 'epic' ? 'Two hundred of them, one of him. He likes those odds.'
      : 'Homelander fights alone — heat vision, punches and whatever he can throw.'),
  help: [
    ['🖱️ The menu', 'Right-click anywhere (or on Homelander) for his menu. The tray icon and <b class="sc"></b> work too.'],
    ['🎯 Enemies', '<i>Deploy enemy</i> drops Ultron\'s robots (sentry, soldier, heavy, swarm) or a supervillain — Thanos, Doctor Doom, Kang, or the giant Galactus — where you right-clicked. He engages automatically; click an enemy to make it his priority.'],
    ['👀 Heat vision', 'Quick red zaps from his eyes, or a long <i>heat-vision sweep</i> that cuts through every enemy in front of him — that\'s how he handles an army on his own.'],
    ['👊 Strength', 'A <i>super punch</i> sends things flying, the <i>flying ram</i> plows through a line of them, a <i>sonic clap</i> knocks back and stuns everything close, and he can <i>grab</i> a tank and throw it into the others.'],
    ['⭐ Approval', 'His public approval rating rises when he wins, waves or poses, and drops when he gets hurt — or when you keep poking him. Below 35% he gets faster and meaner. A <i>press conference</i> fixes everything.'],
    ['🦅 Flight', 'He flies wherever he likes, hovers with his arms crossed and lands either softly or with a lot of drama. Drag him and let go — he just stays in the air, annoyed.'],
    ['☢ Nuke', 'He doesn\'t run. He crosses his arms and lets the shockwave hit him. It still knocks him around a little.'],
  ],
};

module.exports = HomelanderHero;
