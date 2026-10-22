'use strict';
/*
 * Desktop Buddies — Spider-Man (an original fan-made drawing for personal use;
 * the character belongs to Marvel).
 *
 * He can't fly. He runs along the floor of the screens and gets anywhere higher
 * by web-swinging — pendulum arcs on webs stuck to the top edge of the screen —
 * or by zipping up a line. He hangs upside-down from a thread, webs enemies up
 * (webbed flyers sink to the floor, webbed walkers can't shoot), zips in for
 * kicks, yanks drones down into the floor, swings a walker into its friends,
 * throws impact webs, and calls the Spider-Verse into big battles.
 *
 * (x, y) is still the point between his feet. While he hangs from his wrist the
 * web runs from his hand (HANG units up his body) to `anchor`; upside-down it
 * runs from his feet.
 */
const { Hero, ENEMY, util } = require('../ironman');
const { rand, chance, pick, clamp, lerp, dist, isBoss } = util;

const HANG = 100;   // feet → web-shooter along his body, in hero units
const G = 1500;     // gravity for jumps and drops (DIP/s² at size 1)
const IMPACT_MAX = 6;

// [look, label, swatch] — the main hero's suits; the Spider-Verse allies wear the others
const LOOKS = [
  ['classic', 'Classic red & blue', 'linear-gradient(135deg,#d71f2b 55%,#2348b0 55%)'],
  ['symbiote', 'Black suit', 'linear-gradient(135deg,#1d1e25 60%,#f4f6fb 60%)'],
  ['iron', 'Iron Spider', 'linear-gradient(135deg,#c41a22 55%,#e2a82c 55%)'],
  ['miles', 'Black & red (Miles)', 'linear-gradient(135deg,#1d1e25 60%,#e0232f 60%)'],
  ['gwen', 'Ghost-Spider (Gwen)', 'linear-gradient(135deg,#f4f5f8 55%,#ff5fa2 55%)'],
  ['m2099', '2099', 'linear-gradient(135deg,#1d2f8e 60%,#d01d1d 60%)'],
  ['noir', 'Noir', 'linear-gradient(135deg,#3d3c42 60%,#9a9690 60%)'],
];

class SpiderHero extends Hero {
  constructor(w, d, o) {
    super(w, d, o);
    d = d || {};
    this.missiles = clamp(Number.isFinite(d.missiles) ? d.missiles : IMPACT_MAX, 0, IMPACT_MAX);
    this.callsign = (o && o.callsign) || 'SPIDEY';
    this.cd = { zip: 0, yank: 0, impact: 0, throw: 0, dodge: 0 };
    this.anchor = null;      // where the web he hangs from is stuck { x, y }
    this.attach = 'hand';    // 'hand' (hanging from his wrist) | 'feet' (upside-down)
    this.ropeAng = 0;        // web angle from vertical, + = anchor to his right (screen)
    this.tetherE = null;     // id of the enemy a second web is stuck to (yank, zip-kick, throw)
    this.tether = null;      // that web's far end { x, y }
    this.flipRot = 0;        // somersault angle (radians, + = forward)
    this.impacts = [];       // impact webs in flight: they snare everything where they burst
    this.lastCartAt = Date.now();
  }

  // allies never get destroyed: at the end of their strength they tap out through a portal
  get armor() { return this._armor; }
  set armor(v) { this._armor = this.ally && v <= 0 ? 0.5 : v; }

  // ------------------------------------------------------------ where things are
  floorAt(x, y) { return this.w.groundAt(x, y == null ? this.y : y); }

  ceilAt(x, y) {
    const geo = this.w.geo;
    y = y == null ? this.y : y;
    let d = geo.displays.find((q) => x >= q.bounds.x && x <= q.bounds.x + q.bounds.width && y >= q.bounds.y - 2 && y <= q.bounds.y + q.bounds.height + 2);
    if (!d) d = geo.displays.find((q) => x >= q.bounds.x && x <= q.bounds.x + q.bounds.width);
    if (!d) d = geo.nearestDisplay({ x, y });
    return d ? d.work.y + 2 : y - 600;
  }

  // the highest his feet can be while he hangs from his wrist
  minHang(x, y) { return this.ceilAt(x, y) + (HANG + 40) * this.s; }

  // the height his feet cruise at when he swings past x
  cruiseY(x, y) {
    const s = this.s, f = this.floorAt(x, y), c = this.ceilAt(x, y);
    return clamp(f - clamp((f - c) * 0.32, 150 * s, 300 * s), c + (HANG + 60) * s, f - 60 * s);
  }

  disp() { const g = this.w.geo; return g.displayAt({ x: this.x, y: this.y - 40 * this.s }) || g.nearestDisplay(this) || g.primary; }

  // unit vector from his feet toward his head
  axis() {
    if (this.mode === 'down') return { x: -this.facing, y: 0 };
    if (this.anchor && this.mode === 'air') {
      if (this.attach === 'feet') return { x: 0, y: 1 };
      const dx = this.anchor.x - this.x, dy = this.anchor.y - this.y, d = Math.hypot(dx, dy) || 1;
      return { x: dx / d, y: dy / d };
    }
    if (this.flipRot) return { x: Math.sin(this.flipRot) * this.facing, y: -Math.cos(this.flipRot) };
    return { x: 0, y: -1 };
  }

  along(k) { const a = this.axis(), s = this.s; return { x: this.x + a.x * k * s, y: this.y + a.y * k * s }; }
  chest() { const p = this.along(60); return { x: p.x + this.facing * 2 * this.s, y: p.y }; }

  // the web-shooter, reaching toward tp
  wrist(tp) {
    const s = this.s, sh = this.along(74);
    if (!tp) return { x: sh.x + this.facing * 24 * s, y: sh.y + 8 * s };
    const dx = tp.x - sh.x, dy = tp.y - sh.y, d = Math.hypot(dx, dy) || 1;
    return { x: sh.x + dx / d * 26 * s, y: sh.y + dy / d * 26 * s };
  }

  // where the web he hangs from leaves his body
  grip() {
    if (!this.anchor || this.attach === 'feet') return { x: this.x, y: this.y };
    const dx = this.anchor.x - this.x, dy = this.anchor.y - this.y, d = Math.hypot(dx, dy) || 1;
    const k = Math.min(HANG * this.s, d - 4 * this.s) / d;
    return { x: this.x + dx * k, y: this.y + dy * k };
  }

  box() {
    const s = this.s, x = this.x, y = this.y;
    if (this.mode === 'held') return { x: x - 18 * s, y: y - 104 * s, w: 36 * s, h: 104 * s };
    if (this.mode === 'down') return { x: x - 50 * s, y: y - 24 * s, w: 100 * s, h: 26 * s };
    if (this.anchor && this.attach === 'feet' && this.mode === 'air') return { x: x - 18 * s, y, w: 36 * s, h: 104 * s };
    if (this.mode === 'air') { const c = this.chest(); return { x: c.x - 30 * s, y: c.y - 46 * s, w: 60 * s, h: 92 * s }; }
    return { x: x - 16 * s, y: y - 96 * s, w: 32 * s, h: 98 * s };
  }

  // ------------------------------------------------------------ webs
  attachAt(ax, ay, how) {
    const fresh = !this.anchor || Math.abs(this.anchor.x - ax) > 2 || Math.abs(this.anchor.y - ay) > 2;
    this.anchor = { x: ax, y: ay };
    this.attach = how || 'hand';
    if (fresh) {
      this.power = Math.max(0, this.power - 0.6);
      this.w.sound('spThwip', { x: ax, y: ay + 40 });
      this.w.fx('webAnchor', ax, ay, {});
    }
  }

  // grab a web straight above (when he's in the air without one)
  catchWeb(ax) {
    const s = this.s;
    const x = ax == null ? this.x + clamp(this.vx * 0.15, -60 * s, 60 * s) : ax;
    const top = this.minHang(this.x);
    if (this.y < top) this.y = top;
    this.mode = 'air';
    this.attachAt(x, this.ceilAt(x, this.y), 'hand');
  }

  // free flight (jumps, drops, flips)
  fly(dt) {
    this.anchor = null;
    this.vy += G * this.s * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
  }

  sway(hx, hy) {
    this.x = hx + Math.sin(this.w.clock / 1000 * 1.3) * 4 * this.s;
    this.y = hy;
    this.vx = 0; this.vy = 0;
  }

  // ------------------------------------------------------------ movement
  * walkTo(tx, o = {}) {
    const s = this.s;
    tx = this.w.clampFloorX(tx, this.x, this.y);
    const run = o.run != null ? o.run : Math.abs(tx - this.x) > 160 * s;
    const sp = (run ? 230 : 70) * s;
    let t = 0;
    while (Math.abs(tx - this.x) > 2) {
      const dir = Math.sign(tx - this.x);
      this.facing = dir;
      const step = Math.min(Math.abs(tx - this.x), sp * this.dt);
      this.x += dir * step;
      this.dist += step;
      this.setPose(run ? 'run' : 'walk');
      t += this.dt;
      if (t > (o.timeout || 20) || (o.until && o.until())) break;
      yield;
    }
    this.setPose('stand');
  }

