/*
 * Desktop Buddies — procedural Spider-Man (an original fan-made drawing for
 * personal use; the character belongs to Marvel), his suits and the
 * Spider-Verse looks, webs, comic speech bubbles, sounds and icons.
 *
 * Same rig idea as ironArt.js: poses return joint targets, resolve() builds the
 * skeleton (2-bone IK), lerpRig() blends. Origin = the point between his feet,
 * x forward (the caller mirrors for facing left), y down; ~95 units tall.
 * A rig can turn about a pivot (`pv`): his feet while he hangs from a web
 * (the sim puts the web's end HANG units up his body), his middle in a flip.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, abs, max, min, hypot, atan2, PI } = Math;
  const { ik, reachTo, limbPath, lerpAng } = IronArt.rig;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const P = (x, y) => ({ x, y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const rot = (p, a) => ({ x: p.x * cos(a) - p.y * sin(a), y: p.x * sin(a) + p.y * cos(a) });
  const norm = (p) => { const l = hypot(p.x, p.y) || 1; return { x: p.x / l, y: p.y / l }; };
  const lp = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
  const wrapAng = (a) => atan2(sin(a), cos(a));

  // ------------------------------------------------------------------ looks
  const RED = ['#ff4b55', '#d71f2b', '#8a0f18'];
  const BLUE = ['#4f80ec', '#2348b0', '#122a6e'];
  const BLACK = ['#50535f', '#25262f', '#0b0b10'];
  const GOLD = ['#ffe08a', '#e2a82c', '#8f5f0a'];
  const IRED = ['#ff504b', '#c81c22', '#6e0b10'];
  const WHITE = ['#ffffff', '#e6e8f0', '#a2a7b8'];
  const TEAL = ['#6ce6e8', '#24b0ba', '#0e6870'];
  const NAVY = ['#4a66da', '#1d2f8e', '#0c1442'];
  const RED2 = ['#ff5a5a', '#d01d1d', '#760a0a'];
  const NOIR = ['#7c7b80', '#46454b', '#1b1b1e'];
  const COAT = ['#55524e', '#2e2c2a', '#121211'];

  const LOOKS = {
    classic: { label: 'Classic', line: '#170a10', head: RED, front: RED, side: BLUE, arm: RED, under: BLUE, glove: RED, leg: BLUE, boot: RED, belt: RED, web: 'rgba(28,4,10,0.72)', webOn: { head: 1, front: 1, arm: 1, glove: 1, boot: 1 }, emblem: { style: 'small', color: '#161019' }, lens: '#f7f9ff', rim: '#161019' },
    symbiote: { label: 'Black suit', line: '#000000', head: BLACK, front: BLACK, side: BLACK, arm: BLACK, under: BLACK, glove: BLACK, leg: BLACK, boot: BLACK, belt: BLACK, web: null, webOn: {}, emblem: { style: 'big', color: '#f3f5fb' }, lens: '#ffffff', rim: '#0b0b10', gloss: true },
    iron: { label: 'Iron Spider', line: '#1c0608', head: IRED, front: IRED, side: GOLD, arm: IRED, under: GOLD, glove: IRED, leg: IRED, boot: GOLD, belt: GOLD, web: 'rgba(48,6,8,0.5)', webOn: { head: 1, front: 1 }, emblem: { style: 'small', color: '#f2c14e', big: 1.4 }, lens: '#f7f9ff', rim: '#1c0608', waldo: true },
    miles: { label: 'Miles', line: '#040406', head: BLACK, front: BLACK, side: BLACK, arm: BLACK, under: BLACK, glove: BLACK, leg: BLACK, boot: BLACK, belt: BLACK, web: 'rgba(235,38,50,0.92)', webOn: { head: 1, front: 1, arm: 1, glove: 1, boot: 1 }, emblem: { style: 'miles', color: '#ec2530' }, lens: '#ffffff', rim: '#040406', soles: '#ec2530' },
    gwen: { label: 'Ghost-Spider', line: '#262b3c', head: WHITE, front: WHITE, side: WHITE, arm: WHITE, under: TEAL, glove: TEAL, leg: WHITE, boot: TEAL, belt: WHITE, web: 'rgba(12,90,100,0.7)', webOn: { glove: 1, boot: 1, head: 1 }, emblem: { style: 'small', color: '#1f2333' }, lens: '#d4f6ff', rim: '#1f2333', hood: { out: WHITE, in: '#ff5fa2' }, soles: '#ff5fa2' },
    m2099: { label: '2099', line: '#060a20', head: NAVY, front: NAVY, side: NAVY, arm: NAVY, under: NAVY, glove: RED2, leg: NAVY, boot: NAVY, belt: NAVY, web: null, webOn: {}, emblem: { style: 'skull', color: '#e3201f' }, lens: '#ff4040', rim: '#060a20', fins: true, soles: '#e3201f' },
    noir: { label: 'Noir', line: '#0a0a0b', head: NOIR, front: COAT, side: COAT, arm: COAT, under: COAT, glove: NOIR, leg: NOIR, boot: COAT, belt: COAT, web: 'rgba(0,0,0,0.3)', webOn: { head: 1 }, emblem: null, lens: '#ddd8c6', rim: '#8a877e', goggles: true, coat: COAT },
  };
  const lookOf = (k) => LOOKS[k] || LOOKS.classic;

  // ------------------------------------------------------------------ poses
  // c = { t, T, phase, aim (unit, local), m: { air, charge, lean, climb, swing, eyes, h } }
  function base(T) {
    const b = 0.4 * sin(T * 2.3);
    return {
      ox: 0, oy: 0, rot: 0, pv: P(0, -48),
      hip: P(0, -43.5 + b * 0.3), lean: 0.05, headTilt: 0, turn: 0.42,
      // [near, far] — near = viewer side (drawn in front)
      legs: [{ foot: P(-4.5, -3), knee: null, bend: 1, footAng: 0 }, { foot: P(5.5, -3), knee: null, bend: 1, footAng: 0 }],
      arms: [{ hand: P(-9.5, -47 + b), elbow: null, bend: 1, open: 0, sign: 0, handAng: null }, { hand: P(10, -47.5 + b), elbow: null, bend: -1, open: 0, sign: 0, handAng: null }],
      eyes: 1, dizzy: 0, attach: 0, shadow: 1,
    };
  }
  const hOf = (c) => (c.m && c.m.h) || {};
  // the web's angle in hero-local terms (he leans so his body points up the web)
  const ropeOf = (c) => { const h = hOf(c); return (h.ropeAng || 0) * (h.facing || 1); };

  const POSES = {};

  POSES.stand = (c) => {
    const p = base(c.T);
    p.headTilt = 0.04 * sin(c.T * 0.4);
    p.legs[0].foot = P(-5, -3); p.legs[1].foot = P(6.5, -3);
    p.hip.y = -42.8;
    return p;
  };

  POSES.idleLook = (c) => {
    const p = POSES.stand(c);
    p.headTilt = -0.1 + 0.12 * sin(c.t * 1.4);
    p.turn = 0.42 + 0.3 * sin(c.t * 0.8);
    p.arms[1].hand = P(5, -46); p.arms[1].elbow = P(13, -56); // hand on the hip
    return p;
  };

  // the spider crouch: low, wide, one hand on the floor between his feet
  POSES.crouch = (c) => {
    const p = base(c.T);
    const b = 0.6 * sin(c.T * 1.7);
    p.hip = P(-3, -21 + b * 0.4);
    p.lean = 0.95;
    p.legs[0].foot = P(-13, -2.5); p.legs[0].knee = P(-1, -27); p.legs[0].footAng = 0.1;
    p.legs[1].foot = P(14, -3); p.legs[1].knee = P(19, -24);
    p.arms[0].hand = P(9, -1.5); p.arms[0].open = 1; p.arms[0].handAng = PI * 0.42; p.arms[0].bend = 1;
    p.arms[1].hand = P(20, -16); p.arms[1].open = 1; p.arms[1].handAng = PI * 0.5;
    p.headTilt = -0.85 + 0.08 * sin(c.T * 0.6);
    p.turn = 0.5;
    return p;
  };

  POSES.walk = (c) => {
    const p = base(c.T);
    const s = sin(c.phase), k = cos(c.phase);
    p.hip.y = -43 - abs(k) * 1.1;
    p.lean = 0.07;
    p.legs[0].foot = P(-1 + 9 * s, -3 - 5 * max(0, -k)); p.legs[1].foot = P(1 - 9 * s, -3 - 5 * max(0, k));
    p.legs[0].footAng = -0.25 * max(0, -k); p.legs[1].footAng = -0.25 * max(0, k);
    p.arms[0].hand = P(-8 - 6 * s, -48 + 1.4 * abs(s)); p.arms[1].hand = P(8 + 6 * s, -48 + 1.4 * abs(s));
    return p;
  };

  POSES.run = (c) => {
    const p = base(c.T);
    const ph = c.phase * 0.55, s = sin(ph), k = cos(ph);
    p.hip.y = -41 - abs(k) * 2;
    p.lean = 0.32;
    p.legs[0].foot = P(-2 + 15 * s, -3 - 11 * max(0, -k)); p.legs[1].foot = P(2 - 15 * s, -3 - 11 * max(0, k));
    p.legs[0].footAng = -0.4 * max(0, -k); p.legs[1].footAng = -0.4 * max(0, k);
    p.arms[0].hand = P(2 - 13 * s, -56 + 3 * abs(s)); p.arms[0].bend = -1;
    p.arms[1].hand = P(4 + 13 * s, -56 + 3 * abs(s)); p.arms[1].bend = -1;
    p.headTilt = -0.25;
    return p;
  };

  POSES.jump = (c) => {
    const p = base(c.T);
    p.hip = P(0, -46);
    p.lean = -0.05;
    p.legs[0].foot = P(-7, -16); p.legs[0].knee = P(4, -30);
    p.legs[1].foot = P(5, -13); p.legs[1].knee = P(14, -28);
    p.arms[0].hand = P(-17, -82); p.arms[0].open = 1;
    p.arms[1].hand = P(18, -84); p.arms[1].open = 1;
    p.headTilt = -0.2;
    p.shadow = 0.6;
    return p;
  };

  // tucked somersault; the sim says how far round he is
  POSES.flip = (c) => {
    const p = base(c.T);
    const h = hOf(c);
    p.hip = P(0, -50);
    p.lean = 0.35;
    p.legs[0].foot = P(-1, -30); p.legs[0].knee = P(11, -43);
    p.legs[1].foot = P(4, -27); p.legs[1].knee = P(15, -39);
    p.arms[0].hand = P(9, -40); p.arms[0].elbow = P(0, -56);
    p.arms[1].hand = P(13, -37); p.arms[1].elbow = P(6, -55);
    p.headTilt = 0.3;
    p.rot = h.flipRot != null && h.flipRot !== 0 ? wrapAng(h.flipRot) : wrapAng(c.t * 11);
    p.pv = P(2, -50);
    p.shadow = 0.4;
    return p;
  };

  // three-point landing: knee bent, hand on the floor, other arm back
  POSES.land = (c) => {
    const p = base(c.T);
    p.hip = P(-2, -19);
    p.lean = 0.6;
    p.legs[0].foot = P(-15, -2.5); p.legs[0].knee = P(-3, -6); p.legs[0].footAng = 0.9;
    p.legs[1].foot = P(11, -3); p.legs[1].knee = P(16, -23);
    p.arms[0].hand = P(11, -1.5); p.arms[0].open = 1; p.arms[0].handAng = PI * 0.45;
    p.arms[1].hand = P(-22, -48); p.arms[1].open = 1; p.arms[1].handAng = PI * 1.15; p.arms[1].bend = 1;
    p.headTilt = -0.55;
    return p;
  };

  // hanging from the web by the near hand (rotated so his body follows the web)
  function hangBase(c) {
    const p = base(c.T);
    const b = 0.5 * sin(c.T * 1.6);
    p.hip = P(0, -45);
    p.lean = -0.02;
    p.legs[0].foot = P(1.5, -2); p.legs[0].knee = P(6, -21);
    p.legs[1].foot = P(4, -4.5); p.legs[1].knee = P(9, -24);
    p.legs[0].footAng = 0.35; p.legs[1].footAng = 0.3;
    p.arms[0].hand = P(-2, -101); p.arms[0].handAng = -PI / 2;
    p.arms[1].hand = P(9 + b, -52); p.arms[1].open = 0.6;
    p.headTilt = 0.04;
    p.rot = ropeOf(c);
    p.pv = P(0, 0);
    p.attach = 0;
    p.shadow = 0.5;
    return p;
  }
  POSES.hang = (c) => hangBase(c);
  POSES.hangLook = (c) => {
    const p = hangBase(c);
    p.headTilt = 0.3 + 0.1 * sin(c.t * 2);
    p.turn = 0.3 + 0.35 * sin(c.t * 0.9);
    return p;
  };
  POSES.hangWave = (c) => {
    const p = hangBase(c);
    p.arms[1].hand = P(17 + 3 * sin(c.T * 9), -90); p.arms[1].open = 1; p.arms[1].handAng = -PI / 2 + 0.3 * sin(c.T * 9);
    p.turn = 0.7;
    return p;
  };

  // the swing: arm up the web, legs swinging with the motion
  POSES.swing = (c) => {
    const p = hangBase(c);
    const sw = clamp((c.m && c.m.lean) || 0, -1, 1);
    p.hip = P(-1, -46);
    p.legs[0].foot = P(3 + 9 * sw, -6 - 3 * abs(sw)); p.legs[0].knee = P(10 + 6 * sw, -24);
    p.legs[1].foot = P(-4 + 5 * sw, -11); p.legs[1].knee = P(7 + 4 * sw, -27);
    p.legs[0].footAng = 0.6; p.legs[1].footAng = 0.9;
    p.arms[1].hand = P(19, -63); p.arms[1].open = 1; p.arms[1].handAng = 0.2;
    p.headTilt = -0.25;
    return p;
  };

  // pulled up a web: both hands on it, legs trailing
  POSES.zip = (c) => {
    const p = hangBase(c);
    p.arms[0].hand = P(-2, -101);
    p.arms[1].hand = P(2.5, -99); p.arms[1].handAng = -PI / 2; p.arms[1].open = 0;
    p.legs[0].foot = P(-3, -1); p.legs[0].knee = P(0, -22);
    p.legs[1].foot = P(-6, -4); p.legs[1].knee = P(1, -24);
    p.headTilt = -0.3;
    return p;
  };

  // upside-down from a thread stuck to his feet, arms crossed
  POSES.hangUpside = (c) => {
    const p = base(c.T);
    const b = 0.6 * sin(c.T * 1.3);
    p.hip = P(0, -44);
    p.lean = 0;
    p.legs[0].foot = P(-0.8, -0.5); p.legs[1].foot = P(1.2, -0.8);
    p.legs[0].knee = P(1.5, -22); p.legs[1].knee = P(3, -22.5);
    p.legs[0].footAng = -PI / 2 + 0.2; p.legs[1].footAng = -PI / 2 + 0.2;
    p.arms[0].hand = P(7, -61 + b * 0.3); p.arms[0].elbow = P(-5, -58);
    p.arms[1].hand = P(-4, -63 + b * 0.3); p.arms[1].elbow = P(13, -60);
    p.headTilt = 0.05;
    p.turn = 0.62;
    p.rot = PI + ropeOf(c) * 0.5;
    p.pv = P(0, 0);
    p.attach = 2;
    p.shadow = 0.3;
    return p;
  };
  POSES.sleepUpside = (c) => {
    const p = POSES.hangUpside(c);
    p.eyes = 0.12;
    p.headTilt = 0.18 + 0.05 * sin(c.T * 0.9);
    return p;
  };

  // shooting a web (on the floor, or hanging by the other hand)
  POSES.webShot = (c) => {
    const air = c.m && c.m.air;
    const p = air ? hangBase(c) : base(c.T);
    const ra = air ? p.rot : 0;
    const a = rot(c.aim || P(1, 0), -ra);
    if (air) {
      p.arms[1].hand = P(2, -101); p.arms[1].handAng = -PI / 2; p.arms[1].open = 0;
      p.attach = 1;
    } else {
      p.legs[0].foot = P(-10, -3); p.legs[1].foot = P(9, -3);
      p.hip.y = -41;
      p.arms[1].hand = P(-11, -55); p.arms[1].bend = 1;
      p.lean = clamp(a.y * 0.12, -0.12, 0.12) + 0.05;
    }
    const arm = p.arms[0];
    arm.hand = add(P(-6, -71), mul(a, 27));
    arm.sign = 1; arm.handAng = atan2(a.y, a.x); arm.bend = a.y < 0 ? -1 : 1;
    p.headTilt = clamp(atan2(a.y, max(0.2, a.x)) * 0.5, -0.4, 0.35);
    return p;
  };

  // both hands forward: throwing an impact web
  POSES.webBoth = (c) => {
    const p = base(c.T);
    const a = c.aim || P(1, 0);
    p.legs[0].foot = P(-11, -3); p.legs[1].foot = P(10, -3);
    p.hip.y = -40;
    p.lean = 0.12;
    const tip = add(P(0, -68), mul(a, 25));
    p.arms[0].hand = add(tip, P(-1, 2.5)); p.arms[1].hand = add(tip, P(1, -2.5));
    for (const arm of p.arms) { arm.sign = 1; arm.handAng = atan2(a.y, a.x); arm.bend = -1; }
    p.headTilt = clamp(atan2(a.y, max(0.2, a.x)) * 0.5, -0.4, 0.35);
    return p;
  };

  POSES.punch = (c) => {
    const p = base(c.T);
    const k = clamp(c.t / 0.12, 0, 1);
    p.lean = 0.22 * k;
    p.legs[0].foot = P(-11, -3); p.legs[1].foot = P(9, -3);
    p.hip.y = -41;
    p.arms[0].hand = lp(P(-4, -60), P(25, -67), k);
    p.arms[1].hand = P(4, -70); p.arms[1].bend = -1;
    p.headTilt = -0.05;
    return p;
  };

  POSES.punch2 = (c) => {
    const p = base(c.T);
    const k = clamp(c.t / 0.12, 0, 1);
    p.lean = 0.24 * k;
    p.legs[0].foot = P(-11, -3); p.legs[1].foot = P(9, -3);
    p.hip.y = -41;
    p.arms[1].hand = lp(P(6, -62), P(27, -69), k); p.arms[1].bend = -1;
    p.arms[0].hand = P(-8, -60);
    p.headTilt = -0.05;
    return p;
  };

  POSES.kick = (c) => {
    const p = base(c.T);
    const k = clamp(c.t / 0.12, 0, 1);
    p.lean = -0.28 * k;
    p.legs[0].foot = lp(P(-4, -3), P(25, -56), k); p.legs[0].knee = k > 0.5 ? lp(P(6, -46), P(10, -47), k) : null; p.legs[0].footAng = -0.6 * k;
    p.legs[1].foot = P(-3, -3);
    p.arms[0].hand = P(-17, -64); p.arms[0].open = 1;
    p.arms[1].hand = P(9, -79); p.arms[1].bend = -1;
    p.headTilt = 0.05;
    return p;
  };

  // pulled along a web feet-first into an enemy
  POSES.zipKick = (c) => {
    const p = base(c.T);
    p.hip = P(0, -44);
    p.lean = -0.55;
    p.legs[0].foot = P(29, -36); p.legs[0].knee = P(14, -42); p.legs[0].footAng = -1.2;
    p.legs[1].foot = P(18, -26); p.legs[1].knee = P(9, -37); p.legs[1].footAng = -0.9;
    p.arms[0].hand = P(12, -92); p.arms[0].open = 1; p.arms[0].handAng = -1.1;
    p.arms[1].hand = P(-19, -58); p.arms[1].open = 1;
    p.headTilt = 0.25;
    p.rot = 0.35;
    p.attach = 0;
    p.shadow = 0.4;
    return p;
  };

  // leaning back, hauling on a web
  POSES.yank = (c) => {
    const p = base(c.T);
    p.hip = P(-3, -39);
    p.lean = -0.42;
    p.legs[0].foot = P(-14, -3); p.legs[1].foot = P(12, -3); p.legs[1].knee = P(12, -21);
    p.arms[0].hand = P(7, -62); p.arms[0].bend = -1;
    p.arms[1].hand = P(11, -59); p.arms[1].bend = -1;
    p.headTilt = -0.15;
    p.attach = 0;
    return p;
  };

  // whirling something round on a web over his head
  POSES.spinThrow = (c) => {
    const p = base(c.T);
    p.hip.y = -41;
    p.legs[0].foot = P(-12, -3); p.legs[1].foot = P(12, -3);
    p.arms[0].hand = P(-1 + 5 * cos(c.T * 14), -100 + 2 * sin(c.T * 14)); p.arms[0].handAng = -PI / 2;
    p.arms[1].hand = P(17, -59); p.arms[1].open = 1;
    p.lean = -0.1;
    p.headTilt = -0.35;
    p.attach = 0;
    return p;
  };

  // the web-shooter hand sign
  POSES.thwip = (c) => {
    const p = base(c.T);
    const k = clamp(c.t / 0.3, 0, 1);
    p.arms[0].hand = lp(P(-9.5, -47), P(15, -72), k); p.arms[0].sign = k; p.arms[0].handAng = lerp(0, -0.35, k); p.arms[0].bend = -1;
    p.arms[1].hand = P(6, -45); p.arms[1].elbow = P(14, -55);
    p.legs[0].foot = P(-6, -3); p.legs[1].foot = P(7, -3);
    p.turn = 0.78;
    p.headTilt = -0.08;
    return p;
  };

  POSES.wave = (c) => {
    const p = base(c.T);
    const k = clamp(c.t / 0.3, 0, 1);
    p.arms[0].hand = lp(P(-9.5, -47), P(8 + 4 * sin(c.T * 10), -97), k); p.arms[0].open = 1; p.arms[0].handAng = -PI / 2 + 0.3 * sin(c.T * 10);
    p.turn = 0.72;
    return p;
  };

  POSES.brace = (c) => {
    const p = base(c.T);
    p.hip.y = -33;
    p.lean = 0.2;
    p.legs[0].foot = P(-11, -3); p.legs[1].foot = P(10, -3);
    p.arms[0].hand = P(8, -72); p.arms[1].hand = P(4, -76);
    p.arms[0].bend = -1; p.arms[1].bend = 1;
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2;
    p.headTilt = 0.3;
    return p;
  };

  POSES.stagger = (c) => {
    const p = base(c.T);
    p.lean = -0.3;
    p.arms[0].hand = P(4, -74); p.arms[0].open = 1; p.arms[1].hand = P(12, -71); p.arms[1].open = 1;
    p.legs[0].foot = P(-9, -6); p.legs[1].foot = P(8, -3);
    p.headTilt = -0.25;
    return p;
  };

  POSES.down = (c) => {
    const p = base(c.T);
    p.rot = -1.5;
    p.pv = P(0, -43.5);
    p.oy = 38; p.ox = 6;
    p.arms[0].hand = P(-17, -38); p.arms[0].open = 1; p.arms[1].hand = P(16, -44); p.arms[1].open = 1;
    p.legs[0].foot = P(-6, -3); p.legs[1].foot = P(6, -7);
    p.eyes = c.m && c.m.eyes != null ? c.m.eyes : 0.35;
    p.dizzy = 1;
    p.shadow = 1.4;
    return p;
  };

  POSES.held = (c) => {
    const p = base(c.T);
    const f = sin(c.T * 7), g = sin(c.T * 5.3);
    p.hip.y = -44;
    p.legs[0].foot = P(-4 + 4 * f, -4); p.legs[1].foot = P(4 - 4 * f, -7);
    p.legs[0].footAng = 0.6; p.legs[1].footAng = 0.8;
    p.arms[0].hand = P(-16, -64 + 5 * g); p.arms[1].hand = P(16, -66 - 5 * g);
    p.arms[0].open = p.arms[1].open = 1;
    p.headTilt = -0.12;
    p.rot = (c.m && c.m.swing) || 0;
    p.pv = P(0, -100);
    p.shadow = 0;
    return p;
  };

  POSES.sit = (c) => {
    const p = base(c.T);
    p.hip = P(-2, -9);
    p.lean = 0.15;
    p.legs[0].foot = P(12, -2); p.legs[0].knee = P(8, -18);
    p.legs[1].foot = P(-4, -2); p.legs[1].knee = P(13, -15);
    p.arms[0].hand = P(9, -19); p.arms[1].hand = P(13, -17);
    p.headTilt = 0.3;
    p.eyes = 0.15;
    return p;
  };

  // the armored hero's pose names, for anything the shared code asks for
  const ALIAS = { hover: 'hang', flyUp: 'zip', fly: 'swing', aim: 'webShot', blast: 'webBoth', unibeam: 'webBoth', missile: 'webBoth', gauntlet: 'idleLook', thumbsUp: 'thwip', salute: 'wave', powerDown: 'sleepUpside' };

  // ------------------------------------------------------------------ resolve & blend
  const THIGH = 19.5, SHIN = 22, UPPER = 14, FORE = 13.5;

  function resolve(p) {
    const L = p.lean;
    const hip = p.hip;
    const chest = add(hip, rot(P(0.5, -22), L));
    const neck = add(hip, rot(P(0.8, -31.5), L));
    const head = add(hip, rot(P(1.6, -40.8), L));
    const sh = [add(hip, rot(P(-8.4, -28.6), L)), add(hip, rot(P(8, -29.4), L))];
    const hp = [add(hip, P(-3.6, 0)), add(hip, P(3.8, -0.6))];
    const arms = p.arms.map((a, i) => {
      const hand = reachTo(sh[i], a.hand, UPPER + FORE - 0.2);
      const elbow = a.elbow ? a.elbow : ik(sh[i], hand, UPPER, FORE, a.bend);
      const ang = a.handAng == null ? atan2(hand.y - elbow.y, hand.x - elbow.x) : a.handAng;
      return { sh: sh[i], elbow, hand, ang, open: a.open || 0, sign: a.sign || 0 };
    });
    const legs = p.legs.map((l, i) => {
      const foot = reachTo(hp[i], l.foot, THIGH + SHIN - 0.2);
      const knee = l.knee ? l.knee : ik(hp[i], foot, THIGH, SHIN, l.bend);
      return { hip: hp[i], knee, foot, ang: l.footAng || 0 };
    });
    return {
      ox: p.ox, oy: p.oy, rot: p.rot, pv: p.pv, lean: L, headTilt: p.headTilt, turn: p.turn,
      hip, chest, neck, head, arms, legs, eyes: p.eyes, dizzy: p.dizzy, attach: p.attach, shadow: p.shadow,
    };
  }

  function lerpRig(a, b, k) {
    if (k >= 1) return b;
    if (k <= 0) return a;
    const o = { attach: k < 0.5 ? a.attach : b.attach };
    for (const key of ['ox', 'oy', 'lean', 'headTilt', 'turn', 'eyes', 'dizzy', 'shadow']) o[key] = lerp(a[key], b[key], k);
    o.rot = lerpAng(a.rot, b.rot, k);
    for (const key of ['pv', 'hip', 'chest', 'neck', 'head']) o[key] = lp(a[key], b[key], k);
    o.arms = a.arms.map((x, i) => {
      const y = b.arms[i];
      return { sh: lp(x.sh, y.sh, k), elbow: lp(x.elbow, y.elbow, k), hand: lp(x.hand, y.hand, k), ang: lerpAng(x.ang, y.ang, k), open: lerp(x.open, y.open, k), sign: lerp(x.sign, y.sign, k) };
    });
    o.legs = a.legs.map((x, i) => {
      const y = b.legs[i];
      return { hip: lp(x.hip, y.hip, k), knee: lp(x.knee, y.knee, k), foot: lp(x.foot, y.foot, k), ang: lerp(x.ang, y.ang, k) };
    });
    return o;
  }

  function makeRig(name, c) {
    c.m = c.m || {};
    const fn = POSES[name] || POSES[ALIAS[name]] || POSES.stand;
    return resolve(fn(c));
  }

  // ------------------------------------------------------------------ drawing helpers
  function grad(ctx, x1, y1, x2, y2, cols) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
    return g;
  }

  const dim = (c, far) => (far ? [c[1], c[1], c[2]] : c);

  // a tapered capsule with a gradient across it
  function limb(ctx, a, b, w1, w2, cols, line) {
    limbPath(ctx, a, b, w1, w2);
    const d = norm(sub(b, a)), n = P(-d.y, d.x), m = lp(a, b, 0.5);
    ctx.fillStyle = grad(ctx, m.x - n.x * w1 / 2, m.y - n.y * w1 / 2, m.x + n.x * w1 / 2, m.y + n.y * w1 / 2, cols);
    ctx.fill();
    if (line) { ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke(); }
  }

  // web lines on a limb: a seam down the middle and rings across
  function webLimb(ctx, a, b, w1, w2, col) {
    if (!col) return;
    ctx.save();
    limbPath(ctx, a, b, w1, w2);
    ctx.clip();
    const d = norm(sub(b, a)), n = P(-d.y, d.x), L = hypot(b.x - a.x, b.y - a.y);
    ctx.strokeStyle = col; ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    for (let s = 2.4; s < L + 2; s += 3.1) {
      const c = add(a, mul(d, s)), w = lerp(w1, w2, s / L) * 0.6;
      ctx.moveTo(c.x + n.x * w, c.y + n.y * w);
      ctx.quadraticCurveTo(c.x + d.x * 1.1, c.y + d.y * 1.1, c.x - n.x * w, c.y - n.y * w);
    }
    ctx.stroke();
    ctx.restore();
  }

  // web lines radiating from (cx, cy) over the current clip
  function webRadial(ctx, cx, cy, r, col, spokes, rings, sq, lw) {
    ctx.strokeStyle = col; ctx.lineWidth = 0.42 * (lw || 1);
    ctx.beginPath();
    for (let i = 0; i < spokes; i++) { const a = i * TAU / spokes + 0.2; ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(a) * r, cy + sin(a) * r * (sq || 1)); }
    for (let j = 1; j <= rings; j++) {
      const rr = (r * j) / (rings + 0.4);
      for (let i = 0; i <= spokes; i++) {
        const a = i * TAU / spokes + 0.2, a0 = (i - 1) * TAU / spokes + 0.2;
        const x = cx + cos(a) * rr, y = cy + sin(a) * rr * (sq || 1);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const am = (a + a0) / 2, k = rr * 0.86;
          ctx.quadraticCurveTo(cx + cos(am) * k, cy + sin(am) * k * (sq || 1), x, y);
        }
      }
    }
    ctx.stroke();
  }

  function spider(ctx, x, y, k, col, style) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (style === 'skull') {
      // a 2099-style spider skull: wide head, long legs down the chest
      ctx.beginPath(); ctx.moveTo(-3.2, -3.4); ctx.quadraticCurveTo(0, -6.2, 3.2, -3.4); ctx.lineTo(2.2, 0.6); ctx.lineTo(0, 2.6); ctx.lineTo(-2.2, 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(6,10,32,0.9)';
      ctx.beginPath(); ctx.ellipse(-1.2, -2.4, 0.8, 0.6, 0.3, 0, TAU); ctx.ellipse(1.2, -2.4, 0.8, 0.6, -0.3, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const sgn of [-1, 1]) {
        ctx.moveTo(sgn * 2.6, -3); ctx.quadraticCurveTo(sgn * 6.5, -6, sgn * 8.5, -2.5);
        ctx.moveTo(sgn * 2.2, -0.5); ctx.quadraticCurveTo(sgn * 6, 1, sgn * 7, 6);
        ctx.moveTo(sgn * 1.4, 1.2); ctx.quadraticCurveTo(sgn * 3.4, 6, sgn * 3.6, 12);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    const big = style === 'big';
    // body + head
    ctx.beginPath(); ctx.ellipse(0, 0.9, 0.95, 1.6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -1.2, 0.7, 0.75, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = big ? 0.55 : 0.42;
    ctx.beginPath();
    for (const sgn of [-1, 1]) {
      // four legs a side: two up, two down
      ctx.moveTo(sgn * 0.5, -1.2); ctx.lineTo(sgn * 2.3, -2.8); ctx.lineTo(sgn * (big ? 3.4 : 2.6), big ? -6.2 : -4.8);
      ctx.moveTo(sgn * 0.6, -0.8); ctx.lineTo(sgn * 2.8, -1.4); ctx.lineTo(sgn * (big ? 4.6 : 3.6), big ? -3.8 : -3);
      ctx.moveTo(sgn * 0.6, 0.2); ctx.lineTo(sgn * 2.8, 1); ctx.lineTo(sgn * (big ? 4.6 : 3.6), big ? 3.6 : 2.8);
      ctx.moveTo(sgn * 0.5, 0.9); ctx.lineTo(sgn * 2.2, 2.6); ctx.lineTo(sgn * (big ? 3.4 : 2.6), big ? 6.6 : 4.8);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ body parts
  function drawLeg(ctx, Lg, L, far) {
    const leg = dim(L.leg, far), boot = dim(L.boot, far);
    limb(ctx, Lg.hip, Lg.knee, 8.6, 6.9, leg, L.line);
    limb(ctx, Lg.knee, Lg.foot, 6.9, 5.4, leg, L.line);
    // the boot: from halfway down the shin
    const bk = lp(Lg.knee, Lg.foot, 0.4);
    if (boot !== leg) {
      limb(ctx, bk, Lg.foot, 6.4, 5.5, boot, L.line);
      if (L.webOn.boot) webLimb(ctx, bk, Lg.foot, 6.4, 5.5, L.web);
    } else if (L.webOn.leg) webLimb(ctx, Lg.knee, Lg.foot, 6.9, 5.4, L.web);
    ctx.beginPath(); ctx.arc(Lg.knee.x, Lg.knee.y, 3.3, 0, TAU);
    ctx.fillStyle = leg[1]; ctx.fill();
    // foot
    ctx.save();
    ctx.translate(Lg.foot.x, Lg.foot.y);
    ctx.rotate(Lg.ang);
    ctx.beginPath();
    ctx.moveTo(-2.8, -1.8); ctx.lineTo(2.2, -2.1); ctx.quadraticCurveTo(6.4, -0.8, 6.8, 2.4);
    ctx.lineTo(-3, 2.9); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -2, 0, 3, boot); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.line; ctx.stroke();
    if (L.soles) { ctx.fillStyle = L.soles; ctx.fillRect(-2.8, 2.1, 9.4, 0.9); }
    ctx.restore();
  }

  function drawHand(ctx, A, cols, L) {
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    ctx.rotate(A.ang);
    ctx.lineWidth = 0.9; ctx.strokeStyle = L.line;
    ctx.fillStyle = grad(ctx, 0, -3, 0, 3, cols);
    if (A.sign > 0.5) {
      // the thwip sign: index and pinky out, middle fingers folded on the web-shooter
      ctx.beginPath(); ctx.ellipse(1.6, 0, 2.7, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2] of [[3, -1.8, 7.4, -2.6], [3, 1.9, 6.6, 2.9], [1.4, -2.4, 2.9, -5]]) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.lineWidth = 2.2; ctx.strokeStyle = L.line; ctx.stroke();
        ctx.lineWidth = 1.3; ctx.strokeStyle = cols[0]; ctx.stroke();
      }
      ctx.fillStyle = 'rgba(230,236,255,0.9)';
      ctx.beginPath(); ctx.arc(1.6, 0.1, 0.8, 0, TAU); ctx.fill();
    } else if (A.open > 0.5) {
      ctx.beginPath();
      ctx.moveTo(-1, -2.7); ctx.lineTo(4.6, -2.6); ctx.quadraticCurveTo(7.3, -1.6, 7.2, 0);
      ctx.quadraticCurveTo(7.2, 1.8, 4.6, 2.6); ctx.lineTo(-1, 2.7); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.moveTo(4.2, -0.9); ctx.lineTo(7, -0.9); ctx.moveTo(4.2, 0.9); ctx.lineTo(7, 0.9); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-1, -2.8); ctx.lineTo(2.8, -2.9); ctx.quadraticCurveTo(5.3, -2.8, 5.3, 0);
      ctx.quadraticCurveTo(5.3, 2.9, 2.8, 2.9); ctx.lineTo(-1, 2.8); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawArm(ctx, A, L, far) {
    const arm = dim(L.arm, far), under = dim(L.under, far), glove = dim(L.glove, far);
    limb(ctx, A.sh, A.elbow, 6.8, 5.8, arm, L.line);
    limb(ctx, A.elbow, A.hand, 5.8, 5.1, arm, L.line);
    // the stripe down the underside
    if (L.under !== L.arm) {
      const d1 = norm(sub(A.elbow, A.sh)), n1 = P(-d1.y, d1.x);
      limb(ctx, add(A.sh, mul(n1, -1.7)), add(A.elbow, mul(n1, -1.5)), 2.6, 2.2, under, null);
      const d2 = norm(sub(A.hand, A.elbow)), n2 = P(-d2.y, d2.x);
      limb(ctx, add(A.elbow, mul(n2, -1.4)), add(lp(A.elbow, A.hand, 0.6), mul(n2, -1.2)), 2.2, 1.8, under, null);
    }
    // glove cuff
    const cuff = lp(A.elbow, A.hand, 0.62);
    if (L.glove !== L.arm) limb(ctx, cuff, A.hand, 5.4, 5.1, glove, L.line);
    if (L.webOn.arm) { webLimb(ctx, A.sh, A.elbow, 6.8, 5.8, L.web); webLimb(ctx, A.elbow, A.hand, 5.8, 5.1, L.web); }
    else if (L.webOn.glove) webLimb(ctx, cuff, A.hand, 5.4, 5.1, L.web);
    if (L.fins) {
      // 2099 forearm fins
      const d2 = norm(sub(A.hand, A.elbow)), n2 = P(-d2.y, d2.x), m = lp(A.elbow, A.hand, 0.45);
      ctx.beginPath();
      ctx.moveTo(m.x - n2.x * 2.6, m.y - n2.y * 2.6);
      ctx.lineTo(m.x - n2.x * 6 - d2.x * 4, m.y - n2.y * 6 - d2.y * 4);
      ctx.lineTo(m.x - n2.x * 2.6 + d2.x * 4, m.y - n2.y * 2.6 + d2.y * 4);
      ctx.closePath();
      ctx.fillStyle = far ? '#9a1414' : '#e3201f'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(A.elbow.x, A.elbow.y, 2.7, 0, TAU); ctx.fillStyle = arm[1]; ctx.fill();
    drawHand(ctx, A, glove, L);
    // shoulder
    ctx.beginPath(); ctx.ellipse(A.sh.x, A.sh.y - 0.3, 4.4, 3.9, 0, 0, TAU);
    ctx.fillStyle = grad(ctx, A.sh.x, A.sh.y - 4, A.sh.x, A.sh.y + 4, arm); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.line; ctx.stroke();
    if (L.webOn.arm) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(A.sh.x, A.sh.y - 0.3, 4.4, 3.9, 0, 0, TAU); ctx.clip();
      webRadial(ctx, A.sh.x + 1, A.sh.y - 3, 7, L.web, 6, 2);
      ctx.restore();
    }
  }

  function torsoPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-6.8, 1);
    ctx.lineTo(-6.3, -10);
    ctx.quadraticCurveTo(-7.9, -16, -9.6, -22.5);
    ctx.quadraticCurveTo(-10.4, -27.6, -8.4, -30.2);
    ctx.lineTo(-3.4, -32.4); ctx.lineTo(3.6, -32.4); ctx.lineTo(9, -30.4);
    ctx.quadraticCurveTo(11.2, -27.4, 10.4, -22.5);
    ctx.bezierCurveTo(10, -17.5, 7.4, -15, 6.6, -10);
    ctx.lineTo(6.9, 1);
    ctx.closePath();
  }

  function drawTorso(ctx, R, L) {
    ctx.save();
    ctx.translate(R.hip.x, R.hip.y);
    ctx.rotate(R.lean);
    const f = 2.2 * (R.turn - 0.35) / 0.65 + 1;
    if (L.waldo) {
      // the Iron Spider's folded mechanical legs on his back
      ctx.strokeStyle = '#6b4a0c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, -25); ctx.lineTo(-14, -36); ctx.lineTo(-18, -27);
      ctx.moveTo(-6, -21); ctx.lineTo(-16, -26); ctx.lineTo(-19, -16);
      ctx.stroke();
      ctx.strokeStyle = GOLD[1]; ctx.lineWidth = 1.3; ctx.stroke();
    }
    // pelvis
    ctx.beginPath();
    ctx.moveTo(-7, -2); ctx.lineTo(7.2, -2); ctx.lineTo(6.4, 4.4); ctx.lineTo(-6.4, 4.4); ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -2, 0, 4.4, L.leg); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.line; ctx.stroke();
    // body: the sides, then the front panel on the side he faces
    torsoPath(ctx);
    ctx.fillStyle = grad(ctx, -10, -31, 10, -2, L.side); ctx.fill();
    ctx.save();
    torsoPath(ctx);
    ctx.clip();
    if (L.front !== L.side) {
      ctx.beginPath();
      ctx.moveTo(f - 4, 2); ctx.quadraticCurveTo(f - 7.6, -14, f - 8.6, -34);
      ctx.lineTo(20, -34); ctx.lineTo(20, 2); ctx.closePath();
      ctx.fillStyle = grad(ctx, f - 8, -32, 12, -4, L.front); ctx.fill();
    }
    if (L.webOn.front) webRadial(ctx, f + 0.6, -21, 26, L.web, 12, 5, 1.1);
    if (L.gloss) {
      ctx.fillStyle = 'rgba(160,180,255,0.12)';
      ctx.beginPath(); ctx.ellipse(f + 2, -24, 4, 7, -0.3, 0, TAU); ctx.fill();
    }
    // belt
    if (L.belt !== L.side || L.belt !== L.front) {
      ctx.fillStyle = grad(ctx, 0, -3.4, 0, 0.6, L.belt);
      ctx.fillRect(-12, -3.4, 24, 3.6);
    }
    // muscle shading
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(f - 3.8, -17.5); ctx.quadraticCurveTo(f + 1, -15.2, f + 6.5, -17.5);
    ctx.moveTo(f + 0.8, -15); ctx.lineTo(f + 0.6, -4);
    ctx.stroke();
    if (L.coat) {
      // noir: a dark jacket with lapels and a belt
      ctx.fillStyle = grad(ctx, -10, -31, 10, -2, L.coat); ctx.fillRect(-14, -34, 30, 38);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.moveTo(f - 1.5, -32); ctx.lineTo(f + 3.5, -22); ctx.lineTo(f + 0.5, -32); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(f + 3.5, -22); ctx.lineTo(f + 2.6, -3); ctx.stroke();
      ctx.fillStyle = '#0c0c0d'; ctx.fillRect(-12, -6, 24, 2.6);
      ctx.fillStyle = '#8a877e'; ctx.fillRect(f + 1.6, -6.2, 2.4, 3);
    }
    ctx.restore();
    if (L.emblem) {
      const E = L.emblem;
      if (E.style === 'big') spider(ctx, f + 0.4, -21, 1.9, E.color, 'big');
      else if (E.style === 'skull') spider(ctx, f + 0.4, -22, 1.15, E.color, 'skull');
      else spider(ctx, f + 0.6, -21.5, E.style === 'miles' ? 1.25 : 1.05 * (E.big || 1), E.color, 'small');
    }
    torsoPath(ctx);
    ctx.lineWidth = 1.1; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.restore();
  }

  function maskPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-7.2, 0.5);
    ctx.bezierCurveTo(-7.9, -6.6, -3.8, -9.8, 0.6, -9.6);
    ctx.bezierCurveTo(5.6, -9.4, 8.2, -5.6, 7.8, 0.4);
    ctx.lineTo(6.9, 5);
    ctx.quadraticCurveTo(4.2, 9.2, 0.2, 9.2);
    ctx.quadraticCurveTo(-4.4, 8.9, -6.4, 5.4);
    ctx.closePath();
  }

  // one big eye lens: m = +1 the one on the face's right, -1 the left; open 0..1
  function lensPath(ctx, cx, cy, k, m, open) {
    const o = Math.max(0.08, open);
    ctx.beginPath();
    ctx.moveTo(cx - m * 1.4 * k, cy + 2.2 * k * o);
    ctx.bezierCurveTo(cx - m * 2.4 * k, cy + 0.2 * k * o, cx - m * 1.5 * k, cy - 2.6 * k * o, cx + m * 0.6 * k, cy - 2.9 * k * o);
    ctx.bezierCurveTo(cx + m * 2.3 * k, cy - 3.1 * k * o, cx + m * 3.1 * k, cy - 1.6 * k * o, cx + m * 2.7 * k, cy + 0.4 * k * o);
    ctx.bezierCurveTo(cx + m * 2.2 * k, cy + 2.3 * k * o, cx + m * 0.2 * k, cy + 3.1 * k * o, cx - m * 1.4 * k, cy + 2.2 * k * o);
    ctx.closePath();
  }

  // the masked head (in head space). f = how far the face is turned toward +x; frontal = facing the viewer
  function drawMask(ctx, L, f, eyes, T, lw) {
    lw = lw || 1;
    if (L.hood) {
      // Gwen's hood around the mask
      ctx.beginPath();
      ctx.moveTo(-9.6, 7); ctx.bezierCurveTo(-11.6, -6, -6, -12.4, 0.6, -12.2);
      ctx.bezierCurveTo(7.2, -12, 10.6, -6.4, 10, 1.6); ctx.lineTo(9, 9); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fillStyle = grad(ctx, -10, -12, 10, 10, L.hood.out); ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = L.line; ctx.stroke();
      ctx.save(); maskPath(ctx); ctx.lineWidth = 3.2; ctx.strokeStyle = L.hood.in; ctx.stroke(); ctx.restore();
    }
    maskPath(ctx);
    ctx.fillStyle = grad(ctx, -8, -10, 8, 9, L.head); ctx.fill();
    if (L.web && L.webOn.head) {
      ctx.save();
      maskPath(ctx); ctx.clip();
      webRadial(ctx, f * 0.9 + 0.2, 1.4, 15, L.web, 12, 4, 1.05, lw);
      ctx.restore();
    }
    if (L.gloss) {
      ctx.fillStyle = 'rgba(170,190,255,0.16)';
      ctx.beginPath(); ctx.ellipse(-2.4, -5.6, 3.6, 2.2, -0.4, 0, TAU); ctx.fill();
    }
    maskPath(ctx);
    ctx.lineWidth = 1.1 * lw; ctx.strokeStyle = L.line; ctx.stroke();
    // the lenses: the far one is foreshortened as he turns
    const turn = clamp(f / 4, -1, 1);
    const open = eyes == null ? 1 : eyes;
    const lx = f - 2.7 + turn * 0.6, rx = f + 3.1 + turn * 0.2, ly = -1.2;
    const kL = 1.05 * (1 - 0.18 * max(0, turn)), kR = 1.05 * (1 - 0.18 * max(0, -turn));
    for (const [cx, k, m] of [[lx, kL, -1], [rx, kR, 1]]) {
      if (L.goggles) {
        ctx.beginPath(); ctx.ellipse(cx, ly, 2.7 * k, 2.6 * k * max(0.25, open), 0, 0, TAU);
        ctx.fillStyle = L.rim; ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, ly, 2 * k, 1.9 * k * max(0.2, open), 0, 0, TAU);
        const g = ctx.createRadialGradient(cx - 0.6, ly - 0.6, 0.2, cx, ly, 2.2 * k);
        g.addColorStop(0, '#fffdf2'); g.addColorStop(1, L.lens);
        ctx.fillStyle = g; ctx.fill();
        continue;
      }
      lensPath(ctx, cx, ly, k * 1.22, m, open);
      ctx.fillStyle = L.rim; ctx.fill();
      lensPath(ctx, cx + m * 0.15, ly + 0.05, k * 0.92, m, open);
      ctx.fillStyle = L.lens; ctx.fill();
      if (open > 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.ellipse(cx + m * 0.4 * k, ly - 1.4 * k * open, 0.9 * k, 0.45 * k, m * 0.5, 0, TAU); ctx.fill();
      }
    }
    if (L.goggles) {
      ctx.strokeStyle = L.rim; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(lx + 2.4, ly); ctx.lineTo(rx - 2.4, ly); ctx.moveTo(lx - 2.6, ly); ctx.lineTo(-7.4, ly - 0.6); ctx.stroke();
    }
    void T;
  }

  function drawHead(ctx, R, L, T) {
    ctx.save();
    ctx.translate(R.head.x, R.head.y);
    ctx.rotate(R.lean + R.headTilt);
    const f = 1.6 + 2.6 * (R.turn - 0.35) / 0.65;
    ctx.fillStyle = L.head[2]; ctx.fillRect(-2.6, 6, 5.2, 4.5);
    drawMask(ctx, L, f, R.eyes, T);
    ctx.restore();
  }

  function stars(ctx, R, T) {
    for (let i = 0; i < 3; i++) {
      const a = T * 4 + (i * TAU) / 3;
      const x = R.head.x + cos(a) * 11, y = R.head.y - 12 + sin(a) * 3;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(T * 3 + i);
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const r = j % 2 ? 1.1 : 2.6, b = (j * PI) / 5; ctx.lineTo(cos(b) * r, sin(b) * r); }
      ctx.closePath();
      ctx.fillStyle = '#ffd84d'; ctx.fill();
      ctx.lineWidth = 0.5; ctx.strokeStyle = '#a07a00'; ctx.stroke();
      ctx.restore();
    }
  }

  function drawCoatTails(ctx, R, L) {
    ctx.save();
    ctx.translate(R.hip.x, R.hip.y);
    ctx.rotate(R.lean * 0.6);
    ctx.beginPath();
    ctx.moveTo(-7.4, -2); ctx.lineTo(7.4, -2); ctx.lineTo(9.5, 17); ctx.quadraticCurveTo(0, 19, -9.5, 17.5); ctx.closePath();
    ctx.fillStyle = grad(ctx, -9, 0, 9, 18, L.coat); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = L.line; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ the hero
  function drawHero(ctx, R, opts) {
    opts = opts || {};
    const L = lookOf(opts.look || opts.suit);
    const T = opts.T || 0;
    ctx.save();
    ctx.translate(R.ox, R.oy);
    if (R.rot) { ctx.translate(R.pv.x, R.pv.y); ctx.rotate(R.rot); ctx.translate(-R.pv.x, -R.pv.y); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawLeg(ctx, R.legs[1], L, true);
    drawArm(ctx, R.arms[1], L, true);
    if (L.coat) drawCoatTails(ctx, R, L);
    drawTorso(ctx, R, L);
    drawLeg(ctx, R.legs[0], L, false);
    drawHead(ctx, R, L, T);
    drawArm(ctx, R.arms[0], L, false);
    if (R.dizzy > 0.5) stars(ctx, R, T);
    ctx.restore();
  }

  // world-local points for effects (after the pivot turn and offset)
  function points(R) {
    const tr = (p) => {
      let q = { x: p.x, y: p.y };
      if (R.rot) q = add(R.pv, rot(sub(q, R.pv), R.rot));
      return { x: q.x + R.ox, y: q.y + R.oy };
    };
    const f = 1.6 + 2.6 * (R.turn - 0.35) / 0.65;
    const handOf = (A) => P(A.hand.x + cos(A.ang) * 2, A.hand.y + sin(A.ang) * 2);
    const hand = R.attach === 2 ? lp(R.legs[0].foot, R.legs[1].foot, 0.5) : handOf(R.arms[R.attach || 0]);
    return {
      hand: tr(hand),
      palms: R.arms.map((A) => tr(P(A.hand.x + cos(A.ang) * 4.5, A.hand.y + sin(A.ang) * 4.5))),
      head: tr(R.head),
      eyes: tr(add(R.head, rot(P(f + 0.4, -1.2), R.lean + R.headTilt))),
      reactor: tr(add(R.hip, rot(P(f * 0.3 + 0.8, -21), R.lean))),
      hip: tr(R.hip),
    };
  }

  // ------------------------------------------------------------------ webs in the world (global coords)
  function webLine(ctx, a, b, z) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = 'rgba(25,25,40,0.35)'; ctx.lineWidth = 2.8 * z; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.97)'; ctx.lineWidth = 1.35 * z; ctx.stroke();
    // a second, finer strand twisting round it
    const d = norm(sub(b, a)), n = P(-d.y, d.x), L = hypot(b.x - a.x, b.y - a.y);
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    const seg = max(2, Math.round(L / 40));
    for (let i = 1; i <= seg; i++) {
      const k = i / seg, o = sin(k * PI * seg * 0.5) * 1.6 * z;
      ctx.lineTo(a.x + d.x * L * k + n.x * o, a.y + d.y * L * k + n.y * o);
    }
    ctx.strokeStyle = 'rgba(220,228,245,0.75)'; ctx.lineWidth = 0.6 * z; ctx.stroke();
    ctx.restore();
  }

  function webSplat(ctx, x, y, r, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= a == null ? 1 : a;
    ctx.lineCap = 'round';
    const draw = () => {
      ctx.beginPath();
      for (let i = 0; i < 7; i++) { const t = -0.2 + (i / 6) * (PI + 0.4); ctx.moveTo(0, 0); ctx.lineTo(cos(t) * r, sin(t) * r * 0.8 + r * 0.05); }
      for (const k of [0.45, 0.8]) {
        for (let i = 0; i <= 6; i++) {
          const t = -0.2 + (i / 6) * (PI + 0.4), x2 = cos(t) * r * k, y2 = sin(t) * r * 0.8 * k + r * 0.05;
          if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
        }
      }
    };
    draw(); ctx.strokeStyle = 'rgba(25,25,40,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    draw(); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.restore();
  }

  function drawWorld(ctx, s, h, pts) {
    const z = Math.max(0.8, (s.s || 1) * (h.body || 1));
    if (h.line) {
      const a = pts && pts.hand ? pts.hand : { x: h.line.x1, y: h.line.y1 };
      webLine(ctx, a, { x: h.line.x2, y: h.line.y2 }, z);
      webSplat(ctx, h.line.x2, h.line.y2, 7 * z);
    }
    if (h.tether) {
      const a = pts && pts.hand ? pts.hand : { x: h.x, y: h.y - 70 * z };
      webLine(ctx, a, { x: h.tether.x2, y: h.tether.y2 }, z * 0.9);
    }
  }

  function worldBusy(s) {
    if (s.hero && (s.hero.line || s.hero.tether)) return true;
    return !!(s.allies && s.allies.some((h) => h.line || h.tether));
  }

  function drawShot(ctx, p, x, y, T) {
    const z = p.size || 1;
    if (p.kind === 'web') {
      const a = atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(x, y); ctx.rotate(a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.8 * z;
      ctx.beginPath();
      for (const o of [-2.4, 0, 2.4]) { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-7 * z, o * z * 0.6, -15 * z, o * z); }
      ctx.stroke();
      ctx.rotate(T * 9);
      ctx.beginPath(); ctx.arc(0, 0, 3 * z, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 0.9 * z; ctx.strokeStyle = 'rgba(40,40,60,0.6)'; ctx.stroke();
      ctx.strokeStyle = 'rgba(150,160,190,0.9)'; ctx.lineWidth = 0.5 * z;
      ctx.beginPath(); for (let i = 0; i < 3; i++) { const b = i * PI / 3; ctx.moveTo(-cos(b) * 3 * z, -sin(b) * 3 * z); ctx.lineTo(cos(b) * 3 * z, sin(b) * 3 * z); } ctx.stroke();
      ctx.restore();
      return true;
    }
    if (p.kind === 'impact') {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(T * 10);
      ctx.beginPath(); ctx.arc(0, 0, 4.4 * z, 0, TAU);
      ctx.fillStyle = '#d9dde8'; ctx.fill();
      ctx.lineWidth = 1 * z; ctx.strokeStyle = '#2a2d3a'; ctx.stroke();
      ctx.strokeStyle = '#7d8396'; ctx.lineWidth = 0.6 * z;
      ctx.beginPath(); ctx.moveTo(-4.4 * z, 0); ctx.lineTo(4.4 * z, 0); ctx.moveTo(0, -4.4 * z); ctx.lineTo(0, 4.4 * z); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.3 * z, 0, TAU);
      ctx.fillStyle = (T * 6) % 1 < 0.5 ? '#ff3b3b' : '#7a1010'; ctx.fill();
      ctx.restore();
      return true;
    }
    return false;
  }

  // a cocoon of web over a webbed enemy
  function drawEnemyOverlay(ctx, e, T, cy) {
    if (!(e.stun > 0) || e.stunKind !== 'web') return;
    const r = { boss: 46, tank: 22, walker: 17, drone: 15, mini: 10 }[e.kind] || 14;
    const a = clamp(e.stun / 0.6, 0, 1);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(0, cy + (e.kind === 'tank' ? -4 : 0));
    const draw = () => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * PI + 0.3;
        const x1 = cos(t) * r, y1 = sin(t) * r * 0.85;
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(sin(t * 3 + 1) * r * 0.3, cos(t * 2) * r * 0.3, -x1, -y1);
      }
      ctx.moveTo(r * 0.92, 0); ctx.ellipse(0, 0, r * 0.92, r * 0.72, 0, 0, TAU);
      ctx.moveTo(r * 0.5, 0); ctx.ellipse(0, 0, r * 0.5, r * 0.42, 0.3, 0, TAU);
    };
    draw(); ctx.strokeStyle = 'rgba(25,25,40,0.35)'; ctx.lineWidth = 2.4; ctx.stroke();
    draw(); ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.restore();
  }

  // particles for web bits (drawn by the overlay's particle layer)
  IronArt.FX.webbit = (ctx, p) => {
    ctx.rotate(p.rot);
    ctx.strokeStyle = `rgba(255,255,255,${0.95 * (1 - p.k)})`; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(0, -1.6, 3, 0); ctx.stroke();
  };
  IronArt.FX.webring = (ctx, p) => {
    const r = 4 + 14 * p.k;
    ctx.globalAlpha *= 1 - p.k;
    webSplatFull(ctx, r);
  };
  function webSplatFull(ctx, r) {
    const draw = () => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const t = (i / 8) * TAU; ctx.moveTo(0, 0); ctx.lineTo(cos(t) * r, sin(t) * r * 0.75); }
      for (const k of [0.5, 0.9]) {
        for (let i = 0; i <= 8; i++) { const t = (i / 8) * TAU; const x = cos(t) * r * k, y = sin(t) * r * 0.75 * k; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      }
    };
    draw(); ctx.strokeStyle = 'rgba(25,25,40,0.3)'; ctx.lineWidth = 1.8; ctx.stroke();
    draw(); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  function expandFx(e, S, spawn) {
    const z = (e.size || 1) * S;
    switch (e.kind) {
      case 'webSplat':
        spawn({ kind: 'webring', x: e.x, y: e.y, n: 1, size: z, life: 0.4 });
        spawn({ kind: 'webbit', x: e.x, y: e.y, n: 7, speed: 130 * S, size: z, life: 0.45, g: 300 });
        return true;
      case 'webBurst':
        spawn({ kind: 'webring', x: e.x, y: e.y, n: 1, size: 2.6 * z, life: 0.55 });
        spawn({ kind: 'webbit', x: e.x, y: e.y, n: 16, speed: 260 * S, size: 1.2 * z, life: 0.6, g: 300 });
        return true;
      case 'webAnchor':
        spawn({ kind: 'webring', x: e.x, y: e.y + 2, n: 1, size: 0.6 * S, life: 0.35 });
        return true;
      case 'spideyLand':
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: 0.8 * z, life: 0.4, flat: 0.25, color: '255,255,255' });
        spawn({ kind: 'dust', x: e.x, y: e.y - 2, n: 6, spread: 14 * z, size: z, life: 0.5 });
        return true;
      default:
        return false;
    }
  }

  // a faint speed streak while he swings fast
  function trail(h, rig, toG, spawn, S, now, R) {
    if (h.mode !== 'air' || h.speed < 330 * S || now - R.trailAt < 55) return;
    R.trailAt = now;
    const p = toG(rig.hip);
    spawn({ kind: 'thrust', x: p.x - h.vx * 0.03, y: p.y - h.vy * 0.03, n: 1, small: true, color: '255,255,255', life: 0.4 });
  }

  // ------------------------------------------------------------------ words
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // a comic speech bubble above his head
  function callout(ctx, text, x, y, a, tone, h) {
    if (a <= 0.01) return;
    if (h && h.upside) y -= 100; // head down: talk above his feet
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (tone === 'tag') {
      ctx.font = '800 6.5px "Segoe UI", system-ui, sans-serif';
      const w = ctx.measureText(text).width + 8;
      roundRect(ctx, x - w / 2, y - 5, w, 10, 5);
      ctx.fillStyle = 'rgba(200,22,32,0.9)'; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillText(text, x, y + 0.3);
      ctx.restore();
      return;
    }
    const small = h && h.ally;
    ctx.font = `italic 700 ${small ? 7.5 : 8.6}px "Comic Sans MS", "Chalkboard SE", "Segoe UI", sans-serif`;
    const w = ctx.measureText(text).width + 12, hh = small ? 12.5 : 14;
    const bx = x - w / 2, by = y - hh / 2 - 2;
    ctx.beginPath();
    roundRect(ctx, bx, by, w, hh, hh / 2);
    ctx.moveTo(x - 4, by + hh - 0.5); ctx.lineTo(x - 7, by + hh + 5); ctx.lineTo(x + 2, by + hh - 0.5);
    ctx.fillStyle = tone === 'warn' ? '#ffe14d' : tone === 'radio' ? '#e7f1ff' : '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = '#15111a';
    if (tone === 'radio') ctx.setLineDash([2.2, 1.6]);
    roundRect(ctx, bx, by, w, hh, hh / 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x - 4, by + hh); ctx.lineTo(x - 7, by + hh + 5); ctx.lineTo(x + 2, by + hh); ctx.stroke();
    ctx.fillStyle = tone === 'warn' ? '#ffe14d' : tone === 'radio' ? '#e7f1ff' : '#ffffff';
    ctx.fillRect(x - 3.5, by + hh - 1.4, 5, 1.6);
    ctx.fillStyle = '#15111a';
    ctx.fillText(text, x, by + hh / 2 + 0.4);
    ctx.restore();
  }

  // the hover card: comic style
  function card(ctx, h, x, bottom) {
    if (h.upside) bottom -= 112;
    const meters = h.meters || [];
    const w = 100, hh = 22 + meters.length * 10;
    ctx.save();
    ctx.translate(x - w / 2, bottom - hh);
    roundRect(ctx, 0, 0, w, hh, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#15111a'; ctx.stroke();
    ctx.save(); roundRect(ctx, 0, 0, w, 12, 5); ctx.clip(); ctx.fillStyle = '#d71f2b'; ctx.fillRect(0, 0, w, 12); ctx.restore();
    ctx.font = 'italic 800 7.4px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${h.ally ? h.callsign : 'SPIDEY'} · ${h.status}`.slice(0, 30), 5, 6.4);
    ctx.font = '700 7px "Segoe UI", system-ui, sans-serif';
    meters.forEach((m, i) => {
      const y = 18 + i * 10;
      ctx.fillStyle = '#2a2d3a'; ctx.fillText(m.short || m.label, 5, y);
      ctx.fillStyle = 'rgba(30,40,80,0.12)'; ctx.fillRect(28, y - 2.5, w - 34, 5);
      ctx.fillStyle = m.v < 20 ? '#ff4d5e' : m.k === 'power' ? '#7fa6ff' : m.color; ctx.fillRect(28, y - 2.5, (w - 34) * clamp(m.v / 100, 0, 1), 5);
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ portraits & icons
  function drawBust(ctx, look, T) {
    const R = makeRig('stand', { t: 0, T, phase: 0, m: {} });
    R.turn = 0.62;
    drawHero(ctx, R, { look, T });
  }

  // the mask filling a 46×46 avatar
  function drawAvatar(ctx, look, T) {
    const L = lookOf(look);
    ctx.save();
    ctx.translate(23, 25);
    ctx.scale(2.3, 2.3);
    ctx.lineJoin = 'round';
    drawMask(ctx, L, 0.2, Math.sin(T * 0.7) > 0.985 ? 0.15 : 1, T);
    ctx.restore();
  }

  // the home window's portrait (origin at the floor, 150×95 px): crouching, or hanging from the top
  function drawPortrait(ctx, state, T, look) {
    const h = state.hero || {};
    if (h.mode === 'down') {
      ctx.scale(0.9, 0.9);
      drawHero(ctx, makeRig('down', { t: 0, T, phase: 0, m: { eyes: 0.35 } }), { look, T });
      return;
    }
    if (sin(T * 0.21) > 0.15) {
      const k = 0.75;
      ctx.save();
      ctx.scale(k, k);
      const top = -91 / k, feet = -110;
      ctx.translate(sin(T * 1.1) * 2, 0);
      webLine(ctx, { x: 0, y: top }, { x: 0, y: feet }, 1);
      ctx.translate(0, feet);
      const R = makeRig('hangUpside', { t: T, T, phase: 0, m: { h: { facing: 1, ropeAng: 0 } } });
      drawHero(ctx, R, { look, T });
      ctx.restore();
      return;
    }
    ctx.scale(0.92, 0.92);
    const R = makeRig(sin(T * 0.21) < -0.7 ? 'thwip' : 'crouch', { t: 2, T, phase: 0, m: {} });
    drawHero(ctx, R, { look, T });
  }

  // the app icon: the mask on a red-to-blue web
  function drawIcon(ctx, size) {
    const S = size, m = S * 0.04, r = S * 0.215;
    ctx.save();
    roundRect(ctx, m, m, S - 2 * m, S - 2 * m, r);
    const g = ctx.createLinearGradient(0, m, S, S - m);
    g.addColorStop(0, '#f0303a'); g.addColorStop(0.55, '#b3121d'); g.addColorStop(1, '#1b2f8a');
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    // a web spun across the background
    const cx = S / 2, cy = S * 0.47, R = S * 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = S * 0.006;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(a) * R, cy + sin(a) * R); }
    for (let j = 1; j < 9; j++) {
      const rr = j * S * 0.075;
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU, a0 = ((i - 1) / 16) * TAU;
        if (i === 0) ctx.moveTo(cx + cos(a) * rr, cy + sin(a) * rr);
        else { const am = (a + a0) / 2; ctx.quadraticCurveTo(cx + cos(am) * rr * 0.9, cy + sin(am) * rr * 0.9, cx + cos(a) * rr, cy + sin(a) * rr); }
      }
    }
    ctx.stroke();
    ctx.shadowColor = 'rgba(0,0,0,0.38)'; ctx.shadowBlur = S * 0.03; ctx.shadowOffsetY = S * 0.014;
    ctx.translate(S / 2, S * 0.52);
    ctx.scale(S / 29, S / 29);
    ctx.lineJoin = 'round';
    drawMask(ctx, LOOKS.classic, 0.2, 1, 0, 0.5);
    ctx.restore();
  }

  // the tray icon: the mask, high contrast
  function drawTray(ctx, size) {
    ctx.save();
    ctx.translate(size / 2, size * 0.5);
    ctx.scale(size / 20, size / 20);
    ctx.lineJoin = 'round';
    drawMask(ctx, { ...LOOKS.classic, web: 'rgba(28,4,10,0.55)' }, 0.2, 1, 0, 0.8);
    ctx.restore();
  }

  // ------------------------------------------------------------------ sounds (L: blip, hiss, noise, gain, filt, curve, envelope, ctx(), out())
  const sounds = {
    spThwip: (L) => { L.hiss('highpass', 2600, 0.8, 0.09, 0.26, 0, 6200); L.blip('triangle', 2000, 700, 0.05, 0.05); },
    spSwing: (L) => L.hiss('bandpass', 380, 1.1, 0.5, 0.2, 0, 1700),
    spSplat: (L) => { L.hiss('lowpass', 1300, 1, 0.12, 0.3, 0, 300); L.blip('sine', 320, 90, 0.1, 0.22); },
    spPunch: (L) => { L.blip('sine', 190, 55, 0.14, 0.45); L.hiss('bandpass', 1500, 1, 0.05, 0.25); },
    spSense: (L) => { for (let i = 0; i < 5; i++) L.blip('sine', 1700 + i * 260, 2500 + i * 220, 0.09, 0.045, i * 0.045); },
    spLand: (L) => { L.blip('sine', 150, 60, 0.12, 0.28); L.hiss('lowpass', 520, 0.8, 0.1, 0.16); },
    spYank: (L) => { L.hiss('bandpass', 900, 1, 0.26, 0.24, 0, 300); L.blip('sawtooth', 320, 120, 0.2, 0.05); },
    spFlip: (L) => L.hiss('bandpass', 900, 1.5, 0.24, 0.13, 0, 2600),
    spHurt: (L) => { L.blip('triangle', 520, 220, 0.25, 0.1); L.blip('sine', 140, 60, 0.2, 0.2, 0.05); },
    spCall: (L) => { [660, 880, 990, 1320].forEach((f, i) => L.blip('triangle', f, f, 0.12, 0.08, i * 0.09)); },
  };

  root.HeroArts = root.HeroArts || {};
  root.HeroArts.spiderman = {
    name: 'SPIDER-MAN', theme: 'spider', looks: LOOKS, lookKey: 'spiderSuit', body: 0.95, box: 330,
    POSES, makeRig, lerpRig, drawHero, points, drawBust, drawAvatar, drawPortrait, drawIcon, drawTray, drawMask: (ctx, look, f, eyes, T, lw) => drawMask(ctx, lookOf(look), f, eyes, T, lw),
    cardTitle: (h) => (h.ally ? h.callsign : 'SPIDEY'),
    callout, calloutHeight: 18, card,
    loop: null, trail,
    drawShot, drawWorld, worldBusy, drawEnemyOverlay, expandFx,
    sounds,
    voice: { prefer: /guy|ryan|andrew|eric|brian|christopher|roger|steffan|mark|david|male/i, pitch: 1.12, rate: 1.1 },
    brief: { done: 'GOT IT! 👍', snooze: (m) => `${m} MORE MIN`, time: (a) => `${a.time} · your friendly neighborhood reminder`, sound: 'spSense' },
    menuName: (s) => `Friendly neighbor · ${s.hero.status}`,
    allyLabel: 'SPIDER-VERSE',
    avatarBg: 'rgba(255,255,255,0.16)', shadowTint: 'rgba(255,90,110,0.16)',
  };
})(typeof window !== 'undefined' ? window : globalThis);
