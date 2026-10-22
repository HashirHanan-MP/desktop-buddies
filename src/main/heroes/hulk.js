'use strict';
/*
 * Desktop Buddies — the Hulk (an original fan-made drawing of Marvel's
 * character, for personal use).
 *
 * He can't fly. He stomps along the floor of your screens and gets anywhere
 * higher — or across to another screen — with giant ballistic leaps that end
 * in a floor-cracking landing. He punches robots across the screen, smashes
 * the floor, claps shockwaves that blow flyers out of the sky, rips up chunks
 * of floor to throw and hurls tanks into other tanks. Getting hurt only makes
 * him angrier (and angrier = stronger); at full rage he goes on a rampage.
 * Knocked out, he shrinks back into Bruce Banner for a moment.
 *
 * Meters: power = stamina, armor = health, rage = rage. He fights alone.
 */
const { Hero, ENEMY, util } = require('../ironman');
const { rand, chance, pick, clamp, dist, num, isBoss } = util;

const LEAP_G = 2600;   // gravity during leaps (× s)
const WALK = 46, RUN = 125;
const MAX_LEAP = 1500; // the farthest one leap goes (× s)

const SKINS = [
  ['green', 'Classic green', 'linear-gradient(135deg,#5fae2e 58%,#7036a3 58%)'],
  ['grey', 'Grey', 'linear-gradient(135deg,#8c939c 58%,#7036a3 58%)'],
  ['savage', 'Savage', 'linear-gradient(135deg,#3f7f1f 58%,#3a4654 58%)'],
];

const HULK_LINES = {
  threat: ['PUNY ROBOTS!', 'ROBOTS! HULK SMASH!', 'MORE ROBOTS TO SMASH!'],
  heavyThreat: 'BIG ROBOT! HULK SMASH BIG ROBOT!',
  victory: ['HULK WIN!', 'HULK STRONGEST THERE IS!', 'PUNY ROBOTS.', 'TOO EASY!', 'WHO NEXT?!'],
  bossDown: 'BIG ROBOT SMASHED!',
  bossBeam: 'SHINY BEAM! HULK NOT CARE!',
  locked: (label) => `HULK SMASH ${label}!`,
  invasion: 'ROBOTS COMING!',
  army: (total) => (total >= 1000 ? '1000 ROBOTS?! HULK SMASH ALL!' : `${total} ROBOTS! HULK SMASH!`),
  armyBoss: 'BIG ROBOT COMING!',
  milestone: (m, done) => (m === 1 ? `${done} SMASHED! MORE!` : m === 2 ? 'HALF SMASHED! HULK NOT TIRED!' : `${done}! ROBOTS RUN AWAY!`),
  callAllies: 'HULK FIGHT ALONE!',
  allyReplace: 'HULK NO NEED HELP!',
  allyDown: () => 'HULK STILL STANDING!',
  armyWon: 'ALL ROBOTS SMASHED! HULK WIN!',
  formUp: 'HULK NO NEED FRIENDS!',
  nukeStill: 'MORE ROBOTS! GOOD!',
  nukeClear: 'BIG BOOM. HULK STILL HERE.',
  thrown: ['RAAAGH!', 'HULK FLYING!', 'BIG BOOM!'],
  recover: ['HULK ANGRIER!', 'BOOM MAKE HULK MAD!', 'HULK NOT HURT. HULK MAD.'],
  evacuate: 'BIG BOMB! HULK JUMP AWAY!',
  evacuateAlly: 'JUMP!',
  brace: 'HULK HOLD ON!',
  armorLow: 'HULK... HURT...',
  allyArrive: () => 'HULK HERE!',
  allyLeave: ['HULK GO.'],
  greet: ['HULK SAY HI.', 'WHAT YOU WANT?', 'HULK BUSY.', 'HMPH.', 'HULK LIKE YOU. LITTLE.'],
  poke: ['STOP POKING HULK!', 'HULK WARN YOU!', 'GRRRR!', 'LEAVE HULK ALONE!'],
  held: ['HULK NOT TOY!', 'PUT HULK DOWN!', 'GRRR! LET GO!'],
};

// ======================================================================= the Hulk
class HulkHero extends Hero {
  constructor(w, d, o) {
    super(w, d, o);
    d = d || {};
    this.rage = clamp(num(d.rage, 10), 0, 100);
    this.form = 'hulk';     // 'banner' for a moment after a knockout
    this.carry = null;      // 'boulder' while holding a chunk of floor
    this.held = null;       // the enemy he's about to throw
    this.rampUntil = 0;
    this.raging = false;
    Object.assign(this.cd, { smash: 0, clap: 0, boulder: 0, grab: 0, leapAtk: 0, roar: 0 });
  }

  // Health: he's tough — damage is cut down (more so the angrier he is) and turns into rage.
  get armor() { return this._hp; }
  set armor(v) {
    if (this._hp == null || !Number.isFinite(v)) { this._hp = Number.isFinite(v) ? v : 100; return; }
    if (v < this._hp) {
      const loss = (this._hp - v) * (0.55 - 0.2 * (this.rage || 0) / 100);
      v = this._hp - loss;
      if (this.rage != null && this.mode !== 'down') this.rage = Math.min(100, this.rage + loss * 1.6);
    }
    this._hp = clamp(v, 0, 100);
  }
  setHealth(v) { this._hp = clamp(v, 0, 100); }

  rampage() { return this.w.clock < this.rampUntil; }
  mult() { return (1 + this.rage / 100) * (this.rampage() ? 1.3 : 1); }

