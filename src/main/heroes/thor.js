'use strict';
/*
 * Desktop Buddies — Thor (fan-made, for personal use; the character belongs to
 * his creators). The God of Thunder, in four looks:
 *
 *   classic       Avengers armor, long hair, Mjolnir
 *   ragnarok      short hair, gladiator plates, no hammer — the lightning comes from his hands
 *   stormbreaker  Infinity War: short hair, full beard, the axe Stormbreaker
 *   thunder       Love & Thunder: blue-and-gold armor, long hair, Stormbreaker
 *
 * He flies by whirling his weapon (or on the lightning itself), throws it — it
 * smashes through a line of enemies and flies back into his hand — calls bolts
 * down from the sky that chain from one enemy to the next, crackles lightning
 * from the weapon, slams down from the sky in a thunderclap that stuns
 * everything around, and smashes things away up close. Each hit (and each hit
 * he takes) builds the storm; a full storm unleashes the God of Thunder: he
 * rises, lit up, and strikes every enemy on the screen at once.
 *
 * Meters: power = thunder (lightning), armor = health (he only feels part of
 * every hit), storm = the charge for the God of Thunder.
 * He arrives (and travels between screens) by Bifrost.
 */
const { Hero, ENEMY, util } = require('../ironman');
const { rand, chance, clamp, dist, num, segDist, isBoss } = util;

const TOUGH = 0.42; // share of incoming damage that actually lands
const LOOKS = [
  ['classic', 'Classic — Mjolnir', 'the Avengers armor and the hammer'],
  ['ragnarok', 'Ragnarok — Lord of Thunder', 'no hammer: lightning from his hands'],
  ['stormbreaker', 'Infinity War — Stormbreaker', 'the axe forged to kill a god'],
  ['thunder', 'Love & Thunder', 'blue and gold, long hair, Stormbreaker'],
];
const LOOK_ICONS = { classic: '🔨', ragnarok: '⚡', stormbreaker: '🪓', thunder: '💙' };

class ThorHero extends Hero {
  constructor(w, d, o) {
    super(w, d, o);
    d = d || {};
    this.callsign = 'THOR';
    this.storm = clamp(num(d.storm, 20), 0, 100);
    this.glow = 0;          // lightning in his eyes and on the weapon 0..1
    this.face = null;       // expression override for the renderer
    this.thrown = null;     // the weapon in flight: { x, y, ang, back }
    this.whirl = 0;         // the weapon spinning at his side (taking off, flying)
    this.holding = null;
    this.cd = { bolt: 0, throw: 0, slam: 0, smash: 0, arc: 0, god: 0, dodge: 0, blast: 0, missiles: 0, unibeam: 0 };
    this.lastKills = w.counters ? w.counters.kills : 0;
  }

  // health: he only feels part of every hit, and every hit feeds the storm
  get armor() { return this._armor; }
  set armor(v) {
    if (this._armor != null && v < this._armor && v < 100 && !this.rawArmor) {
      const lost = (this._armor - v) * TOUGH;
      v = this._armor - lost;
      if (this.storm != null) this.storm = clamp(this.storm + lost * 0.6, 0, 100);
    }
    this._armor = v;
  }
  setHealth(v) { this.rawArmor = true; this.armor = v; this.rawArmor = false; }

  // which weapon this look carries: 'hammer' | 'axe' | 'none'
  get look() { return this.w.settings[ThorHero.LOOK_KEY] || 'classic'; }
  get weapon() { const l = this.look; return l === 'ragnarok' ? 'none' : l === 'stormbreaker' || l === 'thunder' ? 'axe' : 'hammer'; }
  get armed() { return this.weapon !== 'none' && !this.thrown; }
  weaponName() { return this.weapon === 'axe' ? 'Stormbreaker' : this.weapon === 'hammer' ? 'Mjolnir' : 'lightning'; }

  // the end of the weapon (or the open hand), in world coordinates
  hand() { return { x: this.x + this.facing * 24 * this.s, y: this.y - 72 * this.s }; }
  eyePoint() { return { x: this.x + this.facing * 5 * this.s, y: this.y - 87 * this.s }; }
  feed(n) { this.storm = clamp(this.storm + n, 0, 100); }

  run(gen, name, prio) {
    // an interrupted throw leaves the weapon in the air: tickMeters flies it home
    if (!this.inTask) { this.face = null; this.whirl = 0; this.holding = null; this.throwing = false; this.charging = false; }
    super.run(gen, name, prio);
  }

  startHold() {
    if (this.mode === 'down') return;
    this.whirl = 0;
    super.startHold();
    this.face = 'angry';
  }

  throwBy(vx, vy, dmg) {
    this.whirl = 0;
    super.throwBy(vx, vy, dmg);
    if (this.mode === 'thrown') this.face = 'dazed';
  }

  // ------------------------------------------------------------ meters
  tickMeters(dt) {
    const w = this.w;
    this.power += (w.army ? 8 : w.enemies.length ? 4 : 7) * dt;
    if (this.mode !== 'down') this.setHealth(this.armor + (w.army ? 1.1 : w.enemies.length ? 0.7 : 3) * dt);
    const k = w.counters.kills;
    if (k > this.lastKills) this.feed(Math.min(8, (k - this.lastKills) * 2.5));
    this.lastKills = k;
    if (!w.enemies.length) this.storm = Math.max(10, this.storm - 0.4 * dt);
    if (this.glow > 0 && !this.charging) this.glow = Math.max(0, this.glow - dt * 1.8);
    // a weapon left behind (an interrupted throw) finds its own way home
    if (this.thrown && !this.throwing) this.flyHome(dt);
    this.power = clamp(this.power, 0, 100);
    this.setHealth(clamp(this.armor, 0, 100));
  }

  flyHome(dt) {
    const t = this.thrown, hp = this.hand(), s = this.s;
    const dx = hp.x - t.x, dy = hp.y - t.y, d = Math.hypot(dx, dy);
    if (d < 24 * s) { this.thrown = null; this.w.sound('catch', this); return; }
    const sp = Math.min(d / dt, 1500 * s);
    t.x += dx / d * sp * dt; t.y += dy / d * sp * dt;
    t.ang += 22 * dt;
    t.back = true;
  }

