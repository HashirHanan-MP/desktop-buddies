'use strict';
/*
 * Desktop Buddies — the hero world simulation, and the armored hero
 * ("Iron Man" style) who is the default hero.
 *
 * Side view: the hero stands on the floor (bottom of each screen's work area)
 * and has to fly to go anywhere higher. Enemies are deployed from the menu;
 * the hero fights them with repulsors, a two-hand blast, homing micro-missiles
 * and the chest beam. Enemies shoot back; at zero armor the suit goes offline
 * and reboots.
 *
 * Other heroes (heroes/*.js) subclass Hero and override movement, weapons and
 * texts; HeroWorld runs whichever hero its `profile` names (enemies, armies,
 * the nuke and allies are shared).
 *
 * Same public interface as the cat World (world.js) so main.js can switch.
 * Positions are global screen DIPs; hero (x, y) = point between the feet.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// army sizes and how many Iron Legion suits answer the call (never more than 7)
const ARMY_SIZES = { small: 10, medium: 20, large: 35, massive: 50, epic: 200, legendary: 1000 };
const MAX_LEGION = 7;
const legionFor = (total) => (total >= 50 ? 7 : total >= 35 ? 5 : total >= 20 ? 3 : 2);
const lerp = (a, b, k) => a + (b - a) * k;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const now = () => Date.now();
const num = (v, d) => (Number.isFinite(v) ? v : d);
let SEQ = 1;
const uid = (p) => `${p}${(SEQ++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const SIZES = { tiny: 0.8, small: 1, medium: 1.3, large: 1.6 };
const DIFF = { easy: { hp: 0.8, dmg: 0.5, rate: 0.75 }, normal: { hp: 1, dmg: 1, rate: 1 }, hard: { hp: 1.35, dmg: 1.5, rate: 1.3 } };
const INVASIONS = { off: null, rare: [20 * 60, 40 * 60], often: [4 * 60, 9 * 60] };

// The enemies: Ultron's robot army, and the villains as bosses (boss: true).
// r = hit radius, cy = centre height above the feet (0 for flyers); villains.js draws them to
// the same sizes. Galactus is a giant whose hit circle covers his legs, so every hero (even one
// who can't fly) can reach him; he is scaled to the screen (e.k), so his r/cy grow with it.
const ENEMY = {
  drone: { hp: 4, air: true, speed: 165, fire: [1.5, 2.7], dmg: 3, score: 1, r: 22, cy: 0, label: 'ULTRON SENTRY' },
  mini: { hp: 1, air: true, speed: 260, kamikaze: true, dmg: 5, score: 1, r: 11, cy: 0, label: 'ULTRON DRONE' },
  walker: { hp: 8, air: false, speed: 52, fire: [2.0, 3.1], dmg: 4, score: 2, r: 29, cy: -39, label: 'ULTRON SOLDIER' },
  tank: { hp: 16, air: false, speed: 36, fire: [3.0, 4.2], dmg: 10, score: 3, r: 34, cy: -44, label: 'ULTRON PRIME' },
  doombot: { hp: 6, air: true, speed: 140, fire: [1.7, 2.8], dmg: 4, score: 2, r: 24, cy: 0, label: 'DOOMBOT' },
  thanos: { hp: 95, air: false, speed: 26, fire: [2.1, 3.0], dmg: 12, score: 15, r: 66, cy: -100, boss: true, label: 'THANOS' },
  doom: { hp: 75, air: true, speed: 100, fire: [1.5, 2.4], dmg: 6, score: 12, r: 54, cy: 0, boss: true, label: 'DOCTOR DOOM' },
  kang: { hp: 80, air: false, speed: 36, fire: [1.7, 2.6], dmg: 5, score: 12, r: 50, cy: -76, boss: true, label: 'KANG THE CONQUEROR' },
  galactus: { hp: 220, air: false, speed: 0, fire: [2.6, 3.6], dmg: 14, score: 60, r: 212, cy: -212, boss: true, giant: true, label: 'GALACTUS' },
};
const GALACTUS_H = 930; // his full height (horns included) at e.k = 1; spawn() scales him to ~90% of the screen
// older names still work ("boss" was the heavy mech, "swarm" the mini-drones)
const ENEMY_ALIAS = { boss: 'thanos', mech: 'thanos', swarm: 'mini', ultron: 'walker' };
const BOSSES = ['thanos', 'doom', 'kang']; // army bosses (Galactus only ends a legendary battle)
const isBoss = (e) => !!(e && ENEMY[e.kind] && ENEMY[e.kind].boss);

const QUIPS_GREET = ['Hey there.', 'Systems nominal.', 'Need something?', 'Suit check: looking good.', 'All good up here.', 'At your service.'];
const QUIPS_POKE = ['Careful with the paint job.', 'That tickles. Not really.', 'Hands off the armor!', 'Okay, okay, I\'m awake.'];
const QUIPS_HELD = ['Whoa! Put me down!', 'Stabilizers… offline-ish.', 'This is undignified.', 'I can fly, you know.'];
const QUIPS_WIN = ['Threat neutralized.', 'That was almost too easy.', 'Area secure.', 'Another day, another drone.'];

const DEFAULT_IRON = { power: 100, armor: 100, missiles: 12 };

// The armored hero's three suits (ironArt.js draws them). body = size on screen,
// tough = share of incoming damage that gets through, punch = melee damage, step = footstep spacing.
const SUIT_FORMS = {
  classic: { label: 'Mark III — Classic', body: 1, tough: 1, punch: 3, step: 15 },
  mark50: { label: 'Mark 50 — Nanotech', body: 1, tough: 0.8, punch: 5, step: 15 },
  hulkbuster: { label: 'Hulkbuster', body: 1.4, tough: 0.55, punch: 7, step: 22 },
};

// Lines the world says through the hero. A subclass overrides any of them:
// a string, a list (one is picked) or a function of the arguments.
const IRON_LINES = {
  threat: 'THREAT DETECTED',
  heavyThreat: 'WARNING: SUPERVILLAIN',
  victory: QUIPS_WIN,
  bossDown: 'VILLAIN DOWN',
  bossBeam: 'INCOMING BEAM!',
  snapWarn: 'HE\'S GOING TO SNAP!',
  snapped: 'WHAT DID HE DO…?',
  frozen: 'CAN\'T… MOVE…',
  drained: 'POWER DRAINING!',
  meteors: 'INCOMING METEORS!',
  locked: (label) => `TARGET LOCKED: ${label}`,
  invasion: 'INCOMING!',
  army: (total) => (total >= 1000 ? 'LEGENDARY BATTLE: 1000 HOSTILES' : `HOSTILE ARMY: ${total} UNITS`),
  armyBoss: 'VILLAIN INBOUND',
  milestone: (m, done) => (m === 1 ? `${done} DOWN. KEEP PUSHING!` : m === 2 ? 'HALFWAY THERE, LEGION!' : `${done}! THEY'RE BREAKING!`),
  callAllies: 'CALLING THE LEGION',
  allyReplace: 'REINFORCEMENTS, JARVIS',
  allyDown: (callsign) => `${callsign} DOWN`,
  armyWon: 'ARMY DEFEATED. GOOD WORK, LEGION.',
  formUp: 'LEGION, FORM UP',
  nukeStill: 'THEY\'RE STILL COMING!',
  nukeClear: 'GROUND ZERO… CLEAR.',
  thrown: ['WHOA—!', 'AAAH!', 'HANG ON—', 'TOO CLOSE!'],
  recover: ['THAT WAS LOUD.', 'NOTE TO SELF: RUN FASTER.', 'STILL IN ONE PIECE.', 'EARS RINGING…'],
  evacuate: 'NUKE INBOUND — EVACUATING!',
  evacuateAlly: 'EVACUATING!',
  brace: 'BRACE FOR IMPACT!',
  armorLow: 'ARMOR CRITICAL',
  allyArrive: (callsign) => `${callsign} REPORTING`,
  allyLeave: ['GOOD HUNTING.', 'LEGION OUT.', 'CALL IF YOU NEED US.', 'RETURNING TO BASE.'],
  greet: QUIPS_GREET,
  poke: QUIPS_POKE,
  held: QUIPS_HELD,
};

// ======================================================================= Hero
class Hero {
  constructor(w, d, o) {
    d = d || {};
    o = o || {};
    this.w = w;
    this.id = o.id || 'main';
    this.ally = !!o.ally;
    this.suit = o.suit || null;
    this.callsign = o.callsign || 'MK-XLII';
    this.hud = [];
    this.spin = 0; this.spinV = 0;
    this.targetId = null;
    this.power = clamp(num(d.power, 100), 0, 100);
    this.armor = clamp(num(d.armor, 100), 0, 100);
    this.missiles = clamp(num(d.missiles, 12), 0, 12);
    this.x = num(d.x, 0); this.y = num(d.y, 0);
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.mode = 'ground'; // ground | air | held | fall | down
    this.pose = 'stand'; this.poseStart = now();
    this.aim = null; this.aimArm = 'near';
    this.charge = 0; this.beamK = 0; this.eyes = 1;
    this.dist = 0; this.hitAt = 0; this.swing = 0; this.swingV = 0;
    this.task = null; this.taskName = null; this.taskPrio = 0; this.inTask = false; this.pending = null;
    this.cd = { repulsor: 0, blast: 0, missiles: 0, unibeam: 0, dodge: 0 };
    this.clicks = [];
    this.lastStep = 0;
    this.dt = 1 / 60;
    this.speed = 0;
  }

  // hero scale: the world's size setting × how big this hero's body is
  get s() { return this.w.s * this.bodyScale; }

  // the armored hero's suit (the main suit wears the `suit` setting, the Legion its own colors)
  get suitKey() { return this.ally ? this.suit : this.w.settings.suit; }
  get suitForm() { return (this.constructor === Hero && SUIT_FORMS[this.suitKey]) || SUIT_FORMS.classic; }
  // body size: the class's BODY × the suit's (the Hulkbuster is huge)
  get bodyScale() { return this.constructor.BODY * this.suitForm.body; }

  // incoming damage is cut by the suit's toughness (other heroes bring their own armor accessors)
  get armor() { return this._armor; }
  set armor(v) {
    const old = this._armor;
    if (old != null && v < old && this.suitForm.tough < 1) v = old - (old - v) * this.suitForm.tough;
    this._armor = v;
  }
  // set health without the suit's toughness discount (Thanos's snap; the other heroes have their own)
  setHealth(v) { this._armor = clamp(v, 0, 100); }

  line(key, ...a) {
    const L = this.constructor.LINES[key] != null ? this.constructor.LINES[key] : IRON_LINES[key];
    return typeof L === 'function' ? L(...a) : Array.isArray(L) ? pick(L) : L;
  }

  say(text, tone) {
    if (this.w.settings.hudCallouts === false && tone !== 'warn') return;
    // in a crowd of suits only the main one calls out every weapon
    if (this.ally && tone !== 'warn' && tone !== 'radio' && this.w.allies.length > 2) return;
    this.hud.push({ text, tone: tone || 'info', start: now() });
    if (this.hud.length > 3) this.hud.shift();
  }

  setPose(name) { if (this.pose !== name) { this.pose = name; this.poseStart = now(); } }
  ground() { return this.w.groundAt(this.x, this.y); }
  faceTo(p) { if (Math.abs(p.x - this.x) > 3) this.facing = p.x > this.x ? 1 : -1; }
  chest() { return { x: this.x + this.facing * 2 * this.s, y: this.y - 62 * this.s }; }
  reactor() { return { x: this.x + this.facing * 2.4 * this.s, y: this.y - 65.5 * this.s }; }
  shoulder(far) { return { x: this.x + this.facing * (far ? 10 : -10.5) * this.s, y: this.y - 74 * this.s }; }
  palm(tp, far) {
    const sh = this.shoulder(far);
    const dx = tp.x - sh.x, dy = tp.y - sh.y, d = Math.hypot(dx, dy) || 1;
    return { x: sh.x + dx / d * 32 * this.s, y: sh.y + dy / d * 32 * this.s };
  }

  * wait(sec, until) {
    let t = 0;
    while (t < sec) {
      if (until && until()) return false;
      t += this.dt;
      yield;
    }
    return true;
  }

  // ------------------------------------------------------------ runner
  run(gen, name, prio) {
    if (this.inTask) { this.pending = [gen, name, prio]; return; }
    const old = this.task;
    this.task = null;
    if (old) { try { old.return(); } catch (e) { /* */ } }
    this.aim = null; this.charge = 0; this.beamK = 0;
    this.task = gen; this.taskName = name; this.taskPrio = prio || 0;
  }

  interrupt(gen, name, prio) {
    if (this.mode === 'held' || this.mode === 'down') return false;
    // a fight that's already won (only the victory pose left) doesn't block new orders
    const won = this.taskName === 'combat' && !this.w.enemies.length;
    if (this.task && prio < this.taskPrio && !won) return false;
    this.run(gen, name, prio);
    return true;
  }

  // power, armor & ammo over time
  tickMeters(dt) {
    const w = this.w, s = this.s;
    if (this.mode === 'air') this.power -= (this.speed > 250 * s ? 0.8 : 0.45) * dt;
    else if (this.mode === 'ground' && !this.aim && this.pose !== 'unibeam') this.power += (this.pose === 'walk' ? 1.2 : 3) * dt;
    // in a fight the arc reactor runs hot and trickles power back (a long villain fight stays winnable)
    if (w.enemies.length && this.pose !== 'unibeam') this.power += 1.4 * dt;
    if (!w.enemies.length && this.mode !== 'down') this.armor += (this.mode === 'ground' ? 1.4 : 0.5) * dt;
    if (w.now - (this.lastMissileAt || 0) > 6000 && this.missiles < 12) { this.missiles++; this.lastMissileAt = w.now; }
    this.power = clamp(this.power, 0, 100);
    this.armor = clamp(this.armor, 0, 100);
  }

  tick(dt) {
    this.dt = dt;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.tickMeters(dt);

    const px = this.x, py = this.y;
    // frozen in time (Kang): nothing moves until it wears off
    if (this.frozen > 0) {
      this.frozen = Math.max(0, this.frozen - dt);
      if (this.mode === 'ground' || this.mode === 'air') { this.vx = 0; this.vy = 0; this.speed = 0; return; }
      this.frozen = 0;
    }
    if (this.mode === 'held') { this.tickHeld(dt); return; }
    if (this.mode === 'thrown') { this.tickThrown(dt); this.speed = Math.hypot(this.x - px, this.y - py) / dt; return; }
    if (this.mode === 'fall') { this.tickFall(dt); this.speed = Math.hypot(this.x - px, this.y - py) / dt; return; }

    if (!this.task) { const [g, n, p] = this.choose(); this.run(g, n, p); }
    this.inTask = true;
    try {
      const r = this.task.next();
      if (r.done) { this.task = null; this.taskName = null; this.taskPrio = 0; }
    } catch (e) {
      console.error('[hero] task error in', this.taskName, e);
      this.task = null; this.taskName = null; this.taskPrio = 0;
    }
    this.inTask = false;
    if (this.pending) { const [g, n, p] = this.pending; this.pending = null; this.run(g, n, p); }
    // stay on screen; on the floor unless flying
    const g = this.ground();
    if (this.mode === 'ground' || this.mode === 'down') this.y = g;
    else if (this.y > g) { this.y = g; this.vy = Math.min(0, this.vy); }
    this.keepOnScreen();
    this.speed = Math.hypot(this.x - px, this.y - py) / Math.max(dt, 0.001);
  }

  keepOnScreen() {
    const s = this.s, geo = this.w.geo;
    const d = geo.displayAt({ x: this.x, y: this.y - 40 * s }) || geo.nearestDisplay({ x: this.x, y: this.y });
    if (!d) return;
    const top = d.work.y + 100 * s;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    const c = geo.clampBounds({ x: this.x, y: this.y - 40 * s }, 20 * s);
    if (c.x !== this.x) { this.x = c.x; this.vx = 0; }
  }

  // ------------------------------------------------------------ movement
  * walkTo(tx, o = {}) {
    const s = this.s;
    tx = this.w.clampFloorX(tx, this.x, this.y);
    let t = 0;
    while (Math.abs(tx - this.x) > 2) {
      const dir = Math.sign(tx - this.x);
      this.facing = dir;
      const step = Math.min(Math.abs(tx - this.x), 55 * s * this.dt);
      this.x += dir * step;
      this.dist += step;
      this.setPose('walk');
      // heavy footsteps (the Hulkbuster's shake the floor)
      if (this.dist - this.lastStep > this.suitForm.step * s) {
        this.lastStep = this.dist;
        this.w.sound(this.suitForm.body > 1 ? 'thud' : 'clank', this);
        if (this.suitForm.body > 1) this.w.fx('shockwave', this.x, this.y, { size: 0.3 });
      }
      t += this.dt;
      if (t > (o.timeout || 20) || (o.until && o.until())) break;
      yield;
    }
    this.setPose('stand');
  }

  steer(tx, ty, maxSp, accel) {
    const dt = this.dt, s = this.s;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const want = Math.min(maxSp, d * 2.8);
    const wx = d > 0.5 ? (dx / d) * want : 0, wy = d > 0.5 ? (dy / d) * want : 0;
    const dvx = wx - this.vx, dvy = wy - this.vy;
    const dv = Math.hypot(dvx, dvy), a = (accel || 1300 * s) * dt;
    if (dv > a) { this.vx += (dvx / dv) * a; this.vy += (dvy / dv) * a; } else { this.vx = wx; this.vy = wy; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 40 * s && !this.aim) this.facing = this.vx > 0 ? 1 : -1;
    this.airPose();
    return d;
  }

  airPose() {
    if (this.aim) return;
    const s = this.s;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 210 * s && Math.abs(this.vx) > Math.abs(this.vy) * 0.55) this.setPose('fly');
    else if (this.vy < -130 * s && Math.abs(this.vx) < 120 * s) this.setPose('flyUp');
    else this.setPose('hover');
  }

  * takeOff(height) {
    if (this.mode === 'air') return;
    const s = this.s;
    this.setPose('crouch');
    this.w.sound('thrustOn', this);
    yield* this.wait(0.28);
    this.mode = 'air';
    this.vy = -260 * s;
    const target = { x: this.x, y: this.y - (height || rand(140, 240)) * s };
    let t = 0;
    while (t < 1.2 && this.steer(target.x, target.y, 320 * s) > 6) { t += this.dt; yield; }
  }

  * flyTo(p, o = {}) {
    const s = this.s;
    if (this.mode !== 'air') yield* this.takeOff(120);
    const route = this.w.geo.route({ x: this.x, y: this.y - 40 * s }, { x: p.x, y: p.y - 40 * s }, 40 * s).map((q) => ({ x: q.x, y: q.y + 40 * s }));
    let t = 0;
    for (let i = 0; i < route.length; i++) {
      const wp = route[i];
      const last = i === route.length - 1;
      while (this.steer(wp.x, wp.y, (o.speed || 340) * s) > (last ? (o.near || 6) : 30)) {
        t += this.dt;
        if (t > (o.timeout || 25) || (o.until && o.until())) return false;
        yield;
      }
    }
    return true;
  }

  * hoverFor(sec, until) {
    let t = 0;
    const hx = this.x, hy = this.y;
    while (t < sec) {
      if (until && until()) break;
      this.steer(hx, hy, 100 * this.s);
      t += this.dt;
      yield;
    }
  }

  * land(x) {
    const s = this.s;
    if (this.mode === 'ground') return;
    const tx = x == null ? this.x : x;
    const g = this.w.groundAt(tx, this.y);
    const height = g - this.y;
    if (height > 130 * s) {
      // dive down for a superhero landing
      yield* this.flyTo({ x: tx, y: g - 70 * s }, { speed: 420, near: 14 });
      let t = 0;
      while (this.y < this.w.groundAt(this.x, this.y) - 1 && t < 1) {
        this.vy = Math.min(900 * s, this.vy + 2600 * s * this.dt);
        this.vx *= 0.9;
        this.x += this.vx * this.dt; this.y += this.vy * this.dt;
        this.setPose('hover');
        t += this.dt;
        yield;
      }
      this.y = this.w.groundAt(this.x, this.y);
      this.vx = this.vy = 0;
      this.mode = 'ground';
      this.setPose('land');
      this.w.sound('landing', this);
      this.w.fx('shockwave', this.x, this.y, {});
      yield* this.wait(0.95);
      this.setPose('stand');
      yield* this.wait(0.25);
    } else {
      yield* this.flyTo({ x: tx, y: g - 4 * s }, { speed: 220, near: 5 });
      this.y = this.w.groundAt(this.x, this.y);
      this.vx = this.vy = 0;
      this.mode = 'ground';
      this.setPose('stand');
      this.w.sound('clank', this);
      yield* this.wait(0.3);
    }
  }

  // ------------------------------------------------------------ attacks
  aimAt(tp, arm) {
    this.aim = { x: tp.x, y: tp.y };
    this.aimArm = arm || 'near';
    this.faceTo(tp);
  }

  holdPosition() {
    if (this.mode === 'air') this.steer(this.x - this.vx * 0.02, this.y - this.vy * 0.02, 120 * this.s);
  }

  * repulsor(tp, enemy, shots) {
    const w = this.w, s = this.s;
    for (let i = 0; i < (shots || 1); i++) {
      if (enemy && enemy.hp <= 0) break; // someone else got it: lower the arm (aiming blocks recharging)
      const t0 = enemy ? w.enemyCenter(enemy) : tp;
      this.aimAt(t0, 'near');
      this.setPose('aim');
      let t = 0;
      while (t < 0.14) { this.charge = t / 0.14; this.holdPosition(); t += this.dt; yield; }
      if (this.power < 1.5) { this.say('POWER LOW', 'warn'); this.aim = null; return; }
      this.power -= 1.5;
      const target = enemy ? w.enemyCenter(enemy) : tp;
      const from = this.palm(target);
      let to = target;
      let victim = null;
      if (enemy && chance(0.88)) victim = enemy;
      else victim = w.firstEnemyOnLine(from, target, 1.15);
      if (victim) { to = w.enemyCenter(victim); w.damage(victim, 1.7, from); }
      else if (enemy) {
        const ang = Math.atan2(target.y - from.y, target.x - from.x) + rand(-0.12, 0.12);
        to = { x: from.x + Math.cos(ang) * 900 * s, y: from.y + Math.sin(ang) * 900 * s };
      }
      w.addBeam('repulsor', from, to, 0.14, 4.2, this.id);
      w.counters.shotsFired++;
      w.sound('repulsor', this);
      w.fx(victim || !enemy ? 'impact' : 'spark', to.x, to.y, {});
      this.charge = 0;
      t = 0;
      while (t < 0.2) { this.holdPosition(); t += this.dt; yield; }
    }
    this.aim = null;
  }

  * blast(tp) {
    const w = this.w, s = this.s;
    this.aimAt(tp, 'both');
    this.setPose('blast');
    w.sound('charge', this);
    let t = 0;
    while (t < 0.45) { this.charge = t / 0.45; this.holdPosition(); t += this.dt; yield; }
    if (this.power < 6) { this.say('POWER LOW', 'warn'); this.aim = null; return; }
    this.power -= 6;
    this.cd.blast = 3;
    const from = this.palm(tp);
    const ang = Math.atan2(tp.y - from.y, tp.x - from.x);
    const reach = 210 * s;
    for (const e of [...w.enemies]) {
      const c = w.enemyCenter(e);
      const dx = c.x - from.x, dy = c.y - from.y, d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - ang;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      if (d < reach + ENEMY[e.kind].r * s && Math.abs(da) < 0.65) {
        w.damage(e, 5, from);
        if (e.air) { e.vx += Math.cos(ang) * 360 * s; e.vy += Math.sin(ang) * 360 * s; }
      }
    }
    w.addBeam('blast', from, { x: from.x + Math.cos(ang) * reach, y: from.y + Math.sin(ang) * reach }, 0.3, 16, this.id);
    w.sound('blast', this);
    w.fx('flash', from.x, from.y, { size: 1.6 });
    if (this.mode === 'air') { this.vx -= Math.cos(ang) * 140 * s; this.vy -= Math.sin(ang) * 140 * s; }
    this.charge = 0;
    t = 0;
    while (t < 0.35) { this.holdPosition(); t += this.dt; yield; }
    this.aim = null;
  }

  * missileBarrage(targets) {
    const w = this.w, s = this.s;
    if (this.missiles < 1) { this.say('MISSILES DEPLETED', 'warn'); return; }
    this.aim = null;
    this.setPose('missile');
    this.say('MISSILES AWAY');
    let t = 0;
    while (t < 0.3) { this.holdPosition(); t += this.dt; yield; }
    const n = Math.min(this.missiles, Math.max(3, Math.min(6, targets.length * 2)));
    for (let i = 0; i < n; i++) {
      const tg = targets[i % targets.length];
      const far = i % 2 === 1;
      const sh = this.shoulder(far);
      const up = -rand(240, 340) * s;
      w.addShot({ kind: 'missile', owner: 'hero', x: sh.x, y: sh.y - 6 * s, vx: this.facing * rand(40, 140) * s, vy: up, target: tg.id || null, tp: tg.id ? null : { x: tg.x, y: tg.y }, dmg: 3, life: 4, speed: 140 * s });
      this.missiles--;
      w.counters.missiles++;
      w.sound('missile', this);
      t = 0;
      while (t < 0.09) { this.holdPosition(); t += this.dt; yield; }
    }
    this.cd.missiles = 6;
    t = 0;
    while (t < 0.35) { this.holdPosition(); t += this.dt; yield; }
  }

  * unibeam(tp) {
    const w = this.w, s = this.s;
    this.aim = null;
    this.faceTo(tp);
    this.setPose('unibeam');
    this.say('UNIBEAM');
    w.sound('chargeLong', this);
    let t = 0;
    while (t < 0.7) { this.charge = t / 0.7; this.holdPosition(); t += this.dt; yield; }
    if (this.power < 20) { this.say('POWER LOW', 'warn'); this.charge = 0; return; }
    this.power -= 22;
    this.cd.unibeam = 10;
    w.counters.unibeams++;
    const from = this.reactor();
    let ang = Math.atan2(tp.y - from.y, tp.x - from.x);
    // the chest faces forward: keep the beam in the front half
    if (Math.cos(ang) * this.facing < 0.2) ang = Math.atan2(Math.sin(ang), this.facing * 0.3);
    const beam = w.addBeam('unibeam', from, from, 1.1, 13, this.id);
    w.sound('unibeam', this);
    t = 0;
    while (t < 1.1) {
      const f = this.reactor();
      const end = { x: f.x + Math.cos(ang) * 1600 * s, y: f.y + Math.sin(ang) * 1600 * s };
      beam.x1 = f.x; beam.y1 = f.y; beam.x2 = end.x; beam.y2 = end.y;
      for (const e of [...w.enemies]) {
        const c = w.enemyCenter(e);
        if (segDist(c, f, end) < (ENEMY[e.kind].r + 12) * s) w.damage(e, 14 * this.dt, f, true);
      }
      this.beamK = 1;
      this.holdPosition();
      t += this.dt;
      yield;
    }
    this.beamK = 0;
    this.charge = 0;
    yield* this.wait(0.3);
  }

  * punch(e) {
    const w = this.w, s = this.s;
    const c = w.enemyCenter(e);
    this.faceTo(c);
    this.setPose('punch');
    yield* this.wait(0.16);
    if (e.hp > 0 && dist(c, this.chest()) < 90 * s) {
      const F = this.suitForm;
      w.damage(e, F.punch, this.chest()); // Mark 50: a nano-blade; Hulkbuster: a fist the size of a car
      w.sound('hit', e);
      if (F.body > 1 && e.hp > 0 && w.launchEnemy) w.launchEnemy(e, this.facing * 640 * s, -360 * s, { dmg: 2 });
      else if (e.air) { e.vx += this.facing * 420 * s; e.vy -= 120 * s; }
      if (F.body > 1) w.fx('shockwave', c.x, c.y, { size: 0.8 });
    }
    yield* this.wait(0.25);
  }

  // ------------------------------------------------------------ brain
  choose() {
    const w = this.w, s = this.s;
    if (this.mode === 'down') return [this.taskReboot(), 'reboot', 99];
    if (w.nuke && !w.nuke.passed) return [this.taskEvacuate(), 'evacuate', 98];
    if (this.ally) {
      if (w.enemies.length && !w.quiet) return [this.taskCombat(), 'combat', 80];
      return [this.taskAllyLeave(), 'leave', 70];
    }
    if (w.quiet) return [this.taskQuiet(), 'quiet', 95];
    if (w.announcement) return [this.taskAnnounce(), 'announce', 96];
    if (w.enemies.length && (w.settings.autoDefend !== false || w.lockId)) return [this.taskCombat(), 'combat', 80];
    if (this.mode === 'air') {
      if (this.power < 18 || chance(0.6)) return [this.land(), 'land', 30];
      return [this.taskPatrol(), 'patrol', 20];
    }
    if (this.power < 35) return [this.taskRecharge(), 'recharge', 25];
    const opts = [];
    const add = (wt, fn, name) => { if (wt > 0) opts.push([wt, fn, name]); };
    add(3, () => this.taskIdle(rand(3, 7)), 'idle');
    add(1.6, () => this.taskIdle(rand(3, 6), 'idleLook'), 'look');
    add(0.7, () => this.taskIdle(rand(2.5, 4), 'gauntlet'), 'gauntlet');
    add(2, () => this.taskStroll(), 'stroll');
    add(1.3, () => this.taskPatrol(), 'patrol');
    add(0.6, () => this.taskFlyBy(), 'flyby');
    add(0.6, () => this.taskScan(), 'scan');
    add(0.9, () => this.taskHop(), 'hover');
    add(w.geo.displays.length > 1 ? 0.7 : 0, () => this.taskVisit(), 'visit');
    add(0.3, () => this.taskGreet(false), 'wave');
    add(0.12, () => this.taskDiagnostics(), 'diag');
    let r = Math.random() * opts.reduce((a, o) => a + o[0], 0);
    for (const [wt, fn, name] of opts) { r -= wt; if (r <= 0) return [fn(), name, 10]; }
    return [this.taskIdle(3), 'idle', 10];
  }

  * taskIdle(dur, pose) {
    if (this.mode === 'air') yield* this.land();
    this.setPose(pose || 'stand');
    if (pose === 'gauntlet' && chance(0.5)) this.say(pick(['CALIBRATING…', 'REPULSOR CHECK', 'GAUNTLET OK']));
    yield* this.wait(dur);
    this.setPose('stand');
  }

  * taskRecharge() {
    if (this.mode === 'air') yield* this.land();
    this.setPose('stand');
    this.say('RECHARGING');
    yield* this.wait(60, () => this.power >= 95);
  }

  * taskStroll() {
    if (this.mode === 'air') yield* this.land();
    const s = this.s;
    const d = this.w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || this.w.geo.primary;
    const tx = clamp(this.x + rand(-380, 380) * s, d.work.x + 40 * s, d.work.x + d.work.width - 40 * s);
    yield* this.walkTo(tx);
    yield* this.wait(rand(0.5, 1.5));
  }

  airPoint(margin, near, radius) {
    const s = this.s;
    const p = this.w.geo.randomPoint(margin || 120 * s, near, radius);
    const d = this.w.geo.displayAt(p) || this.w.geo.primary;
    return { x: p.x, y: clamp(p.y, d.work.y + 130 * s, d.work.y + d.work.height - 120 * s) };
  }

  * taskPatrol() {
    const s = this.s;
    const n = Math.floor(rand(2, 5));
    for (let i = 0; i < n; i++) {
      const p = this.airPoint(140 * s, { x: this.x, y: this.y }, rand(300, 700) * s);
      yield* this.flyTo(p, { speed: rand(300, 460), near: 30, timeout: 10 });
    }
    yield* this.hoverFor(rand(0.6, 1.5));
    yield* this.land(this.x + rand(-120, 120) * s);
  }

  * taskFlyBy() {
    const s = this.s, w = this.w;
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    const left = this.x > d.work.x + d.work.width / 2;
    const y = d.work.y + rand(0.25, 0.55) * d.work.height;
    yield* this.takeOff(140);
    yield* this.flyTo({ x: left ? d.work.x + 120 * s : d.work.x + d.work.width - 120 * s, y }, { speed: 560, near: 40, timeout: 8 });
    yield* this.land();
  }

  * taskHop() {
    yield* this.takeOff(rand(80, 160));
    yield* this.hoverFor(rand(1.5, 3));
    yield* this.land();
  }

  * taskScan() {
    const w = this.w;
    yield* this.takeOff(rand(120, 200));
    this.say('SCANNING…');
    w.fx('scan', this.x, this.y - 55 * this.s, {});
    yield* this.hoverFor(2.2);
    this.say(pick(['NO THREATS DETECTED', 'PERIMETER CLEAR', 'ALL QUIET']));
    yield* this.hoverFor(1);
    yield* this.land();
  }

  * taskVisit() {
    const w = this.w, s = this.s;
    const here = w.geo.displayAt({ x: this.x, y: this.y - 40 * s });
    const others = w.geo.displays.filter((d) => d !== here);
    if (!others.length) return;
    const d = pick(others);
    const tx = d.work.x + rand(0.2, 0.8) * d.work.width;
    yield* this.flyTo({ x: tx, y: d.work.y + d.work.height * 0.45 }, { speed: 460, near: 30, timeout: 15 });
    yield* this.land();
  }

  * taskGreet(byUser) {
    const w = this.w;
    if (this.mode === 'air') { this.faceTo(w.cursor); this.setPose('hover'); }
    else {
      this.faceTo(w.cursor);
      this.setPose(chance(0.5) ? 'thumbsUp' : 'salute');
    }
    if (byUser) {
      const recent = this.clicks.filter((t) => now() - t < 3000).length;
      this.say(recent >= 4 ? this.line('poke') : this.line('greet'), recent >= 4 ? 'warn' : null);
      w.sound('hudBeep', this);
    }
    if (this.mode === 'air') yield* this.hoverFor(1.4); else yield* this.wait(1.4);
    if (this.mode !== 'air') this.setPose('stand');
  }

  * taskDiagnostics() {
    const w = this.w;
    if (this.mode === 'air') yield* this.hoverFor(0.5);
    this.setPose(this.mode === 'air' ? 'hover' : 'gauntlet');
    w.showDiagnostics();
    w.sound('hudBeep', this);
    if (this.mode === 'air') yield* this.hoverFor(7); else yield* this.wait(7);
    this.setPose('stand');
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
    this.say('STANDBY MODE');
    while (w.quiet) yield;
    this.setPose('stand');
    this.say('SYSTEMS ONLINE');
    w.sound('reboot', this);
    yield* this.wait(0.8);
  }

  * taskAnnounce() {
    const w = this.w, s = this.s;
    const a = w.announcement;
    if (!a) return;
    const d = w.geo.primary;
    const spot = { x: d.work.x + d.work.width / 2, y: d.work.y + d.work.height * 0.62 };
    this.say('INCOMING MESSAGE');
    w.sound('alert', this);
    yield* this.flyTo(spot, { speed: 520, near: 8, timeout: 12 });
    a.arrived = true;
    this.faceTo({ x: spot.x - 100, y: spot.y });
    this.facing = 1;
    w.dirty();
    while (w.announcement === a) {
      this.steer(spot.x, spot.y, 80 * s);
      this.setPose(this.w.now - a.start < 2500 ? 'salute' : 'hover');
      yield;
    }
    this.say(pick(['ROGER THAT.', 'GOOD. BACK TO WORK.', 'NOTED.']));
    yield* this.hoverFor(0.8);
    yield* this.land();
  }

  * taskReboot() {
    const w = this.w, s = this.s;
    this.aim = null; this.charge = 0; this.beamK = 0;
    this.say('SUIT OFFLINE', 'warn');
    w.sound('powerDown', this);
    if (this.mode === 'air' || this.y < this.ground() - 2) {
      this.mode = 'fall';
      while (this.mode === 'fall') yield; // tickFall handles the drop
    }
    this.mode = 'down';
    this.setPose('down');
    this.eyes = 0;
    let t = 0;
    while (t < 5) {
      if (chance(0.06)) w.fx('spark', this.x + rand(-20, 20) * s, this.y - rand(5, 20) * s, {});
      t += this.dt;
      yield;
    }
    this.say('REBOOTING…');
    w.sound('reboot', this);
    t = 0;
    while (t < 1.2) { this.eyes = (Math.floor(t * 10) % 2) ? 1 : 0.2; t += this.dt; yield; }
    this.eyes = 1;
    this.armor = Math.max(this.armor, 35);
    this.mode = 'ground';
    this.setPose('crouch');
    yield* this.wait(0.5);
    this.setPose('stand');
    this.say('BACK ONLINE');
    yield* this.wait(0.5);
  }

  * taskArrive() {
    const w = this.w, s = this.s;
    const d = w.geo.primary;
    this.x = d.work.x + d.work.width * rand(0.35, 0.65);
    this.y = d.work.y + 60 * s;
    this.mode = 'air';
    this.vx = 0; this.vy = 300 * s;
    this.setPose('hover');
    w.sound('thrustOn', this);
    yield* this.land(this.x);
    this.say('SYSTEMS ONLINE');
    w.sound('reboot', this);
    yield* this.wait(0.4);
    this.setPose('thumbsUp');
    yield* this.wait(1.4);
    this.setPose('stand');
  }

  * taskCombat() {
    const w = this.w, s = this.s;
    this.say(w.enemies.some(isBoss) ? this.line('heavyThreat') : this.line('threat'), 'warn');
    w.sound('alert', this);
    let engaged = 0;
    while (w.enemies.length) {
      if (w.announcement) return;
      const target = w.pickTarget(this);
      if (!target) { yield; continue; }
      this.targetId = target.id;
      const tc = w.enemyCenter(target);
      const anyAir = w.enemies.some((e) => e.air);
      // power management: land and recharge a bit when nearly empty
      if (this.power < 6) {
        this.say('POWER CRITICAL', 'warn');
        this.aim = null; this.charge = 0; // the reactor only recharges while not aiming
        if (this.mode === 'air') yield* this.land();
        this.setPose('stand');
        yield* this.wait(3, () => this.power > 30);
        continue;
      }
      // get into position
      const dx = this.x - tc.x;
      const side = Math.abs(dx) < 40 * s ? (chance(0.5) ? 1 : -1) : Math.sign(dx);
      const range = (ENEMY[target.kind].giant ? 520 : isBoss(target) ? 380 : 260) * s;
      // each suit of the Legion keeps its own slot so they don't stack up
      const slot = this.ally ? w.allies.indexOf(this) + 1 : 0;
      const sx = side * Math.floor(slot / 3) * 70 * s, sy = ((slot % 3) - (slot % 3 === 2 ? 3 : 0)) * 80 * s;
      if (anyAir || this.mode === 'air' || chance(0.25)) {
        if (this.mode !== 'air') yield* this.takeOff(rand(120, 200));
        const d = w.geo.displayAt(tc) || w.geo.nearestDisplay(tc);
        const want = {
          x: clamp(tc.x + side * range + sx, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s),
          y: clamp((target.air ? tc.y : tc.y - 90 * s) - rand(20, 90) * s + 60 * s + sy, d.work.y + 130 * s, w.groundAt(tc.x, tc.y) - 20 * s),
        };
        let t = 0;
        const moveFor = rand(0.4, 1);
        while (t < moveFor && w.enemies.includes(target)) { this.steer(want.x, want.y, 360 * s); t += this.dt; yield; }
      } else {
        const d = w.geo.displayAt({ x: tc.x, y: tc.y - 10 }) || w.geo.nearestDisplay(tc);
        const tx = clamp(tc.x + side * range + sx + side * (slot % 3) * 45 * s, d.work.x + 40 * s, d.work.x + d.work.width - 40 * s);
        if (Math.abs(tx - this.x) > 80 * s) {
          if (w.groundAt(tx, tc.y) !== this.ground() || Math.abs(tx - this.x) > 500 * s) { yield* this.flyTo({ x: tx, y: w.groundAt(tx, tc.y) - 120 * s }, { speed: 420, near: 30, timeout: 6 }); yield* this.land(tx); }
          else yield* this.walkTo(tx, { timeout: 2.5 });
        }
      }
      if (!w.enemies.includes(target)) continue;
      // dodge incoming fire
      const threat = w.incomingThreat(this);
      if (threat && this.cd.dodge <= 0 && chance(0.45)) {
        this.cd.dodge = 1.2;
        if (this.mode !== 'air') yield* this.takeOff(90);
        const dodgeY = this.y + (chance(0.5) ? -1 : 1) * 110 * s;
        let t = 0;
        while (t < 0.35) { this.steer(this.x - this.facing * 40 * s, dodgeY, 560 * s, 3000 * s); t += this.dt; yield; }
      }
      // pick a weapon
      const t2 = w.enemyCenter(target);
      const dd = dist(t2, this.chest());
      const lineCount = w.enemiesInCone(this, t2, 0.25).length;
      engaged++;
      if (this.cd.unibeam <= 0 && this.power > 32 && (isBoss(target) || lineCount >= 3) && engaged > 1) {
        yield* this.unibeam(t2);
      } else if (this.cd.missiles <= 0 && this.missiles >= 2 && (w.enemies.length >= 3 || target.kind === 'tank' || isBoss(target))) {
        yield* this.missileBarrage(w.enemies.slice().sort((a, b) => dist(w.enemyCenter(a), this) - dist(w.enemyCenter(b), this)).slice(0, 4));
      } else if (dd < 70 * s) {
        yield* this.punch(target);
      } else if (dd < 190 * s && this.cd.blast <= 0 && this.power > 12) {
        yield* this.blast(t2);
      } else {
        yield* this.repulsor(t2, target, Math.floor(rand(2, 4)));
      }
    }
    // victory
    if (this.ally) return;
    this.say(this.line('victory'));
    if (this.mode === 'air') yield* this.land();
    this.setPose('thumbsUp');
    yield* this.wait(1.6);
    this.setPose('stand');
  }

  * taskAttackAt(kind, p) {
    const w = this.w, s = this.s;
    const near = w.enemies.filter((e) => dist(w.enemyCenter(e), p) < 120 * s);
    if (kind === 'missiles') {
      yield* this.missileBarrage(near.length ? near : [{ x: p.x, y: p.y }]);
    } else if (kind === 'unibeam') {
      yield* this.unibeam(p);
    } else if (kind === 'blast') {
      if (dist(p, this.chest()) > 200 * s) {
        const side = this.x < p.x ? -1 : 1;
        yield* this.flyTo({ x: p.x + side * 150 * s, y: Math.min(this.w.groundAt(p.x, p.y), p.y + 62 * s) }, { speed: 480, near: 20, timeout: 5 });
      }
      yield* this.blast(p);
    } else {
      yield* this.repulsor(p, near[0] || null, 2);
    }
    yield* this.wait(0.4);
  }

  // ------------------------------------------------------------ nuke: evacuate, get thrown, recover
  * taskEvacuate() {
    const w = this.w, s = this.s;
    const n = w.nuke;
    if (!n) return;
    this.aim = null; this.charge = 0; this.beamK = 0;
    this.say(this.ally ? this.line('evacuateAlly') : this.line('evacuate'), 'warn');
    const spot = w.safeSpot(this);
    if (this.mode !== 'air') yield* this.takeOff(110);
    yield* this.flyTo(spot, { speed: 820, near: 26, timeout: 7, until: () => !w.nuke || w.nuke.detonated && w.nukeRadius() > dist(this.chest(), w.nuke) - 300 * s });
    // touch down if there's still time, then brace
    if (w.nuke && !w.nuke.detonated && this.y < this.ground() - 6 * s) {
      const g = this.ground();
      let t = 0;
      while (this.y < g - 2 && t < 1.2 && w.nuke && !w.nuke.detonated) { this.steer(this.x, g, 420 * s, 2400 * s); t += this.dt; yield; }
      if (this.y >= g - 6 * s) { this.y = g; this.vx = this.vy = 0; this.mode = 'ground'; }
    }
    this.setPose(this.mode === 'air' ? 'hover' : 'brace');
    this.say(this.line('brace'), 'warn');
    while (w.nuke && !w.nuke.passed) {
      if (this.mode === 'air') this.steer(this.x, this.y, 60 * s);
      else this.setPose('brace');
      yield;
    }
  }

  // hit by a shockwave: tumble through the air
  throwBy(vx, vy, dmg) {
    if (this.mode === 'down') { this.armor = Math.max(0, this.armor - dmg); return; }
    this.pending = null;
    if (this.task) { try { this.task.return(); } catch (e) { /* */ } }
    this.task = null; this.taskName = null; this.taskPrio = 0;
    this.aim = null; this.charge = 0; this.beamK = 0;
    if (this.mode === 'held' && this.w.press) this.w.press = null;
    this.mode = 'thrown';
    this.vx = vx; this.vy = vy;
    this.spin = 0;
    this.spinV = (vx >= 0 ? 1 : -1) * rand(9, 15);
    this.armor = Math.max(0, this.armor - dmg);
    this.hitAt = now();
    this.say(this.line('thrown'), 'warn');
  }

  tickThrown(dt) {
    const w = this.w, s = this.s, geo = w.geo;
    this.vy += 1500 * s * dt;
    const k = Math.exp(-0.5 * dt);
    this.vx *= k;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.spin += this.spinV * dt;
    this.spinV *= Math.exp(-0.7 * dt);
    this.setPose('stagger');
    // bounce off the outer edges of the screens
    const c = geo.clampBounds({ x: this.x, y: this.y - 40 * s }, 24 * s);
    if (c.x !== this.x) { this.x = c.x; this.vx = -this.vx * 0.35; this.spinV = -this.spinV * 0.6; w.sound('hit', this); }
    const d = geo.displayAt({ x: this.x, y: this.y - 40 * s }) || geo.nearestDisplay(this);
    if (d && this.y < d.work.y + 100 * s) { this.y = d.work.y + 100 * s; this.vy = Math.abs(this.vy) * 0.3; }
    const g = this.ground();
    if (this.y >= g) {
      this.y = g;
      if (this.vy > 520 * s) {
        // bounce once or twice
        this.vy = -this.vy * 0.32;
        this.vx *= 0.6;
        this.spinV *= 0.55;
        w.fx('shockwave', this.x, this.y, { size: 0.6 });
        w.sound('landing', this);
      } else {
        this.vx = this.vy = 0;
        this.spin = 0; this.spinV = 0;
        this.mode = 'ground';
        w.fx('shockwave', this.x, this.y, { size: 0.5 });
        if (this.armor <= 0) {
          if (this.ally) { w.destroyAlly(this); return; }
          w.counters.reboots++;
          this.run(this.taskReboot(), 'reboot', 99);
        } else this.run(this.taskRecover(), 'recover', 90);
      }
    }
  }

  * taskRecover() {
    this.setPose('down');
    this.eyes = 1;
    yield* this.wait(0.9);
    this.setPose('crouch');
    yield* this.wait(0.45);
    this.setPose('stand');
    this.say(this.line('recover'));
    yield* this.wait(0.6);
  }

  // ------------------------------------------------------------ Iron Legion (allies)
  * taskAllyArrive(target) {
    const s = this.s;
    this.say(this.line('allyArrive', this.callsign), 'radio');
    yield* this.flyTo(target, { speed: 620, near: 40, timeout: 5 });
  }

  * taskAllyLeave() {
    const w = this.w, s = this.s;
    if (w.nuke) { yield* this.hoverFor(1); return; }
    this.aim = null;
    if (this.mode !== 'air') yield* this.takeOff(120);
    this.faceTo(w.hero);
    this.setPose('salute');
    this.say(this.line('allyLeave'), 'radio');
    let t = 0;
    while (t < 1.3) { this.steer(this.x, this.y, 60 * s); this.setPose('salute'); t += this.dt; yield; }
    const d = w.geo.displayAt({ x: this.x, y: this.y - 40 * s }) || w.geo.primary;
    const exit = { x: clamp(this.x + rand(-200, 200) * s, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s), y: d.work.y + 100 * s };
    yield* this.flyTo(exit, { speed: 700, near: 30, timeout: 4 });
    w.removeAlly(this, true);
  }

  // ------------------------------------------------------------ held / falling
  startHold() {
    if (this.mode === 'down') return;
    this.pending = null;
    if (this.task) { try { this.task.return(); } catch (e) { /* */ } }
    this.task = null; this.taskName = null; this.taskPrio = 0;
    this.aim = null; this.charge = 0; this.beamK = 0;
    this.mode = 'held';
    this.setPose('held');
    this.swing = 0; this.swingV = 0;
    this.say(this.line('held'));
  }

  tickHeld(dt) {
    const w = this.w, s = this.s;
    this.x = w.cursor.x; this.y = w.cursor.y + 100 * s;
    const L = 50 * s, g = 1900 * s;
    const acc = -(g / L) * Math.sin(this.swing) - 6 * this.swingV - (clamp(w.cursorAcc.x, -9000 * s, 9000 * s) / L) * Math.cos(this.swing) * 0.35;
    this.swingV += acc * dt;
    this.swing = clamp(this.swing + this.swingV * dt, -0.6, 0.6);
  }

  release() {
    if (this.mode !== 'held') return;
    const w = this.w, s = this.s;
    this.vx = clamp(w.cursorVel.x * 0.5, -900 * s, 900 * s);
    this.vy = clamp(w.cursorVel.y * 0.5, -900 * s, 900 * s);
    this.swing = 0;
    if (this.power > 5) {
      // catches himself with the thrusters
      this.mode = 'air';
      this.w.sound('thrustOn', this);
      this.run(this.taskStabilize(), 'stabilize', 60);
    } else {
      this.mode = 'fall';
      this.run(this.taskAfterFall(), 'fall', 60);
    }
  }

  * taskStabilize() {
    const s = this.s;
    const hx = this.x + this.vx * 0.25, hy = Math.min(this.y + this.vy * 0.25, this.ground() - 30 * s);
    let t = 0;
    while (t < 0.9) { this.steer(hx, hy, 300 * s, 1600 * s); t += this.dt; yield; }
    this.say(pick(['STABILIZED.', 'THANKS FOR THE LIFT.', 'SMOOTH.']));
    yield* this.hoverFor(0.6);
  }

  * taskAfterFall() {
    while (this.mode === 'fall') yield;
    this.setPose('land');
    this.w.sound('landing', this);
    this.w.fx('shockwave', this.x, this.y, {});
    yield* this.wait(1);
    this.setPose('stand');
  }

  tickFall(dt) {
    const s = this.s;
    this.vy += 2200 * s * dt;
    this.vx *= Math.exp(-1 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.setPose('stagger');
    const g = this.ground();
    if (this.y >= g) {
      this.y = g; this.vx = this.vy = 0;
      this.mode = 'ground';
      this.w.sound('landing', this);
      this.w.fx('shockwave', this.x, this.y, {});
    }
    this.keepOnScreen();
    if (this.task) {
      this.inTask = true;
      try { const r = this.task.next(); if (r.done) { this.task = null; this.taskName = null; this.taskPrio = 0; } } catch (e) { this.task = null; }
      this.inTask = false;
    }
  }

  statusText() {
    const w = this.w;
    if (w.quiet) return 'standby';
    if (this.mode === 'thrown') return 'hit by the shockwave';
    if (w.nuke && !w.nuke.passed) return 'evacuating — nuke inbound';
    if (w.army) return `army battle · legion ×${w.allies.length}`;
    if (this.mode === 'down') return 'suit offline — rebooting';
    if (this.mode === 'held') return 'being carried';
    if (w.enemies.length) return 'combat mode';
    if (this.armor < 30) return 'armor damaged';
    if (this.power < 25) return 'low power';
    if (this.mode === 'air') return 'flying';
    return 'systems nominal';
  }

  // ------------------------------------------------------------ what this hero offers the UI
  // Bars for the menu, the hover card and the home window (v = 0..100).
  meters() {
    return [
      { k: 'power', label: 'Arc reactor', short: 'PWR', icon: '⚡', v: this.power, color: '#4fd8ff' },
      { k: 'armor', label: 'Armor', short: 'ARM', icon: '🛡️', v: this.armor, color: '#ffd166' },
      { k: 'missiles', label: 'Missiles', short: 'MSL', icon: '🚀', v: (this.missiles / 12) * 100, color: '#ff7a6b' },
    ];
  }

  // Hero-specific commands (the world handles enemies, armies, the nuke and quiet mode).
  onCommand(name, at, a, free) {
    const w = this.w, s = this.s;
    switch (name) {
      case 'attack':
        if (free) this.interrupt(this.taskAttackAt(a.kind || 'repulsor', at), 'attack', 85);
        break;
      case 'takeoff': if (free && this.mode !== 'air') this.interrupt(this.taskHop(), 'hover', 50); break;
      case 'land': if (free && this.mode === 'air') this.interrupt(this.land(), 'land', 50); break;
      case 'flyTo':
      case 'call':
        if (free) this.interrupt((function* () { yield* this.flyTo(at, { speed: 480, near: 10 }); yield* this.hoverFor(1.2); yield* this.land(); }).call(this), 'flyTo', 50);
        break;
      case 'patrol': if (free) this.interrupt(this.taskPatrol(), 'patrol', 50); break;
      case 'flyby': if (free) this.interrupt(this.taskFlyBy(), 'flyby', 50); break;
      case 'scan': if (free) this.interrupt(this.taskScan(), 'scan', 50); break;
      case 'diagnostics': if (free) this.interrupt(this.taskDiagnostics(), 'diag', 50); break;
      case 'thumbsUp': if (free) this.interrupt(this.taskGreet(false), 'greet', 50); break;
      case 'repair':
        this.armor = 100; this.say('ARMOR RESTORED'); w.fx('repair', this.x, this.y - 50 * s, {}); w.sound('reboot', this);
        break;
      case 'recharge':
        this.power = 100; this.missiles = 12; this.say('ARC REACTOR AT 100%'); w.fx('flash', this.x + this.facing * 2 * s, this.y - 65 * s, { size: 1.4 }); w.sound('chargeLong', this);
        break;
      default: return false;
    }
    return true;
  }

  // The hero part of the right-click menu (plain data; the overlay adds the common items).
  menuItems() {
    const h = this, w = this.w;
    const air = h.mode === 'air';
    return [
      {
        icon: '💥', label: 'Attack here',
        sub: [
          { icon: '✋', label: 'Repulsor blast', cmd: 'attack', args: { kind: 'repulsor' } },
          { icon: '🚀', label: `Micro-missiles (${h.missiles})`, cmd: 'attack', args: { kind: 'missiles' }, disabled: h.missiles < 1 },
          { icon: '🔆', label: 'Unibeam (arc reactor)', cmd: 'attack', args: { kind: 'unibeam' }, disabled: h.power < 20, hint: 'chest beam' },
          { icon: '👐', label: 'Double hand blast', cmd: 'attack', args: { kind: 'blast' } },
        ],
      },
      {
        icon: '🛫', label: 'Flight',
        sub: [
          air ? { icon: '🛬', label: 'Land', cmd: 'land' } : { icon: '🛫', label: 'Take off & hover', cmd: 'takeoff' },
          { icon: '📍', label: 'Fly here', cmd: 'flyTo' },
          { icon: '🔄', label: 'Patrol the screens', cmd: 'patrol' },
          { icon: '💨', label: 'Fly-by', cmd: 'flyby' },
          { icon: '📡', label: 'Scan the area', cmd: 'scan' },
        ],
      },
      {
        icon: '🦾', label: 'Suit', badge: h.armor < 30 || h.power < 20 ? '!' : null,
        sub: [
          { icon: '🛠️', label: `Repair armor (${Math.round(h.armor)}%)`, cmd: 'repair' },
          { icon: '⚡', label: `Recharge reactor (${Math.round(h.power)}%)`, cmd: 'recharge', hint: 'also reloads missiles' },
          { icon: '👍', label: 'Thumbs up', cmd: 'thumbsUp' },
          { icon: '🦾', label: w.allies.length ? `Dismiss the Legion (${w.allies.length})` : 'Call the Iron Legion', cmd: w.allies.length ? 'dismissAllies' : 'callAllies', args: { count: 3 } },
          { icon: '🖥️', label: 'Run diagnostics', cmd: 'diagnostics', hint: 'CPU · memory · battery' },
          '-',
          ...Object.entries(SUIT_FORMS).map(([k, f]) => ({ icon: SUIT_ICONS[k], label: f.label, cmd: 'setting', args: { key: 'suit', value: k }, checked: (SUIT_FORMS[w.settings.suit] ? w.settings.suit : 'classic') === k, hint: SUIT_HINTS[k] })),
        ],
      },
    ];
  }

  // a few quick commands for the tray menu: [label, cmd, args]
  trayItems() {
    return [['Patrol the screens', 'patrol'], ['Repair & recharge', 'repair+recharge']];
  }

  // hero-specific fields for the renderer (merged into the hero snapshot): the suit, and a bigger suit draws bigger
  snapExtra() {
    if (this.constructor !== Hero) return null;
    return { suit: this.suitKey, ...(this.bodyScale !== Hero.BODY ? { body: this.bodyScale } : {}) };
  }

  serialize() { return { power: this.power, armor: this.armor, missiles: this.missiles, x: this.x, y: this.y }; }
}

