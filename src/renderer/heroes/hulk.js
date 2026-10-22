/*
 * Desktop Buddies — the Hulk, drawn in code (an original fan-made drawing of
 * Marvel's character, for personal use).
 *
 * Same rig idea as ironArt.js — every pose returns joint targets, resolve()
 * builds the skeleton with 2-bone IK, rigs blend with lerpRig() — but with his
 * own proportions: short thick legs, a huge torso with traps that swallow the
 * neck, long heavy arms with big fists and a small head. When he's knocked out
 * he's drawn as Bruce Banner instead.
 *
 * Registers HeroArts.hulk (see ironScene.js for what a hero art provides).
 * Coordinates: origin = floor point between the feet, x forward, y down;
 * standing height ≈ 93 units (the scene scales him by his body size, 1.4).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, abs, max, min, hypot, atan2, PI } = Math;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const P = (x, y) => ({ x, y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
  const rot = (p, a) => ({ x: p.x * cos(a) - p.y * sin(a), y: p.x * sin(a) + p.y * cos(a) });
  const norm = (p) => { const l = hypot(p.x, p.y) || 1; return { x: p.x / l, y: p.y / l }; };
  const lp = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
  const ease = (k) => 1 - (1 - k) * (1 - k);
  const { ik, reachTo, grad, limb, lerpAng } = IronArt.rig;

  // ------------------------------------------------------------------ skins
  const PURPLE = ['#ad7be0', '#7238a8', '#3c1862'];
  const SKINS = {
    green: { label: 'Classic green', skin: ['#a8e86a', '#5fae2e', '#2a6413'], line: '#163208', shade: 'rgba(14,50,4,0.45)', hi: 'rgba(240,255,210,0.4)', shorts: PURPLE, hair: '#151515', iris: '#3b9a1e', brow: '#245a10' },
    grey: { label: 'Grey', skin: ['#d6dade', '#8f969f', '#4b525b'], line: '#23272d', shade: 'rgba(26,30,36,0.42)', hi: 'rgba(255,255,255,0.45)', shorts: PURPLE, hair: '#141414', iris: '#55606c', brow: '#3c434b' },
    savage: { label: 'Savage', skin: ['#8cc957', '#417d1f', '#1c420a'], line: '#0d2204', shade: 'rgba(6,28,2,0.48)', hi: 'rgba(225,255,190,0.32)', shorts: ['#7a8999', '#3e4a58', '#1c232b'], hair: '#0b0b0b', iris: '#d9b23a', brow: '#163a07', scars: true },
  };
  const farCols = (c) => [c[1], c[2], c[2]];

  // ------------------------------------------------------------------ poses
  // c = { t, T, phase, aim, m: { h (hero snapshot), swing, … } }
  function base(c) {
    const T = c.T || 0, br = sin(T * 1.7);
    return {
      ox: 0, oy: 0, rot: 0, grow: 1, glow: 0, rage: 0,
      hip: P(0, -36.5 + br * 0.35), lean: 0.14, headTilt: 0.04, turn: 0.45,
      // [near, far] — near = viewer side (drawn in front)
      legs: [{ foot: P(-9, -1), knee: null, bend: -1, footAng: 0 }, { foot: P(9, -1), knee: null, bend: -1, footAng: 0 }],
      arms: [{ hand: P(-2, -38 + br * 0.6), elbow: null, bend: 1, fist: 1, handAng: null, point: 0 }, { hand: P(21, -37 + br * 0.6), elbow: null, bend: 1, fist: 1, handAng: null, point: 0 }],
      mouth: 0, grin: 0, brow: 1, lids: 1, breath: 0.5 + 0.5 * br, shadow: 1, banner: 0, carry: 0, bt: c.t || 0,
    };
  }

  const POSES = {};

  POSES.stand = (c) => {
    const p = base(c);
    p.headTilt = 0.04 + 0.03 * sin((c.T || 0) * 0.5);
    return p;
  };

  POSES.idleLook = (c) => {
    const p = base(c);
    p.headTilt = -0.1 + 0.12 * sin(c.t * 1.4);
    p.turn = 0.45 + 0.3 * sin(c.t * 0.8);
    return p;
  };

  POSES.flex = (c) => {
    // double-biceps: "HULK STRONGEST THERE IS"
    const p = base(c);
    const k = ease(clamp(c.t / 0.35, 0, 1));
    p.lean = 0.02; p.turn = 0.85; p.grin = 0.8 * k; p.breath = 1;
    p.legs[0].foot = P(-12, -1); p.legs[1].foot = P(12, -1);
    p.arms[0].elbow = lp(P(-14, -46), P(-29, -71), k); p.arms[0].hand = lp(P(-6, -40), P(-25, -89), k);
    p.arms[1].elbow = lp(P(22, -46), P(33, -72), k); p.arms[1].hand = lp(P(20, -40), P(29, -90), k);
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2 - 0.2;
    p.headTilt = -0.08;
    return p;
  };

  POSES.walk = (c) => {
    const p = base(c);
    const s = sin(c.phase || 0), k = cos(c.phase || 0);
    p.hip.y = -37 - abs(k) * 1.6 + 0.8;
    p.lean = 0.18 + 0.03 * abs(s);
    p.legs[0].foot = P(-2 + 11 * s, -1 - 6 * max(0, -k));
    p.legs[1].foot = P(2 - 11 * s, -1 - 6 * max(0, k));
    p.legs[0].footAng = -0.2 * max(0, -k); p.legs[1].footAng = -0.2 * max(0, k);
    p.arms[0].hand = P(-1 - 9 * s, -38 + 2 * abs(s));
    p.arms[1].hand = P(21 + 9 * s, -37 + 2 * abs(s));
    p.headTilt = 0.08;
    return p;
  };

  POSES.run = (c) => {
    const p = base(c);
    const s = sin(c.phase || 0), k = cos(c.phase || 0);
    p.hip.y = -34 - abs(k) * 2.5;
    p.lean = 0.42;
    p.legs[0].foot = P(-1 + 15 * s, -1 - 10 * max(0, -k));
    p.legs[1].foot = P(1 - 15 * s, -1 - 10 * max(0, k));
    p.arms[0].hand = P(12 - 13 * s, -50 + 6 * k);
    p.arms[1].hand = P(32 + 13 * s, -42 - 6 * k);
    p.mouth = 0.35; p.headTilt = -0.1;
    return p;
  };

  POSES.crouch = (c) => {
    const p = base(c);
    p.hip = P(-3, -26);
    p.lean = 0.5;
    p.legs[0].foot = P(-12, -1); p.legs[1].foot = P(11, -1);
    p.arms[0].hand = P(-12, -22); p.arms[1].hand = P(6, -16);
    p.mouth = 0.25; p.headTilt = 0.05;
    return p;
  };

  POSES.leap = (c) => {
    // rising: fists up, legs trailing, yelling
    const p = base(c);
    p.hip.y = -40; p.lean = -0.06;
    p.legs[0].foot = P(-13, -9); p.legs[1].foot = P(2, -17);
    p.arms[0].hand = P(0, -108); p.arms[1].hand = P(20, -104);
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2;
    p.mouth = 0.9; p.headTilt = -0.3; p.shadow = 0;
    return p;
  };

  POSES.fall = (c) => {
    // coming down: double fist raised for the landing smash
    const p = base(c);
    p.hip.y = -40; p.lean = 0.16;
    p.legs[0].foot = P(-5, -4); p.legs[1].foot = P(11, -11);
    p.arms[0].hand = P(8, -106); p.arms[1].hand = P(17, -106);
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2 + 0.3;
    p.mouth = 0.7; p.headTilt = 0.08; p.shadow = 0;
    return p;
  };

  POSES.land = (c) => {
    // the smash landing: one knee down, both fists in the floor
    const p = base(c);
    p.hip = P(-2, -19);
    p.lean = 0.68;
    p.legs[0].foot = P(-21, -1); p.legs[0].knee = P(-7, -2); p.legs[0].footAng = 1.1;
    p.legs[1].foot = P(14, -1);
    p.arms[0].hand = P(21, -4); p.arms[1].hand = P(29, -4);
    p.arms[0].handAng = p.arms[1].handAng = PI / 2;
    p.headTilt = 0.22; p.mouth = 0.45;
    return p;
  };

  POSES.smash = (c) => {
    // raise both fists overhead, then hammer the floor
    const p = base(c);
    const k1 = ease(clamp(c.t / 0.32, 0, 1)), k2 = clamp((c.t - 0.36) / 0.09, 0, 1);
    const up = [P(-1, -110), P(13, -108)], down = [P(28, -4), P(34, -5)];
    const rest = [p.arms[0].hand, p.arms[1].hand];
    for (let i = 0; i < 2; i++) {
      p.arms[i].hand = k2 > 0 ? lp(up[i], down[i], k2) : lp(rest[i], up[i], k1);
      p.arms[i].handAng = k2 > 0.5 ? PI / 2 : -PI / 2;
    }
    p.hip = P(0, lerp(lerp(-36.5, -39, k1), -24, k2));
    p.lean = k2 > 0 ? lerp(-0.22, 0.7, k2) : lerp(0.14, -0.22, k1);
    p.legs[0].foot = P(-13, -1); p.legs[1].foot = P(13, -1);
    p.mouth = 0.4 + 0.6 * k2; p.headTilt = lerp(-0.2, 0.25, k2);
    return p;
  };

  POSES.clap = (c) => {
    // arms wide… CLAP
    const p = base(c);
    const k1 = ease(clamp(c.t / 0.3, 0, 1)), k2 = clamp((c.t - 0.36) / 0.07, 0, 1);
    const wide = [P(-26, -72), P(46, -76)], shut = [P(37, -66), P(38, -64)];
    for (let i = 0; i < 2; i++) {
      p.arms[i].hand = k2 > 0 ? lp(wide[i], shut[i], k2) : lp(p.arms[i].hand, wide[i], k1);
      p.arms[i].fist = 0;
      p.arms[i].handAng = k2 > 0.5 ? (i ? -0.2 : 0.2) : null;
    }
    p.lean = lerp(0.05, 0.28, k2);
    p.legs[0].foot = P(-13, -1); p.legs[1].foot = P(13, -1);
    p.mouth = 0.5 + 0.4 * k2; p.headTilt = -0.05;
    p.breath = 1;
    return p;
  };

  POSES.punch = (c) => {
    // a haymaker with the front arm
    const p = base(c);
    const k = clamp(c.t / 0.16, 0, 1), back = clamp(1 - (c.t - 0.3) / 0.2, 0, 1);
    p.lean = 0.12 + 0.24 * k * back;
    p.legs[0].foot = P(-13, -1); p.legs[1].foot = P(13, -1);
    p.arms[1].hand = lp(P(8, -58), P(56, -66), ease(k) * back);
    p.arms[1].bend = 1;
    p.arms[0].hand = P(6, -54);
    p.mouth = 0.4 + 0.5 * k; p.headTilt = 0.05;
    return p;
  };

  POSES.punch2 = (c) => {
    // the other fist
    const p = base(c);
    const k = clamp(c.t / 0.16, 0, 1), back = clamp(1 - (c.t - 0.3) / 0.2, 0, 1);
    p.lean = 0.16 + 0.24 * k * back;
    p.legs[0].foot = P(-11, -1); p.legs[1].foot = P(14, -1);
    p.arms[0].hand = lp(P(-14, -58), P(36, -68), ease(k) * back);
    p.arms[0].bend = 1;
    p.arms[1].hand = P(12, -46);
    p.mouth = 0.5 + 0.4 * k; p.headTilt = 0.05;
    return p;
  };

  POSES.swat = (c) => {
    // in the air: a backhand swipe at a flyer
    const p = base(c);
    const k = ease(clamp(c.t / 0.14, 0, 1));
    p.hip.y = -40; p.lean = 0.22;
    p.legs[0].foot = P(-9, -10); p.legs[1].foot = P(8, -15);
    p.arms[1].hand = lp(P(-2, -104), P(52, -72), k); p.arms[1].fist = 0.6;
    p.arms[0].hand = P(-12, -92);
    p.mouth = 1; p.headTilt = -0.1; p.shadow = 0;
    return p;
  };

  POSES.lift = (c) => {
    // holding something heavy overhead
    const p = base(c);
    const k = ease(clamp(c.t / 0.25, 0, 1));
    p.hip.y = -38; p.lean = lerp(0.3, -0.08, k);
    p.legs[0].foot = P(-13, -1); p.legs[1].foot = P(13, -1);
    p.arms[0].hand = lp(P(14, -20), P(-4, -104), k); p.arms[1].hand = lp(P(24, -20), P(16, -105), k);
    p.arms[0].fist = p.arms[1].fist = 0.2;
    p.arms[0].handAng = p.arms[1].handAng = -PI / 2;
    p.mouth = 0.35; p.headTilt = -0.25; p.breath = 1;
    return p;
  };

  POSES.throw = (c) => {
    // wind back overhead… and hurl it forward
    const p = base(c);
    const k = clamp((c.t - 0.24) / 0.1, 0, 1);
    p.hip.y = -37;
    p.lean = lerp(-0.32, 0.38, k);
    p.legs[0].foot = P(-14, -1); p.legs[1].foot = P(13, -1);
    p.arms[0].hand = lp(P(-16, -100), P(42, -72), k); p.arms[1].hand = lp(P(-4, -104), P(50, -66), k);
    p.arms[0].fist = p.arms[1].fist = k > 0.5 ? 0 : 0.2;
    p.arms[0].handAng = p.arms[1].handAng = k > 0.5 ? 0 : -PI / 2;
    p.mouth = 0.4 + 0.6 * k; p.headTilt = lerp(-0.25, 0.1, k);
    return p;
  };

  POSES.rip = (c) => {
    // bent over, tearing up the floor (or grabbing a robot)
    const p = base(c);
    const pull = clamp((c.t - 0.2) / 0.25, 0, 1);
    p.hip = P(-2, -28 - pull * 2);
    p.lean = 0.78 - 0.1 * pull;
    p.legs[0].foot = P(-15, -1); p.legs[1].foot = P(12, -1);
    const shake = sin((c.T || 0) * 45) * 0.8 * pull;
    p.arms[0].hand = P(23 + shake, -3 - pull * 4); p.arms[1].hand = P(31 - shake, -3 - pull * 4);
    p.arms[0].fist = p.arms[1].fist = 0.2;
    p.arms[0].handAng = p.arms[1].handAng = PI / 2;
    p.mouth = 0.6; p.headTilt = 0.1;
    return p;
  };

  POSES.roar = (c) => {
    const p = base(c);
    const k = ease(clamp(c.t / 0.25, 0, 1)), j = sin((c.T || 0) * 40) * 0.7 * k;
    p.hip.y = -38; p.lean = lerp(0.14, -0.2, k); p.turn = 0.68;
    p.legs[0].foot = P(-13, -1); p.legs[1].foot = P(13, -1);
    p.arms[0].hand = P(-22 + j, -42); p.arms[1].hand = P(31 - j, -40);
    p.arms[0].bend = 1; p.arms[1].bend = -1;
    p.breath = 1; p.headTilt = lerp(0, -0.42, k); p.mouth = k;
    return p;
  };

  POSES.point = (c) => {
    // pointing up at the reminder: "THAT. DO IT."
    const p = base(c);
    const k = ease(clamp(c.t / 0.3, 0, 1));
    p.turn = 0.62; p.lean = 0.06;
    p.arms[0].hand = P(-12, -46); p.arms[0].bend = 1;
    p.arms[1].hand = lp(P(21, -37), P(28, -103), k); p.arms[1].point = k > 0.6 ? 1 : 0; p.arms[1].handAng = -1.35;
    p.grin = 0.2; p.headTilt = -0.18 * k; p.mouth = 0.15 * abs(sin((c.T || 0) * 6));
    return p;
  };

  POSES.greet = (c) => {
    const p = base(c);
    const k = ease(clamp(c.t / 0.3, 0, 1));
    p.turn = 0.72;
    p.arms[1].hand = lp(P(21, -37), P(25, -100), k); p.arms[1].handAng = -PI / 2;
    p.grin = 0.85 * k;
    return p;
  };

  POSES.stagger = (c) => {
    const p = base(c);
    p.lean = -0.3;
    p.arms[0].hand = P(2, -78); p.arms[1].hand = P(22, -82);
    p.mouth = 0.6; p.headTilt = -0.25;
    return p;
  };

  POSES.brace = (c) => {
    // crouched, arms crossed in front of the face
    const p = base(c);
    p.hip.y = -30; p.lean = 0.3;
    p.legs[0].foot = P(-14, -1); p.legs[1].foot = P(12, -1);
    p.arms[0].hand = P(22, -76); p.arms[1].hand = P(17, -80);
    p.arms[0].bend = -1; p.arms[1].bend = 1;
    p.headTilt = 0.35; p.mouth = 0.3;
    return p;
  };

  POSES.sit = (c) => {
    // sitting on the floor, forearms on his knees
    const p = base(c);
    const br = sin((c.T || 0) * 1.1);
    p.hip = P(-6, -9 + br * 0.3); p.lean = 0.08;
    p.legs[0].foot = P(13, -1); p.legs[1].foot = P(17, -3);
    p.arms[0].hand = P(13, -20); p.arms[1].hand = P(19, -19);
    p.headTilt = 0.25; p.brow = 0.55; p.breath = 0.5 + 0.5 * br;
    return p;
  };

  POSES.sleep = (c) => {
    const p = POSES.sit(c);
    const br = sin((c.T || 0) * 0.9);
    p.headTilt = 0.55 + 0.04 * br; p.lids = 0; p.brow = 0.2; p.mouth = 0.08;
    p.breath = 0.5 + 0.5 * br; p.hip.y = -9 + br * 0.5;
    return p;
  };

  POSES.held = (c) => {
    // dangling from the cursor, furious
    const p = base(c);
    const T = c.T || 0, f = sin(T * 7), g = sin(T * 5.3);
    p.hip.y = -37; p.lean = 0;
    p.legs[0].foot = P(-6 + 4 * f, -3); p.legs[1].foot = P(8 - 4 * f, -6);
    p.arms[0].hand = P(-24, -56 + 6 * g); p.arms[1].hand = P(36, -60 - 6 * g);
    p.mouth = 0.9; p.headTilt = -0.1;
    p.rot = (c.m && c.m.swing) || 0;
    p.shadow = 0;
    return p;
  };

  POSES.down = (c) => {
    // flat on his back
    const p = base(c);
    p.rot = -1.5; p.oy = 35; p.ox = 6;
    p.arms[0].hand = P(-16, -40); p.arms[1].hand = P(18, -44);
    p.legs[0].foot = P(-6, -2); p.legs[1].foot = P(7, -5);
    p.lids = 0; p.mouth = 0.2; p.brow = 0.3; p.shadow = 1.4;
    return p;
  };

  POSES.banner = (c) => {
    const p = base(c);
    p.banner = 1;
    return p;
  };

  POSES.transform = (c) => {
    // Banner grows back into the Hulk
    const p = POSES.roar(c);
    const k = clamp(c.t / 0.9, 0, 1);
    p.grow = 0.55 + 0.45 * ease(k);
    p.glow = 1 - clamp(c.t / 1.1, 0, 1);
    p.mouth = 1;
    return p;
  };

  // ------------------------------------------------------------------ resolve & blend
  const THIGH = 17, SHIN = 18.5, UPPER = 17.5, FORE = 16.5;

  function resolve(p) {
    const L = p.lean, hip = p.hip;
    const at = (x, y) => add(hip, rot(P(x, y), L));
    const sh = [at(-12, -34), at(15, -35)];
    const hp = [add(hip, P(-6, 1)), add(hip, P(6, 0))];
    const arms = p.arms.map((a, i) => {
      const hand = a.elbow ? a.hand : reachTo(sh[i], a.hand, UPPER + FORE - 0.3);
      const elbow = a.elbow || ik(sh[i], hand, UPPER, FORE, a.bend);
      const ang = a.handAng == null ? atan2(hand.y - elbow.y, hand.x - elbow.x) : a.handAng;
      return { sh: sh[i], elbow, hand, ang, fist: a.fist, point: a.point || 0 };
    });
    const legs = p.legs.map((l, i) => {
      const foot = l.knee ? l.foot : reachTo(hp[i], l.foot, THIGH + SHIN - 0.3);
      const knee = l.knee || ik(hp[i], foot, THIGH, SHIN, l.bend);
      return { hip: hp[i], knee, foot, ang: l.footAng };
    });
    return {
      ox: p.ox, oy: p.oy, rot: p.rot, grow: p.grow, glow: p.glow, rage: p.rage, lean: L, headTilt: p.headTilt, turn: p.turn,
      hip, chest: at(2, -22), head: at(9, -47), arms, legs,
      mouth: p.mouth, grin: p.grin, brow: p.brow, lids: p.lids, breath: p.breath, shadow: p.shadow, banner: p.banner, carry: p.carry, bt: p.bt,
    };
  }

  const NUM = ['ox', 'oy', 'rot', 'grow', 'glow', 'rage', 'lean', 'headTilt', 'turn', 'mouth', 'grin', 'brow', 'lids', 'breath', 'shadow', 'banner', 'carry', 'bt'];
  function lerpRig(a, b, k) {
    if (k >= 1) return b;
    if (k <= 0) return a;
    const o = {};
    for (const key of NUM) o[key] = lerp(a[key], b[key], k);
    for (const key of ['hip', 'chest', 'head']) o[key] = lp(a[key], b[key], k);
    o.arms = a.arms.map((x, i) => {
      const y = b.arms[i];
      return { sh: lp(x.sh, y.sh, k), elbow: lp(x.elbow, y.elbow, k), hand: lp(x.hand, y.hand, k), ang: lerpAng(x.ang, y.ang, k), fist: lerp(x.fist, y.fist, k), point: k < 0.5 ? x.point : y.point };
    });
    o.legs = a.legs.map((x, i) => {
      const y = b.legs[i];
      return { hip: lp(x.hip, y.hip, k), knee: lp(x.knee, y.knee, k), foot: lp(x.foot, y.foot, k), ang: lerp(x.ang, y.ang, k) };
    });
    return o;
  }

  function makeRig(name, c) {
    c.m = c.m || {};
    const h = c.m.h;
    // the scene shows "down" for the whole knockout; Banner and the change back are poses of it
    if (name === 'down' && h && (h.pose === 'banner' || h.pose === 'transform')) name = h.pose;
    if (h && h.form === 'banner') name = 'banner';
    const p = (POSES[name] || POSES.stand)(c);
    if (h && h.carry === 'boulder' && (name === 'lift' || name === 'throw')) p.carry = 1;
    if (h && h.rampage) p.rage = 1;
    return resolve(p);
  }

  // ------------------------------------------------------------------ drawing helpers
  function ellipse(ctx, c, rx, ry, a) {
    ctx.beginPath(); ctx.ellipse(c.x, c.y, max(0.1, rx), max(0.1, ry), a || 0, 0, TAU);
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // a muscle bulge sitting along a limb (a → b), pushed to one side
  function bulge(ctx, a, b, at, side, rx, ry, cols, line) {
    const d = norm(sub(b, a)), n = P(-d.y, d.x);
    const c = add(lp(a, b, at), mul(n, side));
    ellipse(ctx, c, rx, ry, atan2(d.y, d.x));
    ctx.fillStyle = grad(ctx, c.x - n.x * ry, c.y - n.y * ry, c.x + n.x * ry, c.y + n.y * ry, cols);
    ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = line; ctx.stroke();
  }

  // ------------------------------------------------------------------ the Hulk
  function drawFoot(ctx, L, cols, K) {
    ctx.save();
    ctx.translate(L.foot.x, L.foot.y);
    ctx.rotate(L.ang);
    ctx.beginPath();
    ctx.moveTo(-5, -6.5);
    ctx.quadraticCurveTo(-7.4, 0, -4, 1.6);
    ctx.lineTo(9.5, 1.6);
    ctx.quadraticCurveTo(13.2, 1.3, 12.4, -1.8);
    ctx.quadraticCurveTo(8.5, -5.4, 2.5, -6.6);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -6.5, 0, 1.6, cols); ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = K.line; ctx.stroke();
    ctx.strokeStyle = K.shade; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(8.4 + i * 1.3, 1.4); ctx.lineTo(8.8 + i * 1.3, -0.9 + i * 0.3); }
    ctx.stroke();
    ctx.restore();
  }

  // torn purple shorts over the upper thigh
  function drawShortsLeg(ctx, L, K, far) {
    const cols = far ? farCols(K.shorts) : K.shorts;
    const d = norm(sub(L.knee, L.hip)), n = P(-d.y, d.x);
    const a = sub(L.hip, mul(d, 5)), b = lp(L.hip, L.knee, 0.66);
    const w1 = 19, w2 = 16.5;
    ctx.beginPath();
    ctx.moveTo(a.x + n.x * w1 / 2, a.y + n.y * w1 / 2);
    ctx.lineTo(b.x + n.x * w2 / 2, b.y + n.y * w2 / 2);
    const jag = [3.4, 0.4, 4.6, 1, 3, 0.2];
    for (let i = 1; i <= 6; i++) {
      const side = w2 / 2 - (i / 6) * w2;
      const q = add(add(b, mul(n, side)), mul(d, jag[i - 1]));
      ctx.lineTo(q.x, q.y);
    }
    ctx.lineTo(a.x - n.x * w1 / 2, a.y - n.y * w1 / 2);
    ctx.closePath();
    const m = lp(a, b, 0.5);
    ctx.fillStyle = grad(ctx, m.x - n.x * w1 / 2, m.y - n.y * w1 / 2, m.x + n.x * w1 / 2, m.y + n.y * w1 / 2, cols);
    ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#24103a'; ctx.stroke();
    // a couple of folds
    ctx.strokeStyle = 'rgba(30,8,50,0.45)'; ctx.lineWidth = 0.7;
    ctx.beginPath();
    const f1 = add(lp(a, b, 0.35), mul(n, 2)), f2 = add(lp(a, b, 0.85), mul(n, 4));
    ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
    ctx.stroke();
  }

  function drawLeg(ctx, L, K, far) {
    const sk = far ? farCols(K.skin) : K.skin;
    limb(ctx, L.knee, L.foot, 12.5, 8.2, sk, K.line);
    bulge(ctx, L.knee, L.foot, 0.3, 3.4, 7.5, 5.2, sk, K.line); // calf
    drawFoot(ctx, L, sk, K);
    limb(ctx, L.hip, L.knee, 17.5, 12.5, sk, K.line);
    bulge(ctx, L.hip, L.knee, 0.62, -3, 7.8, 6, sk, K.line); // quad above the knee
    // knee
    ctx.strokeStyle = K.shade; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(L.knee.x + 1.2, L.knee.y + 0.5, 3.2, -1.2, 1.2); ctx.stroke();
    drawShortsLeg(ctx, L, K, far);
  }

  function drawHand(ctx, A, cols, K) {
    ctx.save();
    ctx.translate(A.hand.x, A.hand.y);
    ctx.rotate(A.ang);
    const fill = () => { ctx.fillStyle = grad(ctx, 0, -6.5, 0, 6.5, cols); ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = K.line; ctx.stroke(); };
    if (A.point > 0.5) {
      rrect(ctx, -2.6, -5.6, 9.6, 11.2, 3.6); fill();
      rrect(ctx, 5, -5.2, 10, 3.6, 1.6); fill(); // index finger
    } else if (A.fist > 0.5) {
      rrect(ctx, -3, -6.4, 11.6, 12.8, 4.2); fill();
      ctx.strokeStyle = K.shade; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(5.2, -3.4 + i * 3.2); ctx.lineTo(8.4, -3.2 + i * 3.2); }
      ctx.moveTo(-0.5, 3.6); ctx.quadraticCurveTo(3.5, 6, 6.8, 3.8); // thumb
      ctx.stroke();
    } else {
      rrect(ctx, -2.4, -6, 8.4, 12, 3); fill();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(5, -4.6 + i * 3.05); ctx.lineTo(11.6, -5 + i * 3.25);
        ctx.lineCap = 'round'; ctx.lineWidth = 3.6; ctx.strokeStyle = K.line; ctx.stroke();
        ctx.lineWidth = 2.2; ctx.strokeStyle = cols[1]; ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(4.6, 8.2);
      ctx.lineWidth = 3.6; ctx.strokeStyle = K.line; ctx.stroke();
      ctx.lineWidth = 2.2; ctx.strokeStyle = cols[1]; ctx.stroke();
    }
    ctx.restore();
  }

  function drawArm(ctx, A, K, far) {
    const sk = far ? farCols(K.skin) : K.skin;
    limb(ctx, A.sh, A.elbow, 15, 12, sk, K.line);
    bulge(ctx, A.sh, A.elbow, 0.52, -2.6, 8, 5.4, sk, K.line); // biceps
    bulge(ctx, A.sh, A.elbow, 0.45, 2.4, 7, 4.4, sk, K.line);  // triceps
    limb(ctx, A.elbow, A.hand, 13.5, 10.2, sk, K.line);
    bulge(ctx, A.elbow, A.hand, 0.3, -1.2, 7.4, 6, sk, K.line); // forearm
    drawHand(ctx, A, sk, K);
    // deltoid, stretched along the upper arm
    ellipse(ctx, P(A.sh.x + 0.5, A.sh.y + 1), 9.8, 8.2, atan2(A.elbow.y - A.sh.y, A.elbow.x - A.sh.x));
    ctx.fillStyle = grad(ctx, A.sh.x, A.sh.y - 8, A.sh.x, A.sh.y + 9, sk); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = K.line; ctx.stroke();
    ctx.strokeStyle = K.shade; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(A.sh.x - 3, A.sh.y + 7); ctx.quadraticCurveTo(A.sh.x + 1, A.sh.y + 2, A.sh.x + 6, A.sh.y + 6); ctx.stroke();
  }

  function drawTorso(ctx, R, K) {
    ctx.save();
    ctx.translate(R.hip.x, R.hip.y);
    ctx.rotate(R.lean);
    const b = (R.breath || 0) * 1.4;
    const f = (R.turn - 0.45) * 5;
    ctx.beginPath();
    ctx.moveTo(-10, 3);
    ctx.quadraticCurveTo(-15, -10, -19 - b, -25);    // lats
    ctx.quadraticCurveTo(-23 - b, -35, -12, -39);    // back of the shoulder → trap
    ctx.quadraticCurveTo(0, -47 - b * 0.4, 13, -40);  // traps
    ctx.quadraticCurveTo(23 + b, -35, 21 + b, -24);   // front shoulder, chest
    ctx.quadraticCurveTo(19 + b, -12, 12, 3);         // belly
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 12, -42, -16, 2, K.skin); ctx.fill();
    ctx.lineWidth = 1.3; ctx.strokeStyle = K.line; ctx.stroke();
    // highlight on the chest
    ctx.fillStyle = K.hi;
    ellipse(ctx, P(11 + f * 0.4, -29), 6, 3.4, -0.25); ctx.fill();
    // muscles: pecs, abs, serratus, the line of the traps
    ctx.strokeStyle = K.shade; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(2 + f * 0.5, -32); ctx.quadraticCurveTo(4 + f * 0.6, -21, 12 + f * 0.6, -20); ctx.quadraticCurveTo(18 + b, -21, 21 + b, -25);
    ctx.moveTo(8 + f * 0.6, -19); ctx.lineTo(6.5 + f * 0.5, 0);
    for (const y of [-14, -8.5, -3]) { ctx.moveTo(1.5 + f * 0.5, y); ctx.quadraticCurveTo(7 + f * 0.5, y + 1.2, 13.5 + f * 0.4, y - 0.4); }
    ctx.moveTo(15, -15); ctx.lineTo(18, -18); ctx.moveTo(14.5, -10.5); ctx.lineTo(17, -13);
    ctx.moveTo(-6, -37); ctx.quadraticCurveTo(0, -40, 6, -38.5);
    ctx.stroke();
    if (K.scars) {
      ctx.strokeStyle = 'rgba(255,230,210,0.45)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(4, -30); ctx.lineTo(14, -24); ctx.moveTo(6, -12); ctx.lineTo(11, -5); ctx.stroke();
    }
    // the waistband of the shorts
    ctx.beginPath();
    ctx.moveTo(-12, -3); ctx.quadraticCurveTo(1, -5, 13.5, -3.5);
    ctx.lineTo(14, 6); ctx.quadraticCurveTo(1, 8, -12.5, 6.5);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 0, -4, 0, 7, K.shorts); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#24103a'; ctx.stroke();
    ctx.restore();
  }

  function drawHair(ctx, K) {
    ctx.beginPath();
    ctx.moveTo(-6.2, 2);
    const pts = [[-9.6, 0.5], [-12, -4.5], [-9.8, -7], [-11.2, -11.2], [-6.6, -11.8], [-5.8, -16.4], [-1.6, -13.8], [2, -17.2], [4.4, -13.6], [8.6, -15.2], [9, -11.6], [12.6, -10.8], [10.4, -8.2]];
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.quadraticCurveTo(6, -8.6, 2.5, -8);
    ctx.quadraticCurveTo(-2.6, -7, -4.6, -3.4);
    ctx.quadraticCurveTo(-5.4, -0.6, -6.2, 2);
    ctx.closePath();
    ctx.fillStyle = K.hair; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(-2, -12.5); ctx.moveTo(1, -11); ctx.lineTo(5, -13.5); ctx.stroke();
  }

  // the head, in head-local coordinates (also used for the tray icon)
  function headShape(ctx, R, K) {
    const f = (R.turn - 0.45) * 3.5;
    const m = clamp(R.mouth || 0, 0, 1);
    const jaw = m * 2.2;
    // skull & jaw
    ctx.beginPath();
    ctx.moveTo(-7.5, -2);
    ctx.bezierCurveTo(-8, -9, -2, -12.5, 3.5, -12);
    ctx.bezierCurveTo(8.5, -11.5, 11 + f * 0.3, -8, 11 + f * 0.3, -4);
    ctx.lineTo(12.6 + f * 0.4, -1.4);
    ctx.quadraticCurveTo(14.4 + f * 0.4, 1, 12.7 + f * 0.4, 2.5);
    ctx.lineTo(12.6 + f * 0.4, 4.4);
    ctx.quadraticCurveTo(13.2 + f * 0.4, 8.6 + jaw, 9.5, 10.6 + jaw);
    ctx.quadraticCurveTo(3, 12.6 + jaw, -2.5, 9);
    ctx.quadraticCurveTo(-7, 5, -7.5, -2);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, 10, -12, -6, 11, K.skin); ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = K.line; ctx.stroke();
    // ear
    ellipse(ctx, P(-2.8 + f * 0.2, 0.9), 1.7, 2.4, 0.2);
    ctx.fillStyle = K.skin[2]; ctx.fill(); ctx.lineWidth = 0.8; ctx.stroke();
    drawHair(ctx, K);
    // cheek & jaw muscle
    ctx.strokeStyle = K.shade; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(10.4 + f * 0.4, 3); ctx.quadraticCurveTo(8.6 + f * 0.3, 4.6, 8 + f * 0.3, 6.6); ctx.moveTo(3, 8.4); ctx.quadraticCurveTo(5.5, 6.6, 6.4, 3.6); ctx.stroke();
    // eyes under a heavy brow
    const lids = clamp(R.lids == null ? 1 : R.lids, 0, 1);
    const ex = 8.4 + f, ey = -2.2;
    if (lids > 0.15) {
      ellipse(ctx, P(ex, ey), 2.1, 1.25 * lids, -0.08); ctx.fillStyle = '#f4ffe8'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 0.7, ey + 0.1, 0.95, 0, TAU); ctx.fillStyle = K.iris; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 0.8, ey + 0.1, 0.45, 0, TAU); ctx.fillStyle = '#0b1205'; ctx.fill();
      if (R.turn > 0.58) { ellipse(ctx, P(12.4 + f * 1.1, ey - 0.2), 1, 1 * lids, 0); ctx.fillStyle = '#f4ffe8'; ctx.fill(); ctx.beginPath(); ctx.arc(12.6 + f * 1.1, ey - 0.1, 0.45, 0, TAU); ctx.fillStyle = '#0b1205'; ctx.fill(); }
    } else {
      ctx.strokeStyle = K.line; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(ex - 2, ey + 0.2); ctx.quadraticCurveTo(ex, ey + 1.2, ex + 2, ey + 0.2); ctx.stroke();
    }
    const anger = clamp(R.brow == null ? 1 : R.brow, 0, 1);
    ctx.beginPath();
    ctx.moveTo(4.6 + f, -4.6 - 0.6 * (1 - anger));
    ctx.lineTo(11.8 + f, -3.4 + 0.9 * anger - 0.6);
    ctx.lineTo(11.4 + f, -1.9 + 0.6 * anger - 0.4);
    ctx.lineTo(5, -3.1);
    ctx.closePath();
    ctx.fillStyle = K.brow; ctx.fill();
    ctx.strokeStyle = K.shade; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(6 + f, -6.6); ctx.lineTo(9.5 + f, -5.8); ctx.moveTo(10 + f * 0.5, -7.6); ctx.lineTo(11 + f * 0.4, -5.5); ctx.stroke();
    // mouth: gritted teeth, a grin, or a roar
    const mx = 7.2 + f * 0.5;
    if (m > 0.25) {
      const o = 1.2 + 5.2 * m;
      ctx.beginPath();
      ctx.moveTo(mx, 4.6); ctx.lineTo(12.4 + f * 0.4, 4.4); ctx.lineTo(12.2 + f * 0.4, 4.6 + o); ctx.quadraticCurveTo(10, 5.4 + o, mx + 0.6, 4.8 + o * 0.85);
      ctx.closePath();
      ctx.fillStyle = '#3a0b10'; ctx.fill();
      ctx.lineWidth = 0.9; ctx.strokeStyle = K.line; ctx.stroke();
      ctx.fillStyle = '#f6f6e8';
      ctx.fillRect(mx + 0.6, 4.7, 4.6, 1.1);
      ctx.fillRect(mx + 1.2, 3.9 + o, 3.8, 0.9);
      ctx.fillStyle = '#c23b4a';
      ellipse(ctx, P(mx + 2.6, 4.2 + o * 0.85), 1.8, 0.8, 0); ctx.fill();
    } else {
      const g = R.grin || 0;
      ctx.beginPath();
      ctx.moveTo(mx, 5.6 - g * 0.8);
      ctx.quadraticCurveTo(mx + 2.6, 6.4 + g * 1.4, 12.4 + f * 0.4, 5.3 - g * 1.2);
      ctx.lineTo(12.4 + f * 0.4, 6.4 - g * 0.6);
      ctx.quadraticCurveTo(mx + 2.6, 7.8 + g * 1.2, mx, 6.6 - g * 0.4);
      ctx.closePath();
      ctx.fillStyle = '#f2f2e2'; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = K.line; ctx.stroke();
      ctx.beginPath();
      for (let i = 1; i < 4; i++) { const x = mx + i * 1.3; ctx.moveTo(x, 5.6); ctx.lineTo(x, 7.2); }
      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(40,40,30,0.55)'; ctx.stroke();
    }
  }

  function drawHead(ctx, R, K) {
    ctx.save();
    ctx.translate(R.head.x, R.head.y);
    ctx.rotate(R.lean * 0.5 + R.headTilt);
    ctx.fillStyle = K.skin[2];
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(8, 6); ctx.lineTo(6, 13); ctx.lineTo(-5, 13); ctx.closePath(); ctx.fill();
    headShape(ctx, R, K);
    ctx.restore();
  }

  function drawRock(ctx, x, y, r, a, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a || 0);
    const n = 9;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      const rr = r * (0.78 + 0.22 * abs(sin(i * 2.7 + (seed || 0))));
      if (i === 0) ctx.moveTo(cos(ang) * rr, sin(ang) * rr); else ctx.lineTo(cos(ang) * rr, sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = grad(ctx, -r * 0.6, -r, r * 0.5, r, ['#a39b8e', '#6f665a', '#3f3a33']); ctx.fill();
    ctx.lineWidth = max(0.8, r * 0.08); ctx.strokeStyle = '#2a2621'; ctx.stroke();
    ctx.strokeStyle = 'rgba(30,26,22,0.55)'; ctx.lineWidth = max(0.5, r * 0.06);
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.15); ctx.lineTo(r * 0.45, -r * 0.1); ctx.moveTo(-r * 0.1, r * 0.5); ctx.lineTo(r * 0.15, r * 0.25); ctx.stroke();
    // a strip of floor still on top
    ctx.fillStyle = 'rgba(200,205,215,0.55)';
    ctx.fillRect(-r * 0.55, -r * 0.82, r * 1.0, r * 0.18);
    ctx.restore();
  }

  // Bruce Banner: small, tired, glasses, his pants now torn to shreds
  function drawBanner(ctx, R, T) {
    const t = R.bt || 0;
    const sk = ['#f4cfad', '#d9a27c', '#9c6a4a'], line = '#4a2e1e';
    const pants = ['#a37bd0', '#6e44a0', '#3e2160'];
    const sway = sin(T * 1.3) * 0.5;
    const hip = P(sway * 0.3, -31);
    const feet = [P(-4, -1), P(4.5, -1)];
    // legs (baggy torn trousers)
    for (const [i, ft] of [[1, feet[1]], [0, feet[0]]]) {
      const hp = add(hip, P(i ? 2.5 : -2.5, 0));
      limb(ctx, hp, add(ft, P(0, -5)), 7.6, 6.2, i ? [pants[1], pants[2], pants[2]] : pants, '#2a1640');
      ctx.fillStyle = i ? sk[1] : sk[0];
      ctx.beginPath(); ctx.ellipse(ft.x + 1.6, ft.y - 0.6, 3.6, 1.6, 0, 0, TAU); ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = line; ctx.stroke();
      ctx.fillStyle = '#f4f0e8';
      ctx.beginPath(); ctx.moveTo(ft.x - 3.4, ft.y - 6); ctx.lineTo(ft.x - 1.5, ft.y - 3.5); ctx.lineTo(ft.x, ft.y - 6.2); ctx.lineTo(ft.x + 1.8, ft.y - 3.6); ctx.lineTo(ft.x + 3.4, ft.y - 6); ctx.closePath();
      ctx.fillStyle = pants[2]; ctx.fill();
    }
    // torso with a torn shirt
    const sh = add(hip, P(1, -17));
    ctx.beginPath();
    ctx.moveTo(hip.x - 5, hip.y + 1); ctx.lineTo(sh.x - 6.5, sh.y); ctx.quadraticCurveTo(sh.x, sh.y - 2.5, sh.x + 6, sh.y);
    ctx.lineTo(hip.x + 5, hip.y + 1); ctx.closePath();
    ctx.fillStyle = grad(ctx, sh.x + 5, sh.y, hip.x - 5, hip.y, sk); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
    ctx.fillStyle = 'rgba(236,232,222,0.95)';
    ctx.beginPath(); ctx.moveTo(sh.x - 6.5, sh.y); ctx.lineTo(sh.x - 4, sh.y + 7); ctx.lineTo(sh.x - 2.5, sh.y + 3); ctx.lineTo(sh.x - 1, sh.y + 6); ctx.lineTo(sh.x, sh.y - 1.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hip.x - 5, hip.y - 1); ctx.lineTo(hip.x - 3, hip.y - 5); ctx.lineTo(hip.x, hip.y - 2.5); ctx.lineTo(hip.x + 2, hip.y - 5.5); ctx.lineTo(hip.x + 5, hip.y - 1); ctx.closePath(); ctx.fill();
    // arms: one hangs, one scratches his head
    const k = 0.5 + 0.5 * sin(t * 2.2);
    const shN = add(sh, P(-4.5, 1.5)), shF = add(sh, P(4.5, 1));
    limb(ctx, shN, add(hip, P(-4, 1)), 3.6, 3, sk, line);
    const head = add(sh, P(1.5, -7));
    const scratch = add(head, P(-2 + k * 1.5, -5));
    const el = add(shF, P(6, -4));
    limb(ctx, shF, el, 3.6, 3.2, [sk[1], sk[2], sk[2]], line);
    limb(ctx, el, scratch, 3.2, 2.8, [sk[1], sk[2], sk[2]], line);
    // head: messy brown hair going grey, glasses
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(-0.08 + 0.06 * sin(t * 1.5));
    ctx.beginPath(); ctx.ellipse(0.6, 0, 5, 5.8, 0, 0, TAU);
    ctx.fillStyle = grad(ctx, 4, -5, -3, 5, sk); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = line; ctx.stroke();
    ctx.fillStyle = '#4b3527';
    ctx.beginPath(); ctx.moveTo(-4.8, 1.5); ctx.lineTo(-5.6, -3); ctx.lineTo(-3.6, -6.4); ctx.lineTo(0, -7.4); ctx.lineTo(3.4, -6.8); ctx.lineTo(5.6, -4.4); ctx.lineTo(4.4, -3.2); ctx.lineTo(1, -4.4); ctx.lineTo(-2, -3); ctx.lineTo(-3, 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(210,210,210,0.6)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(-4.4, -2); ctx.lineTo(-3.4, -5); ctx.stroke();
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(3.4, -0.6, 1.7, 0, TAU); ctx.moveTo(1.7, -0.7); ctx.lineTo(-0.4, -0.9); ctx.stroke();
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(3.6, -0.5, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = line; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(2.5, 3); ctx.quadraticCurveTo(3.6, 2.5, 4.6, 3.1); ctx.stroke(); // a worried mouth
    ctx.restore();
  }

  // Draw the Hulk (or Banner). opts: { look (skin), T, h }
  function drawHero(ctx, R, opts) {
    opts = opts || {};
    const K = SKINS[opts.look] || SKINS[opts.suit] || SKINS.green;
    const T = opts.T || 0;
    ctx.save();
    ctx.translate(R.ox, R.oy);
    if (R.grow !== 1) ctx.scale(R.grow, R.grow);
    if (R.rot) { ctx.translate(R.hip.x, R.hip.y); ctx.rotate(R.rot); ctx.translate(-R.hip.x, -R.hip.y); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (R.banner > 0.5) { drawBanner(ctx, R, T); ctx.restore(); return; }
    // rampage: a green haze around him
    if (R.rage > 0.5 || R.glow > 0.02) {
      const a = max(R.glow, R.rage > 0.5 ? 0.35 + 0.15 * sin(T * 9) : 0);
      const c = add(R.chest, P(0, -6));
      const g = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, 70);
      g.addColorStop(0, `rgba(150,255,90,${0.55 * a})`); g.addColorStop(1, 'rgba(150,255,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 70, 0, TAU); ctx.fill();
    }
    drawLeg(ctx, R.legs[1], K, true);
    drawArm(ctx, R.arms[1], K, true);
    drawTorso(ctx, R, K);
    drawLeg(ctx, R.legs[0], K, false);
    drawHead(ctx, R, K);
    drawArm(ctx, R.arms[0], K, false);
    if (R.carry > 0.5) {
      const m = lp(R.arms[0].hand, R.arms[1].hand, 0.5);
      drawRock(ctx, m.x, m.y - 18, 15, 0.2, 3);
    }
    if (R.glow > 0.02) {
      // gamma light pouring off him as he changes back
      const c = add(R.chest, P(0, -10));
      const g = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, 60);
      g.addColorStop(0, `rgba(210,255,170,${0.7 * R.glow})`); g.addColorStop(1, 'rgba(150,255,90,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 60, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // hero-local points for effects and callouts
  function points(R) {
    const tr = (p) => {
      let q = { x: p.x, y: p.y };
      if (R.rot) q = add(R.hip, rot(sub(q, R.hip), R.rot));
      return { x: q.x * R.grow + R.ox, y: q.y * R.grow + R.oy };
    };
    if (R.banner > 0.5) { const hd = tr(P(2.5, -55)); return { head: hd, eyes: hd, palms: [tr(P(-3, -31)), tr(P(4, -60))], hand: tr(P(4, -60)), reactor: tr(P(1, -40)) }; }
    const eyes = add(R.head, rot(P(9, -2), R.lean * 0.5 + R.headTilt));
    return { head: tr(R.head), eyes: tr(eyes), palms: R.arms.map((A) => tr(A.hand)), hand: tr(R.arms[1].hand), reactor: tr(R.chest), hip: tr(R.hip) };
  }

  // ------------------------------------------------------------------ callouts & the hover card
  const hash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return abs(h); };

  // big comic lettering ("HULK SMASH!"); Banner talks in plain small type
  function callout(ctx, text, x, y, a, tone, h) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (h && h.form === 'banner') {
      ctx.font = 'italic 600 8px "Segoe UI", system-ui, sans-serif';
      ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(20,20,30,0.85)'; ctx.strokeText(text, 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillText(text, 0, 0);
      ctx.restore();
      return;
    }
    const sz = tone === 'tag' ? 8 : tone === 'warn' || /!$/.test(text) ? 12 : 10;
    ctx.rotate(((hash(text) % 7) - 3) * 0.014);
    ctx.font = `900 ${sz}px Impact, Haettenschweiler, "Arial Black", sans-serif`;
    ctx.lineWidth = 3.4; ctx.strokeStyle = 'rgba(10,26,4,0.95)'; ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -sz / 2, 0, sz / 2);
    if (tone === 'warn') { g.addColorStop(0, '#fff07a'); g.addColorStop(1, '#ff7a2e'); } else { g.addColorStop(0, '#d8ff9a'); g.addColorStop(1, '#5ccf28'); }
    ctx.fillStyle = g; ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function card(ctx, h, x, bottom) {
    const meters = h.meters || [];
    const w = 98, hh = 22 + meters.length * 10;
    ctx.save();
    ctx.translate(x - w / 2, bottom - hh);
    rrect(ctx, 0, 0, w, hh, 5);
    ctx.fillStyle = 'rgba(12,30,9,0.9)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#4f9d2a'; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = '900 9px Impact, Haettenschweiler, "Arial Black", sans-serif';
    ctx.fillStyle = '#8dff5a';
    ctx.fillText(((h.form === 'banner' ? 'BANNER' : 'HULK') + ' · ' + h.status.toUpperCase()).slice(0, 26), 6, 9);
    ctx.font = '700 7px "Segoe UI", system-ui, sans-serif';
    meters.forEach((m, i) => {
      const y = 21 + i * 10;
      ctx.fillStyle = '#cfeec0'; ctx.fillText(m.short || m.label, 6, y);
      ctx.fillStyle = 'rgba(141,255,90,0.16)'; ctx.fillRect(28, y - 2.5, w - 36, 5);
      ctx.fillStyle = m.v < 20 && m.k !== 'rage' ? '#ff4d5e' : m.color; ctx.fillRect(28, y - 2.5, (w - 36) * clamp(m.v / 100, 0, 1), 5);
    });
    ctx.restore();
  }

  // ------------------------------------------------------------------ boulders, stunned robots, effects
  function drawShot(ctx, p, x, y) {
    if (p.kind !== 'boulder') return false;
    const r = 11 * (p.size || 1);
    drawRock(ctx, x, y, r, (p.age || 0) * 7 * Math.sign(p.vx || 1), (hash(p.id || 'b') % 10));
    return true;
  }

  const STAR_R = { drone: 18, mini: 11, walker: 24, tank: 20, boss: 62 };
  function drawEnemyOverlay(ctx, e, T, cy) {
    if (!(e.stun > 0) || e.stunKind !== 'daze') return;
    const r = STAR_R[e.kind] || 18;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = T * 5 + (i * TAU) / 3;
      const x = cos(a) * r * 0.7, y = cy - r - 6 + sin(a) * 3;
      ctx.beginPath();
      for (let j = 0; j < 10; j++) { const rr = j % 2 ? 1.2 : 2.8; const b = -PI / 2 + (j * PI) / 5; ctx.lineTo(x + cos(b) * rr, y + sin(b) * rr); }
      ctx.closePath();
      ctx.fillStyle = '#ffe14a'; ctx.fill();
      ctx.lineWidth = 0.6; ctx.strokeStyle = '#6b4a00'; ctx.stroke();
    }
    ctx.restore();
  }

  function expandFx(e, S, spawn) {
    const z = e.size || S;
    switch (e.kind) {
      case 'stomp':
        spawn({ kind: 'smoke', x: e.x, y: e.y - 2, n: 2, spread: 7 * z, size: 0.5 * z, life: 0.55, rise: 8 });
        return true;
      case 'smash':
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 2, size: 2.3 * z, life: 0.6, flat: 0.22, color: '190,255,140', stagger: 0.12 });
        spawn({ kind: 'flash', x: e.x, y: e.y - 6 * z, n: 1, size: 1.1 * z, life: 0.3, color: '170,255,120' });
        spawn({ kind: 'debris', x: e.x, y: e.y - 3, n: 16, speed: 380 * z, size: 1.1 * z, life: 1.1, g: 900, color: '#6f6458' });
        spawn({ kind: 'smoke', x: e.x, y: e.y - 6, n: 8, spread: 34 * z, size: 1.3 * z, life: 1.2, rise: 25 });
        return true;
      case 'clap':
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 1.7 * z, life: 0.55, color: '225,255,210', stagger: 0.08 });
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 1.4 * z, life: 0.25, color: '255,255,240' });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 10, speed: 320 * z, size: z, life: 0.35 });
        return true;
      case 'rubble':
        spawn({ kind: 'debris', x: e.x, y: e.y - 3, n: 10, speed: 240 * z, size: 1.1 * z, life: 1, g: 900, color: '#6f6458' });
        spawn({ kind: 'smoke', x: e.x, y: e.y - 4, n: 4, spread: 16 * z, size: 0.9 * z, life: 0.9, rise: 18 });
        return true;
      case 'whack':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 0.9 * z, life: 0.2, color: '255,250,200' });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 7, speed: 220 * z, size: z, life: 0.35 });
        return true;
      case 'roar':
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 2, size: 1.9 * z, life: 0.7, color: '150,255,100', stagger: 0.18 });
        return true;
      case 'gamma':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 2.4 * z, life: 0.6, color: '120,255,80' });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: 1.6 * z, life: 0.6, color: '120,255,80' });
        spawn({ kind: 'thrust', x: e.x, y: e.y, n: 12, speed: 140 * z, size: 1.4 * z, life: 0.8, color: '140,255,90' });
        return true;
      default:
        return false;
    }
  }

  // ------------------------------------------------------------------ sounds (synthesized)
  // a growl: detuned saws through "aah" formants with a fast wobble, plus breath
  function growl(L, dur, f0, f1, vol) {
    const c = L.ctx(); if (!c) return;
    const t = c.currentTime + 0.01;
    const out = L.gain(0);
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(vol, t + 0.08);
    out.gain.setValueAtTime(vol, t + dur * 0.65); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const fa = L.filt('bandpass', 620, 2.2), fb = L.filt('bandpass', 1250, 3), lp2 = L.filt('lowpass', 2400, 0.7);
    for (const [m, type, v] of [[1, 'sawtooth', 0.6], [1.5, 'square', 0.22], [0.5, 'sawtooth', 0.35]]) {
      const o = c.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(f0 * m, t);
      o.frequency.linearRampToValueAtTime(f0 * m * 1.12, t + dur * 0.3);
      o.frequency.linearRampToValueAtTime(f1 * m, t + dur);
      const lfo = c.createOscillator(); lfo.frequency.value = 26 + Math.random() * 8;
      const lg = L.gain(f0 * m * 0.09); lfo.connect(lg); lg.connect(o.frequency);
      const g = L.gain(v);
      o.connect(g); g.connect(fa); g.connect(fb);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    }
    const n = L.noise(), nf = L.filt('bandpass', 900, 0.8), ng = L.gain(0.3);
    n.connect(nf); nf.connect(ng); ng.connect(lp2);
    n.start(t, Math.random()); n.stop(t + dur + 0.05);
    fa.connect(lp2); fb.connect(lp2); lp2.connect(out); out.connect(L.out());
  }

  const SOUNDS = {
    hulkStomp: (L) => { L.blip('sine', 82, 36, 0.22, 0.42); L.hiss('lowpass', 260, 0.7, 0.16, 0.26); },
    hulkLeap: (L) => { L.blip('sine', 120, 48, 0.25, 0.42); L.hiss('bandpass', 380, 0.9, 0.35, 0.22, 0.05, 1400); },
    hulkLand: (L) => {
      L.hiss('lowpass', 420, 0.8, 0.9, 0.6); L.blip('sine', 75, 24, 0.7, 0.6);
      for (let i = 0; i < 5; i++) L.hiss('bandpass', 900 + Math.random() * 900, 1.2, 0.07, 0.16, 0.08 + i * 0.09);
    },
    hulkSmash: (L) => {
      L.hiss('lowpass', 520, 0.8, 1.1, 0.65); L.blip('sine', 68, 20, 0.9, 0.65);
      for (let i = 0; i < 7; i++) L.hiss('bandpass', 700 + Math.random() * 1200, 1.3, 0.07, 0.18, 0.06 + i * 0.08);
    },
    hulkClap: (L) => { L.hiss('highpass', 2200, 0.7, 0.07, 0.9); L.hiss('bandpass', 700, 0.8, 0.7, 0.45, 0.03, 120); L.blip('sine', 160, 40, 0.5, 0.45, 0.02); },
    hulkPunch: (L) => { L.blip('sine', 180, 55, 0.13, 0.5); L.hiss('lowpass', 1400, 0.8, 0.09, 0.42); L.hiss('bandpass', 2600, 4, 0.05, 0.12, 0.01); },
    hulkWhoosh: (L) => L.hiss('bandpass', 250, 1, 0.5, 0.3, 0, 1600),
    hulkRip: (L) => { for (let i = 0; i < 5; i++) L.hiss('bandpass', 500 + Math.random() * 700, 1.4, 0.09, 0.3, i * 0.07); L.blip('sine', 110, 45, 0.3, 0.35, 0.05); },
    hulkGrunt: (L) => growl(L, 0.34, 125, 95, 0.3),
    hulkRoar: (L) => growl(L, 1.3, 105, 68, 0.55),
    hulkKo: (L) => growl(L, 0.9, 110, 52, 0.32),
  };

  // ------------------------------------------------------------------ avatars, portrait, icons
  function rigFor(name, T, t, extra) {
    const R = makeRig(name, { t: t == null ? 1 : t, T, phase: 0, m: { h: extra || null } });
    return R;
  }

  function drawBust(ctx, look, T) {
    const R = rigFor('stand', T);
    R.turn = 0.7;
    drawHero(ctx, R, { look, T });
  }

  // head and shoulders inside a 46×46 circle
  function drawAvatar(ctx, look, T) {
    const R = rigFor('stand', T);
    R.turn = 0.72;
    ctx.save();
    ctx.translate(10, 112);
    ctx.scale(1.12, 1.12);
    drawHero(ctx, R, { look, T });
    ctx.restore();
  }

  // the home window header: feet at the origin, ~90 px of height to fill
  function drawPortrait(ctx, state, T, look) {
    const h = state.hero || {};
    const rage = ((h.meters || []).find((m) => m.k === 'rage') || {}).v || 0;
    let name = 'stand';
    if (/Banner/.test(h.status || '')) name = 'banner';
    else if (h.mode === 'down') name = 'down';
    else if (rage > 70 && sin(T * 0.6) > 0.5) name = 'roar';
    else if (sin(T * 0.25) > 0.6) name = 'flex';
    const R = makeRig(name, { t: name === 'roar' || name === 'flex' ? 1 : T % 4, T, phase: 0, m: {} });
    R.turn = Math.max(R.turn, 0.6);
    ctx.scale(0.86, 0.86);
    drawHero(ctx, R, { look, T });
  }

  // the app icon: a flexing Hulk bursting out of a gamma glow (size × size, rounded square)
  function drawIcon(ctx, size, look) {
    const k = size / 1024;
    ctx.save();
    ctx.scale(k, k);
    const r = 220;
    ctx.beginPath(); ctx.moveTo(r, 40); ctx.arcTo(984, 40, 984, 984, r); ctx.arcTo(984, 984, 40, 984, r); ctx.arcTo(40, 984, 40, 40, r); ctx.arcTo(40, 40, 984, 40, r); ctx.closePath();
    const bg = ctx.createRadialGradient(512, 430, 40, 512, 520, 620);
    bg.addColorStop(0, '#5ec22e'); bg.addColorStop(0.45, '#22560f'); bg.addColorStop(1, '#0a1a05');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); ctx.clip();
    // gamma burst
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      ctx.beginPath(); ctx.moveTo(512, 470);
      ctx.lineTo(512 + cos(a - 0.07) * 900, 470 + sin(a - 0.07) * 900); ctx.lineTo(512 + cos(a + 0.07) * 900, 470 + sin(a + 0.07) * 900);
      ctx.closePath(); ctx.fillStyle = 'rgba(160,255,100,0.07)'; ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // cracked floor
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(512, 1000, 420, 70, 0, 0, TAU); ctx.fill();
    const R = makeRig('flex', { t: 1, T: 0.6, phase: 0, m: {} });
    R.turn = 0.88; R.grin = 0; R.mouth = 0.85; R.headTilt = -0.12;
    ctx.translate(505, 1075);
    ctx.scale(9.2, 9.2);
    drawHero(ctx, R, { look: look || 'green', T: 0.6 });
    ctx.restore();
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
    ctx.restore();
  }

  // the tray icon: his angry face (size × size, transparent background)
  function drawTray(ctx, size, look) {
    const K = SKINS[look] || SKINS.green;
    ctx.save();
    ctx.translate(size * 0.44, size * 0.56);
    ctx.scale(size / 30, size / 30);
    const R = { turn: 0.7, mouth: 0.15, grin: 0, brow: 1, lids: 1 };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    headShape(ctx, R, K);
    ctx.restore();
  }

  root.HeroArts = root.HeroArts || {};
  root.HeroArts.hulk = {
    name: 'HULK', theme: 'gamma', looks: SKINS, lookKey: 'hulkSkin', body: 1.4,
    POSES, makeRig, lerpRig, drawHero, points, drawBust, drawAvatar, drawPortrait, drawIcon, drawTray,
    callout, calloutHeight: 16, card, cardTitle: (h) => (h.form === 'banner' ? 'BANNER' : 'HULK'),
    trail: () => {}, loop: null,
    drawShot, drawEnemyOverlay, expandFx,
    sounds: SOUNDS,
    voice: { prefer: /david|guy|george|daniel|mark|ralph|fred|male/i, pitch: 0.4, rate: 0.82 },
    brief: { done: 'HULK DONE!', snooze: (m) => `${m} MIN`, time: (a) => `IT ${a.time}. NOW!`, sound: 'hulkRoar' },
    menuName: (s) => `RAGE ${Math.round(s.hero.rage || 0)}% · ${s.hero.status}`,
    allyLabel: null,
    avatarBg: 'rgba(124,255,79,0.16)', shadowTint: 'rgba(124,255,79,0.18)',
  };
})(typeof window !== 'undefined' ? window : globalThis);
