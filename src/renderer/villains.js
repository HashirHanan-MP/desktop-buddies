/*
 * Desktop Buddies — the enemies, drawn in code: Ultron's robot army (sentries, mini-drones,
 * soldiers, heavies) and the villains — Thanos, Doctor Doom, Kang the Conqueror and the giant
 * Galactus. (Original fan-made drawings for personal use; the characters belong to Marvel.)
 *
 * Replaces IronArt.ENEMIES entries (drawEnemy reads that object) and adds what ironScene.js
 * asks VillainArt for: sprite boxes, projectiles, beams, effects. Enemy coordinates: origin =
 * feet on the floor (flyers: their middle), facing right (drawEnemy mirrors for facing left),
 * y down. Sounds register as HeroArts.villains.sounds (looked up by sound.js by name).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, abs, max, min, hypot, atan2, PI } = Math;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const IA = root.IronArt;
  const glow = IA.glow;

  // ------------------------------------------------------------------ palette & helpers
  const MET = ['#f1f4f8', '#b9c1cc', '#6d7684'];   // Ultron silver
  const MET_DARK = ['#9aa3b0', '#626b78', '#353b45'];
  const LINE = '#1d2129';
  const RED = '#ff3b2f', RED_HALO = '255,60,40';

  function grad(ctx, x1, y1, x2, y2, cols) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]);
    return g;
  }

  // a tapered limb from a to b with an outline
  function limb(ctx, ax, ay, bx, by, w1, w2, cols, line) {
    const dx = bx - ax, dy = by - ay, l = hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    ctx.beginPath();
    ctx.moveTo(ax + nx * w1 / 2, ay + ny * w1 / 2);
    ctx.lineTo(bx + nx * w2 / 2, by + ny * w2 / 2);
    ctx.arc(bx, by, w2 / 2, atan2(ny, nx), atan2(ny, nx) - PI, true);
    ctx.lineTo(ax - nx * w1 / 2, ay - ny * w1 / 2);
    ctx.arc(ax, ay, w1 / 2, atan2(-ny, -nx), atan2(-ny, -nx) - PI, true);
    ctx.closePath();
    ctx.fillStyle = grad(ctx, ax - nx * w1 / 2, ay - ny * w1 / 2, ax + nx * w1 / 2, ay + ny * w1 / 2, cols);
    ctx.fill();
    ctx.lineWidth = 1.1; ctx.strokeStyle = line || LINE; ctx.stroke();
  }

  // two-bone leg/arm: root → (joint bent) → end
  function joint(ax, ay, bx, by, L1, L2, bend) {
    const dx = bx - ax, dy = by - ay, d = hypot(dx, dy) || 0.001;
    if (d >= L1 + L2) return { x: ax + dx * L1 / (L1 + L2), y: ay + dy * L1 / (L1 + L2) };
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(max(0, L1 * L1 - a * a));
    return { x: ax + dx / d * a - dy / d * h * bend, y: ay + dy / d * a + dx / d * h * bend };
  }

  function eye(ctx, x, y, r, halo, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * (2 + 2 * (k || 0)), halo, 0.55 + 0.45 * (k || 0));
    ctx.restore();
  }

  function filled(ctx, fill, line, lw) {
    ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.lineWidth = lw || 1.1; ctx.strokeStyle = line; ctx.stroke(); }
  }

  // health bar; bosses always show theirs, with the name (text drawn unmirrored)
  function hpBar(ctx, e, w, y, name) {
    if (!name && e.hp >= e.maxHp) return;
    const k = clamp(e.hp / e.maxHp, 0, 1);
    ctx.save();
    if (e.facing < 0) ctx.scale(-1, 1);
    const h = name ? 4 : 2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = name ? (k > 0.35 ? '#b44dff' : '#ff4d5e') : k > 0.35 ? '#ff5a4f' : '#ffb02e';
    ctx.fillRect(-w / 2, y, w * k, h);
    if (name) {
      ctx.font = '800 8px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(name, 0, y - 2);
      ctx.fillStyle = '#ffffff'; ctx.fillText(name, 0, y - 2);
    }
    ctx.restore();
  }

  // the Ultron face: domed brow, angry slit eyes, a jagged glowing mouth
  function ultronHead(ctx, r, k, T) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, -r * 0.25);
    ctx.quadraticCurveTo(-r * 1.0, -r * 1.05, 0, -r * 1.12);
    ctx.quadraticCurveTo(r * 1.0, -r * 1.05, r * 0.95, -r * 0.25);
    ctx.lineTo(r * 0.72, r * 0.55);
    ctx.quadraticCurveTo(r * 0.4, r * 1.05, 0, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.4, r * 1.05, -r * 0.72, r * 0.55);
    ctx.closePath();
    filled(ctx, grad(ctx, -r, -r, r, r, MET), LINE, 1);
    // cheek / brow plates
    ctx.strokeStyle = 'rgba(30,34,42,0.55)'; ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.35); ctx.lineTo(-r * 0.15, -r * 0.05);
    ctx.moveTo(r * 0.75, -r * 0.35); ctx.lineTo(r * 0.15, -r * 0.05);
    ctx.moveTo(-r * 0.6, r * 0.45); ctx.lineTo(-r * 0.3, r * 0.95);
    ctx.moveTo(r * 0.6, r * 0.45); ctx.lineTo(r * 0.3, r * 0.95);
    ctx.stroke();
    // eyes: angry slanted slits
    ctx.fillStyle = RED;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sd * r * 0.72, -r * 0.42);
      ctx.lineTo(sd * r * 0.16, -r * 0.12);
      ctx.lineTo(sd * r * 0.2, r * 0.05);
      ctx.lineTo(sd * r * 0.7, -r * 0.18);
      ctx.closePath(); ctx.fill();
    }
    // mouth: a jagged grin
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, r * 0.42);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-r * 0.45 + i * r * 0.15, r * (i % 2 ? 0.52 : 0.42) + r * 0.12 * k);
    ctx.lineTo(r * 0.45, r * 0.6 + r * 0.1 * k);
    ctx.quadraticCurveTo(0, r * 0.82 + r * 0.1 * k, -r * 0.45, r * 0.6 + r * 0.1 * k);
    ctx.closePath();
    ctx.fillStyle = '#ff6a3a'; ctx.fill();
    eye(ctx, -r * 0.42, -r * 0.22, r * 0.28, RED_HALO, k);
    eye(ctx, r * 0.42, -r * 0.22, r * 0.28, RED_HALO, k);
    void T;
  }

  // ------------------------------------------------------------------ Ultron's army
  const ENEMIES = {
    // Ultron sentry: a flying Ultron head with thruster pods
    drone(ctx, e, T) {
      const tilt = clamp((e.vx || 0) / 600, -0.35, 0.35);
      ctx.save();
      ctx.rotate(tilt);
      for (const sd of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(sd * 13, 4, 4.2, 6, sd * 0.3, 0, TAU);
        filled(ctx, grad(ctx, sd * 13, -2, sd * 13, 10, MET_DARK), LINE, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(0, 9, 0, 20);
        g.addColorStop(0, 'rgba(255,170,90,0.95)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(sd * 13 - 2.4, 9); ctx.lineTo(sd * 13 + 2.4, 9); ctx.lineTo(sd * 13, 17 + 3 * sin(T * 40 + sd)); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ultronHead(ctx, 10, e.charge || 0, T);
      ctx.restore();
      hpBar(ctx, e, 24, -18);
    },

    // Ultron mini-drone: a little silver orb with one red eye and spinning blades
    mini(ctx, e, T) {
      ctx.save();
      ctx.rotate(T * 5 + (e.seed || 0));
      ctx.fillStyle = MET_DARK[1];
      for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.ellipse(8, 0, 4.5, 1.6, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, 5.8, 0, TAU);
      filled(ctx, grad(ctx, 0, -6, 0, 6, MET), LINE, 1);
      ctx.beginPath(); ctx.ellipse(1.5, 0, 2.6, 1.6, 0, 0, TAU); ctx.fillStyle = RED; ctx.fill();
      eye(ctx, 1.5, 0, 1.6, RED_HALO, 0.5 + 0.5 * sin(T * 12));
    },

    // Ultron soldier: a silver humanoid robot that fires red beams from its palm
    walker(ctx, e, T) {
      const ph = e.phase || 0, s = sin(ph), c2 = cos(ph);
      const k = e.charge || 0;
      const hip = { x: 0, y: -23 + abs(s) * 0.8 };
      // back leg & arm (darker)
      const legPts = (sd) => {
        const foot = { x: 7 * sd * s, y: -1 - 3 * max(0, -sd * c2) };
        const kn = joint(hip.x, hip.y, foot.x, foot.y, 12, 12, -1);
        return { foot, kn };
      };
      const back = legPts(-1), front = legPts(1);
      limb(ctx, hip.x - 1, hip.y, back.kn.x, back.kn.y, 6, 5, MET_DARK);
      limb(ctx, back.kn.x, back.kn.y, back.foot.x, back.foot.y, 5, 4, MET_DARK);
      ctx.fillStyle = MET_DARK[2]; ctx.fillRect(back.foot.x - 3.5, back.foot.y - 2, 8, 3);
      const sh = { x: 1, y: hip.y - 17 };
      limb(ctx, sh.x - 4, sh.y, -6, hip.y - 4 + 2 * s, 5, 4.5, MET_DARK);
      // torso: a V-shaped chest plate with a red core
      ctx.beginPath();
      ctx.moveTo(-8.5, sh.y - 3); ctx.lineTo(9, sh.y - 3);
      ctx.lineTo(6.5, hip.y - 3); ctx.lineTo(3.5, hip.y + 1); ctx.lineTo(-3.5, hip.y + 1); ctx.lineTo(-6.5, hip.y - 3);
      ctx.closePath();
      filled(ctx, grad(ctx, -9, sh.y, 9, hip.y, MET), LINE);
      ctx.strokeStyle = 'rgba(30,34,42,0.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, sh.y - 2); ctx.lineTo(0, hip.y - 1); ctx.moveTo(-7, sh.y + 4); ctx.lineTo(7.5, sh.y + 4); ctx.stroke();
      ctx.beginPath(); ctx.arc(0.5, sh.y + 7, 2, 0, TAU); ctx.fillStyle = RED; ctx.fill();
      eye(ctx, 0.5, sh.y + 7, 1.6, RED_HALO, k);
      // front leg
      limb(ctx, hip.x + 1, hip.y, front.kn.x, front.kn.y, 6, 5, MET);
      limb(ctx, front.kn.x, front.kn.y, front.foot.x, front.foot.y, 5, 4, MET);
      ctx.fillStyle = MET[2]; ctx.fillRect(front.foot.x - 3.5, front.foot.y - 2, 8, 3);
      // head
      ctx.save(); ctx.translate(1.5, sh.y - 8); ultronHead(ctx, 6.2, k, T); ctx.restore();
      // the firing arm, aimed forward at chest height
      const hand = { x: 17, y: -26 };
      const el = joint(sh.x + 5, sh.y + 1, hand.x, hand.y, 8, 9, 1);
      limb(ctx, sh.x + 5, sh.y + 1, el.x, el.y, 5, 4.5, MET);
      limb(ctx, el.x, el.y, hand.x, hand.y, 4.5, 4.2, MET);
      ctx.beginPath(); ctx.arc(sh.x + 5, sh.y + 1, 3.6, 0, TAU); filled(ctx, grad(ctx, 0, sh.y - 3, 0, sh.y + 4, MET), LINE, 1);
      if (k > 0.05) eye(ctx, hand.x + 1.5, hand.y, 2 + 2 * k, RED_HALO, k);
      hpBar(ctx, e, 24, -60);
    },

    // Ultron heavy: a hulking Ultron with a cannon arm
    tank(ctx, e, T) {
      const ph = e.phase || 0, s = sin(ph);
      const k = e.charge || 0;
      const hip = { x: -1, y: -22 + abs(s) * 0.8 };
      const lp = (sd) => ({ x: 6 * sd * s, y: -1 });
      for (const sd of [-1, 1]) {
        const f = lp(sd);
        const kn = joint(hip.x + sd * 3, hip.y, f.x, f.y, 11, 11, -1);
        const cols = sd < 0 ? MET_DARK : MET;
        limb(ctx, hip.x + sd * 3, hip.y, kn.x, kn.y, 9, 8, cols);
        limb(ctx, kn.x, kn.y, f.x, f.y, 8, 7.5, cols);
        ctx.fillStyle = cols[2]; ctx.fillRect(f.x - 5, -3, 11, 3.5);
      }
      // back arm
      limb(ctx, -11, -44, -15, -26, 8, 7, MET_DARK);
      ctx.beginPath(); ctx.arc(-15, -25, 4.5, 0, TAU); filled(ctx, MET_DARK[1], LINE, 1);
      // massive torso
      ctx.beginPath();
      ctx.moveTo(-15, -50); ctx.quadraticCurveTo(0, -56, 15, -50);
      ctx.lineTo(13, -30); ctx.quadraticCurveTo(8, -20, 0, -20); ctx.quadraticCurveTo(-8, -20, -13, -30);
      ctx.closePath();
      filled(ctx, grad(ctx, -15, -55, 15, -20, MET), LINE, 1.2);
      ctx.strokeStyle = 'rgba(30,34,42,0.5)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-10, -40); ctx.quadraticCurveTo(0, -36, 10, -40); ctx.moveTo(0, -48); ctx.lineTo(0, -22); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -42, 3.2, 0, TAU); ctx.fillStyle = RED; ctx.fill();
      eye(ctx, 0, -42, 2.6, RED_HALO, k);
      // shoulder plates
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 14, -48, 7, 5.5, sd * 0.3, 0, TAU); filled(ctx, grad(ctx, 0, -54, 0, -43, sd < 0 ? MET_DARK : MET), LINE, 1); }
      // small head sunk between the shoulders
      ctx.save(); ctx.translate(1.5, -55); ultronHead(ctx, 5.6, k, T); ctx.restore();
      // cannon arm
      ctx.save();
      ctx.translate(13, -40);
      ctx.rotate(e.aim != null ? e.aim * 0.6 + 0.35 : 0.2);
      limb(ctx, 0, 0, 6, 11, 8, 8, MET);
      ctx.translate(6, 13);
      ctx.beginPath(); ctx.rect(-2, -4, 16, 8); filled(ctx, grad(ctx, 0, -4, 0, 4, MET_DARK), LINE, 1);
      ctx.beginPath(); ctx.rect(13, -3, 3, 6); ctx.fillStyle = '#2a1414'; ctx.fill();
      if (k > 0.05) eye(ctx, 16, 0, 2 + 3 * k, '255,140,60', k);
      ctx.restore();
      hpBar(ctx, e, 32, -66);
    },
  };

  // ------------------------------------------------------------------ Thanos
  const TH = {
    skin: ['#a98bd6', '#8667ba', '#563b86'], suit: ['#4f69c9', '#2f448f', '#1b2757'],
    gold: ['#ffe28a', '#e2ad38', '#94620e'], line: '#1c1428',
    stones: ['#ff3b3b', '#ff9b2e', '#ffe14a', '#3ee07a', '#3fa0ff', '#b35cff'],
  };

  ENEMIES.thanos = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const ph = e.phase || 0, s = sin(ph);
    const breathe = sin(T * 1.6) * 0.8;
    const hip = { x: 0, y: -58 + abs(s) * 1.2 };
    // legs
    for (const sd of [-1, 1]) {
      const foot = { x: sd * 9 + 9 * sd * s * 0.6, y: -2 };
      const kn = joint(hip.x + sd * 7, hip.y, foot.x, foot.y, 30, 29, -1);
      const cols = sd < 0 ? [TH.suit[1], TH.suit[2], TH.suit[2]] : TH.suit;
      limb(ctx, hip.x + sd * 7, hip.y, kn.x, kn.y, 17, 14, cols, TH.line);
      limb(ctx, kn.x, kn.y, foot.x, foot.y, 14, 12, cols, TH.line);
      // gold boots and knee guards
      ctx.beginPath(); ctx.moveTo(foot.x - 7, foot.y - 12); ctx.lineTo(foot.x + 6, foot.y - 12); ctx.lineTo(foot.x + 13, foot.y); ctx.lineTo(foot.x - 8, foot.y + 1); ctx.closePath();
      filled(ctx, grad(ctx, 0, foot.y - 12, 0, foot.y, TH.gold), TH.line);
      ctx.beginPath(); ctx.ellipse(kn.x + 1, kn.y, 6, 5, 0, 0, TAU); filled(ctx, grad(ctx, kn.x, kn.y - 5, kn.x, kn.y + 5, TH.gold), TH.line);
    }
    const sh = { x: 2, y: hip.y - 46 + breathe };
    // the back arm: raised behind for a throw (holding a rock) or pumping when slamming
    const throwK = st === 'throw' ? k : 0, slamK = st === 'slam' ? k : 0;
    const bHand = st === 'throw' ? { x: lerp(-30, -20, throwK), y: lerp(sh.y + 22, sh.y - 40, throwK) }
      : st === 'slam' ? { x: lerp(-18, 4, slamK), y: lerp(sh.y + 20, sh.y - 46, slamK) } : { x: -22, y: sh.y + 34 + 2 * s };
    const bEl = joint(sh.x - 17, sh.y + 4, bHand.x, bHand.y, 22, 22, st === 'throw' ? -1 : 1);
    limb(ctx, sh.x - 17, sh.y + 4, bEl.x, bEl.y, 14, 12, [TH.skin[1], TH.skin[2], TH.skin[2]], TH.line);
    limb(ctx, bEl.x, bEl.y, bHand.x, bHand.y, 12, 11, [TH.skin[1], TH.skin[2], TH.skin[2]], TH.line);
    ctx.beginPath(); ctx.arc(bHand.x, bHand.y, 7, 0, TAU); filled(ctx, grad(ctx, bHand.x, bHand.y - 7, bHand.x, bHand.y + 7, [TH.gold[1], TH.gold[2], TH.gold[2]]), TH.line);
    if (st === 'throw') drawRock(ctx, bHand.x, bHand.y - 13, 1.4, T * 0.5);
    // torso: blue suit, gold chest plate & belt
    ctx.beginPath();
    ctx.moveTo(-22, sh.y + 2); ctx.quadraticCurveTo(2, sh.y - 6, 26, sh.y + 2);
    ctx.lineTo(19, hip.y - 6); ctx.quadraticCurveTo(2, hip.y + 2, -15, hip.y - 6);
    ctx.closePath();
    filled(ctx, grad(ctx, -22, sh.y, 24, hip.y, TH.suit), TH.line, 1.3);
    ctx.beginPath();
    ctx.moveTo(-14, sh.y + 4); ctx.quadraticCurveTo(2, sh.y + 1, 18, sh.y + 4); ctx.lineTo(13, sh.y + 22); ctx.quadraticCurveTo(2, sh.y + 27, -9, sh.y + 22); ctx.closePath();
    filled(ctx, grad(ctx, 0, sh.y, 0, sh.y + 26, TH.gold), TH.line);
    ctx.strokeStyle = 'rgba(80,50,0,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(2, sh.y + 3); ctx.lineTo(2, sh.y + 25); ctx.moveTo(-9, sh.y + 12); ctx.quadraticCurveTo(2, sh.y + 15, 14, sh.y + 12); ctx.stroke();
    ctx.beginPath(); ctx.rect(-16, hip.y - 9, 36, 7); filled(ctx, grad(ctx, 0, hip.y - 9, 0, hip.y - 2, TH.gold), TH.line);
    // gold shoulder pads
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sh.x + sd * 19, sh.y + 3, 11, 8, sd * 0.25, PI, TAU);
      ctx.lineTo(sh.x + sd * 19 + 11, sh.y + 6); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 6, 0, sh.y + 6, TH.gold), TH.line);
    }
    // head: purple, the ridged chin, a gold crested helmet
    const hd = { x: 5, y: sh.y - 16 };
    ctx.beginPath(); ctx.rect(hd.x - 6, hd.y + 6, 12, 8); filled(ctx, TH.skin[1], TH.line);
    ctx.beginPath();
    ctx.moveTo(hd.x - 10, hd.y - 6); ctx.lineTo(hd.x + 11, hd.y - 6); ctx.lineTo(hd.x + 12, hd.y + 6);
    ctx.quadraticCurveTo(hd.x + 10, hd.y + 15, hd.x + 2, hd.y + 16); ctx.quadraticCurveTo(hd.x - 7, hd.y + 15, hd.x - 9, hd.y + 6); ctx.closePath();
    filled(ctx, grad(ctx, hd.x - 10, hd.y - 6, hd.x + 12, hd.y + 16, TH.skin), TH.line, 1.2);
    // chin ridges
    ctx.strokeStyle = 'rgba(40,20,70,0.6)'; ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(hd.x + 2 + i * 2.6, hd.y + 9); ctx.lineTo(hd.x + 2 + i * 2.4, hd.y + 15); }
    ctx.stroke();
    // eyes & a grim mouth
    ctx.fillStyle = '#1b0f2e';
    ctx.fillRect(hd.x - 3, hd.y + 1, 4, 1.6); ctx.fillRect(hd.x + 5, hd.y + 1, 4, 1.6);
    ctx.beginPath(); ctx.moveTo(hd.x - 2, hd.y + 8); ctx.quadraticCurveTo(hd.x + 3, hd.y + (st === 'slam' ? 11 : 7), hd.x + 8, hd.y + 8); ctx.lineWidth = 1.1; ctx.strokeStyle = '#2a1740'; ctx.stroke();
    // helmet
    ctx.beginPath();
    ctx.moveTo(hd.x - 12, hd.y + 4); ctx.lineTo(hd.x - 12, hd.y - 7); ctx.quadraticCurveTo(hd.x + 1, hd.y - 17, hd.x + 13, hd.y - 7); ctx.lineTo(hd.x + 13, hd.y + 4);
    ctx.lineTo(hd.x + 11, hd.y - 3); ctx.lineTo(hd.x - 10, hd.y - 3); ctx.closePath();
    filled(ctx, grad(ctx, 0, hd.y - 15, 0, hd.y + 4, TH.gold), TH.line);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hd.x + 1 + sd * 9, hd.y - 9); ctx.lineTo(hd.x + 1 + sd * 15, hd.y - 22); ctx.lineTo(hd.x + 1 + sd * 5, hd.y - 12); ctx.closePath();
      filled(ctx, grad(ctx, 0, hd.y - 22, 0, hd.y - 9, TH.gold), TH.line);
    }
    // the gauntlet arm: raised forward to fire, a fist when slamming, at rest otherwise
    const beamK = st === 'charging' ? k : st === 'firing' ? 1 : 0;
    const fist = st === 'charging' || st === 'firing' ? { x: 30, y: -128 }
      : st === 'slam' ? { x: lerp(28, 14, slamK), y: lerp(sh.y + 20, sh.y - 50, slamK) } : { x: 26, y: sh.y + 32 - 2 * s };
    const fEl = joint(sh.x + 19, sh.y + 4, fist.x, fist.y, 22, 22, st === 'charging' || st === 'firing' ? 1 : -1);
    limb(ctx, sh.x + 19, sh.y + 4, fEl.x, fEl.y, 14, 12, TH.skin, TH.line);
    limb(ctx, fEl.x, fEl.y, fist.x, fist.y, 13, 12, TH.gold, TH.line);
    ctx.beginPath(); ctx.arc(fist.x, fist.y, 8, 0, TAU); filled(ctx, grad(ctx, fist.x, fist.y - 8, fist.x, fist.y + 8, TH.gold), TH.line, 1.2);
    // the six stones
    for (let i = 0; i < 6; i++) {
      const a = -PI * 0.85 + i * 0.32;
      const sx = fist.x + cos(a) * 5, sy = fist.y + sin(a) * 5;
      ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, TAU); ctx.fillStyle = TH.stones[i]; ctx.fill();
    }
    if (beamK > 0.02 || st === 'slam') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, fist.x, fist.y, 14 + 18 * beamK, '200,120,255', 0.35 + 0.65 * max(beamK, slamK));
      for (let i = 0; i < 6; i++) {
        const a = T * 2 + i * TAU / 6, r = 12 + 6 * sin(T * 4 + i);
        glow(ctx, fist.x + cos(a) * r * beamK, fist.y + sin(a) * r * beamK, 4, hexRgb(TH.stones[i]), 0.8 * beamK);
      }
      ctx.restore();
    }
    hpBar(ctx, e, 70, -150, 'THANOS');
  };

  // ------------------------------------------------------------------ Doctor Doom
  const DOOM_K = 1.35, KANG_K = 1.4; // drawing scale of the two human-sized villains
  const DM = {
    cloak: ['#3fa25a', '#256b3a', '#123a20'], tunic: ['#56b86c', '#2f7a43', '#1a4a28'],
    metal: ['#f0f3f6', '#a9b2bd', '#5f6874'], line: '#0f1a12', glowc: '90,255,140',
  };

  ENEMIES.doom = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const bob = sin(T * 2.2) * 1.5;
    const sway = clamp((e.vx || 0) / 400, -0.4, 0.4);
    ctx.save();
    ctx.translate(0, bob);
    ctx.scale(DOOM_K, DOOM_K); // drawn ~70 units tall, shown bigger than a hero
    // the cloak, streaming behind as he floats
    ctx.beginPath();
    ctx.moveTo(-6, -24);
    ctx.quadraticCurveTo(-24 - 8 * abs(sway), -2, -26 - 6 * sin(T * 3), 34 + 2 * sin(T * 2.4));
    ctx.quadraticCurveTo(-12, 30 + 3 * sin(T * 3.3), 2, 34);
    ctx.lineTo(8, -20); ctx.closePath();
    filled(ctx, grad(ctx, -26, -24, 4, 34, DM.cloak), DM.line, 1.2);
    // legs (armored, together, hanging) + boots
    for (const sd of [-1, 1]) {
      const cols = sd < 0 ? [DM.metal[1], DM.metal[2], DM.metal[2]] : DM.metal;
      limb(ctx, sd * 3, 6, sd * 3 + 2, 22, 6.5, 5.5, cols, DM.line);
      limb(ctx, sd * 3 + 2, 22, sd * 2 + 4, 34, 5.5, 5, cols, DM.line);
    }
    // tunic & belt
    ctx.beginPath();
    ctx.moveTo(-9, -16); ctx.lineTo(10, -16); ctx.lineTo(11, 8); ctx.lineTo(13, 14); ctx.lineTo(-12, 14); ctx.lineTo(-10, 8); ctx.closePath();
    filled(ctx, grad(ctx, -10, -16, 10, 14, DM.tunic), DM.line, 1.1);
    ctx.beginPath(); ctx.rect(-10, 2, 21, 4); filled(ctx, '#8a6a2a', DM.line, 0.8);
    ctx.beginPath(); ctx.arc(0.5, 4, 2.2, 0, TAU); filled(ctx, '#d9b24a', DM.line, 0.6);
    // back arm
    const casting = st === 'charging' || st === 'firing';
    const reach = casting ? 1 : 0;
    const bh = { x: lerp(-8, 16, reach), y: lerp(4, -4, reach) };
    limb(ctx, -7, -12, bh.x, bh.y, 5.5, 5, [DM.metal[1], DM.metal[2], DM.metal[2]], DM.line);
    // head: the hood and the iron mask
    ctx.beginPath();
    ctx.moveTo(-10, -14); ctx.quadraticCurveTo(-13, -36, 2, -38); ctx.quadraticCurveTo(15, -36, 12, -14); ctx.closePath();
    filled(ctx, grad(ctx, -12, -38, 12, -14, DM.cloak), DM.line, 1.1);
    ctx.beginPath();
    ctx.moveTo(-6, -31); ctx.lineTo(8, -31); ctx.lineTo(8.5, -20); ctx.quadraticCurveTo(1, -15, -6.5, -20); ctx.closePath();
    filled(ctx, grad(ctx, -6, -31, 8, -16, DM.metal), DM.line, 0.9);
    // eye slits (glow when casting), mouth grille, rivets
    ctx.fillStyle = '#122016';
    ctx.fillRect(-4, -27.5, 4, 1.6); ctx.fillRect(2.5, -27.5, 4, 1.6);
    ctx.strokeStyle = '#2d3a33'; ctx.lineWidth = 0.6;
    ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(1 + i * 1.6, -22); ctx.lineTo(1 + i * 1.6, -19.5); } ctx.stroke();
    ctx.fillStyle = '#5f6874';
    for (const [rx, ry] of [[-5, -30], [7, -30], [-5, -21], [7, -21]]) { ctx.beginPath(); ctx.arc(rx, ry, 0.5, 0, TAU); ctx.fill(); }
    eye(ctx, -2, -26.8, 1.3, DM.glowc, casting ? 0.6 + 0.4 * k : 0.15);
    eye(ctx, 4.5, -26.8, 1.3, DM.glowc, casting ? 0.6 + 0.4 * k : 0.15);
    // front arm: casting forward with an open hand
    const fh = { x: lerp(10, 22, reach), y: lerp(6, -2, reach) };
    limb(ctx, 8, -12, fh.x, fh.y, 6, 5.5, DM.metal, DM.line);
    ctx.beginPath(); ctx.arc(fh.x, fh.y, 3.2, 0, TAU); filled(ctx, grad(ctx, fh.x, fh.y - 3, fh.x, fh.y + 3, DM.metal), DM.line, 0.8);
    if (casting || (e.charge || 0) > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = casting ? 0.5 + 0.5 * k : 0.3;
      glow(ctx, fh.x + 2, fh.y, 7 + 9 * a, DM.glowc, a);
      glow(ctx, bh.x + 2, bh.y, 5 + 6 * a, DM.glowc, a * 0.8);
      ctx.restore();
    }
    // the force field
    if (e.shield > 0) {
      const fa = clamp(e.shield / 0.4, 0, 1) * (0.75 + 0.25 * sin(T * 9));
      ctx.save();
      const g = ctx.createRadialGradient(0, -2, 22, 0, -2, 44);
      g.addColorStop(0, 'rgba(90,255,140,0)'); g.addColorStop(0.8, `rgba(90,255,140,${0.18 * fa})`); g.addColorStop(1, `rgba(170,255,200,${0.55 * fa})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -2, 44, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(170,255,200,${0.35 * fa})`; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + T * 0.6; ctx.moveTo(0, -2); ctx.lineTo(cos(a) * 44, -2 + sin(a) * 44); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    hpBar(ctx, e, 56, -50 * DOOM_K, 'DOCTOR DOOM');
  };

  // ------------------------------------------------------------------ Kang the Conqueror
  const KG = {
    mask: ['#7fb8ff', '#3f74d6', '#1e3b86'], purple: ['#c79bff', '#8a4fd8', '#4a2386'],
    green: ['#5fe08a', '#2fa35a', '#165c31'], line: '#160f28', glowc: '80,240,255',
  };

  ENEMIES.kang = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const ph = e.phase || 0, s = sin(ph);
    const warpAge = e.warp ? (Date.now() - e.warp) / 1000 : 9;
    ctx.save();
    ctx.scale(KANG_K, KANG_K); // drawn ~72 units tall, shown bigger than a hero
    if (warpAge < 0.6) ctx.globalAlpha *= clamp(warpAge / 0.6, 0.15, 1);
    const hip = { x: 0, y: -32 + abs(s) * 0.8 };
    for (const sd of [-1, 1]) {
      const foot = { x: sd * 4 + 7 * sd * s * 0.7, y: -1 };
      const kn = joint(hip.x + sd * 3, hip.y, foot.x, foot.y, 16, 16, -1);
      const g = sd < 0 ? [KG.green[1], KG.green[2], KG.green[2]] : KG.green;
      const p = sd < 0 ? [KG.purple[1], KG.purple[2], KG.purple[2]] : KG.purple;
      limb(ctx, hip.x + sd * 3, hip.y, kn.x, kn.y, 8, 7, g, KG.line);
      limb(ctx, kn.x, kn.y, foot.x, foot.y, 7, 6.5, p, KG.line);
      ctx.beginPath(); ctx.moveTo(foot.x - 4, -4); ctx.lineTo(foot.x + 6, -3); ctx.lineTo(foot.x + 7, 0.5); ctx.lineTo(foot.x - 4, 0.5); ctx.closePath(); filled(ctx, KG.purple[2], KG.line, 0.8);
    }
    const sh = { x: 1, y: hip.y - 24 };
    // back arm
    limb(ctx, sh.x - 7, sh.y + 2, -9, hip.y - 2 + 2 * s, 6, 5.5, [KG.green[1], KG.green[2], KG.green[2]], KG.line);
    // tunic with the purple chest strap
    ctx.beginPath();
    ctx.moveTo(-9, sh.y); ctx.lineTo(11, sh.y); ctx.lineTo(9, hip.y + 2); ctx.lineTo(-8, hip.y + 2); ctx.closePath();
    filled(ctx, grad(ctx, -9, sh.y, 10, hip.y, KG.green), KG.line, 1.1);
    ctx.beginPath(); ctx.moveTo(-8, sh.y + 2); ctx.lineTo(-3, sh.y + 2); ctx.lineTo(10, hip.y - 2); ctx.lineTo(5, hip.y - 2); ctx.closePath(); filled(ctx, KG.purple[1], null);
    ctx.beginPath(); ctx.rect(-8.5, hip.y - 3, 18, 4); filled(ctx, KG.purple[2], KG.line, 0.8);
    // the big purple collar
    ctx.beginPath();
    ctx.moveTo(-13, sh.y - 1); ctx.quadraticCurveTo(-12, sh.y - 14, -6, sh.y - 16); ctx.lineTo(-4, sh.y - 2);
    ctx.lineTo(7, sh.y - 2); ctx.lineTo(9, sh.y - 16); ctx.quadraticCurveTo(15, sh.y - 14, 15, sh.y - 1); ctx.closePath();
    filled(ctx, grad(ctx, 0, sh.y - 16, 0, sh.y, KG.purple), KG.line, 1);
    // head: the blue mask with the fins on its sides
    const hd = { x: 2, y: sh.y - 8 };
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y, 6.3, 7.4, 0, 0, TAU); filled(ctx, grad(ctx, hd.x - 6, hd.y - 7, hd.x + 6, hd.y + 7, KG.mask), KG.line, 1);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hd.x + sd * 5, hd.y - 3); ctx.lineTo(hd.x + sd * 12, hd.y - 11); ctx.lineTo(hd.x + sd * 7, hd.y + 3); ctx.closePath();
      filled(ctx, grad(ctx, 0, hd.y - 11, 0, hd.y + 3, KG.purple), KG.line, 0.8);
    }
    ctx.fillStyle = '#0d1b3a';
    ctx.beginPath(); ctx.moveTo(hd.x - 4, hd.y - 1.5); ctx.lineTo(hd.x - 0.5, hd.y - 0.5); ctx.lineTo(hd.x - 4, hd.y + 0.3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hd.x + 5, hd.y - 1.5); ctx.lineTo(hd.x + 1.5, hd.y - 0.5); ctx.lineTo(hd.x + 5, hd.y + 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d1b3a'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hd.x - 2, hd.y + 4); ctx.lineTo(hd.x + 3, hd.y + 4); ctx.stroke();
    // the time cannon arm, aimed forward
    const aim = st === 'burst' || st === 'charging' ? 1 : 0.4;
    const hand = { x: lerp(14, 22, aim), y: lerp(hip.y - 2, -46, aim) };
    const el = joint(sh.x + 8, sh.y + 2, hand.x, hand.y, 10, 11, 1);
    limb(ctx, sh.x + 8, sh.y + 2, el.x, el.y, 6, 5.5, KG.green, KG.line);
    limb(ctx, el.x, el.y, hand.x, hand.y, 6, 7, KG.purple, KG.line);
    ctx.beginPath(); ctx.rect(hand.x - 2, hand.y - 3, 9, 6); filled(ctx, '#2b2f45', KG.line, 0.8);
    const ck = max(k, st === 'burst' ? 0.7 : 0.15);
    eye(ctx, hand.x + 7, hand.y, 2 + 3 * ck, KG.glowc, ck);
    ctx.restore();
    // time-shimmer rings right after a jump through time
    if (warpAge < 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(80,240,255,${0.8 * (1 - warpAge / 0.6)})`; ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) { const r = (12 + i * 9 + warpAge * 40) * KANG_K; ctx.beginPath(); ctx.ellipse(0, -36 * KANG_K, r * 0.55, r, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    hpBar(ctx, e, 56, -88 * KANG_K, 'KANG');
  };

  // ------------------------------------------------------------------ Galactus (giant)
  const GA = {
    purple: ['#b88af0', '#7c4fc4', '#3f2378'], blue: ['#7cc6ff', '#3d7fd6', '#1e3f86'],
    face: ['#d6d1e2', '#9a93ae', '#5a5470'], line: '#120b24', eyes: '255,220,255',
  };

  ENEMIES.galactus = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const firing = st === 'firing', eyeK = st === 'charging' ? k : firing ? 1 : 0.25;
    ctx.save();
    ctx.scale(6, 6); // designed 100 units tall
    const breathe = sin(T * 0.9) * 0.4;
    const stompK = st === 'stomp' ? k : 0;
    const hip = { x: 0, y: -50 + breathe * 0.3 };
    // legs: the front one lifts for a stomp
    for (const sd of [-1, 1]) {
      const lift = sd > 0 ? stompK : 0;
      const foot = { x: sd * 7 + lift * 4, y: -1 - lift * 14 };
      const kn = joint(hip.x + sd * 6, hip.y, foot.x, foot.y, 25, 25, -1);
      const cols = sd < 0 ? [GA.blue[1], GA.blue[2], GA.blue[2]] : GA.blue;
      const pcols = sd < 0 ? [GA.purple[1], GA.purple[2], GA.purple[2]] : GA.purple;
      limb(ctx, hip.x + sd * 6, hip.y, kn.x, kn.y, 13, 10, cols, GA.line);
      limb(ctx, kn.x, kn.y, foot.x, foot.y, 10, 9, pcols, GA.line);
      ctx.beginPath(); ctx.moveTo(foot.x - 6, foot.y - 4); ctx.lineTo(foot.x + 8, foot.y - 3); ctx.lineTo(foot.x + 9, foot.y + 1); ctx.lineTo(foot.x - 6, foot.y + 1); ctx.closePath();
      filled(ctx, GA.purple[2], GA.line, 0.4);
      ctx.beginPath(); ctx.ellipse(kn.x, kn.y, 5.5, 4.5, 0, 0, TAU); filled(ctx, grad(ctx, kn.x, kn.y - 4, kn.x, kn.y + 4, GA.purple), GA.line, 0.4);
    }
    const sh = { x: 0, y: -78 + breathe };
    const orbK = st === 'orbs' ? 1 : 0;
    // back arm
    limb(ctx, sh.x - 13, sh.y + 2, -20, hip.y + 2, 9, 8, [GA.blue[1], GA.blue[2], GA.blue[2]], GA.line);
    ctx.beginPath(); ctx.arc(-20, hip.y + 3, 4.6, 0, TAU); filled(ctx, GA.purple[2], GA.line, 0.4);
    // torso: blue armour, purple side panels, the big chest emblem, belt
    ctx.beginPath();
    ctx.moveTo(-14, sh.y); ctx.quadraticCurveTo(0, sh.y - 4, 14, sh.y);
    ctx.lineTo(10, hip.y - 2); ctx.quadraticCurveTo(0, hip.y + 2, -10, hip.y - 2); ctx.closePath();
    filled(ctx, grad(ctx, -14, sh.y, 14, hip.y, GA.blue), GA.line, 0.5);
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sd * 13.5, sh.y + 1); ctx.lineTo(sd * 7, sh.y + 6); ctx.lineTo(sd * 6, hip.y - 4); ctx.lineTo(sd * 10, hip.y - 2); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y, 0, hip.y, GA.purple), GA.line, 0.35);
    }
    // chest emblem: a stylised "G" in a plate (kept readable when he faces left)
    ctx.beginPath(); ctx.rect(-5.5, sh.y + 5, 11, 10); filled(ctx, grad(ctx, 0, sh.y + 5, 0, sh.y + 15, GA.purple), GA.line, 0.4);
    ctx.save();
    if (e.facing < 0) ctx.scale(-1, 1);
    ctx.strokeStyle = '#ffe9ff'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, sh.y + 10, 3, 0.3, TAU - 0.6); ctx.moveTo(3, sh.y + 10.6); ctx.lineTo(0.6, sh.y + 10.6); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.rect(-10.5, hip.y - 5, 21, 4); filled(ctx, grad(ctx, 0, hip.y - 5, 0, hip.y - 1, GA.purple), GA.line, 0.4);
    // shoulder plates
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * 14, sh.y + 2, 7, 5, sd * 0.35, PI, TAU); ctx.lineTo(sd * 14 + 7, sh.y + 4); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 3, 0, sh.y + 4, GA.purple), GA.line, 0.4);
    }
    // head: the helmet with its two tall crests, a shadowed face, burning eyes
    const hd = { x: 1, y: -88 + breathe };
    ctx.beginPath(); ctx.rect(hd.x - 4, hd.y + 4, 8, 6); filled(ctx, GA.purple[2], GA.line, 0.4);
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hd.x + sd * 4, hd.y - 4);
      ctx.lineTo(hd.x + sd * 10, hd.y - 6);
      ctx.lineTo(hd.x + sd * 12, hd.y - 21);
      ctx.lineTo(hd.x + sd * 7, hd.y - 12);
      ctx.closePath();
      filled(ctx, grad(ctx, 0, hd.y - 21, 0, hd.y - 4, GA.purple), GA.line, 0.4);
    }
    ctx.beginPath();
    ctx.moveTo(hd.x - 7, hd.y + 5); ctx.lineTo(hd.x - 8, hd.y - 4); ctx.quadraticCurveTo(hd.x, hd.y - 12, hd.x + 8, hd.y - 4); ctx.lineTo(hd.x + 7, hd.y + 5); ctx.quadraticCurveTo(hd.x, hd.y + 8, hd.x - 7, hd.y + 5); ctx.closePath();
    filled(ctx, grad(ctx, 0, hd.y - 12, 0, hd.y + 7, GA.purple), GA.line, 0.45);
    ctx.beginPath(); ctx.moveTo(hd.x - 4.5, hd.y - 3); ctx.lineTo(hd.x + 5.5, hd.y - 3); ctx.lineTo(hd.x + 4.5, hd.y + 4); ctx.quadraticCurveTo(hd.x + 0.5, hd.y + 6.5, hd.x - 3.5, hd.y + 4); ctx.closePath();
    filled(ctx, grad(ctx, 0, hd.y - 3, 0, hd.y + 6, GA.face), GA.line, 0.35);
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(hd.x - 3.2, hd.y - 0.8, 2.6, 1); ctx.fillRect(hd.x + 1.6, hd.y - 0.8, 2.6, 1);
    ctx.strokeStyle = '#3a3252'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(hd.x - 1.6, hd.y + 3.2); ctx.lineTo(hd.x + 2.6, hd.y + 3.2); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, hd.x - 1.9, hd.y - 0.3, 1.6 + 3 * eyeK, GA.eyes, 0.4 + 0.6 * eyeK);
    glow(ctx, hd.x + 2.9, hd.y - 0.3, 1.6 + 3 * eyeK, GA.eyes, 0.4 + 0.6 * eyeK);
    ctx.restore();
    // front arm: raised palm-up to hurl cosmic orbs, hanging otherwise
    const hand = orbK ? { x: 21, y: -50 } : { x: 18 + stompK * 2, y: hip.y + 3 };
    const el = joint(sh.x + 13, sh.y + 2, hand.x, hand.y, 16, 16, orbK ? 1 : -1);
    limb(ctx, sh.x + 13, sh.y + 2, el.x, el.y, 9, 8, GA.blue, GA.line);
    limb(ctx, el.x, el.y, hand.x, hand.y, 8, 7, GA.purple, GA.line);
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.4, 0, TAU); filled(ctx, grad(ctx, hand.x, hand.y - 4, hand.x, hand.y + 4, GA.purple), GA.line, 0.4);
    if (orbK) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, hand.x, hand.y - 3, 9, '200,170,255', 0.8); ctx.restore(); }
    ctx.restore();
    hpBar(ctx, e, 150, -640, 'GALACTUS');
  };

  // ------------------------------------------------------------------ projectiles
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function drawRock(ctx, x, y, size, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
    ctx.beginPath();
    const pts = [[-7, -3], [-3, -7], [4, -6], [7, -1], [5, 5], [-1, 7], [-6, 4]];
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath();
    filled(ctx, grad(ctx, -6, -6, 6, 6, ['#a08a72', '#6f5c48', '#3f3226']), '#21180f', 1);
    ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(1, 1); ctx.moveTo(2, -3); ctx.lineTo(4, 2); ctx.stroke();
    ctx.restore();
  }

  function orb(ctx, x, y, r, halo, core) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y, r * 2.6, halo, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fillStyle = core; ctx.fill();
    ctx.restore();
  }

  // returns true if it drew this shot kind
  function drawShot(ctx, p, x, y, T) {
    const sz = p.size || 1;
    switch (p.kind) {
      case 'rock': drawRock(ctx, x, y, sz, (p.age || 0) * 6); return true;
      case 'mystic': {
        const a = atan2(p.vy, p.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 4; i++) glow(ctx, x - cos(a) * i * 5, y - sin(a) * i * 5, 6 - i, '90,255,140', 0.5 - i * 0.1);
        ctx.restore();
        orb(ctx, x, y, 4.5, '90,255,140', 'rgba(230,255,235,0.95)');
        return true;
      }
      case 'chrono': {
        const a = atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(80,240,255,0.5)'; ctx.fillRect(-16, -2.6, 18, 5.2);
        ctx.fillStyle = 'rgba(225,255,255,0.95)'; ctx.fillRect(-12, -0.9, 14, 1.8);
        ctx.strokeStyle = 'rgba(80,240,255,0.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(-10, 0, 1.6, 4, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'timeblast': {
        orb(ctx, x, y, 7 * sz * 0.6, '80,240,255', 'rgba(235,255,255,0.95)');
        ctx.save();
        ctx.strokeStyle = 'rgba(80,240,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 9 * sz * 0.6, 0, TAU); ctx.stroke();
        const a = T * 6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * 7, y + sin(a) * 7); ctx.moveTo(x, y); ctx.lineTo(x + cos(a / 12) * 5, y + sin(a / 12) * 5); ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'cosmic': {
        orb(ctx, x, y, 6 * sz, '200,170,255', 'rgba(255,250,255,0.98)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const a = T * 4 + i * PI / 2; glow(ctx, x + cos(a) * 9 * sz, y + sin(a) * 9 * sz, 2.5, '255,220,255', 0.7); }
        ctx.restore();
        return true;
      }
      default: return false;
    }
  }

  // ------------------------------------------------------------------ beams
  function lightning(ctx, x1, y1, x2, y2, w, T, seed) {
    const L = hypot(x2 - x1, y2 - y1), n = max(6, Math.floor(L / 26));
    const nx = -(y2 - y1) / (L || 1), ny = (x2 - x1) / (L || 1);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n, j = i === 0 || i === n ? 0 : sin(i * 12.9898 + Math.floor(T * 18) * 3.1 + seed) * w * 1.6;
      pts.push({ x: lerp(x1, x2, k) + nx * j, y: lerp(y1, y2, k) + ny * j });
    }
    const stroke = (lw, col) => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke();
    };
    stroke(w * 2.2, 'rgba(90,255,140,0.35)');
    stroke(w * 0.9, 'rgba(160,255,190,0.85)');
    stroke(w * 0.35, 'rgba(240,255,245,1)');
    return pts;
  }

  // returns true if it drew this beam
  function drawBeam(ctx, b, x1, y1, S, age, life, T) {
    const halo = b.color || '255,40,60', core = b.core || 'rgba(255,220,220,0.95)';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (b.kind === 'lightning') {
      ctx.globalAlpha = Math.min(1, life * 4, age * 8);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pts = lightning(ctx, x1, y1, b.x2, b.y2, b.w * S, T, 0);
      // a couple of forks
      for (let f = 1; f <= 2; f++) {
        const p = pts[Math.floor(pts.length * f / 3)];
        const a = atan2(b.y2 - y1, b.x2 - x1) + (f % 2 ? 0.6 : -0.6);
        lightning(ctx, p.x, p.y, p.x + cos(a) * 60 * S, p.y + sin(a) * 60 * S, b.w * S * 0.5, T, f * 7);
      }
      glow(ctx, x1, y1, 14 * S, halo, 0.9);
      ctx.restore();
      return true;
    }
    if (b.kind === 'gauntlet' || b.kind === 'cosmic') {
      ctx.globalAlpha = Math.min(1, life * 4, age * 8);
      ctx.globalCompositeOperation = 'source-over';
      if (b.kind === 'cosmic') {
        // two eye beams side by side
        const a = atan2(b.y2 - y1, b.x2 - x1), ox = -sin(a) * 6 * S, oy = cos(a) * 6 * S;
        IA.drawBeam(ctx, x1 - ox, y1 - oy, b.x2 - ox, b.y2 - oy, b.w * S * 0.6, age, halo, core);
        IA.drawBeam(ctx, x1 + ox, y1 + oy, b.x2 + ox, b.y2 + oy, b.w * S * 0.6, age, halo, core);
      } else {
        IA.drawBeam(ctx, x1, y1, b.x2, b.y2, b.w * S, age, halo, core);
        // the stones' colours sparkle along it
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const k = ((i / 12) + age * 0.8) % 1;
          glow(ctx, lerp(x1, b.x2, k), lerp(y1, b.y2, k), 6 * S, hexRgb(TH.stones[i % 6]), 0.8);
        }
      }
      ctx.restore();
      return true;
    }
    ctx.restore();
    return false;
  }

  // ------------------------------------------------------------------ effects
  IA.FX.timeportal = function (ctx, p) {
    ctx.globalCompositeOperation = 'lighter';
    const r = 26 * sin(p.k * PI);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(80,240,255,${(1 - p.k) * (0.9 - i * 0.25)})`;
      ctx.lineWidth = 2 - i * 0.5;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (0.45 + i * 0.12), r * (1 + i * 0.2), 0, 0, TAU); ctx.stroke();
    }
    glow(ctx, 0, 0, r * 0.9 + 1, '80,240,255', 0.6 * (1 - p.k));
    ctx.globalCompositeOperation = 'source-over';
  };

  // the sim's fx events for the villains (ironScene asks before its own)
  function expandFx(e, S, spawn) {
    switch (e.kind) {
      case 'timeportal':
        spawn({ kind: 'timeportal', x: e.x, y: e.y, n: 1, size: (e.size || 1) * S, life: 0.7 });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 8, speed: 140 * S, size: S, life: 0.4, color: '160,250,255' });
        return true;
      case 'galactusDown': {
        // the Devourer of Worlds falls: fire up his whole height, debris everywhere
        for (let i = 0; i < 9; i++) {
          const y = e.y - i * 66 * S;
          spawn({ kind: 'fire', x: e.x + (Math.random() - 0.5) * 120 * S, y, n: 6, spread: 50 * S, size: 3 * S, life: 1.2 });
          spawn({ kind: 'smoke', x: e.x, y, n: 4, spread: 70 * S, size: 3 * S, life: 2.2, rise: 30 });
        }
        spawn({ kind: 'flash', x: e.x, y: e.y - 300 * S, n: 1, size: 9 * S, life: 0.9, color: '230,200,255' });
        spawn({ kind: 'debris', x: e.x, y: e.y - 260 * S, n: 70, speed: 700 * S, size: 2.2 * S, life: 2.6, g: 500, color: '#6b4fb0' });
        spawn({ kind: 'ember', x: e.x, y: e.y - 200 * S, n: 50, speed: 420 * S, size: 2, life: 2.4, g: 100 });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 6 * S, life: 1.2, flat: 0.25, stagger: 0.2 });
        return true;
      }
      default: return false;
    }
  }

  // sprite boxes (enemy units) and the centre offsets used for the lock-on reticle
  const INFO = {
    drone: { box: { w: 60, h: 50, ax: 30, ay: 26 }, cy: 0, r: 22 },
    mini: { box: { w: 34, h: 34, ax: 17, ay: 17 }, cy: 0, r: 12 },
    walker: { box: { w: 70, h: 76, ax: 30, ay: 68 }, cy: -26, r: 24 },
    tank: { box: { w: 86, h: 80, ax: 40, ay: 72 }, cy: -28, r: 30 },
    thanos: { box: { w: 150, h: 180, ax: 66, ay: 170 }, cy: -66, r: 56 },
    doom: { box: { w: 140, h: 160, ax: 70, ay: 86 }, cy: 0, r: 46 },
    kang: { box: { w: 112, h: 150, ax: 50, ay: 138 }, cy: -50, r: 42 },
    galactus: { box: { w: 300, h: 680, ax: 140, ay: 668 }, cy: -150, r: 160 },
  };

  // ------------------------------------------------------------------ sounds
  const sounds = {
    gauntlet(L) { L.blip('sawtooth', 70, 140, 1.1, 0.12); L.blip('sine', 220, 660, 1.1, 0.08); L.hiss('bandpass', 400, 2, 1, 0.08, 0, 1600); },
    mystic(L) { [880, 1175, 1568].forEach((f, i) => L.blip('triangle', f, f * 0.7, 0.25, 0.06, i * 0.05)); L.hiss('bandpass', 1200, 1.5, 0.35, 0.12, 0, 3000); },
    lightning(L) { for (let i = 0; i < 6; i++) L.hiss('highpass', 2200 + Math.random() * 2000, 0.8, 0.06, 0.22, i * 0.12 + Math.random() * 0.05); L.blip('square', 90, 60, 0.7, 0.05); },
    shield(L) { L.blip('sine', 300, 900, 0.5, 0.08); L.blip('sine', 450, 1350, 0.5, 0.05, 0.05); },
    timeWarp(L) { L.blip('sine', 1400, 200, 0.35, 0.1); L.blip('sine', 200, 1400, 0.35, 0.08, 0.3); L.hiss('bandpass', 900, 3, 0.6, 0.08, 0, 2500); },
    chrono(L) { L.blip('square', 1800, 600, 0.09, 0.05); L.blip('sine', 2400, 1200, 0.08, 0.05); },
    timeBlast(L) { L.blip('sawtooth', 300, 90, 0.5, 0.1); L.hiss('lowpass', 900, 0.8, 0.4, 0.2); },
    cosmicHum(L) { [55, 82.5, 110].forEach((f) => L.blip('sawtooth', f, f * 1.02, 1.5, 0.08)); L.blip('sine', 440, 880, 1.5, 0.04); },
  };

  Object.assign(IA.ENEMIES, ENEMIES);
  root.VillainArt = { ENEMIES, INFO, drawShot, drawBeam, expandFx, drawRock };
  root.HeroArts = root.HeroArts || {};
  root.HeroArts.villains = { sounds, villains: true }; // only here so sound.js finds these by name
})(typeof window !== 'undefined' ? window : globalThis);