const SUIT_ICONS = { classic: '🔴', mark50: '✨', hulkbuster: '🦍' };
const SUIT_HINTS = { classic: 'the original', mark50: 'nano blades · tougher', hulkbuster: 'huge · smashes · very tough' };

// ---- class-level description of the armored hero (subclasses replace these)
Hero.ID = 'ironman';
Hero.NAME = 'Iron Man';
Hero.BODY = 1;           // body size relative to the armored hero
Hero.LINES = IRON_LINES;
// home window: quick commands [icon, label, cmd, args], record [counter, label], guide [[title, html]]
Hero.UI = {
  title: 'STARK INDUSTRIES',
  quick: [['🔄', 'Patrol', 'patrol'], ['💨', 'Fly-by', 'flyby'], ['📡', 'Scan', 'scan'], ['🖥️', 'Diagnostics', 'diagnostics'], ['🛠️', 'Repair', 'repair'], ['⚡', 'Recharge', 'recharge'], ['🦾', 'Call Legion', 'callAllies', { count: 3 }], ['👋', 'Dismiss Legion', 'dismissAllies']],
  stats: [['kills', 'threats down'], ['drones', 'Ultron drones'], ['walkers', 'Ultron soldiers'], ['tanks', 'Ultron heavies'], ['bosses', 'villains beaten'], ['thanos', 'Thanos'], ['doom', 'Doctor Doom'], ['kang', 'Kang'], ['galactus', 'Galactus'], ['armiesWon', 'armies beaten'], ['nukes', 'nukes dropped'], ['legion', 'legion suits called'], ['waves', 'waves cleared'], ['shotsFired', 'repulsor shots'], ['missiles', 'missiles fired'], ['reboots', 'suit reboots']],
  // the three suits (the other color schemes are worn by the Iron Legion)
  looks: { key: 'suit', options: [['classic', 'Mark III — Classic', 'linear-gradient(135deg,#c41f2a 55%,#f2b134 55%)'], ['mark50', 'Mark 50 — Nanotech', 'linear-gradient(135deg,#a8101c 40%,#f5c542 40% 70%,#a8101c 70%)'], ['hulkbuster', 'Hulkbuster', 'radial-gradient(circle at 50% 45%,#e9fbff 0 18%,#c41f2a 19% 62%,#f2b134 63%)']] },
  armyNote: (n, size) => (size === 'legendary' ? 'All 7 Iron Legion suits join, with replacements when one goes down. About 4 minutes of war.' : `Iron Man will call ${n} more suits from the Iron Legion.`),
  help: [
    ['🖱️ The menu', 'Right-click anywhere (or on Iron Man) for the suit menu. Tray icon and <b class="sc"></b> work too.'],
    ['🎯 Enemies', '<i>Deploy enemy</i> drops Ultron\'s robots — a flying sentry, a soldier, a heavy or a swarm — or a supervillain: <b>Thanos</b>, <b>Doctor Doom</b>, <b>Kang the Conqueror</b>, or the giant <b>Galactus</b>, exactly where you right-clicked. Iron Man engages automatically. Click an enemy to lock it as his priority target.'],
    ['💥 Weapons', 'Repulsors (palm blasts), double hand blast for close range, homing micro-missiles from the shoulders, and the arc-reactor unibeam that cuts through a whole line. <i>Attack here</i> fires at the spot you right-clicked.'],
    ['🦾 Three suits', 'Pick one from <i>Suit</i> in the menu or in Settings: the <b>Mark III</b> classic; the <b>Mark 50</b> nanotech suit — sleeker, tougher, with nano-blades for punches and a nano-shield when he braces; or the <b>Hulkbuster</b> — a huge armor that shakes the floor as it walks, shrugs off damage and punches enemies across the screen.'],
    ['⚡ Power &amp; armor', 'Flying and weapons drain the arc reactor; standing on the ground recharges it. Missiles reload slowly. If armor hits zero the suit goes offline, falls, and reboots.'],
    ['🛫 Flight', 'He lives on the floor of your screens — to go anywhere higher he has to fly. Drag him and let go: his thrusters catch him.'],
    ['⚔ Army attack &amp; the Iron Legion', 'Pick a side and a size — up to a legendary 1000 attackers. Iron Man calls in up to 7 Iron Legion suits to fight with him; in epic battles a destroyed suit is replaced.'],
    ['☢ Nuke', 'Siren, a falling bomb, then a mushroom cloud and a shockwave that wipes out every enemy on that screen. Iron Man runs for another screen — if the wave catches him, he goes flying.'],
  ],
};