  // crouch, spring up to swinging height and catch a web
  * webJump(height) {
    const s = this.s;
    if (this.mode === 'air') return true;
    this.setPose('crouch');
    yield* this.wait(0.16);
    const f = this.ground();
    const top = Math.max(this.minHang(this.x), height ? f - height * s : this.cruiseY(this.x));
    this.mode = 'air';
    this.anchor = null;
    this.vy = -Math.sqrt(2 * G * s * Math.max(40 * s, this.y - top));
    this.vx = this.facing * 70 * s;
    this.setPose('jump');
    this.w.sound('spFlip', this);
    let t = 0;
    while (t < 1.2 && this.vy < -60 * s && this.y > top) { this.fly(this.dt); t += this.dt; yield; }
    this.catchWeb(this.x + this.facing * 30 * s);
    return true;
  }

  * takeOff(height) { yield* this.webJump(height); }

  // A pendulum arc to `end` (feet) on a web stuck to the top of the screen between
  // here and there. null if no such arc clears the floor and stays on the screens.
  planArc(S0, E) {
    const s = this.s;
    const dx = E.x - S0.x;
    if (Math.abs(dx) < 30 * s) return null;
    const mx = (S0.x + E.x) / 2, my = (S0.y + E.y) / 2;
    const cy = Math.min(this.ceilAt(S0.x, S0.y), this.ceilAt(E.x, E.y));
    // the anchor is equally far from both ends (on their bisector), but between them
    let ax = mx - (cy - my) * (E.y - S0.y) / dx;
    ax = clamp(ax, Math.min(S0.x, E.x) + Math.abs(dx) * 0.2, Math.max(S0.x, E.x) - Math.abs(dx) * 0.2);
    const A = { x: ax, y: this.ceilAt(ax, my) };
    const R0 = Math.hypot(S0.x - A.x, S0.y - A.y), R1 = Math.hypot(E.x - A.x, E.y - A.y);
    if (Math.min(R0, R1) < (HANG + 30) * s) return null;
    const phi0 = Math.atan2(S0.x - A.x, S0.y - A.y), phi1 = Math.atan2(E.x - A.x, E.y - A.y);
    for (let i = 0; i <= 14; i++) {
      const k = i / 14, phi = lerp(phi0, phi1, k), R = lerp(R0, R1, k);
      const px = A.x + Math.sin(phi) * R, py = A.y + Math.cos(phi) * R;
      if (py > this.floorAt(px, py) - 12 * s) return null;
      if (!this.w.geo.inAny({ x: px, y: py - 40 * s }, 2)) return null;
    }
    return { A, phi0, phi1, R0, R1 };
  }

  * swingArc(E, o = {}) {
    const s = this.s, w = this.w;
    const S0 = { x: this.x, y: this.y };
    let end = { x: E.x, y: E.y }, plan = null;
    for (let i = 0; i < 7 && !plan; i++) {
      plan = this.planArc(S0, end);
      if (!plan) end = { x: S0.x + (end.x - S0.x) * 0.72, y: end.y };
    }
    if (!plan) return false;
    const { A, phi0, phi1, R0, R1 } = plan;
    this.attachAt(A.x, A.y, 'hand');
    this.facing = Math.sign(end.x - S0.x) || this.facing;
    this.setPose('swing');
    w.count('swings');
    const base = (o.speed || 560) * s;
    const dir = Math.sign(phi1 - phi0);
    let phi = phi0, t = 0, whoosh = false;
    while ((phi1 - phi) * dir > 0.0005) {
      const R = lerp(R0, R1, (phi - phi0) / (phi1 - phi0));
      const v = base * (0.6 + 0.55 * Math.cos(phi)); // fastest at the bottom of the arc
      phi += dir * Math.min(Math.abs(phi1 - phi), v * this.dt / R);
      const Rn = lerp(R0, R1, (phi - phi0) / (phi1 - phi0));
      const nx = A.x + Math.sin(phi) * Rn, ny = A.y + Math.cos(phi) * Rn;
      this.vx = (nx - this.x) / this.dt; this.vy = (ny - this.y) / this.dt;
      this.x = nx; this.y = ny;
      if (!whoosh && Math.abs(phi) < 0.3) { whoosh = true; w.sound('spSwing', this); }
      t += this.dt;
      if ((o.until && o.until()) || t > 6) return false;
      yield;
    }
    return true;
  }

  // pulled straight along a web to p (feet), then hanging there
  * zipTo(p, o = {}) {
    const s = this.s;
    if (this.mode !== 'air') yield* this.webJump();
    const f = this.floorAt(p.x, p.y);
    const tgt = { x: p.x, y: clamp(p.y, this.minHang(p.x, p.y), f - 20 * s) };
    this.attachAt(tgt.x, this.ceilAt(tgt.x, tgt.y), 'hand');
    const sp = (o.zip || 640) * s;
    let t = 0;
    for (;;) {
      const dx = tgt.x - this.x, dy = tgt.y - this.y, d = Math.hypot(dx, dy);
      if (d < 3 * s) break;
      const step = Math.min(d, sp * this.dt * clamp(d / (70 * s), 0.3, 1));
      this.vx = dx / d * step / this.dt; this.vy = dy / d * step / this.dt;
      this.x += dx / d * step; this.y += dy / d * step;
      if (Math.abs(dx) > 30 * s) this.facing = Math.sign(dx);
      this.setPose(d > 40 * s ? 'zip' : 'hang');
      t += this.dt;
      if ((o.until && o.until()) || t > (o.zipTimeout || 4)) return false;
      yield;
    }
    this.vx = this.vy = 0;
    this.setPose('hang');
    return true;
  }

  // Get to p (feet; in the air = hanging there): swing in arcs across the screens, zip the last bit.
  * swingTo(p, o = {}) {
    const s = this.s, w = this.w;
    if (this.mode !== 'air') yield* this.webJump();
    if (this.attach === 'feet') this.attach = 'hand';
    const t0 = w.clock;
    const late = () => (w.clock - t0) / 1000 > (o.timeout || 25) || (o.until && o.until());
    const route = w.geo.route({ x: this.x, y: this.y - 40 * s }, { x: p.x, y: p.y - 40 * s }, 40 * s).map((q) => ({ x: q.x, y: q.y + 40 * s }));
    for (let i = 0; i < route.length; i++) {
      const wp = route[i], last = i === route.length - 1;
      let n = 0;
      while (Math.abs(wp.x - this.x) > 150 * s && n++ < 14) {
        const dir = Math.sign(wp.x - this.x);
        const span = Math.min(Math.abs(wp.x - this.x), 640 * s);
        const ex = this.x + dir * span;
        const final = last && span >= Math.abs(wp.x - this.x) - 1;
        const ey = final ? clamp(wp.y, this.minHang(ex, wp.y), this.floorAt(ex, wp.y) - 30 * s) : this.cruiseY(ex, wp.y);
        const ok = yield* this.swingArc({ x: ex, y: ey }, o);
        if (late()) return false;
        if (!ok) break;
        // let go at the top of the arc for a moment before the next web
        if (!final && this.vy < -60 * s) {
          this.setPose('jump');
          let t = 0;
          while (t < 0.14 && this.y > this.minHang(this.x) && this.y < this.floorAt(this.x) - 40 * s) { this.fly(this.dt); t += this.dt; yield; }
          this.catchWeb(this.x + dir * 40 * s);
        }
      }
      const ok = yield* this.zipTo(wp, { ...o, zipTimeout: Math.max(1, (o.timeout || 25) - (w.clock - t0) / 1000) });
      if (!ok || late()) return false;
    }
    return true;
  }

  * flyTo(p, o) { return yield* this.swingTo(p, o); }

  // let go and drop to the floor near x (with a flip from high up)
  * land(x) {
    const s = this.s, w = this.w;
    this.tetherE = null; this.tether = null;
    if (this.mode !== 'air') return;
    this.anchor = null;
    this.attach = 'hand';
    const tx = x == null ? this.x + clamp(this.vx * 0.3, -150 * s, 150 * s) : x;
    const h = Math.max(0, this.floorAt(tx) - this.y);
    const vy0 = clamp(this.vy, -420 * s, 300 * s);
    const a = 0.5 * G * s;
    const T = (-vy0 + Math.sqrt(vy0 * vy0 + 4 * a * h)) / (2 * a) || 0.1;
    this.vy = vy0;
    this.vx = clamp((tx - this.x) / Math.max(0.15, T), -520 * s, 520 * s);
    const flip = h > 150 * s && chance(0.65);
    this.setPose(flip ? 'flip' : 'jump');
    if (flip) w.sound('spFlip', this);
    let t = 0;
    while (this.y < this.floorAt(this.x) - 0.5 && t < 3) {
      this.fly(this.dt);
      if (flip) this.flipRot = clamp(t / Math.max(0.3, T * 0.9), 0, 1) * Math.PI * 2;
      if (Math.abs(this.vx) > 30 * s) this.facing = Math.sign(this.vx);
      t += this.dt;
      yield;
    }
    this.flipRot = 0;
    this.y = this.floorAt(this.x);
    this.vx = this.vy = 0;
    this.mode = 'ground';
    this.setPose('land');
    w.sound('spLand', this);
    w.fx('spideyLand', this.x, this.y, { size: h > 200 * s ? 1.2 : 0.7 });
    yield* this.wait(h > 120 * s ? 0.45 : 0.25);
    this.setPose('stand');
  }

