/*
 * Desktop Buddies — Homelander art: a procedural, fan-made drawing (for
 * personal use; the character belongs to his creators).
 *
 * Built on the armored hero's skeleton (IronArt.rig: the same joints, bone
 * lengths and 2-bone IK), with its own poses, a navy suit with a gold eagle,
 * slicked-back blond hair, a smug face, glowing heat-vision eyes and a US-flag
 * cape that streams behind him with his speed and flutters while he hovers.
 * Also his callouts, hover card, effects, sounds and icons.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, abs, max, min, hypot, atan2, PI } = Math;
  const I = root.IronArt;
  const RG = I.rig;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const P = (x, y) => ({ x, y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const rot = (p, a) => ({ x: p.x * cos(a) - p.y * sin(a), y: p.x * sin(a) + p.y * cos(a) });
  const norm = (p) => { const l = hypot(p.x, p.y) || 1; return { x: p.x / l, y: p.y / l }; };
  const lp = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
  const smooth = (k) => k * k * (3 - 2 * k);

  // ------------------------------------------------------------------ looks
  const LOOKS = {
    classic: {
      label: 'Classic (flag cape)',
      suit: ['#34509e', '#1f3170', '#0e1739'], line: '#070c22', boot: ['#26386f', '#141f47', '#080d24'],
      gold: ['#fff0b3', '#e2b34a', '#8a6214'], goldLine: '#4a3206',
      skin: ['#ffe2cb', '#f0c3a0', '#c48a68'], hair: ['#fff4bf', '#f0d070', '#b48a2c'],
      cape: { red: '#c1232f', white: '#f5f3ee', blue: '#25367f', star: '#ffffff', line: '#4e0a10' },
      texture: 'rgba(150,180,255,0.16)',
    },
    midnight: {
      label: 'Midnight ops',
      suit: ['#4a4f5c', '#262a33', '#0e1014'], line: '#030405', boot: ['#3a3e48', '#1c1f26', '#08090c'],
      gold: ['#e8ecf2', '#a7aebb', '#5c6370'], goldLine: '#20242b',
      skin: ['#ffe2cb', '#f0c3a0', '#c48a68'], hair: ['#fff4bf', '#f0d070', '#b48a2c'],
      cape: { red: '#2c2f37', white: '#5d626e', blue: '#15171c', star: '#9aa1ad', line: '#050507' },
      texture: 'rgba(200,210,230,0.12)',
    },
    gala: {
      label: 'White gala suit',
      suit: ['#ffffff', '#e9e6dc', '#b7b2a3'], line: '#5a5446', boot: ['#f6f3ea', '#d7d2c3', '#9c9686'],
      gold: ['#fff2bd', '#e4b84f', '#8e6618'], goldLine: '#5a400c',
      skin: ['#ffe2cb', '#f0c3a0', '#c48a68'], hair: ['#fff4bf', '#f0d070', '#b48a2c'],
      cape: { red: '#c1232f', white: '#f5f3ee', blue: '#25367f', star: '#ffffff', line: '#4e0a10' },
      texture: 'rgba(120,110,80,0.14)',
    },
  };
  const lookOf = (k) => LOOKS[k] || LOOKS.classic;

  // ------------------------------------------------------------------ poses
  // c = { t, T, phase, aim:{x,y}|null (unit dir, local), m:{ air, charge, lean, climb, swing, h } }
  function base(T) {
    const p = RG.base(T);
    p.face = null; p.crossed = false; p.cape = 0;
    for (const a of p.arms) a.open = 0;
    return p;
  }

  // hands on hips, elbows out
  function hips(p) {
    p.arms[0].hand = P(-12.5, -50.5); p.arms[0].bend = 1;
    p.arms[1].hand = P(11.5, -51); p.arms[1].bend = -1;
    return p;
  }
  // arms crossed over the chest
  function cross(p, dy) {
    dy = dy || 0;
    p.arms[0].hand = P(7.5, -61 + dy); p.arms[0].bend = 1;
    p.arms[1].hand = P(-6, -63.5 + dy); p.arms[1].bend = -1;
    p.crossed = true;
    return p;
  }
  function hoverLegs(p, bob) {
    p.hip.y = -46 + bob;
    p.legs[0].foot = P(-2.5, -4 + bob); p.legs[1].foot = P(3.5, -2 + bob);
    p.legs[0].footAng = 0.75; p.legs[1].footAng = 0.65;
    return p;
  }
  function headAim(p, c, k) {
    const a = c.aim;
    if (!a) return p;
    p.headTilt = clamp(atan2(a.y, max(0.25, a.x)) * (k || 0.8), -0.75, 0.75);
    return p;
  }

  const POSES = {};

  POSES.stand = (c) => {
    const p = hips(base(c.T));
    p.legs[0].foot = P(-8.5, -4); p.legs[1].foot = P(8.5, -4);
    p.headTilt = -0.06 + 0.03 * sin(c.T * 0.4);
    p.turn = 0.45;
    return p;
  };

  POSES.cross = (c) => {
    const p = cross(base(c.T));
    p.legs[0].foot = P(-7.5, -4); p.legs[1].foot = P(8, -4);
    p.headTilt = -0.1 + 0.03 * sin(c.T * 0.5);
    p.turn = 0.5;
    return p;
  };

  POSES.idleLook = (c) => {
    const p = hips(base(c.T));
    p.legs[0].foot = P(-8, -4); p.legs[1].foot = P(8, -4);
    p.headTilt = -0.08 + 0.08 * sin(c.t * 1.3);
    p.turn = 0.35 + 0.3 * sin(c.t * 0.8);
    return p;
  };

  POSES.hair = (c) => {
    // smooths his hair back with one hand
    const p = base(c.T);
    p.legs[0].foot = P(-8, -4); p.legs[1].foot = P(8, -4);
    const k = (c.t * 1.2) % 1;
    p.arms[0].hand = lp(P(6, -100), P(-6, -96), smooth(k));
    p.arms[0].open = 1; p.arms[0].handAng = PI + 0.3; p.arms[0].bend = -1;
    p.arms[1].hand = P(11.5, -51); p.arms[1].bend = -1;
    p.headTilt = -0.15;
    p.turn = 0.55;
    p.face = 'smug';
    return p;
  };

  POSES.walk = (c) => {
    const p = base(c.T);
    const ph = c.phase, s = sin(ph), k = cos(ph);
    p.hip.y = -44 - abs(k) * 1.2;
    p.lean = 0.03;
    p.legs[0].foot = P(-1 + 9 * s, -4 - 5 * max(0, -k));
    p.legs[1].foot = P(1 - 9 * s, -4 - 5 * max(0, k));
    p.legs[0].footAng = -0.25 * max(0, -k);
    p.legs[1].footAng = -0.25 * max(0, k);
    p.arms[0].hand = P(-11 - 7 * s, -48 + 1.5 * abs(s));
    p.arms[1].hand = P(10 + 7 * s, -48 + 1.5 * abs(s));
    p.headTilt = -0.08;
    return p;
  };

  POSES.crouch = (c) => {
    const p = base(c.T);
    p.hip.y = -34;
    p.lean = 0.28;
    p.legs[0].foot = P(-9, -4); p.legs[1].foot = P(9, -4);
    p.arms[0].hand = P(-15, -38); p.arms[1].hand = P(14, -40);
    p.headTilt = -0.2;
    return p;
  };

  POSES.hover = (c) => {
    // floating with his arms crossed, the cape doing all the work
    const bob = 1.4 * sin(c.T * 2.2);
    const p = hoverLegs(cross(base(c.T), bob), bob);
    p.lean = (c.m.lean || 0) * 0.25;
    p.headTilt = -0.12;
    p.turn = 0.5;
    p.shadow = 1;
    return p;
  };

  POSES.flyUp = (c) => {
    // one fist up, straight into the sky
    const bob = 0.8 * sin(c.T * 3);
    const p = hoverLegs(base(c.T), bob);
    p.legs[0].foot = P(-1.5, -2); p.legs[1].foot = P(2, -1);
    p.legs[0].footAng = p.legs[1].footAng = 1.1;
    p.arms[0].hand = P(2, -104); p.arms[0].bend = -1;
    p.arms[1].hand = P(9, -50);
    p.headTilt = -0.35;
    p.cape = 0.4;
    return p;
  };

  POSES.fly = (c) => {
    // the cruise: body flat, fist first, cape streaming behind
    const p = base(c.T);
    p.hip.y = -44;
    p.legs[0].foot = P(-1.2, -2.5); p.legs[1].foot = P(1.8, -3.5);
    p.legs[0].footAng = p.legs[1].footAng = 1.35;
    p.arms[0].hand = P(3, -104); p.arms[0].bend = -1;
    p.arms[1].hand = P(7, -49);
    p.headTilt = -0.75;
    p.rot = 1.2 - (c.m.climb || 0) * 0.45; // nose up when climbing, down when diving
    p.oy = -10;
    p.shadow = 0;
    return p;
  };

  POSES.land = (c) => {
    // superhero landing: one knee down, fist on the floor
    const p = base(c.T);
    p.hip = P(-2, -21);
    p.lean = 0.5;
    p.legs[0].foot = P(-17, -2); p.legs[0].knee = P(-6, -4); p.legs[0].footAng = 1.2;
    p.legs[1].foot = P(13, -4); p.legs[1].knee = P(14, -24);
    p.arms[0].hand = P(10, -4); p.arms[0].elbow = P(6, -20);
    p.arms[1].hand = P(-24, -28); p.arms[1].open = 1; p.arms[1].handAng = PI * 0.9;
    p.headTilt = 0.3;
    p.cape = 0.25;
    return p;
  };

  function heatPose(c, air) {
    const p = air ? hoverLegs(base(c.T), 1.2 * sin(c.T * 2.2)) : base(c.T);
    if (!air) { p.legs[0].foot = P(-10, -4); p.legs[1].foot = P(9, -4); p.hip.y += 1.5; }
    p.lean = 0.1;
    // fists clenched at his sides, all the power in the eyes
    p.arms[0].hand = P(-12, -50); p.arms[0].bend = 1;
    p.arms[1].hand = P(12, -50); p.arms[1].bend = -1;
    headAim(p, c, 0.85);
    p.face = 'angry';
    return p;
  }
  POSES.heat = (c) => heatPose(c, false);
  POSES.heatAir = (c) => heatPose(c, true);

  POSES.punch = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    const k = clamp(c.t / 0.14, 0, 1);
    p.lean = 0.25 * k;
    if (!c.m.air) { p.legs[0].foot = P(-11, -4); p.legs[1].foot = P(10, -4); }
    p.arms[0].hand = lp(P(-16, -62), P(28, -68), smooth(k)); p.arms[0].bend = -1;
    p.arms[1].hand = P(-4, -56);
    p.face = 'angry';
    p.cape = 0.3 * k;
    return p;
  };

  POSES.clap = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    if (!c.m.air) { p.legs[0].foot = P(-11, -4); p.legs[1].foot = P(10, -4); }
    const k = clamp((c.t - 0.18) / 0.14, 0, 1);
    // arms flung wide, then slammed together in front of him
    p.arms[0].hand = lp(P(-26, -78), P(18, -70), smooth(k));
    p.arms[1].hand = lp(P(25, -82), P(19, -71), smooth(k));
    p.arms[0].open = p.arms[1].open = 1;
    p.arms[0].handAng = lerp(-2.4, 0.15, k); p.arms[1].handAng = lerp(-0.8, 0.1, k);
    p.arms[0].bend = -1; p.arms[1].bend = -1;
    p.lean = lerp(-0.12, 0.18, k);
    p.face = 'angry';
    p.cape = 0.6 * k;
    return p;
  };

  POSES.lift = (c) => {
    // holding something heavy over his head
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    if (!c.m.air) { p.legs[0].foot = P(-11, -4); p.legs[1].foot = P(11, -4); p.hip.y = -42; }
    p.arms[0].hand = P(-2, -104); p.arms[1].hand = P(6, -104);
    p.arms[0].open = p.arms[1].open = 1;
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2;
    p.arms[0].bend = -1; p.arms[1].bend = 1;
    p.headTilt = -0.25;
    p.face = 'smug';
    return p;
  };

  POSES.throw = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    const k = clamp(c.t / 0.22, 0, 1);
    p.arms[0].hand = lp(P(-8, -104), P(26, -82), smooth(k)); p.arms[0].bend = -1;
    p.arms[1].hand = lp(P(2, -104), P(24, -78), smooth(k)); p.arms[1].bend = -1;
    p.arms[0].open = p.arms[1].open = 1 - k;
    p.lean = lerp(-0.2, 0.3, k);
    p.face = 'angry';
    p.cape = 0.5 * k;
    return p;
  };

  POSES.wave = (c) => {
    // a big friendly wave to the fans (other hand on the hip)
    const p = hips(base(c.T));
    p.legs[0].foot = P(-8, -4); p.legs[1].foot = P(8.5, -4);
    p.arms[0].hand = P(-1 + 4 * sin(c.t * 9), -102); p.arms[0].bend = 1;
    p.arms[0].open = 1; p.arms[0].handAng = -PI / 2 + 0.35 * sin(c.t * 9);
    p.turn = 0.65;
    p.headTilt = -0.08;
    p.face = 'grin';
    if (c.m.air) hoverLegs(p, 0);
    return p;
  };

  POSES.camera = (c) => {
    // the photo-op: thumbs up, chin up, big smile
    const p = hips(base(c.T));
    p.legs[0].foot = P(-9, -4); p.legs[1].foot = P(8, -4);
    const k = clamp(c.t / 0.3, 0, 1);
    p.arms[0].hand = lp(P(-12.5, -50.5), P(7, -68), k); p.arms[0].bend = 1;
    p.arms[0].thumb = k; p.arms[0].handAng = -PI / 2;
    p.turn = 0.7;
    p.headTilt = -0.14;
    p.face = 'grin';
    if (c.m.air) hoverLegs(p, 0);
    return p;
  };
  POSES.thumbsUp = POSES.camera;

  POSES.present = (c) => {
    // "a message for you": one arm opens toward you
    const p = hips(base(c.T));
    const k = clamp(c.t / 0.4, 0, 1);
    p.arms[0].hand = lp(P(-12.5, -50.5), P(19, -60), smooth(k)); p.arms[0].bend = 1;
    p.arms[0].open = k; p.arms[0].handAng = lerp(0, 0.35, k);
    p.turn = 0.75;
    p.face = 'grin';
    if (c.m.air) hoverLegs(p, 1.2 * sin(c.T * 2.2)); else { p.legs[0].foot = P(-8, -4); p.legs[1].foot = P(8.5, -4); }
    return p;
  };
  POSES.salute = POSES.present;

  POSES.stare = (c) => {
    // hands behind his back, head tilted, a little too still
    const p = base(c.T);
    p.legs[0].foot = P(-7, -4); p.legs[1].foot = P(7, -4);
    p.arms[0].hand = P(-15, -48); p.arms[0].bend = 1;
    p.arms[1].hand = P(-12, -50); p.arms[1].bend = 1;
    headAim(p, c, 0.5);
    p.headTilt += 0.12 * sin(c.t * 0.6);
    p.turn = 0.8;
    p.face = 'stare';
    return p;
  };

  POSES.brace = (c) => {
    // arms crossed, leaning into the blast, cape torn backwards
    const p = cross(base(c.T));
    p.hip.y = -42;
    p.lean = 0.22;
    p.legs[0].foot = P(-12, -4); p.legs[1].foot = P(9, -4);
    p.headTilt = 0.1;
    p.face = 'angry';
    p.cape = 1;
    if (c.m.air) hoverLegs(p, 0);
    return p;
  };

  POSES.stagger = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    p.lean = -0.3;
    p.arms[0].hand = P(4, -74); p.arms[1].hand = P(10, -72);
    p.arms[0].open = p.arms[1].open = 1;
    p.headTilt = -0.25;
    p.face = 'dazed';
    return p;
  };

  POSES.down = (c) => {
    const p = base(c.T);
    p.rot = -1.5;
    p.oy = 38;
    p.ox = 6;
    p.arms[0].hand = P(-14, -40); p.arms[1].hand = P(14, -44);
    p.arms[0].open = p.arms[1].open = 1;
    p.legs[0].foot = P(-6, -3); p.legs[1].foot = P(5, -6);
    p.shadow = 1.4;
    p.face = 'dazed';
    return p;
  };

  POSES.powerDown = (c) => {
    // off duty: arms crossed, eyes closed, perfectly still
    const p = cross(base(c.T));
    p.legs[0].foot = P(-7, -4); p.legs[1].foot = P(7.5, -4);
    p.headTilt = 0.18 + 0.03 * sin(c.T * 0.7);
    p.face = 'calm';
    return p;
  };

  POSES.held = (c) => {
    // dangling from your cursor with his arms crossed, deeply unimpressed
    const p = cross(base(c.T));
    const f = sin(c.T * 5);
    p.hip.y = -44;
    p.legs[0].foot = P(-3 + 1.5 * f, -3); p.legs[1].foot = P(3 - 1.5 * f, -4);
    p.legs[0].footAng = p.legs[1].footAng = 0.7;
    p.headTilt = 0.1;
    p.rot = c.m.swing || 0;
    p.shadow = 0;
    p.face = 'angry';
    return p;
  };

  // ------------------------------------------------------------------ rig
  function makeRig(name, c) {
    c.m = c.m || {};
    const p = (POSES[name] || POSES.stand)(c);
    const R = RG.resolve(p);
    R.face = p.face;
    R.crossed = p.crossed;
    R.cape = p.cape || 0;
    return R;
  }

  function lerpRig(a, b, k) {
    if (k >= 1) return b;
    if (k <= 0) return a;
    const o = I.lerpRig(a, b, k);
    o.face = k < 0.5 ? a.face : b.face;
    o.crossed = k < 0.5 ? a.crossed : b.crossed;
    o.cape = lerp(a.cape || 0, b.cape || 0, k);
    return o;
  }

  // ------------------------------------------------------------------ drawing helpers
  const grad = RG.grad;
  const limb = RG.limb;
  function dim(cols) { return [cols[1], cols[2], cols[2]]; }

  // ------------------------------------------------------------------ the cape
  // A ribbon of 13 stripes hanging from the shoulders: it hangs behind him at
  // rest, flutters while he hovers and streams out behind him in flight.
  function drawCape(ctx, R, L, T, h) {
    const C = L.cape;
    const facing = h && h.facing ? h.facing : 1;
    const vx = h ? (h.vx || 0) * facing : 0, vy = h ? h.vy || 0 : 0;
    const sp = hypot(vx, vy);
    const air = !!(h && (h.mode === 'air' || h.mode === 'held' || h.mode === 'thrown'));
    const k = clamp(sp / 520, 0, 1);
    // where the wind pushes it (hero-local, before the body's rotation)
    let fx = -0.22 - 0.9 * R.cape, fy = 1 - 0.55 * R.cape;
    if (sp > 1) { fx = lerp(fx, -vx / sp * 1.3, k); fy = lerp(fy, -vy / sp * 1.3 + 0.25, k); }
    const flow = rot(norm(P(fx, fy)), -(R.rot || 0));
    const down = rot(P(-0.1, 1), R.lean);
    const top = add(R.hip, rot(P(-3.2, -30.5), R.lean));
    const N = 13, len = 64 + 6 * k, seg = len / N;
    const amp = (air ? 0.16 : 0.07) + 0.3 * k + 0.25 * R.cape;
    const spd = 3.5 + 7 * k + 4 * R.cape;
    const pts = [top], dirs = [];
    let p = top;
    for (let i = 0; i < N; i++) {
      const f = i / N;
      const d0 = norm(lp(down, flow, smooth(min(1, f * 1.7 + (air ? 0.25 : 0)))));
      const d = rot(d0, amp * sin(T * spd - i * 0.62) * (0.25 + f));
      dirs.push(d);
      p = add(p, mul(d, seg));
      pts.push(p);
    }
    dirs.push(dirs[N - 1]);
    const halfW = (i) => lerp(9.5, 15.5, i / N) * (1 + 0.08 * sin(T * spd * 0.7 - i * 0.5) * (air ? 1 : 0.3));
    const edge = (i, side) => { const d = dirs[i], n = P(-d.y, d.x); return add(pts[i], mul(n, side * halfW(i))); };
    const quad = (a, b, c2, d, col) => {
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(d.x, d.y); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.5; ctx.stroke();
    };
    // stripes (and the starred blue field at the top, on the outer side)
    for (let i = 0; i < N; i++) {
      const stripe = i % 2 === 0 ? C.red : C.white;
      if (i < 6) {
        quad(edge(i, 1), edge(i + 1, 1), pts[i + 1], pts[i], C.blue);
        quad(pts[i], pts[i + 1], edge(i + 1, -1), edge(i, -1), stripe);
      } else quad(edge(i, 1), edge(i + 1, 1), edge(i + 1, -1), edge(i, -1), stripe);
    }
    ctx.fillStyle = C.star;
    for (let i = 0; i < 6; i++) {
      for (const u of (i % 2 ? [0.3, 0.72] : [0.5, 0.88])) {
        const q = lp(pts[i], edge(i, 1), u);
        const q2 = lp(pts[i + 1], edge(i + 1, 1), u);
        const m = lp(q, q2, 0.5);
        star(ctx, m.x, m.y, 1.15);
      }
    }
    // folds and the far side in shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.4;
    for (const u of [0.35, -0.45]) {
      ctx.beginPath();
      for (let i = 2; i <= N; i++) { const q = lp(pts[i], edge(i, u > 0 ? 1 : -1), abs(u)); if (i === 2) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
      ctx.stroke();
    }
    ctx.restore();
    // outline
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const q = edge(i, 1); if (!i) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
    for (let i = N; i >= 0; i--) { const q = edge(i, -1); ctx.lineTo(q.x, q.y); }
    ctx.closePath();
    ctx.lineWidth = 1; ctx.strokeStyle = C.line; ctx.stroke();
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r;
      if (!i) ctx.moveTo(x + cos(a) * rr, y + sin(a) * rr); else ctx.lineTo(x + cos(a) * rr, y + sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  // ------------------------------------------------------------------ body
  function drawLeg(ctx, Lg, L, far) {
    const suit = far ? dim(L.suit) : L.suit;
    const boot = far ? dim(L.boot) : L.boot;
    limb(ctx, Lg.hip, Lg.knee, 12.4, 9.8, suit, L.line);
    // shin: suit, then the boot from mid-shin down
    const mid = lp(Lg.knee, Lg.foot, 0.42);
    limb(ctx, Lg.knee, mid, 9.6, 8.8, suit, L.line);
    limb(ctx, mid, Lg.foot, 9.2, 7.8, boot, L.line);
    // gold trim on the boot top
    const d = norm(sub(Lg.foot, Lg.knee)), n = P(-d.y, d.x);
    ctx.beginPath(); ctx.moveTo(mid.x + n.x * 4.7, mid.y + n.y * 4.7); ctx.lineTo(mid.x - n.x * 4.7, mid.y - n.y * 4.7);
    ctx.lineWidth = 1.4; ctx.strokeStyle = far ? L.gold[2] : L.gold[1]; ctx.stroke();
    // thigh muscle line
    if (!far) {
      const a = lp(Lg.hip, Lg.knee, 0.25), b = lp(Lg.hip, Lg.knee, 0.85);
      ctx.beginPath(); ctx.moveTo(a.x + n.x * 1.5, a.y + n.y * 1.5); ctx.quadraticCurveTo(lp(a, b, 0.5).x + n.x * 3.4, lp(a, b, 0.5).y + n.y * 3.4, b.x + n.x * 1.2, b.y + n.y * 1.2);
      ctx.lineWidth = 0.7; ctx.strokeStyle = L.texture; ctx.stroke();
    }
    // boot
    ctx.save();
    ctx.translate(Lg.foot.x, Lg.foot.y);
    ctx.rotate(Lg.ang);
    ctx.beginPath();
    ctx.moveTo(-3.8, -2.2); ctx.lineTo(3, -2.6); ctx.quadraticCurveTo(8, -0.8, 8.4, 3.2);
    ctx.lineTo(-4, 3.8); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -2.6, 0, 3.8, boot); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.restore();
  }

  function drawHand(ctx, A, L, far) {
    const suit = far ? dim(L.suit) : L.suit;
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    ctx.rotate(A.ang);
    ctx.lineWidth = 1; ctx.strokeStyle = L.line;
    if (A.open > 0.5) {
      // open glove: palm and fingers
      ctx.beginPath();
      ctx.moveTo(-1.5, -3.4); ctx.lineTo(4, -3.2); ctx.lineTo(8.2, -2.4); ctx.quadraticCurveTo(9.4, -0.6, 8.2, 0.6);
      ctx.lineTo(4.4, 1.2); ctx.lineTo(5.6, 3.6); ctx.quadraticCurveTo(4.6, 4.8, 3.2, 3.8); ctx.lineTo(-1.5, 3.4); ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, -3.4, 0, 3.4, suit); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(4.2, -1.6); ctx.lineTo(8.4, -1.2); ctx.moveTo(4.2, -0.1); ctx.lineTo(8.2, 0); ctx.stroke();
    } else {
      // fist
      ctx.beginPath();
      ctx.moveTo(-1.5, -3.6); ctx.lineTo(3.6, -3.7); ctx.quadraticCurveTo(6.6, -3.5, 6.6, 0); ctx.quadraticCurveTo(6.6, 3.6, 3.6, 3.7); ctx.lineTo(-1.5, 3.6); ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, -3.7, 0, 3.7, suit); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(4.6, -2.6); ctx.lineTo(4.6, 2.6); ctx.stroke();
    }
    if (A.thumb > 0.1) {
      ctx.beginPath(); ctx.moveTo(2, -3.2); ctx.lineTo(2.4 + 0.4 * A.thumb, -3.2 - 5.2 * A.thumb);
      ctx.lineCap = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = L.line; ctx.stroke();
      ctx.lineWidth = 1.8; ctx.strokeStyle = suit[0]; ctx.stroke();
    }
    ctx.restore();
  }

  function drawArm(ctx, A, L, far) {
    const suit = far ? dim(L.suit) : L.suit;
    const gold = far ? dim(L.gold) : L.gold;
    limb(ctx, A.sh, A.elbow, 10, 8.6, suit, L.line);
    limb(ctx, A.elbow, A.hand, 8.8, 7.8, suit, L.line);
    // biceps line
    if (!far) {
      const d = norm(sub(A.elbow, A.sh)), n = P(-d.y, d.x);
      const m = lp(A.sh, A.elbow, 0.55);
      ctx.beginPath(); ctx.moveTo(m.x - d.x * 3 + n.x * 2.4, m.y - d.y * 3 + n.y * 2.4); ctx.quadraticCurveTo(m.x + n.x * 3.6, m.y + n.y * 3.6, m.x + d.x * 3.4 + n.x * 2.2, m.y + d.y * 3.4 + n.y * 2.2);
      ctx.lineWidth = 0.7; ctx.strokeStyle = L.texture; ctx.stroke();
    }
    drawHand(ctx, A, L, far);
    // eagle-feather shoulder piece
    ctx.save();
    ctx.translate(A.sh.x, A.sh.y);
    ctx.rotate(atan2(A.elbow.y - A.sh.y, A.elbow.x - A.sh.x) - PI / 2);
    ctx.beginPath();
    ctx.moveTo(-6.4, -1.8);
    ctx.quadraticCurveTo(0, -7, 6.4, -1.8);
    ctx.lineTo(5.2, 2.4); ctx.lineTo(3.2, 1); ctx.lineTo(1.6, 4); ctx.lineTo(0, 1.6); ctx.lineTo(-1.6, 4); ctx.lineTo(-3.2, 1); ctx.lineTo(-5.2, 2.4);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -6, 0, 4, gold); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.goldLine; ctx.stroke();
    ctx.restore();
  }

  function drawTorso(ctx, R, L) {
    ctx.save();
    ctx.translate(R.hip.x, R.hip.y);
    ctx.rotate(R.lean);
    const f = 2.2 * (R.turn - 0.35) / 0.65 + 1.2; // feature shift toward facing
    // hips / pelvis
    ctx.beginPath();
    ctx.moveTo(-9.8, -4); ctx.lineTo(9.8, -4); ctx.lineTo(9, 4); ctx.lineTo(1, 5.5); ctx.lineTo(-9, 4); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -4, 0, 5, L.suit); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = L.line; ctx.stroke();
    // torso: broad shoulders, narrow waist
    ctx.beginPath();
    ctx.moveTo(-8.8, -3.5);
    ctx.lineTo(-12.2, -16); ctx.quadraticCurveTo(-15.2, -28, -10.6, -32);
    ctx.lineTo(-3.4, -34.2); ctx.lineTo(4.6, -34.2); ctx.lineTo(11.2, -32);
    ctx.quadraticCurveTo(16, -28.5, 14.6, -20);
    ctx.quadraticCurveTo(12.8, -11.5, 9.2, -3.5);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -12, -33, 12, -4, L.suit); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = L.line; ctx.stroke();
    // suit texture: pecs, abs, obliques
    ctx.strokeStyle = L.texture; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-9 + f * 0.4, -18.5); ctx.quadraticCurveTo(-3 + f * 0.5, -15.6, 1 + f * 0.6, -17.8);
    ctx.quadraticCurveTo(6 + f * 0.6, -15.4, 12 + f * 0.3, -18.6);
    ctx.moveTo(1 + f * 0.55, -17.5); ctx.lineTo(1 + f * 0.45, -5);
    ctx.moveTo(-4.5 + f * 0.45, -13.2); ctx.lineTo(6.5 + f * 0.45, -13.2);
    ctx.moveTo(-4 + f * 0.4, -9.4); ctx.lineTo(6.2 + f * 0.4, -9.4);
    ctx.moveTo(-8.4, -13); ctx.quadraticCurveTo(-7, -8, -6.2, -5);
    ctx.stroke();
    // gold eagle across the chest, wings to the shoulders
    const ex = 1 + f, ey = -23;
    ctx.beginPath();
    ctx.moveTo(ex - 1, ey - 1);
    ctx.quadraticCurveTo(ex - 5.5, ey - 5.5, -10.2, -31.2);
    ctx.lineTo(-9.2, -27.4); ctx.lineTo(-7.2, -27.8); ctx.lineTo(-7.6, -25); ctx.lineTo(-5.4, -25.4); ctx.lineTo(-5.4, -22.6); ctx.lineTo(ex - 2.5, ey + 1.6);
    ctx.closePath();
    ctx.moveTo(ex + 1, ey - 1);
    ctx.quadraticCurveTo(ex + 6, ey - 5.5, 11.6, -31.2);
    ctx.lineTo(10.6, -27.4); ctx.lineTo(8.6, -27.8); ctx.lineTo(9, -25); ctx.lineTo(6.8, -25.4); ctx.lineTo(6.8, -22.6); ctx.lineTo(ex + 2.5, ey + 1.6);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -32, 0, -21, L.gold); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = L.goldLine; ctx.stroke();
    // the eagle's body (a little shield) and head
    ctx.beginPath();
    ctx.moveTo(ex - 2.6, ey - 2.4); ctx.lineTo(ex + 2.6, ey - 2.4); ctx.lineTo(ex + 2.2, ey + 3.4); ctx.lineTo(ex, ey + 6.2); ctx.lineTo(ex - 2.2, ey + 3.4); ctx.closePath();
    ctx.fillStyle = grad(ctx, ex, ey - 3, ex, ey + 6, L.gold); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + 0.4, ey - 3.8, 1.7, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + 1.8, ey - 4.2); ctx.lineTo(ex + 3.2, ey - 3.4); ctx.lineTo(ex + 1.8, ey - 3); ctx.fillStyle = L.gold[2]; ctx.fill();
    // gold belt and buckle
    ctx.beginPath();
    ctx.moveTo(-9.4, -5.6); ctx.lineTo(9.6, -5.6); ctx.lineTo(9.3, -2.4); ctx.lineTo(-9.1, -2.4); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -5.6, 0, -2.4, L.gold); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.goldLine; ctx.stroke();
    ctx.beginPath(); ctx.rect(ex - 2.2, -6.4, 4.4, 4.8);
    ctx.fillStyle = grad(ctx, ex, -6.4, ex, -1.6, L.gold); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ head
  function drawHead(ctx, R, L, T, heat) {
    ctx.save();
    ctx.translate(R.head.x, R.head.y);
    ctx.rotate(R.lean + R.headTilt);
    const f = 1.5 + 2.6 * (R.turn - 0.35) / 0.65;
    const face = R.face || 'smug';
    // neck and collar
    ctx.beginPath(); ctx.moveTo(-4.2, 3); ctx.lineTo(4.2, 3); ctx.lineTo(5, 11); ctx.lineTo(-4.8, 11); ctx.closePath();
    ctx.fillStyle = grad(ctx, -4, 0, 4, 0, L.skin); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5.6, 9); ctx.quadraticCurveTo(0, 12.5, 5.8, 9); ctx.lineTo(6.4, 12); ctx.lineTo(-6.2, 12); ctx.closePath();
    ctx.fillStyle = L.suit[1]; ctx.fill(); ctx.strokeStyle = L.line; ctx.stroke();
    // skull and square jaw
    ctx.beginPath();
    ctx.moveTo(-7.4, -1.5);
    ctx.bezierCurveTo(-8.4, -8.6, -3.6, -11, 1.6, -10.6);
    ctx.bezierCurveTo(6.6, -10.2, 9, -6.6, 8.8, -1.4);
    ctx.lineTo(8.6, 3.2);
    ctx.quadraticCurveTo(8.4, 8.2, 5, 9.4);
    ctx.lineTo(-0.6, 9.4);
    ctx.quadraticCurveTo(-5.4, 8.6, -6.8, 4);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -7, -9, 8, 9, L.skin); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    // jaw shadow & cheekbone
    ctx.fillStyle = 'rgba(150,80,50,0.18)';
    ctx.beginPath(); ctx.moveTo(-6.4, 3.6); ctx.quadraticCurveTo(-4.6, 8.4, -0.4, 9.2); ctx.lineTo(-1.6, 6.4); ctx.quadraticCurveTo(-4.4, 5.6, -5, 2.4); ctx.closePath(); ctx.fill();
    // ear
    ctx.beginPath(); ctx.ellipse(-5.2 + f * 0.1, 0.9, 1.25, 2.1, -0.2, 0, TAU);
    ctx.fillStyle = L.skin[1]; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5 + f * 0.1, -0.4); ctx.quadraticCurveTo(-5.9 + f * 0.1, 0.8, -5 + f * 0.1, 2); ctx.lineWidth = 0.5; ctx.stroke();
    // slicked-back blond hair
    ctx.beginPath();
    ctx.moveTo(f + 4.9, -5.4);
    ctx.quadraticCurveTo(f + 6.4, -10.6, 1.4, -11.8);
    ctx.quadraticCurveTo(-5.2, -12.2, -7.9, -6.6);
    ctx.quadraticCurveTo(-9.3, -2.6, -7.4, 1.8);
    ctx.lineTo(-5.6, 0.8);
    ctx.quadraticCurveTo(-4.8, -3, -1.6, -4.4);
    ctx.lineTo(f - 0.6, -5.4);
    ctx.quadraticCurveTo(f + 2.2, -7, f + 4.9, -5.4);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -12, 0, 1, L.hair); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#8a6418'; ctx.stroke();
    ctx.strokeStyle = 'rgba(138,100,24,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(f + 4, -7.4); ctx.quadraticCurveTo(0, -10.6, -6.4, -6.6);
    ctx.moveTo(f + 2.4, -6.2); ctx.quadraticCurveTo(-1, -8.6, -6.8, -3.6);
    ctx.moveTo(f + 4.6, -9.2); ctx.quadraticCurveTo(1, -11.6, -4.8, -9.8);
    ctx.stroke();
    drawFace(ctx, f, face, heat, T, L);
    ctx.restore();
  }

  function drawFace(ctx, f, face, heat, T, L) {
    const line = '#5a3222';
    const ne = P(f - 1.9, -1.4), fe = P(f + 3.1, -1.5);
    // brows
    const angry = face === 'angry' || (heat > 0.3 && face !== 'calm');
    ctx.strokeStyle = '#a07a2a'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(ne.x - 1.9, -4.2); ctx.lineTo(ne.x + 1.5, -3);
      ctx.moveTo(fe.x - 1.2, -3.1); ctx.lineTo(fe.x + 1.6, -4.2);
    } else if (face === 'stare') {
      ctx.moveTo(ne.x - 1.8, -4.4); ctx.lineTo(ne.x + 1.4, -4.6);
      ctx.moveTo(fe.x - 1.2, -4.6); ctx.lineTo(fe.x + 1.5, -4.4);
    } else {
      // one brow slightly raised: the smug look
      ctx.moveTo(ne.x - 1.9, -3.7); ctx.quadraticCurveTo(ne.x, -4.4, ne.x + 1.5, -3.8);
      ctx.moveTo(fe.x - 1.2, -4.3); ctx.quadraticCurveTo(fe.x, -5, fe.x + 1.5, -4.2);
    }
    ctx.stroke();
    // eyes
    const eye = (c, rx, ry) => {
      if (face === 'calm') {
        ctx.beginPath(); ctx.moveTo(c.x - rx, c.y); ctx.quadraticCurveTo(c.x, c.y + ry * 0.9, c.x + rx, c.y);
        ctx.strokeStyle = line; ctx.lineWidth = 0.8; ctx.stroke();
        return;
      }
      if (face === 'dazed') {
        ctx.strokeStyle = line; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(c.x - rx * 0.8, c.y - ry * 0.8); ctx.lineTo(c.x + rx * 0.8, c.y + ry * 0.8);
        ctx.moveTo(c.x + rx * 0.8, c.y - ry * 0.8); ctx.lineTo(c.x - rx * 0.8, c.y + ry * 0.8); ctx.stroke();
        return;
      }
      // almond-shaped: narrow and intense
      const open = face === 'stare' ? 1.2 : angry ? 0.7 : face === 'grin' ? 0.8 : 1;
      const almond = () => {
        ctx.beginPath();
        ctx.moveTo(c.x - rx, c.y + 0.1);
        ctx.quadraticCurveTo(c.x, c.y - ry * 1.3 * open, c.x + rx, c.y - ry * 0.2);
        ctx.quadraticCurveTo(c.x, c.y + ry * 0.95 * open, c.x - rx, c.y + 0.1);
        ctx.closePath();
      };
      ctx.save();
      almond();
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.clip();
      ctx.beginPath(); ctx.arc(c.x + rx * 0.22, c.y - ry * 0.12, ry * 0.86, 0, TAU);
      ctx.fillStyle = heat > 0.15 ? '#ff3a1a' : '#3d78cf'; ctx.fill();
      ctx.beginPath(); ctx.arc(c.x + rx * 0.26, c.y - ry * 0.12, ry * 0.4, 0, TAU);
      ctx.fillStyle = heat > 0.15 ? '#fff1d6' : '#0d1424'; ctx.fill();
      ctx.restore();
      // upper lid
      ctx.beginPath(); ctx.moveTo(c.x - rx - 0.2, c.y + 0.1); ctx.quadraticCurveTo(c.x, c.y - ry * 1.3 * open, c.x + rx + 0.25, c.y - ry * 0.25);
      ctx.lineWidth = 0.8; ctx.strokeStyle = line; ctx.stroke();
    };
    eye(ne, 1.65, 1.0);
    eye(fe, 1.2, 0.88);
    // nose
    ctx.strokeStyle = 'rgba(122,74,52,0.85)'; ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.moveTo(f + 1, -2); ctx.quadraticCurveTo(f + 1.5, 0.6, f + 2.5, 2.2); ctx.quadraticCurveTo(f + 2, 3.1, f + 0.8, 2.9); ctx.stroke();
    // mouth
    ctx.lineWidth = 0.85; ctx.strokeStyle = line;
    const mx = f + 0.8, my = 5.5;
    ctx.beginPath();
    if (face === 'grin') {
      ctx.moveTo(mx - 2.6, my - 0.6); ctx.quadraticCurveTo(mx + 0.4, my - 0.2, mx + 3.4, my - 1.2);
      ctx.quadraticCurveTo(mx + 0.8, my + 2.6, mx - 2.6, my - 0.6);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    } else if (angry) {
      ctx.moveTo(mx - 2.3, my + 0.3); ctx.lineTo(mx + 2.9, my); ctx.lineTo(mx + 2.6, my + 1.2); ctx.lineTo(mx - 2, my + 1.4); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    } else if (face === 'dazed') {
      ctx.moveTo(mx - 2, my + 0.4); ctx.quadraticCurveTo(mx - 0.8, my - 0.6, mx + 0.4, my + 0.4); ctx.quadraticCurveTo(mx + 1.6, my + 1.4, mx + 2.8, my + 0.2); ctx.stroke();
    } else if (face === 'stare') {
      ctx.moveTo(mx - 2.8, my - 0.2); ctx.quadraticCurveTo(mx + 0.4, my + 1.1, mx + 3.6, my - 0.8); ctx.stroke();
    } else {
      // the smug, lopsided smile
      ctx.moveTo(mx - 2.2, my + 0.2); ctx.quadraticCurveTo(mx + 0.6, my + 1.2, mx + 3.2, my - 1.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx + 3.2, my - 1.1); ctx.lineTo(mx + 3.6, my - 0.6); ctx.stroke();
    }
    // chin cleft
    ctx.strokeStyle = 'rgba(122,74,52,0.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(f + 1.4, 8.2); ctx.lineTo(f + 1.5, 9.2); ctx.stroke();
    // heat vision: the eyes burn red
    if (heat > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      I.glow(ctx, ne.x + 0.4, ne.y, 3.6 + 3 * heat, '255,50,20', heat);
      I.glow(ctx, fe.x + 0.4, fe.y, 3 + 2.6 * heat, '255,50,20', heat);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ the whole hero
  function drawHero(ctx, R, opts) {
    opts = opts || {};
    const L = lookOf(opts.look || opts.suit);
    const T = opts.T || 0;
    const h = opts.h || null;
    const heat = R.heat != null ? R.heat : h && h.heat ? h.heat : 0;
    if (h && h.face) R = Object.assign({}, R, { face: h.face });
    ctx.save();
    ctx.translate(R.ox, R.oy);
    if (R.rot) { ctx.translate(R.hip.x, R.hip.y); ctx.rotate(R.rot); ctx.translate(-R.hip.x, -R.hip.y); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawCape(ctx, R, L, T, h);
    drawLeg(ctx, R.legs[1], L, true);
    if (!R.crossed) drawArm(ctx, R.arms[1], L, true);
    drawTorso(ctx, R, L);
    drawLeg(ctx, R.legs[0], L, false);
    if (R.crossed) drawArm(ctx, R.arms[1], L, true);
    drawHead(ctx, R, L, T, heat);
    drawArm(ctx, R.arms[0], L, false);
    ctx.restore();
  }

  // world-local points for effects (after ox/oy/rot), in hero-local units
  function points(R) {
    const tr = (p) => {
      let q = { x: p.x, y: p.y };
      if (R.rot) q = add(R.hip, rot(sub(q, R.hip), R.rot));
      return { x: q.x + R.ox, y: q.y + R.oy };
    };
    const f = 1.5 + 2.6 * (R.turn - 0.35) / 0.65;
    const a = R.lean + R.headTilt;
    const eyes = tr(add(R.head, rot(P(f + 0.6, -1.4), a)));
    const palms = R.arms.map((A) => tr(P(A.hand.x + cos(A.ang) * 4, A.hand.y + sin(A.ang) * 4)));
    return { eyes, palms, head: tr(R.head), reactor: tr(R.chest), hand: palms[0], hip: tr(R.hip) };
  }

  // ------------------------------------------------------------------ menus, home, icons
  function drawBust(ctx, look, T) {
    const R = makeRig('cross', { t: 0, T, phase: 0, m: {} });
    R.turn = 0.62;
    R.face = 'smug';
    drawHero(ctx, R, { look, T });
  }

  // fills a 46×46 circle (origin top-left)
  function drawAvatar(ctx, look, T) {
    ctx.save();
    ctx.translate(18, 146);
    ctx.scale(1.45, 1.45);
    drawBust(ctx, look, T);
    ctx.restore();
  }

  // home header: origin at his feet
  function drawPortrait(ctx, state, T, look) {
    const h = state.hero || {};
    const cyc = (T / 5) % 3;
    const name = h.mode === 'down' ? 'down' : cyc < 1 ? 'cross' : cyc < 2 ? 'stand' : 'wave';
    const R = makeRig(name, { t: T % 5, T, phase: 0, m: {} });
    R.turn = max(R.turn, 0.55);
    ctx.scale(0.86, 0.86);
    drawHero(ctx, R, { look, T, h: { vx: 40 * sin(T * 0.7), vy: 0, facing: 1, mode: 'ground' } });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // the app icon: navy & gold, the flag cape behind him, eyes burning red
  function drawIcon(ctx, size) {
    const k = size / 1024;
    ctx.save();
    ctx.scale(k, k);
    roundRect(ctx, 40, 40, 944, 944, 220);
    const g = ctx.createLinearGradient(0, 40, 0, 984);
    g.addColorStop(0, '#22397e'); g.addColorStop(1, '#0a1230');
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    ctx.clip();
    // a sweep of stripes behind him
    ctx.save();
    ctx.translate(512, 980); ctx.rotate(-0.35);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? 'rgba(245,243,238,0.16)' : 'rgba(193,35,47,0.32)'; ctx.fillRect(-900, -60 * i - 60, 1800, 60); }
    ctx.restore();
    const R = makeRig('cross', { t: 0, T: 0.3, phase: 0, m: {} });
    R.turn = 0.72; R.face = 'smug'; R.heat = 1;
    ctx.translate(500, 1630);
    ctx.scale(14.2, 14.2);
    drawHero(ctx, R, { look: 'classic', T: 0.3, h: { vx: -260, vy: 0, facing: 1, mode: 'air' } });
    ctx.restore();
    roundRect(ctx, 40, 40, 944, 944, 220);
    ctx.lineWidth = 18; ctx.strokeStyle = '#d4af37'; ctx.stroke();
    ctx.restore();
  }

  // tray: just his face, eyes glowing (reads even at 16 px)
  function drawTray(ctx, size) {
    const k = size / 64;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(31, 33);
    ctx.scale(2.65, 2.65);
    const R = { head: P(0, 0), lean: 0, headTilt: -0.05, turn: 0.82, face: 'smug' };
    drawHead(ctx, R, LOOKS.classic, 0, 1);
    ctx.restore();
  }

  // ------------------------------------------------------------------ callouts & the hover card (Vought style)
  function callout(ctx, text, x, y, a, tone) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 16;
    roundRect(ctx, x - w / 2, y - 7.5, w, 15, 7.5);
    ctx.fillStyle = tone === 'warn' ? 'rgba(130,16,28,0.92)' : 'rgba(12,24,60,0.9)';
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#d4af37'; ctx.stroke();
    ctx.fillStyle = '#d4af37';
    star(ctx, x - w / 2 + 6.5, y + 0.2, 2.4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + 3, y + 0.5);
    ctx.restore();
  }

  function card(ctx, h, x, bottom) {
    const meters = h.meters || [];
    const w = 126, hh = 22 + meters.length * 10;
    ctx.save();
    ctx.translate(x - w / 2, bottom - hh);
    roundRect(ctx, 0, 0, w, hh, 4);
    ctx.fillStyle = 'rgba(10,22,56,0.9)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#d4af37'; ctx.stroke();
    ctx.fillStyle = '#b22234'; ctx.fillRect(4, 2, w - 8, 1.2);
    ctx.font = '700 8px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8c75a';
    ctx.fillText(('HOMELANDER · ' + h.status).slice(0, 32), 6, 10);
    meters.forEach((m, i) => {
      const y = 21 + i * 10;
      ctx.fillStyle = 'rgba(232,215,160,0.85)'; ctx.fillText(m.short || m.label, 6, y);
      ctx.fillStyle = 'rgba(212,175,55,0.15)'; ctx.fillRect(30, y - 2.5, w - 38, 5);
      ctx.fillStyle = m.v < 20 ? '#ff4d5e' : m.color; ctx.fillRect(30, y - 2.5, (w - 38) * clamp(m.v / 100, 0, 1), 5);
    });
    ctx.restore();
  }

  // a faint streak of air while he cruises fast; smoke when he's been blasted
  function trail(h, rig, toG, spawn, S, now, R) {
    if (now - R.trailAt < 45) return;
    if (h.mode === 'thrown' && h.speed > 160 * S) {
      R.trailAt = now;
      const p = toG(rig.hip);
      spawn({ kind: 'smoke', x: p.x, y: p.y, n: 1, small: true, life: 0.6 });
    } else if (h.mode === 'air' && h.speed > 420 * S) {
      R.trailAt = now;
      const p = toG(rig.legs[0].foot);
      spawn({ kind: 'thrust', x: p.x - h.vx * 0.03, y: p.y - h.vy * 0.03, n: 1, small: true, color: '230,240,255', life: 0.5 });
    }
  }

  // the second eye's beam, a hair apart from the first (the scene draws the first)
  function drawWorld(ctx, s, h, pts, T) {
    if (!pts || !s.beams) return;
    const S = (s.s || 1) * (h.body || 1);
    for (const b of s.beams) {
      if (b.owner !== h.id || b.from !== 'eyes') continue;
      const age = (Date.now() - b.start) / 1000;
      const life = clamp(1 - age / b.dur, 0, 1);
      const ox = h.facing * 3.6 * S, oy = -0.3 * S;
      ctx.save();
      ctx.globalAlpha = Math.min(1, life * 4, age * 8) * 0.85;
      I.drawBeam(ctx, pts.eyes.x + ox, pts.eyes.y + oy, b.x2 + ox * 0.3, b.y2 + oy, b.w * S * 0.75, age, '255,45,20', 'rgba(255,230,200,0.95)');
      ctx.restore();
    }
  }

  function beamColors(b) {
    if (b.kind === 'heat' || b.kind === 'sweep') return { halo: '255,45,20', core: 'rgba(255,236,210,0.97)' };
    return null;
  }

  function expandFx(e, S, spawn) {
    switch (e.kind) {
      case 'heatHit':
        spawn({ kind: 'spark', x: e.x, y: e.y, n: e.burn ? 3 : 6, speed: 150 * S, size: S, life: 0.35 });
        spawn({ kind: 'ember', x: e.x, y: e.y, n: e.burn ? 2 : 3, speed: 90 * S, size: 0.9, life: 0.7, rise: 30 });
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 0.55 * S, life: 0.2, color: '255,80,30' });
        if (e.burn) spawn({ kind: 'smoke', x: e.x, y: e.y - 4 * S, n: 1, small: true, life: 0.9, rise: 40 });
        return true;
      case 'clap':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 1.2 * S, life: 0.25, color: '235,245,255' });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 2.4 * S, life: 0.55, color: '220,235,255', stagger: 0.07 });
        spawn({ kind: 'dust', x: e.x, y: e.y + 30 * S, n: 8, spread: 40 * S, size: S, life: 0.6 });
        return true;
      case 'fans':
        spawn({ kind: 'heart', x: e.x, y: e.y, n: 5, spread: 30 * S, speed: 40 * S, rise: 35 * S, size: S, life: 1.3 });
        spawn({ kind: 'sparkle', x: e.x, y: e.y, n: 6, spread: 40 * S, speed: 60 * S, size: S, life: 0.8, color: '#ffd84d' });
        return true;
      case 'camera':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 1.4 * S, life: 0.18, color: '255,255,255' });
        spawn({ kind: 'sparkle', x: e.x, y: e.y, n: 3, spread: 20 * S, speed: 40 * S, size: S, life: 0.5, color: '#ffffff' });
        return true;
      case 'dazed':
        spawn({ kind: 'star', x: e.x, y: e.y, n: 2, spread: 10 * S, speed: 30 * S, rise: 20 * S, size: S, life: 0.8 });
        return true;
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------ sounds
  const sounds = {
    heatZap(L) { L.blip('sawtooth', 2600, 900, 0.16, 0.05); L.hiss('highpass', 3600, 0.7, 0.18, 0.16); L.blip('sine', 640, 180, 0.14, 0.07); },
    heatCharge(L) { L.blip('sawtooth', 110, 620, 0.42, 0.05); L.blip('sine', 900, 1900, 0.42, 0.04); },
    heatBeam(L) {
      const c = L.ctx(); if (!c) return;
      const t = c.currentTime + 0.01, dur = 1.3;
      const out = L.gain(0);
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.22, t + 0.06);
      out.gain.setValueAtTime(0.22, t + dur - 0.2); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f = L.filt('bandpass', 1400, 2);
      f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2200, t + dur);
      for (const fr of [150, 223, 301]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
      const n = L.noise(); const ng = L.gain(0.6); const hp = L.filt('highpass', 2500, 0.7); n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t); n.stop(t + dur + 0.05);
      f.connect(out); out.connect(L.out());
    },
    punchBig(L) { L.blip('sine', 170, 38, 0.32, 0.6); L.hiss('lowpass', 900, 0.8, 0.2, 0.5); L.hiss('highpass', 2600, 0.7, 0.06, 0.25); },
    clap(L) { L.hiss('highpass', 1800, 0.6, 0.09, 0.65); L.blip('sine', 130, 34, 0.5, 0.55); L.hiss('lowpass', 520, 0.7, 0.6, 0.35, 0.03); },
    cameraClick(L) { L.hiss('highpass', 4200, 0.7, 0.03, 0.22); L.blip('square', 1900, 1300, 0.03, 0.035, 0.05); },
    crowdCheer(L) {
      const c = L.ctx(); if (!c) return;
      const t = c.currentTime + 0.01, dur = 1.8;
      const n = L.noise(); const bp = L.filt('bandpass', 1300, 0.6); const g = L.gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g); g.connect(L.out()); n.start(t); n.stop(t + dur + 0.05);
      for (let i = 0; i < 10; i++) L.hiss('bandpass', 2500 + Math.random() * 1500, 2, 0.03, 0.08, 0.1 + Math.random() * 1.2);
    },
    voughtSting(L) {
      // a short, bright brass fanfare
      const c = L.ctx(); if (!c) return;
      const t = c.currentTime + 0.01;
      const out = L.gain(0.0001); const lp = L.filt('lowpass', 2200, 0.8);
      lp.connect(out); out.connect(L.out());
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.16, t + 0.04);
      out.gain.setValueAtTime(0.16, t + 0.18); out.gain.linearRampToValueAtTime(0.12, t + 0.22); out.gain.setValueAtTime(0.14, t + 0.24);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      for (const [f0, f1] of [[392, 523], [494, 659], [587, 784]]) {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f0, t); o.frequency.setValueAtTime(f1, t + 0.22);
        o.connect(lp); o.start(t); o.stop(t + 1.05);
      }
    },
  };

  // ------------------------------------------------------------------ register
  root.HeroArts = root.HeroArts || {};
  root.HeroArts.homelander = {
    name: 'HOMELANDER', theme: 'vought', looks: LOOKS, lookKey: 'homelanderLook', body: 1.05,
    POSES, makeRig, lerpRig, drawHero, points, drawBust, drawAvatar, drawPortrait, drawIcon, drawTray,
    cardTitle: () => 'HOMELANDER',
    callout, calloutHeight: 17, card, trail, drawWorld, beamColors, expandFx,
    loop: null,
    allyLabel: null,
    avatarBg: 'rgba(212,175,55,0.2)',
    shadowTint: 'rgba(212,175,55,0.2)',
    sounds,
    voice: { prefer: /guy|david|mark|christopher|eric|daniel|alex|aaron|male/i, pitch: 0.92, rate: 0.97 },
    brief: { done: 'Yes, Homelander', snooze: (m) => `Snooze ${m}`, time: (a) => `${a.time} · VOUGHT INTERNATIONAL`, sound: 'voughtSting' },
    menuName: (s) => `${Math.round(s.hero.approval || 0)}% approval · ${s.hero.status}`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