  // ------------------------------------------------------------ movement
  * walkTo(tx, o = {}) {
    const s = this.s;
    tx = this.w.clampFloorX(tx, this.x, this.y);
    let t = 0;
    while (Math.abs(tx - this.x) > 2) {
      const dir = Math.sign(tx - this.x);
      this.facing = dir;
      const step = Math.min(Math.abs(tx - this.x), 50 * s * this.dt);
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

  // whirls the weapon, then launches (Ragnarok: a crack of lightning and he's up)
  * takeOff(height) {
    if (this.mode === 'air') return;
    const s = this.s, w = this.w;
    if (this.armed) {
      this.setPose('whirl');
      this.whirl = 1;
      w.sound('whirl', this);
      yield* this.wait(0.5);
    } else {
      this.setPose('crouch');
      this.glow = 0.8;
      w.fx('lightningHit', this.x, this.y - 20 * s, { small: 1 });
      w.sound('zap', this);
      yield* this.wait(0.2);
    }
    this.whirl = 0;
    this.mode = 'air';
    this.vy = -340 * s;
    w.fx('shockwave', this.x, this.y, { size: 0.5 });
    const target = { x: this.x, y: this.y - (height || rand(140, 240)) * s };
    let t = 0;
    while (t < 1.2 && this.steer(target.x, target.y, 400 * s) > 6) { t += this.dt; yield; }
  }

  * land(x) {
    const s = this.s, w = this.w;
    if (this.mode === 'ground') return;
    const tx = x == null ? this.x : x;
    const g = w.groundAt(tx, this.y);
    if (g - this.y > 160 * s && chance(0.5)) {
      // comes down like a thunderbolt: weapon first, a crack of lightning on impact
      yield* this.flyTo({ x: tx, y: g - 80 * s }, { speed: 480, near: 14 });
      let t = 0;
      while (this.y < w.groundAt(this.x, this.y) - 1 && t < 1) {
        this.vy = Math.min(1100 * s, this.vy + 3000 * s * this.dt);
        this.vx *= 0.9;
        this.x += this.vx * this.dt; this.y += this.vy * this.dt;
        this.setPose('dive');
        t += this.dt;
        yield;
      }
      this.y = w.groundAt(this.x, this.y);
      this.vx = this.vy = 0;
      this.mode = 'ground';
      this.setPose('land');
      w.sound('thunderLand', this);
      w.fx('shockwave', this.x, this.y, { size: 1.2 });
      w.fx('lightningHit', this.x, this.y - 4 * s, {});
      yield* this.wait(0.85);
      this.setPose('stand');
      yield* this.wait(0.2);
    } else {
      yield* this.flyTo({ x: tx, y: g - 30 * s }, { speed: 260, near: 8 });
      let t = 0;
      while (this.y < w.groundAt(this.x, this.y) - 1 && t < 2) {
        this.steer(this.x, w.groundAt(this.x, this.y), 80 * s, 600 * s);
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

  // the Bifrost: a column of light from the sky, and he's there (or gone)
  bifrost(x, y) {
    const w = this.w, s = this.s;
    const d = w.geo.displayAt({ x, y: y - 40 * s }) || w.geo.nearestDisplay({ x, y });
    const b = w.addBeam('bifrost', { x, y: d.work.y }, { x, y }, 1.3, 40, this.id);
    b.from = 'sky';
    w.sound('bifrost', { x, y });
    w.fx('bifrost', x, y, {});
    w.count('bifrosts');
  }

  // ------------------------------------------------------------ weapons
  aimAt(tp) {
    this.aim = { x: tp.x, y: tp.y };
    this.aimArm = 'near';
    this.faceTo(tp);
  }

  // lightning crackling from the weapon (or his hand) at one enemy
  * arc(tp, enemy, shots) {
    const w = this.w, s = this.s;
    for (let i = 0; i < (shots || 1); i++) {
      if (enemy && (enemy.hp <= 0 || !w.enemies.includes(enemy))) break;
      const t0 = enemy ? w.enemyCenter(enemy) : tp;
      this.aimAt(t0);
      this.setPose(this.mode === 'air' ? 'arcAir' : 'arc');
      this.charging = true;
      let t = 0;
      while (t < 0.18) { this.glow = Math.max(this.glow, t / 0.18); this.holdPosition(); t += this.dt; yield; }
      this.charging = false;
      if (this.power < 3) { this.say(this.line('powerLow'), 'warn'); break; }
      this.power -= 3;
      const from = this.hand();
      const alive = enemy && w.enemies.includes(enemy);
      const target = alive ? w.enemyCenter(enemy) : tp;
      const victim = alive && chance(0.94) ? enemy : w.firstEnemyOnLine(from, target, 1.2);
      let to = target;
      if (victim) {
        to = w.enemyCenter(victim);
        w.damage(victim, 3 * this.dmgMul(), from);
        if (victim.hp > 0 && chance(0.25)) w.stunEnemy(victim, 0.6, 'shock');
        w.fx('lightningHit', to.x, to.y, { small: 1 });
        this.feed(1.2);
        // and forks to the next one along
        const fork = w.enemies.find((q) => q !== victim && dist(w.enemyCenter(q), to) < 150 * s);
        if (fork) { const fc = w.enemyCenter(fork); w.damage(fork, 2 * this.dmgMul(), to, true); w.addBeam('chain', to, fc, 0.2, 2.4, this.id).from = 'free'; }
      } else if (enemy) {
        const ang = Math.atan2(target.y - from.y, target.x - from.x) + rand(-0.1, 0.1);
        to = { x: from.x + Math.cos(ang) * 800 * s, y: from.y + Math.sin(ang) * 800 * s };
      } else w.fx('lightningHit', to.x, to.y, { small: 1 });
      const b = w.addBeam('arc', from, to, 0.22, 3, this.id);
      b.from = 'hand';
      w.counters.shotsFired++;
      w.count('arcs');
      w.sound('zap', this);
      t = 0;
      while (t < 0.18) { this.glow = 1; this.holdPosition(); t += this.dt; yield; }
    }
    this.aim = null;
    this.charging = false;
  }

  dmgMul() { return this.storm > 80 ? 1.25 : 1; }

  // raises the weapon and calls a bolt down from the sky; it jumps to the enemies nearby
  * callLightning(tp, enemy) {
    const w = this.w, s = this.s;
    this.aim = null;
    this.faceTo(tp);
    this.setPose(this.mode === 'air' ? 'raiseAir' : 'raise');
    this.face = 'roar';
    this.charging = true;
    w.sound('thunderRoll', this);
    let t = 0;
    while (t < 0.45) { this.glow = t / 0.45; this.holdPosition(); t += this.dt; yield; }
    this.charging = false;
    if (this.power < 12) { this.say(this.line('powerLow'), 'warn'); this.face = null; return; }
    this.power -= 12;
    this.cd.bolt = w.army ? 1.3 : 3.5;
    const alive = enemy && w.enemies.includes(enemy);
    const at = alive ? w.enemyCenter(enemy) : tp;
    const d = w.geo.displayAt(at) || w.geo.nearestDisplay(at);
    const sky = { x: at.x + rand(-60, 60) * s, y: d.work.y };
    const b = w.addBeam('bolt', sky, at, 0.42, 7, this.id);
    b.from = 'sky';
    w.fx('lightningHit', at.x, at.y, {});
    w.fx('thunder', at.x, at.y, {});
    w.sound('thunder', { x: at.x, y: at.y });
    w.count('bolts');
    const hit = new Set();
    const strike = (e, dmg) => {
      hit.add(e.id);
      w.damage(e, dmg * this.dmgMul(), sky, true);
      if (e.hp > 0) w.stunEnemy(e, isBoss(e) ? 0.5 : 1.3, 'shock');
      this.feed(2);
    };
    // the bolt itself: whatever stands right where it lands
    for (const e of [...w.enemies]) if (dist(w.enemyCenter(e), at) < (isBoss(e) ? Math.max(70, ENEMY[e.kind].r) : 80) * s) strike(e, 9);
    // then it jumps from one enemy to the next (more often in a big crowd)
    let from = at;
    const jumps = w.army ? 7 : 4;
    for (let i = 0; i < jumps; i++) {
      const next = w.enemies.filter((e) => !hit.has(e.id) && dist(w.enemyCenter(e), from) < (w.army ? 320 : 260) * s)
        .sort((a, c) => dist(w.enemyCenter(a), from) - dist(w.enemyCenter(c), from))[0];
      if (!next) break;
      const to = w.enemyCenter(next);
      w.addBeam('chain', from, to, 0.32, 3.4, this.id).from = 'free';
      strike(next, w.army ? 6.5 : 4.5);
      w.fx('lightningHit', to.x, to.y, { small: 1 });
      from = to;
    }
    this.glow = 1;
    yield* this.wait(0.35);
    this.face = null;
  }

  // throws the weapon through a line of enemies; it comes back to his hand
  * hurl(e) {
    const w = this.w, s = this.s;
    if (!this.armed || !w.enemies.includes(e)) return;
    const c0 = w.enemyCenter(e);
    this.aimAt(c0);
    this.setPose('throwWind');
    this.face = 'angry';
    yield* this.wait(0.22);
    if (!w.enemies.includes(e)) { this.aim = null; this.face = null; return; }
    this.setPose('throw');
    this.say(this.line(this.weapon === 'axe' ? 'axeThrow' : 'hammerThrow'));
    const start = this.hand();
    this.thrown = { x: start.x, y: start.y, ang: 0, back: false };
    this.throwing = true;
    w.sound('whirl', this);
    w.count('throws');
    const hit = {};
    const sweep = (p) => {
      for (const q of [...w.enemies]) {
        if (hit[q.id] || q.grabbed) continue;
        if (dist(w.enemyCenter(q), p) < (26 + (isBoss(q) ? Math.max(40, ENEMY[q.kind].r - 20) : 14)) * s) {
          hit[q.id] = 1;
          w.damage(q, (this.weapon === 'axe' ? 7.5 : 6.5) * this.dmgMul(), p);
          if (q.hp > 0 && !isBoss(q)) w.launchEnemy(q, Math.sign(q.x - this.x || 1) * 420 * s, -300 * s, { dmg: 1 });
          w.fx('impact', p.x, p.y, {});
          w.sound('hammerHit', q);
          this.feed(2);
        }
      }
    };
    // out: straight at the target and a little past it
    const target = () => (w.enemies.includes(e) ? w.enemyCenter(e) : c0);
    const disp = w.geo.displayAt(c0) || w.geo.nearestDisplay(c0);
    let t = 0;
    const T = this.thrown;
    let goal = target();
    const dir0 = { x: goal.x - T.x, y: goal.y - T.y };
    const d0 = Math.hypot(dir0.x, dir0.y) || 1;
    const far = { x: goal.x + dir0.x / d0 * 160 * s, y: goal.y + dir0.y / d0 * 160 * s };
    far.x = clamp(far.x, disp.work.x + 30 * s, disp.work.x + disp.work.width - 30 * s);
    far.y = clamp(far.y, disp.work.y + 40 * s, w.groundAt(far.x, far.y) - 10 * s);
    while (t < 1.2) {
      const dx = far.x - T.x, dy = far.y - T.y, d = Math.hypot(dx, dy);
      if (d < 20 * s) break;
      const sp = Math.min(d / this.dt, 1300 * s);
      T.x += dx / d * sp * this.dt; T.y += dy / d * sp * this.dt;
      T.ang += 26 * this.dt;
      sweep(T);
      this.holdPosition();
      this.setPose('reach');
      t += this.dt;
      yield;
    }
    // back: he holds out his hand and it comes home (hitting anything on the way)
    T.back = true;
    for (const k in hit) delete hit[k];
    t = 0;
    while (t < 2.5) {
      const hp = this.hand();
      const dx = hp.x - T.x, dy = hp.y - T.y, d = Math.hypot(dx, dy);
      if (d < 24 * s) break;
      const sp = Math.min(d / this.dt, 1400 * s);
      T.x += dx / d * sp * this.dt; T.y += dy / d * sp * this.dt;
      T.ang += 26 * this.dt;
      sweep(T);
      this.faceTo(T);
      this.holdPosition();
      this.setPose('reach');
      t += this.dt;
      yield;
    }
    this.thrown = null;
    this.throwing = false;
    w.sound('catch', this);
    this.cd.throw = w.army ? 2.5 : 4;
    this.aim = null;
    this.setPose(this.mode === 'air' ? 'hover' : 'stand');
    if (chance(0.3)) this.say(this.line('catch'));
    this.face = null;
    yield* this.wait(0.2);
  }

  // Ragnarok's version of a throw: a long lightning blast from both hands
  * handBlast(tp) {
    const w = this.w, s = this.s;
    this.aim = null;
    this.faceTo(tp);
    this.setPose(this.mode === 'air' ? 'blastAir' : 'blast');
    this.face = 'roar';
    this.charging = true;
    w.sound('thunderRoll', this);
    let t = 0;
    while (t < 0.35) { this.glow = t / 0.35; this.holdPosition(); t += this.dt; yield; }
    this.charging = false;
    if (this.power < 10) { this.say(this.line('powerLow'), 'warn'); this.face = null; return; }
    this.power -= 10;
    this.cd.throw = w.army ? 2.5 : 4;
    w.count('throws');
    this.say(this.line('blast'));
    const dur = 0.8;
    const beam = w.addBeam('blast', this.hand(), tp, dur, 8, this.id);
    beam.from = 'hand';
    w.sound('zap', this);
    const ang0 = Math.atan2(tp.y - this.hand().y, tp.x - this.hand().x);
    t = 0;
    while (t < dur) {
      const f = this.hand();
      const end = { x: f.x + Math.cos(ang0) * 1500 * s, y: f.y + Math.sin(ang0) * 1500 * s };
      beam.x1 = f.x; beam.y1 = f.y; beam.x2 = end.x; beam.y2 = end.y;
      for (const e of [...w.enemies]) {
        const c = w.enemyCenter(e);
        if (segDist(c, f, end) < (16 + (isBoss(e) ? Math.max(40, ENEMY[e.kind].r - 20) : 12)) * s) {
          w.damage(e, 34 * this.dt * this.dmgMul(), f, true);
          if (e.hp > 0 && chance(0.05)) w.stunEnemy(e, 0.5, 'shock');
        }
      }
      this.glow = 1;
      this.feed(4 * this.dt);
      this.holdPosition();
      t += this.dt;
      yield;
    }
    this.face = null;
    yield* this.wait(0.2);
  }

  // up close: a swing that sends it flying
  * smash(e) {
    const w = this.w, s = this.s;
    if (!w.enemies.includes(e)) return;
    const c0 = w.enemyCenter(e);
    const side = this.x < c0.x ? -1 : 1;
    const spot = () => { const c = w.enemyCenter(e); return { x: c.x + side * 44 * s, y: Math.min(w.groundAt(c.x, c.y), c.y + 60 * s) }; };
    for (let i = 0; i < 2; i++) {
      yield* this.flyTo(spot(), { speed: 720, near: 20, timeout: 2.5, until: () => e.hp <= 0 || !w.enemies.includes(e) || dist(spot(), this) < 24 * s });
      if (e.hp <= 0 || !w.enemies.includes(e)) return;
      if (dist(w.enemyCenter(e), this.chest()) < 100 * s) break;
    }
    const c = w.enemyCenter(e);
    this.faceTo(c);
    this.setPose('smash');
    this.face = 'roar';
    yield* this.wait(0.16);
    if (e.hp > 0 && w.enemies.includes(e) && dist(w.enemyCenter(e), this.chest()) < 115 * s) {
      w.damage(e, (this.armed ? 7 : 5.5) * this.dmgMul(), this.chest());
      if (e.hp > 0) w.launchEnemy(e, this.facing * 760 * s, -460 * s, { dmg: 2 });
      w.fx('impact', c.x, c.y, {});
      w.fx('lightningHit', c.x, c.y, { small: 1 });
      w.sound(this.armed ? 'hammerHit' : 'punchBig', e);
      w.count('smashes');
      this.feed(3);
    }
    this.cd.smash = 1.2;
    yield* this.wait(0.28);
    this.face = null;
  }

  // up into the sky and straight down: a thunderclap that stuns everything around
  * slam(tp) {
    const w = this.w, s = this.s;
    const gx = clamp(tp.x, (w.geo.displayAt(tp) || w.geo.primary).work.x + 60 * s, (w.geo.displayAt(tp) || w.geo.primary).work.x + (w.geo.displayAt(tp) || w.geo.primary).work.width - 60 * s);
    const g = w.groundAt(gx, tp.y);
    this.say(this.line('slam'));
    yield* this.flyTo({ x: gx, y: Math.max(g - 300 * s, (w.geo.displayAt(tp) || w.geo.primary).work.y + 150 * s) }, { speed: 700, near: 30, timeout: 3 });
    this.setPose('raiseAir');
    this.face = 'roar';
    this.charging = true;
    let t = 0;
    while (t < 0.3) { this.glow = t / 0.3; this.holdPosition(); t += this.dt; yield; }
    this.charging = false;
    t = 0;
    while (this.y < w.groundAt(this.x, this.y) - 1 && t < 1.2) {
      this.vy = Math.min(1500 * s, this.vy + 4200 * s * this.dt);
      this.vx *= 0.85;
      this.x += this.vx * this.dt; this.y += this.vy * this.dt;
      this.setPose('dive');
      t += this.dt;
      yield;
    }
    this.y = w.groundAt(this.x, this.y);
    this.vx = this.vy = 0;
    this.mode = 'ground';
    this.setPose('slam');
    w.sound('thunderLand', this);
    w.sound('thunder', this);
    w.fx('shockwave', this.x, this.y, { size: 1.8 });
    w.fx('thunder', this.x, this.y - 10 * s, { ring: 1 });
    w.shakeFloor(0.5, 6);
    const c = { x: this.x, y: this.y - 20 * s };
    for (const e of [...w.enemies]) {
      if (e.grabbed) continue;
      const ec = w.enemyCenter(e);
      const d = dist(ec, c);
      if (d < 280 * s && (!e.air || d < 160 * s)) {
        w.damage(e, 6 * this.dmgMul() * (1 - d / (340 * s)), c);
        if (e.hp <= 0) continue;
        w.stunEnemy(e, isBoss(e) ? 0.8 : 2.2, 'shock');
        if (!isBoss(e)) w.launchEnemy(e, Math.sign(ec.x - c.x || 1) * 380 * (1 - d / (320 * s)) * s, -320 * s);
        w.addBeam('chain', c, ec, 0.3, 3, this.id).from = 'free';
        this.feed(2);
      }
    }
    this.cd.slam = w.army ? 3.5 : 7;
    w.count('slams');
    yield* this.wait(0.7);
    this.setPose('stand');
    this.face = null;
  }

  // the God of Thunder: a full storm, every enemy on this screen struck at once
  * godOfThunder() {
    const w = this.w, s = this.s;
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    this.storm = 0;
    this.cd.god = w.army ? 6 : 12;
    this.say(this.line('god'), 'warn');
    w.sound('thunderRoll', this);
    yield* this.flyTo({ x: clamp(this.x, d.work.x + 160 * s, d.work.x + d.work.width - 160 * s), y: d.work.y + d.work.height * 0.32 }, { speed: 520, near: 20, timeout: 3 });
    this.setPose('god');
    this.face = 'roar';
    this.charging = true;
    let t = 0;
    let crackAt = 0;
    while (t < 1.3) {
      this.glow = Math.min(1, t / 0.6);
      if (t - crackAt > 0.18) {
        crackAt = t;
        const b = w.addBeam('crackle', { x: this.x + rand(-140, 140) * s, y: d.work.y }, this.hand(), 0.2, 3, this.id);
        b.from = 'sky';
      }
      this.holdPosition();
      t += this.dt;
      yield;
    }
    w.flashScreen(0.5, '210,225,255');
    w.sound('thunder', this);
    w.count('godMode');
    const here = w.enemies.filter((e) => (w.geo.displayAt(w.enemyCenter(e)) || d) === d).slice(0, 32);
    for (const e of here) {
      if (!w.enemies.includes(e)) continue;
      const at = w.enemyCenter(e);
      const b = w.addBeam('bolt', { x: at.x + rand(-40, 40) * s, y: d.work.y }, at, 0.5, 8, this.id);
      b.from = 'sky';
      w.damage(e, (isBoss(e) ? 26 : 16) * this.dmgMul(), at, true);
      if (e.hp > 0) w.stunEnemy(e, isBoss(e) ? 1 : 2.5, 'shock');
      w.fx('lightningHit', at.x, at.y, {});
      t = 0;
      while (t < 0.05) { this.holdPosition(); t += this.dt; yield; }
    }
    this.charging = false;
    this.glow = 1;
    yield* this.hoverFor(0.6);
    this.face = null;
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
    add(1, () => this.taskIdle(rand(2.5, 5), 'idleLook'), 'look');
    add(this.weapon !== 'none' ? 1.2 : 0, () => this.taskTwirl(), 'twirl');
    add(this.weapon !== 'none' ? 0.7 : 0, () => this.taskToss(), 'toss');
    add(0.8, () => this.taskStorm(), 'storm');
    add(0.6, () => this.taskMead(), 'mead');
    add(1.4, () => this.taskStroll(), 'stroll');
    add(1.2, () => this.taskPatrol(), 'patrol');
    add(0.6, () => this.taskFlyBy(), 'flyby');
    add(0.9, () => this.taskHop(), 'hover');
    add(0.5, () => this.taskWave(), 'wave');
    add(w.geo.displays.length > 1 ? 0.6 : 0, () => this.taskVisit(), 'visit');
    let r = Math.random() * opts.reduce((a, o) => a + o[0], 0);
    for (const [wt, fn, name] of opts) { r -= wt; if (r <= 0) return [fn(), name, 10]; }
    return [this.taskIdle(3), 'idle', 10];
  }

  * taskIdle(dur, pose) {
    if (this.mode === 'air') yield* this.land();
    this.setPose(pose || 'stand');
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

  // spins the weapon by its strap / handle, bored
  * taskTwirl() {
    if (this.mode === 'air') yield* this.land();
    this.setPose('twirl');
    this.whirl = 0.6;
    if (chance(0.4)) this.say(this.line('twirl'));
    yield* this.wait(rand(2.5, 4));
    this.whirl = 0;
    this.setPose('stand');
  }

  // tosses it up and catches it without looking
  * taskToss() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    if (!this.armed) return;
    this.setPose('toss');
    yield* this.wait(0.25);
    const hp = this.hand();
    this.thrown = { x: hp.x, y: hp.y, ang: 0, back: false };
    this.throwing = true;
    let vy = -520 * s, t = 0;
    const x0 = hp.x;
    while (t < 2) {
      vy += 1100 * s * this.dt;
      this.thrown.y += vy * this.dt;
      this.thrown.x = x0;
      this.thrown.ang += 12 * this.dt;
      if (vy > 0 && this.thrown.y >= this.hand().y) break;
      this.setPose('tossWait');
      t += this.dt;
      yield;
    }
    this.thrown = null;
    this.throwing = false;
    w.sound('catch', this);
    this.setPose('toss');
    if (chance(0.5)) this.say(this.line('toss'));
    yield* this.wait(0.6);
    this.setPose('stand');
  }

  // raises the weapon and lets the sky charge it
  * taskStorm() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    this.setPose('raise');
    this.face = 'roar';
    this.charging = true;
    w.sound('thunderRoll', this);
    yield* this.wait(0.6);
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    for (let i = 0; i < 2; i++) {
      const b = w.addBeam('crackle', { x: this.x + rand(-80, 80) * s, y: d.work.y }, this.hand(), 0.3, 4, this.id);
      b.from = 'sky';
      w.sound('thunder', this);
      this.glow = 1;
      yield* this.wait(0.45);
    }
    this.charging = false;
    this.power = Math.min(100, this.power + 15);
    if (chance(0.5)) this.say(this.line('storm'));
    this.face = null;
    yield* this.wait(0.5);
    this.setPose('stand');
  }

  // a drink — and the cup goes on the floor. ANOTHER!
  * taskMead() {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    this.setPose('drink');
    yield* this.wait(1.4);
    this.setPose('smashCup');
    this.face = 'roar';
    this.say(this.line('mead'));
    yield* this.wait(0.25);
    w.fx('shatter', this.x + this.facing * 16 * this.s, this.y - 4 * this.s, {});
    w.sound('glass', this);
    w.count('mead');
    yield* this.wait(1);
    this.face = null;
    this.setPose('stand');
  }

  * taskWave() {
    if (this.mode === 'air') yield* this.land();
    this.faceTo({ x: this.x + (chance(0.5) ? 1 : -1) * 100, y: this.y });
    this.setPose('wave');
    this.face = 'grin';
    this.say(this.line('wave'));
    yield* this.wait(2);
    this.face = null;
    this.setPose('stand');
  }

  // to another screen: Bifrost out, Bifrost in
  * taskVisit() {
    const w = this.w, s = this.s;
    const here = w.geo.displayAt({ x: this.x, y: this.y - 40 * s });
    const others = w.geo.displays.filter((d) => d !== here);
    if (!others.length) return;
    if (this.mode === 'air') yield* this.land();
    const d = others[Math.floor(Math.random() * others.length)];
    this.setPose('raise');
    this.say(this.line('bifrost'));
    yield* this.wait(0.4);
    this.bifrost(this.x, this.y);
    yield* this.wait(0.45);
    this.x = d.work.x + rand(0.2, 0.8) * d.work.width;
    this.y = w.groundAt(this.x, d.work.y + d.work.height / 2);
    this.vx = this.vy = 0;
    this.bifrost(this.x, this.y);
    this.setPose('land');
    yield* this.wait(0.9);
    this.setPose('stand');
  }

  * taskArrive() {
    const w = this.w, s = this.s;
    const d = w.geo.primary;
    this.x = d.work.x + d.work.width * rand(0.35, 0.65);
    this.y = w.groundAt(this.x, d.work.y + d.work.height / 2);
    this.mode = 'ground';
    this.vx = this.vy = 0;
    this.bifrost(this.x, this.y);
    this.setPose('land');
    yield* this.wait(1.1);
    this.face = 'grin';
    this.setPose('raise');
    this.say(this.line('arrive'));
    this.glow = 0.8;
    yield* this.wait(1.4);
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
    w.sound('thunderRoll', this);
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
    this.setPose('rest');
    this.face = 'calm';
    this.say(this.line('quiet'));
    while (w.quiet) { this.face = 'calm'; yield; }
    this.face = null;
    this.setPose('stand');
    this.say(this.line('unquiet'));
    yield* this.wait(0.8);
  }

  * taskReboot() {
    const w = this.w, s = this.s;
    this.aim = null; this.glow = 0; this.whirl = 0; this.charging = false;
    this.say(this.line('ko'), 'warn');
    w.sound('thud', this);
    if (this.mode === 'air' || this.y < this.ground() - 2) {
      this.mode = 'fall';
      while (this.mode === 'fall') yield;
    }
    this.mode = 'down';
    this.setPose('down');
    this.face = 'dazed';
    let t = 0;
    while (t < 3.2) {
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
    // gets up with lightning in his eyes
    this.setPose('raise');
    this.glow = 1;
    this.feed(40);
    this.say(this.line('koUp'), 'warn');
    w.sound('thunder', this);
    yield* this.wait(0.8);
    this.face = null;
    this.setPose('stand');
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

  // a nuke: he plants his feet, raises the weapon and takes it
  * taskEvacuate() {
    const w = this.w, s = this.s;
    const n = w.nuke;
    if (!n) return;
    this.aim = null; this.whirl = 0;
    this.say(this.line('evacuate'), 'warn');
    this.faceTo(n);
    while (w.nuke && !w.nuke.detonated) {
      if (this.mode === 'air') { this.steer(this.x, this.y, 60 * s); this.setPose('hover'); } else this.setPose('raise');
      this.glow = 0.6;
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

  // dropped: he just stays up there
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
    this.face = 'grin';
    this.say(this.line('dropped'));
    yield* this.hoverFor(1);
    this.face = null;
  }

  * taskGreet(byUser) {
    const w = this.w;
    this.faceTo(w.cursor);
    const recent = this.clicks.filter((t) => Date.now() - t < 3000).length;
    if (byUser && recent >= 4) {
      this.setPose(this.mode === 'air' ? 'hover' : 'raise');
      this.face = 'angry';
      this.glow = 0.7;
      this.say(this.line('poke'), 'warn');
      w.sound('thunderRoll', this);
    } else {
      if (this.mode !== 'air') this.setPose(chance(0.5) ? 'wave' : 'point');
      this.face = 'grin';
      if (byUser) this.say(this.line('greet'));
    }
    if (this.mode === 'air') yield* this.hoverFor(1.4); else yield* this.wait(1.4);
    this.face = null;
    if (this.mode !== 'air') this.setPose('stand');
  }

  // ------------------------------------------------------------ combat
  * taskCombat() {
    const w = this.w, s = this.s;
    const boss = w.enemies.find(isBoss);
    this.say(boss && boss.kind === 'thanos' ? this.line('thanos') : boss ? this.line('heavyThreat') : this.line('threat'), 'warn');
    w.sound('thunderRoll', this);
    let engaged = 0;
    while (w.enemies.length) {
      if (w.announcement) return;
      const target = w.pickTarget(this);
      if (!target) { yield; continue; }
      this.targetId = target.id;
      const tc = w.enemyCenter(target);
      engaged++;
      const near = w.enemies.filter((e) => !e.grabbed && dist(w.enemyCenter(e), this.chest()) < 260 * s).length;
      const army = !!w.army;
      // a full storm: the God of Thunder
      if (this.storm >= 100 && this.cd.god <= 0 && (w.enemies.length >= 3 || isBoss(target))) { yield* this.godOfThunder(); continue; }
      const ground = w.enemies.filter((e) => !e.air && !e.launch && !e.grabbed);
      if (this.cd.slam <= 0 && ground.filter((e) => dist(w.enemyCenter(e), tc) < 220 * s).length >= 3) { yield* this.slam(tc); continue; }
      // get into position: up and to the side
      const dx = this.x - tc.x;
      const side = Math.abs(dx) < 40 * s ? (chance(0.5) ? 1 : -1) : Math.sign(dx);
      const range = (ENEMY[target.kind].giant ? 480 : isBoss(target) ? 340 : army ? 300 : 240) * s;
      if (this.mode !== 'air') yield* this.takeOff(rand(110, 190));
      if (!w.enemies.includes(target)) continue;
      {
        const d = w.geo.displayAt(tc) || w.geo.nearestDisplay(tc);
        const want = {
          x: clamp(tc.x + side * range, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s),
          y: clamp((target.air ? tc.y : tc.y - 110 * s) - rand(10, 80) * s + 62 * s, d.work.y + 150 * s, w.groundAt(tc.x, tc.y) - 30 * s),
        };
        let t = 0;
        const moveFor = rand(0.3, 0.6);
        while (t < moveFor && w.enemies.includes(target)) { this.steer(want.x, want.y, 440 * s); t += this.dt; yield; }
      }
      if (!w.enemies.includes(target)) continue;
      const t2 = w.enemyCenter(target);
      const dd = dist(t2, this.chest());
      const inLine = w.enemiesInCone(this, t2, 0.25).length;
      if (this.cd.bolt <= 0 && this.power >= 12 && (isBoss(target) || near >= 2 || w.enemies.length >= 3 || army) && engaged > 1) {
        yield* this.callLightning(t2, target);
      } else if (this.cd.throw <= 0 && (inLine >= 2 || isBoss(target) || chance(0.35))) {
        if (this.armed) yield* this.hurl(target);
        else if (this.weapon === 'none' && this.power >= 10) yield* this.handBlast(t2);
        else yield* this.arc(t2, target, 2);
      } else if (dd < 120 * s || this.power < 5 || (this.cd.smash <= 0 && chance(0.25))) {
        yield* this.smash(target);
      } else {
        yield* this.arc(t2, target, Math.floor(rand(2, 4)));
      }
    }
    // victory
    this.face = 'grin';
    this.say(this.line('victory'));
    w.sound('thunderRoll', this);
    if (this.mode === 'air') yield* this.land();
    this.face = 'grin';
    this.setPose('raise');
    this.glow = 0.8;
    yield* this.wait(1.6);
    this.face = null;
    this.setPose('stand');
  }

  * taskAttackAt(kind, p) {
    const w = this.w, s = this.s;
    const near = w.enemies.filter((e) => !e.grabbed && dist(w.enemyCenter(e), p) < 150 * s);
    const closest = near.sort((a, b) => dist(w.enemyCenter(a), p) - dist(w.enemyCenter(b), p))[0] || null;
    if (kind === 'bolt') {
      yield* this.callLightning(p, closest);
    } else if (kind === 'throw') {
      if (this.armed) {
        const t = closest || w.enemies.slice().sort((a, b) => dist(w.enemyCenter(a), p) - dist(w.enemyCenter(b), p))[0];
        if (t) yield* this.hurl(t);
        else yield* this.arc(p, null, 1);
      } else yield* this.handBlast(p);
    } else if (kind === 'smash') {
      if (closest) yield* this.smash(closest);
      else {
        yield* this.flyTo({ x: p.x - this.facing * 40 * s, y: Math.min(w.groundAt(p.x, p.y), p.y + 60 * s) }, { speed: 640, near: 16, timeout: 3 });
        this.faceTo(p); this.setPose('smash'); w.sound('hammerHit', this); w.fx('impact', p.x, p.y, {});
        yield* this.wait(0.35);
      }
    } else if (kind === 'slam') {
      yield* this.slam(p);
    } else if (kind === 'god') {
      if (this.storm < 100) this.say(this.line('notYet', Math.round(this.storm)));
      else yield* this.godOfThunder();
    } else {
      yield* this.arc(p, closest, 2);
    }
    yield* this.wait(0.4);
  }

  // ------------------------------------------------------------ UI
  statusText() {
    const w = this.w;
    if (w.quiet) return 'resting';
    if (this.mode === 'thrown') return 'caught in the blast';
    if (w.nuke && !w.nuke.passed) return 'standing his ground';
    if (w.army) return 'fighting an army';
    if (this.mode === 'down') return 'dazed';
    if (this.mode === 'held') return 'being carried (amused)';
    if (this.storm >= 100) return 'the storm is ready';
    if (w.enemies.length) return 'bringing the thunder';
    if (this.armor < 30) return 'wounded';
    if (this.power < 20) return 'out of thunder';
    if (this.mode === 'air') return 'flying';
    return 'worthy';
  }

  meters() {
    return [
      { k: 'power', label: 'Thunder', short: 'THN', icon: '⚡', v: this.power, color: '#7cc4ff' },
      { k: 'armor', label: 'Health', short: 'HP', icon: '❤️', v: this.armor, color: '#e0533d' },
      { k: 'storm', label: 'Storm', short: 'STM', icon: '🌩️', v: this.storm, color: '#c7b8ff' },
    ];
  }

  onCommand(name, at, a, free) {
    const w = this.w, s = this.s;
    switch (name) {
      case 'attack':
        if (free) this.interrupt(this.taskAttackAt(a.kind || 'arc', at), 'attack', 85);
        break;
      case 'takeoff': if (free && this.mode !== 'air') this.interrupt(this.taskHover(rand(3, 5)), 'hover', 50); break;
      case 'land': if (free && this.mode === 'air') this.interrupt(this.land(), 'land', 50); break;
      case 'flyTo':
      case 'call':
        if (free) this.interrupt((function* () { yield* this.flyTo(at, { speed: 520, near: 10 }); yield* this.hoverFor(1.2); yield* this.land(); }).call(this), 'flyTo', 50);
        break;
      case 'patrol': if (free) this.interrupt(this.taskPatrol(), 'patrol', 50); break;
      case 'flyby': if (free) this.interrupt(this.taskFlyBy(), 'flyby', 50); break;
      case 'bifrost':
        if (free) {
          if (w.geo.displays.length > 1) this.interrupt(this.taskVisit(), 'visit', 55);
          else this.interrupt((function* () {
            if (this.mode === 'air') yield* this.land();
            this.setPose('raise'); yield* this.wait(0.4);
            this.bifrost(this.x, this.y); yield* this.wait(0.45);
            const g = w.groundAt(at.x, at.y);
            this.x = at.x; this.y = g; this.vx = this.vy = 0;
            this.bifrost(this.x, this.y); this.setPose('land'); yield* this.wait(0.9); this.setPose('stand');
          }).call(this), 'bifrost', 55);
        }
        break;
      case 'twirl': if (free && this.weapon !== 'none') this.interrupt(this.taskTwirl(), 'twirl', 50); break;
      case 'toss': if (free && this.weapon !== 'none') this.interrupt(this.taskToss(), 'toss', 50); break;
      case 'storm': if (free) this.interrupt(this.taskStorm(), 'storm', 50); break;
      case 'mead': if (free) this.interrupt(this.taskMead(), 'mead', 50); break;
      case 'wave': if (free) this.interrupt(this.taskWave(), 'wave', 50); break;
      case 'thumbsUp': if (free) this.interrupt(this.taskGreet(false), 'greet', 50); break;
      case 'repair':
        this.setHealth(100);
        this.say(this.line('healed')); w.fx('repair', this.x, this.y - 50 * s, {}); w.sound('thunderRoll', this);
        break;
      case 'recharge':
        this.power = 100; this.glow = 1;
        this.say(this.line('recharged')); w.fx('lightningHit', this.x + this.facing * 20 * s, this.y - 90 * s, { small: 1 }); w.sound('thunder', this);
        break;
      case 'fillStorm':
        this.storm = 100;
        this.say(this.line('stormFull'));
        break;
      default: return false;
    }
    return true;
  }

  menuItems() {
    const h = this, w = this.w;
    const air = h.mode === 'air';
    const look = h.look;
    const armed = h.weapon !== 'none';
    return [
      {
        icon: '⚡', label: 'Attack here',
        sub: [
          { icon: '⚡', label: 'Lightning', cmd: 'attack', args: { kind: 'arc' }, hint: armed ? `from ${h.weaponName()}` : 'from his hands' },
          { icon: '🌩️', label: 'Call the lightning', cmd: 'attack', args: { kind: 'bolt' }, disabled: h.power < 12, hint: 'a bolt from the sky that jumps' },
          armed
            ? { icon: h.weapon === 'axe' ? '🪓' : '🔨', label: `Throw ${h.weaponName()}`, cmd: 'attack', args: { kind: 'throw' }, hint: 'it comes back' }
            : { icon: '🙌', label: 'Lightning blast', cmd: 'attack', args: { kind: 'throw' }, disabled: h.power < 10, hint: 'both hands' },
          { icon: '💥', label: 'Smash', cmd: 'attack', args: { kind: 'smash' }, hint: 'sends it flying' },
          { icon: '🌀', label: 'Thunder slam', cmd: 'attack', args: { kind: 'slam' }, hint: 'stuns everything around' },
          { icon: '👁️', label: `God of Thunder (${Math.round(h.storm)}% storm)`, cmd: 'attack', args: { kind: 'god' }, disabled: h.storm < 100, hint: 'every enemy, at once' },
        ],
      },
      {
        icon: '🌈', label: 'Flight & Bifrost',
        sub: [
          air ? { icon: '🛬', label: 'Land', cmd: 'land' } : { icon: '🌪️', label: 'Take off & hover', cmd: 'takeoff' },
          { icon: '📍', label: 'Fly here', cmd: 'flyTo' },
          { icon: '🌈', label: w.geo.displays.length > 1 ? 'Bifrost to another screen' : 'Bifrost here', cmd: 'bifrost' },
          { icon: '🔄', label: 'Patrol the skies', cmd: 'patrol' },
          { icon: '💨', label: 'Fly-by', cmd: 'flyby' },
        ],
      },
      {
        icon: '🍺', label: 'Thunder & mead', badge: h.armor < 30 ? '!' : h.storm >= 100 ? '⚡' : null,
        sub: [
          ...(armed ? [{ icon: '🔁', label: `Twirl ${h.weaponName()}`, cmd: 'twirl' }, { icon: '🤹', label: 'Toss & catch', cmd: 'toss' }] : []),
          { icon: '🌩️', label: 'Summon the storm', cmd: 'storm', hint: 'recharges thunder' },
          { icon: '🍺', label: 'Mead', cmd: 'mead', hint: 'ANOTHER!' },
          { icon: '👋', label: 'Wave', cmd: 'wave' },
          '-',
          { icon: '❤️', label: `Heal (${Math.round(h.armor)}% health)`, cmd: 'repair' },
          { icon: '⚡', label: `Recharge (${Math.round(h.power)}% thunder)`, cmd: 'recharge' },
          '-',
          ...LOOKS.map(([k, l, hint]) => ({ icon: LOOK_ICONS[k], label: l, cmd: 'setting', args: { key: ThorHero.LOOK_KEY, value: k }, checked: look === k, hint })),
        ],
      },
    ];
  }

  trayItems() {
    return [['Patrol the skies', 'patrol'], ['Summon the storm', 'storm'], ['Heal & recharge', 'repair+recharge']];
  }

  snapExtra() {
    return { glow: this.glow, storm: this.storm, face: this.face, thrown: this.thrown, whirl: this.whirl, weapon: this.weapon, look: this.look };
  }

  serialize() {
    return { power: this.power, armor: this.armor, storm: this.storm, x: this.x, y: this.y };
  }
}

ThorHero.ID = 'thor';
ThorHero.NAME = 'Thor';
ThorHero.BODY = 1.08;
ThorHero.SIZE_KEY = 'thorSize';
ThorHero.LOOK_KEY = 'thorLook';
ThorHero.DEFAULTS = { thorSize: 'small', thorLook: 'classic' };
ThorHero.ALLIES = null; // the Asgardians stay home
ThorHero.WELCOME = 'Right-click Thor for his menu — deploy enemies, launch an army or set a reminder. Pick a look under Thunder & mead.';
ThorHero.HOME = 'Asgard';

ThorHero.LINES = {
  threat: ['Have at you!', 'For Asgard!', 'You face the God of Thunder!', 'Finally — a fight!'],
  heavyThreat: 'Now that is a worthy foe.',
  thanos: 'BRING ME THANOS!',
  victory: ['Is that all?', 'Another victory for Asgard!', 'Ha! That was fun!', 'Who\'s next?', 'I\'m still worthy!'],
  bossDown: ['I went for the head.', 'Kneel before the God of Thunder.'],
  bossBeam: 'Is that the best you have?',
  locked: (label) => `The ${label.toLowerCase()}! You are mine!`,
  invasion: 'Uninvited guests. How rude.',
  army: (total) => (total >= 1000 ? 'A THOUSAND? Now it\'s a party!' : `${total} of them? I\'ve fought worse before breakfast.`),
  armyBoss: 'Send your champions!',
  milestone: (m, done) => (m === 1 ? `${done} down! Keep them coming!` : m === 2 ? 'Halfway! I\'m just warming up.' : `${done}! The storm is with me!`),
  callAllies: 'The Warriors Three are busy.',
  allyReplace: 'I fight alone today.',
  allyDown: () => 'For Asgard!',
  formUp: 'I need no army.',
  armyWon: 'An entire army! Tonight we feast!',
  nukeStill: 'Still more? Good.',
  nukeClear: 'That was… quite loud.',
  thrown: ['Whoa—!', 'By Odin\'s beard—', 'Oof!'],
  recover: ['That tickled.', 'I\'ve had worse falls from the Bifrost.', 'Still standing!'],
  evacuate: 'A fire from the sky? Let it come.',
  evacuateAlly: 'Hold!',
  brace: 'I am the God of Thunder!',
  armorLow: 'I… may need a moment.',
  greet: ['Greetings, friend!', 'Hello! Do you have any mead?', 'Point me at the enemy!', 'A fine day for thunder.', 'Ah, my favourite mortal!'],
  poke: ['Careful, mortal.', 'Do not test me.', 'I said careful!', 'You poke a god?'],
  held: ['Put me down!', 'I can fly, you know.', 'Is this a Midgardian custom?'],
  dropped: ['I have a hammer for that.', 'Ha! Again!', 'Thank you. I suppose.'],
  powerLow: 'The storm needs a moment.',
  hammerThrow: ['Mjolnir!', 'Catch!', 'Go!'],
  axeThrow: ['Stormbreaker!', 'Fly!', 'Go!'],
  catch: ['I knew it!', 'Good girl.', 'Back where you belong.'],
  blast: ['LIGHTNING!', 'Feel the storm!'],
  slam: ['From above!', 'Here I come!'],
  god: 'I AM THE GOD OF THUNDER!',
  notYet: (n) => `The storm is not ready (${n}%).`,
  stormFull: 'The storm is ready.',
  twirl: ['Hmm.', 'Bored.', 'Anyone? A fight?'],
  toss: ['Still worthy.', 'Ha!', 'Never doubted it.'],
  storm: ['Come, storm!', 'The sky answers.', 'Ahh. Better.'],
  mead: ['ANOTHER!', 'This drink — I like it! ANOTHER!'],
  wave: ['Hello!', 'Friends!', 'Greetings, Midgard!'],
  hover: ['A fine view.', 'Up here is where I belong.'],
  bifrost: ['Heimdall! Open the Bifrost!', 'Bifrost!'],
  arrive: 'I am Thor, son of Odin!',
  announce: 'A message — and it is important!',
  announceDone: 'Well done!',
  quiet: 'Fine. I will rest.',
  unquiet: 'I have returned!',
  ko: 'Argh—!',
  koUp: 'NOW I\'M ANGRY.',
  healed: 'Asgardians heal fast.',
  recharged: 'The thunder is mine!',
};

ThorHero.REMINDER = {
  header: 'A DECREE FROM ASGARD',
  quips: [
    'Even a god keeps his promises. So should you.',
    'Do it now — and then we feast!',
    'The Allfather would be proud.',
    'Go, and be worthy!',
    'Do not make me get the hammer.',
    'For Asgard! And also for your to-do list.',
  ],
  speech: (when, text, quip) => `Hear me! It is ${when}. ${text}. ${quip}`,
  notify: (text) => `⚡ ${text}`,
};

ThorHero.UI = {
  title: 'God of Thunder',
  quick: [['🌩️', 'Storm', 'storm'], ['🌈', 'Bifrost', 'bifrost'], ['🔄', 'Patrol', 'patrol'], ['💨', 'Fly-by', 'flyby'], ['🔁', 'Twirl', 'twirl'], ['🍺', 'Mead', 'mead'], ['❤️', 'Heal', 'repair'], ['⚡', 'Recharge', 'recharge']],
  stats: [['kills', 'enemies down'], ['drones', 'Ultron drones'], ['walkers', 'Ultron soldiers'], ['tanks', 'Ultron heavies'], ['bosses', 'villains beaten'], ['thanos', 'Thanos'], ['doom', 'Doctor Doom'], ['kang', 'Kang'], ['galactus', 'Galactus'], ['armiesWon', 'armies beaten'], ['nukes', 'nukes withstood'], ['waves', 'waves cleared'], ['arcs', 'lightning zaps'], ['bolts', 'bolts from the sky'], ['throws', 'weapon throws'], ['smashes', 'smashes'], ['slams', 'thunder slams'], ['godMode', 'God of Thunder'], ['bifrosts', 'Bifrost trips'], ['mead', 'cups of mead'], ['reboots', 'knockdowns']],
  looks: {
    key: 'thorLook',
    options: [
      ['classic', 'Classic — Mjolnir', 'linear-gradient(135deg,#3b4352 50%,#b5202b 50%)'],
      ['ragnarok', 'Ragnarok', 'linear-gradient(135deg,#8d97a6 45%,#5a7fd6 45% 60%,#b5202b 60%)'],
      ['stormbreaker', 'Stormbreaker', 'linear-gradient(135deg,#232a36 50%,#7a5a3a 50% 62%,#9fd4ff 62%)'],
      ['thunder', 'Love & Thunder', 'linear-gradient(135deg,#2c4f9e 45%,#e3b448 45% 62%,#b5202b 62%)'],
    ],
  },
  armyNote: (n, size) => (size === 'legendary' ? 'Thor takes on all 1000 alone — bolts from the sky, a flying weapon and, once the storm fills up, the God of Thunder.'
    : size === 'epic' ? 'Two hundred of them? The storm will fill up fast.'
      : 'Thor fights alone: lightning, a weapon that always comes back, and thunder slams.'),
  help: [
    ['🖱️ The menu', 'Right-click anywhere (or on Thor) for his menu. The tray icon and <b class="sc"></b> work too.'],
    ['🎯 Enemies', '<i>Deploy enemy</i> drops Ultron\'s robots or a supervillain — Thanos, Doctor Doom, Kang, or the giant Galactus. He engages automatically; click an enemy to make it his priority.'],
    ['⚡ Lightning', 'Lightning crackles from his weapon (or, in the Ragnarok look, his hands). <i>Call the lightning</i> brings a bolt down from the sky that jumps from one enemy to the next and stuns them.'],
    ['🔨 The weapon', 'He throws Mjolnir or Stormbreaker through a whole line of enemies — and it always flies back into his hand. Up close he smashes things away; a <i>thunder slam</i> from the sky stuns everything around.'],
    ['🌩️ Storm', 'Every hit he lands (and takes) fills the storm meter. When it\'s full, the <i>God of Thunder</i> strikes every enemy on the screen at once.'],
    ['🎨 Looks', 'Four versions under <i>Thunder &amp; mead</i> or in Settings: Classic with Mjolnir, Ragnarok (short hair, no hammer), Infinity War with Stormbreaker, and Love & Thunder in blue and gold.'],
    ['🌈 Bifrost', 'He arrives by Bifrost and uses it to jump to another screen (or wherever you right-clicked).'],
  ],
};

module.exports = ThorHero;