  * hoverFor(sec, until) {
    if (this.mode !== 'air') { yield* this.wait(sec, until); return; }
    if (!this.anchor) this.catchWeb();
    const hx = this.x, hy = this.y;
    let t = 0;
    while (t < sec) {
      if (until && until()) break;
      this.sway(hx, hy);
      t += this.dt;
      yield;
    }
  }

  steer(tx, ty, maxSp, accel) {
    const s = this.s, dt = this.dt;
    if (this.mode !== 'air') return Math.hypot(tx - this.x, ty - this.y);
    if (!this.anchor || this.attach === 'feet') this.catchWeb();
    ty = clamp(ty, this.minHang(tx, ty), this.floorAt(tx, ty) - 10 * s);
    const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
    const want = Math.min(maxSp, d * 2.8);
    const wx = d > 0.5 ? (dx / d) * want : 0, wy = d > 0.5 ? (dy / d) * want : 0;
    const dvx = wx - this.vx, dvy = wy - this.vy, dv = Math.hypot(dvx, dvy), a = (accel || 1300 * s) * dt;
    if (dv > a) { this.vx += (dvx / dv) * a; this.vy += (dvy / dv) * a; } else { this.vx = wx; this.vy = wy; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (Math.abs(this.vx) > 40 * s && !this.aim) this.facing = this.vx > 0 ? 1 : -1;
    // the web slides along with him: a fresh one when it leans too far
    if (Math.abs(this.anchor.x - this.x) > 140 * s) this.attachAt(this.x + Math.sign(this.vx || 1) * 40 * s, this.ceilAt(this.x, this.y), 'hand');
    this.airPose();
    return d;
  }

  airPose() {
    if (this.aim) return;
    this.setPose(Math.hypot(this.vx, this.vy) > 260 * this.s ? 'zip' : 'hang');
  }

  holdPosition() {
    if (this.mode === 'air') {
      if (!this.anchor) this.catchWeb();
      this.vx *= 0.8; this.vy *= 0.8;
    }
  }

  keepOnScreen() {
    const s = this.s, geo = this.w.geo;
    const d = geo.displayAt({ x: this.x, y: this.y - 40 * s }) || geo.nearestDisplay({ x: this.x, y: this.y });
    if (!d) return;
    const top = d.work.y + (this.anchor && this.attach === 'hand' && this.mode === 'air' ? HANG + 25 : 30) * s;
    if (this.y < top) { this.y = top; this.vy = Math.max(0, this.vy); }
    const c = geo.clampBounds({ x: this.x, y: this.y - 40 * s }, 20 * s);
    if (c.x !== this.x) { this.x = c.x; this.vx = 0; }
    if (this.anchor && this.attach === 'feet' && this.mode === 'air') {
      const g = this.ground();
      if (this.y > g - 112 * s) this.y = g - 112 * s;
    }
  }

  // ------------------------------------------------------------ tick
  tickMeters(dt) {
    const w = this.w;
    if (this.mode === 'ground' && !this.aim) this.power += 2.6 * dt;
    else if (this.mode === 'air' || this.mode === 'ground') this.power += 0.7 * dt;
    if (!w.enemies.length && this.mode !== 'down') this.armor += (this.mode === 'ground' ? 1.6 : 0.8) * dt;
    if (w.now - (this.lastCartAt || 0) > 8000 && this.missiles < IMPACT_MAX) { this.missiles++; this.lastCartAt = w.now; }
    this.power = clamp(this.power, 0, 100);
    this.armor = clamp(this.armor, 0, 100);
  }

  tick(dt) {
    super.tick(dt);
    const w = this.w;
    if (this.mode !== 'air') { this.anchor = null; this.attach = 'hand'; }
    this.ropeAng = this.anchor && this.mode === 'air' ? Math.atan2(this.anchor.x - this.x, this.y - this.anchor.y) : 0;
    if (this.tetherE) {
      const e = w.enemies.find((x) => x.id === this.tetherE);
      if (e) this.tether = w.enemyCenter(e);
      else { this.tetherE = null; this.tether = null; }
    } else this.tether = null;
    if (this.mode !== 'air' && this.mode !== 'ground') this.flipRot = 0;
    // impact webs: when one bursts, everything around it is stuck
    for (const im of [...this.impacts]) {
      if (w.shots.includes(im.shot)) { im.last = { x: im.shot.x, y: im.shot.y }; continue; }
      this.impacts.splice(this.impacts.indexOf(im), 1);
      for (const e of [...w.enemies]) if (dist(w.enemyCenter(e), im.last) < (110 + ENEMY[e.kind].r) * w.s) w.stunEnemy(e, 3.2, 'web');
    }
    // a worn-out Spider-Verse friend heads home
    if (this.ally && this._armor <= 0.5 && this.taskName !== 'tapOut' && this.mode !== 'thrown' && this.mode !== 'held') this.run(this.taskTapOut(), 'tapOut', 99);
  }

  tickFall(dt) {
    const s = this.s, w = this.w;
    this.anchor = null;
    this.vy += G * s * dt;
    this.vx *= Math.exp(-1 * dt);
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.setPose('jump');
    const g = this.ground();
    if (this.y >= g) {
      this.y = g; this.vx = this.vy = 0;
      this.mode = 'ground';
      w.sound('spLand', this);
      w.fx('spideyLand', this.x, this.y, { size: 1 });
    }
    this.keepOnScreen();
    if (this.task) {
      this.inTask = true;
      try { const r = this.task.next(); if (r.done) { this.task = null; this.taskName = null; this.taskPrio = 0; } } catch (e) { this.task = null; }
      this.inTask = false;
    }
  }

  clearWebs() {
    this.anchor = null; this.attach = 'hand'; this.tetherE = null; this.tether = null; this.flipRot = 0; this.aim = null;
  }

  startHold() { if (this.mode === 'down') return; this.clearWebs(); super.startHold(); }
  throwBy(vx, vy, dmg) { this.clearWebs(); super.throwBy(vx, vy, dmg); }

  release() {
    if (this.mode !== 'held') return;
    const w = this.w, s = this.s;
    this.vx = clamp(w.cursorVel.x * 0.5, -900 * s, 900 * s);
    this.vy = clamp(w.cursorVel.y * 0.5, -900 * s, 900 * s);
    this.swing = 0;
    if (this.power > 3) { this.mode = 'air'; this.anchor = null; this.run(this.taskWebCatch(), 'stabilize', 60); }
    else { this.mode = 'fall'; this.run(this.taskAfterFall(), 'fall', 60); }
  }

  * taskWebCatch() {
    const s = this.s, w = this.w;
    this.setPose('jump');
    let t = 0;
    while (t < 0.18 && this.y < this.floorAt(this.x) - 10 * s) { this.fly(this.dt); t += this.dt; yield; }
    if (this.y < this.floorAt(this.x) - 70 * s) {
      this.catchWeb();
      this.vx = this.vy = 0;
      this.setPose('hang');
      this.say(pick(['Thwip! Thanks for the lift.', 'Nice toss!', 'Ta-da!', 'Stuck the landing. Sort of.']));
      yield* this.hoverFor(1.2);
    }
    yield* this.land();
    void w;
  }

  * taskAfterFall() {
    while (this.mode === 'fall') yield;
    this.setPose('land');
    yield* this.wait(0.6);
    this.setPose('stand');
  }

  // ------------------------------------------------------------ brain
  choose() {
    const w = this.w;
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
      if (this.anchor && chance(0.35)) return [this.taskHangAround(rand(2, 5)), 'hang', 15];
      return [this.land(), 'land', 30];
    }
    if (this.power < 30) return [this.taskRest(), 'rest', 25];
    const opts = [];
    const add = (wt, fn, name) => { if (wt > 0) opts.push([wt, fn, name]); };
    add(2.6, () => this.taskIdle(rand(3, 7)), 'idle');
    add(2, () => this.taskIdle(rand(3, 6), 'crouch'), 'crouch');
    add(1.3, () => this.taskIdle(rand(3, 5), 'idleLook'), 'look');
    add(1.8, () => this.taskStroll(), 'stroll');
    add(1.5, () => this.taskPatrol(), 'patrol');
    add(1.1, () => this.taskHangUpside(), 'upside');
    add(0.6, () => this.taskFlip(), 'flip');
    add(0.4, () => this.taskWebDoodle(), 'doodle');
    add(w.geo.displays.length > 1 ? 0.6 : 0, () => this.taskVisit(), 'visit');
    add(0.3, () => this.taskGreet(false), 'wave');
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

  * taskRest() {
    if (this.mode === 'air') yield* this.land();
    this.setPose('crouch');
    this.say('Refilling web cartridges…');
    yield* this.wait(40, () => this.power >= 92);
    this.setPose('stand');
  }

  * taskStroll() {
    if (this.mode === 'air') yield* this.land();
    const s = this.s, d = this.disp();
    const tx = clamp(this.x + rand(-420, 420) * s, d.work.x + 40 * s, d.work.x + d.work.width - 40 * s);
    yield* this.walkTo(tx);
    yield* this.wait(rand(0.4, 1.4));
  }

  airPoint() {
    const s = this.s, w = this.w;
    const p = w.geo.randomPoint(120 * s, { x: this.x, y: this.y }, rand(350, 800) * s);
    return { x: p.x, y: clamp(this.cruiseY(p.x, p.y) - rand(0, 160) * s, this.minHang(p.x, p.y), this.floorAt(p.x, p.y) - 60 * s) };
  }

  * taskPatrol() {
    const s = this.s;
    const n = Math.floor(rand(2, 4));
    for (let i = 0; i < n; i++) yield* this.swingTo(this.airPoint(), { speed: rand(520, 700), near: 30, timeout: 8 });
    yield* this.hoverFor(rand(0.4, 1));
    yield* this.land(this.x + rand(-100, 100) * s);
  }

  * taskVisit() {
    const w = this.w;
    const here = this.disp();
    const others = w.geo.displays.filter((d) => d !== here);
    if (!others.length) return;
    const d = pick(others);
    const tx = d.work.x + rand(0.2, 0.8) * d.work.width;
    yield* this.swingTo({ x: tx, y: this.cruiseY(tx, d.work.y + d.work.height / 2) }, { speed: 640, near: 30, timeout: 15 });
    yield* this.land();
  }

  * taskHangAround(dur) {
    const hx = this.x, hy = this.y;
    let t = 0;
    while (t < dur) { this.sway(hx, hy); this.setPose(Math.sin(t * 0.8) > 0.6 ? 'hangLook' : 'hang'); t += this.dt; yield; }
    yield* this.land();
  }

  // hang upside-down from a thread: the classic
  goUpside() {
    if (!this.anchor) this.catchWeb();
    this.attach = 'feet';
    this.anchor = { x: this.x, y: this.anchor.y };
  }

  * dropFromUpside() {
    this.attach = 'hand';
    this.vx = 0; this.vy = -60 * this.s;
    yield* this.land(this.x + this.facing * 40 * this.s);
  }

  // a height to hang upside-down at near x (the head must clear the floor), or null
  upsideSpot(x, want) {
    const s = this.s, f = this.floorAt(x), c = this.ceilAt(x);
    const lo = c + (HANG + 30) * s, hi = f - 116 * s;
    if (hi < lo) return null;
    return clamp(want != null ? want : f - rand(210, 330) * s, lo, hi);
  }

  * taskHangUpside() {
    const w = this.w, s = this.s, d = this.disp();
    const tx = clamp(this.x + rand(-260, 260) * s, d.work.x + 60 * s, d.work.x + d.work.width - 60 * s);
    const ty = this.upsideSpot(tx);
    if (ty == null) return;
    yield* this.swingTo({ x: tx, y: ty }, { near: 6, timeout: 6 });
    if (Math.abs(this.x - tx) > 20 * s) { yield* this.land(); return; }
    this.goUpside();
    this.setPose('hangUpside');
    if (chance(0.45)) this.say(pick(['Just hanging around.', 'The view\'s better from here.', 'Upside-down is my right-side up.', 'Blood rushing to my head. Worth it.']));
    const dur = rand(4, 9);
    let t = 0;
    while (t < dur && !w.enemies.length && !w.announcement && !w.quiet) { this.sway(tx, ty); t += this.dt; yield; }
    yield* this.dropFromUpside();
  }

  * taskFlip() {
    const w = this.w, s = this.s;
    if (this.mode === 'air') yield* this.land();
    this.setPose('crouch');
    yield* this.wait(0.15);
    this.mode = 'air';
    this.vx = this.facing * rand(-60, 60) * s; this.vy = -620 * s;
    this.setPose('flip');
    w.sound('spFlip', this);
    const back = chance(0.6) ? -1 : 1;
    let t = 0;
    while ((this.y < this.floorAt(this.x) - 0.5 || t < 0.05) && t < 2) {
      this.fly(this.dt);
      this.flipRot = back * clamp(t / 0.78, 0, 1) * Math.PI * 2;
      t += this.dt;
      yield;
    }
    this.flipRot = 0;
    this.y = this.floorAt(this.x); this.vx = this.vy = 0;
    this.mode = 'ground';
    this.setPose('land');
    w.sound('spLand', this);
    if (chance(0.4)) this.say(pick(['Ta-da!', 'Nailed it.', 'Ten out of ten.']));
    yield* this.wait(0.4);
    this.setPose('stand');
  }

  // a playful thwip at the cursor (harmless)
  * taskWebDoodle() {
    const w = this.w, s = this.s, c = w.cursor;
    if (this.mode === 'air' || !w.geo.displayAt(c) || dist(c, this) > 700 * s || c.y > this.y) { yield* this.taskIdle(2, 'idleLook'); return; }
    this.aimAt(c);
    this.setPose('webShot');
    yield* this.wait(0.12);
    const from = this.wrist(c), d = dist(c, from) || 1, sp = 760 * s;
    w.addShot({ kind: 'web', owner: 'hero', x: from.x, y: from.y, vx: (c.x - from.x) / d * sp, vy: (c.y - from.y) / d * sp, dmg: 0, r: -999, life: 1.2, hitFx: 'webSplat', hitSound: 'spSplat', size: s });
    w.sound('spThwip', this);
    if (chance(0.5)) this.say(pick(['Thwip!', 'Gotcha. Kidding.', 'Missed on purpose.']));
    yield* this.wait(0.5);
    this.aim = null;
    this.setPose('stand');
  }

  * taskGreet(byUser) {
    const w = this.w;
    this.faceTo(w.cursor);
    this.setPose(this.mode === 'air' ? 'hangWave' : chance(0.5) ? 'thwip' : 'wave');
    if (byUser) {
      const recent = this.clicks.filter((t) => Date.now() - t < 3000).length;
      this.say(recent >= 4 ? this.line('poke') : this.line('greet'), recent >= 4 ? 'warn' : null);
      w.sound('spThwip', this);
    }
    if (this.mode === 'air') yield* this.hoverFor(1.4); else yield* this.wait(1.4);
    if (this.mode !== 'air') this.setPose('stand');
  }

  * taskQuiet() {
    const w = this.w, s = this.s;
    const d = this.disp();
    const tx = d.work.x + d.work.width - 80 * s;
    const ty = this.upsideSpot(tx);
    if (ty != null) {
      yield* this.swingTo({ x: tx, y: ty }, { speed: 560, near: 6, timeout: 8, until: () => !w.quiet });
      if (w.quiet && Math.abs(this.x - tx) < 20 * s) {
        this.goUpside();
        this.facing = -1;
        this.setPose('sleepUpside');
        this.say('Nap time. Wake me if robots.');
        while (w.quiet) { this.sway(tx, ty); this.setPose('sleepUpside'); yield; }
        this.setPose('hangUpside');
        this.say('I\'m up! I\'m up!');
        yield* this.wait(0.6);
        yield* this.dropFromUpside();
        return;
      }
    }
    // a short screen: sit in the corner instead
    if (this.mode === 'air') yield* this.land(tx);
    yield* this.walkTo(tx, { until: () => !w.quiet });
    this.facing = -1;
    this.setPose('sit');
    if (w.quiet) this.say('Nap time.');
    while (w.quiet) yield;
    this.setPose('stand');
  }

  * taskAnnounce() {
    const w = this.w, s = this.s;
    const a = w.announcement;
    if (!a) return;
    const d = w.geo.primary;
    const spot = { x: d.work.x + d.work.width / 2, y: d.work.y + d.work.height * 0.62 };
    spot.y = clamp(spot.y, this.minHang(spot.x, spot.y), this.floorAt(spot.x, spot.y) - 40 * s);
    this.say('My spider-sense is tingling!');
    w.sound('spSense', this);
    yield* this.swingTo(spot, { speed: 700, near: 6, timeout: 12 });
    if (dist(spot, this) > 4 * s) yield* this.zipTo(spot, { zipTimeout: 3 });
    a.arrived = true;
    this.facing = 1;
    w.dirty();
    while (w.announcement === a) {
      this.sway(spot.x, spot.y);
      this.setPose(w.now - a.start < 2600 ? 'hangWave' : 'hang');
      yield;
    }
    this.say(pick(['Go get \'em!', 'Knew you\'d do it.', 'Back to swinging!']));
    yield* this.hoverFor(0.8);
    yield* this.land();
  }

  * taskArrive() {
    const w = this.w, s = this.s;
    const d = w.geo.primary;
    const fromLeft = chance(0.5);
    this.x = fromLeft ? d.work.x + 50 * s : d.work.x + d.work.width - 50 * s;
    this.y = this.cruiseY(this.x) - 80 * s;
    this.vx = this.vy = 0;
    this.facing = fromLeft ? 1 : -1;
    this.catchWeb(this.x + this.facing * 60 * s);
    const tx = d.work.x + d.work.width * rand(0.38, 0.62);
    yield* this.swingTo({ x: tx, y: this.cruiseY(tx) }, { speed: 640, near: 40, timeout: 6 });
    yield* this.land(tx);
    this.say(pick(['Hey there!', 'Your friendly neighborhood Spider-Man!', 'Did somebody call?']));
    this.setPose('thwip');
    w.sound('spThwip', this);
    yield* this.wait(1.4);
    this.setPose('stand');
  }

  * taskReboot() {
    const w = this.w;
    this.clearWebs();
    this.say(pick(['Ugh…', 'Oof. Ow.', 'Lights out…']), 'warn');
    w.sound('spHurt', this);
    if (this.mode === 'air' || this.y < this.ground() - 2) {
      this.mode = 'fall';
      while (this.mode === 'fall') yield;
    }
    this.mode = 'down';
    this.setPose('down');
    this.eyes = 0.3;
    yield* this.wait(4.5);
    this.say(pick(['I\'m okay! I\'m okay!', 'Shake it off, Spidey.', 'Five more minutes…']));
    this.eyes = 1;
    this.armor = Math.max(this.armor, 35);
    this.mode = 'ground';
    this.setPose('crouch');
    yield* this.wait(0.5);
    this.setPose('stand');
    yield* this.wait(0.4);
  }

  * taskRecover() {
    this.setPose('down');
    this.eyes = 0.4;
    yield* this.wait(0.9);
    this.eyes = 1;
    this.setPose('crouch');
    yield* this.wait(0.45);
    this.setPose('stand');
    this.say(this.line('recover'));
    yield* this.wait(0.6);
  }

  * taskEvacuate() {
    const w = this.w, s = this.s;
    const n = w.nuke;
    if (!n) return;
    this.aim = null; this.tetherE = null;
    this.say(this.ally ? this.line('evacuateAlly') : this.line('evacuate'), 'warn');
    const spot = w.safeSpot(this);
    const until = () => !w.nuke || (w.nuke.detonated && w.nukeRadius() > dist(this.chest(), w.nuke) - 300 * s);
    yield* this.swingTo({ x: spot.x, y: this.cruiseY(spot.x, spot.y) }, { speed: 900, zip: 1000, near: 40, timeout: 7, until });
    if (w.nuke && !w.nuke.detonated && this.mode === 'air') yield* this.land(this.x);
    this.say(this.line('brace'), 'warn');
    const hx = this.x, hy = this.y;
    while (w.nuke && !w.nuke.passed) {
      if (this.mode === 'air') { this.sway(hx, hy); this.setPose('hang'); } else this.setPose('brace');
      yield;
    }
  }

  // ------------------------------------------------------------ combat
  * taskCombat() {
    const w = this.w, s = this.s;
    if (!this.ally || w.allies.length <= 2) this.say(w.enemies.some(isBoss) ? this.line('heavyThreat') : this.line('threat'), 'warn');
    w.sound('spSense', this);
    while (w.enemies.length) {
      yield;
      if (w.announcement && !this.ally) return;
      if (w.quiet) return;
      const target = w.pickTarget(this);
      if (!target) continue;
      this.targetId = target.id;
      if (this.power < 6) {
        this.say('Out of web fluid!', 'warn');
        if (this.mode === 'air') yield* this.land();
        this.setPose('crouch');
        yield* this.wait(2.5, () => this.power > 30);
        continue;
      }
      const threat = w.incomingThreat(this);
      if (threat && this.cd.dodge <= 0 && chance(0.5)) { yield* this.dodge(threat); continue; }
      const tc = w.enemyCenter(target);
      const d = dist(tc, this.chest());
      const near = w.enemies.filter((e) => dist(w.enemyCenter(e), tc) < 150 * w.s).length;
      if (this.missiles >= 1 && this.cd.impact <= 0 && (near >= 3 || (isBoss(target) && chance(0.3)))) yield* this.impactWeb(tc);
      else if (target.air && target.kind !== 'mini' && !isBoss(target) && this.cd.yank <= 0 && d < 460 * s && chance(0.65)) yield* this.webYank(target);
      else if (!target.air && !isBoss(target) && this.cd.throw <= 0 && w.enemies.length >= 3 && d < 420 * s && chance(0.5)) yield* this.swingThrow(target);
      else if (this.cd.zip <= 0 && d < 520 * s && d > 80 * s && (target.stun > 0 || !target.air || chance(0.45))) yield* this.zipKick(target);
      else if (d < 80 * s) yield* this.combo(target);
      else {
        if (d > 520 * s || chance(0.35)) yield* this.position(target);
        if (w.enemies.includes(target)) yield* this.webShots(target, Math.floor(rand(2, 4)));
      }
    }
    if (this.ally) return;
    this.say(this.line('victory'));
    if (this.mode === 'air') yield* this.land();
    this.setPose('thwip');
    yield* this.wait(1.4);
    this.setPose('stand');
  }

  // get to a good spot to fight `target` from (each Spider-Verse friend keeps a slot)
  * position(target) {
    const w = this.w, s = this.s;
    const tc = w.enemyCenter(target);
    const slot = this.ally ? w.allies.indexOf(this) + 1 : 0;
    const side = Math.abs(this.x - tc.x) < 40 * s ? (chance(0.5) ? 1 : -1) : Math.sign(this.x - tc.x);
    const range = ((ENEMY[target.kind].giant ? 420 : isBoss(target) ? 300 : 220) + (slot % 3) * 45) * s;
    const d = w.geo.displayAt(tc) || w.geo.nearestDisplay(tc);
    const wx = clamp(tc.x + side * range, d.work.x + 50 * s, d.work.x + d.work.width - 50 * s);
    const stop = () => !w.enemies.includes(target) || !!w.nuke || (!this.ally && !!w.announcement);
    if (target.air || (this.mode === 'air' && chance(0.6))) {
      const wy = clamp((target.air ? tc.y + 40 * s : tc.y - 140 * s) + ((slot % 3) - 1) * 50 * s, this.minHang(wx, tc.y), this.floorAt(wx, tc.y) - 30 * s);
      if (Math.hypot(wx - this.x, wy - this.y) > 90 * s) yield* this.swingTo({ x: wx, y: wy }, { speed: 780, zip: 900, near: 30, timeout: 2.4, until: stop });
    } else if (this.mode === 'air') {
      yield* this.land(wx);
    } else if (Math.abs(wx - this.x) > 90 * s) {
      if (this.floorAt(wx, tc.y) !== this.ground() || Math.abs(wx - this.x) > 600 * s) {
        yield* this.swingTo({ x: wx, y: this.cruiseY(wx, tc.y) }, { speed: 780, near: 40, timeout: 3, until: stop });
        yield* this.land(wx);
      } else yield* this.walkTo(wx, { run: true, timeout: 1.6 });
    }
  }

  * webShots(target, n, point) {
    const w = this.w, s = this.s;
    for (let i = 0; i < n; i++) {
      if (target && !w.enemies.includes(target)) break;
      const tc = target ? w.enemyCenter(target) : point;
      const lead = target ? { x: tc.x + (target.vx || 0) * 0.12, y: tc.y + (target.air ? (target.vy || 0) * 0.12 : 0) } : tc;
      this.aimAt(lead);
      this.setPose('webShot');
      let t = 0;
      while (t < 0.1) { this.holdPosition(); t += this.dt; yield; }
      if (this.power < 2.5) { this.say('Out of web fluid!', 'warn'); break; }
      this.power -= 2.5;
      const from = this.wrist(lead);
      const sp = 880 * s, d = dist(lead, from) || 1;
      w.addShot({ kind: 'web', owner: 'hero', x: from.x, y: from.y, vx: (lead.x - from.x) / d * sp, vy: (lead.y - from.y) / d * sp, dmg: 1.6, stun: 2.4, stunKind: 'web', r: 8, life: 1.3, hitFx: 'webSplat', hitSound: 'spSplat', hitSize: 0.6, size: s });
      w.count('webs');
      w.counters.shotsFired++;
      w.sound('spThwip', this);
      t = 0;
      while (t < 0.15) { this.holdPosition(); t += this.dt; yield; }
    }
    this.aim = null;
  }

  // shoot a web at an enemy and get pulled in feet-first
  * zipKick(target) {
    const w = this.w, s = this.s;
    let tc = w.enemyCenter(target);
    this.aimAt(tc);
    this.setPose('webShot');
    w.sound('spThwip', this);
    this.tetherE = target.id;
    let t = 0;
    while (t < 0.12) { this.holdPosition(); t += this.dt; yield; }
    this.aim = null;
    if (!w.enemies.includes(target)) { this.tetherE = null; return; }
    this.mode = 'air'; this.anchor = null;
    this.power = Math.max(0, this.power - 2);
    this.setPose('zipKick');
    let hit = false;
    t = 0;
    while (t < 0.9) {
      if (!w.enemies.includes(target)) break;
      tc = w.enemyCenter(target);
      const side = this.x <= tc.x ? 1 : -1;
      const want = { x: tc.x - side * (ENEMY[target.kind].r * w.s + 18 * s), y: Math.min(tc.y + 42 * s, this.floorAt(tc.x, tc.y)) };
      const dx = want.x - this.x, dy = want.y - this.y, d = Math.hypot(dx, dy);
      this.facing = side;
      if (d < 16 * s) { hit = true; break; }
      const step = Math.min(d, 1000 * s * this.dt);
      this.vx = dx / d * 1000 * s; this.vy = dy / d * 1000 * s;
      this.x += dx / d * step; this.y += dy / d * step;
      t += this.dt;
      yield;
    }
    this.tetherE = null;
    if (hit && w.enemies.includes(target)) {
      tc = w.enemyCenter(target);
      w.damage(target, 4, tc);
      w.fx('hitspark', tc.x, tc.y, {});
      w.sound('spPunch', target);
      if (target.hp > 0) w.launchEnemy(target, this.facing * 520 * w.s, -360 * w.s, { dmg: 1 });
      w.count('zipKicks');
    }
    this.cd.zip = 2.4;
    // bounce off with a backflip, then catch a web or land
    this.vx = -this.facing * 220 * s; this.vy = -420 * s;
    this.setPose('flip');
    w.sound('spFlip', this);
    t = 0;
    while (t < 0.36 && this.y < this.floorAt(this.x) - 2) { this.fly(this.dt); this.flipRot = -(t / 0.5) * Math.PI * 2; t += this.dt; yield; }
    this.flipRot = 0;
    if (this.y < this.floorAt(this.x) - 80 * s && this.y > this.minHang(this.x)) { this.catchWeb(); this.vx = this.vy = 0; this.setPose('hang'); }
    else yield* this.land(this.x - this.facing * 30 * s);
  }

  // web a flyer and slam it into the floor in front of him
  * webYank(target) {
    const w = this.w, s = this.s;
    this.aimAt(w.enemyCenter(target));
    this.setPose('webShot');
    w.sound('spThwip', this);
    this.tetherE = target.id;
    let t = 0;
    while (t < 0.16) { this.holdPosition(); t += this.dt; yield; }
    this.aim = null;
    if (!w.enemies.includes(target)) { this.tetherE = null; return; }
    this.power = Math.max(0, this.power - 3);
    this.setPose('yank');
    w.sound('spYank', this);
    const d = this.disp();
    const from = { x: target.x, y: target.y };
    const slam = { x: clamp(this.x + this.facing * 90 * s, d.work.x + 40 * s, d.work.x + d.work.width - 40 * s), y: this.floorAt(this.x) - 30 * s };
    t = 0;
    while (t < 0.32 && w.enemies.includes(target)) {
      const k = t / 0.32;
      w.holdEnemy(target, this, lerp(from.x, slam.x, k), lerp(from.y, slam.y, k * k) - Math.sin(k * Math.PI) * 40 * s);
      this.holdPosition();
      t += this.dt;
      yield;
    }
    this.tetherE = null;
    if (w.enemies.includes(target)) {
      w.launchEnemy(target, this.facing * 60 * w.s, 900 * w.s, { thrown: { dmg: 4, r: 70 }, spin: this.facing * 9 });
      w.count('yanks');
    }
    this.cd.yank = 3.2;
    yield* this.wait(0.2);
  }

  // web a walker, whirl it round and fling it into its friends
  * swingThrow(target) {
    const w = this.w, s = this.s;
    let best = null, bn = 0;
    for (const e of w.enemies) {
      if (e === target) continue;
      const c = w.enemyCenter(e);
      const n = w.enemies.filter((o) => o !== target && dist(w.enemyCenter(o), c) < 130 * w.s).length;
      if (n > bn) { bn = n; best = c; }
    }
    if (!best) { yield* this.webShots(target, 2); return; }
    if (this.mode === 'air') yield* this.land();
    if (!w.enemies.includes(target)) return;
    this.aimAt(w.enemyCenter(target));
    this.setPose('webShot');
    w.sound('spThwip', this);
    this.tetherE = target.id;
    let t = 0;
    while (t < 0.14) { t += this.dt; yield; }
    this.aim = null;
    if (!w.enemies.includes(target)) { this.tetherE = null; return; }
    this.power = Math.max(0, this.power - 3);
    this.setPose('spinThrow');
    w.sound('spYank', this);
    const hub = { x: this.x + this.facing * 4 * s, y: this.y - 96 * s };
    const r0 = dist(target, hub);
    t = 0;
    while (t < 0.75 && w.enemies.includes(target)) {
      const a = -Math.PI / 2 + t * 14 * this.facing;
      const R = lerp(r0, 70 * s, Math.min(1, t / 0.2));
      w.holdEnemy(target, this, hub.x + Math.cos(a) * R, hub.y + Math.sin(a) * R * 0.45 + 12 * s);
      t += this.dt;
      yield;
    }
    this.tetherE = null;
    if (!w.enemies.includes(target)) return;
    const c0 = w.enemyCenter(target), T = 0.55, g = 1500 * w.s;
    this.faceTo(best);
    w.launchEnemy(target, clamp((best.x - c0.x) / T, -1400 * w.s, 1400 * w.s), clamp((best.y - c0.y) / T - 0.5 * g * T, -1200 * w.s, 600 * w.s), { thrown: { dmg: 6, r: 95 }, spin: this.facing * 10 });
    w.count('throws');
    this.cd.throw = 6;
    yield* this.wait(0.3);
  }

  // an impact web: bursts where it lands and snares everything around
  * impactWeb(p) {
    const w = this.w, s = this.s;
    if (this.missiles < 1) { this.say('No impact webs left!', 'warn'); return; }
    this.aimAt(p);
    this.setPose(this.mode === 'air' ? 'webShot' : 'webBoth');
    let t = 0;
    while (t < 0.2) { this.holdPosition(); t += this.dt; yield; }
    this.missiles--;
    this.power = Math.max(0, this.power - 2);
    this.cd.impact = 4.5;
    w.count('impactWebs');
    const from = this.wrist(p);
    const T = clamp(dist(p, from) / (700 * s), 0.35, 0.9), g = 900 * w.s;
    const shot = w.addShot({ kind: 'impact', owner: 'hero', x: from.x, y: from.y, vx: (p.x - from.x) / T, vy: (p.y - from.y) / T - 0.5 * g * T, g, dmg: 0, r: -999, tp: { x: p.x, y: p.y }, splash: 95, splashDmg: 2.5, life: T + 0.8, hitFx: 'webBurst', hitSound: 'spSplat', hitSize: 1.2, size: s });
    this.impacts.push({ shot, last: { x: from.x, y: from.y } });
    w.sound('spThwip', this);
    t = 0;
    while (t < 0.25) { this.holdPosition(); t += this.dt; yield; }
    this.aim = null;
  }

  * combo(target) {
    const w = this.w, s = this.s;
    const moves = ['punch', 'punch2', 'kick'];
    for (let i = 0; i < 3; i++) {
      if (!w.enemies.includes(target)) break;
      const tc = w.enemyCenter(target);
      this.faceTo(tc);
      this.setPose(moves[i]);
      yield* this.wait(0.12);
      if (w.enemies.includes(target) && dist(w.enemyCenter(target), this.chest()) < 100 * s) {
        w.damage(target, i === 2 ? 2.6 : 1.7, tc);
        w.sound('spPunch', target);
        w.fx('hitspark', tc.x, tc.y, {});
        if (i === 2 && target.hp > 0) w.launchEnemy(target, this.facing * 480 * w.s, -300 * w.s, { dmg: 0.5 });
      }
      yield* this.wait(0.13);
    }
    this.setPose(this.mode === 'air' ? 'hang' : 'stand');
  }

  // spider-sense: flip or swing out of the way
  * dodge(p) {
    const w = this.w, s = this.s;
    this.cd.dodge = 1.3;
    if (chance(0.3)) this.say(pick(['Spider-sense!', 'Nope!', 'Missed me!']));
    w.sound('spSense', this);
    if (this.mode === 'air') {
      const tx = this.x - this.facing * 90 * s, ty = this.y + (p.vy > 0 ? -1 : 1) * 70 * s;
      let t = 0;
      while (t < 0.3) { this.steer(tx, ty, 700 * s, 4200 * s); this.setPose('zip'); t += this.dt; yield; }
      return;
    }
    this.mode = 'air'; this.anchor = null;
    this.vx = -this.facing * 260 * s; this.vy = -560 * s;
    this.setPose('flip');
    let t = 0;
    while ((this.y < this.floorAt(this.x) - 0.5 || t < 0.05) && t < 1.5) {
      this.fly(this.dt);
      this.flipRot = -clamp(t / 0.72, 0, 1) * Math.PI * 2;
      t += this.dt;
      yield;
    }
    this.flipRot = 0;
    this.y = this.floorAt(this.x); this.vx = this.vy = 0;
    this.mode = 'ground';
    this.setPose('crouch');
    yield* this.wait(0.15);
  }

  * taskAttackAt(kind, p) {
    const w = this.w, s = this.s;
    const near = w.enemies.filter((e) => dist(w.enemyCenter(e), p) < 130 * s).sort((a, b) => dist(w.enemyCenter(a), p) - dist(w.enemyCenter(b), p));
    const e = near[0] || null;
    if (kind === 'impact') yield* this.impactWeb(p);
    else if (kind === 'zipkick') {
      if (e) yield* this.zipKick(e);
      else if (p.y < this.floorAt(p.x, p.y) - 80 * s) yield* this.zipTo(p);
      else { yield* this.swingTo({ x: p.x, y: this.cruiseY(p.x, p.y) }, { timeout: 6 }); yield* this.land(p.x); }
    } else if (kind === 'yank') {
      if (e && e.air && !isBoss(e)) yield* this.webYank(e);
      else if (e && !isBoss(e)) yield* this.swingThrow(e);
      else yield* this.webShots(e, 2, p);
    } else yield* this.webShots(e, 2, p);
    yield* this.wait(0.3);
  }

  * taskAllyArrive(target) {
    this.say(this.line('allyArrive', this.callsign), 'radio');
    this.catchWeb();
    yield* this.swingTo(target, { speed: 720, near: 40, timeout: 6 });
  }

  * taskAllyLeave() {
    const w = this.w, s = this.s;
    if (w.nuke) { yield* this.hoverFor(1); return; }
    this.aim = null;
    this.say(this.line('allyLeave'), 'radio');
    if (this.mode === 'air') { this.setPose('hangWave'); yield* this.hoverFor(1.1); } else { this.setPose('wave'); yield* this.wait(1.1); }
    const d = this.disp();
    const left = this.x - d.work.x < d.work.x + d.work.width - this.x;
    const ex = left ? d.work.x + 30 * s : d.work.x + d.work.width - 30 * s;
    yield* this.swingTo({ x: ex, y: this.cruiseY(ex) }, { speed: 820, near: 40, timeout: 5 });
    w.fx('portal', this.x, this.y - 50 * s, {});
    w.removeAlly(this, true);
  }

  // an ally at the end of their strength: back home through a portal (a fresh one may come)
  * taskTapOut() {
    const w = this.w, s = this.s;
    this.clearWebs();
    this.say(pick(['I\'m tapping out!', 'Portal home — good luck!', 'Back to my dimension!']), 'radio');
    if (this.mode === 'air') yield* this.land();
    yield* this.wait(0.5);
    w.fx('portal', this.x, this.y - 50 * s, { size: 1.4 });
    w.sound('spawn', this);
    w.hero.say(this.line('allyDown', this.callsign), 'warn');
    if (w.army) w.army.legionAt = Math.max(w.army.legionAt, w.clock + 5000);
    w.removeAlly(this);
  }

  // ------------------------------------------------------------ what Spider-Man offers the UI
  statusText() {
    const w = this.w;
    if (w.quiet) return 'napping upside-down';
    if (this.mode === 'thrown') return 'blown away by the blast';
    if (w.nuke && !w.nuke.passed) return 'swinging for cover';
    if (w.army) return w.allies.length ? `army battle · spider-verse ×${w.allies.length}` : 'army battle';
    if (this.mode === 'down') return 'knocked out';
    if (this.mode === 'held') return 'being carried';
    if (w.enemies.length) return 'webbing up bad guys';
    if (this.armor < 30) return 'banged up';
    if (this.power < 20) return 'low on web fluid';
    if (this.mode === 'air') return this.attach === 'feet' && this.anchor ? 'hanging around' : Math.hypot(this.vx, this.vy) > 250 * this.s ? 'web-swinging' : 'hanging on a web';
    return 'ready to swing';
  }

  meters() {
    return [
      { k: 'power', label: 'Web fluid', short: 'WEB', icon: '🕸️', v: this.power, color: '#d6e4ff' },
      { k: 'armor', label: 'Health', short: 'HP', icon: '❤️', v: this.armor, color: '#ff5a64' },
      { k: 'missiles', label: 'Impact webs', short: 'IMP', icon: '💣', v: (this.missiles / IMPACT_MAX) * 100, color: '#6f9cff' },
    ];
  }

  // an order from the menu: it may cut short a fight that has just been won
  onCommand(name, at, a, free) {
    const w = this.w, s = this.s;
    switch (name) {
      case 'attack':
        if (free) this.interrupt(this.taskAttackAt(a.kind || 'web', at), 'attack', 85);
        break;
      case 'flyTo': case 'swingTo': case 'call':
        if (free) {
          this.interrupt((function* () {
            const ground = at.y > this.floorAt(at.x, at.y) - 120 * s;
            yield* this.swingTo(ground ? { x: at.x, y: this.cruiseY(at.x, at.y) } : at, { speed: 640, near: 10 });
            if (!ground) yield* this.hoverFor(1.6);
            yield* this.land(at.x);
          }).call(this), 'flyTo', 50);
        }
        break;
      case 'hang':
        if (free) {
          this.interrupt((function* () {
            const ty = this.upsideSpot(at.x, at.y);
            if (ty == null) return;
            yield* this.swingTo({ x: at.x, y: ty }, { near: 6, timeout: 8 });
            this.goUpside();
            this.setPose('hangUpside');
            this.say(pick(['Hangin\' out.', 'Comfy.', 'Upside-down mode.']));
            const hx = this.x, hy = this.y;
            let t = 0;
            while (t < 8 && !w.enemies.length && !w.announcement) { this.sway(hx, hy); t += this.dt; yield; }
            yield* this.dropFromUpside();
          }).call(this), 'hang', 50);
        }
        break;
      case 'land': if (free && this.mode === 'air') this.interrupt(this.land(), 'land', 50); break;
      case 'patrol': if (free) this.interrupt(this.taskPatrol(), 'patrol', 50); break;
      case 'flip': if (free) this.interrupt(this.taskFlip(), 'flip', 50); break;
      case 'thumbsUp': case 'wave': if (free) this.interrupt(this.taskGreet(false), 'greet', 50); break;
      case 'repair':
        this.armor = 100; this.say('All patched up!'); w.fx('repair', this.x, this.y - 50 * s, {}); w.sound('spThwip', this);
        break;
      case 'recharge':
        this.power = 100; this.missiles = IMPACT_MAX; this.say('Fresh web cartridges!'); w.fx('webSplat', this.x + this.facing * 20 * s, this.y - 60 * s, { size: 0.6 }); w.sound('spThwip', this);
        break;
      default: return false;
    }
    return true;
  }

  menuItems() {
    const h = this, w = this.w;
    const air = h.mode === 'air';
    const look = w.settings.spiderSuit || 'classic';
    return [
      {
        icon: '💥', label: 'Attack here',
        sub: [
          { icon: '🕸️', label: 'Web shot', cmd: 'attack', args: { kind: 'web' }, hint: 'sticks them in place' },
          { icon: '💣', label: `Impact web (${h.missiles})`, cmd: 'attack', args: { kind: 'impact' }, disabled: h.missiles < 1, hint: 'snares a whole group' },
          { icon: '🦶', label: 'Web-zip kick', cmd: 'attack', args: { kind: 'zipkick' } },
          { icon: '🪢', label: 'Web-yank & slam', cmd: 'attack', args: { kind: 'yank' }, hint: 'flyers crash down' },
        ],
      },
      {
        icon: '🕸️', label: 'Web-swing',
        sub: [
          { icon: '📍', label: 'Swing here', cmd: 'swingTo' },
          { icon: '🙃', label: 'Hang upside-down here', cmd: 'hang' },
          { icon: '🔄', label: 'Swing around the screens', cmd: 'patrol' },
          { icon: '🤸', label: 'Backflip', cmd: 'flip' },
          ...(air ? [{ icon: '⬇️', label: 'Drop down', cmd: 'land' }] : []),
        ],
      },
      {
        icon: '🕷️', label: 'Suit', badge: h.armor < 30 || h.power < 20 ? '!' : null,
        sub: [
          { icon: '🩹', label: `Patch up (${Math.round(h.armor)}%)`, cmd: 'repair' },
          { icon: '🧪', label: `Refill web fluid (${Math.round(h.power)}%)`, cmd: 'recharge', hint: 'and impact webs' },
          { icon: '🤟', label: 'Thwip!', cmd: 'thumbsUp' },
          { icon: '🌀', label: w.allies.length ? `Send the Spider-Verse home (${w.allies.length})` : 'Call the Spider-Verse', cmd: w.allies.length ? 'dismissAllies' : 'callAllies', args: { count: 3 } },
          '-',
          ...LOOKS.map(([k, l]) => ({ icon: '🎨', label: l, cmd: 'setting', args: { key: 'spiderSuit', value: k }, checked: look === k })),
        ],
      },
    ];
  }

  trayItems() {
    return [['Swing around the screens', 'patrol'], ['Patch up & refill webs', 'repair+recharge']];
  }

  snapExtra() {
    const g = this.grip();
    return {
      line: this.anchor && this.mode === 'air' ? { x1: g.x, y1: g.y, x2: this.anchor.x, y2: this.anchor.y } : null,
      tether: this.tether ? { x2: this.tether.x, y2: this.tether.y } : null,
      ropeAng: this.ropeAng,
      flipRot: this.flipRot,
      upside: !!(this.anchor && this.attach === 'feet' && this.mode === 'air'),
    };
  }
}

SpiderHero.ID = 'spiderman';
SpiderHero.NAME = 'Spider-Man';
SpiderHero.BODY = 0.95;
SpiderHero.SIZE_KEY = 'spiderSize';
SpiderHero.LOOK_KEY = 'spiderSuit';
SpiderHero.DEFAULTS = { spiderSize: 'small', spiderSuit: 'classic' };
SpiderHero.HOME = 'Spider-HQ';
SpiderHero.WELCOME = 'Right-click Spider-Man for the web menu — deploy bad guys, call the Spider-Verse or set a reminder. Drag him around: he webs his way out.';
// the Spider-Verse: up to 5 friends from other dimensions join an army battle
SpiderHero.ALLIES = {
  max: 5, color: '255,90,110', sound: 'spThwip', callSound: 'spCall',
  looks: [['miles', 'MILES'], ['gwen', 'GWEN'], ['m2099', '2099'], ['noir', 'NOIR'], ['symbiote', 'BLACK SUIT'], ['iron', 'IRON SPIDER'], ['classic', 'PETER']],
};
SpiderHero.LINES = {
  threat: ['Spider-sense tingling!', 'Uh-oh. Robots.', 'Heads up!', 'Bad guys, twelve o\'clock!'],
  heavyThreat: 'Whoa — that\'s a big one!',
  victory: ['Another day saved!', 'Thwip! Done.', 'Neighborhood: safe.', 'Too easy. Knock on wood.'],
  bossDown: 'Big guy down!',
  bossBeam: 'Beam incoming — move!',
  locked: (label) => `On it — the ${label.toLowerCase()}!`,
  invasion: 'Robot party. I wasn\'t invited.',
  army: (total) => (total >= 1000 ? 'A THOUSAND?! Okay… okay.' : `${total} bad guys incoming!`),
  armyBoss: 'Big mech incoming!',
  milestone: (m, done) => (m === 1 ? `${done} down! Keep swinging!` : m === 2 ? 'Halfway, spider-friends!' : `${done}! They're running!`),
  callAllies: 'Calling the Spider-Verse!',
  allyReplace: 'Another spider, inbound!',
  allyDown: (cs) => `${cs} went home!`,
  armyWon: 'We did it, Spider-Team!',
  formUp: 'Spider-Verse, swing in!',
  nukeStill: 'They\'re still coming?!',
  nukeClear: 'Well… that happened.',
  thrown: ['Whoaaa—!', 'Not again!', 'Oof!'],
  recover: ['I\'m okay! I\'m okay!', 'That\'ll leave a mark.', 'Note to self: avoid nukes.'],
  evacuate: 'Nuke?! Swinging away!',
  evacuateAlly: 'Go, go, go!',
  brace: 'Hold on to something!',
  armorLow: 'Need a breather…',
  allyArrive: (cs) => `${cs}, here!`,
  allyLeave: ['See ya, Spidey!', 'Catch you in the multiverse!', 'Thwip out!'],
  greet: ['Hey there!', 'What\'s up?', 'Need a hand? I\'ve got two.', 'Friendly neighborhood Spidey!'],
  poke: ['Okay, that tickles.', 'Hey, personal space!', 'I\'m not a button!'],
  held: ['Hey! Put me down!', 'This is so undignified.', 'I can swing, y\'know.'],
};
SpiderHero.REMINDER = {
  header: 'Spidey-sense tingling!',
  quips: [
    'With great power comes… a to-do list.',
    'I\'ll hang around until it\'s done.',
    'Even heroes have chores.',
    'Thwip! That\'s the sound of you getting it done.',
    'My spider-sense says: now.',
    'Go on — I\'ll keep the neighborhood safe.',
  ],
  speech: (when, text, quip) => `Hey! It's ${when}. ${text}. ${quip}`,
  notify: (text) => `🕷️ ${text}`,
};
SpiderHero.UI = {
  title: 'YOUR FRIENDLY NEIGHBOR',
  quick: [['🔄', 'Swing around', 'patrol'], ['🤸', 'Backflip', 'flip'], ['🤟', 'Thwip!', 'thumbsUp'], ['🩹', 'Patch up', 'repair'], ['🧪', 'Refill webs', 'recharge'], ['🌀', 'Spider-Verse', 'callAllies', { count: 3 }], ['👋', 'Send home', 'dismissAllies'], ['⬇️', 'Drop down', 'land']],
  stats: [['kills', 'bad guys stopped'], ['drones', 'Ultron drones'], ['walkers', 'Ultron soldiers'], ['tanks', 'Ultron heavies'], ['bosses', 'villains webbed up'], ['thanos', 'Thanos'], ['doom', 'Doctor Doom'], ['kang', 'Kang'], ['galactus', 'Galactus'], ['armiesWon', 'armies beaten'], ['webs', 'web shots'], ['zipKicks', 'zip kicks'], ['yanks', 'drones yanked'], ['throws', 'walkers flung'], ['impactWebs', 'impact webs'], ['swings', 'web swings'], ['legion', 'spider-friends called'], ['nukes', 'nukes survived'], ['reboots', 'knockouts']],
  looks: { key: 'spiderSuit', options: LOOKS },
  armyNote: (n, size) => (size === 'legendary'
    ? 'All 5 Spider-Verse heroes swing in, and a new one arrives when one taps out. It ends with Galactus. About 5 minutes of web-slinging.'
    : size === 'epic' ? 'All 5 Spider-Verse heroes swing in. Thanos, Doom and Kang lead the waves.'
      : `Spider-Man will call ${n} friends from the Spider-Verse.`),
  help: [
    ['🖱️ The menu', 'Right-click anywhere (or on Spider-Man) for the web menu. The tray icon and <b class="sc"></b> work too.'],
    ['🕸️ Getting around', 'He can\'t fly — he swings. Webs stick to the top edge of your screen and he swings in arcs from screen to screen, zips up a line, or hangs upside-down from a thread. Drag him and let go: he catches a web.'],
    ['🎯 Bad guys', '<i>Deploy enemy</i> drops Ultron\'s robots (sentry, soldier, heavy, swarm) or a supervillain — Thanos, Doctor Doom, Kang, or the giant Galactus — where you right-clicked. Click an enemy to make it his next target.'],
    ['💥 Moves', 'Web shots stick enemies in place (webbed drones sink to the floor, webbed walkers can\'t shoot). He zips in for kicks, yanks drones down and slams them, flings a webbed walker into its friends, and throws impact webs that snare a whole group. His spider-sense makes him flip out of the way.'],
    ['🧪 Web fluid', 'Every web uses web fluid; it refills while he\'s on the floor. Impact webs reload slowly. Out of health? He\'s knocked out for a moment, then gets back up.'],
    ['⚔ Army attack &amp; the Spider-Verse', 'Pick a side and a size — up to a legendary 1000. Spider-Man calls up to 5 friends from other dimensions; when one taps out, another swings in.'],
    ['☢ Nuke', 'A siren, a falling bomb, a mushroom cloud and a shockwave that wipes the screen. Spider-Man swings for another screen — if the wave catches him, he goes flying.'],
  ],
};

module.exports = SpiderHero;