function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

// ======================================================================= World
// Runs one hero (any Hero subclass) plus the shared enemies, armies, nuke and allies.
class HeroWorld {
  constructor({ geo, data, settings, emit, sysinfo, heroClass }) {
    this.H = heroClass || Hero;
    this.character = this.H.ID;
    this.geo = geo;
    this.emit = emit || (() => {});
    this.sysinfo = sysinfo || (() => ({}));
    this.settings = settings;
    this.counters = { kills: 0, drones: 0, walkers: 0, tanks: 0, bosses: 0, thanos: 0, doom: 0, kang: 0, galactus: 0, shotsFired: 0, missiles: 0, unibeams: 0, reboots: 0, waves: 0, nukes: 0, armies: 0, armiesWon: 0, legion: 0, ...((data && data.counters) || {}) };
    this.hero = new this.H(this, data && data.hero);
    this.allies = [];
    this.nuke = null;
    this.army = null;
    this.clock = now(); // simulation time (ms); advances with dt, so tests can run faster than real time
    this.enemies = [];
    this.shots = [];
    this.beams = [];
    this.strikes = []; // Doom's lightning storm: bolts marked on the floor, then striking
    this.screenFlash = null; // a full-screen flash (Thanos's snap): { at, dur, color }
    this.quake = null; // the floor shaking (Galactus's stomp): { at, dur, px }
    this.hud = [];
    this.diag = null;
    this.lockId = null;
    this.announcement = null;
    this.quiet = !!(data && data.quiet);
    this.hidden = false;
    this.cursor = { x: 0, y: 0 }; this.cursorVel = { x: 0, y: 0 }; this.cursorAcc = { x: 0, y: 0 };
    this.cursorMovedAt = 0;
    this.press = null;
    this.ver = 1;
    this.now = now();
    this.nextInvasion = 0;
    this.placeOnScreen(!(data && data.hero && Number.isFinite(data.hero.x)));
  }