  tickMeters(dt) {
    const w = this.w, fighting = w.enemies.length > 0;
    if (this.mode === 'down') return;
    // stamina: leaps and smashes cost it; it comes back fast on the floor
    this.power += (this.mode === 'ground' || this.mode === 'held' ? (this.pose === 'walk' || this.pose === 'run' ? 5 : 11) : 2) * dt;
    // health: the fastest healer there is
    this.armor = this.armor + (fighting ? 1.6 : 5) * dt;
    // rage builds while fighting and cools off slowly when it's quiet
    if (fighting) this.rage += (w.army && w.army.huge ? 3 : 1.4) * dt;
    else if (!this.rampage()) this.rage -= (w.quiet ? 6 : 1.6) * dt;
    if (this.rampage()) for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt); // cooldowns run twice as fast
    else if (this.raging) { this.raging = false; this.rage = Math.min(this.rage, 65); }
    if (this.rage >= 100 && !this.rampage() && fighting) this.startRampage();
    this.power = clamp(this.power, 0, 100);
    this.rage = clamp(this.rage, 0, 100);
  }

  startRampage() {
    this.rampUntil = this.w.clock + 9000;
    this.raging = true;
    this.say('HULK SMASH!!!', 'warn');
    this.w.sound('hulkRoar', this);
    this.w.fx('roar', this.x, this.y - 70 * this.s, { size: this.s });
  }

  // ------------------------------------------------------------ geometry
  // he's wider than the armored hero, and lying down / sitting / Banner change his shape
  box() {
    const s = this.s;
    if (this.mode === 'held') return { x: this.x - 26 * s, y: this.y - 100 * s, w: 52 * s, h: 100 * s };
    if (this.form === 'banner') return { x: this.x - 12 * s, y: this.y - 64 * s, w: 24 * s, h: 64 * s };
    if (this.pose === 'down') return { x: this.x - 55 * s, y: this.y - 26 * s, w: 110 * s, h: 28 * s };
    if (this.pose === 'sit' || this.pose === 'sleep') return { x: this.x - 28 * s, y: this.y - 64 * s, w: 56 * s, h: 64 * s };
    return { x: this.x - 25 * s, y: this.y - 96 * s, w: 50 * s, h: 98 * s };
  }

  topLimit(d) { return d.work.y + Math.min(150 * this.s, d.work.height * 0.4); }

  keepOnScreen() {
    const s = this.s, geo = this.w.geo;
    const d = geo.displayAt({ x: this.x, y: this.y - 50 * s }) || geo.nearestDisplay({ x: this.x, y: this.y });
    if (!d) return;
    const top = this.topLimit(d);
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    const c = geo.clampBounds({ x: this.x, y: this.y - 50 * s }, 28 * s);
    if (c.x !== this.x) { this.x = c.x; this.vx = 0; }
  }

  // ------------------------------------------------------------ movement: stomping and leaping
  * walkTo(tx, o = {}) {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    tx = w.clampFloorX(tx, this.x, this.y);
    const sp = (o.run ? RUN : WALK) * s;
    let t = 0;
    while (Math.abs(tx - this.x) > 2) {
      const dir = Math.sign(tx - this.x);
      this.facing = dir;
      const step = Math.min(Math.abs(tx - this.x), sp * this.dt);
      this.x += dir * step;
      this.dist += step;
      this.setPose(o.run ? 'run' : 'walk');
      // every footfall shakes the floor a little
      if (this.dist - this.lastStep > (o.run ? 22 : 15) * s) {
        this.lastStep = this.dist;
        w.sound('hulkStomp', this);
        w.fx('stomp', this.x - dir * 6 * s, this.y, { size: s });
      }
      t += this.dt;
      if (t > (o.timeout || 20) || (o.until && o.until())) break;
      yield;
    }
    this.setPose('stand');
  }

  // one step of flight under gravity; true when he touches the floor
  airStep() {
    const w = this.w, s = this.s, geo = w.geo, dt = this.dt;
    this.vy += LEAP_G * s * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const c = geo.clampBounds({ x: this.x, y: this.y - 60 * s }, 30 * s);
    if (c.x !== this.x || c.y !== this.y - 60 * s) {
      if (c.x !== this.x) this.vx = -this.vx * 0.3;
      this.x = c.x; this.y = c.y + 60 * s;
    }
    const d = geo.displayAt({ x: this.x, y: this.y - 60 * s }) || geo.nearestDisplay(this);
    const top = this.topLimit(d);
    if (this.y < top) { this.y = top; if (this.vy < 0) this.vy = 0; }
    const g = w.groundAt(this.x, this.y);
    if (this.y >= g && this.vy >= 0) { this.y = g; return true; }
    return false;
  }

  // keep flying until he lands (o.check runs every frame — e.g. to swat a drone on the way)
  * airborne(o = {}) {
    let t = 0;
    this.swatAt = -1;
    while (t < 5) {
      if (o.check && o.check(t)) this.swatAt = t;
      if (this.airStep()) break;
      if (this.swatAt < 0 || t - this.swatAt > 0.35) this.setPose(this.vy < 0 ? 'leap' : 'fall');
      t += this.dt;
      yield;
    }
    yield* this.landing(o);
  }

  // A giant leap: to the floor under p, or (o.air) so the top of the arc reaches p.
  * leapTo(p, o = {}) {
    const w = this.w, geo = w.geo, s = this.s;
    if (this.mode === 'air') yield* this.land();
    if (this.mode !== 'ground') return false;
    const d0 = geo.displayAt({ x: p.x, y: p.y }) || geo.displayAt({ x: p.x, y: this.y - 40 * s }) || geo.nearestDisplay(p);
    const tx = clamp(p.x, d0.work.x + 30 * s, d0.work.x + d0.work.width - 30 * s);
    const ty = o.air ? p.y : w.groundAt(tx, d0.work.y + d0.work.height - 5);
    this.faceTo({ x: tx, y: ty });
    this.setPose('crouch');
    yield* this.wait(o.quick ? 0.16 : 0.28);
    this.power = Math.max(0, this.power - (o.cost != null ? o.cost : 6));
    w.count('leaps');
    w.sound('hulkLeap', this);
    w.fx('stomp', this.x, this.y, { size: 1.6 * s });
    const g = LEAP_G * s, x0 = this.x, y0 = this.y, dx = tx - x0;
    // the arc: high enough to clear the way, never above the top of the screen
    const from = geo.displayAt({ x: x0, y: y0 - 40 * s }) || d0;
    const topY = Math.max(this.topLimit(d0), this.topLimit(from)) + 10;
    let apex = o.air ? Math.min(p.y - 25 * s, y0 - 60 * s) : Math.min(y0, ty) - clamp(Math.abs(dx) * 0.3 + 90 * s, 110 * s, 520 * s);
    apex = Math.max(apex, topY);
    const H = Math.max(20 * s, y0 - apex);
    const vy0 = -Math.sqrt(2 * g * H);
    const ta = -vy0 / g;
    const td = o.air ? 0 : Math.sqrt(2 * Math.max(1, ty - apex) / g);
    this.vx = clamp(dx / Math.max(0.25, ta + td), -1800 * s, 1800 * s);
    this.vy = vy0;
    this.mode = 'air';
    this.setPose('leap');
    yield* this.airborne(o);
    return true;
  }

  // Get to p's floor: walk if it's close, otherwise leap (as many leaps as it takes).
  * travel(p, o = {}) {
    const w = this.w, geo = w.geo, s = this.s;
    if (this.mode === 'air') yield* this.land();
    for (let i = 0; i < 4; i++) {
      if (o.until && o.until()) return false;
      const here = geo.displayAt({ x: this.x, y: this.y - 40 * s });
      const there = geo.displayAt(p) || geo.nearestDisplay(p);
      const dx = p.x - this.x;
      if (here === there && Math.abs(dx) < (o.walk != null ? o.walk : 180) * s) {
        yield* this.walkTo(p.x, { run: o.run, until: o.until, timeout: Math.abs(dx) / ((o.run ? RUN : WALK) * s) + 2 });
        return true;
      }
      const far = Math.abs(dx) > MAX_LEAP * s;
      yield* this.leapTo(far ? { x: this.x + Math.sign(dx) * MAX_LEAP * s, y: this.y } : p, o);
      if (Math.abs(p.x - this.x) < 8 * s) return true;
    }
    return false;
  }

  // the armored hero's flight primitives, the Hulk way
  * flyTo(p, o = {}) { return yield* this.travel(p, { until: o.until }); }
  * takeOff() { yield* this.leapTo({ x: this.x + this.facing * 60 * this.s, y: this.y }); }
  * hoverFor(sec, until) { if (this.mode === 'air') yield* this.land(); yield* this.wait(sec, until); }
  steer(tx, ty) { if (this.mode === 'air') this.airStep(); return Math.hypot(tx - this.x, ty - this.y); }
  airPose() { if (this.mode === 'air') this.setPose(this.vy < 0 ? 'leap' : 'fall'); }
  holdPosition() {}

  // falling back to the floor from wherever he is
  * land() {
    if (this.mode !== 'air') return;
    yield* this.airborne({});
  }

  // touching down: a hard landing cracks the floor (and whatever stands on it)
  * landing(o = {}) {
    const w = this.w, s = this.s;
    const impact = this.vy;
    this.y = w.groundAt(this.x, this.y);
    this.vx = 0; this.vy = 0;
    this.mode = 'ground';
    if (o.smash || impact > 760 * s) {
      const sm = o.smash || { r: 150 * s, dmg: 2.5, stun: 1 };
      this.setPose('land');
      this.smashAt(this.x, sm.r, sm.dmg, sm.stun);
      w.sound('hulkLand', this);
      w.fx('smash', this.x, this.y, { size: s * (o.smash ? 1.25 : 0.9) });
      yield* this.wait(o.quick ? 0.35 : 0.6);
    } else {
      this.setPose('crouch');
      w.sound('hulkStomp', this);
      w.fx('stomp', this.x, this.y, { size: s * 1.4 });
      yield* this.wait(0.22);
    }
    this.setPose('stand');
  }

  // ------------------------------------------------------------ smashing
  dropHeld() {
    if (this.held) {
      const e = this.held;
      this.held = null;
      if (this.w.enemies.includes(e)) this.w.launchEnemy(e, 0, 0);
    }
    this.carry = null;
  }

  holdHeld() {
    const e = this.held;
    if (!e || !this.w.enemies.includes(e) || e.hp <= 0) { this.held = null; return false; }
    this.w.holdEnemy(e, this, this.x + this.facing * 4 * this.s, this.y - 118 * this.s);
    return true;
  }

  // a shockwave along the floor around x: hurts and dazes ground units, pops light ones up
  smashAt(x, r, dmg, stun) {
    const w = this.w, ws = w.s, g = w.groundAt(x, this.y);
    let n = 0;
    for (const e of [...w.enemies]) {
      if (e.launch || e.grabbed) continue;
      const eg = w.groundAt(e.x, e.y);
      if (Math.abs(eg - g) > 6) continue; // another floor
      if (e.air && !e.stun && eg - e.y > 90 * ws) continue; // too high to feel it
      const d = Math.abs(e.x - x);
      if (d > r + ENEMY[e.kind].r * ws) continue;
      const k = 1 - 0.5 * Math.min(1, d / r);
      w.damage(e, dmg * k * this.mult(), { x, y: g });
      if (e.hp > 0) {
        w.stunEnemy(e, stun, 'daze');
        if (!isBoss(e) && e.kind !== 'tank') w.launchEnemy(e, Math.sign(e.x - x || 1) * 160 * ws, -380 * ws * k);
      }
      n++;
    }
    return n;
  }

  * groundSmash(at) {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    if (at) this.faceTo(at);
    this.setPose('smash');
    w.sound('hulkGrunt', this);
    yield* this.wait(0.44);
    this.power -= 10;
    this.cd.smash = 3.2;
    w.count('smashes');
    const fx = this.x + this.facing * 26 * s;
    this.smashAt(fx, 260 * s, 5.5, 1.8);
    w.sound('hulkSmash', this);
    w.fx('smash', fx, this.y, { size: s * 1.2 });
    yield* this.wait(0.5);
    this.setPose('stand');
  }

  // thunderclap: a cone of air that knocks things out of the sky and blows away incoming fire
  * clap(tp) {
    const w = this.w, s = this.s, ws = w.s;
    if (this.mode === 'air') yield* this.land();
    this.faceTo(tp);
    this.setPose('clap');
    yield* this.wait(0.42);
    this.power -= 9;
    this.cd.clap = 4.5;
    w.count('claps');
    const o = { x: this.x + this.facing * 30 * s, y: this.y - 62 * s };
    let a0 = Math.atan2(tp.y - o.y, tp.x - o.x);
    if (Math.cos(a0) * this.facing < 0.2) a0 = Math.atan2(Math.sin(a0), this.facing * 0.3);
    const R = 380 * s;
    for (const e of [...w.enemies]) {
      if (e.grabbed) continue;
      const c = w.enemyCenter(e);
      const d = dist(c, o);
      if (d > R + ENEMY[e.kind].r * ws) continue;
      let da = Math.atan2(c.y - o.y, c.x - o.x) - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > 0.75 && d > 60 * s) continue;
      const k = 1 - 0.6 * Math.min(1, d / R);
      w.damage(e, 3 * k * this.mult(), o);
      if (e.hp <= 0) continue;
      w.stunEnemy(e, 2.6 * k + 0.6, 'daze');
      const a = Math.atan2(c.y - o.y, c.x - o.x);
      if (!isBoss(e)) w.launchEnemy(e, Math.cos(a) * 520 * ws * k, Math.sin(a) * 420 * ws * k - 120 * ws);
    }
    for (const p of [...w.shots]) if (p.owner === 'enemy' && dist(p, o) < 260 * s) w.shots.splice(w.shots.indexOf(p), 1);
    w.sound('hulkClap', this);
    w.fx('clap', o.x, o.y, { size: s, dir: this.facing });
    yield* this.wait(0.45);
  }

  * punchCombo(e) {
    const w = this.w, s = this.s, ws = w.s;
    for (let i = 0; i < 2; i++) {
      if (e.hp <= 0 || !w.enemies.includes(e) || e.launch) return;
      this.faceTo(w.enemyCenter(e));
      this.setPose(i % 2 ? 'punch2' : 'punch');
      yield* this.wait(0.17);
      const c = w.enemyCenter(e);
      if (e.hp > 0 && !e.launch && Math.abs(c.x - this.x) < (ENEMY[e.kind].r * ws + 75 * s) && Math.abs(c.y - this.chest().y) < 95 * s) {
        w.damage(e, 3.2 * this.mult(), this.chest());
        w.sound('hulkPunch', e);
        w.fx('whack', c.x, c.y, { size: ws });
        w.count('punches');
        if (e.hp > 0 && (i === 1 || e.air)) w.launchEnemy(e, this.facing * 560 * ws, -320 * ws, { dmg: 2 * this.mult() });
      }
      this.power -= 1.5;
      yield* this.wait(0.22);
    }
  }

  // jump at a flyer and swat it — it becomes a missile that crashes into its friends
  * leapAttack(e) {
    const w = this.w, s = this.s, ws = w.s;
    if (this.mode === 'air') yield* this.land();
    this.cd.leapAtk = 1.6;
    const c = w.enemyCenter(e);
    const aim = { x: c.x + (e.vx || 0) * 0.3 - this.facing * 10 * s, y: c.y + 78 * s };
    let swatted = false;
    const check = () => {
      if (swatted || !w.enemies.includes(e) || e.launch) return false;
      const cc = w.enemyCenter(e);
      const hand = { x: this.x + this.facing * 18 * s, y: this.y - 82 * s };
      if (dist(cc, hand) > ENEMY[e.kind].r * ws + 50 * s) return false;
      swatted = true;
      this.setPose('swat');
      w.damage(e, 5 * this.mult(), hand);
      w.sound('hulkPunch', e);
      w.fx('whack', cc.x, cc.y, { size: ws });
      w.count('swats');
      if (e.hp > 0) w.launchEnemy(e, this.facing * 650 * ws, 260 * ws, { thrown: { dmg: 4 * this.mult(), r: 70 } });
      for (const o of [...w.enemies]) if (o !== e && !o.launch && !o.grabbed && dist(w.enemyCenter(o), hand) < 70 * s) w.damage(o, 3 * this.mult(), hand);
      return true;
    };
    yield* this.leapTo(aim, { air: true, quick: true, cost: 7, check });
  }

  // leap onto a ground target and land on it
  * leapSmash(e) {
    const s = this.s;
    const side = Math.sign(this.x - e.x) || 1;
    this.cd.smash = Math.max(this.cd.smash, 1.5);
    yield* this.leapTo({ x: e.x + side * 25 * s, y: e.y }, { smash: { r: 210 * s, dmg: 5.5, stun: 1.6 }, cost: 9 });
  }

  // rip up a chunk of floor and lob it (at an enemy or at a spot)
  * boulderThrow(tgt) {
    const w = this.w, s = this.s, ws = w.s;
    if (this.mode === 'air') yield* this.land();
    const isEnemy = !!tgt.kind;
    const at = () => (isEnemy && w.enemies.includes(tgt) ? w.enemyCenter(tgt) : isEnemy ? { x: tgt.x, y: tgt.y } : tgt);
    try {
      this.faceTo(at());
      this.setPose('rip');
      w.sound('hulkRip', this);
      w.fx('rubble', this.x + this.facing * 24 * s, this.y, { size: s });
      yield* this.wait(0.45);
      this.carry = 'boulder';
      this.setPose('lift');
      yield* this.wait(0.3);
      this.faceTo(at());
      this.setPose('throw');
      yield* this.wait(0.26);
      const c = at();
      const from = { x: this.x + this.facing * 12 * s, y: this.y - 112 * s };
      const g = 900 * ws;
      const lead = isEnemy ? (tgt.vx || 0) * 0.5 : 0;
      const dx = c.x + lead - from.x, dy = c.y - from.y;
      const t = clamp(Math.abs(dx) / (520 * ws), 0.45, 1.6);
      w.addShot({
        kind: 'boulder', owner: 'hero', x: from.x, y: from.y, vx: dx / t, vy: dy / t - 0.5 * g * t, g,
        dmg: 6 * this.mult(), r: 12, splash: 80, splashDmg: 3.5 * this.mult(), knock: 220, stun: 1.2, stunKind: 'daze',
        hitFx: 'rubble', hitSound: 'hulkSmash', hitSize: 1.2, life: 4, size: s,
      });
      this.carry = null;
      this.power -= 7;
      this.cd.boulder = 3.5;
      w.count('boulders');
      w.sound('hulkWhoosh', this);
      yield* this.wait(0.35);
    } finally { this.carry = null; }
  }

  // grab a walker or tank, lift it overhead and hurl it into the others
  * grabThrow(e) {
    const w = this.w, s = this.s, ws = w.s;
    this.cd.grab = 5;
    try {
      this.faceTo(w.enemyCenter(e));
      this.setPose('rip');
      yield* this.wait(0.25);
      if (!w.enemies.includes(e) || e.hp <= 0 || e.launch || e.grabbed || Math.abs(e.x - this.x) > 120 * s) return;
      this.held = e;
      w.count('throws');
      this.say(pick(['HULK THROW!', 'CATCH!', 'UP YOU GO!']));
      w.sound('hulkGrunt', this);
      this.setPose('lift');
      let t = 0;
      while (t < 0.55) { if (!this.holdHeld()) return; t += this.dt; yield; }
      // throw it at the biggest crowd (or just far away)
      const others = w.enemies.filter((o) => o !== e && !o.launch && !o.grabbed);
      let tgt = null, best = -Infinity;
      for (const o of others) {
        const crowd = others.filter((q) => dist(q, o) < 120 * ws).length;
        const sc = crowd * 200 - Math.abs(o.x - this.x) * 0.3;
        if (sc > best) { best = sc; tgt = o; }
      }
      if (tgt) this.facing = Math.sign(tgt.x - this.x) || this.facing;
      this.setPose('throw');
      t = 0;
      while (t < 0.22) { if (!this.holdHeld()) return; t += this.dt; yield; }
      let vx = this.facing * 700 * ws, vy = -300 * ws;
      if (tgt) {
        const g = 1500 * ws, a = w.enemyCenter(e), b = w.enemyCenter(tgt);
        const tt = clamp(Math.abs(b.x - a.x) / (750 * ws), 0.3, 1.3);
        vx = (b.x - a.x) / tt; vy = (b.y - a.y) / tt - 0.5 * g * tt;
      }
      this.held = null;
      w.launchEnemy(e, vx, vy, { thrown: { dmg: 7 * this.mult(), r: 95 } });
      w.sound('hulkWhoosh', this);
      this.power -= 6;
      yield* this.wait(0.35);
    } finally { this.dropHeld(); }
  }

  // the roar: a burst of rage that rattles everything nearby
  * roar(byUser) {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    this.cd.roar = 8;
    this.setPose('roar');
    w.sound('hulkRoar', this);
    w.fx('roar', this.x, this.y - 70 * s, { size: s });
    this.say(pick(['RAAAAGH!', 'HULK SMASH!', 'GRAAAAH!']), 'warn');
    this.rage = Math.min(100, this.rage + (byUser ? 15 : 25));
    w.count('roars');
    for (const e of w.enemies) if (dist(w.enemyCenter(e), this.chest()) < 220 * s) w.stunEnemy(e, 0.9, 'daze');
    yield* this.wait(1.3);
    this.setPose('stand');
  }

  // ------------------------------------------------------------ brain
  choose() {
    const w = this.w;
    if (this.mode === 'down') return [this.taskReboot(), 'reboot', 99];
    if (w.nuke && !w.nuke.passed) return [this.taskEvacuate(), 'evacuate', 98];
    if (w.quiet) return [this.taskQuiet(), 'quiet', 95];
    if (w.announcement) return [this.taskAnnounce(), 'announce', 96];
    if (w.enemies.length && (w.settings.autoDefend !== false || w.lockId)) return [this.taskCombat(), 'combat', 80];
    if (this.mode === 'air') return [this.land(), 'land', 30];
    if (this.power < 25) return [this.taskRest(), 'rest', 25];
    const opts = [];
    const add = (wt, fn, name) => { if (wt > 0) opts.push([wt, fn, name]); };
    add(3, () => this.taskIdle(rand(3, 7)), 'idle');
    add(1.5, () => this.taskIdle(rand(3, 6), 'idleLook'), 'look');
    add(0.6, () => this.taskFlex(), 'flex');
    add(2, () => this.taskStroll(), 'stroll');
    add(0.9, () => this.taskHop(), 'hop');
    add(w.geo.displays.length > 1 ? 0.6 : 0, () => this.taskVisit(), 'visit');
    add(0.5, () => this.taskSit(rand(5, 10)), 'sit');
    add(0.25, () => this.roar(false), 'roar');
    add(0.3, () => this.taskGreet(false), 'wave');
    add(0.15, () => this.groundSmash(), 'bored');
    let r = Math.random() * opts.reduce((a, o) => a + o[0], 0);
    for (const [wt, fn, name] of opts) { r -= wt; if (r <= 0) return [fn(), name, 10]; }
    return [this.taskIdle(3), 'idle', 10];
  }

  * taskStroll() {
    if (this.mode === 'air') yield* this.land();
    const s = this.s;
    const d = this.w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || this.w.geo.primary;
    const tx = clamp(this.x + rand(-360, 360) * s, d.work.x + 40 * s, d.work.x + d.work.width - 40 * s);
    yield* this.walkTo(tx);
    yield* this.wait(rand(0.5, 1.5));
  }

  * taskHop() {
    const s = this.s;
    const d = this.w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || this.w.geo.primary;
    const tx = clamp(this.x + rand(-600, 600) * s, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s);
    yield* this.leapTo({ x: tx, y: this.y });
    yield* this.wait(rand(0.4, 1));
  }

  * taskVisit() {
    const w = this.w, s = this.s;
    const here = w.geo.displayAt({ x: this.x, y: this.y - 40 * s });
    const others = w.geo.displays.filter((d) => d !== here);
    if (!others.length) return;
    const d = pick(others);
    yield* this.travel({ x: d.work.x + rand(0.2, 0.8) * d.work.width, y: d.work.y + d.work.height - 5 });
  }

  * taskLeapAround() {
    const w = this.w;
    this.say(pick(['HULK GO!', 'HULK JUMP!']));
    for (let i = 0; i < 3; i++) {
      const d = pick(w.geo.displays);
      yield* this.travel({ x: d.work.x + rand(0.15, 0.85) * d.work.width, y: d.work.y + d.work.height - 5 }, { walk: 60 });
    }
  }

  * taskLeapHere(at) {
    yield* this.travel({ x: at.x, y: at.y }, { walk: 120 });
    this.setPose('stand');
    yield* this.wait(0.4);
  }

  * taskSit(dur) {
    if (this.mode === 'air') yield* this.land();
    this.setPose('sit');
    yield* this.wait(dur, () => this.w.enemies.length > 0);
    this.setPose('stand');
  }

  * taskRest() {
    if (this.mode === 'air') yield* this.land();
    this.say('HULK... BREATHE.');
    this.setPose('sit');
    yield* this.wait(30, () => this.power >= 90 || this.w.enemies.length > 0);
    this.setPose('stand');
  }

  * taskCalm() {
    if (this.mode === 'air') yield* this.land();
    this.say(this.rage > 50 ? 'HULK... CALM... DOWN.' : 'Hulk calm.');
    this.setPose('sit');
    let t = 0;
    while (t < 3.5) { this.rage = Math.max(0, this.rage - 30 * this.dt); this.rampUntil = 0; t += this.dt; yield; }
    this.setPose('stand');
  }

  * taskFlex() {
    if (this.mode === 'air') yield* this.land();
    this.faceTo(this.w.cursor);
    this.setPose('flex');
    if (chance(0.6)) this.say(pick(['HULK STRONGEST THERE IS!', 'LOOK. MUSCLES.', 'HULK STRONG.']));
    this.w.sound('hulkGrunt', this);
    yield* this.wait(2);
    this.setPose('stand');
  }

  * taskGreet(byUser) {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    this.faceTo(w.cursor);
    const recent = byUser ? this.clicks.filter((t) => w.now - t < 3000).length : 0;
    if (recent >= 4) {
      this.say(this.line('poke'), 'warn');
      this.setPose('roar');
      w.sound('hulkRoar', this);
      this.rage = Math.min(100, this.rage + 10);
      yield* this.wait(1.2);
    } else {
      this.setPose(chance(0.5) ? 'greet' : 'flex');
      if (byUser) { this.say(this.line('greet')); w.sound('hulkGrunt', this); }
      yield* this.wait(1.4);
    }
    this.setPose('stand');
  }

  * taskArrive() {
    const w = this.w, s = this.s, d = w.geo.primary;
    this.x = d.work.x + d.work.width * rand(0.35, 0.65);
    this.y = this.topLimit(d);
    this.mode = 'air';
    this.vx = 0; this.vy = 200 * s;
    this.setPose('fall');
    yield* this.land();
    this.say('HULK HERE!');
    this.setPose('roar');
    w.sound('hulkRoar', this);
    yield* this.wait(1.3);
    this.setPose('stand');
  }

  * taskAnnounce() {
    const w = this.w;
    const a = w.announcement;
    if (!a) return;
    const d = w.geo.primary;
    const cx = d.work.x + d.work.width / 2;
    this.say(pick(['HULK HAS MESSAGE!', 'HUMAN! LISTEN!']));
    w.sound('hulkGrunt', this);
    yield* this.travel({ x: cx, y: d.work.y + d.work.height - 5 }, { walk: 260 });
    if (Math.abs(this.x - cx) > 3) yield* this.walkTo(cx, { timeout: 6 });
    a.arrived = true;
    this.facing = 1;
    w.dirty();
    while (w.announcement === a) {
      this.setPose(w.now - a.start < 3000 ? 'point' : 'stand');
      yield;
    }
    this.say(pick(['GOOD. HUMAN DO IT.', 'HULK PROUD.', 'NOW HULK SMASH SOMETHING.']));
    yield* this.wait(0.8);
  }

  * taskQuiet() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    const tx = d.work.x + d.work.width - 70 * s;
    yield* this.travel({ x: tx, y: d.work.y + d.work.height - 5 }, { walk: 200, until: () => !w.quiet });
    this.facing = -1;
    this.say('HULK SLEEP NOW.');
    let z = 0;
    while (w.quiet) {
      this.setPose('sleep');
      z += this.dt;
      if (z > 2.2) { z = 0; w.fx('zzz', this.x - 8 * s, this.y - 62 * s, {}); }
      yield;
    }
    this.setPose('stand');
    this.say('HULK AWAKE!');
    w.sound('hulkGrunt', this);
    yield* this.wait(0.8);
  }

  * taskCombat() {
    const w = this.w;
    if (this.mode === 'air') yield* this.land();
    if (this.form === 'banner') { this.form = 'hulk'; w.fx('gamma', this.x, this.y - 40 * this.s, { size: this.s }); }
    this.say(w.enemies.some(isBoss) ? this.line('heavyThreat') : this.line('threat'), 'warn');
    w.sound('hulkGrunt', this);
    if (this.cd.roar <= 0 && chance(0.35)) yield* this.roar(false);
    while (w.enemies.length) {
      if (w.announcement) return;
      if (this.mode === 'air') yield* this.land();
      const target = w.pickTarget(this);
      if (!target) { yield; continue; }
      this.targetId = target.id;
      if (this.power < 8) {
        this.say('HULK... BREATHE...');
        this.setPose('stand');
        yield* this.wait(1.2, () => this.power > 30);
        continue;
      }
      yield* this.attackTarget(target);
      yield;
    }
    if (this.ally) return;
    this.say(this.line('victory'));
    this.setPose('roar');
    w.sound('hulkRoar', this);
    yield* this.wait(1.3);
    this.setPose('stand');
  }

  // pick the move for this target from where everything is
  * attackTarget(e) {
    const w = this.w, s = this.s, ws = w.s, geo = w.geo;
    const c = w.enemyCenter(e);
    const me = this.chest();
    const dx = c.x - this.x, adx = Math.abs(dx);
    const sameScreen = (geo.displayAt(c) || geo.nearestDisplay(c)) === (geo.displayAt(me) || geo.nearestDisplay(me));
    const flyer = e.air && !e.stun;
    const near = w.enemies.filter((o) => !o.launch && !o.grabbed && dist(w.enemyCenter(o), me) < 270 * s);
    const nearAir = near.filter((o) => o.air && !o.stun);
    const nearGround = near.filter((o) => !o.air || o.stun);
    if (this.cd.clap <= 0 && this.power > 12 && (nearAir.length >= 2 || (flyer && adx < 300 * s && this.y - c.y < 340 * s && chance(0.5)))) { yield* this.clap(c); return; }
    if (this.cd.smash <= 0 && this.power > 12 && nearGround.length >= 2) { yield* this.groundSmash(c); return; }
    if (flyer) {
      if (!sameScreen) { yield* this.travel({ x: c.x, y: c.y }, { walk: 60 }); return; }
      if (this.cd.leapAtk <= 0 && this.power > 10) { yield* this.leapAttack(e); return; }
      if (this.cd.boulder <= 0 && this.power > 8) { yield* this.boulderThrow(e); return; }
      yield* this.walkTo(c.x - Math.sign(dx || 1) * 60 * s, { timeout: 0.8, run: true });
      return;
    }
    // on the floor (or knocked down onto it)
    if (!sameScreen || adx > 700 * s) {
      if (sameScreen && this.cd.boulder <= 0 && this.power > 8 && chance(0.5)) { yield* this.boulderThrow(e); return; }
      yield* this.leapSmash(e);
      return;
    }
    if (adx > ENEMY[e.kind].r * ws + 70 * s) {
      if (this.cd.boulder <= 0 && adx > 300 * s && this.power > 8 && chance(0.35)) { yield* this.boulderThrow(e); return; }
      if (adx > 380 * s && this.cd.smash <= 0 && this.power > 14 && chance(0.6)) { yield* this.leapSmash(e); return; }
      yield* this.walkTo(c.x - Math.sign(dx) * (ENEMY[e.kind].r * ws + 45 * s), { run: true, timeout: 2.5, until: () => !w.enemies.includes(e) || e.launch });
      return;
    }
    if ((e.kind === 'tank' || e.kind === 'walker') && this.cd.grab <= 0 && w.enemies.length >= 2 && chance(0.6)) { yield* this.grabThrow(e); return; }
    if (this.cd.smash <= 0 && this.power > 12 && chance(0.35)) { yield* this.groundSmash(c); return; }
    yield* this.punchCombo(e);
  }

  * taskAttackAt(kind, p) {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    const near = w.enemies.filter((e) => dist(w.enemyCenter(e), p) < 140 * s).sort((a, b) => dist(w.enemyCenter(a), p) - dist(w.enemyCenter(b), p));
    if (kind === 'clap') {
      if (Math.abs(p.x - this.x) > 340 * s) yield* this.travel({ x: p.x - Math.sign(p.x - this.x) * 240 * s, y: p.y }, { walk: 400, run: true });
      yield* this.clap(p);
    } else if (kind === 'boulder') {
      yield* this.boulderThrow(near[0] || p);
    } else if (kind === 'punch') {
      const e = near[0];
      if (e) {
        yield* this.travel({ x: e.x - Math.sign(e.x - this.x || 1) * 50 * s, y: e.y }, { walk: 500, run: true });
        yield* this.punchCombo(e);
      } else {
        yield* this.travel({ x: p.x, y: p.y }, { walk: 500, run: true });
        this.setPose('punch');
        yield* this.wait(0.5);
      }
    } else if (kind === 'leap') {
      yield* this.taskLeapHere(p);
    } else {
      // smash: land on that spot (or smash right there if he's already close)
      const here = w.geo.displayAt({ x: this.x, y: this.y - 40 * s });
      if (Math.abs(p.x - this.x) > 140 * s || (w.geo.displayAt(p) || here) !== here) {
        yield* this.leapTo(p, { smash: { r: 210 * s, dmg: 5.5, stun: 1.6 }, cost: 9 });
      } else yield* this.groundSmash(p);
    }
    yield* this.wait(0.3);
  }

  // ------------------------------------------------------------ knocked out, nuked, carried
  * taskReboot() {
    const w = this.w, s = this.s;
    this.aim = null; this.charge = 0;
    try {
      this.dropHeld();
      this.say(pick(['HULK... TIRED...', 'HULK... NEED... NAP...']), 'warn');
      w.sound('hulkKo', this);
      if (this.mode === 'air' || this.y < this.ground() - 2) {
        this.mode = 'fall';
        while (this.mode === 'fall') yield;
      }
      this.mode = 'down';
      this.setPose('down');
      yield* this.wait(1.2);
      // he shrinks back into Bruce Banner for a moment
      this.form = 'banner';
      w.fx('gamma', this.x, this.y - 30 * s, { size: s, shrink: true });
      this.setPose('banner');
      this.say(pick(['…Where am I?', 'Oh no. Not again.', 'Did I… break something?']));
      yield* this.wait(3.2);
      this.say(pick(['Uh oh. I can feel it…', 'You won\'t like me when I\'m—']), 'warn');
      yield* this.wait(1);
      this.form = 'hulk';
      this.setPose('transform');
      w.sound('hulkRoar', this);
      w.fx('gamma', this.x, this.y - 50 * s, { size: s });
      this.armor = Math.max(this.armor, 60);
      this.rage = Math.max(this.rage, 70);
      this.power = Math.max(this.power, 60);
      yield* this.wait(1.0);
      this.mode = 'ground';
      this.setPose('roar');
      this.say('HULK BACK!', 'warn');
      yield* this.wait(0.8);
      this.setPose('stand');
    } finally { this.form = 'hulk'; }
  }

  // turn into Bruce Banner for a few seconds, just because you asked
  * taskBanner() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    try {
      this.say('Hulk... calm...');
      this.setPose('sit');
      yield* this.wait(1);
      this.form = 'banner';
      w.fx('gamma', this.x, this.y - 30 * s, { size: s, shrink: true });
      this.setPose('banner');
      this.say(pick(['Hi. Bruce. Nice to meet you.', 'Sorry about the floor.', 'Has anyone seen my glasses? Oh.']));
      yield* this.wait(4.5, () => w.enemies.length > 0);
      this.say('Here he comes again…', 'warn');
      yield* this.wait(0.8);
      this.form = 'hulk';
      this.setPose('transform');
      w.sound('hulkRoar', this);
      w.fx('gamma', this.x, this.y - 50 * s, { size: s });
      yield* this.wait(1.0);
      this.setPose('roar');
      this.say('HULK BACK!', 'warn');
      yield* this.wait(0.7);
      this.setPose('stand');
    } finally {
      if (this.form === 'banner') { this.form = 'hulk'; w.fx('gamma', this.x, this.y - 50 * s, { size: s }); }
    }
  }

  * taskEvacuate() {
    const w = this.w;
    if (!w.nuke) return;
    this.dropHeld();
    this.aim = null;
    this.say(this.line('evacuate'), 'warn');
    if (this.mode === 'air') yield* this.land();
    const spot = w.safeSpot(this);
    yield* this.travel(spot, { until: () => !w.nuke || w.nuke.detonated, walk: 140, run: true, quick: true });
    this.setPose('brace');
    this.say(this.line('brace'), 'warn');
    while (w.nuke && !w.nuke.passed) {
      if (this.mode === 'air') { if (this.airStep()) { this.mode = 'ground'; this.vx = this.vy = 0; } } else this.setPose('brace');
      yield;
    }
  }

  * taskRecover() {
    this.setPose('down');
    yield* this.wait(0.7);
    this.setPose('crouch');
    yield* this.wait(0.35);
    this.rage = Math.min(100, this.rage + 20);
    this.setPose('roar');
    this.w.sound('hulkRoar', this);
    this.say(this.line('recover'), 'warn');
    yield* this.wait(1.0);
    this.setPose('stand');
  }

  startHold() {
    if (this.mode === 'down') return;
    this.dropHeld();
    super.startHold();
  }

  // dropped by the cursor: no thrusters — he falls and smashes the floor
  release() {
    if (this.mode !== 'held') return;
    const w = this.w, s = this.s;
    this.vx = clamp(w.cursorVel.x * 0.5, -900 * s, 900 * s);
    this.vy = clamp(w.cursorVel.y * 0.5, -900 * s, 900 * s);
    this.swing = 0;
    this.mode = 'fall';
    this.run(this.taskDropped(this.y), 'fall', 60);
  }

  * taskDropped(y0) {
    const w = this.w, s = this.s;
    while (this.mode === 'fall') yield;
    this.setPose('land');
    if (this.y - y0 > 120 * s) {
      this.smashAt(this.x, 170 * s, 3, 1.2);
      w.sound('hulkLand', this);
      w.fx('smash', this.x, this.y, { size: s });
      this.say(pick(['HULK SMASH FLOOR!', 'HMPH!', 'NEXT TIME HULK SMASH YOU.']));
    }
    yield* this.wait(0.8);
    this.setPose('stand');
  }

  statusText() {
    const w = this.w;
    if (w.quiet) return 'sleeping';
    if (this.mode === 'thrown') return 'blasted by the shockwave';
    if (w.nuke && !w.nuke.passed) return 'leaping away from the nuke';
    if (this.form === 'banner') return 'just Bruce Banner right now';
    if (this.mode === 'down') return 'knocked out';
    if (this.mode === 'held') return 'being carried (angrily)';
    if (this.rampage()) return 'HULK SMASH!';
    if (w.army) return 'smashing an army alone';
    if (w.enemies.length) return 'smashing';
    if (this.armor < 30) return 'hurt';
    if (this.mode === 'air') return 'leaping';
    if (this.power < 20) return 'out of breath';
    if (this.rage > 70) return 'very angry';
    if (this.rage > 35) return 'grumpy';
    return 'calm (for now)';
  }

  // ------------------------------------------------------------ what he offers the UI
  meters() {
    return [
      { k: 'rage', label: 'Rage', short: 'RGE', icon: '😡', v: this.rage, color: '#ff6a3d', invert: true }, // low rage is fine
      { k: 'armor', label: 'Health', short: 'HP', icon: '💚', v: this.armor, color: '#8dff5a' },
      { k: 'power', label: 'Stamina', short: 'STM', icon: '💪', v: this.power, color: '#c7a8ff' },
    ];
  }

  onCommand(name, at, a, free) {
    const w = this.w, s = this.s;
    switch (name) {
      case 'attack': if (free) this.interrupt(this.taskAttackAt(a.kind || 'smash', at), 'attack', 85); break;
      case 'leapTo': case 'flyTo': case 'call': if (free) this.interrupt(this.taskLeapHere(at), 'leap', 50); break;
      case 'patrol': case 'flyby': if (free) this.interrupt(this.taskLeapAround(), 'patrol', 50); break;
      case 'takeoff': if (free) this.interrupt(this.taskHop(), 'hop', 50); break;
      case 'land': break;
      case 'roar': if (free) this.interrupt(this.roar(true), 'roar', 50); break;
      case 'flex': case 'thumbsUp': if (free) this.interrupt(this.taskFlex(), 'flex', 50); break;
      case 'calm': if (free) this.interrupt(this.taskCalm(), 'calm', 55); break;
      case 'banner': if (free && this.form === 'hulk') this.interrupt(this.taskBanner(), 'banner', 60); break;
      case 'repair':
        this.armor = 100; this.say('HULK FEEL GOOD!'); w.fx('gamma', this.x, this.y - 50 * s, { size: s }); w.sound('hulkGrunt', this);
        break;
      case 'recharge':
        this.power = 100; this.say('HULK READY!'); w.fx('roar', this.x, this.y - 70 * s, { size: s * 0.7 }); w.sound('hulkGrunt', this);
        break;
      default: return false;
    }
    return true;
  }

  menuItems() {
    const h = this, w = this.w;
    const skin = w.settings.hulkSkin || 'green';
    return [
      {
        icon: '💥', label: 'Smash here',
        sub: [
          { icon: '👊', label: 'Ground smash', cmd: 'attack', args: { kind: 'smash' }, hint: 'leaps there if it\'s far' },
          { icon: '👏', label: 'Thunderclap', cmd: 'attack', args: { kind: 'clap' }, hint: 'knocks flyers down' },
          { icon: '🪨', label: 'Throw a chunk of floor', cmd: 'attack', args: { kind: 'boulder' } },
          { icon: '🤜', label: 'Punch', cmd: 'attack', args: { kind: 'punch' } },
        ],
      },
      {
        icon: '🦘', label: 'Leap',
        sub: [
          { icon: '📍', label: 'Leap here', cmd: 'leapTo' },
          { icon: '🔄', label: 'Leap around the screens', cmd: 'patrol' },
        ],
      },
      {
        icon: '💚', label: 'Hulk', badge: h.armor < 30 ? '!' : null,
        sub: [
          { icon: '😡', label: 'Roar', cmd: 'roar' },
          { icon: '💪', label: 'Flex', cmd: 'flex' },
          { icon: '🧘', label: `Calm down (rage ${Math.round(h.rage)}%)`, cmd: 'calm' },
          { icon: '❤️', label: `Heal (${Math.round(h.armor)}%)`, cmd: 'repair', disabled: h.mode === 'down' },
          { icon: '🤓', label: 'Turn back into Banner…', cmd: 'banner', hint: 'for a moment', disabled: h.form !== 'hulk' || h.mode === 'down' },
          '-',
          ...SKINS.map(([k, l]) => ({ icon: '🎨', label: l, cmd: 'setting', args: { key: 'hulkSkin', value: k }, checked: skin === k })),
        ],
      },
    ];
  }

  trayItems() {
    return [['Leap around the screens', 'patrol'], ['Roar', 'roar'], ['Calm down', 'calm']];
  }

  snapExtra() {
    return { rage: this.rage, form: this.form, carry: this.carry, rampage: this.rampage() };
  }

  serialize() { return { power: this.power, armor: this.armor, missiles: this.missiles, rage: this.rage, x: this.x, y: this.y }; }
}

