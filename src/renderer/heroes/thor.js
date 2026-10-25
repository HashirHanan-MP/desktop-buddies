/*
 * Desktop Buddies — Thor art: a procedural, fan-made drawing (for personal
 * use; the character belongs to his creators).
 *
 * Built on the armored hero's skeleton (IronArt.rig: the same joints, bone
 * lengths and 2-bone IK), bulked up: dark Asgardian armor with the six silver
 * discs, a long red cape that streams in flight, long or short blond hair that
 * moves with him, a beard, and lightning in his eyes. Four looks — Classic
 * (Mjolnir), Ragnarok (no hammer, bare arms), Infinity War (Stormbreaker) and
 * Love & Thunder (blue and gold). Also the weapons (in his hand, whirling, or
 * flying on their own), jagged lightning bolts and chains, the Bifrost, his
 * callouts, hover card, effects, sounds and icons.
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
  const SKIN = ['#ffe0c8', '#efbf9b', '#c08463'];
  const LOOKS = {
    classic: {
      label: 'Classic — Mjolnir', weapon: 'hammer', hair: 'long', beard: 0.55,
      armor: ['#69728a', '#3a4152', '#1a1e28'], line: '#0b0d13', plate: ['#8d97ab', '#596277', '#2b3140'],
      disc: ['#ffffff', '#c3cad6', '#6c7584'], discLine: '#2b3038',
      sleeve: ['#4a4f5e', '#2c303b', '#14161c'], bareArms: false, bracer: ['#e7ebf1', '#a3abb7', '#56606e'],
      legs: ['#3a3e4a', '#22252e', '#0f1116'], boot: ['#4a4033', '#2c251d', '#140f0b'],
      cape: ['#e2353f', '#b21e28', '#5e0c12'], capeLine: '#3d070b',
      hairCol: ['#fff0b5', '#e5bf5a', '#a07a24'], eyes: ['#4f8fe6', '#1b3c70'], texture: 'rgba(200,215,240,0.14)',
    },
    ragnarok: {
      label: 'Ragnarok — Lord of Thunder', weapon: 'none', hair: 'short', beard: 0.6,
      armor: ['#5a6c90', '#33405c', '#161d2e'], line: '#0a0d16', plate: ['#d7dde6', '#959fae', '#4e5765'],
      disc: ['#ffffff', '#cdd3dd', '#7a8494'], discLine: '#2b3038',
      sleeve: null, bareArms: true, bracer: ['#e9edf3', '#9aa3b0', '#4f5866'],
      legs: ['#2f3848', '#1b212c', '#0b0e13'], boot: ['#3a3f4a', '#22262e', '#0e1014'],
      cape: ['#e33b44', '#b4202a', '#600d13'], capeLine: '#3d070b',
      hairCol: ['#fbe9a8', '#dcb24c', '#94701f'], eyes: ['#5aa2ff', '#1c3f7a'], texture: 'rgba(150,190,255,0.16)', lightningEyes: true,
    },
    stormbreaker: {
      label: 'Infinity War — Stormbreaker', weapon: 'axe', hair: 'short', beard: 1,
      armor: ['#4c5468', '#272d3c', '#0f121a'], line: '#06070b', plate: ['#6d7486', '#3f4555', '#1c2029'],
      disc: ['#eef1f5', '#a3abb8', '#545c69'], discLine: '#22262d',
      sleeve: ['#3a3f4c', '#22252e', '#0e1014'], bareArms: false, bracer: ['#c9cfd8', '#858d9a', '#40464f'],
      legs: ['#2b2f39', '#191c23', '#0a0b0e'], boot: ['#3c3329', '#231d16', '#0f0c09'],
      cape: ['#c7303a', '#951923', '#4e0a0f'], capeLine: '#30060a',
      hairCol: ['#f3d98e', '#c99d3e', '#86621a'], eyes: ['#4f8fe6', '#1b3c70'], farEye: ['#8a5a2c', '#3e2510'], texture: 'rgba(180,195,225,0.12)',
    },
    thunder: {
      label: 'Love & Thunder', weapon: 'axe', hair: 'long', beard: 0.5,
      armor: ['#5d89e6', '#2d52a6', '#142a5e'], line: '#08122e', plate: ['#ffeeb5', '#e3b448', '#8f6513'],
      disc: ['#fff6d2', '#efc760', '#996c14'], discLine: '#4a3206',
      sleeve: null, bareArms: true, bracer: ['#fff0bd', '#e2b246', '#8d6413'],
      legs: ['#2a3f78', '#182752', '#0a1129'], boot: ['#2c4486', '#192a5a', '#0a1430'],
      cape: ['#e3354a', '#b31d33', '#5e0a18'], capeLine: '#3d0610',
      hairCol: ['#fff0b5', '#e5bf5a', '#a07a24'], eyes: ['#4f8fe6', '#1b3c70'], texture: 'rgba(255,230,160,0.16)', gold: true,
    },
  };
  const lookOf = (k) => LOOKS[k] || LOOKS.classic;

  // ------------------------------------------------------------------ poses
  // c = { t, T, phase, aim:{x,y}|null (unit dir, local), m:{ air, lean, climb, swing, h } }
  function base(T) {
    const p = RG.base(T);
    p.face = null; p.cape = 0; p.cup = 0; p.weaponDown = false; p.spinAt = null;
    for (const a of p.arms) a.open = 0;
    return p;
  }
  const SH = P(-10.5, -73.5); // near shoulder at rest
  function hoverLegs(p, bob) {
    p.hip.y = -46 + bob;
    p.legs[0].foot = P(-3, -4 + bob); p.legs[1].foot = P(4, -2 + bob);
    p.legs[0].footAng = 0.7; p.legs[1].footAng = 0.6;
    return p;
  }
  function stance(p, w) { p.legs[0].foot = P(-(w || 9), -4); p.legs[1].foot = P(w || 9, -4); return p; }
  // the weapon hangs from the near hand, head down
  function hang(p) { p.arms[0].hand = P(-12.5, -47); p.arms[0].bend = 1; p.arms[0].handAng = PI / 2 + 0.08; return p; }
  function farRelaxed(p) { p.arms[1].hand = P(12.5, -49); p.arms[1].bend = -1; return p; }
  function headAim(p, c, k) {
    const a = c.aim;
    if (!a) return p;
    p.headTilt = clamp(atan2(a.y, max(0.25, a.x)) * (k || 0.7), -0.7, 0.7);
    return p;
  }
  function aimArm(p, c, i, open) {
    const a = c.aim || P(1, -0.1);
    const sh = i === 0 ? SH : P(10, -74.5);
    p.arms[i].hand = add(sh, mul(a, 31));
    p.arms[i].handAng = atan2(a.y, a.x);
    p.arms[i].bend = -1;
    p.arms[i].open = open ? 1 : 0;
    return p;
  }

  const POSES = {};

  POSES.stand = (c) => {
    const p = farRelaxed(hang(stance(base(c.T))));
    p.headTilt = -0.05 + 0.03 * sin(c.T * 0.4);
    p.turn = 0.45;
    return p;
  };

  POSES.idleLook = (c) => {
    const p = POSES.stand(c);
    p.headTilt = -0.08 + 0.08 * sin(c.t * 1.3);
    p.turn = 0.35 + 0.3 * sin(c.t * 0.8);
    return p;
  };

  POSES.walk = (c) => {
    const p = base(c.T);
    const ph = c.phase, s = sin(ph), k = cos(ph);
    p.hip.y = -44 - abs(k) * 1.4;
    p.lean = 0.04;
    p.legs[0].foot = P(-1 + 10 * s, -4 - 5 * max(0, -k));
    p.legs[1].foot = P(1 - 10 * s, -4 - 5 * max(0, k));
    p.legs[0].footAng = -0.25 * max(0, -k);
    p.legs[1].footAng = -0.25 * max(0, k);
    p.arms[0].hand = P(-11 - 6 * s, -47); p.arms[0].handAng = PI / 2 + 0.25 * s;
    p.arms[1].hand = P(11 + 7 * s, -48 + 1.5 * abs(s));
    p.headTilt = -0.06;
    return p;
  };

  POSES.crouch = (c) => {
    const p = stance(base(c.T), 10);
    p.hip.y = -33;
    p.lean = 0.28;
    p.arms[0].hand = P(-15, -36); p.arms[0].handAng = PI / 2;
    p.arms[1].hand = P(14, -39);
    p.headTilt = -0.2;
    return p;
  };

  POSES.hover = (c) => {
    // floating, the weapon at his side, the cape doing the rest
    const bob = 1.5 * sin(c.T * 2.1);
    const p = hoverLegs(farRelaxed(hang(base(c.T))), bob);
    p.arms[0].hand.y += bob; p.arms[1].hand.y += bob;
    p.lean = (c.m.lean || 0) * 0.25;
    p.headTilt = -0.1;
    p.turn = 0.5;
    p.shadow = 1;
    return p;
  };

  POSES.flyUp = (c) => {
    // the weapon pulls him straight up
    const p = hoverLegs(base(c.T), 0.8 * sin(c.T * 3));
    p.legs[0].foot = P(-1.5, -2); p.legs[1].foot = P(2, -1);
    p.legs[0].footAng = p.legs[1].footAng = 1.1;
    p.arms[0].hand = P(3, -106); p.arms[0].bend = -1; p.arms[0].handAng = -PI / 2;
    p.arms[1].hand = P(10, -50);
    p.headTilt = -0.35;
    p.cape = 0.4;
    return p;
  };

  POSES.fly = (c) => {
    // weapon first, body flat behind it
    const p = base(c.T);
    p.hip.y = -44;
    p.legs[0].foot = P(-1.2, -2.5); p.legs[1].foot = P(1.8, -3.5);
    p.legs[0].footAng = p.legs[1].footAng = 1.35;
    p.arms[0].hand = P(3, -106); p.arms[0].bend = -1; p.arms[0].handAng = -PI / 2;
    p.arms[1].hand = P(8, -49);
    p.headTilt = -0.7;
    p.rot = 1.2 - (c.m.climb || 0) * 0.45;
    p.oy = -10;
    p.shadow = 0;
    return p;
  };

  POSES.dive = (c) => {
    const p = POSES.fly(c);
    p.rot = 2.5;
    p.headTilt = -0.5;
    p.face = 'roar';
    return p;
  };

  POSES.land = (c) => {
    // one knee down, the weapon on the floor
    const p = base(c.T);
    p.hip = P(-2, -21);
    p.lean = 0.5;
    p.legs[0].foot = P(-17, -2); p.legs[0].knee = P(-6, -4); p.legs[0].footAng = 1.2;
    p.legs[1].foot = P(13, -4); p.legs[1].knee = P(14, -24);
    p.arms[0].hand = P(12, -22); p.arms[0].elbow = P(5, -36); p.arms[0].handAng = PI / 2;
    p.arms[1].hand = P(-22, -30); p.arms[1].open = 1; p.arms[1].handAng = PI * 0.9;
    p.headTilt = 0.25;
    p.cape = 0.25;
    return p;
  };

  POSES.slam = (c) => { const p = POSES.land(c); p.face = 'roar'; p.headTilt = -0.1; p.cape = 0.6; return p; };

  POSES.whirl = (c) => {
    // the weapon whirls at arm's length
    const p = stance(base(c.T), 10);
    p.hip.y = -42;
    p.arms[0].hand = P(20, -76); p.arms[0].bend = -1; p.arms[0].handAng = 0;
    p.arms[1].hand = P(12, -50);
    p.spinAt = 1;
    p.headTilt = -0.15;
    p.cape = 0.3;
    return p;
  };

  POSES.twirl = (c) => {
    // spinning it lazily by the strap at his side
    const p = farRelaxed(stance(base(c.T)));
    p.arms[0].hand = P(-13, -50); p.arms[0].bend = 1; p.arms[0].handAng = PI / 2;
    p.spinAt = 0.6;
    p.headTilt = -0.12 + 0.05 * sin(c.t * 0.9);
    p.turn = 0.4;
    return p;
  };

  function arcPose(c, air) {
    const p = air ? hoverLegs(base(c.T), 1.2 * sin(c.T * 2.1)) : stance(base(c.T), 10);
    if (!air) p.hip.y += 1.5;
    aimArm(p, c, 0, false);
    p.arms[1].hand = P(11, -54); p.arms[1].bend = -1;
    p.lean = 0.08;
    headAim(p, c, 0.7);
    p.face = 'angry';
    return p;
  }
  POSES.arc = (c) => arcPose(c, false);
  POSES.arcAir = (c) => arcPose(c, true);

  function blastPose(c, air) {
    // Ragnarok: both hands thrust forward, lightning pouring out
    const p = air ? hoverLegs(base(c.T), 0) : stance(base(c.T), 11);
    aimArm(p, c, 0, true);
    aimArm(p, c, 1, true);
    p.arms[1].hand = add(p.arms[1].hand, P(-2, 2));
    p.lean = 0.15;
    headAim(p, c, 0.6);
    p.face = 'roar';
    p.cape = 0.5;
    return p;
  }
  POSES.blast = (c) => blastPose(c, false);
  POSES.blastAir = (c) => blastPose(c, true);

  function raisePose(c, air) {
    // the weapon (or fist) raised to the sky
    const p = air ? hoverLegs(base(c.T), 1.2 * sin(c.T * 2.1)) : stance(base(c.T), 10);
    p.arms[0].hand = P(2, -109); p.arms[0].bend = -1; p.arms[0].handAng = -PI / 2 - 0.08;
    p.arms[1].hand = P(13, -58); p.arms[1].bend = -1;
    p.headTilt = -0.3;
    p.face = 'roar';
    p.cape = 0.35;
    return p;
  }
  POSES.raise = (c) => raisePose(c, false);
  POSES.raiseAir = (c) => raisePose(c, true);

  POSES.throwWind = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : stance(base(c.T), 11);
    p.arms[0].hand = P(-15, -97); p.arms[0].bend = -1; p.arms[0].handAng = -PI * 0.85;
    p.arms[1].hand = P(16, -66); p.arms[1].open = 1; p.arms[1].handAng = 0;
    p.lean = -0.16;
    headAim(p, c, 0.5);
    p.face = 'angry';
    return p;
  };

  POSES.throw = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : stance(base(c.T), 11);
    const k = clamp(c.t / 0.12, 0, 1);
    p.arms[0].hand = lp(P(-15, -97), P(27, -76), smooth(k)); p.arms[0].bend = -1;
    p.arms[0].open = k; p.arms[0].handAng = lerp(-PI * 0.85, 0.1, k);
    p.arms[1].hand = P(-6, -56);
    p.lean = lerp(-0.16, 0.26, k);
    p.face = 'roar';
    p.cape = 0.5 * k;
    return p;
  };

  POSES.reach = (c) => {
    // hand out, waiting for it to come back
    const p = c.m.air ? hoverLegs(base(c.T), 1.2 * sin(c.T * 2.1)) : stance(base(c.T), 10);
    aimArm(p, c, 0, true);
    p.arms[1].hand = P(12, -52);
    headAim(p, c, 0.6);
    p.face = 'angry';
    return p;
  };

  POSES.smash = (c) => {
    // overhead and down
    const p = c.m.air ? hoverLegs(base(c.T), 0) : stance(base(c.T), 11);
    const k = clamp(c.t / 0.16, 0, 1);
    p.arms[0].hand = lp(P(-4, -106), P(27, -60), smooth(k)); p.arms[0].bend = -1;
    p.arms[0].handAng = lerp(-PI / 2 - 0.4, 0.7, smooth(k));
    p.arms[1].hand = P(-5, -58);
    p.lean = lerp(-0.12, 0.3, k);
    p.face = 'roar';
    p.cape = 0.4 * k;
    return p;
  };

  POSES.god = (c) => {
    // floating, arms flung wide, lightning everywhere
    const bob = 1.2 * sin(c.T * 2);
    const p = hoverLegs(base(c.T), bob);
    p.arms[0].hand = P(-24, -100 + bob); p.arms[0].bend = -1; p.arms[0].handAng = -PI * 0.7;
    p.arms[1].hand = P(25, -99 + bob); p.arms[1].bend = 1; p.arms[1].open = 1; p.arms[1].handAng = -PI * 0.3;
    p.headTilt = -0.35;
    p.face = 'roar';
    p.cape = 0.7;
    return p;
  };

  POSES.toss = (c) => {
    const p = farRelaxed(stance(base(c.T)));
    p.arms[0].hand = P(3, -80); p.arms[0].bend = -1; p.arms[0].handAng = -PI / 2;
    p.headTilt = -0.1;
    p.face = 'grin';
    return p;
  };
  POSES.tossWait = (c) => {
    const p = farRelaxed(stance(base(c.T)));
    p.arms[0].hand = P(3, -86); p.arms[0].bend = -1; p.arms[0].open = 1; p.arms[0].handAng = -PI / 2;
    p.headTilt = -0.05;
    p.turn = 0.75;
    p.face = 'grin';
    return p;
  };

  POSES.drink = (c) => {
    const p = hang(stance(base(c.T)));
    const k = clamp(c.t / 0.4, 0, 1);
    p.arms[1].hand = lp(P(12, -50), P(6, -83), smooth(k)); p.arms[1].bend = -1; p.arms[1].handAng = -PI / 2 - 0.5 * k;
    p.cup = 1;
    p.headTilt = -0.25 * k;
    p.face = 'calm';
    return p;
  };
  POSES.smashCup = (c) => {
    const p = hang(stance(base(c.T)));
    const k = clamp(c.t / 0.2, 0, 1);
    p.arms[1].hand = lp(P(8, -86), P(20, -50), smooth(k)); p.arms[1].bend = -1; p.arms[1].open = k > 0.9 ? 1 : 0;
    p.cup = k < 0.95 ? 1 : 0;
    p.lean = 0.12 * k;
    p.face = 'roar';
    return p;
  };

  POSES.wave = (c) => {
    const p = hang(stance(base(c.T)));
    p.arms[1].hand = P(9 + 4 * sin(c.t * 9), -103); p.arms[1].bend = -1;
    p.arms[1].open = 1; p.arms[1].handAng = -PI / 2 + 0.35 * sin(c.t * 9);
    p.turn = 0.62;
    p.face = 'grin';
    if (c.m.air) hoverLegs(p, 0);
    return p;
  };
  POSES.thumbsUp = POSES.wave;

  POSES.point = (c) => {
    const p = hang(stance(base(c.T)));
    p.arms[1].hand = P(27, -78); p.arms[1].bend = -1; p.arms[1].open = 1; p.arms[1].handAng = 0;
    p.turn = 0.7;
    p.face = 'grin';
    return p;
  };

  POSES.present = (c) => {
    const p = hang(base(c.T));
    const k = clamp(c.t / 0.4, 0, 1);
    p.arms[1].hand = lp(P(12, -50), P(20, -62), smooth(k)); p.arms[1].bend = -1;
    p.arms[1].open = k; p.arms[1].handAng = lerp(0, 0.35, k);
    p.turn = 0.72;
    p.face = 'grin';
    if (c.m.air) hoverLegs(p, 1.2 * sin(c.T * 2.1)); else stance(p);
    return p;
  };
  POSES.salute = POSES.present;

  POSES.rest = (c) => {
    // arms crossed, eyes shut, the weapon standing on the floor beside him
    const p = stance(base(c.T), 7.5);
    p.arms[0].hand = P(7.5, -61); p.arms[0].bend = 1;
    p.arms[1].hand = P(-6, -63.5); p.arms[1].bend = -1;
    p.crossed = true;
    p.weaponDown = true;
    p.headTilt = 0.15 + 0.03 * sin(c.T * 0.7);
    p.face = 'calm';
    return p;
  };

  POSES.brace = (c) => {
    const p = stance(base(c.T), 12);
    p.hip.y = -42;
    p.lean = 0.24;
    p.arms[0].hand = P(18, -88); p.arms[0].bend = -1; p.arms[0].handAng = -1.1;
    p.arms[1].hand = P(14, -60);
    p.headTilt = 0.1;
    p.face = 'angry';
    p.cape = 1;
    if (c.m.air) hoverLegs(p, 0);
    return p;
  };

  POSES.stagger = (c) => {
    const p = c.m.air ? hoverLegs(base(c.T), 0) : base(c.T);
    p.lean = -0.3;
    p.arms[0].hand = P(4, -74); p.arms[0].handAng = -0.6;
    p.arms[1].hand = P(10, -72); p.arms[1].open = 1;
    p.headTilt = -0.25;
    p.face = 'dazed';
    return p;
  };

  POSES.down = (c) => {
    const p = base(c.T);
    p.rot = -1.5; p.oy = 38; p.ox = 6;
    p.arms[0].hand = P(-14, -40); p.arms[0].handAng = PI * 0.7;
    p.arms[1].hand = P(14, -44); p.arms[1].open = 1;
    p.legs[0].foot = P(-6, -3); p.legs[1].foot = P(5, -6);
    p.shadow = 1.4;
    p.face = 'dazed';
    return p;
  };

  POSES.held = (c) => {
    const p = farRelaxed(hang(base(c.T)));
    const f = sin(c.T * 5);
    p.hip.y = -44;
    p.legs[0].foot = P(-3 + 1.5 * f, -3); p.legs[1].foot = P(3 - 1.5 * f, -4);
    p.legs[0].footAng = p.legs[1].footAng = 0.7;
    p.headTilt = 0.1;
    p.rot = c.m.swing || 0;
    p.shadow = 0;
    p.face = 'grin';
    return p;
  };

  // ------------------------------------------------------------------ rig
  function makeRig(name, c) {
    c.m = c.m || {};
    const p = (POSES[name] || POSES.stand)(c);
    const R = RG.resolve(p);
    const h = c.m.h || {};
    R.face = p.face; R.crossed = !!p.crossed; R.cape = p.cape || 0; R.cup = p.cup || 0;
    R.weaponDown = !!p.weaponDown; R.spinAt = p.spinAt;
    R.weapon = h.weapon || null;
    return R;
  }

  function lerpRig(a, b, k) {
    if (k >= 1) return b;
    if (k <= 0) return a;
    const o = I.lerpRig(a, b, k);
    const pick = k < 0.5 ? a : b;
    o.face = pick.face; o.crossed = pick.crossed; o.weaponDown = pick.weaponDown; o.spinAt = pick.spinAt; o.weapon = b.weapon;
    o.cape = lerp(a.cape || 0, b.cape || 0, k);
    o.cup = lerp(a.cup || 0, b.cup || 0, k);
    return o;
  }

  // ------------------------------------------------------------------ drawing helpers
  const grad = RG.grad;
  const limb = RG.limb;
  const dim = (cols) => [cols[1], cols[2], cols[2]];
  function rnd(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ------------------------------------------------------------------ the cape
  function drawCape(ctx, R, L, T, h) {
    const facing = h && h.facing ? h.facing : 1;
    const vx = h ? (h.vx || 0) * facing : 0, vy = h ? h.vy || 0 : 0;
    const sp = hypot(vx, vy);
    const air = !!(h && (h.mode === 'air' || h.mode === 'held' || h.mode === 'thrown'));
    const k = clamp(sp / 520, 0, 1);
    let fx = -0.25 - 0.9 * R.cape, fy = 1 - 0.55 * R.cape;
    if (sp > 1) { fx = lerp(fx, -vx / sp * 1.3, k); fy = lerp(fy, -vy / sp * 1.3 + 0.25, k); }
    const flow = rot(norm(P(fx, fy)), -(R.rot || 0));
    const down = rot(P(-0.12, 1), R.lean);
    const top = add(R.hip, rot(P(-3.5, -31), R.lean));
    const N = 12, len = 70 + 6 * k, seg = len / N;
    const amp = (air ? 0.17 : 0.07) + 0.3 * k + 0.25 * R.cape;
    const spd = 3.2 + 7 * k + 4 * R.cape;
    const pts = [top], dirs = [];
    let p = top;
    for (let i = 0; i < N; i++) {
      const f = i / N;
      const d0 = norm(lp(down, flow, smooth(min(1, f * 1.7 + (air ? 0.25 : 0)))));
      const d = rot(d0, amp * sin(T * spd - i * 0.6) * (0.25 + f));
      dirs.push(d);
      p = add(p, mul(d, seg));
      pts.push(p);
    }
    dirs.push(dirs[N - 1]);
    const halfW = (i) => lerp(11, 18.5, i / N) * (1 + 0.08 * sin(T * spd * 0.7 - i * 0.5) * (air ? 1 : 0.3));
    const edge = (i, side) => { const d = dirs[i], n = P(-d.y, d.x); return add(pts[i], mul(n, side * halfW(i))); };
    const outline = () => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const q = edge(i, 1); if (!i) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }
      for (let i = N; i >= 0; i--) { const q = edge(i, -1); ctx.lineTo(q.x, q.y); }
      ctx.closePath();
    };
    // one sheet of cloth: lit on the near edge, in shade on the far one
    outline();
    const mid = pts[N >> 1], n0 = P(-dirs[N >> 1].y, dirs[N >> 1].x);
    const g = ctx.createLinearGradient(mid.x + n0.x * 18, mid.y + n0.y * 18, mid.x - n0.x * 18, mid.y - n0.y * 18);
    g.addColorStop(0, L.cape[0]); g.addColorStop(0.55, L.cape[1]); g.addColorStop(1, L.cape[2]);
    ctx.fillStyle = g; ctx.fill();
    // soft folds running down its length, moving with the wind
    ctx.save();
    ctx.clip();
    ctx.lineCap = 'round';
    for (const [u, w, a] of [[0.55, 5, 0.16], [-0.1, 6, 0.2], [-0.62, 4, 0.14]]) {
      ctx.beginPath();
      for (let i = 1; i <= N; i++) {
        const sway = 0.12 * sin(T * spd * 0.6 + i * 0.7 + u * 3);
        const q = lp(pts[i], edge(i, u + sway > 0 ? 1 : -1), abs(u + sway));
        if (i === 1) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.lineWidth = w; ctx.strokeStyle = `rgba(40,0,6,${a})`; ctx.stroke();
      ctx.lineWidth = w * 0.35; ctx.strokeStyle = `rgba(255,190,190,${a * 0.5})`; ctx.stroke();
    }
    ctx.restore();
    outline();
    ctx.lineWidth = 1; ctx.strokeStyle = L.capeLine; ctx.stroke();
  }

  // ------------------------------------------------------------------ weapons (origin: the fist, handle along +x)
  function drawMjolnir(ctx, glow, T) {
    // strap & pommel
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#2a1a0e';
    ctx.beginPath(); ctx.ellipse(-6.2, 0, 2.6, 1.4, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.rect(-4.6, -1.7, 2.2, 3.4); ctx.fillStyle = '#8e96a2'; ctx.fill(); ctx.stroke();
    // leather-wrapped handle
    ctx.beginPath(); ctx.rect(-2.6, -1.45, 14.4, 2.9);
    ctx.fillStyle = grad(ctx, 0, -1.45, 0, 1.45, ['#8a5a32', '#5e3a1d', '#2e1b0b']); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = '#1e1208'; ctx.stroke();
    ctx.strokeStyle = 'rgba(20,10,4,0.55)'; ctx.lineWidth = 0.55;
    ctx.beginPath(); for (let x = -1.8; x < 11.5; x += 1.6) { ctx.moveTo(x, -1.45); ctx.lineTo(x + 1.2, 1.45); } ctx.stroke();
    // the head
    ctx.beginPath();
    ctx.moveTo(11.6, -6.6); ctx.lineTo(19.4, -6.6); ctx.lineTo(20.2, -5.8); ctx.lineTo(20.2, 5.8); ctx.lineTo(19.4, 6.6);
    ctx.lineTo(11.6, 6.6); ctx.lineTo(10.8, 5.8); ctx.lineTo(10.8, -5.8); ctx.closePath();
    ctx.fillStyle = grad(ctx, 10.8, -6.6, 20.2, 6.6, ['#f3f5f8', '#a5adb8', '#525a65']); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#22272e'; ctx.stroke();
    // the striking faces & the knotwork panel
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(11.4, -6.1, 8.2, 1.1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(11.4, 5, 8.2, 1.1);
    ctx.strokeStyle = 'rgba(40,46,56,0.75)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.rect(12.6, -3.6, 5.8, 7.2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12.6, -3.6); ctx.quadraticCurveTo(15.5, 0, 18.4, -3.6); ctx.moveTo(12.6, 3.6); ctx.quadraticCurveTo(15.5, 0, 18.4, 3.6);
    ctx.moveTo(15.5, -3.6); ctx.lineTo(15.5, 3.6);
    ctx.stroke();
    if (glow > 0.05) weaponSparks(ctx, 15.5, 0, 9, glow, T);
  }

  function drawStormbreaker(ctx, glow, T) {
    // Groot's wood: a long handle with bark grooves
    ctx.beginPath();
    ctx.moveTo(-4.5, -1.5); ctx.quadraticCurveTo(10, -2.1, 24, -1.6); ctx.lineTo(24, 1.6); ctx.quadraticCurveTo(10, 2.1, -4.5, 1.5); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -2, 0, 2, ['#9a7a52', '#6a4f30', '#33251a']); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = '#21170e'; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,28,16,0.6)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-3, -0.6); ctx.bezierCurveTo(4, 0.8, 9, -1, 16, 0.4); ctx.moveTo(0, 0.9); ctx.bezierCurveTo(6, -0.4, 12, 1, 22, -0.2); ctx.stroke();
    // a little leaf where Groot grew back
    ctx.beginPath(); ctx.ellipse(6, -2.4, 1.6, 0.8, -0.5, 0, TAU); ctx.fillStyle = '#5c8f3c'; ctx.fill();
    // the hammer side (up) and the great curved blade (down)
    const metal = ['#f1f6fc', '#9fb0c4', '#45536a'];
    ctx.beginPath(); ctx.rect(19.5, -7.8, 6, 6.2);
    ctx.fillStyle = grad(ctx, 19.5, -7.8, 25.5, -1.6, metal); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#1e2633'; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19.2, 1.4); ctx.lineTo(26, 1.4);
    ctx.quadraticCurveTo(29.5, 7, 27.2, 14.2);
    ctx.quadraticCurveTo(22.5, 10.5, 16.2, 11.8);
    ctx.quadraticCurveTo(19.6, 7.4, 19.2, 1.4);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 18, 1, 28, 14, metal); ctx.fill();
    ctx.stroke();
    // the sharpened edge, glowing a little
    ctx.beginPath(); ctx.moveTo(27, 13.6); ctx.quadraticCurveTo(22.4, 10.3, 16.8, 11.4);
    ctx.lineWidth = 1.3; ctx.strokeStyle = `rgba(190,230,255,${0.55 + 0.45 * glow})`; ctx.stroke();
    // runes
    ctx.strokeStyle = 'rgba(30,40,60,0.65)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(21.2, 4); ctx.lineTo(23, 6.2); ctx.lineTo(21.4, 8); ctx.moveTo(23.6, 3.6); ctx.lineTo(24.6, 7); ctx.stroke();
    // the spike on top
    ctx.beginPath(); ctx.moveTo(25.5, -1.4); ctx.lineTo(29.6, 0); ctx.lineTo(25.5, 1.4); ctx.closePath();
    ctx.fillStyle = metal[1]; ctx.fill(); ctx.strokeStyle = '#1e2633'; ctx.stroke();
    if (glow > 0.05) weaponSparks(ctx, 23, 4, 11, glow, T);
  }

  function weaponSparks(ctx, x, y, r, glow, T) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    I.glow(ctx, x, y, r * (1 + 0.4 * glow), '140,190,255', glow * 0.8);
    const rr = rnd(Math.floor(T * 18));
    ctx.strokeStyle = `rgba(215,235,255,${0.9 * glow})`; ctx.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) {
      let a = rr() * TAU, px = x + cos(a) * r * 0.4, py = y + sin(a) * r * 0.4;
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let j = 0; j < 3; j++) { a += (rr() - 0.5) * 1.6; px += cos(a) * r * 0.35; py += sin(a) * r * 0.35; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWeaponShape(ctx, kind, glow, T) {
    if (kind === 'axe') drawStormbreaker(ctx, glow, T);
    else if (kind === 'hammer') drawMjolnir(ctx, glow, T);
  }
  const weaponLen = (kind) => (kind === 'axe' ? 24 : kind === 'hammer' ? 15.5 : 4);

  // ------------------------------------------------------------------ body
  function drawLeg(ctx, Lg, L, far) {
    const legs = far ? dim(L.legs) : L.legs;
    const boot = far ? dim(L.boot) : L.boot;
    limb(ctx, Lg.hip, Lg.knee, 14, 11, legs, L.line);
    const mid = lp(Lg.knee, Lg.foot, 0.32);
    limb(ctx, Lg.knee, mid, 11, 10, legs, L.line);
    limb(ctx, mid, Lg.foot, 10.6, 8.6, boot, L.line);
    // boot straps
    const d = norm(sub(Lg.foot, Lg.knee)), n = P(-d.y, d.x);
    ctx.lineWidth = 1; ctx.strokeStyle = far ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.45)';
    for (const u of [0.15, 0.45, 0.75]) {
      const q = lp(mid, Lg.foot, u);
      ctx.beginPath(); ctx.moveTo(q.x + n.x * 5, q.y + n.y * 5); ctx.lineTo(q.x - n.x * 5 + d.x * 1.4, q.y - n.y * 5 + d.y * 1.4); ctx.stroke();
    }
    // knee plate
    ctx.beginPath(); ctx.ellipse(Lg.knee.x, Lg.knee.y, 4.6, 3.6, atan2(d.y, d.x), 0, TAU);
    ctx.fillStyle = grad(ctx, Lg.knee.x - 4, Lg.knee.y - 4, Lg.knee.x + 4, Lg.knee.y + 4, far ? dim(L.plate) : L.plate); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.save();
    ctx.translate(Lg.foot.x, Lg.foot.y);
    ctx.rotate(Lg.ang);
    ctx.beginPath();
    ctx.moveTo(-4.4, -2.6); ctx.lineTo(3.4, -3); ctx.quadraticCurveTo(9, -1, 9.4, 3.6); ctx.lineTo(-4.6, 4.2); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -3, 0, 4.2, boot); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.restore();
  }

  function drawHand(ctx, A, L, far, skin) {
    const cols = far ? dim(skin) : skin;
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    ctx.rotate(A.ang);
    ctx.lineWidth = 1; ctx.strokeStyle = '#6e4430';
    if (A.open > 0.5) {
      ctx.beginPath();
      ctx.moveTo(-1.5, -3.6); ctx.lineTo(4.4, -3.4); ctx.lineTo(8.8, -2.6); ctx.quadraticCurveTo(10, -0.6, 8.8, 0.7);
      ctx.lineTo(4.8, 1.3); ctx.lineTo(6, 3.8); ctx.quadraticCurveTo(5, 5, 3.4, 4); ctx.lineTo(-1.5, 3.6); ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, -3.6, 0, 3.6, cols); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,68,48,0.5)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(4.6, -1.7); ctx.lineTo(8.8, -1.3); ctx.moveTo(4.6, -0.1); ctx.lineTo(8.6, 0); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-1.6, -3.9); ctx.lineTo(3.8, -4); ctx.quadraticCurveTo(7, -3.8, 7, 0); ctx.quadraticCurveTo(7, 3.9, 3.8, 4); ctx.lineTo(-1.6, 3.9); ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, -4, 0, 4, cols); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(110,68,48,0.5)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(4.8, -2.8); ctx.lineTo(4.8, 2.8); ctx.stroke();
    }
    ctx.restore();
  }

  function drawArm(ctx, A, L, far) {
    const arm = L.bareArms ? SKIN : L.sleeve;
    const cols = far ? dim(arm) : arm;
    const line = L.bareArms ? '#6e4430' : L.line;
    limb(ctx, A.sh, A.elbow, 12.4, 10.6, cols, line);
    limb(ctx, A.elbow, A.hand, 10.4, 9, cols, line);
    const d = norm(sub(A.elbow, A.sh)), n = P(-d.y, d.x);
    if (!far) {
      // biceps and the forearm muscle
      const m = lp(A.sh, A.elbow, 0.55);
      ctx.beginPath(); ctx.moveTo(m.x - d.x * 3.5 + n.x * 2.8, m.y - d.y * 3.5 + n.y * 2.8); ctx.quadraticCurveTo(m.x + n.x * 4.4, m.y + n.y * 4.4, m.x + d.x * 3.8 + n.x * 2.6, m.y + d.y * 3.8 + n.y * 2.6);
      ctx.lineWidth = 0.75; ctx.strokeStyle = L.bareArms ? 'rgba(150,90,60,0.4)' : L.texture; ctx.stroke();
    }
    // bracer from mid-forearm to the wrist
    const fd = norm(sub(A.hand, A.elbow)), fn = P(-fd.y, fd.x);
    const b0 = lp(A.elbow, A.hand, 0.35), b1 = lp(A.elbow, A.hand, 0.92);
    ctx.beginPath();
    ctx.moveTo(b0.x + fn.x * 5.6, b0.y + fn.y * 5.6); ctx.lineTo(b1.x + fn.x * 5, b1.y + fn.y * 5);
    ctx.lineTo(b1.x - fn.x * 5, b1.y - fn.y * 5); ctx.lineTo(b0.x - fn.x * 5.6, b0.y - fn.y * 5.6); ctx.closePath();
    ctx.fillStyle = grad(ctx, b0.x + fn.x * 5, b0.y + fn.y * 5, b0.x - fn.x * 5, b0.y - fn.y * 5, far ? dim(L.bracer) : L.bracer); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6;
    const bm = lp(b0, b1, 0.5);
    ctx.beginPath(); ctx.moveTo(bm.x + fn.x * 5.2, bm.y + fn.y * 5.2); ctx.lineTo(bm.x - fn.x * 5.2, bm.y - fn.y * 5.2); ctx.stroke();
    drawHand(ctx, A, L, far, SKIN);
    // shoulder plate (pauldron)
    ctx.save();
    ctx.translate(A.sh.x, A.sh.y);
    ctx.rotate(atan2(d.y, d.x) - PI / 2);
    ctx.beginPath();
    ctx.moveTo(-7.6, -2.4); ctx.quadraticCurveTo(0, -9, 7.6, -2.4); ctx.lineTo(6.8, 3.6); ctx.quadraticCurveTo(0, 6, -6.8, 3.6); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -8, 0, 5, far ? dim(L.plate) : L.plate); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-6.4, 0.6); ctx.quadraticCurveTo(0, -4, 6.4, 0.6); ctx.stroke();
    ctx.restore();
  }

  function drawCup(ctx, A) {
    // a drinking horn of mead in the far hand
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    ctx.rotate(A.ang - PI / 2);
    ctx.beginPath(); ctx.moveTo(-3.4, -1); ctx.lineTo(3.4, -1); ctx.lineTo(2.6, 8.5); ctx.lineTo(-2.6, 8.5); ctx.closePath();
    ctx.fillStyle = grad(ctx, -3, 0, 3, 0, ['#e8c071', '#b78a3c', '#6e4f1c']); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = '#3b2a0e'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.9)'; ctx.fillRect(-3.4, -1.6, 6.8, 1.2);
    ctx.restore();
  }

  function drawTorso(ctx, R, L) {
    ctx.save();
    ctx.translate(R.hip.x, R.hip.y);
    ctx.rotate(R.lean);
    const f = 2.2 * (R.turn - 0.35) / 0.65 + 1.2;
    // leather skirt strips below the belt
    for (let i = 0; i < 5; i++) {
      const x = -9 + i * 4.4;
      ctx.beginPath(); ctx.moveTo(x, -2); ctx.lineTo(x + 4, -2); ctx.lineTo(x + 3.6, 7); ctx.lineTo(x + 0.4, 7.4); ctx.closePath();
      ctx.fillStyle = grad(ctx, x, -2, x, 7, i % 2 ? ['#5a4632', '#3a2c1e', '#1c140c'] : ['#4c3b2a', '#30241a', '#160f09']); ctx.fill();
      ctx.lineWidth = 0.7; ctx.strokeStyle = '#120c07'; ctx.stroke();
    }
    // the torso: broad and heavy
    ctx.beginPath();
    ctx.moveTo(-9.6, -3.2);
    ctx.lineTo(-13.4, -16); ctx.quadraticCurveTo(-16.8, -29, -11.6, -33.4);
    ctx.lineTo(-3.6, -35.4); ctx.lineTo(5, -35.4); ctx.lineTo(12.4, -33.2);
    ctx.quadraticCurveTo(17.6, -29.4, 16, -20);
    ctx.quadraticCurveTo(14, -11, 10, -3.2);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -13, -34, 13, -3, L.armor); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = L.line; ctx.stroke();
    // the scale-mail texture of the classic armor
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = L.texture; ctx.lineWidth = 0.55;
    for (let y = -33; y < -4; y += 2.6) {
      ctx.beginPath();
      for (let x = -15 + ((y * 10) % 2.4); x < 16; x += 2.4) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 1.2, y + 1.8, x + 2.4, y); }
      ctx.stroke();
    }
    ctx.restore();
    // the breastplate: a V of plates down the middle
    ctx.beginPath();
    ctx.moveTo(-8.4 + f * 0.3, -33.6); ctx.lineTo(f + 1, -20.5); ctx.lineTo(10.8 + f * 0.3, -33.4);
    ctx.lineTo(13.2 + f * 0.2, -26); ctx.lineTo(f + 1, -10.6); ctx.lineTo(-10.8 + f * 0.25, -26); ctx.closePath();
    ctx.fillStyle = grad(ctx, -8, -34, 8, -10, L.plate); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(f + 1, -20.5); ctx.lineTo(f + 1, -11); ctx.stroke();
    // the six discs
    const discs = [[-5.6, -28.6], [6.4, -28.4], [-4.6, -22.2], [6.6, -22], [-3.4, -15.8], [6.4, -15.6]];
    for (const [dx, dy] of discs) {
      const x = dx + f * 0.55, y = dy;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU);
      ctx.fillStyle = grad(ctx, x - 2.5, y - 2.5, x + 2.5, y + 2.5, L.disc); ctx.fill();
      ctx.lineWidth = 0.75; ctx.strokeStyle = L.discLine; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 1.25, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 0.7, y - 0.8, 0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
    }
    // the belt and its buckle
    ctx.beginPath();
    ctx.moveTo(-10.2, -6); ctx.lineTo(10.4, -6); ctx.lineTo(10, -2.2); ctx.lineTo(-9.8, -2.2); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -6, 0, -2.2, ['#5a4632', '#3a2c1e', '#1c140c']); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#120c07'; ctx.stroke();
    ctx.beginPath(); ctx.arc(f + 1, -4.1, 2.6, 0, TAU);
    ctx.fillStyle = grad(ctx, f - 1.6, -6.7, f + 3.6, -1.5, L.disc); ctx.fill();
    ctx.lineWidth = 0.8; ctx.strokeStyle = L.discLine; ctx.stroke();
    // cape clasps at the shoulders
    for (const cx of [-9.6, 11]) {
      ctx.beginPath(); ctx.arc(cx, -32.4, 2.4, 0, TAU);
      ctx.fillStyle = grad(ctx, cx - 2.4, -34.8, cx + 2.4, -30, L.disc); ctx.fill();
      ctx.lineWidth = 0.75; ctx.strokeStyle = L.discLine; ctx.stroke();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ head
  function hairWind(h) {
    if (!h) return 0;
    const v = (h.vx || 0) * (h.facing || 1);
    return clamp(v / 500, -1, 1);
  }

  // long hair falls behind the head, down to the shoulders, and streams in flight
  function drawHairBack(ctx, R, L, T, h) {
    if (L.hair !== 'long') return;
    ctx.save();
    ctx.translate(R.head.x, R.head.y);
    ctx.rotate(R.lean + R.headTilt);
    const wd = hairWind(h);
    const air = h && h.mode === 'air';
    const sway = (air ? 1.4 : 0.6) * sin(T * (air ? 6 : 1.6));
    const tipX = -10.5 - 7 * max(0, wd) + sway, tipY = 19 - 6 * max(0, wd);
    ctx.beginPath();
    ctx.moveTo(4.5, -9.8);
    ctx.quadraticCurveTo(-4, -14, -9.8, -6);
    ctx.quadraticCurveTo(-12.8, 4, tipX, tipY);
    ctx.quadraticCurveTo(tipX + 4, tipY + 2.4, -2.4, tipY - 1);
    ctx.quadraticCurveTo(-4, 8, -3.4, 2);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -10, -12, -2, tipY, L.hairCol); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#7a5a16'; ctx.stroke();
    ctx.strokeStyle = 'rgba(122,90,22,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-6, -8); ctx.quadraticCurveTo(-10.6, 3, tipX + 1.4, tipY - 1.5);
    ctx.moveTo(-3.6, -6); ctx.quadraticCurveTo(-7.4, 6, tipX + 4.2, tipY);
    ctx.stroke();
    ctx.restore();
  }

  function drawHead(ctx, R, L, T, glow, h) {
    ctx.save();
    ctx.translate(R.head.x, R.head.y);
    ctx.rotate(R.lean + R.headTilt);
    const f = 1.5 + 2.6 * (R.turn - 0.35) / 0.65;
    const face = R.face || 'calmBrave';
    // thick neck
    ctx.beginPath(); ctx.moveTo(-4.8, 3); ctx.lineTo(4.8, 3); ctx.lineTo(5.8, 11.5); ctx.lineTo(-5.6, 11.5); ctx.closePath();
    ctx.fillStyle = grad(ctx, -5, 0, 5, 0, SKIN); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    // skull and jaw
    ctx.beginPath();
    ctx.moveTo(-7.6, -1.5);
    ctx.bezierCurveTo(-8.6, -8.8, -3.6, -11.2, 1.6, -10.8);
    ctx.bezierCurveTo(6.8, -10.4, 9.2, -6.8, 9, -1.4);
    ctx.lineTo(8.8, 3.2);
    ctx.quadraticCurveTo(8.6, 8.6, 5, 9.8);
    ctx.lineTo(-0.6, 9.8);
    ctx.quadraticCurveTo(-5.6, 9, -7, 4);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -7, -9, 8, 9, SKIN); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    // ear
    ctx.beginPath(); ctx.ellipse(-5.3 + f * 0.1, 0.9, 1.3, 2.2, -0.2, 0, TAU);
    ctx.fillStyle = SKIN[1]; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#7a4a34'; ctx.stroke();
    drawBeard(ctx, f, L, face);
    drawFace(ctx, f, face, glow, T, L);
    drawHairFront(ctx, f, L, T, h);
    ctx.restore();
  }

  function drawBeard(ctx, f, L, face) {
    const a = L.beard;
    if (a <= 0) return;
    const open = face === 'roar' ? 1.6 : 0;
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * a;
    // jaw & chin
    ctx.beginPath();
    ctx.moveTo(-5.4, 1.6);
    ctx.quadraticCurveTo(-5.2, 7.6, -0.6, 9.9 + open * 0.4 + a * 1.2);
    ctx.lineTo(4.8, 10.2 + a * 1.6 + open * 0.5);
    ctx.quadraticCurveTo(8.8, 9, 9, 3.4);
    ctx.lineTo(8.4, 3.6);
    ctx.quadraticCurveTo(f + 4.4, 7.4 + open, f + 0.8, 7.6 + open);
    ctx.quadraticCurveTo(f - 2.6, 7.4 + open, -3.6, 2.2);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, 1, 0, 11, [L.hairCol[1], L.hairCol[2], '#6a4c12']); ctx.fill();
    // moustache
    ctx.beginPath();
    ctx.moveTo(f - 2.4, 4.6); ctx.quadraticCurveTo(f + 0.8, 3.4, f + 4.2, 4.4); ctx.quadraticCurveTo(f + 4.6, 5.6, f + 3.6, 5.8);
    ctx.quadraticCurveTo(f + 0.8, 4.8, f - 1.8, 5.8); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawHairFront(ctx, f, L, T, h) {
    const long = L.hair === 'long';
    ctx.beginPath();
    if (long) {
      // swept back from the brow, falling past the ear
      ctx.moveTo(f + 5.2, -5.6);
      ctx.quadraticCurveTo(f + 6.8, -11.2, 1.4, -12.4);
      ctx.quadraticCurveTo(-5.8, -12.8, -8.6, -6.4);
      ctx.quadraticCurveTo(-9.8, -1, -8.2, 5.4);
      ctx.lineTo(-6, 4.8);
      ctx.quadraticCurveTo(-5.4, -1.6, -2, -4.8);
      ctx.lineTo(f - 0.4, -5.6);
      ctx.quadraticCurveTo(f + 2.4, -7.2, f + 5.2, -5.6);
    } else {
      // short on the sides, a little longer on top
      ctx.moveTo(f + 5.4, -6.2);
      ctx.quadraticCurveTo(f + 6.6, -11.4, 1.2, -12);
      ctx.quadraticCurveTo(-5.4, -12, -8, -6.2);
      ctx.quadraticCurveTo(-8.4, -3, -7.2, 0);
      ctx.lineTo(-5.6, -0.6);
      ctx.quadraticCurveTo(-5, -4, -1.8, -5.4);
      ctx.lineTo(f, -6.4);
      ctx.quadraticCurveTo(f + 2.8, -7.6, f + 5.4, -6.2);
    }
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -12.5, 0, long ? 5 : 0, L.hairCol); ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#7a5a16'; ctx.stroke();
    if (!long) {
      // the shaved sides of the Ragnarok cut
      ctx.fillStyle = 'rgba(160,120,40,0.28)';
      ctx.beginPath(); ctx.ellipse(-5.2, -1.8, 2.4, 3.4, -0.3, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(122,90,22,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(f + 4.2, -7.8); ctx.quadraticCurveTo(0, -11, -6.4, -6.8);
    ctx.moveTo(f + 2.4, -6.6); ctx.quadraticCurveTo(-1, -9, -6.8, -3.2);
    ctx.stroke();
  }

  function drawFace(ctx, f, face, glow, T, L) {
    const line = '#5a3222';
    const ne = P(f - 1.9, -1.4), fe = P(f + 3.1, -1.5);
    const angry = face === 'angry' || face === 'roar';
    ctx.strokeStyle = L.hairCol[2]; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(ne.x - 2, -4.4); ctx.lineTo(ne.x + 1.6, -3);
      ctx.moveTo(fe.x - 1.2, -3.1); ctx.lineTo(fe.x + 1.7, -4.4);
    } else {
      ctx.moveTo(ne.x - 2, -3.8); ctx.quadraticCurveTo(ne.x, -4.6, ne.x + 1.6, -4);
      ctx.moveTo(fe.x - 1.2, -4.1); ctx.quadraticCurveTo(fe.x, -4.7, fe.x + 1.6, -4);
    }
    ctx.stroke();
    const lit = L.lightningEyes ? glow > 0.25 : glow > 0.7;
    const eye = (c, rx, ry, cols) => {
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
      const open = face === 'roar' ? 1.15 : angry ? 0.75 : face === 'grin' ? 0.8 : 1;
      const almond = () => {
        ctx.beginPath();
        ctx.moveTo(c.x - rx, c.y + 0.1);
        ctx.quadraticCurveTo(c.x, c.y - ry * 1.3 * open, c.x + rx, c.y - ry * 0.2);
        ctx.quadraticCurveTo(c.x, c.y + ry * 0.95 * open, c.x - rx, c.y + 0.1);
        ctx.closePath();
      };
      ctx.save();
      almond();
      ctx.fillStyle = lit ? '#eef6ff' : '#ffffff'; ctx.fill();
      ctx.clip();
      if (!lit) {
        ctx.beginPath(); ctx.arc(c.x + rx * 0.22, c.y - ry * 0.12, ry * 0.86, 0, TAU); ctx.fillStyle = cols[0]; ctx.fill();
        ctx.beginPath(); ctx.arc(c.x + rx * 0.26, c.y - ry * 0.12, ry * 0.4, 0, TAU); ctx.fillStyle = cols[1]; ctx.fill();
      }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(c.x - rx - 0.2, c.y + 0.1); ctx.quadraticCurveTo(c.x, c.y - ry * 1.3 * open, c.x + rx + 0.25, c.y - ry * 0.25);
      ctx.lineWidth = 0.85; ctx.strokeStyle = line; ctx.stroke();
    };
    eye(ne, 1.7, 1.05, L.eyes);
    eye(fe, 1.25, 0.9, L.farEye || L.eyes);
    // nose
    ctx.strokeStyle = 'rgba(122,74,52,0.85)'; ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.moveTo(f + 1, -2); ctx.quadraticCurveTo(f + 1.6, 0.6, f + 2.6, 2.3); ctx.quadraticCurveTo(f + 2, 3.2, f + 0.8, 3); ctx.stroke();
    // mouth (inside the beard)
    const mx = f + 0.9, my = 6.4;
    ctx.lineWidth = 0.85; ctx.strokeStyle = line;
    ctx.beginPath();
    if (face === 'roar') {
      ctx.moveTo(mx - 2.4, my - 0.4); ctx.quadraticCurveTo(mx + 0.6, my - 1, mx + 3.2, my - 0.6);
      ctx.quadraticCurveTo(mx + 2.6, my + 3, mx + 0.2, my + 3.1); ctx.quadraticCurveTo(mx - 2, my + 2.6, mx - 2.4, my - 0.4);
      ctx.fillStyle = '#4a1a12'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 1.6, my - 0.5, 4, 0.8);
    } else if (face === 'grin') {
      ctx.moveTo(mx - 2.6, my - 0.6); ctx.quadraticCurveTo(mx + 0.4, my - 0.1, mx + 3.4, my - 1.1);
      ctx.quadraticCurveTo(mx + 0.8, my + 2.4, mx - 2.6, my - 0.6);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    } else if (angry) {
      ctx.moveTo(mx - 2.3, my + 0.4); ctx.lineTo(mx + 2.9, my); ctx.stroke();
    } else if (face === 'dazed') {
      ctx.moveTo(mx - 2, my + 0.4); ctx.quadraticCurveTo(mx - 0.8, my - 0.6, mx + 0.4, my + 0.4); ctx.quadraticCurveTo(mx + 1.6, my + 1.4, mx + 2.8, my + 0.2); ctx.stroke();
    } else {
      ctx.moveTo(mx - 2.2, my + 0.2); ctx.quadraticCurveTo(mx + 0.6, my + 1.1, mx + 3, my - 0.4); ctx.stroke();
    }
    // lightning in the eyes
    if (glow > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const k = L.lightningEyes ? glow : glow * 0.45;
      I.glow(ctx, ne.x + 0.3, ne.y, 3.4 + 3.4 * k, '120,180,255', k);
      I.glow(ctx, fe.x + 0.3, fe.y, 2.8 + 2.8 * k, '120,180,255', k);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ the whole hero
  function weaponIn(R, h) {
    const kind = (h && h.weapon) || R.weapon || 'hammer';
    if (kind === 'none') return null;
    if (h && h.thrown) return null;
    return kind;
  }

  function drawHeldWeapon(ctx, R, kind, glow, T, h) {
    const A = R.arms[0];
    const whirl = (h && h.whirl) || 0;
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    if (R.spinAt && whirl > 0) {
      // whirling: a blur disc and the weapon swinging round the hand
      const len = weaponLen(kind) + 4;
      ctx.save();
      ctx.globalAlpha = 0.18 * whirl;
      ctx.beginPath(); ctx.arc(0, 0, len, 0, TAU); ctx.fillStyle = '#c9d2de'; ctx.fill();
      ctx.restore();
      ctx.rotate(T * 22 * whirl);
    } else ctx.rotate(A.ang);
    drawWeaponShape(ctx, kind, glow, T);
    ctx.restore();
  }

  // the weapon standing on its head on the floor beside him
  function drawGroundWeapon(ctx, kind, T) {
    ctx.save();
    ctx.translate(18, kind === 'axe' ? -27 : -20.5);
    ctx.rotate(PI / 2);
    drawWeaponShape(ctx, kind, 0, T);
    ctx.restore();
  }

  function drawHero(ctx, R, opts) {
    opts = opts || {};
    const L = lookOf(opts.look);
    const T = opts.T || 0;
    const h = opts.h || null;
    const glow = R.glow != null ? R.glow : h && h.glow ? h.glow : 0;
    if (h && h.face) R = Object.assign({}, R, { face: h.face });
    const kind = weaponIn(R, h) || (h ? null : L.weapon === 'none' ? null : L.weapon);
    ctx.save();
    ctx.translate(R.ox, R.oy);
    if (R.rot) { ctx.translate(R.hip.x, R.hip.y); ctx.rotate(R.rot); ctx.translate(-R.hip.x, -R.hip.y); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawCape(ctx, R, L, T, h);
    if (R.weaponDown && kind) drawGroundWeapon(ctx, kind, T);
    drawLeg(ctx, R.legs[1], L, true);
    if (!R.crossed) drawArm(ctx, R.arms[1], L, true);
    if (R.cup > 0.5 && !R.crossed) drawCup(ctx, R.arms[1]);
    drawHairBack(ctx, R, L, T, h);
    drawTorso(ctx, R, L);
    drawLeg(ctx, R.legs[0], L, false);
    if (R.crossed) drawArm(ctx, R.arms[1], L, true);
    drawHead(ctx, R, L, T, glow, h);
    if (kind && !R.weaponDown && R.arms[0].open < 0.5) drawHeldWeapon(ctx, R, kind, glow, T, h);
    drawArm(ctx, R.arms[0], L, false);
    // Ragnarok: lightning crawling over his arms
    if (L.lightningEyes && glow > 0.3) {
      for (const A of R.arms) weaponSparks(ctx, A.hand.x, A.hand.y, 7, glow, T + (A === R.arms[0] ? 0 : 0.37));
    }
    ctx.restore();
  }

  // hero-local attach points (after ox/oy/rot)
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
    const A = R.arms[0];
    const L = R.weapon === 'axe' ? 24 : R.weapon === 'hammer' ? 15.5 : 4;
    const hand = tr(P(A.hand.x + cos(A.ang) * L, A.hand.y + sin(A.ang) * L));
    return { eyes, palms, head: tr(R.head), reactor: tr(R.chest), hand, hip: tr(R.hip) };
  }

  // ------------------------------------------------------------------ lightning
  function boltPoints(x1, y1, x2, y2, seed, rough) {
    const r = rnd(seed);
    let pts = [P(x1, y1), P(x2, y2)];
    let disp = hypot(x2 - x1, y2 - y1) * (rough || 0.22);
    for (let lvl = 0; lvl < 5; lvl++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const m = lp(a, b, 0.5);
        const d = norm(sub(b, a)), n = P(-d.y, d.x);
        out.push(add(m, mul(n, (r() - 0.5) * disp)), b);
      }
      pts = out;
      disp *= 0.52;
    }
    return { pts, r };
  }
  function strokePath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  function drawBolt(ctx, x1, y1, x2, y2, w, seed, alpha, branches) {
    if (alpha <= 0.01) return;
    const { pts, r } = boltPoints(x1, y1, x2, y2, seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const passes = [[w * 4.2, `rgba(90,140,255,${0.22 * alpha})`], [w * 2, `rgba(150,195,255,${0.55 * alpha})`], [w * 0.75, `rgba(245,250,255,${alpha})`]];
    for (const [lw, col] of passes) { ctx.lineWidth = lw; ctx.strokeStyle = col; strokePath(ctx, pts); }
    // forks
    for (let b = 0; b < (branches || 0); b++) {
      const i = Math.floor(pts.length * (0.2 + r() * 0.6));
      const a = pts[i];
      const dir = norm(sub(pts[min(pts.length - 1, i + 4)], a));
      const ang = atan2(dir.y, dir.x) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5);
      const L = hypot(x2 - x1, y2 - y1) * (0.12 + r() * 0.18);
      const fb = boltPoints(a.x, a.y, a.x + cos(ang) * L, a.y + sin(ang) * L, seed + 17 * (b + 1), 0.3).pts;
      ctx.lineWidth = w * 1.4; ctx.strokeStyle = `rgba(140,190,255,${0.4 * alpha})`; strokePath(ctx, fb);
      ctx.lineWidth = w * 0.5; ctx.strokeStyle = `rgba(240,248,255,${0.85 * alpha})`; strokePath(ctx, fb);
    }
    ctx.restore();
  }

  function drawBifrost(ctx, b, S, age, life) {
    const x = b.x2, top = b.y1, bot = b.y2;
    const W = 44 * S * (0.6 + 0.4 * sin(min(1, age / 0.25) * PI / 2));
    const a = min(1, age * 6) * life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x - W / 2, 0, x + W / 2, 0);
    const cols = ['255,70,70', '255,170,60', '255,240,90', '90,240,120', '80,220,255', '90,120,255', '200,100,255'];
    g.addColorStop(0, 'rgba(255,255,255,0)');
    cols.forEach((c, i) => g.addColorStop(0.08 + i * 0.14, `rgba(${c},${0.55 * a})`));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - W / 2, top, W, bot - top);
    // the bright core
    const cg = ctx.createLinearGradient(x - W * 0.2, 0, x + W * 0.2, 0);
    cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(0.5, `rgba(255,255,255,${0.75 * a})`); cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(x - W * 0.2, top, W * 0.4, bot - top);
    // sparkles rising in the beam
    const r = rnd(hash(b.id || 'bf') + Math.floor(age * 30));
    for (let i = 0; i < 14; i++) {
      const sy = bot - ((r() + age * 0.8) % 1) * (bot - top);
      I.glow(ctx, x + (r() - 0.5) * W * 0.9, sy, 2.5 * S, cols[i % cols.length], a);
    }
    ctx.restore();
    // the rune circle burned into the floor
    ctx.save();
    ctx.globalAlpha = clamp(age / 0.3, 0, 1) * min(1, life * 2);
    ctx.translate(x, bot);
    ctx.scale(1, 0.28);
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = 'rgba(255,230,170,0.85)';
    ctx.beginPath(); ctx.arc(0, 0, 40 * S, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 31 * S, 0, TAU); ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * TAU;
      ctx.beginPath();
      ctx.moveTo(cos(a0) * 32 * S, sin(a0) * 32 * S);
      ctx.quadraticCurveTo(cos(a0 + 0.12) * 37 * S, sin(a0 + 0.12) * 37 * S, cos(a0 + 0.2) * 39 * S, sin(a0 + 0.2) * 39 * S);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the scene asks here first for each of Thor's beams
  function drawBeam(ctx, b, x1, y1, S, age, life, T, pts) {
    const seedBase = hash(String(b.id || b.start || '')) + Math.floor(age * 22);
    if (b.kind === 'bifrost') { drawBifrost(ctx, b, S, age, life); return true; }
    if (b.kind === 'bolt' || b.kind === 'crackle') {
      const tx = b.kind === 'crackle' && pts && pts.hand ? pts.hand.x : b.x2;
      const ty = b.kind === 'crackle' && pts && pts.hand ? pts.hand.y : b.y2;
      const a = min(1, life * 3) * (0.75 + 0.25 * sin(age * 70));
      drawBolt(ctx, b.x1, b.y1, tx, ty, b.w * S * (b.kind === 'bolt' ? 0.9 : 0.55), seedBase, a, b.kind === 'bolt' ? 3 : 1);
      if (b.kind === 'bolt') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        I.glow(ctx, tx, ty, 34 * S, '150,195,255', a * 0.9);
        ctx.restore();
      }
      return true;
    }
    if (b.kind === 'chain') {
      drawBolt(ctx, b.x1, b.y1, b.x2, b.y2, b.w * S * 0.6, seedBase, min(1, life * 3), 0);
      return true;
    }
    if (b.kind === 'arc' || b.kind === 'blast') {
      const a = b.kind === 'blast' ? min(1, life * 5, age * 8) : min(1, life * 3);
      const w = b.w * S * (b.kind === 'blast' ? 0.7 : 0.55);
      drawBolt(ctx, x1, y1, b.x2, b.y2, w, seedBase, a, b.kind === 'blast' ? 2 : 1);
      if (b.kind === 'blast') drawBolt(ctx, x1, y1, b.x2, b.y2, w * 0.7, seedBase + 99, a * 0.8, 1);
      return true;
    }
    return false;
  }

  // the weapon in flight: spinning, trailing sparks
  function drawWorld(ctx, s, h, pts, T) {
    if (!h.thrown || !h.weapon || h.weapon === 'none') return;
    const S = (s.s || 1) * (h.body || 1);
    const t = h.thrown;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(S, S);
    // motion blur ring
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.beginPath(); ctx.arc(0, 0, weaponLen(h.weapon) * 0.75, 0, TAU); ctx.fillStyle = '#c9d6ea'; ctx.fill();
    ctx.restore();
    ctx.rotate(t.ang);
    const L = weaponLen(h.weapon);
    ctx.translate(-L * 0.55, 0);
    drawWeaponShape(ctx, h.weapon, 0.8, T);
    ctx.restore();
  }
  function worldBusy(s) { return !!(s.hero && s.hero.thrown); }

  // crackling lightning on a shocked enemy
  function drawEnemyOverlay(ctx, e, T, cy) {
    if (!(e.stun > 0) || e.stunKind !== 'shock') return;
    const V = window.VillainArt && window.VillainArt.INFO[e.kind];
    const r = { tank: 22, walker: 17, drone: 15, mini: 10 }[e.kind] || (V ? V.r : 14);
    const a = clamp(e.stun / 0.4, 0, 1);
    const seed = hash(String(e.id)) + Math.floor(T * 16);
    const rr = rnd(seed);
    ctx.save();
    ctx.translate(0, cy);
    for (let i = 0; i < 3; i++) {
      const a0 = rr() * TAU, a1 = a0 + 1 + rr() * 2;
      drawBolt(ctx, cos(a0) * r, sin(a0) * r * 0.85, cos(a1) * r, sin(a1) * r * 0.85, 0.9, seed + i, a, 0);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ menus, home, icons
  function drawBust(ctx, look, T) {
    const R = makeRig('stand', { t: 0, T, phase: 0, m: { h: { weapon: lookOf(look).weapon } } });
    R.turn = 0.62;
    R.face = 'grin';
    drawHero(ctx, R, { look, T, h: { weapon: lookOf(look).weapon, facing: 1, mode: 'ground', vx: 0, vy: 0, glow: lookOf(look).lightningEyes ? 0.35 : 0 } });
  }

  // fills a 46×46 circle (origin top-left)
  function drawAvatar(ctx, look, T) {
    ctx.save();
    ctx.translate(17, 146);
    ctx.scale(1.42, 1.42);
    drawBust(ctx, look, T);
    ctx.restore();
  }

  // home header: origin at his feet
  function drawPortrait(ctx, state, T, look) {
    const h = state.hero || {};
    const L = lookOf(look);
    const cyc = (T / 5) % 3;
    const name = h.mode === 'down' ? 'down' : cyc < 1 ? 'stand' : cyc < 2 ? (L.weapon === 'none' ? 'raise' : 'twirl') : 'raise';
    const R = makeRig(name, { t: T % 5, T, phase: 0, m: { h: { weapon: L.weapon } } });
    R.turn = max(R.turn, 0.55);
    ctx.scale(0.8, 0.8);
    drawHero(ctx, R, { look, T, h: { weapon: L.weapon, whirl: name === 'twirl' ? 0.6 : 0, glow: name === 'raise' ? 0.6 + 0.4 * sin(T * 6) : 0, vx: 40 * sin(T * 0.7), vy: 0, facing: 1, mode: 'ground' } });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // the app icon: storm clouds, a bolt behind him, Mjolnir raised
  function drawIcon(ctx, size) {
    const k = size / 1024;
    ctx.save();
    ctx.scale(k, k);
    roundRect(ctx, 40, 40, 944, 944, 220);
    const g = ctx.createLinearGradient(0, 40, 0, 984);
    g.addColorStop(0, '#2b3a66'); g.addColorStop(0.6, '#141c36'); g.addColorStop(1, '#080b18');
    ctx.fillStyle = g; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(160,180,230,0.12)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(150 + i * 150, 120 + (i % 2) * 40, 170, 70, 0, 0, TAU); ctx.fill(); }
    drawBolt(ctx, 760, 40, 640, 560, 14, 7, 1, 3);
    drawBolt(ctx, 260, 40, 330, 420, 9, 11, 0.8, 2);
    const R = makeRig('raise', { t: 0.5, T: 0.3, phase: 0, m: { h: { weapon: 'hammer' } } });
    R.turn = 0.7; R.face = 'roar';
    ctx.translate(470, 1560);
    ctx.scale(12.4, 12.4);
    drawHero(ctx, R, { look: 'classic', T: 0.3, h: { weapon: 'hammer', glow: 1, vx: -260, vy: 0, facing: 1, mode: 'air' } });
    ctx.restore();
    roundRect(ctx, 40, 40, 944, 944, 220);
    ctx.lineWidth = 18; ctx.strokeStyle = '#9fc6ff'; ctx.stroke();
    ctx.restore();
  }

  // tray: Mjolnir with a bolt (reads at 16 px)
  function drawTray(ctx, size) {
    const k = size / 64;
    ctx.save();
    ctx.scale(k, k);
    ctx.translate(30, 28);
    ctx.rotate(PI / 2);
    ctx.scale(2.3, 2.3);
    ctx.translate(-10, 0);
    drawMjolnir(ctx, 0.7, 0.2);
    ctx.restore();
  }

  // ------------------------------------------------------------------ callouts & the hover card (Asgardian style)
  function callout(ctx, text, x, y, a, tone) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 18;
    roundRect(ctx, x - w / 2, y - 7.5, w, 15, 3);
    ctx.fillStyle = tone === 'warn' ? 'rgba(120,16,24,0.92)' : 'rgba(16,24,48,0.9)';
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#9fc6ff'; ctx.stroke();
    // a little bolt
    ctx.fillStyle = '#ffe27a';
    const bx = x - w / 2 + 7, by = y;
    ctx.beginPath(); ctx.moveTo(bx + 1.2, by - 4.4); ctx.lineTo(bx - 1.6, by + 0.4); ctx.lineTo(bx + 0.2, by + 0.4); ctx.lineTo(bx - 1, by + 4.4); ctx.lineTo(bx + 2, by - 0.8); ctx.lineTo(bx + 0.2, by - 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x + 3, y + 0.5);
    ctx.restore();
  }

  function card(ctx, h, x, bottom) {
    const meters = h.meters || [];
    const w = 126, hh = 22 + meters.length * 10;
    ctx.save();
    ctx.translate(x - w / 2, bottom - hh);
    roundRect(ctx, 0, 0, w, hh, 3);
    ctx.fillStyle = 'rgba(14,20,42,0.9)'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#9fc6ff'; ctx.stroke();
    ctx.fillStyle = '#b5202b'; ctx.fillRect(4, 2, w - 8, 1.2);
    ctx.font = '700 8px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#cfe2ff';
    ctx.fillText(('THOR · ' + h.status).slice(0, 32), 6, 10);
    meters.forEach((m, i) => {
      const y = 21 + i * 10;
      ctx.fillStyle = 'rgba(200,220,255,0.85)'; ctx.fillText(m.short || m.label, 6, y);
      ctx.fillStyle = 'rgba(160,190,255,0.15)'; ctx.fillRect(30, y - 2.5, w - 38, 5);
      ctx.fillStyle = m.v < 20 ? '#ff4d5e' : m.color; ctx.fillRect(30, y - 2.5, (w - 38) * clamp(m.v / 100, 0, 1), 5);
    });
    ctx.restore();
  }

  // sparks streaming off him in fast flight; smoke when he's been blasted
  function trail(h, rig, toG, spawn, S, now, R) {
    if (now - R.trailAt < 45) return;
    if (h.mode === 'thrown' && h.speed > 160 * S) {
      R.trailAt = now;
      const p = toG(rig.hip);
      spawn({ kind: 'smoke', x: p.x, y: p.y, n: 1, small: true, life: 0.6 });
    } else if (h.mode === 'air' && h.speed > 380 * S) {
      R.trailAt = now;
      const p = toG(rig.legs[0].foot);
      spawn({ kind: 'thrust', x: p.x - h.vx * 0.03, y: p.y - h.vy * 0.03, n: 1, small: true, color: '160,200,255', life: 0.5 });
    }
  }

  function beamColors(b) {
    if (['bolt', 'chain', 'arc', 'crackle', 'blast'].includes(b.kind)) return { halo: '130,180,255', core: 'rgba(245,250,255,0.97)' };
    return null;
  }

  function expandFx(e, S, spawn) {
    switch (e.kind) {
      case 'lightningHit':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: (e.small ? 0.6 : 1.1) * S, life: 0.22, color: '150,195,255' });
        spawn({ kind: 'thrust', x: e.x, y: e.y, n: e.small ? 3 : 6, spread: 14 * S, speed: 140 * S, size: S * 1.4, life: 0.4, color: '200,225,255' });
        if (!e.small) spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: 1.1 * S, life: 0.4, color: '170,205,255' });
        return true;
      case 'thunder':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 2.2 * S, life: 0.3, color: '200,220,255' });
        if (e.ring) spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 3 * S, life: 0.6, color: '170,205,255', stagger: 0.08, flat: 0.35 });
        return true;
      case 'bifrost':
        spawn({ kind: 'sparkle', x: e.x, y: e.y - 20 * S, n: 10, spread: 30 * S, speed: 70 * S, size: S, life: 1, color: '#fff3b0' });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 2, size: 1.6 * S, life: 0.7, color: '255,230,170', stagger: 0.12, flat: 0.3 });
        return true;
      case 'shatter':
        spawn({ kind: 'debris', x: e.x, y: e.y, n: 7, spread: 6 * S, speed: 90 * S, size: S * 0.7, life: 0.6, color: '#e8c071' });
        spawn({ kind: 'sparkle', x: e.x, y: e.y, n: 4, spread: 8 * S, speed: 50 * S, size: S * 0.8, life: 0.5, color: '#fff2c4' });
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
    zap(L) { L.hiss('highpass', 3200, 0.8, 0.12, 0.3); L.blip('square', 1800, 400, 0.1, 0.05); L.hiss('bandpass', 1800, 3, 0.08, 0.18, 0.03); },
    thunder(L) {
      // the crack, then the roll
      L.hiss('highpass', 2400, 0.7, 0.08, 0.7);
      L.blip('sine', 120, 30, 0.6, 0.55);
      L.hiss('lowpass', 420, 0.6, 1.6, 0.45, 0.05);
      L.hiss('lowpass', 260, 0.6, 1.2, 0.3, 0.35);
    },
    thunderRoll(L) { L.hiss('lowpass', 300, 0.7, 1.4, 0.32); L.hiss('lowpass', 520, 0.6, 0.9, 0.18, 0.25); },
    thunderLand(L) { L.blip('sine', 150, 32, 0.45, 0.65); L.hiss('lowpass', 700, 0.8, 0.5, 0.5); L.hiss('highpass', 2600, 0.7, 0.07, 0.4); },
    whirl(L) { for (let i = 0; i < 4; i++) L.hiss('bandpass', 700 + i * 120, 4, 0.14, 0.18, i * 0.12); },
    catch(L) { L.blip('sine', 220, 90, 0.12, 0.4); L.hiss('lowpass', 1200, 0.7, 0.06, 0.25); },
    hammerHit(L) { L.blip('sine', 180, 40, 0.3, 0.6); L.hiss('lowpass', 1000, 0.8, 0.2, 0.5); L.blip('triangle', 900, 700, 0.18, 0.12, 0.01); },
    glass(L) { for (let i = 0; i < 5; i++) L.blip('sine', 2400 + Math.random() * 2400, 1800, 0.08, 0.06, i * 0.03); L.hiss('highpass', 4000, 0.8, 0.12, 0.2); },
    bifrost(L) {
      const c = L.ctx(); if (!c) return;
      const t = c.currentTime + 0.01;
      const out = L.gain(0.0001); out.connect(L.out());
      out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(0.16, t + 0.15); out.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      for (const f of [330, 495, 660, 990]) {
        const o = c.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f * 0.7, t); o.frequency.exponentialRampToValueAtTime(f * 1.3, t + 1.2);
        o.connect(out); o.start(t); o.stop(t + 1.45);
      }
      L.hiss('lowpass', 500, 0.7, 0.4, 0.4, 0.9);
    },
  };

  // ------------------------------------------------------------------ register
  root.HeroArts = root.HeroArts || {};
  root.HeroArts.thor = {
    name: 'THOR', theme: 'asgard', looks: LOOKS, lookKey: 'thorLook', body: 1.08,
    POSES, makeRig, lerpRig, drawHero, points, drawBust, drawAvatar, drawPortrait, drawIcon, drawTray,
    cardTitle: () => 'THOR',
    callout, calloutHeight: 17, card, trail, drawWorld, worldBusy, beamColors, drawBeam, expandFx, drawEnemyOverlay,
    loop: null,
    allyLabel: null,
    avatarBg: 'rgba(120,170,255,0.22)',
    shadowTint: 'rgba(120,170,255,0.2)',
    sounds,
    voice: { prefer: /guy|david|mark|christopher|eric|daniel|alex|aaron|george|male/i, pitch: 0.82, rate: 0.95 },
    brief: { done: 'For Asgard!', snooze: (m) => `In ${m} minutes`, time: (a) => `${a.time} · BY ODIN'S DECREE`, sound: 'thunderRoll' },
    menuName: (s) => `${Math.round(s.hero.storm || 0)}% storm · ${s.hero.status}`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