  get s() { return SIZES[this.settings[this.H.SIZE_KEY]] || 1; }
  get diff() { return DIFF[this.settings.difficulty] || DIFF.normal; }

  dirty() { this.ver++; }
  get heroes() { return this.allies.length ? [this.hero, ...this.allies] : [this.hero]; }
  sound(name, at) { if (!this.quiet) this.emit({ type: 'sound', name, x: at ? at.x : this.hero.x, y: at ? at.y - 40 : this.hero.y - 40 }); }
  fx(kind, x, y, o) { this.emit({ type: 'fx', kind, x, y, ...(o || {}) }); }
  notify(title, body) { if (this.settings.notifications) this.emit({ type: 'notify', title, body }); }

  say(text, tone) { this.hero.say(text, tone); }

  showDiagnostics() {
    const info = this.sysinfo();
    this.diag = { start: now(), info, kills: this.counters.kills };
  }

  // ------------------------------------------------------------ geometry
  groundAt(x, y) {
    const geo = this.geo;
    let d = geo.displays.find((q) => x >= q.bounds.x && x <= q.bounds.x + q.bounds.width && y >= q.bounds.y - 2 && y <= q.bounds.y + q.bounds.height + 2);
    if (!d) d = geo.displays.find((q) => x >= q.bounds.x && x <= q.bounds.x + q.bounds.width);
    if (!d) d = geo.nearestDisplay({ x, y });
    return d ? d.work.y + d.work.height - 2 : y;
  }

  clampFloorX(x, fromX, fromY) {
    const d = this.geo.displayAt({ x: fromX, y: fromY - 30 }) || this.geo.nearestDisplay({ x: fromX, y: fromY });
    if (!d) return x;
    return clamp(x, d.work.x + 24 * this.s, d.work.x + d.work.width - 24 * this.s);
  }

  placeOnScreen(force) {
    const h = this.hero;
    if (force || !this.geo.inAny({ x: h.x, y: h.y - 40 })) {
      const d = this.geo.primary;
      if (!d) return;
      h.x = d.work.x + d.work.width * 0.5;
      h.y = this.groundAt(h.x, d.work.y + d.work.height - 5);
      h.mode = 'ground';
    }
    for (const e of this.enemies) {
      const q = this.geo.clampWork(e, 30);
      e.x = q.x; e.y = e.air ? q.y : this.groundAt(q.x, q.y);
    }
  }

  onDisplaysChanged() { this.placeOnScreen(false); }

  // ------------------------------------------------------------ enemies
  // an enemy's scale (world size × its own: only Galactus has one, to fit the screen), centre and hit radius
  es(e) { return this.s * (e.k || 1); }
  enemyCenter(e) { return { x: e.x, y: e.y + ENEMY[e.kind].cy * this.es(e) }; }
  enemyR(e) { return ENEMY[e.kind].r * this.es(e); }

  spawn(kind, p, o) {
    o = o || {};
    kind = ENEMY_ALIAS[kind] || kind;
    const s = this.s, k = ENEMY[kind];
    if (!k || this.enemies.length >= (o.max || 30)) return null;
    if (k.giant && this.enemies.some((x) => x.kind === kind)) return null; // one Galactus is plenty
    let q = this.geo.clampWork(p, 40 * s);
    let gk = 0;
    if (k.giant) {
      // the giant towers at the side of the screen nearest to where he was called, ~90% of its height
      const d = this.geo.displayAt(q) || this.geo.nearestDisplay(q);
      gk = clamp(d.work.height * 0.9 / (GALACTUS_H * s), 0.3, 2.5);
      const inset = d.work.width * 0.06 + 70 * s * gk;
      q = { x: q.x < d.work.x + d.work.width / 2 ? d.work.x + inset : d.work.x + d.work.width - inset, y: d.work.y + d.work.height * 0.2 };
    }
    const e = {
      id: uid('x'), kind, x: q.x, y: q.y, vx: 0, vy: 0, facing: q.x < this.hero.x ? 1 : -1,
      hp: k.hp * this.diff.hp, maxHp: k.hp * this.diff.hp, air: k.air, cool: rand(1, 2.5), phase: 0, charge: 0, hitAt: 0,
      orbit: rand(0, Math.PI * 2), range: rand(200, 330), alt: rand(60, 170), born: now(), state: 'idle', grounded: k.air,
    };
    if (gk) { e.k = gk; e.drainAt = this.clock + rand(6000, 9000); }
    if (kind === 'doom') { e.range = rand(320, 400); e.alt = rand(130, 190); e.shieldAt = this.clock + rand(5000, 8000); e.botAt = this.clock + rand(4000, 7000); }
    if (kind === 'doombot') { e.range = rand(220, 340); e.alt = rand(80, 190); }
    if (kind === 'kang') { e.warpAt = this.clock + rand(5000, 8000); e.freezeAt = this.clock + rand(3000, 6000); e.squadAt = this.clock + rand(8000, 12000); }
    if (kind === 'thanos') e.portalAt = this.clock + rand(5000, 9000);
    if (o.vx) e.vx = o.vx;
    this.enemies.push(e);
    if (!o.silent) {
      this.fx(kind === 'kang' ? 'timeportal' : kind === 'doombot' ? 'doomport' : 'portal', e.x, e.y + k.cy * this.es(e), { size: k.giant ? 5 : k.boss ? 2.4 : 1 });
      this.sound(k.boss ? 'bossSpawn' : 'spawn', e);
    }
    this.dirty();
    const h = this.hero;
    if (this.settings.autoDefend !== false && h.taskName !== 'combat' && h.taskName !== 'announce' && h.mode !== 'down') {
      h.interrupt(h.taskCombat(), 'combat', 80);
    }
    return e;
  }

  pickTarget(h) {
    const locked = this.enemies.find((e) => e.id === this.lockId);
    if (locked && (!h.ally || chance(0.3))) return locked;
    let best = null, bs = -Infinity;
    const others = this.allies.length ? this.heroes.filter((x) => x !== h) : [];
    for (const e of this.enemies) {
      const d = dist(this.enemyCenter(e), h);
      const k = ENEMY[e.kind];
      const threat = k.giant ? 3.5 : k.boss ? 3 : { tank: 1.5, walker: 1.2, drone: 1, mini: 1.4, doombot: 1.3 }[e.kind] || 1;
      // spread the suits over different targets
      const taken = others.reduce((a, x) => a + (x.targetId === e.id ? 1 : 0), 0);
      const score = threat * 400 - d * 0.6 - taken * 260;
      if (score > bs) { bs = score; best = e; }
    }
    return best;
  }