HulkHero.ID = 'hulk';
HulkHero.NAME = 'Hulk';
HulkHero.BODY = 1.4;
HulkHero.SIZE_KEY = 'hulkSize';
HulkHero.LOOK_KEY = 'hulkSkin';
HulkHero.DEFAULTS = { hulkSize: 'small', hulkSkin: 'green' };
HulkHero.ALLIES = null; // HULK FIGHT ALONE
HulkHero.LINES = HULK_LINES;
HulkHero.WELCOME = 'Right-click Hulk for the smash menu — throw robots at him, launch an army or set a reminder. HULK SMASH!';
HulkHero.HOME = 'Gamma Base';
HulkHero.REMINDER = {
  header: 'HULK SAYS:',
  quips: [
    'Puny human do task NOW!',
    'Hulk remember. Human forget. Hulk remind.',
    'Do it or Hulk smash calendar!',
    'Hulk wait here. Hulk not patient.',
    'Task small. Human strong. GO!',
    'Hulk say: no more snooze.',
  ],
  speech: (when, text, quip) => `Hulk say. It is ${when}. ${text}! ${quip}`,
  notify: (text) => `👊 HULK SAYS: ${text}`,
};
HulkHero.UI = {
  title: 'STRONGEST THERE IS',
  quick: [['🦘', 'Leap around', 'patrol'], ['👊', 'Smash', 'attack', { kind: 'smash' }], ['👏', 'Thunderclap', 'attack', { kind: 'clap' }], ['🪨', 'Boulder', 'attack', { kind: 'boulder' }], ['😡', 'Roar', 'roar'], ['💪', 'Flex', 'flex'], ['🧘', 'Calm down', 'calm'], ['❤️', 'Heal', 'repair']],
  stats: [['kills', 'robots smashed'], ['drones', 'Ultron drones'], ['walkers', 'Ultron soldiers'], ['tanks', 'Ultron heavies'], ['bosses', 'villains smashed'], ['thanos', 'Thanos'], ['doom', 'Doctor Doom'], ['kang', 'Kang'], ['galactus', 'Galactus'], ['armiesWon', 'armies beaten'], ['smashes', 'ground smashes'], ['claps', 'thunderclaps'], ['throws', 'robots thrown'], ['boulders', 'boulders thrown'], ['leaps', 'leaps'], ['reboots', 'knockouts']],
  looks: { key: 'hulkSkin', options: SKINS },
  armyNote: (n, size) => (size === 'legendary' ? 'Hulk fights all 1000 alone — and then Galactus. His rage maxes out: about 5 minutes of smashing.'
    : size === 'epic' ? 'Hulk fights 200 Ultrons alone. Thanos, Doom and Kang lead the waves.' : 'Hulk fights alone. More robots, more rage.'),
  help: [
    ['🖱️ The menu', 'Right-click anywhere (or on Hulk) for the smash menu. The tray icon and <b class="sc"></b> work too.'],
    ['🎯 Robots to smash', '<i>Deploy enemy</i> drops Ultron\'s robots (sentry, soldier, heavy, swarm) or a supervillain — Thanos, Doctor Doom, Kang, or the giant Galactus — where you right-clicked. Hulk charges in on his own. Click an enemy to make it his next target.'],
    ['👊 Smashing', 'Punches send robots flying, the ground smash shakes the whole floor, the thunderclap blows flyers out of the sky, he rips up chunks of floor to throw, and he hurls tanks into other tanks. <i>Smash here</i> aims at the spot you right-clicked.'],
    ['🦘 Leaping', 'Hulk can\'t fly — he lives on the floor of your screens and leaps everywhere else, landing with a smash. Drag him and let go: he drops and smashes the floor.'],
    ['😡 Rage', 'Fighting and getting hurt make him angrier, and angrier means stronger. At full rage he goes on a rampage. <i>Calm down</i> cools him off. He heals fast; if he\'s knocked out he turns back into Bruce Banner for a moment…'],
    ['⚔ Army attack', 'Hulk fights every army alone — even a legendary 1000. More robots, more rage.'],
    ['☢ Nuke', 'He leaps for another screen when the siren starts. The shockwave still throws him — and makes him very, very angry.'],
  ],
};

module.exports = HulkHero;