  firstEnemyOnLine(a, b, extend) {
    const s = this.s;
    const end = { x: a.x + (b.x - a.x) * (extend || 1), y: a.y + (b.y - a.y) * (extend || 1) };
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      const c = this.enemyCenter(e);
      if (segDist(c, a, end) < this.enemyR(e)) { const d = dist(c, a); if (d < bd) { bd = d; best = e; } }
    }
    return best;
  }

  enemiesInCone(h, tp, spread) {
    const a = Math.atan2(tp.y - h.chest().y, tp.x - h.chest().x);
    return this.enemies.filter((e) => {
      const c = this.enemyCenter(e);
      let d = Math.atan2(c.y - h.chest().y, c.x - h.chest().x) - a;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return Math.abs(d) < spread;
    });
  }

  incomingThreat(h) {
    const c = h.chest(), s = this.s;
    for (const p of this.shots) {
      if (p.owner !== 'enemy') continue;
      const rx = c.x - p.x, ry = c.y - p.y;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const along = (rx * p.vx + ry * p.vy) / sp;
      if (along > 0 && along / sp < 0.45 && Math.abs(rx * p.vy - ry * p.vx) / sp < 40 * s) return p;
    }
    return null;
  }

  damage(e, dmg, from, quiet) {
    if (e.hp <= 0) return;
    // no single blow does much to a giant: he falls to a long fight, not one smash
    if (ENEMY[e.kind].giant) dmg = Math.min(dmg, 4);
    // the stones blaze around Thanos while he snaps: hits barely reach him
    if (e.state === 'snap') dmg *= 0.25;
    // Doom's force field soaks most of it
    if (e.shield > 0) {
      dmg *= 0.15;
      if (!quiet && chance(0.3)) this.fx('spark', e.x + rand(-20, 20) * this.s, e.y + rand(-25, 25) * this.s, {});
    }
    // the Legion fights at full power in a big battle
    e.hp -= this.army && this.army.huge ? dmg * 1.6 : dmg;
    e.hitAt = now();
    if (e.hp <= 0) this.kill(e);
    this.dirty();
  }

  kill(e, silent) {
    const i = this.enemies.indexOf(e);
    if (i < 0) return;
    this.enemies.splice(i, 1);
    const c = this.enemyCenter(e);
    if (!silent) {
      const k = ENEMY[e.kind];
      this.counters.kills++;
      const key = { drone: 'drones', mini: 'drones', doombot: 'drones', walker: 'walkers', tank: 'tanks' }[e.kind] || 'bosses';
      this.counters[key] = (this.counters[key] || 0) + 1;
      if (k.boss) this.counters[e.kind] = (this.counters[e.kind] || 0) + 1; // thanos, doom, kang, galactus
      if (e.beam || e.drains) this.interruptEnemy(e);
      if (k.giant) {
        // the Devourer of Worlds falls
        this.fx('galactusDown', e.x, e.y, { size: e.k || 1 });
        this.fx('text', e.x + e.facing * 190 * this.es(e), e.y - 560 * this.es(e), { text: 'GALACTUS FALLS!', color: '#ffd166' });
        this.sound('nukeBoom', c);
        for (const h of this.heroes) if (h.mode !== 'down' && h.mode !== 'thrown') h.say(h.line('victory'));
      } else {
        this.fx('explosion', c.x, c.y, { size: k.boss ? 3 : e.kind === 'tank' ? 1.6 : e.kind === 'mini' ? 0.7 : 1 });
        this.sound(k.boss || e.kind === 'tank' ? 'boomBig' : 'boom', c);
      }
      if (k.boss) this.say(this.hero.line('bossDown'));
    } else {
      this.fx('portal', c.x, c.y, {});
    }
    if (this.lockId === e.id) this.lockId = null;
    if (!this.enemies.length) this.counters.waves++;
  }

  hurtHero(dmg, at, who) {
    const h = who || this.hero, s = this.s;
    if (h.mode === 'down' || h.taskName === 'reboot' || h.mode === 'thrown') return;
    h.armor -= dmg * this.diff.dmg * (h.ally ? 0.8 : 1) * (this.army && this.army.huge ? 0.35 : 1);
    h.hitAt = now();
    this.fx('hitspark', at ? at.x : h.x, at ? at.y : h.y - 55 * s, {});
    this.sound('hit', h);
    if (h.armor <= 0) {
      h.armor = 0;
      if (h.ally) { this.destroyAlly(h); return; }
      this.counters.reboots++;
      h.run(h.taskReboot(), 'reboot', 99);
    } else if (h.armor < 25 && !h.warnedArmor) { h.warnedArmor = true; h.say(h.line('armorLow'), 'warn'); }
    if (h.armor > 40) h.warnedArmor = false;
  }

  // the hero an enemy goes after: the nearest suit that's still in the fight
  nearestHero(e) {
    if (!this.allies.length) return this.hero;
    let best = this.hero, bd = Infinity;
    for (const h of this.heroes) {
      if (h.mode === 'down') continue;
      const d = dist(h, e);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  addShot(p) { p.id = uid('p'); p.age = 0; this.shots.push(p); return p; }
  addBeam(kind, a, b, dur, w, owner) {
    const beam = { id: uid('b'), kind, x1: a.x, y1: a.y, x2: b.x, y2: b.y, start: now(), dur, w, owner };
    this.beams.push(beam);
    return beam;
  }

  tickEnemies(dt) {
    const s = this.s, D = this.diff;
    this.tickStrikes(dt);
    for (const e of [...this.enemies]) {
      const k = ENEMY[e.kind];
      if (e.grabbed) {
        // a hero holds it and moves it every tick; if that stops, it drops
        if (this.clock - (e.grabbedAt || 0) > 300) { e.grabbed = null; this.launchEnemy(e, 0, 0); }
        continue;
      }
      if (e.launch) { this.tickLaunched(e, dt); continue; }
      if (e.stun > 0) { this.tickStunned(e, dt); continue; }
      const h = this.nearestHero(e);
      const hc = h.chest();
      e.cool -= dt * D.rate;
      e.phase += dt * (e.air ? 1 : Math.abs(e.vx) / (6 * s) + 0.01);
      const d = dist(this.enemyCenter(e), hc);
      if (e.kind === 'drone' || e.kind === 'doombot') {
        // Ultron sentries and Doombots circle the hero and shoot from above
        e.orbit += dt * (e.kind === 'doombot' ? 0.55 : 0.7);
        const want = { x: hc.x + Math.cos(e.orbit) * e.range * s, y: hc.y - e.alt * s + Math.sin(e.orbit * 1.7) * 30 * s };
        this.steerEnemy(e, want, k.speed * s, dt);
        e.facing = hc.x > e.x ? 1 : -1;
        e.charge = clamp(1 - e.cool / 0.6, 0, 1);
        if (e.cool <= 0 && d < 780 * s && h.mode !== 'down') {
          e.cool = rand(k.fire[0], k.fire[1]);
          if (e.kind === 'doombot') this.enemyLaser(e, hc, 560 * s, k.dmg, null, h, 'glaser');
          else { e.burst = 1; e.burstT = 0.12; this.enemyLaser(e, hc, 600 * s, k.dmg, null, h); } // a twin shot
        }
      } else if (e.kind === 'mini') {
        this.steerEnemy(e, { x: hc.x, y: hc.y }, k.speed * s * (h.mode === 'down' ? 0.3 : 1), dt, 950 * s);
        e.facing = e.vx > 0 ? 1 : -1;
        if (d < 24 * s && h.mode !== 'down') { this.hurtHero(k.dmg, this.enemyCenter(e), h); this.kill(e); continue; }
      } else if (e.kind === 'doom') {
        this.tickDoom(e, dt, hc, h, d);
      } else {
        // ground units fall to the floor first
        const g = this.groundAt(e.x, e.y);
        if (!e.grounded) {
          e.vy += 1800 * s * dt; e.y += e.vy * dt;
          if (e.y >= g) {
            e.y = g; e.vy = 0; e.grounded = true;
            this.fx('shockwave', e.x, e.y, { size: k.giant ? 4 * (e.k || 1) : k.boss ? 2 : 0.8 });
            this.sound(k.giant || k.boss ? 'boomBig' : 'landing', e);
            if (k.giant) this.shakeFloor(1.4, 12);
          }
          continue;
        }
        e.y = g;
        const dx = hc.x - e.x;
        if (e.state !== 'firing' || !k.giant) e.facing = dx > 0 ? 1 : -1;
        const want = (k.giant ? 0 : e.kind === 'thanos' ? 320 : e.kind === 'kang' ? 380 : e.kind === 'tank' ? 380 : 280) * s;
        let mv = 0;
        if (!k.giant && e.state === 'idle') {
          if (Math.abs(dx) > want + 40 * s) mv = Math.sign(dx);
          else if (Math.abs(dx) < want - 120 * s) mv = -Math.sign(dx) * 0.6;
        }
        e.vx = mv * k.speed * s;
        const d0 = this.geo.displayAt({ x: e.x, y: e.y - 20 }) || this.geo.nearestDisplay(e);
        e.x = clamp(e.x + e.vx * dt, d0.work.x + 30 * s, d0.work.x + d0.work.width - 30 * s);
        if (e.kind === 'walker') {
          // Ultron soldiers fire two quick palm blasts
          const palm = { x: e.x + e.facing * 26 * s, y: e.y - 38 * s };
          e.charge = clamp(1 - e.cool / 0.5, 0, 1);
          if (e.cool <= 0 && h.mode !== 'down') { e.cool = rand(k.fire[0], k.fire[1]); e.burst = 1; e.burstT = 0.16; this.enemyLaser(e, hc, 500 * s, k.dmg, palm, h); }
        } else if (e.kind === 'tank') {
          // Ultron Prime: an arcing plasma shell, then a fan of three blasts
          const muzzle = { x: e.x + e.facing * 34 * s, y: e.y - 46 * s };
          e.aim = -0.35;
          e.charge = clamp(1 - e.cool / 0.6, 0, 1);
          if (e.cool <= 0 && h.mode !== 'down') {
            e.cool = rand(k.fire[0], k.fire[1]);
            e.volley = !e.volley;
            if (e.volley) this.enemyShell(e, muzzle, hc, k.dmg);
            else for (const da of [-0.12, 0, 0.12]) this.enemyLaser(e, { x: hc.x + Math.sin(da) * 200 * s, y: hc.y + da * 260 * s }, 540 * s, 4, muzzle, h);
          }
        } else if (e.kind === 'thanos') {
          this.tickThanos(e, dt, hc, h);
        } else if (e.kind === 'kang') {
          this.tickKang(e, dt, hc, h);
        } else if (e.kind === 'galactus') {
          this.tickGalactus(e, dt, hc, h);
        }
      }
      // the second shot of a quick burst
      if (e.burst > 0 && this.enemies.includes(e)) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          e.burst--;
          if (h.mode !== 'down') this.enemyLaser(e, h.chest(), (e.kind === 'drone' ? 600 : 500) * s, k.dmg, e.kind === 'walker' ? { x: e.x + e.facing * 26 * s, y: e.y - 38 * s } : null, h);
        }
      }
    }
    if (this.screenFlash && this.clock - this.screenFlash.at > this.screenFlash.dur * 1000) this.screenFlash = null;
    if (this.quake && this.clock - this.quake.at > this.quake.dur * 1000) this.quake = null;
  }

  // ---- shared moves heroes use on enemies
  // stun: webbed / dazed for `sec` seconds (flyers sink to the floor); bosses shake it off faster
  stunEnemy(e, sec, kind) {
    if (!e || e.hp <= 0) return;
    const k = ENEMY[e.kind];
    // a villain can't be pinned for long: webs and dazes don't stack past a moment, and once
    // he breaks free he can't be pinned again straight away
    if (k.boss) {
      if (e.state === 'snap') return; // nothing stops the snap
      if (!(e.stun > 0)) { if (this.clock < (e.stunFree || 0)) return; e.stunStart = this.clock; }
      else if (this.clock - (e.stunStart || 0) > 1200) return;
    }
    e.stun = Math.max(e.stun || 0, sec * (k.giant ? 0.15 : k.boss ? 0.35 : 1));
    e.stunKind = kind || 'daze';
    this.dirty();
  }

  tickStunned(e, dt) {
    const s = this.s;
    e.stun -= dt; e.charge = 0;
    if (e.state !== 'idle') { this.interruptEnemy(e); e.cool = Math.max(e.cool, 1); }
    const g = this.groundAt(e.x, e.y) - (e.air ? 14 * s : 0);
    if (e.y < g - 0.5) {
      e.vy = Math.min((e.vy || 0) + 900 * s * dt, 420 * s);
      e.y = Math.min(g, e.y + e.vy * dt);
      if (e.y >= g && !e.air) e.grounded = true;
    } else { e.y = g; e.vy = 0; }
    e.vx *= Math.exp(-4 * dt);
    e.x = this.geo.clampWork({ x: e.x + e.vx * dt, y: e.y - 10 * s }, 20 * s).x;
    if (e.stun <= 0) { e.stun = 0; e.stunKind = null; if (isBoss(e)) e.stunFree = this.clock + 3500; this.dirty(); }
  }

  // launch: knocked flying (a punch, a smash). o.thrown = { dmg, r } makes it a projectile that
  // crashes into other enemies or the floor; o.dmg hurts it when it lands. Bosses barely move.
  launchEnemy(e, vx, vy, o) {
    if (!e || e.hp <= 0) return;
    o = o || {};
    if (ENEMY[e.kind].giant || e.state === 'snap') { if (o.dmg) this.damage(e, o.dmg, e); return; } // nobody knocks Galactus over (or stops the snap)
    const heavy = isBoss(e) && !o.thrown ? 0.3 : 1;
    e.grabbed = null;
    e.launch = { t: 0, spinV: o.spin != null ? o.spin : (vx >= 0 ? 1 : -1) * rand(6, 12) * heavy, thrown: o.thrown || null, dmg: o.dmg || 0 };
    e.vx = vx * heavy; e.vy = vy * heavy;
    e.spin = e.spin || 0;
    this.interruptEnemy(e);
    this.dirty();
  }

  tickLaunched(e, dt) {
    const s = this.s, L = e.launch;
    L.t += dt;
    e.vy += 1500 * s * dt;
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.spin += L.spinV * dt;
    const c = this.geo.clampBounds({ x: e.x, y: e.y - 10 * s }, 20 * s);
    if (c.x !== e.x) { e.x = c.x; e.vx = -e.vx * 0.4; }
    const d = this.geo.displayAt({ x: e.x, y: e.y }) || this.geo.nearestDisplay(e);
    if (d && e.y < d.work.y + 20 * s) { e.y = d.work.y + 20 * s; e.vy = Math.abs(e.vy) * 0.3; }
    if (L.thrown) {
      const me = this.enemyCenter(e);
      const hit = this.enemies.find((o) => o !== e && !o.launch && !o.grabbed && dist(this.enemyCenter(o), me) < this.enemyR(o) + this.enemyR(e));
      if (hit) { this.crash(e); return; }
    }
    const g = this.groundAt(e.x, e.y);
    const rest = g - (e.air ? 14 * s : 0);
    if (e.y >= rest || (e.air && !L.thrown && L.t > 0.7)) {
      if (L.thrown) { e.y = Math.min(e.y, rest); this.crash(e); return; }
      if (e.y >= rest) e.y = rest;
      if (!e.air) { e.grounded = true; this.fx('shockwave', e.x, g, { size: isBoss(e) ? 1.2 : 0.6 }); this.sound('landing', e); }
      e.launch = null; e.spin = 0; e.vy = 0; e.vx *= 0.2;
      if (L.dmg) this.damage(e, L.dmg, e);
      this.dirty();
    }
  }

  // a thrown enemy hits something: it and everything near it takes the damage
  crash(e) {
    const s = this.s, L = e.launch, T = L.thrown;
    const c = this.enemyCenter(e);
    e.launch = null; e.spin = 0; e.vx = 0; e.vy = 0;
    if (!e.air) { e.y = this.groundAt(e.x, e.y); e.grounded = true; }
    this.fx('explosion', c.x, c.y, { size: 1.3 });
    this.sound('boomBig', c);
    this.splash(c, (T.r || 80) * s, T.dmg || 6, e);
    this.damage(e, T.dmg || 6, c);
    this.dirty();
  }

  // area damage around p (optionally sparing one enemy)
  splash(p, r, dmg, except) {
    let n = 0;
    for (const o of [...this.enemies]) {
      if (o === except) continue;
      if (dist(this.enemyCenter(o), p) < r + this.enemyR(o)) { this.damage(o, dmg, p); n++; }
    }
    return n;
  }

  // grab: the hero holds the enemy (call every tick while holding it, then launch it)
  holdEnemy(e, h, x, y) {
    e.grabbed = h.id; e.grabbedAt = this.clock;
    e.x = x; e.y = y; e.vx = h.vx; e.vy = h.vy;
    e.stun = 0; e.charge = 0;
    this.interruptEnemy(e);
  }

  // whatever it was doing (charging, firing a beam, winding up) is cut short
  interruptEnemy(e) {
    if (e.beam) { this.beams = this.beams.filter((b) => b !== e.beam); e.beam = null; }
    if (e.drains) { const gone = new Set(e.drains.map((d) => d.beam)); this.beams = this.beams.filter((b) => !gone.has(b)); e.drains = null; }
    e.state = 'idle'; e.charge = 0; e.jumped = false; e.meteorT = 0;
  }

  count(key, n) { this.counters[key] = (this.counters[key] || 0) + (n == null ? 1 : n); }

  steerEnemy(e, want, maxSp, dt, accel) {
    const dx = want.x - e.x, dy = want.y - e.y, d = Math.hypot(dx, dy);
    const sp = Math.min(maxSp, d * 2);
    const wx = d > 0.5 ? dx / d * sp : 0, wy = d > 0.5 ? dy / d * sp : 0;
    const a = (accel || 500 * this.s) * dt;
    const dvx = wx - e.vx, dvy = wy - e.vy, dv = Math.hypot(dvx, dvy);
    if (dv > a) { e.vx += dvx / dv * a; e.vy += dvy / dv * a; } else { e.vx = wx; e.vy = wy; }
    e.x += e.vx * dt; e.y += e.vy * dt;
    const q = this.geo.clampWork({ x: e.x, y: e.y }, 20 * this.s);
    e.x = q.x; e.y = Math.min(q.y, this.groundAt(q.x, q.y) - 20 * this.s);
  }

  enemyLaser(e, target, speed, dmg, from, who, kind) {
    const s = this.s;
    const o = from || this.enemyCenter(e);
    const hv = who || this.hero;
    const lead = { x: target.x + hv.vx * 0.25, y: target.y + hv.vy * 0.25 };
    const a = Math.atan2(lead.y - o.y, lead.x - o.x) + rand(-0.06, 0.06);
    this.addShot({ kind: kind || 'laser', owner: 'enemy', x: o.x, y: o.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, life: 3, bolt: true });
    this.sound('laser', o);
    void s;
  }

  enemyShell(e, from, target, dmg) {
    const s = this.s, g = 600 * s;
    const dx = target.x - from.x, dy = target.y - from.y;
    const t = clamp(Math.abs(dx) / (340 * s), 0.6, 2.2);
    this.addShot({ kind: 'shell', owner: 'enemy', x: from.x, y: from.y, vx: dx / t, vy: dy / t - 0.5 * g * t, g, dmg, life: 4 });
    this.sound('shellFire', from);
    this.fx('flash', from.x, from.y, { size: 0.6, color: '255,170,60' });
  }

  // a straight bolt (Kang's chrono shots…): like the laser, but its own kind
  enemyBolt(e, kind, from, target, speed, dmg, who, o) {
    const hv = who || this.hero;
    const lead = { x: target.x + hv.vx * 0.2, y: target.y + hv.vy * 0.2 };
    const a = Math.atan2(lead.y - from.y, lead.x - from.x) + rand(-0.05, 0.05);
    this.addShot({ kind, owner: 'enemy', x: from.x, y: from.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg, life: 3.5, bolt: true, ...(o || {}) });
    this.sound(kind === 'timeblast' ? 'timeBlast' : 'chrono', from);
  }

  // an arcing throw (Thanos's rock…), like the tank shell
  enemyLob(e, kind, from, target, dmg, size) {
    const s = this.s, g = 650 * s;
    const dx = target.x - from.x, dy = target.y - from.y;
    const t = clamp(Math.abs(dx) / (360 * s), 0.6, 2.2);
    this.addShot({ kind, owner: 'enemy', x: from.x, y: from.y, vx: dx / t, vy: dy / t - 0.5 * g * t, g, dmg, life: 4, size: size || 1, hitSize: 1.2 });
    this.sound('whoosh', from);
  }

  // A villain's sustained beam: charge (e.charge 0→1), then fire for o.fire seconds, either
  // turning toward the hero (o.turn rad/s) or sweeping through o.sweep radians across them.
  bossBeam(e, dt, hc, from, o) {
    const s = this.s;
    if (e.state === 'charging') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / o.charge, 0, 1);
      if (e.stateT >= o.charge) {
        e.state = 'firing'; e.stateT = 0;
        const aim = Math.atan2(hc.y - from.y, hc.x - from.x);
        e.sweepDir = chance(0.5) ? 1 : -1;
        e.beamAng = o.sweep ? aim - e.sweepDir * o.sweep / 2 : aim;
        e.beam = this.addBeam(o.kind, from, from, o.fire + 0.1, o.w, 'enemy');
        e.beam.color = o.color; e.beam.core = o.core;
        this.sound(o.sound || 'unibeam', e);
      }
      return;
    }
    if (e.state !== 'firing') return;
    e.stateT += dt;
    if (o.sweep) e.beamAng += e.sweepDir * o.sweep * dt / o.fire;
    else {
      let dA = Math.atan2(hc.y - from.y, hc.x - from.x) - e.beamAng;
      while (dA > Math.PI) dA -= 2 * Math.PI;
      while (dA < -Math.PI) dA += 2 * Math.PI;
      e.beamAng += clamp(dA, -o.turn * dt, o.turn * dt);
    }
    const len = (o.len || 1500) * s;
    const end = { x: from.x + Math.cos(e.beamAng) * len, y: from.y + Math.sin(e.beamAng) * len };
    if (e.beam) { e.beam.x1 = from.x; e.beam.y1 = from.y; e.beam.x2 = end.x; e.beam.y2 = end.y; }
    e.beamTick = (e.beamTick || 0) + dt;
    if (e.beamTick > 0.2) {
      e.beamTick = 0;
      for (const hh of this.heroes) { const c = hh.chest(); if (hh.mode !== 'down' && segDist(c, from, end) < (o.hit || 26) * hh.s) this.hurtHero(o.dmg, c, hh); }
    }
    if (e.stateT >= o.fire) { e.state = 'idle'; e.charge = 0; e.cool = rand(o.after[0], o.after[1]); e.beam = null; }
  }

  heroOnFloor(h) { return h.y > this.groundAt(h.x, h.y) - 40 * h.s; }

  // the whole screen flashes (the snap) / the floor shakes (a giant's stomp)
  flashScreen(dur, color) { this.screenFlash = { at: this.clock, dur, color: color || '255,255,255' }; this.dirty(); }
  shakeFloor(dur, px) { this.quake = { at: this.clock, dur, px }; this.dirty(); }

  // Doom's lightning storm: each bolt is marked on the floor, then strikes from the sky
  tickStrikes(dt) {
    if (!this.strikes.length) return;
    const s = this.s;
    for (const st of [...this.strikes]) {
      if (this.clock < st.at) continue;
      this.strikes.splice(this.strikes.indexOf(st), 1);
      const d = this.geo.displayAt({ x: st.x, y: st.y - 20 }) || this.geo.nearestDisplay(st);
      const top = { x: st.x + rand(-40, 40) * s, y: d.work.y - 10 };
      const b = this.addBeam('lightning', top, { x: st.x, y: st.y }, 0.35, 6, 'enemy');
      b.color = '90,255,140'; b.core = 'rgba(230,255,235,0.95)'; b.strike = true;
      this.fx('flash', st.x, st.y - 10 * s, { size: 2, color: '120,255,160' });
      this.fx('shockwave', st.x, st.y, { size: 1 });
      this.sound('lightning', st);
      for (const hh of this.heroes) {
        const c = hh.chest();
        if (hh.mode !== 'down' && Math.abs(c.x - st.x) < 38 * s) this.hurtHero(st.dmg, c, hh);
      }
    }
    void dt;
  }

  // ---- Thanos: the gauntlet beam, a power-stone blast, a space-stone portal jump, a ground
  // slam up close, a hurled rock — and, once, when he's losing: the SNAP
  tickThanos(e, dt, hc, who) {
    const s = this.s, h = who || this.hero, k = ENEMY.thanos;
    const fist = { x: e.x + e.facing * 44 * s, y: e.y - 186 * s }; // the gauntlet raised
    const punch = { x: e.x + e.facing * 52 * s, y: e.y - 140 * s }; // thrust forward
    if (!e.snapped && e.hp < e.maxHp * 0.4 && h.mode !== 'down') {
      // whatever he was doing, the gauntlet goes up
      this.interruptEnemy(e);
      e.snapped = true; e.state = 'snap'; e.stateT = 0;
      this.sound('gauntlet', e);
      this.say(this.hero.line('snapWarn'), 'warn');
    }
    if (e.state === 'idle' && e.cool <= 0 && h.mode !== 'down') {
      const adx = Math.abs(hc.x - e.x), r = Math.random();
      if (adx < 260 * s && this.heroOnFloor(h)) { e.state = 'slam'; e.stateT = 0; this.sound('chargeLong', e); }
      else if (adx > 480 * s && this.clock >= e.portalAt && r < 0.45) { e.state = 'portal'; e.stateT = 0; e.portalAt = this.clock + rand(9000, 13000); this.fx('spaceportal', e.x, e.y - 100 * s, { size: 2.6 }); this.sound('timeWarp', e); }
      else if (r < 0.4) { e.state = 'power'; e.stateT = 0; this.sound('chargeLong', e); }
      else if (r < 0.75) { e.state = 'charging'; e.stateT = 0; this.sound('gauntlet', e); this.say(this.hero.line('bossBeam'), 'warn'); }
      else { e.state = 'throw'; e.stateT = 0; }
    }
    if (e.state === 'slam') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.6, 0, 1);
      if (e.stateT >= 0.6) {
        const g = { x: e.x + e.facing * 50 * s, y: e.y };
        this.fx('shockwave', g.x, g.y, { size: 3 });
        this.fx('flash', g.x, g.y - 20 * s, { size: 1.6, color: '200,120,255' });
        this.sound('boomBig', g);
        this.shakeFloor(0.5, 5);
        for (const hh of this.heroes) if (hh.mode !== 'down' && Math.abs(hh.x - g.x) < 300 * s && this.heroOnFloor(hh)) this.hurtHero(k.dmg, { x: hh.x, y: hh.y - 20 * s }, hh);
        e.state = 'recover'; e.stateT = 0; e.charge = 0; e.cool = rand(2.0, 2.8);
      }
    } else if (e.state === 'throw') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.55, 0, 1);
      if (e.stateT >= 0.55) {
        this.enemyLob(e, 'rock', { x: e.x - e.facing * 9 * s, y: e.y - 203 * s }, hc, 12, 1.8);
        e.state = 'recover'; e.stateT = 0; e.charge = 0; e.cool = rand(2.2, 3.0);
      }
    } else if (e.state === 'power') {
      // the Power Stone: a crackling purple sphere that bursts on whatever it hits
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.75, 0, 1);
      if (e.stateT >= 0.75) {
        this.enemyBolt(e, 'powerorb', punch, hc, 380 * s, 10, h, { size: 1.7, hr: 44, hitFx: 'powerburst', hitSize: 1.6, hitSound: 'boomBig', life: 4 });
        this.sound('gauntlet', punch);
        e.state = 'recover'; e.stateT = 0; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]);
      }
    } else if (e.state === 'portal') {
      // the Space Stone: he steps through a blue portal and comes out right beside the hero
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.5, 0, 1);
      if (e.stateT >= 0.5 && !e.jumped) {
        e.jumped = true;
        const d0 = this.geo.displayAt({ x: h.x, y: h.y - 20 * s }) || this.geo.nearestDisplay(h);
        const side = h.x < d0.work.x + d0.work.width / 2 ? 1 : -1;
        e.x = clamp(h.x + side * rand(150, 200) * s, d0.work.x + 60 * s, d0.work.x + d0.work.width - 60 * s);
        e.y = this.groundAt(e.x, d0.work.y + d0.work.height - 5);
        e.facing = h.x > e.x ? 1 : -1;
        e.warpT = now();
        this.fx('spaceportal', e.x, e.y - 100 * s, { size: 2.6 });
        this.sound('timeWarp', e);
        this.dirty();
      }
      if (e.stateT >= 0.85) {
        e.jumped = false;
        if (this.heroOnFloor(h)) { e.state = 'slam'; e.stateT = 0.2; this.sound('chargeLong', e); }
        else { e.state = 'power'; e.stateT = 0.3; }
      }
    } else if (e.state === 'snap') {
      // the gauntlet goes up, every stone blazes… SNAP
      e.stateT += dt;
      e.charge = clamp(e.stateT / 1.8, 0, 1);
      if (e.stateT >= 1.8) {
        this.flashScreen(1.6, '255,255,255');
        this.sound('snap', e);
        for (const hh of this.heroes) {
          if (hh.mode === 'down') continue;
          hh.setHealth(Math.max(1, hh.armor * 0.5));
          hh.hitAt = now();
        }
        // some of the allies turn to dust
        for (const a of [...this.allies]) {
          if (!chance(0.5)) continue;
          this.fx('dust', a.x, a.y - 50 * a.s, { size: a.s, color: (this.H.ALLIES && this.H.ALLIES.dust) || '150,120,100' });
          this.removeAlly(a);
          if (this.army) this.army.legionAt = Math.max(this.army.legionAt, this.clock + 6000);
        }
        this.say(this.hero.line('snapped'), 'warn');
        e.state = 'recover'; e.stateT = -0.8; e.charge = 0; e.cool = rand(2.5, 3.2);
      }
    } else if (e.state === 'charging' || e.state === 'firing') {
      this.bossBeam(e, dt, hc, fist, { charge: 1.1, fire: 1.5, w: 12, dmg: 2.8, turn: 0.6, kind: 'gauntlet', color: '190,90,255', core: 'rgba(255,240,255,0.95)', after: [k.fire[0], k.fire[1]] });
    } else if (e.state === 'recover') {
      e.stateT += dt;
      if (e.stateT > 0.45) e.state = 'idle';
    }
  }

  // ---- Doctor Doom: hovers at a distance; homing mystic bolts, a lightning beam, a lightning
  // storm from the sky, Doombots summoned to his side, and a force field
  tickDoom(e, dt, hc, h, d) {
    const s = this.s, k = ENEMY.doom;
    const side = e.x < hc.x ? -1 : 1;
    const want = { x: hc.x + side * e.range * s, y: hc.y - e.alt * s + Math.sin(e.phase * 1.3) * 18 * s };
    if (e.state !== 'firing' && e.state !== 'storm') this.steerEnemy(e, want, k.speed * s, dt, 420 * s);
    else { e.vx *= 0.9; e.vy *= 0.9; }
    e.facing = hc.x > e.x ? 1 : -1;
    if (e.shield > 0) e.shield = Math.max(0, e.shield - dt);
    else if (this.clock >= e.shieldAt) { e.shield = 3; e.shieldAt = this.clock + rand(9000, 12000); this.sound('shield', e); this.dirty(); }
    const hands = { x: e.x + e.facing * 43 * s, y: e.y - 4 * s };
    if (e.state === 'idle' && h.mode !== 'down' && this.clock >= e.botAt && this.enemies.length < 24 && this.enemies.filter((x) => x.kind === 'doombot').length < 2) {
      e.state = 'summon'; e.stateT = 0; this.sound('mystic', e);
    } else if (e.state === 'idle' && e.cool <= 0 && h.mode !== 'down' && d < 1000 * s) {
      const r = Math.random();
      if (r < 0.4) {
        for (let i = 0; i < 3; i++) {
          this.addShot({ kind: 'mystic', owner: 'enemy', x: hands.x, y: hands.y, vx: e.facing * 140 * s + (i - 1) * 30 * s, vy: (i - 1) * 130 * s - 40 * s, homing: true, turn: 2.2, vmax: 310, dmg: k.dmg, life: 4.5, speed: 150 * s, hitFx: 'flash', hitColor: '90,255,140', hitSize: 0.9, hitSound: 'hit' });
        }
        this.sound('mystic', e);
        e.cool = rand(k.fire[0], k.fire[1]) + 0.6;
      } else if (r < 0.7) { e.state = 'charging'; e.stateT = 0; this.sound('chargeLong', e); }
      else { e.state = 'storm'; e.stateT = 0; this.sound('lightning', e); }
    }
    if (e.state === 'summon') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.8, 0, 1);
      if (e.stateT >= 0.8) {
        for (const sd of [-1, 1]) {
          const p = { x: e.x + sd * rand(90, 140) * s, y: e.y + rand(-50, 30) * s };
          this.fx('doomport', p.x, p.y, { size: 1.4 });
          this.spawn('doombot', p, { max: 40, silent: true });
        }
        this.sound('spawn', e);
        e.botAt = this.clock + rand(16000, 22000);
        e.state = 'idle'; e.charge = 0; e.cool = Math.max(e.cool, 1);
      }
    } else if (e.state === 'storm') {
      // arms raised: five bolts walk across the hero's spot
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.6, 0, 1);
      if (e.stateT >= 0.6) {
        const g = this.groundAt(h.x, h.y);
        const xs = [-2, -1, 0, 1, 2].map((i) => h.x + i * 85 * s + rand(-20, 20) * s);
        if (chance(0.5)) xs.reverse();
        xs.forEach((x, i) => {
          this.strikes.push({ x, y: g, at: this.clock + 700 + i * 200, dmg: k.dmg + 2 });
          this.fx('stormMark', x, g, { size: 1, life: 0.7 + i * 0.2 });
        });
        e.state = 'idle'; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]) + 1.2;
      }
    } else if (e.state === 'charging' || e.state === 'firing') {
      this.bossBeam(e, dt, hc, hands, { charge: 0.7, fire: 1.1, w: 8, dmg: 2.2, turn: 1.1, kind: 'lightning', color: '90,255,140', core: 'rgba(230,255,235,0.95)', sound: 'lightning', after: [k.fire[0], k.fire[1]] });
    }
  }

  // ---- Kang the Conqueror: steps through time portals, freezes a hero in time, calls a squad
  // out of another century, chrono-bolt bursts and a heavy time blast
  tickKang(e, dt, hc, who) {
    const s = this.s, h = who || this.hero, k = ENEMY.kang;
    const cannon = { x: e.x + e.facing * 55 * s, y: e.y - 97 * s };
    const close = Math.abs(hc.x - e.x) < 170 * s;
    if (e.state === 'idle' && h.mode !== 'down' && (this.clock >= e.warpAt || (close && this.clock >= e.warpAt - 4500))) {
      const d0 = this.geo.displayAt({ x: h.x, y: h.y - 20 * s }) || this.geo.nearestDisplay(h);
      const lo = d0.work.x + 60 * s, hi = d0.work.x + d0.work.width - 60 * s;
      let side = chance(0.5) ? 1 : -1;
      let nx = clamp(h.x + side * rand(280, 480) * s, lo, hi);
      if (Math.abs(nx - h.x) < 220 * s) { side = -side; nx = clamp(h.x + side * rand(280, 480) * s, lo, hi); }
      this.fx('timeportal', e.x, e.y - 76 * s, { size: 3 });
      e.x = nx; e.y = this.groundAt(nx, d0.work.y + d0.work.height - 5);
      this.fx('timeportal', e.x, e.y - 76 * s, { size: 3 });
      this.sound('timeWarp', e);
      e.warpAt = this.clock + rand(6500, 9500);
      e.warpT = now();
      e.cool = Math.max(e.cool, 0.6);
      this.dirty();
    }
    const canFreeze = (h.mode === 'ground' || h.mode === 'air') && !(h.frozen > 0) && dist(hc, cannon) < 800 * s;
    if (e.state === 'idle' && h.mode !== 'down' && this.clock >= e.freezeAt && canFreeze) {
      e.state = 'freeze'; e.stateT = 0; this.sound('timeWarp', e);
    } else if (e.state === 'idle' && h.mode !== 'down' && this.clock >= e.squadAt && this.enemies.length < 16) {
      e.state = 'squad'; e.stateT = 0; this.sound('timeWarp', e);
    } else if (e.state === 'idle' && e.cool <= 0 && h.mode !== 'down') {
      if (chance(0.65)) { e.state = 'burst'; e.stateT = 0; e.shotsLeft = 3; }
      else { e.state = 'charging'; e.stateT = 0; this.sound('chargeLong', e); }
    }
    if (e.state === 'freeze') {
      // the stasis field: the hero is stuck in time for a moment, then a burst hits him
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.7, 0, 1);
      if (e.stateT >= 0.7) {
        if ((h.mode === 'ground' || h.mode === 'air') && h.taskName !== 'reboot') {
          h.frozen = 1.8;
          const c = h.chest();
          this.fx('timefreeze', c.x, c.y, { size: h.s, life: 1.8 });
          this.sound('timeStop', c);
          h.say(h.line('frozen'), 'warn');
        }
        e.freezeAt = this.clock + rand(10000, 14000);
        e.state = 'burst'; e.stateT = 0; e.shotsLeft = 5;
      }
    } else if (e.state === 'squad') {
      // time portals open on both sides and drop a squad from another century
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.9, 0, 1);
      if (e.stateT >= 0.9) {
        const d0 = this.geo.displayAt({ x: h.x, y: h.y - 20 * s }) || this.geo.nearestDisplay(h);
        for (const sd of [-1, 1]) {
          const x = clamp(h.x + sd * rand(300, 420) * s, d0.work.x + 50 * s, d0.work.x + d0.work.width - 50 * s);
          const y = this.groundAt(x, d0.work.y + d0.work.height - 5);
          this.fx('timeportal', x, y - 60 * s, { size: 2.4 });
          this.spawn('walker', { x, y: y - 40 * s }, { max: 40, silent: true });
          if (chance(0.5)) this.spawn('drone', { x, y: y - 180 * s }, { max: 40, silent: true });
        }
        this.sound('timeWarp', e);
        e.squadAt = this.clock + rand(18000, 24000);
        e.state = 'idle'; e.charge = 0; e.cool = Math.max(e.cool, 1);
      }
    } else if (e.state === 'burst') {
      e.stateT += dt;
      e.charge = 0.6;
      if (e.stateT >= 0.15) {
        e.stateT = 0;
        this.enemyBolt(e, 'chrono', cannon, hc, 640 * s, k.dmg, h, { hitFx: 'flash', hitColor: '80,240,255', hitSize: 0.7, hitSound: 'hit' });
        if (--e.shotsLeft <= 0) { e.state = 'idle'; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]); }
      }
    } else if (e.state === 'charging') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.9, 0, 1);
      if (e.stateT >= 0.9) {
        this.enemyBolt(e, 'timeblast', cannon, hc, 320 * s, 13, h, { size: 2.2, hr: 36, hitFx: 'explosion', hitSize: 1.1 });
        e.state = 'idle'; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]) + 0.6;
      }
    }
  }

  // ---- Galactus: towers over the screen; a Power Cosmic eye beam that sweeps the screen,
  // a drain that pulls the heroes' power out of them, a meteor shower, homing cosmic orbs and
  // an earthquake stomp
  tickGalactus(e, dt, hc, who) {
    const s = this.s, K = this.es(e), h = who || this.hero, k = ENEMY.galactus;
    const eyes = { x: e.x + e.facing * 23 * K, y: e.y - 748 * K };
    const hand = { x: e.x + e.facing * 181 * K, y: e.y - 425 * K };
    const palms = { x: e.x + e.facing * 205 * K, y: e.y - 527 * K };
    if (e.state === 'idle' && e.cool <= 0 && h.mode !== 'down') {
      const r = Math.random();
      if (r < 0.2 && this.heroOnFloor(h) && Math.abs(h.x - e.x) < 1000 * s) { e.state = 'stomp'; e.stateT = 0; this.sound('chargeLong', e); }
      else if (r < 0.45) { e.state = 'charging'; e.stateT = 0; this.sound('cosmicHum', e); this.say(this.hero.line('bossBeam'), 'warn'); }
      else if (r < 0.62 && this.clock >= e.drainAt) { e.state = 'drain'; e.stateT = 0; this.sound('cosmicHum', e); }
      else if (r < 0.82) { e.state = 'meteors'; e.stateT = 0; e.shotsLeft = 8; this.sound('chargeLong', e); this.say(this.hero.line('meteors'), 'warn'); }
      else { e.state = 'orbs'; e.stateT = 0; e.shotsLeft = 4; }
    }
    if (e.state === 'stomp') {
      e.stateT += dt;
      e.charge = clamp(e.stateT / 1.0, 0, 1);
      if (e.stateT >= 1.0) {
        const g = { x: e.x + e.facing * 80 * K, y: e.y };
        this.fx('shockwave', g.x, g.y, { size: 6 });
        this.fx('quake', g.x, g.y, { size: 1 });
        this.sound('boomBig', g);
        this.sound('quake', g);
        this.shakeFloor(1.3, 14);
        for (const hh of this.heroes) if (hh.mode !== 'down' && this.heroOnFloor(hh) && Math.abs(hh.x - g.x) < 1000 * s) this.hurtHero(9, { x: hh.x, y: hh.y - 20 * s }, hh);
        e.state = 'recover'; e.stateT = 0; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]);
      }
    } else if (e.state === 'drain') {
      // purple tendrils from his hands to every hero: power (heat, stamina, web fluid…) flows out
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.6, 0, 1);
      if (e.stateT >= 0.6) {
        if (!e.drains) {
          e.drains = this.heroes.filter((hh) => hh.mode !== 'down').map((hh) => ({ id: hh.id, beam: this.addBeam('drain', palms, hh.chest(), 2.3, 7, 'enemy') }));
          this.sound('drain', e);
          this.say(this.hero.line('drained'), 'warn');
        }
        e.drainTick = (e.drainTick || 0) + dt;
        const tickNow = e.drainTick > 0.25;
        if (tickNow) e.drainTick = 0;
        for (const dr of e.drains) {
          const hh = this.heroes.find((x) => x.id === dr.id);
          if (!hh || hh.mode === 'down') { dr.beam.dur = 0; continue; }
          const c = hh.chest();
          dr.beam.x1 = palms.x; dr.beam.y1 = palms.y; dr.beam.x2 = c.x; dr.beam.y2 = c.y;
          if (tickNow) { hh.power = Math.max(0, hh.power - 1.4); this.hurtHero(0.7, c, hh); }
        }
      }
      if (e.stateT >= 2.8) {
        for (const dr of e.drains || []) this.beams = this.beams.filter((b) => b !== dr.beam);
        e.drains = null;
        e.drainAt = this.clock + rand(12000, 16000);
        e.state = 'recover'; e.stateT = 0; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]);
      }
    } else if (e.state === 'meteors') {
      // an arm raised to the sky: burning rocks rain down around the heroes
      e.stateT += dt;
      e.charge = clamp(e.stateT / 0.7, 0, 1);
      if (e.stateT >= 0.7 && (e.meteorT = (e.meteorT || 0) - dt) <= 0) {
        e.meteorT = 0.2;
        const d0 = this.geo.displayAt({ x: h.x, y: h.y - 20 * s }) || this.geo.nearestDisplay(h);
        const x = clamp(h.x + rand(-300, 300) * s, d0.work.x + 20, d0.work.x + d0.work.width - 20);
        const sz = rand(1.1, 1.8);
        this.addShot({ kind: 'meteor', owner: 'enemy', x: x - e.facing * rand(60, 160) * s, y: d0.work.y - 30, vx: e.facing * rand(60, 150) * s, vy: rand(260, 360) * s, g: 700 * s, dmg: 8, life: 5, size: sz, hr: 30 + 10 * sz, hitFx: 'explosion', hitSize: 0.8 * sz, hitSound: 'boomBig' });
        if (--e.shotsLeft <= 0) { e.state = 'recover'; e.stateT = 0; e.charge = 0; e.meteorT = 0; e.cool = rand(k.fire[0], k.fire[1]); }
      }
    } else if (e.state === 'orbs') {
      e.stateT += dt;
      e.charge = 0.7;
      if (e.stateT >= 0.35) {
        e.stateT = 0;
        this.addShot({ kind: 'cosmic', owner: 'enemy', x: hand.x, y: hand.y, vx: e.facing * rand(80, 200) * s, vy: rand(-160, 40) * s, homing: true, turn: 1.6, vmax: 250, dmg: 8, life: 6, speed: 120 * s, size: 2.2, hitSize: 1.1 });
        this.sound('mystic', hand);
        if (--e.shotsLeft <= 0) { e.state = 'idle'; e.charge = 0; e.cool = rand(k.fire[0], k.fire[1]); }
      }
    } else if (e.state === 'charging' || e.state === 'firing') {
      this.bossBeam(e, dt, hc, eyes, { charge: 1.5, fire: 2.6, w: 18, dmg: 3.2, sweep: 0.65, hit: 36, len: 3200, kind: 'cosmic', color: '200,170,255', core: 'rgba(255,250,255,0.98)', after: [k.fire[0], k.fire[1]] });
    } else if (e.state === 'recover') {
      e.stateT += dt;
      if (e.stateT > 0.6) e.state = 'idle';
    }
  }

  tickShots(dt) {
    const s = this.s;
    const heroes = this.heroes;
    for (const p of [...this.shots]) {
      p.age += dt;
      let dead = p.age > p.life;
      // homing: the hero's missiles, and enemy seekers (`homing`: Doom's bolts, Galactus's orbs)
      if (p.kind === 'missile' || p.kind === 'emissile' || p.homing) {
        let tgt = null;
        if (p.kind === 'missile') {
          let e = p.target && this.enemies.find((x) => x.id === p.target);
          if (!e && this.enemies.length && !p.tp) { e = this.enemies.reduce((a, b) => (dist(b, p) < dist(a, p) ? b : a)); p.target = e.id; }
          tgt = e ? this.enemyCenter(e) : p.tp;
        } else tgt = this.nearestHero(p).chest();
        if (p.age > 0.25 && tgt) {
          const want = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          let a = Math.atan2(p.vy, p.vx);
          let dA = want - a;
          while (dA > Math.PI) dA -= 2 * Math.PI;
          while (dA < -Math.PI) dA += 2 * Math.PI;
          const turn = (p.turn || (p.kind === 'missile' ? 7 : 2.4)) * dt;
          a += clamp(dA, -turn, turn);
          p.speed = Math.min((p.vmax || (p.kind === 'missile' ? 640 : 330)) * s, (p.speed || 100 * s) + 900 * s * dt);
          p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed;
        } else if (!p.homing) { p.vy += 500 * s * dt; }
      }
      if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // hits
      if (p.owner !== 'enemy') {
        for (const e of [...this.enemies]) {
          if (p.hit && p.hit[e.id]) continue;
          const c = this.enemyCenter(e);
          if (dist(c, p) < this.enemyR(e) + (p.r || 5) * s) {
            this.damage(e, p.dmg, p);
            if (p.stun) this.stunEnemy(e, p.stun, p.stunKind);
            if (p.knock && e.hp > 0) this.launchEnemy(e, Math.sign(p.vx || 1) * p.knock * s, -p.knock * 0.45 * s);
            if (p.splash) this.splash(p, p.splash * s, p.splashDmg || p.dmg, e);
            this.fx(p.hitFx || 'explosion', p.x, p.y, { size: p.hitSize || 0.55 });
            this.sound(p.hitSound || 'boom', p);
            if (p.pierce) { p.hit = p.hit || {}; p.hit[e.id] = 1; continue; }
            dead = true;
            break;
          }
        }
        if (!dead && p.tp && dist(p, p.tp) < 14 * s) { this.fx(p.hitFx || 'explosion', p.x, p.y, { size: 0.7 }); this.sound(p.hitSound || 'boom', p); if (p.splash) this.splash(p, p.splash * s, p.splashDmg || p.dmg); dead = true; }
      } else {
        for (const h of heroes) {
          if (h.mode === 'down' || dist(p, h.chest()) >= (p.hr || 26) * h.s) continue;
          this.hurtHero(p.dmg, p, h);
          if (p.kind !== 'laser' && p.kind !== 'glaser') { this.fx(p.hitFx || 'explosion', p.x, p.y, { size: p.hitSize || 0.6, color: p.hitColor }); this.sound(p.hitSound || 'boom', p); }
          dead = true;
          break;
        }
      }
      // (lasers and bolts fly on past the floor; everything else lands)
      if (!dead && p.y >= this.groundAt(p.x, p.y) && p.kind !== 'laser' && !p.bolt) {
        if (p.kind === 'meteor') this.fx('crater', p.x, p.y, { size: p.size || 1 });
        this.fx(p.hitFx || 'explosion', p.x, p.y, { size: p.hitSize || 0.6, color: p.hitColor });
        this.sound(p.hitSound || 'boom', p);
        if (p.owner === 'enemy') {
          for (const h of heroes) if (dist(p, { x: h.x, y: h.y - 30 * s }) < (p.hr ? p.hr * 1.6 : 50) * s) this.hurtHero(p.dmg * 0.5, p, h);
        } else if (p.splash) this.splash(p, p.splash * s, p.splashDmg || p.dmg);
        dead = true;
      }
      if (!dead && !this.geo.inAny(p, -40)) dead = true;
      if (dead) this.shots.splice(this.shots.indexOf(p), 1);
    }
    const t = now();
    this.beams = this.beams.filter((b) => t - b.start < b.dur * 1000);
  }

  tickInvasions() {
    const range = INVASIONS[this.settings.invasions];
    if (!range || this.quiet || this.announcement) { this.nextInvasion = 0; return; }
    const t = now();
    if (!this.nextInvasion) { this.nextInvasion = t + rand(range[0], range[1]) * 1000; return; }
    if (t < this.nextInvasion || this.enemies.length) return;
    this.nextInvasion = t + rand(range[0], range[1]) * 1000;
    const d = pick(this.geo.displays);
    const s = this.s;
    const n = Math.floor(rand(2, 4));
    for (let i = 0; i < n; i++) this.spawn('drone', { x: d.work.x + rand(0.1, 0.9) * d.work.width, y: d.work.y + rand(0.12, 0.3) * d.work.height });
    if (chance(0.4)) this.spawn('walker', { x: d.work.x + (chance(0.5) ? 60 * s : d.work.width - 60 * s), y: d.work.y + d.work.height * 0.5 });
    this.say(this.hero.line('invasion'), 'warn');
  }

  // ------------------------------------------------------------ the nuke
  // Siren → bomb falls → detonation → a shockwave sweeps the whole screen (and
  // the next one). Everything on the target screen is destroyed; heroes try to
  // escape to another screen and get thrown when the wave reaches them.
  startNuke(p) {
    if (this.nuke) return false;
    const geo = this.geo, s = this.s;
    const d = geo.displayAt(p) || geo.nearestDisplay(p) || geo.primary;
    // ground burst: the bomb comes down on the floor below the chosen spot
    const gz = { x: clamp(p.x, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s), y: d.work.y + d.work.height - 2 };
    let rMax = 0;
    for (const q of geo.displays) for (const [cx, cy] of [[q.bounds.x, q.bounds.y], [q.bounds.x + q.bounds.width, q.bounds.y], [q.bounds.x, q.bounds.y + q.bounds.height], [q.bounds.x + q.bounds.width, q.bounds.y + q.bounds.height]]) rMax = Math.max(rMax, Math.hypot(cx - gz.x, cy - gz.y));
    const t = this.clock;
    this.nuke = { id: uid('n'), did: d.id, x: gz.x, y: gz.y, start: t, det: t + 5000, dropAt: t + 3100, rMax: rMax + 200, speed: 1050, hit: {}, detonated: false, passed: false };
    this.counters.nukes++;
    this.sound('siren', gz);
    this.lockId = null;
    for (const h of this.heroes) if (h.mode !== 'held' && h.mode !== 'down') h.run(h.taskEvacuate(), 'evacuate', 98);
    this.dirty();
    return true;
  }

  nukeRadius() {
    const n = this.nuke;
    return n && n.detonated ? ((this.clock - n.det) / 1000) * n.speed : 0;
  }

  // the safest place: the far side of another screen, or the far side of this one
  safeSpot(h) {
    const n = this.nuke, geo = this.geo, s = this.s;
    const gz = { x: n.x, y: n.y };
    const target = geo.displays.find((d) => d.id === n.did) || geo.primary;
    const others = geo.displays.filter((d) => d !== target);
    const cand = [];
    const consider = (d) => {
      for (const fx of [0.12, 0.5, 0.88]) {
        const x = d.work.x + d.work.width * fx;
        cand.push({ x, y: this.groundAt(x, d.work.y + d.work.height - 5) });
      }
    };
    if (others.length) others.forEach(consider); else consider(target);
    cand.sort((a, b) => dist(b, gz) - dist(a, gz));
    const best = cand[0];
    // spread the suits out a little
    return { x: best.x + (h.ally ? rand(-90, 90) * s : 0), y: best.y };
  }

  tickNuke() {
    const n = this.nuke;
    if (!n) return;
    const t = this.clock, s = this.s;
    if (!n.whistled && t >= n.dropAt) { n.whistled = true; this.sound('bombWhistle', n); }
    if (!n.detonated && t >= n.det) {
      n.detonated = true;
      this.sound('nukeBoom', n);
      this.fx('nuke', n.x, n.y, {});
      this.dirty();
    }
    if (!n.detonated) return;
    const r = this.nukeRadius();
    const target = this.geo.displays.find((d) => d.id === n.did);
    const inTarget = (p) => target && p.x >= target.bounds.x && p.x <= target.bounds.x + target.bounds.width && p.y >= target.bounds.y && p.y <= target.bounds.y + target.bounds.height;
    // the wave front destroys / batters everything it passes
    for (const e of [...this.enemies]) {
      if (n.hit[e.id]) continue;
      const c = this.enemyCenter(e);
      if (r < dist(c, n)) continue;
      n.hit[e.id] = 1;
      if (inTarget(c)) this.kill(e);
      else {
        this.damage(e, e.maxHp * 0.6, n, true);
        if (e.hp > 0) { const a = Math.atan2(c.y - n.y, c.x - n.x); e.vx += Math.cos(a) * 500 * s; if (e.air) e.vy += Math.sin(a) * 300 * s; }
      }
    }
    for (const sh of [...this.shots]) if (dist(sh, n) < r && inTarget(sh)) this.shots.splice(this.shots.indexOf(sh), 1);
    for (const h of this.heroes) {
      if (n.hit[h.id]) continue;
      const c = h.chest();
      const d = dist(c, n);
      if (r < d) continue;
      n.hit[h.id] = 1;
      const close = inTarget(c);
      const f = clamp(1 - d / n.rMax, 0.15, 1);
      const a = d < 5 ? -Math.PI / 2 + rand(-0.6, 0.6) : Math.atan2(c.y - n.y, c.x - n.x);
      const sp = (close ? 1250 : 650 + 600 * f) * s;
      const dmg = close ? 55 + 30 * f : 10 + 25 * f;
      h.throwBy(Math.cos(a) * sp, Math.min(Math.sin(a) * sp, 0) - (close ? 520 : 360) * s, dmg);
      this.sound('shockHit', c);
    }
    if (!n.passed && r > n.rMax) {
      n.passed = true;
      this.hero.say(this.hero.line(this.enemies.length ? 'nukeStill' : 'nukeClear'));
    }
    if (t - n.det > 16000) { this.nuke = null; this.dirty(); }
  }

  // ------------------------------------------------------------ army attack
  startArmy(o) {
    const geo = this.geo, s = this.s;
    let d = o.display != null ? geo.displays.find((q) => String(q.id) === String(o.display)) : null;
    if (!d && o.x != null) d = geo.displayAt({ x: o.x, y: o.y }) || geo.nearestDisplay({ x: o.x, y: o.y });
    if (!d) d = geo.primary;
    if (this.army) return false;
    const total = clamp(Math.round(ARMY_SIZES[o.size] || Number(o.size) || 20), 1, 1000);
    const side = ['left', 'right', 'top', 'both'].includes(o.side) ? o.side : 'right';
    const queue = [];
    const bosses = total >= 200 ? Math.round(total / 125) : total >= 50 ? 2 : total >= 35 ? 1 : 0;
    for (let i = 0; i < total - bosses; i++) {
      const r = Math.random();
      queue.push(r < 0.5 ? 'walker' : r < 0.78 ? 'drone' : r < 0.9 ? 'tank' : 'mini');
    }
    // the villains lead it: they arrive with the second half (spread through a huge army)
    const first = Math.floor(Math.random() * BOSSES.length);
    const villain = (b) => BOSSES[(first + b) % BOSSES.length];
    if (bosses > 2) for (let b = 0; b < bosses; b++) queue.splice(Math.floor(queue.length * (0.08 + 0.9 * b / bosses)), 0, villain(b));
    else for (let b = 0; b < bosses; b++) queue.splice(Math.floor(queue.length * (0.45 + 0.4 * b)), 0, villain(b));
    // …and a legendary battle ends with Galactus himself
    if (total >= 1000) queue[queue.length - 1] = 'galactus';
    const legion = this.allyCount(total);
    const t = this.clock;
    const huge = total >= 200;
    this.army = { id: uid('a'), did: d.id, side, total, queue, spawned: 0, start: t, nextAt: t + 1400, legion, legionAt: t + 2200, called: 0, lastSide: 'left', huge, mark: 0 };
    this.counters.armies++;
    this.hero.say(this.hero.line('army', total), 'warn');
    this.sound('warHorn', { x: d.work.x + d.work.width / 2, y: d.work.y + 200 });
    this.dirty();
    return true;
  }

  tickArmy(dt) {
    const a = this.army;
    if (!a) return;
    const t = this.clock, s = this.s, geo = this.geo;
    const d = geo.displays.find((q) => q.id === a.did) || geo.primary;
    // a huge army attacks in waves: a front line on screen, the rest behind it
    const front = a.huge ? 45 : 70;
    if (a.huge) for (const h of this.heroes) if (h.mode !== 'down' && h.armor > 0) h.armor = Math.min(100, h.armor + 2 * (dt || 0));
    if (a.queue.length && t >= a.nextAt && this.enemies.length < front) {
      const side = a.side === 'both' ? (a.lastSide = a.lastSide === 'left' ? 'right' : 'left') : a.side;
      const squad = a.huge ? Math.floor(rand(2, 5)) : 1;
      let last = '';
      for (let i = 0; i < squad && a.queue.length && this.enemies.length < front; i++) {
        let kind = a.queue[0];
        if (ENEMY[kind].giant && this.enemies.length > 6) break; // Galactus waits for the field to clear
        if (ENEMY[kind].boss && !ENEMY[kind].giant && this.enemies.filter(isBoss).length >= 2) {
          // two villains on the field is plenty: hold this one back a little
          a.queue.splice(Math.min(a.queue.length, 12), 0, a.queue.shift());
          kind = a.queue[0];
          if (ENEMY[kind].boss) break;
        }
        a.queue.shift();
        last = kind;
        const w = d.work;
        let p;
        if (side === 'top') p = { x: w.x + rand(0.08, 0.92) * w.width, y: w.y + rand(70, 140) * s };
        else {
          const x = side === 'left' ? w.x + rand(12, 70) * s : w.x + w.width - rand(12, 70) * s;
          const air = ENEMY[kind].air;
          p = { x, y: air ? w.y + rand(0.15, 0.6) * w.height : w.y + w.height - 10 };
        }
        const boss = ENEMY[kind].boss;
        const e = this.spawn(kind, p, { max: 75, silent: a.spawned > 0 && !boss });
        if (e) {
          if (side !== 'top' && !e.air && !ENEMY[kind].giant) e.vx = (side === 'left' ? 1 : -1) * 40 * s;
          if (side !== 'top' && e.air) e.vx = (side === 'left' ? 1 : -1) * 260 * s;
          if (a.huge && !boss) { e.hp *= 0.6; e.maxHp = e.hp; } // a huge battle is about numbers: lighter grunts
          if (i === 0 && !boss) this.fx('portal', e.x, this.enemyCenter(e).y, {});
          if (boss && a.huge) this.hero.say(this.hero.line('armyBoss'), 'warn');
        }
        a.spawned++;
      }
      a.nextAt = t + (ENEMY[last] && ENEMY[last].boss ? 900 : a.huge ? rand(380, 620) : rand(160, 320));
    }
    // milestones in a big battle
    if (a.huge) {
      const done = a.total - a.queue.length - this.enemies.length;
      const m = Math.floor((done / a.total) * 4);
      if (m > a.mark && m < 4) {
        a.mark = m;
        this.hero.say(this.hero.line('milestone', m, done));
        this.sound('hudBeep', this.hero);
      }
    }
    // the hero calls in allies (the Iron Legion…)
    if (a.called < a.legion && t >= a.legionAt) {
      if (a.called === 0) { this.hero.say(this.hero.line('callAllies')); this.sound(this.H.ALLIES.callSound || 'hudBeep', this.hero); }
      this.spawnAlly(a);
      a.called++;
      a.legionAt = t + rand(350, 650);
    } else if (a.called >= a.legion && this.allies.length < a.legion && a.queue.length && t >= a.legionAt) {
      // a suit went down: send a replacement
      if (this.spawnAlly(a)) this.hero.say(this.hero.line('allyReplace'));
      a.legionAt = t + rand(6000, 9000);
    }
    if (!a.queue.length && !this.enemies.length && t - a.start > 3000) {
      this.counters.armiesWon++;
      this.hero.say(this.hero.line('armyWon'));
      this.sound('reboot', this.hero);
      this.army = null;
      this.dirty();
    }
  }

  // how many allies answer the call for an army of `total` (0 for a hero who fights alone)
  allyCount(total) {
    const A = this.H.ALLIES;
    return A ? Math.min(A.max || MAX_LEGION, legionFor(total)) : 0;
  }

  spawnAlly(a, near) {
    const geo = this.geo, s = this.s, A = this.H.ALLIES;
    if (!A || this.allies.length >= (A.max || MAX_LEGION)) return null;
    const d = (a && geo.displays.find((q) => q.id === a.did)) || geo.displayAt({ x: this.hero.x, y: this.hero.y - 40 * s }) || geo.primary;
    // A.looks: [[look, callsign|null], ...] — each ally wears a different look from the main hero
    const used = new Set(this.allies.map((x) => x.suit));
    const mine = this.settings[this.H.LOOK_KEY];
    const look = A.looks.find((l) => !used.has(l[0]) && l[0] !== mine) || pick(A.looks);
    const suit = look[0];
    const callsign = look[1] || `MK-${pick(['II', 'XVII', 'XXI', 'XXXIII', 'XL', 'XXVI', 'XV', 'XXXV', 'XLVI'])}`;
    // they come in from the side opposite the enemy (or from the sky)
    const from = a && a.side === 'left' ? 'right' : a && a.side === 'right' ? 'left' : chance(0.5) ? 'left' : 'right';
    const x = from === 'left' ? d.work.x + rand(40, 140) * s : d.work.x + d.work.width - rand(40, 140) * s;
    const h = new this.H(this, { power: 100, armor: 100, missiles: 12, x, y: d.work.y + 110 * s }, { id: uid('h'), ally: true, suit, callsign });
    h.mode = 'air';
    h.facing = from === 'left' ? 1 : -1;
    h.vx = h.facing * 300 * s; h.vy = 120 * s;
    const target = { x: d.work.x + d.work.width * (from === 'left' ? rand(0.2, 0.4) : rand(0.6, 0.8)), y: d.work.y + d.work.height * rand(0.35, 0.6) };
    h.run(h.taskAllyArrive(near || target), 'arrive', 70);
    this.allies.push(h);
    this.counters.legion++;
    this.sound(A.sound || 'thrustOn', h);
    this.fx('flash', x, h.y - 50 * s, { size: 1, color: A.color || '120,225,255' });
    this.dirty();
    return h;
  }

  removeAlly(h, flyAway) {
    const i = this.allies.indexOf(h);
    if (i < 0) return;
    this.allies.splice(i, 1);
    if (h.task) { try { h.task.return(); } catch (e) { /* */ } }
    if (flyAway) this.fx('flash', h.x, h.y - 50 * this.s, { size: 0.8, color: (this.H.ALLIES && this.H.ALLIES.color) || '120,225,255' });
    this.dirty();
  }

  destroyAlly(h) {
    const c = h.chest();
    this.fx('explosion', c.x, c.y, { size: 1.3 });
    this.sound('boomBig', c);
    this.hero.say(this.hero.line('allyDown', h.callsign), 'warn');
    this.removeAlly(h);
    if (this.army) this.army.legionAt = Math.max(this.army.legionAt, this.clock + 5000);
  }

  // ------------------------------------------------------------ input
  setCursor(p, dt) {
    const vx = (p.x - this.cursor.x) / Math.max(dt, 0.001), vy = (p.y - this.cursor.y) / Math.max(dt, 0.001);
    const k = 1 - Math.exp(-dt * 14);
    const nvx = lerp(this.cursorVel.x, vx, k), nvy = lerp(this.cursorVel.y, vy, k);
    const ak = 1 - Math.exp(-dt * 10);
    this.cursorAcc.x = lerp(this.cursorAcc.x, (nvx - this.cursorVel.x) / Math.max(dt, 0.001), ak);
    this.cursorAcc.y = lerp(this.cursorAcc.y, (nvy - this.cursorVel.y) / Math.max(dt, 0.001), ak);
    this.cursorVel.x = nvx; this.cursorVel.y = nvy;
    if (p.x !== this.cursor.x || p.y !== this.cursor.y) this.cursorMovedAt = now();
    this.cursor = { x: p.x, y: p.y };
  }
  cursorBusy() { return now() - this.cursorMovedAt < 1500; }

  heroBox() {
    const h = this.hero, s = h.s;
    if (h.box) return h.box();
    if (h.mode === 'held') return { x: h.x - 20 * s, y: h.y - 104 * s, w: 40 * s, h: 104 * s };
    if (h.pose === 'fly') return { x: h.x - 50 * s, y: h.y - 78 * s, w: 100 * s, h: 50 * s };
    if (h.pose === 'down') return { x: h.x - 50 * s, y: h.y - 26 * s, w: 100 * s, h: 28 * s };
    return { x: h.x - 18 * s, y: h.y - 98 * s, w: 36 * s, h: 100 * s };
  }
  hitHero(p) { const b = this.heroBox(); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }
  enemyAt(p) {
    const s = this.s;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (dist(this.enemyCenter(e), p) < this.enemyR(e) + 6 * s) return e;
    }
    return null;
  }

  isInteractive(p) {
    if (this.press) return true;
    if (this.hidden) return false;
    return this.hitHero(p) || !!this.enemyAt(p);
  }

  cursorStyle(p) {
    if (this.press && this.hero.mode === 'held') return 'grabbing';
    if (this.hitHero(p)) return 'grab';
    if (this.enemyAt(p)) return 'crosshair';
    return 'default';
  }

  pointerDown(p, button) {
    if (button !== 0) return;
    if (this.hitHero(p) && this.hero.mode !== 'down') { this.press = { target: 'hero', x: p.x, y: p.y, t: now() }; return; }
    const e = this.enemyAt(p);
    if (e) {
      this.lockId = e.id;
      this.say(this.hero.line('locked', ENEMY[e.kind].label));
      this.sound('lock', e);
      const h = this.hero;
      if (h.taskName !== 'combat' && h.mode !== 'down') h.interrupt(h.taskCombat(), 'combat', 80);
      this.dirty();
    }
  }

  pointerUp(p, button) {
    const pr = this.press;
    this.press = null;
    if (!pr) return;
    const h = this.hero;
    if (h.mode === 'held') { h.release(); return; }
    h.clicks.push(now());
    h.clicks = h.clicks.filter((t) => now() - t < 4000);
    if (h.taskPrio <= 45) h.run(h.taskGreet(true), 'greet', 45);
    else this.say(h.line('greet'));
  }

  tickPress() {
    const pr = this.press;
    if (pr && pr.target === 'hero' && this.hero.mode !== 'held' && dist(this.cursor, pr) > 6) this.hero.startHold();
  }

  contextAt(p) {
    return { onCat: this.hitHero(p), onEnemy: !!this.enemyAt(p), dead: false };
  }

  // ------------------------------------------------------------ commands
  command(name, a = {}) {
    const h = this.hero, s = h.s;
    const at = a.x != null ? { x: a.x, y: a.y } : { x: h.x + h.facing * 200 * s, y: h.y - 160 * s };
    const free = h.mode !== 'held' && h.mode !== 'down';
    switch (name) {
      case 'spawn': {
        const kind = ENEMY[ENEMY_ALIAS[a.kind] || a.kind] ? ENEMY_ALIAS[a.kind] || a.kind : 'drone';
        if (kind === 'mini') {
          for (let i = 0; i < 6; i++) this.spawn('mini', { x: at.x + rand(-80, 80) * s, y: at.y + rand(-50, 50) * s });
        } else this.spawn(kind, at);
        break;
      }
      case 'clearEnemies':
        for (const e of [...this.enemies]) this.kill(e, true);
        this.shots = []; this.beams = []; this.strikes = [];
        break;
      case 'quiet':
        this.quiet = a.value != null ? !!a.value : !this.quiet;
        if (this.quiet) { for (const e of [...this.enemies]) this.kill(e, true); this.shots = []; this.strikes = []; this.army = null; this.nuke = null; for (const x of [...this.allies]) this.removeAlly(x, true); }
        if (free) h.run(this.quiet ? h.taskQuiet() : h.taskIdle(1), this.quiet ? 'quiet' : 'idle', 95);
        this.dirty();
        break;
      case 'nuke': {
        let p = at;
        if (a.display != null) {
          const d = this.geo.displays.find((q) => String(q.id) === String(a.display));
          if (d) p = { x: d.work.x + d.work.width / 2, y: d.work.y + d.work.height * 0.55 };
        }
        this.startNuke(p);
        break;
      }
      case 'army': this.startArmy({ ...a, x: a.x != null ? a.x : null, y: a.y }); break;
      case 'callAllies':
      case 'callLegion': {
        const A = this.H.ALLIES;
        if (!A) break;
        const n = Math.max(1, Math.min((A.max || MAX_LEGION) - this.allies.length, a.count || 3));
        const fake = { did: (this.geo.displayAt({ x: h.x, y: h.y - 40 * s }) || this.geo.primary).id, side: chance(0.5) ? 'left' : 'right' };
        for (let i = 0; i < n; i++) this.spawnAlly(fake);
        this.say(h.line('formUp'));
        break;
      }
      case 'dismissAllies':
      case 'dismissLegion': for (const x of [...this.allies]) x.run(x.taskAllyLeave(), 'leave', 75); break;
      case 'repair+recharge': h.onCommand('repair', at, a, free); h.onCommand('recharge', at, a, free); break;
      case 'stopTool': break;
      default: h.onCommand(name, at, a, free); break;
    }
  }

  onSetting(key) {
    if (key === this.H.SIZE_KEY) this.placeOnScreen(false);
  }

  activate() {
    const h = this.hero;
    h.run(h.taskArrive(), 'arrive', 90);
    this.dirty();
  }

  deactivate() {
    for (const e of [...this.enemies]) this.kill(e, true);
    for (const x of [...this.allies]) this.removeAlly(x);
    this.shots = []; this.beams = []; this.strikes = []; this.press = null; this.nuke = null; this.army = null; this.screenFlash = null; this.quake = null;
    const h = this.hero;
    h.frozen = 0;
    if (h.task) { try { h.task.return(); } catch (e) { /* */ } }
    h.task = null; h.taskName = null; h.taskPrio = 0;
    if (h.mode === 'held' || h.mode === 'fall' || h.mode === 'down' || h.mode === 'thrown') { h.mode = 'ground'; h.spin = 0; h.armor = Math.max(h.armor, 35); h.eyes = 1; }
  }

  // ------------------------------------------------------------ reminders
  announce(a) {
    this.announcement = { ...a, start: now() };
    const h = this.hero;
    if (h.mode === 'held') h.release();
    if (h.mode !== 'down') h.run(h.taskAnnounce(), 'announce', 96);
    this.dirty();
  }

  clearAnnouncement(id) {
    if (this.announcement && (id == null || this.announcement.id === id)) { this.announcement = null; this.dirty(); }
  }

  // ------------------------------------------------------------ tick & state
  tick(dt, realGap) {
    if (this.hidden) return;
    this.now = now();
    if (realGap && realGap > 5) { this.clock = now(); return; }
    this.clock += dt * 1000;
    this.tickPress();
    this.hero.tick(dt);
    for (const a of [...this.allies]) a.tick(dt);
    if (!this.quiet) {
      this.tickArmy(dt);
      this.tickEnemies(dt);
      this.tickShots(dt);
      this.tickNuke();
      this.tickInvasions();
    }
    const t = this.now;
    for (const h of this.heroes) h.hud = h.hud.filter((x) => t - x.start < 2600);
    if (this.diag && t - this.diag.start > 8000) this.diag = null;
  }

  applyAway() { /* the suit doesn't get hungry */ }

  wantsFast() {
    const h = this.hero;
    return !!(this.press || h.mode !== 'ground' || this.enemies.length || this.shots.length || this.beams.length || this.strikes.length || h.speed > 1 || this.allies.length || this.nuke || this.army);
  }

  activeIn(near) {
    const h = this.hero;
    if (near({ x: h.x, y: h.y - 50 }, 260)) return true;
    if (this.enemies.some((e) => near(e, 200)) || this.shots.some((p) => near(p, 60)) || this.beams.length) return true;
    if (this.announcement || this.nuke || this.army) return true;
    if (this.allies.some((a) => near({ x: a.x, y: a.y - 50 }, 260))) return true;
    return false;
  }

  info() {
    return { name: this.H.NAME, status: this.hero.statusText(), dead: false };
  }

  wall(tc) { return now() - (this.clock - tc); } // simulation time → wall-clock time

  heroSnap(h) {
    return {
      id: h.id, ally: h.ally, suit: h.suit, callsign: h.callsign, hud: h.hud,
      x: h.x, y: h.y, vx: h.vx, vy: h.vy, facing: h.facing, mode: h.mode, pose: h.pose, poseStart: h.poseStart,
      aim: h.aim, aimArm: h.aimArm, charge: h.charge, beam: h.beamK, eyes: h.eyes, swing: h.swing, spin: h.spin, dist: h.dist, speed: h.speed,
      power: h.power, armor: h.armor, missiles: h.missiles, hitAt: h.hitAt, status: h.statusText(), task: h.taskName, frozen: h.frozen || 0,
      ground: this.groundAt(h.x, h.y), body: this.H.BODY, meters: h.ally ? null : h.meters(),
      ...(h.snapExtra() || {}),
    };
  }

  snapshot() {
    const h = this.hero;
    const t = now();
    const n = this.nuke, a = this.army;
    return {
      t, s: this.s, character: this.character, ver: this.ver,
      hero: this.heroSnap(h),
      allies: this.allies.map((x) => this.heroSnap(x)),
      nuke: n && { id: n.id, did: n.did, x: n.x, y: n.y, start: this.wall(n.start), det: this.wall(n.det), dropAt: this.wall(n.dropAt), speed: n.speed, rMax: n.rMax, detonated: n.detonated },
      army: a && { id: a.id, did: a.did, side: a.side, total: a.total, left: a.queue.length + this.enemies.length, legion: this.allies.length, start: this.wall(a.start) },
      enemies: this.enemies.map((e) => ({ id: e.id, kind: e.kind, x: e.x, y: e.y, vx: e.vx, vy: e.vy, facing: e.facing, hp: e.hp, maxHp: e.maxHp, phase: e.phase, charge: e.charge, hitAt: e.hitAt, aim: e.aim, air: e.air, born: e.born, stun: e.stun || 0, stunKind: e.stunKind || null, spin: e.spin || 0, launch: !!e.launch, grabbed: !!e.grabbed, state: e.state, stateT: e.stateT || 0, k: e.k || 1, shield: e.shield || 0, warp: e.warpT || 0, beamAng: e.state === 'firing' ? e.beamAng : null })),
      flash: this.screenFlash && { at: this.wall(this.screenFlash.at), dur: this.screenFlash.dur, color: this.screenFlash.color },
      quake: this.quake && { at: this.wall(this.quake.at), dur: this.quake.dur, px: this.quake.px },
      strikes: this.strikes.map((st) => ({ x: st.x, y: st.y, at: this.wall(st.at) })),
      shots: this.shots.map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y, vx: p.vx, vy: p.vy, owner: p.owner, age: p.age, size: p.size || 1 })),
      beams: this.beams,
      hud: h.hud,
      diag: this.diag,
      lockId: this.lockId,
      announce: this.announcement,
      primaryWork: this.geo.primary ? this.geo.primary.work : null,
      cursor: this.cursor, cursorVel: this.cursorVel,
      tool: null,
      quiet: this.quiet,
      sound: this.settings.sound, volume: this.settings.volume, voice: this.settings.voice !== false,
      suit: this.settings.suit || 'classic',
      look: this.settings[this.H.LOOK_KEY] || null,
      ents: null,
    };
  }

  // what each army size means for this hero (shown in the army dialogs)
  armyNotes() {
    return Object.fromEntries(Object.keys(ARMY_SIZES).map((k) => [k, this.H.UI.armyNote(this.allyCount(ARMY_SIZES[k]), k)]));
  }

  homeState() {
    const h = this.hero, U = this.H.UI;
    return {
      character: this.character,
      army: !!this.army, nuke: !!this.nuke, allies: this.allies.length,
      displays: this.geo.displays.map((d, i) => ({ id: d.id, label: `Screen ${i + 1}${d.primary ? ' (main)' : ''}` })),
      hero: { name: this.H.NAME, title: U.title, status: h.statusText(), power: h.power, armor: h.armor, missiles: h.missiles, mode: h.mode, meters: h.meters() },
      ui: {
        quick: U.quick, stats: U.stats, help: U.help, looks: U.looks || null, sizeKey: this.H.SIZE_KEY,
        hasAllies: !!this.H.ALLIES, armyNotes: this.armyNotes(),
      },
      enemies: this.enemies.length,
      counters: this.counters,
      settings: this.settings,
      quiet: this.quiet,
    };
  }

  serialize() {
    return { hero: this.hero.serialize(), counters: this.counters, quiet: this.quiet };
  }
}

Hero.SIZE_KEY = 'ironSize';  // setting that sizes this hero
Hero.LOOK_KEY = 'suit';      // setting that picks the look (suit colors)
Hero.DEFAULTS = { suit: 'classic', ironSize: 'small' };
Hero.WELCOME = 'Right-click Iron Man for the suit menu — deploy enemies, launch an army attack or set a reminder.';
Hero.HOME = 'HQ';            // what the home window is called for this hero
// how a reminder is delivered
Hero.REMINDER = {
  header: 'MISSION BRIEFING',
  quips: [
    'Clock\'s ticking. I\'d do it myself, but someone has to keep the skies safe.',
    'Suit\'s ready. Are you? Let\'s get it done.',
    'I ran the numbers. Yep — it\'s definitely time.',
    'Priority one. Everything else can wait.',
    'Consider this your official call to action.',
    'No pressure. Just the fate of your to-do list.',
    'Systems green. Go time.',
    'Mission parameters are clear. Execute.',
  ],
  speech: (when, text, quip) => `Heads up. It's ${when}. ${text}. ${quip}`,
  notify: (text) => `⏰ Mission: ${text}`,
};
// allies called in an army battle: looks [[look, callsign]] (callsign null = random MK-number)
Hero.ALLIES = {
  max: MAX_LEGION, color: '120,225,255',
  looks: ['silver', 'stealth', 'patriot', 'gold', 'midnight', 'arctic', 'gunmetal', 'classic'].map((k) => [k, null]),
};

// the armored hero's world (what main.js and the tests used to construct)
class IronWorld extends HeroWorld {
  constructor(o) { super({ ...o, heroClass: Hero }); }
}

// helpers for hero subclasses (heroes/*.js)
const util = { rand, chance, pick, clamp, lerp, dist, now, num, segDist, uid, isBoss };

module.exports = { HeroWorld, IronWorld, Hero, ENEMY, ENEMY_ALIAS, BOSSES, isBoss, DEFAULT_IRON, SIZES, ARMY_SIZES, IRON_LINES, util };
