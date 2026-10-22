/*
 * Desktop Buddies — the enemies, drawn in code: Ultron's robot army (sentries, drones, soldiers
 * and Ultron Prime), Doctor Doom's Doombots, and the villains — Thanos, Doctor Doom, Kang the
 * Conqueror and the giant Galactus. (Fan-made drawings for personal use; the characters belong
 * to Marvel.)
 *
 * Replaces IronArt.ENEMIES entries (drawEnemy reads that object) and adds what ironScene.js,
 * menu.js, home.js and overlay.js ask VillainArt for: sprite boxes, portraits (drawAvatar),
 * names and titles, projectiles, beams, effects and world overlays (storm marks, time freeze).
 * Enemy coordinates: origin = feet on the floor (flyers: their middle), facing right
 * (drawEnemy mirrors for facing left), y down. The sizes match ENEMY in src/main/ironman.js.
 * Sounds register as HeroArts.villains.sounds (looked up by sound.js by name).
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, abs, max, min, hypot, atan2, PI } = Math;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const IA = root.IronArt;
  const glow = IA.glow;

  // how much bigger than their base drawings the villains are shown (the sim uses the same sizes)
  const TH_K = 1.45, DOOM_K = 2.05, KANG_K = 2.1, GAL_K = 8.5, BOT_K = 1.2, ULT_K = 1.15;

  // ------------------------------------------------------------------ palette & helpers
  const MET = ['#f7f9fc', '#b4bfcb', '#5b6573'];       // Ultron chrome
  const MET_D = ['#a9b2be', '#69727f', '#363c46'];     // the far side
  const JOINT = '#2b3038';
  const LINE = '#1a1e26';
  const RED = '#ff2a1a', RED_HALO = '255,50,30';

  function grad(ctx, x1, y1, x2, y2, cols) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]);
    return g;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  function filled(ctx, fill, line, lw) {
    ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.lineWidth = lw || 1.1; ctx.strokeStyle = line; ctx.stroke(); }
  }

  // a tapered limb from a to b with an outline
  function limb(ctx, ax, ay, bx, by, w1, w2, cols, line, lw) {
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
    ctx.lineWidth = lw || 1.1; ctx.strokeStyle = line || LINE; ctx.stroke();
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

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  // health bar; bosses show theirs with the name (text drawn unmirrored). Portraits pass noBar.
  function hpBar(ctx, e, w, y, name) {
    if (e.noBar || (!name && e.hp >= e.maxHp)) return;
    const k = clamp(e.hp / e.maxHp, 0, 1);
    ctx.save();
    if (e.facing < 0) ctx.scale(-1, 1);
    const h = name ? 4 : 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = name ? (k > 0.35 ? '#b44dff' : '#ff4d5e') : k > 0.35 ? '#ff5a4f' : '#ffb02e';
    ctx.fillRect(-w / 2, y, w * k, h);
    if (name) {
      ctx.font = '800 9px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = 2.6; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(name, 0, y - 2);
      ctx.fillStyle = '#ffffff'; ctx.fillText(name, 0, y - 2);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Ultron
  // The face: a chrome skull with a sharp V jaw, a hard brow, glowing red eyes and a slit mouth.
  function ultronHead(ctx, r, k, prime) {
    const M = MET;
    const lw = max(0.5, r * 0.11);
    // ear disks
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * r * 0.98, -r * 0.14, r * 0.17, r * 0.34, 0, 0, TAU); filled(ctx, M[2], LINE, lw * 0.7); }
    if (prime) {
      // Ultron Prime: a crown of back-swept fins
      for (const sd of [-1, 1]) {
        poly(ctx, [sd * r * 0.5, -r * 1.05, sd * r * 1.25, -r * 1.55, sd * r * 0.95, -r * 0.7]);
        filled(ctx, grad(ctx, 0, -r * 1.5, 0, -r * 0.7, MET_D), LINE, lw * 0.8);
      }
    }
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3);
    ctx.quadraticCurveTo(r * 0.64, -r * 1.32, r * 0.88, -r * 0.92);
    ctx.lineTo(r * 0.97, -r * 0.3);
    ctx.lineTo(r * 0.87, r * 0.2);
    ctx.lineTo(r * 0.5, r * 0.86);
    ctx.lineTo(0, r * 1.42);
    ctx.lineTo(-r * 0.5, r * 0.86);
    ctx.lineTo(-r * 0.87, r * 0.2);
    ctx.lineTo(-r * 0.97, -r * 0.3);
    ctx.lineTo(-r * 0.88, -r * 0.92);
    ctx.quadraticCurveTo(-r * 0.64, -r * 1.32, 0, -r * 1.3);
    ctx.closePath();
    filled(ctx, grad(ctx, -r, -r * 1.3, r * 0.8, r * 1.4, M), LINE, lw);
    // the face plate: a V of darker metal from the cheekbones to the chin
    poly(ctx, [-r * 0.82, -r * 0.22, -r * 0.2, 0, r * 0.2, 0, r * 0.82, -r * 0.22, r * 0.72, r * 0.22, r * 0.36, r * 0.88, 0, r * 1.26, -r * 0.36, r * 0.88, -r * 0.72, r * 0.22]);
    ctx.fillStyle = 'rgba(36,42,54,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(28,32,40,0.6)'; ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.28); ctx.lineTo(0, -r * 0.5);
    ctx.moveTo(-r * 0.87, r * 0.2); ctx.lineTo(-r * 0.4, r * 0.44); ctx.lineTo(-r * 0.26, r * 1.02);
    ctx.moveTo(r * 0.87, r * 0.2); ctx.lineTo(r * 0.4, r * 0.44); ctx.lineTo(r * 0.26, r * 1.02);
    ctx.moveTo(0, r * 0.12); ctx.lineTo(0, r * 0.38);
    ctx.stroke();
    // brow: a hard dark V over the eyes
    poly(ctx, [-r * 0.92, -r * 0.52, 0, -r * 0.2, r * 0.92, -r * 0.52, r * 0.92, -r * 0.36, 0, -r * 0.04, -r * 0.92, -r * 0.36]);
    ctx.fillStyle = 'rgba(22,25,32,0.6)'; ctx.fill();
    // eyes
    ctx.fillStyle = RED;
    for (const sd of [-1, 1]) { poly(ctx, [sd * r * 0.76, -r * 0.32, sd * r * 0.15, -r * 0.05, sd * r * 0.2, r * 0.1, sd * r * 0.66, -r * 0.08]); ctx.fill(); }
    // mouth: a glowing slit with teeth
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.56); ctx.quadraticCurveTo(0, r * 0.7, r * 0.5, r * 0.56);
    ctx.lineTo(r * 0.42, r * 0.68 + r * 0.12 * k); ctx.quadraticCurveTo(0, r * 0.88 + r * 0.14 * k, -r * 0.42, r * 0.68 + r * 0.12 * k);
    ctx.closePath();
    ctx.fillStyle = '#ff5a26'; ctx.fill();
    ctx.strokeStyle = 'rgba(60,10,0,0.7)'; ctx.lineWidth = lw * 0.45;
    ctx.beginPath(); for (let i = -2; i <= 2; i++) { ctx.moveTo(i * r * 0.15, r * 0.6); ctx.lineTo(i * r * 0.15, r * 0.8); } ctx.stroke();
    eye(ctx, -r * 0.45, -r * 0.12, r * 0.32, RED_HALO, k);
    eye(ctx, r * 0.45, -r * 0.12, r * 0.32, RED_HALO, k);
    eye(ctx, 0, r * 0.66, r * 0.22, '255,110,40', k * 0.8);
  }

  // a segmented Ultron limb: chrome plates on a dark core, with a joint disc
  function uLimb(ctx, ax, ay, bx, by, w1, w2, cols) {
    limb(ctx, ax, ay, bx, by, w1 * 0.62, w2 * 0.62, [JOINT, '#20242b', '#14171c'], LINE, 0.6);
    const mx = lerp(ax, bx, 0.12), my = lerp(ay, by, 0.12), ex = lerp(ax, bx, 0.86), ey = lerp(ay, by, 0.86);
    limb(ctx, mx, my, ex, ey, w1, w2, cols, LINE, 0.8);
    // a seam across the plate
    const cx = lerp(ax, bx, 0.5), cy = lerp(ay, by, 0.5), l = hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / l, ny = (bx - ax) / l, hw = lerp(w1, w2, 0.5) * 0.45;
    ctx.strokeStyle = 'rgba(30,34,42,0.45)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx + nx * hw, cy + ny * hw); ctx.lineTo(cx - nx * hw, cy - ny * hw); ctx.stroke();
  }
  function disc(ctx, x, y, r, cols) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    filled(ctx, grad(ctx, x - r, y - r, x + r, y + r, cols || MET), LINE, 0.6);
    ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fillStyle = JOINT; ctx.fill();
  }
  // a three-clawed hand pointing from `from` toward `to`
  function claw(ctx, x, y, ang, r, cols, glowK) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.8, 0, 0, TAU); filled(ctx, grad(ctx, 0, -r, 0, r, cols), LINE, 0.6);
    ctx.strokeStyle = cols[2]; ctx.lineWidth = r * 0.45; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const a of [-0.55, 0, 0.55]) { ctx.moveTo(r * 0.6, a * r * 0.7); ctx.lineTo(r * 1.7, a * r * 1.3); }
    ctx.stroke();
    ctx.restore();
    if (glowK > 0.05) eye(ctx, x + cos(ang) * r * 1.2, y + sin(ang) * r * 1.2, r * (1 + 1.6 * glowK), RED_HALO, glowK);
  }
  // the torso: V-shaped chest with a red core, a segmented waist, pelvis and shoulder plates
  function uTorso(ctx, sh, hip, w, k, prime) {
    const cols = MET;
    // waist segments
    for (let i = 0; i < 3; i++) {
      const y = lerp(sh.y + w * 1.15, hip.y - w * 0.15, i / 2.4);
      ctx.beginPath(); ctx.ellipse(lerp(sh.x, hip.x, 0.6), y, w * (0.5 - i * 0.03), w * 0.2, 0, 0, TAU);
      filled(ctx, grad(ctx, 0, y - 2, 0, y + 2, MET_D), LINE, 0.5);
    }
    // pelvis
    poly(ctx, [hip.x - w * 0.62, hip.y - w * 0.3, hip.x + w * 0.62, hip.y - w * 0.3, hip.x + w * 0.4, hip.y + w * 0.32, hip.x, hip.y + w * 0.5, hip.x - w * 0.4, hip.y + w * 0.32]);
    filled(ctx, grad(ctx, hip.x - w, hip.y, hip.x + w, hip.y, cols), LINE, 0.7);
    // chest
    poly(ctx, [sh.x - w, sh.y - w * 0.2, sh.x + w * 1.04, sh.y - w * 0.2, sh.x + w * 0.85, sh.y + w * 0.75, sh.x + w * 0.38, sh.y + w * 1.12, sh.x - w * 0.38, sh.y + w * 1.12, sh.x - w * 0.82, sh.y + w * 0.75]);
    filled(ctx, grad(ctx, sh.x - w, sh.y - w, sh.x + w, sh.y + w * 1.2, cols), LINE, 0.8);
    ctx.strokeStyle = 'rgba(28,32,40,0.5)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(sh.x - w * 0.8, sh.y + w * 0.1); ctx.lineTo(sh.x, sh.y + w * 0.42); ctx.lineTo(sh.x + w * 0.82, sh.y + w * 0.1);
    ctx.moveTo(sh.x, sh.y + w * 0.42); ctx.lineTo(sh.x, sh.y + w * 1.1);
    ctx.stroke();
    // the red core
    const cr = w * (prime ? 0.3 : 0.24);
    ctx.beginPath(); ctx.arc(sh.x + w * 0.05, sh.y + w * 0.42, cr * 1.35, 0, TAU); filled(ctx, JOINT, LINE, 0.5);
    ctx.beginPath(); ctx.arc(sh.x + w * 0.05, sh.y + w * 0.42, cr, 0, TAU); ctx.fillStyle = RED; ctx.fill();
    eye(ctx, sh.x + w * 0.05, sh.y + w * 0.42, cr, RED_HALO, 0.3 + 0.7 * k);
  }
  function shoulder(ctx, x, y, r, sd, cols, prime) {
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.82, sd * 0.3, PI * 1.05, TAU * 0.99);
    ctx.lineTo(x + sd * r * 0.9, y + r * 0.45); ctx.lineTo(x - sd * r * 0.7, y + r * 0.45); ctx.closePath();
    filled(ctx, grad(ctx, x, y - r, x, y + r * 0.5, cols), LINE, 0.7);
    if (prime) { poly(ctx, [x - r * 0.3, y - r * 0.7, x + sd * r * 0.4, y - r * 1.7, x + sd * r * 0.7, y - r * 0.55]); filled(ctx, grad(ctx, x, y - r * 1.7, x, y - r * 0.5, MET_D), LINE, 0.6); }
  }
  function uLeg(ctx, hx, hy, kn, foot, cols, w) {
    uLimb(ctx, hx, hy, kn.x, kn.y, w, w * 0.85, cols);
    uLimb(ctx, kn.x, kn.y, foot.x, foot.y - w * 0.3, w * 0.85, w * 0.72, cols);
    disc(ctx, kn.x, kn.y, w * 0.5, cols);
    poly(ctx, [foot.x - w * 0.55, foot.y - w * 0.75, foot.x + w * 0.35, foot.y - w * 0.75, foot.x + w * 1.35, foot.y + 0.4, foot.x - w * 0.7, foot.y + 0.4]);
    filled(ctx, grad(ctx, foot.x, foot.y - w, foot.x, foot.y, cols), LINE, 0.6);
  }
  function uArm(ctx, sx, sy, hx, hy, L1, L2, bend, w, cols, glowK) {
    const el = joint(sx, sy, hx, hy, L1, L2, bend);
    uLimb(ctx, sx, sy, el.x, el.y, w, w * 0.9, cols);
    uLimb(ctx, el.x, el.y, hx, hy, w * 0.9, w * 0.8, cols);
    disc(ctx, el.x, el.y, w * 0.45, cols);
    claw(ctx, hx, hy, atan2(hy - el.y, hx - el.x), w * 0.55, cols, glowK || 0);
  }

  const ENEMIES = {
    // Ultron sentry: a hovering Ultron, red jets under its feet
    drone(ctx, e, T) {
      const tilt = clamp((e.vx || 0) / 700, -0.3, 0.3);
      const k = e.charge || 0;
      ctx.save();
      ctx.rotate(tilt);
      ctx.scale(ULT_K, ULT_K);
      const sh = { x: 0, y: -8 }, hip = { x: 0, y: 6 };
      // jets
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sd of [-1, 1]) {
        const fx = sd * 4, fy = 24;
        const g = ctx.createLinearGradient(0, fy, 0, fy + 14);
        g.addColorStop(0, 'rgba(255,190,120,0.95)'); g.addColorStop(1, 'rgba(255,50,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(fx - 2.4, fy); ctx.lineTo(fx + 2.4, fy); ctx.lineTo(fx, fy + 12 + 3 * sin(T * 40 + sd)); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      uLeg(ctx, -2.5, hip.y, { x: -4, y: 15 }, { x: -4.5, y: 23 }, MET_D, 5.4);
      uArm(ctx, -8, sh.y, -14, 8, 8, 8, -1, 4.4, MET_D, 0);
      uTorso(ctx, sh, hip, 8.2, k, false);
      shoulder(ctx, -8.5, sh.y - 0.5, 4.2, -1, MET_D);
      uLeg(ctx, 2.5, hip.y, { x: 4, y: 15 }, { x: 4.5, y: 23 }, MET, 5.4);
      ctx.save(); ctx.translate(0.5, sh.y - 9.5); ultronHead(ctx, 6, k); ctx.restore();
      shoulder(ctx, 8.5, sh.y - 0.5, 4.2, 1, MET);
      uArm(ctx, 8, sh.y, 18, sh.y + 4 - 4 * k, 8, 8, 1, 4.4, MET, k);
      ctx.restore();
      hpBar(ctx, e, 28, -36);
    },

    // Ultron drone: a small chrome dart with Ultron's red eyes and a jet behind it
    mini(ctx, e, T) {
      const a = atan2(e.vy || 0, abs(e.vx || 1));
      ctx.save();
      ctx.rotate(clamp(a, -0.9, 0.9));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(-6, 0, -20, 0);
      g.addColorStop(0, 'rgba(255,200,130,0.95)'); g.addColorStop(1, 'rgba(255,50,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-6, -2.6); ctx.lineTo(-18 - 4 * sin(T * 50), 0); ctx.lineTo(-6, 2.6); ctx.closePath(); ctx.fill();
      ctx.restore();
      poly(ctx, [11, 0, 2, -5.5, -8, -6.5, -5.5, 0, -8, 6.5, 2, 5.5]);
      filled(ctx, grad(ctx, 0, -6, 0, 6, MET), LINE, 0.8);
      poly(ctx, [-2, -5.6, -9.5, -10, -5.5, -3.2]); filled(ctx, MET_D[1], LINE, 0.5);
      poly(ctx, [-2, 5.6, -9.5, 10, -5.5, 3.2]); filled(ctx, MET_D[1], LINE, 0.5);
      ctx.fillStyle = RED;
      poly(ctx, [8.5, -0.6, 3, -3, 3.2, -1.4]); ctx.fill();
      poly(ctx, [8.5, 0.6, 3, 3, 3.2, 1.4]); ctx.fill();
      eye(ctx, 5.5, 0, 2, RED_HALO, 0.5 + 0.5 * sin(T * 12));
      ctx.restore();
    },

    // Ultron soldier: a chrome humanoid that fires red blasts from its palm
    walker(ctx, e, T) {
      const ph = e.phase || 0, s = sin(ph), c2 = cos(ph);
      const k = e.charge || 0;
      ctx.save();
      ctx.scale(ULT_K, ULT_K);
      const hip = { x: 0, y: -29 + abs(s) * 0.9 };
      const legPts = (sd) => {
        const foot = { x: 9 * sd * s, y: -1 - 4 * max(0, -sd * c2) };
        return { foot, kn: joint(hip.x + sd * 2, hip.y, foot.x, foot.y, 15, 15, -1) };
      };
      const back = legPts(-1), front = legPts(1);
      const sh = { x: 1, y: hip.y - 19 };
      uLeg(ctx, hip.x - 2, hip.y, back.kn, back.foot, MET_D, 6.6);
      uArm(ctx, sh.x - 9, sh.y + 1, -9 + 2 * s, hip.y - 1, 10, 10, -1, 5.4, MET_D, 0);
      shoulder(ctx, sh.x - 9.5, sh.y, 5, -1, MET_D);
      uTorso(ctx, sh, hip, 10, k, false);
      uLeg(ctx, hip.x + 2, hip.y, front.kn, front.foot, MET, 6.6);
      // neck + head
      limb(ctx, sh.x + 1, sh.y, sh.x + 1.5, sh.y - 5, 3.4, 3, [JOINT, '#20242b', '#14171c'], LINE, 0.5);
      ctx.save(); ctx.translate(sh.x + 1.5, sh.y - 11); ultronHead(ctx, 7.2, k); ctx.restore();
      shoulder(ctx, sh.x + 10, sh.y, 5, 1, MET);
      uArm(ctx, sh.x + 10, sh.y + 1, 23, -33, 10, 10, 1, 5.4, MET, k);
      ctx.restore();
      hpBar(ctx, e, 32, -84);
    },

    // Ultron Prime: the big one — crowned head, broad armour, a blaster forearm
    tank(ctx, e, T) {
      const ph = e.phase || 0, s = sin(ph);
      const k = e.charge || 0;
      const hip = { x: -1, y: -39 + abs(s) * 1 };
      const sh = { x: 1, y: hip.y - 27 };
      for (const sd of [-1, 1]) {
        const f = { x: 8 * sd * s + sd * 3, y: -1 };
        const kn = joint(hip.x + sd * 5, hip.y, f.x, f.y, 20, 20, -1);
        if (sd < 0) uLeg(ctx, hip.x - 5, hip.y, kn, f, MET_D, 9);
      }
      uArm(ctx, sh.x - 16, sh.y + 2, -20, hip.y + 2 + 2 * s, 14, 14, -1, 7.6, MET_D, 0);
      shoulder(ctx, sh.x - 16, sh.y, 8, -1, MET_D, true);
      uTorso(ctx, sh, hip, 15, k, true);
      {
        const f = { x: -8 * s + 3, y: -1 };
        uLeg(ctx, hip.x + 5, hip.y, joint(hip.x + 5, hip.y, f.x, f.y, 20, 20, -1), f, MET, 9);
      }
      limb(ctx, sh.x + 1, sh.y - 1, sh.x + 2, sh.y - 7, 6, 5.2, [JOINT, '#20242b', '#14171c'], LINE, 0.6);
      ctx.save(); ctx.translate(sh.x + 2.5, sh.y - 14); ultronHead(ctx, 8.4, k, true); ctx.restore();
      shoulder(ctx, sh.x + 16, sh.y, 8, 1, MET, true);
      // the blaster arm, aimed forward: a heavy forearm with a red muzzle ring
      const sx = sh.x + 16, sy = sh.y + 3, mz = { x: 34, y: -46 };
      const el = joint(sx, sy, mz.x - 12, mz.y + 2, 14, 10, 1);
      uLimb(ctx, sx, sy, el.x, el.y, 8, 7, MET);
      disc(ctx, el.x, el.y, 3.6);
      ctx.save();
      ctx.translate(el.x, el.y); ctx.rotate(atan2(mz.y - el.y, mz.x - el.x));
      const L = hypot(mz.x - el.x, mz.y - el.y);
      ctx.beginPath(); ctx.moveTo(0, -5.5); ctx.lineTo(L - 3, -6.5); ctx.lineTo(L, -4); ctx.lineTo(L, 4); ctx.lineTo(L - 3, 6.5); ctx.lineTo(0, 5.5); ctx.closePath();
      filled(ctx, grad(ctx, 0, -6, 0, 6, MET), LINE, 0.8);
      ctx.strokeStyle = 'rgba(28,32,40,0.5)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(L * 0.35, -6); ctx.lineTo(L * 0.35, 6); ctx.moveTo(L * 0.65, -6.2); ctx.lineTo(L * 0.65, 6.2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(L, 0, 1.8, 4.2, 0, 0, TAU); ctx.fillStyle = '#ff3a20'; ctx.fill();
      ctx.restore();
      eye(ctx, mz.x, mz.y, 2.6 + 3.5 * k, '255,90,40', 0.4 + 0.6 * k);
      hpBar(ctx, e, 40, -98);
    },
  };

  // ------------------------------------------------------------------ Thanos
  const TH = {
    skin: ['#b497e0', '#8664bf', '#4f3484'], skinD: ['#8f70c0', '#6a4c9e', '#3d2768'],
    suit: ['#5874d6', '#2e4596', '#18245a'], suitD: ['#3f58b0', '#243677', '#141d48'],
    gold: ['#fff0a8', '#e6b23e', '#8c5a0c'], goldD: ['#d9a83a', '#a8761a', '#5e3b06'], line: '#1c1428',
    // power, space, reality, soul, mind, time
    stones: { power: '#b35cff', space: '#3fa0ff', reality: '#ff3b3b', soul: '#ff9b2e', mind: '#ffe14a', time: '#3ee07a' },
  };
  const STONES = ['power', 'space', 'reality', 'soul', 'mind', 'time'];

  function stone(ctx, x, y, r, col, gk) {
    ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); filled(ctx, TH.goldD[2], null);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
    if (gk > 0.02) eye(ctx, x, y, r * 1.2, hexRgb(col), gk);
  }

  // the Infinity Gauntlet: a gold fist (or an open hand, about to snap) with the six stones
  function gauntletHand(ctx, x, y, r, gk, open) {
    if (open) {
      for (let i = 0; i < 4; i++) {
        const fx = x - r * 0.6 + i * r * 0.4;
        limb(ctx, fx, y - r * 0.5, fx + (i - 1.5) * r * 0.12, y - r * 1.9 + abs(i - 1.5) * r * 0.25, r * 0.36, r * 0.3, TH.gold, TH.line, 0.8);
      }
      limb(ctx, x + r * 0.7, y + r * 0.1, x + r * 1.35, y - r * 0.75, r * 0.38, r * 0.3, TH.gold, TH.line, 0.8);
    }
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.95, 0, 0, TAU);
    filled(ctx, grad(ctx, x - r, y - r, x + r, y + r, TH.gold), TH.line, 1);
    if (!open) {
      ctx.strokeStyle = 'rgba(90,55,0,0.55)'; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) { const fx = x - r * 0.8 + i * r * 0.4; ctx.moveTo(fx, y - r * 0.92); ctx.lineTo(fx, y - r * 0.45); }
      ctx.stroke();
    }
    // the stones: four on the knuckles, the Time Stone on the thumb, the Mind Stone on the back of the hand
    const kn = ['power', 'space', 'reality', 'soul'];
    kn.forEach((k, i) => stone(ctx, x - r * 0.6 + i * r * 0.4, y - r * (open ? 0.55 : 0.66), r * 0.15, TH.stones[k], gk));
    stone(ctx, x + r * 0.8, y + r * 0.32, r * 0.15, TH.stones.time, gk);
    stone(ctx, x, y + r * 0.12, r * 0.3, TH.stones.mind, gk);
  }

  // Thanos's head: purple skin, the ridged chin, a gold helmet with its crest and side fins
  function thanosHead(ctx, hd, st) {
    // neck
    poly(ctx, [hd.x - 8, hd.y + 6, hd.x + 9, hd.y + 6, hd.x + 10, hd.y + 17, hd.x - 9, hd.y + 17]);
    filled(ctx, grad(ctx, hd.x - 8, 0, hd.x + 9, 0, TH.skinD), TH.line, 1);
    // the back fin
    poly(ctx, [hd.x - 10, hd.y - 3, hd.x - 20, hd.y - 26, hd.x - 13, hd.y - 24, hd.x - 6, hd.y - 11]);
    filled(ctx, grad(ctx, 0, hd.y - 26, 0, hd.y - 3, TH.goldD), TH.line, 0.9);
    // face: a wide square jaw
    ctx.beginPath();
    ctx.moveTo(hd.x - 10, hd.y - 7); ctx.lineTo(hd.x + 12, hd.y - 7); ctx.lineTo(hd.x + 13, hd.y + 6);
    ctx.quadraticCurveTo(hd.x + 12, hd.y + 17, hd.x + 1.5, hd.y + 18.5);
    ctx.quadraticCurveTo(hd.x - 9, hd.y + 17, hd.x - 10, hd.y + 6);
    ctx.closePath();
    filled(ctx, grad(ctx, hd.x - 10, hd.y - 7, hd.x + 13, hd.y + 18, TH.skin), TH.line, 1.2);
    // the ridged chin and the cheek grooves
    ctx.strokeStyle = 'rgba(48,24,84,0.7)'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(hd.x + 1.5 + i * 2.6, hd.y + 11.5); ctx.lineTo(hd.x + 1.5 + i * 2.3, hd.y + 17.5); }
    ctx.moveTo(hd.x - 7.5, hd.y + 4); ctx.quadraticCurveTo(hd.x - 6.5, hd.y + 9, hd.x - 4, hd.y + 11);
    ctx.moveTo(hd.x + 10.5, hd.y + 4); ctx.quadraticCurveTo(hd.x + 9.5, hd.y + 9, hd.x + 7, hd.y + 11);
    ctx.stroke();
    // heavy brow, deep-set eyes, a grim mouth
    poly(ctx, [hd.x - 8.5, hd.y - 0.5, hd.x + 11, hd.y - 0.5, hd.x + 10, hd.y + 2, hd.x + 2, hd.y + 1.4, hd.x - 7.5, hd.y + 2]);
    ctx.fillStyle = 'rgba(40,18,72,0.75)'; ctx.fill();
    for (const ex of [hd.x - 3, hd.x + 6]) {
      ctx.beginPath(); ctx.ellipse(ex, hd.y + 3.6, 2.4, 1.3, 0, 0, TAU); ctx.fillStyle = '#1a0f30'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 0.6, hd.y + 3.3, 0.55, 0, TAU); ctx.fillStyle = '#cfe6ff'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(hd.x - 2.5, hd.y + 10.5); ctx.quadraticCurveTo(hd.x + 2, hd.y + (st === 'slam' || st === 'snap' ? 13 : 9.6), hd.x + 6.5, hd.y + 10.5);
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#2a1740'; ctx.stroke();
    // the helmet: dome, cheek guards, the central crest
    ctx.beginPath();
    ctx.moveTo(hd.x - 12.5, hd.y + 9); ctx.lineTo(hd.x - 12.5, hd.y - 6);
    ctx.quadraticCurveTo(hd.x + 1, hd.y - 19, hd.x + 14.5, hd.y - 6);
    ctx.lineTo(hd.x + 14.5, hd.y + 9); ctx.lineTo(hd.x + 11.5, hd.y + 7);
    ctx.lineTo(hd.x + 11.5, hd.y - 2); ctx.quadraticCurveTo(hd.x + 1, hd.y - 6.5, hd.x - 9.5, hd.y - 2);
    ctx.lineTo(hd.x - 9.5, hd.y + 7); ctx.closePath();
    filled(ctx, grad(ctx, hd.x - 12, hd.y - 18, hd.x + 14, hd.y + 9, TH.gold), TH.line, 1.1);
    ctx.strokeStyle = 'rgba(110,70,0,0.5)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(hd.x - 10.5, hd.y - 4); ctx.quadraticCurveTo(hd.x + 1, hd.y - 9.5, hd.x + 12.5, hd.y - 4); ctx.stroke();
    poly(ctx, [hd.x - 2.2, hd.y - 6, hd.x + 1, hd.y - 22, hd.x + 4.2, hd.y - 6]);
    filled(ctx, grad(ctx, hd.x - 2, 0, hd.x + 4, 0, TH.gold), TH.line, 0.8);
    // the front fin
    poly(ctx, [hd.x + 12, hd.y - 3, hd.x + 22, hd.y - 26, hd.x + 15, hd.y - 24, hd.x + 8, hd.y - 11]);
    filled(ctx, grad(ctx, 0, hd.y - 26, 0, hd.y - 3, TH.gold), TH.line, 0.9);
    ctx.strokeStyle = 'rgba(110,70,0,0.55)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(hd.x + 11, hd.y - 7); ctx.lineTo(hd.x + 19, hd.y - 23); ctx.stroke();
  }

  ENEMIES.thanos = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const ph = e.phase || 0, s = sin(ph);
    const breathe = sin(T * 1.6) * 0.8;
    ctx.save();
    // the Space Stone jump: he fades out into a blue portal and steps out of another
    let fade = 1;
    if (st === 'portal') { const t = e.stateT || 0; fade = t < 0.5 ? 1 - t / 0.5 : clamp((t - 0.5) / 0.35, 0, 1); }
    if (fade < 1) ctx.globalAlpha *= max(0.08, fade);
    ctx.scale(TH_K, TH_K);
    const hip = { x: 0, y: -60 + abs(s) * 1.2 };
    // legs: blue, gold boots and knee guards
    for (const sd of [-1, 1]) {
      const foot = { x: sd * 10 + 9 * sd * s * 0.6, y: -2 };
      const kn = joint(hip.x + sd * 8, hip.y, foot.x, foot.y, 31, 30, -1);
      const cols = sd < 0 ? TH.suitD : TH.suit;
      const gold = sd < 0 ? TH.goldD : TH.gold;
      limb(ctx, hip.x + sd * 8, hip.y, kn.x, kn.y, 19, 15, cols, TH.line);
      limb(ctx, kn.x, kn.y, foot.x, foot.y - 4, 15, 12, cols, TH.line);
      const bt = { x: lerp(kn.x, foot.x, 0.42), y: lerp(kn.y, foot.y, 0.42) };
      poly(ctx, [bt.x - 9, bt.y - 1, bt.x + 9, bt.y - 1, foot.x + 7, foot.y - 7, foot.x + 16, foot.y + 0.5, foot.x - 9, foot.y + 0.5, foot.x - 8, foot.y - 9]);
      filled(ctx, grad(ctx, 0, bt.y, 0, foot.y, gold), TH.line);
      ctx.strokeStyle = 'rgba(90,55,0,0.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(bt.x - 8, bt.y + 3); ctx.lineTo(bt.x + 8, bt.y + 3); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(kn.x + 1, kn.y, 7, 6, 0, 0, TAU); filled(ctx, grad(ctx, kn.x, kn.y - 6, kn.x, kn.y + 6, gold), TH.line);
    }
    const sh = { x: 2, y: hip.y - 47 + breathe };
    // the back arm: bare purple arm with a gold bracer; raised for a throw or a slam
    const throwK = st === 'throw' ? k : 0, slamK = st === 'slam' ? k : 0;
    const bHand = st === 'throw' ? { x: lerp(-30, -20, throwK), y: lerp(sh.y + 22, sh.y - 42, throwK) }
      : st === 'slam' ? { x: lerp(-18, 4, slamK), y: lerp(sh.y + 20, sh.y - 48, slamK) }
        : st === 'snap' ? { x: -20, y: hip.y - 2 } : { x: -23, y: sh.y + 36 + 2 * s };
    const bEl = joint(sh.x - 19, sh.y + 4, bHand.x, bHand.y, 23, 23, st === 'throw' ? -1 : 1);
    limb(ctx, sh.x - 19, sh.y + 4, bEl.x, bEl.y, 15, 13, TH.skinD, TH.line);
    limb(ctx, bEl.x, bEl.y, bHand.x, bHand.y, 13, 12, TH.skinD, TH.line);
    limb(ctx, lerp(bEl.x, bHand.x, 0.35), lerp(bEl.y, bHand.y, 0.35), lerp(bEl.x, bHand.x, 0.85), lerp(bEl.y, bHand.y, 0.85), 14, 13.5, TH.goldD, TH.line, 0.9);
    ctx.beginPath(); ctx.arc(bHand.x, bHand.y, 7, 0, TAU); filled(ctx, grad(ctx, bHand.x, bHand.y - 7, bHand.x, bHand.y + 7, TH.skinD), TH.line);
    if (st === 'throw') drawRock(ctx, bHand.x, bHand.y - 14, 1.6, T * 0.5);
    // torso: blue suit, a gold breastplate, gold side bands and belt
    ctx.beginPath();
    ctx.moveTo(-24, sh.y + 2); ctx.quadraticCurveTo(2, sh.y - 7, 28, sh.y + 2);
    ctx.lineTo(21, hip.y - 6); ctx.quadraticCurveTo(2, hip.y + 3, -17, hip.y - 6);
    ctx.closePath();
    filled(ctx, grad(ctx, -24, sh.y, 26, hip.y, TH.suit), TH.line, 1.3);
    for (const sd of [-1, 1]) {
      const x0 = 2 + sd * 15;
      poly(ctx, [x0 - 3, sh.y + 20, x0 + 3, sh.y + 20, x0 + 2 - sd * 1, hip.y - 7, x0 - 2 - sd * 1, hip.y - 7]);
      filled(ctx, grad(ctx, x0 - 3, 0, x0 + 3, 0, TH.gold), TH.line, 0.7);
    }
    ctx.strokeStyle = 'rgba(10,16,50,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const y = sh.y + 27 + i * 5.5; ctx.moveTo(-8, y); ctx.quadraticCurveTo(2, y + 1.5, 12, y); } ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, sh.y + 3); ctx.quadraticCurveTo(2, sh.y - 2, 22, sh.y + 3);
    ctx.lineTo(18, sh.y + 21); ctx.quadraticCurveTo(2, sh.y + 27, -14, sh.y + 21); ctx.closePath();
    filled(ctx, grad(ctx, -16, sh.y, 20, sh.y + 26, TH.gold), TH.line);
    ctx.strokeStyle = 'rgba(90,55,0,0.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(2, sh.y + 2); ctx.lineTo(2, sh.y + 24);
    ctx.moveTo(-12, sh.y + 8); ctx.quadraticCurveTo(-5, sh.y + 15, 2, sh.y + 13); ctx.quadraticCurveTo(9, sh.y + 15, 16, sh.y + 8);
    ctx.stroke();
    ctx.beginPath(); ctx.rect(-18, hip.y - 11, 41, 8); filled(ctx, grad(ctx, 0, hip.y - 11, 0, hip.y - 3, TH.gold), TH.line);
    ctx.beginPath(); ctx.arc(3, hip.y - 7, 4.6, 0, TAU); filled(ctx, grad(ctx, 0, hip.y - 12, 0, hip.y - 2, TH.goldD), TH.line, 0.8);
    // shoulder pads: layered gold domes
    for (const sd of [-1, 1]) {
      const cx = sh.x + sd * 21, gold = sd < 0 ? TH.goldD : TH.gold;
      ctx.beginPath(); ctx.ellipse(cx, sh.y + 6, 13, 7, sd * 0.25, PI * 0.95, TAU * 1.0); ctx.lineTo(cx + sd * 12, sh.y + 10); ctx.lineTo(cx - sd * 10, sh.y + 10); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 2, 0, sh.y + 10, gold), TH.line);
      ctx.beginPath(); ctx.ellipse(cx, sh.y + 1, 11, 7, sd * 0.25, PI, TAU); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 6, 0, sh.y + 2, gold), TH.line);
    }
    thanosHead(ctx, { x: 6, y: sh.y - 17 }, st);
    // the gauntlet arm
    const beamK = st === 'charging' ? k : st === 'firing' ? 1 : 0;
    const fist = st === 'charging' || st === 'firing' ? { x: 30, y: -128 }
      : st === 'power' ? { x: lerp(26, 36, k), y: lerp(sh.y + 20, -97, k) }
        : st === 'snap' ? { x: lerp(26, 16, k), y: lerp(sh.y + 10, -152, min(1, k * 2)) }
          : st === 'slam' ? { x: lerp(28, 14, slamK), y: lerp(sh.y + 20, sh.y - 50, slamK) }
            : { x: 27, y: sh.y + 33 - 2 * s };
    const up = st === 'charging' || st === 'firing' || st === 'snap' || st === 'power';
    const fEl = joint(sh.x + 21, sh.y + 4, fist.x, fist.y, 23, 23, up ? 1 : -1);
    limb(ctx, sh.x + 21, sh.y + 4, fEl.x, fEl.y, 15, 13, TH.skin, TH.line);
    // the gauntlet's forearm, flaring at the cuff
    limb(ctx, fEl.x, fEl.y, fist.x, fist.y, 15.5, 13, TH.gold, TH.line);
    const ca = atan2(fist.y - fEl.y, fist.x - fEl.x);
    ctx.beginPath(); ctx.ellipse(lerp(fEl.x, fist.x, 0.18), lerp(fEl.y, fist.y, 0.18), 3, 9, ca, 0, TAU); filled(ctx, grad(ctx, 0, fEl.y - 8, 0, fEl.y + 8, TH.goldD), TH.line, 0.8);
    const gk = st === 'snap' ? 0.4 + 0.6 * k : max(beamK, st === 'power' ? k : 0, slamK * 0.5);
    gauntletHand(ctx, fist.x, fist.y, 9, gk, st === 'snap');
    // the stones' power around the fist
    if (gk > 0.02 || st === 'slam') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const hue = st === 'power' ? '200,110,255' : st === 'snap' ? '255,240,200' : '200,120,255';
      glow(ctx, fist.x, fist.y, 14 + 22 * gk, hue, 0.35 + 0.65 * gk);
      const n = st === 'snap' ? 6 : 6;
      for (let i = 0; i < n; i++) {
        const a = T * (st === 'snap' ? 3 : 2) + i * TAU / n, r = (13 + 7 * sin(T * 4 + i)) * (st === 'snap' ? 1.4 : 1);
        glow(ctx, fist.x + cos(a) * r * gk, fist.y + sin(a) * r * gk, 4.5, hexRgb(TH.stones[STONES[i]]), 0.85 * gk);
      }
      if (st === 'power') {
        // the Power Stone's purple sphere forming in his fist
        ctx.strokeStyle = `rgba(230,170,255,${0.8 * k})`; ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * 1.1 + T * 9; ctx.moveTo(fist.x + 10, fist.y); ctx.lineTo(fist.x + 10 + cos(a) * 12 * k, fist.y + sin(a) * 12 * k); }
        ctx.stroke();
      }
      if (st === 'snap') {
        ctx.strokeStyle = `rgba(255,245,210,${0.55 * k})`; ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + T * 0.8; ctx.moveTo(fist.x + cos(a) * 12, fist.y + sin(a) * 12); ctx.lineTo(fist.x + cos(a) * (26 + 22 * k), fist.y + sin(a) * (26 + 22 * k)); }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (st === 'portal') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 4, -80, 70, '80,160,255', 0.5);
      ctx.restore();
    }
    ctx.restore();
    hpBar(ctx, e, 96, -256, 'THANOS');
  };

  // ------------------------------------------------------------------ Doctor Doom
  const DM = {
    cloak: ['#3f9e58', '#24683a', '#0f381e'], lining: ['#1f5a32', '#153f24', '#0a2414'],
    tunic: ['#5cbc70', '#2f7d45', '#174a28'], metal: ['#f2f5f8', '#a8b1bd', '#59626e'],
    metalD: ['#b6bec9', '#7a838f', '#3f4650'], line: '#0d1810', glowc: '90,255,140',
  };

  // the iron mask under the green hood
  function doomHead(ctx, k, casting) {
    // the hood
    ctx.beginPath();
    ctx.moveTo(-11.5, -14); ctx.quadraticCurveTo(-16, -33, -5, -42); ctx.quadraticCurveTo(4, -41, 9, -37);
    ctx.quadraticCurveTo(15, -30, 13, -14); ctx.closePath();
    filled(ctx, grad(ctx, -14, -42, 13, -14, DM.cloak), DM.line, 1.1);
    ctx.beginPath(); ctx.moveTo(-8.5, -15); ctx.quadraticCurveTo(-11, -32, -2, -36.5); ctx.quadraticCurveTo(10, -34, 10.5, -15); ctx.closePath();
    filled(ctx, grad(ctx, -9, -36, 10, -15, DM.lining), null);
    // the mask
    ctx.beginPath();
    ctx.moveTo(-6.6, -33.5); ctx.lineTo(8.6, -33.5); ctx.lineTo(9.2, -21);
    ctx.quadraticCurveTo(8, -15.5, 1, -15); ctx.quadraticCurveTo(-6, -15.5, -7.2, -21); ctx.closePath();
    filled(ctx, grad(ctx, -7, -34, 9, -15, DM.metal), DM.line, 0.9);
    // brow band, nose bridge, cheek seams
    ctx.strokeStyle = 'rgba(30,40,46,0.75)'; ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(-6.6, -29.4); ctx.lineTo(8.8, -29.4);
    ctx.moveTo(-6.9, -24.5); ctx.lineTo(-3.4, -17.2);
    ctx.moveTo(9, -24.5); ctx.lineTo(5.4, -17.2);
    ctx.stroke();
    poly(ctx, [0.2, -29.2, 2, -29.2, 2.3, -22.4, -0.1, -22.4]);
    filled(ctx, grad(ctx, 0, -29, 2.3, -22, DM.metalD), 'rgba(30,40,46,0.6)', 0.4);
    // eye slits and the mouth slot with its grille
    ctx.fillStyle = '#0c140f';
    poly(ctx, [-4.6, -28.2, -0.4, -27.8, -0.4, -26.2, -4.6, -26.6]); ctx.fill();
    poly(ctx, [2.7, -27.8, 6.9, -28.2, 6.9, -26.6, 2.7, -26.2]); ctx.fill();
    ctx.fillRect(-3.4, -20.4, 9.8, 1.5);
    ctx.strokeStyle = '#8b949e'; ctx.lineWidth = 0.4;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { ctx.moveTo(-2.8 + i * 1.75, -20.5); ctx.lineTo(-2.8 + i * 1.75, -18.8); } ctx.stroke();
    // rivets
    ctx.fillStyle = '#55606b';
    for (const [rx, ry] of [[-5.3, -32], [-1.9, -32.2], [4.5, -32.2], [7.4, -32], [-6, -22.5], [8.2, -22.5], [-4.6, -18.4], [6.8, -18.4]]) { ctx.beginPath(); ctx.arc(rx, ry, 0.55, 0, TAU); ctx.fill(); }
    const eg = casting ? 0.55 + 0.45 * k : 0.12;
    eye(ctx, -2.5, -27.2, 1.4, DM.glowc, eg);
    eye(ctx, 4.8, -27.2, 1.4, DM.glowc, eg);
    // steel collar
    ctx.beginPath(); ctx.ellipse(1, -14.5, 8.5, 2.6, 0, 0, TAU); filled(ctx, grad(ctx, 0, -17, 0, -12, DM.metalD), DM.line, 0.7);
  }

  function doomGauntlet(ctx, x, y, r, cols) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); filled(ctx, grad(ctx, x - r, y - r, x + r, y + r, cols), DM.line, 0.8);
    ctx.strokeStyle = 'rgba(30,40,46,0.6)'; ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.8); ctx.lineTo(x - r * 0.4, y + r * 0.8); ctx.moveTo(x + r * 0.3, y - r * 0.85); ctx.lineTo(x + r * 0.3, y + r * 0.85); ctx.stroke();
  }

  // Doom's body (shared with his Doombots): armoured legs, green tunic and belt, steel arms
  function doomBody(ctx, e, T, o) {
    const st = e.state, k = e.charge || 0;
    const casting = st === 'charging' || st === 'firing';
    const storm = st === 'storm', summon = st === 'summon';
    const sway = clamp((e.vx || 0) / 400, -0.4, 0.4);
    if (o.cloak) {
      ctx.beginPath();
      ctx.moveTo(-7, -19);
      ctx.quadraticCurveTo(-24 - 8 * abs(sway), -2, -28 - 6 * sin(T * 3), 36 + 2 * sin(T * 2.4));
      ctx.quadraticCurveTo(-20, 33 + 3 * sin(T * 3.3), -12, 37 + 2 * sin(T * 2.8));
      ctx.quadraticCurveTo(-4, 33, 3, 36);
      ctx.lineTo(9, -18); ctx.closePath();
      filled(ctx, grad(ctx, -27, -20, 4, 36, DM.cloak), DM.line, 1.2);
      ctx.beginPath(); ctx.moveTo(-5, -16); ctx.quadraticCurveTo(-18, 0, -21 - 4 * sin(T * 3), 30); ctx.quadraticCurveTo(-8, 28, 1, 31); ctx.lineTo(6, -15); ctx.closePath();
      filled(ctx, grad(ctx, -20, -16, 4, 30, DM.lining), null);
    }
    // legs: steel armour, knee plates, boots
    for (const sd of [-1, 1]) {
      const cols = sd < 0 ? DM.metalD : DM.metal;
      const kn = { x: sd * 3.5 + 2, y: 21 }, ft = { x: sd * 2.5 + 4, y: 33 };
      limb(ctx, sd * 3.5, 7, kn.x, kn.y, 7.2, 6.2, cols, DM.line);
      limb(ctx, kn.x, kn.y, ft.x, ft.y, 6.2, 5.6, cols, DM.line);
      ctx.beginPath(); ctx.ellipse(kn.x + 0.6, kn.y, 3.6, 3, 0, 0, TAU); filled(ctx, grad(ctx, 0, kn.y - 3, 0, kn.y + 3, cols), DM.line, 0.6);
      poly(ctx, [ft.x - 3.4, ft.y - 3, ft.x + 3.2, ft.y - 3, ft.x + 7, ft.y + 1.6, ft.x - 3.4, ft.y + 1.6]);
      filled(ctx, grad(ctx, 0, ft.y - 3, 0, ft.y + 2, DM.metalD), DM.line, 0.6);
    }
    // back arm
    const bh = storm ? { x: -8, y: -43 + sin(T * 9) } : casting ? { x: 18, y: -5 } : summon ? { x: -12, y: 4 } : { x: -10, y: 7 };
    const bEl = joint(-8, -13, bh.x, bh.y, 10, 11, storm ? -1 : 1);
    limb(ctx, -8, -13, bEl.x, bEl.y, 6, 5.4, DM.metalD, DM.line);
    limb(ctx, bEl.x, bEl.y, bh.x, bh.y, 5.6, 6, DM.metalD, DM.line);
    doomGauntlet(ctx, bh.x, bh.y, 3.4, DM.metalD);
    // tunic & belt
    poly(ctx, [-10, -16, 11, -16, 12, 8, 14.5, 16, 7, 14, 2, 17, -3, 14, -13.5, 16, -11, 8]);
    filled(ctx, grad(ctx, -11, -16, 12, 16, DM.tunic), DM.line, 1.1);
    ctx.strokeStyle = 'rgba(10,40,20,0.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-2, 15); ctx.moveTo(6, 6); ctx.lineTo(6.5, 14); ctx.stroke();
    ctx.beginPath(); ctx.rect(-11, 1.6, 23, 4.4); filled(ctx, grad(ctx, 0, 1.6, 0, 6, ['#9a7a3c', '#6e5124', '#3f2c10']), DM.line, 0.7);
    ctx.beginPath(); ctx.arc(0.5, 3.8, 2.9, 0, TAU); filled(ctx, grad(ctx, -2, 1, 2, 7, ['#ffe9a0', '#d6aa45', '#8a6418']), DM.line, 0.6);
    ctx.beginPath(); ctx.arc(0.5, 3.8, 1.1, 0, TAU); ctx.fillStyle = '#3b2a0e'; ctx.fill();
    // steel shoulder plates
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(1 + sd * 9, -14.5, 5.4, 3.6, sd * 0.3, PI, TAU); ctx.closePath();
      filled(ctx, grad(ctx, 0, -18, 0, -14, sd < 0 ? DM.metalD : DM.metal), DM.line, 0.7);
    }
    doomHead(ctx, k, casting || storm || summon);
    // front arm
    const fh = storm ? { x: 12, y: -44 + sin(T * 9 + 1) } : casting ? { x: 21, y: -2 } : summon ? { x: 10, y: -42 } : { x: 11, y: 7 };
    const fEl = joint(9, -13, fh.x, fh.y, 10, 11, storm || summon ? -1 : 1);
    limb(ctx, 9, -13, fEl.x, fEl.y, 6.4, 5.8, DM.metal, DM.line);
    limb(ctx, fEl.x, fEl.y, fh.x, fh.y, 6, 6.6, DM.metal, DM.line);
    doomGauntlet(ctx, fh.x, fh.y, 3.8, DM.metal);
    // green power in his hands
    const a = casting ? 0.5 + 0.5 * k : storm || summon ? 0.4 + 0.6 * k : 0;
    if (a > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, fh.x + 2, fh.y, 7 + 10 * a, DM.glowc, a);
      glow(ctx, bh.x + 2, bh.y, 6 + 8 * a, DM.glowc, a * 0.85);
      if (storm) {
        // lightning crackling between his raised hands
        ctx.strokeStyle = `rgba(200,255,215,${0.9 * a})`; ctx.lineWidth = 0.9; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(bh.x, bh.y);
        for (let i = 1; i < 6; i++) ctx.lineTo(lerp(bh.x, fh.x, i / 6), lerp(bh.y, fh.y, i / 6) + sin(i * 7 + Math.floor(T * 20)) * 4);
        ctx.lineTo(fh.x, fh.y); ctx.stroke();
      }
      ctx.restore();
    }
    return { fh, bh };
  }

  ENEMIES.doom = function (ctx, e, T) {
    const bob = sin(T * 2.2) * 1.5;
    ctx.save();
    ctx.translate(0, bob);
    ctx.scale(DOOM_K, DOOM_K);
    doomBody(ctx, e, T, { cloak: true });
    // the force field
    if (e.shield > 0) {
      const fa = clamp(e.shield / 0.4, 0, 1) * (0.75 + 0.25 * sin(T * 9));
      ctx.save();
      const g = ctx.createRadialGradient(0, -2, 26, 0, -2, 46);
      g.addColorStop(0, 'rgba(90,255,140,0)'); g.addColorStop(0.8, `rgba(90,255,140,${0.2 * fa})`); g.addColorStop(1, `rgba(170,255,200,${0.6 * fa})`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -2, 46, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(170,255,200,${0.4 * fa})`; ctx.lineWidth = 0.7;
      ctx.beginPath();
      // a hex-like lattice of mystic runes
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + T * 0.6; ctx.moveTo(cos(a) * 30, -2 + sin(a) * 30); ctx.lineTo(cos(a + 0.31) * 46, -2 + sin(a + 0.31) * 46); ctx.lineTo(cos(a + 0.63) * 30, -2 + sin(a + 0.63) * 30); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    hpBar(ctx, e, 76, -104, 'DOCTOR DOOM');
  };

  // a Doombot: Doom's armour without the cloak, flying on boot jets
  ENEMIES.doombot = function (ctx, e, T) {
    const tilt = clamp((e.vx || 0) / 700, -0.25, 0.25);
    ctx.save();
    ctx.rotate(tilt);
    ctx.scale(BOT_K, BOT_K);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sd of [-1, 1]) {
      const fx = sd * 2.5 + 5, fy = 35;
      const g = ctx.createLinearGradient(0, fy, 0, fy + 12);
      g.addColorStop(0, 'rgba(200,255,210,0.95)'); g.addColorStop(1, 'rgba(60,220,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(fx - 2.2, fy); ctx.lineTo(fx + 2.2, fy); ctx.lineTo(fx, fy + 10 + 3 * sin(T * 40 + sd)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    doomBody(ctx, { ...e, state: e.charge > 0.6 ? 'charging' : 'idle' }, T, { cloak: false });
    ctx.restore();
    hpBar(ctx, e, 32, -54);
  };

  // ------------------------------------------------------------------ Kang the Conqueror
  const KG = {
    mask: ['#86c2ff', '#3e76da', '#1c3a88'], purple: ['#cfa2ff', '#8a4fd8', '#46207e'], purpleD: ['#a87ae0', '#6a37b0', '#341660'],
    green: ['#6ee597', '#2fa35a', '#145a2f'], greenD: ['#4cc177', '#227f45', '#0e4322'], line: '#160f28', glowc: '80,240,255',
  };

  function kangHead(ctx, hd, k) {
    // face: the blue mask
    ctx.beginPath(); ctx.ellipse(hd.x, hd.y + 1, 5.7, 7.2, 0, 0, TAU);
    filled(ctx, grad(ctx, hd.x - 6, hd.y - 6, hd.x + 6, hd.y + 8, KG.mask), KG.line, 0.9);
    // white, narrow eyes and a hard mouth
    ctx.fillStyle = '#e9fbff';
    poly(ctx, [hd.x - 4.4, hd.y - 0.2, hd.x - 0.8, hd.y + 0.4, hd.x - 1.2, hd.y + 1.4, hd.x - 4.2, hd.y + 1]); ctx.fill();
    poly(ctx, [hd.x + 4.6, hd.y - 0.2, hd.x + 1, hd.y + 0.4, hd.x + 1.4, hd.y + 1.4, hd.x + 4.4, hd.y + 1]); ctx.fill();
    eye(ctx, hd.x - 2.6, hd.y + 0.6, 1, KG.glowc, 0.2 + 0.6 * k);
    eye(ctx, hd.x + 2.8, hd.y + 0.6, 1, KG.glowc, 0.2 + 0.6 * k);
    ctx.strokeStyle = '#0d1b3a'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hd.x - 2.2, hd.y + 5); ctx.lineTo(hd.x + 2.6, hd.y + 5); ctx.stroke();
    ctx.strokeStyle = 'rgba(13,27,58,0.5)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(hd.x + 0.2, hd.y + 1.6); ctx.lineTo(hd.x + 0.2, hd.y + 3.4); ctx.stroke();
    // the helmet framing the face, with its two great fins
    for (const sd of [-1, 1]) {
      poly(ctx, [hd.x + sd * 6.6, hd.y + 1, hd.x + sd * 9.5, hd.y - 6, hd.x + sd * 15.5, hd.y - 19, hd.x + sd * 9.5, hd.y - 15, hd.x + sd * 5.5, hd.y - 8]);
      filled(ctx, grad(ctx, 0, hd.y - 19, 0, hd.y + 1, sd < 0 ? KG.purpleD : KG.purple), KG.line, 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(hd.x + sd * 8, hd.y - 5); ctx.lineTo(hd.x + sd * 14, hd.y - 17); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(hd.x - 7.4, hd.y + 6); ctx.lineTo(hd.x - 7.6, hd.y - 4); ctx.quadraticCurveTo(hd.x, hd.y - 13, hd.x + 7.6, hd.y - 4); ctx.lineTo(hd.x + 7.4, hd.y + 6);
    ctx.lineTo(hd.x + 5.6, hd.y + 4); ctx.lineTo(hd.x + 5.4, hd.y - 2.5); ctx.quadraticCurveTo(hd.x, hd.y - 7, hd.x - 5.4, hd.y - 2.5); ctx.lineTo(hd.x - 5.6, hd.y + 4); ctx.closePath();
    filled(ctx, grad(ctx, hd.x - 7, hd.y - 12, hd.x + 7, hd.y + 6, KG.purple), KG.line, 0.9);
    // a time crystal on the brow
    poly(ctx, [hd.x, hd.y - 9.5, hd.x + 1.4, hd.y - 7.6, hd.x, hd.y - 5.7, hd.x - 1.4, hd.y - 7.6]);
    filled(ctx, '#bff8ff', KG.line, 0.4);
    eye(ctx, hd.x, hd.y - 7.6, 1.2, KG.glowc, 0.4 + 0.6 * k);
  }

  function kangGauntlet(ctx, x, y, ang, k, cols) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    poly(ctx, [-5, -4.2, 3.6, -3.6, 6.4, -2, 6.4, 2, 3.6, 3.6, -5, 4.2]);
    filled(ctx, grad(ctx, 0, -4, 0, 4, cols), KG.line, 0.7);
    ctx.beginPath(); ctx.ellipse(6.4, 0, 1.3, 2.4, 0, 0, TAU); ctx.fillStyle = '#bff8ff'; ctx.fill();
    ctx.strokeStyle = 'rgba(80,240,255,0.9)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-1, -3.9); ctx.lineTo(-1, 3.9); ctx.stroke();
    ctx.restore();
    eye(ctx, x + cos(ang) * 6.5, y + sin(ang) * 6.5, 2 + 3 * k, KG.glowc, 0.15 + 0.85 * k);
  }

  ENEMIES.kang = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const ph = e.phase || 0, s = sin(ph);
    const warpAge = e.warp ? (Date.now() - e.warp) / 1000 : 9;
    ctx.save();
    ctx.scale(KANG_K, KANG_K);
    if (warpAge < 0.6) ctx.globalAlpha *= clamp(warpAge / 0.6, 0.15, 1);
    const hip = { x: 0, y: -33 + abs(s) * 0.8 };
    // legs: green, tall purple boots
    for (const sd of [-1, 1]) {
      const foot = { x: sd * 4 + 7 * sd * s * 0.7, y: -1 };
      const kn = joint(hip.x + sd * 3, hip.y, foot.x, foot.y, 16, 16, -1);
      limb(ctx, hip.x + sd * 3, hip.y, kn.x, kn.y, 8.6, 7.4, sd < 0 ? KG.greenD : KG.green, KG.line);
      limb(ctx, kn.x, kn.y, foot.x, foot.y - 1, 7.6, 6.6, sd < 0 ? KG.purpleD : KG.purple, KG.line);
      poly(ctx, [kn.x - 4.4, kn.y - 1.2, kn.x + 4.4, kn.y - 1.2, kn.x + 3.6, kn.y + 2.6, kn.x - 3.6, kn.y + 2.6]);
      filled(ctx, grad(ctx, 0, kn.y - 1, 0, kn.y + 3, sd < 0 ? KG.purpleD : KG.purple), KG.line, 0.6);
      poly(ctx, [foot.x - 4, -5, foot.x + 5, -4, foot.x + 8, 0.5, foot.x - 4, 0.5]);
      filled(ctx, (sd < 0 ? KG.purpleD : KG.purple)[2], KG.line, 0.7);
    }
    const sh = { x: 1, y: hip.y - 24 };
    // the high collar's back, rising behind the head
    ctx.beginPath();
    ctx.moveTo(-10, sh.y + 1); ctx.lineTo(-14, sh.y - 20); ctx.quadraticCurveTo(-4, sh.y - 13, 3, sh.y - 13);
    ctx.quadraticCurveTo(10, sh.y - 13, 19, sh.y - 20); ctx.lineTo(14, sh.y + 1); ctx.closePath();
    filled(ctx, grad(ctx, -14, sh.y - 20, 18, sh.y, KG.purple), KG.line, 0.9);
    poly(ctx, [-8, sh.y, -11.5, sh.y - 16, -3, sh.y - 11, 8, sh.y - 11, 16, sh.y - 16, 12, sh.y]);
    filled(ctx, grad(ctx, 0, sh.y - 16, 0, sh.y, KG.greenD), null);
    // back arm
    const sq = st === 'squad';
    const bHand = sq ? { x: -12, y: sh.y - 6 } : { x: -9, y: hip.y - 2 + 2 * s };
    const bEl = joint(sh.x - 8, sh.y + 2, bHand.x, bHand.y, 11, 11, 1);
    limb(ctx, sh.x - 8, sh.y + 2, bEl.x, bEl.y, 6.4, 5.8, KG.greenD, KG.line);
    limb(ctx, bEl.x, bEl.y, bHand.x, bHand.y, 6.8, 6.2, KG.purpleD, KG.line);
    kangGauntlet(ctx, bHand.x, bHand.y, atan2(bHand.y - bEl.y, bHand.x - bEl.x), sq ? k * 0.6 : 0, KG.purpleD);
    // tunic: green, a purple chest panel with the time crystal, a purple belt
    poly(ctx, [-9.5, sh.y, 11.5, sh.y, 10, hip.y + 2, -8.5, hip.y + 2]);
    filled(ctx, grad(ctx, -9, sh.y, 11, hip.y, KG.green), KG.line, 1.1);
    poly(ctx, [-3.6, sh.y + 1, 6.6, sh.y + 1, 5, hip.y - 2, -2, hip.y - 2]);
    filled(ctx, grad(ctx, -3, sh.y, 6, hip.y, KG.purple), KG.line, 0.7);
    poly(ctx, [1.5, sh.y + 4, 3.8, sh.y + 7.5, 1.5, sh.y + 11, -0.8, sh.y + 7.5]);
    filled(ctx, '#bff8ff', KG.line, 0.5);
    eye(ctx, 1.5, sh.y + 7.5, 2, KG.glowc, 0.3 + 0.5 * k);
    ctx.beginPath(); ctx.rect(-9, hip.y - 3, 19.5, 4.6); filled(ctx, grad(ctx, 0, hip.y - 3, 0, hip.y + 1.6, KG.purpleD), KG.line, 0.8);
    ctx.beginPath(); ctx.rect(-0.2, hip.y - 3.6, 3.6, 5.8); filled(ctx, '#d8c6ff', KG.line, 0.5);
    // shoulders and the front of the collar
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(1 + sd * 9.5, sh.y + 1.5, 5.2, 3.4, sd * 0.3, PI, TAU); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 2, 0, sh.y + 2, sd < 0 ? KG.purpleD : KG.purple), KG.line, 0.7);
    }
    kangHead(ctx, { x: 2.5, y: sh.y - 9 }, max(k, st === 'freeze' ? 1 : 0));
    // the gauntlet arm, aimed forward
    const aim = st === 'burst' || st === 'charging' ? 1 : st === 'freeze' ? 1 : 0;
    const hand = sq ? { x: 13, y: -74 } : st === 'freeze' ? { x: 24, y: -50 } : { x: lerp(14, 26, aim), y: lerp(hip.y - 2, -46, aim) };
    const el = joint(sh.x + 9, sh.y + 2, hand.x, hand.y, 11, 12, sq ? -1 : 1);
    limb(ctx, sh.x + 9, sh.y + 2, el.x, el.y, 6.6, 6, KG.green, KG.line);
    limb(ctx, el.x, el.y, hand.x, hand.y, 6.8, 7.2, KG.purple, KG.line);
    const ck = st === 'burst' ? 0.75 : st === 'charging' || st === 'freeze' || sq ? 0.3 + 0.7 * k : 0.12;
    kangGauntlet(ctx, hand.x, hand.y, atan2(hand.y - el.y, hand.x - el.x), ck, KG.purple);
    if (st === 'freeze' || sq) {
      // clock rings spinning in front of the time gauntlet
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(120,240,255,${0.85 * k})`; ctx.lineWidth = 0.8;
      const cx = hand.x + (sq ? 0 : 9), cy = hand.y - (sq ? 9 : 0), R = 4 + 7 * k;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.6, 0, TAU); ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.moveTo(cx + cos(a) * R * 0.82, cy + sin(a) * R * 0.82); ctx.lineTo(cx + cos(a) * R, cy + sin(a) * R); }
      ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(T * 6) * R * 0.75, cy + sin(T * 6) * R * 0.75);
      ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(T / 2) * R * 0.5, cy + sin(T / 2) * R * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // time-shimmer rings right after a jump through time
    if (warpAge < 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(80,240,255,${0.8 * (1 - warpAge / 0.6)})`; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { const r = (12 + i * 9 + warpAge * 40) * KANG_K; ctx.beginPath(); ctx.ellipse(0, -36 * KANG_K, r * 0.55, r, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    hpBar(ctx, e, 76, -176, 'KANG');
  };

  // ------------------------------------------------------------------ Galactus (giant)
  const GA = {
    purple: ['#b98cf2', '#7646c8', '#3a1b76'], purpleD: ['#9a6fd6', '#5c33a3', '#2c1460'],
    blue: ['#78c0ff', '#3474d6', '#173d88'], blueD: ['#5aa2e8', '#275cb2', '#122f6c'],
    helm: ['#c79cff', '#8650d6', '#40207e'], face: ['#d9d3e6', '#a199b6', '#5c5574'], line: '#120b24', eyes: '255,225,255',
  };
  const GL = 0.42; // outline width at his scale

  function galactusHead(ctx, hd, eyeK) {
    // the two great prongs of the helmet, rising from its sides
    for (const sd of [-1, 1]) {
      const x0 = hd.x + sd * 9.5;
      ctx.beginPath();
      ctx.moveTo(x0 - 2.2, hd.y - 1); ctx.lineTo(x0 - 2.6 + sd * 0.8, hd.y - 20); ctx.quadraticCurveTo(x0 + sd * 0.5, hd.y - 24, x0 + 2.6 + sd * 0.8, hd.y - 20);
      ctx.lineTo(x0 + 2.2, hd.y - 1); ctx.closePath();
      filled(ctx, grad(ctx, x0 - 3, 0, x0 + 3, 0, sd < 0 ? GA.purpleD : GA.helm), GA.line, GL);
      ctx.strokeStyle = 'rgba(30,10,60,0.55)'; ctx.lineWidth = 0.35;
      ctx.beginPath(); for (let i = 1; i <= 3; i++) { const y = hd.y - 4 - i * 4.2; ctx.moveTo(x0 - 2.4, y); ctx.lineTo(x0 + 2.4 + sd * 0.4, y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.3;
      ctx.beginPath(); ctx.moveTo(x0 - 1.2, hd.y - 2); ctx.lineTo(x0 - 1.4 + sd * 0.6, hd.y - 19); ctx.stroke();
    }
    // the helmet shell
    ctx.beginPath();
    ctx.moveTo(hd.x - 8, hd.y + 7); ctx.lineTo(hd.x - 9, hd.y - 4); ctx.quadraticCurveTo(hd.x, hd.y - 14, hd.x + 9, hd.y - 4); ctx.lineTo(hd.x + 8, hd.y + 7);
    ctx.quadraticCurveTo(hd.x, hd.y + 10, hd.x - 8, hd.y + 7); ctx.closePath();
    filled(ctx, grad(ctx, hd.x - 9, hd.y - 13, hd.x + 9, hd.y + 9, GA.helm), GA.line, GL);
    // side disks
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(hd.x + sd * 8.2, hd.y + 1, 2.2, 0, TAU); filled(ctx, grad(ctx, 0, hd.y - 1, 0, hd.y + 3, GA.blue), GA.line, 0.3); }
    // the face, framed by the helmet
    ctx.beginPath();
    ctx.moveTo(hd.x - 5, hd.y - 3.5); ctx.lineTo(hd.x + 5.6, hd.y - 3.5); ctx.lineTo(hd.x + 5, hd.y + 4.4);
    ctx.quadraticCurveTo(hd.x + 0.4, hd.y + 7.6, hd.x - 4.2, hd.y + 4.4); ctx.closePath();
    filled(ctx, grad(ctx, 0, hd.y - 3.5, 0, hd.y + 7, GA.face), GA.line, 0.3);
    // the forehead crest
    poly(ctx, [hd.x - 1.6, hd.y - 3.2, hd.x + 0.3, hd.y - 12, hd.x + 2.2, hd.y - 3.2]);
    filled(ctx, grad(ctx, hd.x - 2, 0, hd.x + 2, 0, GA.blue), GA.line, 0.3);
    // heavy brow, burning eyes, a stern mouth and the lines of an ancient face
    ctx.fillStyle = 'rgba(40,24,70,0.7)';
    poly(ctx, [hd.x - 4.6, hd.y - 1.8, hd.x + 5.2, hd.y - 1.8, hd.x + 4.6, hd.y - 0.6, hd.x - 4, hd.y - 0.6]); ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(hd.x - 3.3, hd.y - 0.5, 2.6, 1); ctx.fillRect(hd.x + 1.6, hd.y - 0.5, 2.6, 1);
    ctx.strokeStyle = '#3a3252'; ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(hd.x - 1.6, hd.y + 3.6); ctx.lineTo(hd.x + 2.6, hd.y + 3.6);
    ctx.moveTo(hd.x - 3.4, hd.y + 1.6); ctx.lineTo(hd.x - 2.6, hd.y + 4.2);
    ctx.moveTo(hd.x + 4.2, hd.y + 1.6); ctx.lineTo(hd.x + 3.4, hd.y + 4.2);
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, hd.x - 2, hd.y, 1.6 + 3.4 * eyeK, GA.eyes, 0.45 + 0.55 * eyeK);
    glow(ctx, hd.x + 2.9, hd.y, 1.6 + 3.4 * eyeK, GA.eyes, 0.45 + 0.55 * eyeK);
    ctx.restore();
  }

  ENEMIES.galactus = function (ctx, e, T) {
    const st = e.state, k = e.charge || 0;
    const firing = st === 'firing', eyeK = st === 'charging' ? k : firing ? 1 : 0.25;
    ctx.save();
    ctx.scale(GAL_K, GAL_K); // designed ~110 units tall, horns included
    const breathe = sin(T * 0.9) * 0.4;
    const stompK = st === 'stomp' ? k : 0;
    const hip = { x: 0, y: -50 + breathe * 0.3 };
    // legs: blue, purple boots and knee plates; the front one lifts for a stomp
    for (const sd of [-1, 1]) {
      const lift = sd > 0 ? stompK : 0;
      const foot = { x: sd * 7 + lift * 4, y: -1 - lift * 15 };
      const kn = joint(hip.x + sd * 6, hip.y, foot.x, foot.y, 25, 25, -1);
      const cols = sd < 0 ? GA.blueD : GA.blue, pcols = sd < 0 ? GA.purpleD : GA.purple;
      limb(ctx, hip.x + sd * 6, hip.y, kn.x, kn.y, 13.5, 10.5, cols, GA.line, GL);
      limb(ctx, kn.x, kn.y, foot.x, foot.y - 2, 10.5, 9, cols, GA.line, GL);
      const bt = { x: lerp(kn.x, foot.x, 0.38), y: lerp(kn.y, foot.y, 0.38) };
      poly(ctx, [bt.x - 6.2, bt.y, bt.x + 6.2, bt.y, foot.x + 5, foot.y - 4, foot.x + 10, foot.y + 1, foot.x - 6.5, foot.y + 1, foot.x - 5.5, foot.y - 5]);
      filled(ctx, grad(ctx, 0, bt.y, 0, foot.y, pcols), GA.line, GL);
      ctx.beginPath(); ctx.ellipse(kn.x + 0.5, kn.y, 6, 5, 0, 0, TAU); filled(ctx, grad(ctx, kn.x, kn.y - 5, kn.x, kn.y + 5, pcols), GA.line, GL);
    }
    const sh = { x: 0, y: -78 + breathe };
    const orbK = st === 'orbs' ? 1 : 0, drainK = st === 'drain' ? k : 0, metK = st === 'meteors' ? k : 0;
    // back arm
    const bh = drainK ? { x: lerp(-20, 22, drainK), y: lerp(hip.y + 2, -60, drainK) } : { x: -21, y: hip.y + 2 };
    const bEl = joint(sh.x - 15, sh.y + 2, bh.x, bh.y, 16, 16, drainK ? 1 : -1);
    limb(ctx, sh.x - 15, sh.y + 2, bEl.x, bEl.y, 9.5, 8.5, GA.blueD, GA.line, GL);
    limb(ctx, bEl.x, bEl.y, bh.x, bh.y, 9.2, 8, GA.purpleD, GA.line, GL);
    ctx.beginPath(); ctx.arc(bh.x, bh.y, 4.6, 0, TAU); filled(ctx, grad(ctx, bh.x, bh.y - 4, bh.x, bh.y + 4, GA.purpleD), GA.line, GL);
    // torso: blue armour, purple chest box with the "G", purple belt and the front plate
    ctx.beginPath();
    ctx.moveTo(-15, sh.y); ctx.quadraticCurveTo(0, sh.y - 4, 15, sh.y);
    ctx.lineTo(10.5, hip.y - 2); ctx.quadraticCurveTo(0, hip.y + 2, -10.5, hip.y - 2); ctx.closePath();
    filled(ctx, grad(ctx, -15, sh.y, 15, hip.y, GA.blue), GA.line, GL);
    poly(ctx, [-12, sh.y + 1, 12, sh.y + 1, 9, sh.y + 19, 0, sh.y + 22, -9, sh.y + 19]);
    filled(ctx, grad(ctx, -12, sh.y, 12, sh.y + 22, GA.purple), GA.line, GL);
    ctx.strokeStyle = 'rgba(30,10,60,0.5)'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(-10, sh.y + 4); ctx.lineTo(-6.5, sh.y + 4); ctx.moveTo(10, sh.y + 4); ctx.lineTo(6.5, sh.y + 4); ctx.stroke();
    ctx.beginPath(); ctx.rect(-6, sh.y + 4.5, 12, 11); filled(ctx, grad(ctx, 0, sh.y + 4, 0, sh.y + 16, GA.purpleD), GA.line, GL);
    ctx.save();
    if (e.facing < 0) ctx.scale(-1, 1); // keep the G readable when he faces left
    ctx.strokeStyle = '#fff0ff'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, sh.y + 10, 3.3, 0.35, TAU - 0.55); ctx.moveTo(3.3, sh.y + 10.7); ctx.lineTo(0.5, sh.y + 10.7); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, sh.y + 10, 6, '230,200,255', 0.25 + 0.3 * eyeK); ctx.restore();
    ctx.beginPath(); ctx.rect(-11, hip.y - 5.5, 22, 4.5); filled(ctx, grad(ctx, 0, hip.y - 5, 0, hip.y - 1, GA.purple), GA.line, GL);
    poly(ctx, [-5.5, hip.y - 1.2, 5.5, hip.y - 1.2, 4, hip.y + 12, -4, hip.y + 12]);
    filled(ctx, grad(ctx, 0, hip.y, 0, hip.y + 12, GA.purpleD), GA.line, GL);
    // the great shoulder pads
    for (const sd of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sd * 15.5, sh.y + 1.5, 9, 6.2, sd * 0.3, PI * 0.95, TAU * 1.0); ctx.lineTo(sd * 22, sh.y + 6); ctx.lineTo(sd * 9, sh.y + 6); ctx.closePath();
      filled(ctx, grad(ctx, 0, sh.y - 5, 0, sh.y + 6, sd < 0 ? GA.purpleD : GA.purple), GA.line, GL);
      ctx.strokeStyle = 'rgba(30,10,60,0.45)'; ctx.lineWidth = 0.35;
      ctx.beginPath(); ctx.ellipse(sd * 15.5, sh.y + 3, 6.5, 3.6, sd * 0.3, PI * 1.05, TAU * 0.98); ctx.stroke();
    }
    galactusHead(ctx, { x: 1, y: -88 + breathe }, eyeK);
    // front arm: palm-up for cosmic orbs, raised to the sky for meteors, reaching out to drain
    const hand = orbK ? { x: 21, y: -50 } : metK ? { x: lerp(18, 16, metK), y: lerp(hip.y + 3, -102, metK) } : drainK ? { x: lerp(18, 24, drainK), y: lerp(hip.y + 3, -62, drainK) } : { x: 18 + stompK * 2, y: hip.y + 3 };
    const up = orbK || metK || drainK;
    const el = joint(sh.x + 15, sh.y + 2, hand.x, hand.y, 16, 16, up ? (metK ? -1 : 1) : -1);
    limb(ctx, sh.x + 15, sh.y + 2, el.x, el.y, 9.5, 8.5, GA.blue, GA.line, GL);
    limb(ctx, el.x, el.y, hand.x, hand.y, 9.2, 8, GA.purple, GA.line, GL);
    ctx.beginPath(); ctx.ellipse(lerp(el.x, hand.x, 0.25), lerp(el.y, hand.y, 0.25), 2, 5.4, atan2(hand.y - el.y, hand.x - el.x), 0, TAU); filled(ctx, grad(ctx, 0, el.y - 5, 0, el.y + 5, GA.purple), GA.line, 0.35);
    ctx.beginPath(); ctx.arc(hand.x, hand.y, 4.6, 0, TAU); filled(ctx, grad(ctx, hand.x, hand.y - 4, hand.x, hand.y + 4, GA.purple), GA.line, GL);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (orbK) glow(ctx, hand.x, hand.y - 3, 10, '200,170,255', 0.8);
    if (metK) { glow(ctx, hand.x, hand.y - 4, 6 + 7 * metK, '255,170,90', 0.8 * metK); glow(ctx, hand.x, hand.y - 4, 4 + 4 * metK, '255,240,200', metK); }
    if (drainK) { glow(ctx, hand.x + 2, hand.y, 7 + 9 * drainK, '200,120,255', 0.85 * drainK); glow(ctx, bh.x + 2, bh.y, 6 + 7 * drainK, '200,120,255', 0.7 * drainK); }
    if (stompK > 0.6) glow(ctx, 9, -2, 16, '220,180,255', (stompK - 0.6) * 1.5);
    ctx.restore();
    ctx.restore();
    hpBar(ctx, e, 240, -948, 'GALACTUS');
  };

  // ------------------------------------------------------------------ projectiles
  function drawRock(ctx, x, y, size, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(size, size);
    poly(ctx, [-7, -3, -3, -7, 4, -6, 7, -1, 5, 5, -1, 7, -6, 4]);
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
      case 'glaser': {
        const a = atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(70,255,120,0.45)'; ctx.fillRect(-15, -2.6, 17, 5.2);
        ctx.fillStyle = 'rgba(225,255,230,0.95)'; ctx.fillRect(-12, -0.9, 13, 1.8);
        ctx.restore();
        return true;
      }
      case 'mystic': {
        const a = atan2(p.vy, p.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 4; i++) glow(ctx, x - cos(a) * i * 5, y - sin(a) * i * 5, 6 - i, '90,255,140', 0.5 - i * 0.1);
        ctx.restore();
        orb(ctx, x, y, 4.8, '90,255,140', 'rgba(230,255,235,0.95)');
        return true;
      }
      case 'powerorb': {
        // the Power Stone's sphere: purple fire with crackling arcs
        const r = 8 * sz;
        orb(ctx, x, y, r, '190,80,255', 'rgba(250,225,255,0.98)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(230,170,255,0.9)'; ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          let a = i * 1.26 + T * 7, rr = r * 0.4;
          ctx.moveTo(x + cos(a) * rr, y + sin(a) * rr);
          for (let j = 0; j < 3; j++) { a += sin(T * 30 + i + j) * 0.5; rr += r * 0.45; ctx.lineTo(x + cos(a) * rr, y + sin(a) * rr); }
        }
        ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'chrono': {
        const a = atan2(p.vy, p.vx);
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(80,240,255,0.5)'; ctx.fillRect(-17, -2.8, 19, 5.6);
        ctx.fillStyle = 'rgba(225,255,255,0.95)'; ctx.fillRect(-13, -1, 15, 2);
        ctx.strokeStyle = 'rgba(80,240,255,0.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(-11, 0, 1.8, 4.4, 0, 0, TAU); ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'timeblast': {
        orb(ctx, x, y, 7 * sz * 0.6, '80,240,255', 'rgba(235,255,255,0.95)');
        ctx.save();
        ctx.strokeStyle = 'rgba(80,240,255,0.8)'; ctx.lineWidth = 1.1;
        const R = 9 * sz * 0.6;
        ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
        const a = T * 6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * R * 0.8, y + sin(a) * R * 0.8); ctx.moveTo(x, y); ctx.lineTo(x + cos(a / 12) * R * 0.55, y + sin(a / 12) * R * 0.55); ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'cosmic': {
        orb(ctx, x, y, 6 * sz, '200,170,255', 'rgba(255,250,255,0.98)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const a = T * 4 + i * PI / 2; glow(ctx, x + cos(a) * 9 * sz, y + sin(a) * 9 * sz, 2.5 * sz, '255,220,255', 0.7); }
        ctx.restore();
        return true;
      }
      case 'meteor': {
        // a burning rock with a long fiery trail
        const a = atan2(p.vy, p.vx), L = 50 + 26 * sz;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, y); ctx.rotate(a);
        const g = ctx.createLinearGradient(-L, 0, 0, 0);
        g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(0.7, 'rgba(255,150,50,0.6)'); g.addColorStop(1, 'rgba(255,240,190,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -9 * sz); ctx.quadraticCurveTo(-L * 0.6, -5 * sz, -L, 0); ctx.quadraticCurveTo(-L * 0.6, 5 * sz, 0, 9 * sz); ctx.closePath(); ctx.fill();
        glow(ctx, 0, 0, 18 * sz, '255,150,60', 0.85);
        ctx.restore();
        drawRock(ctx, x, y, 1.3 * sz, (p.age || 0) * 5);
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
      const pts = lightning(ctx, x1, y1, b.x2, b.y2, b.w * S, T, b.strike ? x1 : 0);
      for (let f = 1; f <= 2; f++) {
        const p = pts[Math.floor(pts.length * f / 3)];
        const a = atan2(b.y2 - y1, b.x2 - x1) + (f % 2 ? 0.6 : -0.6);
        lightning(ctx, p.x, p.y, p.x + cos(a) * 60 * S, p.y + sin(a) * 60 * S, b.w * S * 0.5, T, f * 7);
      }
      glow(ctx, b.strike ? b.x2 : x1, b.strike ? b.y2 : y1, (b.strike ? 30 : 14) * S, halo, 0.9);
      ctx.restore();
      return true;
    }
    if (b.kind === 'drain') {
      // Galactus drinking a hero's power: a writhing purple tendril, motes flowing to his hand
      ctx.globalAlpha = Math.min(1, life * 5, age * 6);
      const L = hypot(b.x2 - x1, b.y2 - y1) || 1, n = max(8, Math.floor(L / 18));
      const nx = -(b.y2 - y1) / L, ny = (b.x2 - x1) / L;
      const at = (k) => { const wv = sin(k * 9 - T * 8) * 9 * S * sin(k * PI); return { x: lerp(x1, b.x2, k) + nx * wv, y: lerp(y1, b.y2, k) + ny * wv }; };
      for (const [lw, col] of [[b.w * S * 2.4, 'rgba(170,80,255,0.3)'], [b.w * S, 'rgba(210,150,255,0.8)'], [b.w * S * 0.35, 'rgba(255,240,255,0.95)']]) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const p = at(i / n); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
        ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
      }
      for (let i = 0; i < 7; i++) { const k = 1 - ((i / 7 + age * 0.9) % 1); const p = at(k); glow(ctx, p.x, p.y, 7 * S, '230,190,255', 0.9); }
      glow(ctx, b.x2, b.y2, 22 * S, '190,110,255', 0.7);
      ctx.restore();
      return true;
    }
    if (b.kind === 'gauntlet' || b.kind === 'cosmic') {
      ctx.globalAlpha = Math.min(1, life * 4, age * 8);
      ctx.globalCompositeOperation = 'source-over';
      if (b.kind === 'cosmic') {
        // two eye beams side by side
        const a = atan2(b.y2 - y1, b.x2 - x1), ox = -sin(a) * 7 * S, oy = cos(a) * 7 * S;
        IA.drawBeam(ctx, x1 - ox, y1 - oy, b.x2 - ox, b.y2 - oy, b.w * S * 0.6, age, halo, core);
        IA.drawBeam(ctx, x1 + ox, y1 + oy, b.x2 + ox, b.y2 + oy, b.w * S * 0.6, age, halo, core);
      } else {
        IA.drawBeam(ctx, x1, y1, b.x2, b.y2, b.w * S, age, halo, core);
        // the stones' colours sparkle along it
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const k = ((i / 12) + age * 0.8) % 1;
          glow(ctx, lerp(x1, b.x2, k), lerp(y1, b.y2, k), 7 * S, hexRgb(TH.stones[STONES[i % 6]]), 0.8);
        }
      }
      ctx.restore();
      return true;
    }
    ctx.restore();
    return false;
  }

  // ------------------------------------------------------------------ effects (particles)
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
  // the Space Stone's portal: a blue ring of sparks
  IA.FX.spaceportal = function (ctx, p) {
    ctx.globalCompositeOperation = 'lighter';
    const r = 26 * sin(min(1, p.k * 1.4) * PI * 0.5) * (1 - max(0, p.k - 0.7) / 0.3);
    ctx.strokeStyle = `rgba(110,190,255,${0.95 * (1 - p.k * 0.6)})`; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(220,240,255,${0.8 * (1 - p.k)})`; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + p.k * 6; ctx.moveTo(cos(a) * r * 0.62, sin(a) * r); ctx.lineTo(cos(a) * r * 0.8, sin(a) * r * 1.2); }
    ctx.stroke();
    glow(ctx, 0, 0, r * 0.8 + 1, '60,140,255', 0.7 * (1 - p.k));
    ctx.globalCompositeOperation = 'source-over';
  };
  // the snap: a fleck of dust drifting away
  IA.FX.snapdust = function (ctx, p) {
    ctx.rotate(p.rot);
    ctx.fillStyle = `rgba(${p.color || '150,120,100'},${0.85 * (1 - p.k * 0.7)})`;
    ctx.fillRect(-1.6, -1.1, 3.2, 2.2);
  };
  // a purple burst (the Power Stone)
  IA.FX.purplering = function (ctx, p) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(210,140,255,${0.9 * (1 - p.k)})`;
    ctx.lineWidth = 3.5 * (1 - p.k) + 0.6;
    ctx.beginPath(); ctx.arc(0, 0, 8 + 50 * p.k, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };
  // cracks in the floor (Galactus's stomp)
  IA.FX.crack = function (ctx, p) {
    ctx.strokeStyle = `rgba(40,30,30,${0.7 * (1 - p.k)})`; ctx.lineWidth = 1.4;
    ctx.rotate(p.rot * 0.15);
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-12, -2); ctx.lineTo(-4, 1.5); ctx.lineTo(10, -1.5); ctx.lineTo(30, 1); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(220,170,255,${0.6 * (1 - p.k)})`; ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  // the sim's fx events for the villains (ironScene asks before its own)
  function expandFx(e, S, spawn) {
    switch (e.kind) {
      case 'timeportal':
        spawn({ kind: 'timeportal', x: e.x, y: e.y, n: 1, size: (e.size || 1) * S, life: 0.7 });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 8, speed: 140 * S, size: S, life: 0.4, color: '160,250,255' });
        return true;
      case 'spaceportal':
        spawn({ kind: 'spaceportal', x: e.x, y: e.y, n: 1, size: (e.size || 1) * S, life: 0.9 });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 10, speed: 160 * S, size: S, life: 0.5 });
        return true;
      case 'doomport':
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: (e.size || 1) * 1.4 * S, life: 0.5, color: '90,255,140' });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 2, size: (e.size || 1) * S, life: 0.6, color: '120,255,160', stagger: 0.12 });
        return true;
      case 'powerburst': {
        const z = (e.size || 1) * S;
        spawn({ kind: 'flash', x: e.x, y: e.y, n: 1, size: 2.2 * z, life: 0.45, color: '200,110,255' });
        spawn({ kind: 'purplering', x: e.x, y: e.y, n: 2, size: z, life: 0.6, stagger: 0.1 });
        spawn({ kind: 'spark', x: e.x, y: e.y, n: 14, speed: 280 * z, size: z, life: 0.5 });
        spawn({ kind: 'smoke', x: e.x, y: e.y, n: 6, spread: 16 * z, size: z, life: 1.2, rise: 30 });
        return true;
      }
      case 'dust':
        // turned to dust by the snap
        spawn({ kind: 'snapdust', x: e.x, y: e.y, n: 90, spread: 30 * S, speed: 70 * S, size: 1.5 * S, life: 2.6, rise: 40, g: -10, color: e.color });
        spawn({ kind: 'snapdust', x: e.x, y: e.y - 20 * S, n: 50, spread: 20 * S, speed: 50 * S, size: 1.1 * S, life: 3.2, rise: 30, g: -6, color: e.color });
        return true;
      case 'quake':
        for (let i = -4; i <= 4; i++) {
          spawn({ kind: 'crack', x: e.x + i * 110 * S, y: e.y - 1, n: 1, size: 1.6 * S, life: 1.6 });
          spawn({ kind: 'dust', x: e.x + i * 110 * S, y: e.y - 4, n: 8, spread: 40 * S, speed: 90 * S, size: 1.6 * S, life: 1.2, rise: 60, color: '120,105,95' });
        }
        return true;
      case 'crater': {
        const z = (e.size || 1) * S;
        spawn({ kind: 'fire', x: e.x, y: e.y - 6 * z, n: 6, spread: 14 * z, size: z, life: 0.7 });
        spawn({ kind: 'dust', x: e.x, y: e.y - 3, n: 14, spread: 20 * z, speed: 120 * z, size: 1.4 * z, life: 1, rise: 50, color: '110,95,85' });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 1, size: 1.4 * z, life: 0.5, flat: 0.25 });
        return true;
      }
      case 'galactusDown': {
        // the Devourer of Worlds falls: fire up his whole height, debris everywhere
        const G = (e.size || 1) * S;
        for (let i = 0; i < 12; i++) {
          const y = e.y - i * 72 * G;
          spawn({ kind: 'fire', x: e.x + (Math.random() - 0.5) * 160 * G, y, n: 6, spread: 60 * G, size: 3.4 * G, life: 1.2 });
          spawn({ kind: 'smoke', x: e.x, y, n: 4, spread: 80 * G, size: 3.4 * G, life: 2.2, rise: 30 });
        }
        spawn({ kind: 'flash', x: e.x, y: e.y - 400 * G, n: 1, size: 11 * G, life: 0.9, color: '230,200,255' });
        spawn({ kind: 'debris', x: e.x, y: e.y - 340 * G, n: 80, speed: 800 * G, size: 2.6 * G, life: 2.6, g: 500, color: '#6b4fb0' });
        spawn({ kind: 'ember', x: e.x, y: e.y - 260 * G, n: 60, speed: 480 * G, size: 2, life: 2.4, g: 100 });
        spawn({ kind: 'ring', x: e.x, y: e.y, n: 3, size: 7 * G, life: 1.2, flat: 0.25, stagger: 0.2 });
        return true;
      }
      case 'stormMark': case 'timefreeze': return true; // drawn by drawWorld from the snapshot
      default: return false;
    }
  }

  // ------------------------------------------------------------------ world overlays
  // drawn on the fx layer from the snapshot: Doom's storm marks and heroes frozen in time
  function drawWorld(ctx, s, T, inB) {
    const S = s.s;
    const now = Date.now();
    for (const st of s.strikes || []) {
      if (!inB(st, 80)) continue;
      const left = (st.at - now) / 1000;
      if (left < 0) continue;
      const a = clamp(1 - left / 1.2, 0.25, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(110,255,160,${0.9 * a})`; ctx.lineWidth = 2;
      const r = (16 + 10 * sin(T * 14)) * S;
      ctx.beginPath(); ctx.ellipse(st.x, st.y - 2, r * 1.6, r * 0.4, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(st.x, st.y - 2, r * 0.8, r * 0.2, 0, 0, TAU); ctx.stroke();
      glow(ctx, st.x, st.y - 4, 26 * S, '90,255,140', 0.5 * a);
      // a faint column where it will strike
      const g = ctx.createLinearGradient(0, st.y - 300 * S, 0, st.y);
      g.addColorStop(0, 'rgba(90,255,140,0)'); g.addColorStop(1, `rgba(90,255,140,${0.22 * a})`);
      ctx.fillStyle = g; ctx.fillRect(st.x - 9 * S, st.y - 300 * S, 18 * S, 300 * S);
      ctx.restore();
    }
    for (const h of [s.hero, ...(s.allies || [])]) {
      if (!h || !(h.frozen > 0)) continue;
      const c = { x: h.x, y: h.y - 58 * S * (h.body || 1) };
      if (!inB(c, 120)) continue;
      const R = 62 * S * (h.body || 1), a = clamp(h.frozen / 0.3, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(c.x, c.y, R * 0.4, c.x, c.y, R);
      g.addColorStop(0, 'rgba(80,240,255,0)'); g.addColorStop(0.85, `rgba(80,240,255,${0.16 * a})`); g.addColorStop(1, `rgba(170,250,255,${0.55 * a})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      // a clock face: ticks around the rim, hands stuck in place
      ctx.strokeStyle = `rgba(170,250,255,${0.8 * a})`; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) { const an = i * TAU / 12; ctx.moveTo(c.x + cos(an) * R * 0.86, c.y + sin(an) * R * 0.86); ctx.lineTo(c.x + cos(an) * R * 0.97, c.y + sin(an) * R * 0.97); }
      ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + cos(-1.2) * R * 0.6, c.y + sin(-1.2) * R * 0.6);
      ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + cos(0.4) * R * 0.42, c.y + sin(0.4) * R * 0.42);
      ctx.stroke();
      ctx.strokeStyle = `rgba(120,240,255,${0.5 * a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(c.x, c.y, R * (1.05 + 0.04 * sin(T * 8)), T * 0.3, T * 0.3 + PI * 1.2); ctx.stroke();
      ctx.restore();
    }
  }
  function worldBusy(s) {
    return !!((s.strikes && s.strikes.length) || [s.hero, ...(s.allies || [])].some((h) => h && h.frozen > 0));
  }

  // ------------------------------------------------------------------ sprite boxes, names, portraits
  // box = sprite canvas (units), cy = centre (reticle), r = hit radius; face = portrait framing
  // (centre and height of the head-and-shoulders); color = theme of the portrait and boss bar
  const INFO = {
    drone: { box: { w: 82, h: 82, ax: 41, ay: 42 }, cy: 0, r: 22, face: { x: 0, y: -18, h: 25 }, color: '#ff5a3c', name: 'ULTRON SENTRY' },
    mini: { box: { w: 52, h: 44, ax: 26, ay: 22 }, cy: 0, r: 11, face: { x: 0, y: 0, h: 22 }, color: '#ff5a3c', name: 'ULTRON DRONE' },
    walker: { box: { w: 100, h: 100, ax: 50, ay: 94 }, cy: -39, r: 29, face: { x: 2.3, y: -65, h: 28 }, color: '#ff5a3c', name: 'ULTRON SOLDIER' },
    tank: { box: { w: 124, h: 118, ax: 62, ay: 110 }, cy: -44, r: 34, face: { x: 3, y: -79, h: 34 }, color: '#ff3b2f', name: 'ULTRON PRIME' },
    doombot: { box: { w: 100, h: 118, ax: 50, ay: 64 }, cy: 0, r: 24, face: { x: 1, y: -30, h: 34 }, color: '#4fdc7a', name: 'DOOMBOT' },
    thanos: { box: { w: 224, h: 284, ax: 112, ay: 272 }, cy: -100, r: 66, face: { x: 9, y: -175, h: 66 }, color: '#b86cff', name: 'THANOS', title: 'THE MAD TITAN' },
    doom: { box: { w: 210, h: 222, ax: 105, ay: 120 }, cy: 0, r: 54, face: { x: 2, y: -56, h: 70 }, color: '#4fdc7a', name: 'DOCTOR DOOM', title: 'MONARCH OF LATVERIA' },
    kang: { box: { w: 200, h: 200, ax: 100, ay: 190 }, cy: -76, r: 50, face: { x: 5, y: -128, h: 62 }, color: '#5fe8ff', name: 'KANG THE CONQUEROR', title: 'MASTER OF TIME' },
    galactus: { box: { w: 700, h: 1010, ax: 350, ay: 995 }, cy: -212, r: 212, face: { x: 8, y: -808, h: 300 }, color: '#c9a0ff', name: 'GALACTUS', title: 'DEVOURER OF WORLDS' },
  };
  INFO.swarm = INFO.mini; INFO.boss = INFO.thanos;
  const ALIAS = { swarm: 'mini', boss: 'thanos', mech: 'thanos', ultron: 'walker' };

  // a villain's portrait (head and shoulders) in a size×size square at (0, 0)
  function drawAvatar(ctx, kind, size, T, o) {
    kind = ALIAS[kind] || kind;
    const info = INFO[kind], fn = ENEMIES[kind];
    if (!info || !fn) return false;
    o = o || {};
    T = T == null ? 1.3 : T;
    ctx.save();
    if (!o.noBg) {
      const g = ctx.createRadialGradient(size * 0.5, size * 0.4, size * 0.05, size * 0.5, size * 0.5, size * 0.72);
      g.addColorStop(0, `rgba(${hexRgb(info.color)},0.55)`); g.addColorStop(1, 'rgba(8,10,20,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath();
      if (o.round) ctx.arc(size / 2, size / 2, size / 2, 0, TAU); else ctx.rect(0, 0, size, size);
      ctx.fill();
    }
    ctx.beginPath();
    if (o.round) ctx.arc(size / 2, size / 2, size / 2, 0, TAU); else ctx.rect(0, 0, size, size);
    ctx.clip();
    const f = info.face, k = size * 0.82 / f.h;
    ctx.translate(size * 0.5, size * 0.52);
    ctx.scale(k, k);
    ctx.translate(-f.x, -f.y);
    fn(ctx, { kind, hp: 1, maxHp: 1, facing: 1, phase: 0, charge: o.charge || 0, state: o.state || 'idle', vx: 0, vy: 0, noBar: true }, T);
    ctx.restore();
    return true;
  }

  // ------------------------------------------------------------------ sounds
  const sounds = {
    gauntlet(L) { L.blip('sawtooth', 70, 140, 1.1, 0.12); L.blip('sine', 220, 660, 1.1, 0.08); L.hiss('bandpass', 400, 2, 1, 0.08, 0, 1600); },
    snap(L) { L.hiss('highpass', 3000, 1, 0.05, 0.4); L.blip('sine', 80, 40, 2.2, 0.16, 0.05); L.hiss('lowpass', 600, 0.7, 2, 0.12, 0.1); [523, 659, 784].forEach((f, i) => L.blip('sine', f * 2, f, 1.6, 0.04, 0.2 + i * 0.1)); },
    mystic(L) { [880, 1175, 1568].forEach((f, i) => L.blip('triangle', f, f * 0.7, 0.25, 0.06, i * 0.05)); L.hiss('bandpass', 1200, 1.5, 0.35, 0.12, 0, 3000); },
    lightning(L) { for (let i = 0; i < 6; i++) L.hiss('highpass', 2200 + Math.random() * 2000, 0.8, 0.06, 0.22, i * 0.12 + Math.random() * 0.05); L.blip('square', 90, 60, 0.7, 0.05); },
    shield(L) { L.blip('sine', 300, 900, 0.5, 0.08); L.blip('sine', 450, 1350, 0.5, 0.05, 0.05); },
    timeWarp(L) { L.blip('sine', 1400, 200, 0.35, 0.1); L.blip('sine', 200, 1400, 0.35, 0.08, 0.3); L.hiss('bandpass', 900, 3, 0.6, 0.08, 0, 2500); },
    timeStop(L) { [1760, 1320, 880].forEach((f, i) => L.blip('triangle', f, f, 0.12, 0.06, i * 0.14)); L.blip('sine', 600, 60, 0.9, 0.08, 0.4); },
    chrono(L) { L.blip('square', 1800, 600, 0.09, 0.05); L.blip('sine', 2400, 1200, 0.08, 0.05); },
    timeBlast(L) { L.blip('sawtooth', 300, 90, 0.5, 0.1); L.hiss('lowpass', 900, 0.8, 0.4, 0.2); },
    cosmicHum(L) { [55, 82.5, 110].forEach((f) => L.blip('sawtooth', f, f * 1.02, 1.5, 0.08)); L.blip('sine', 440, 880, 1.5, 0.04); },
    drain(L) { L.blip('sawtooth', 220, 55, 2.2, 0.08); L.blip('sine', 880, 110, 2.2, 0.05); L.hiss('bandpass', 500, 4, 2, 0.06); },
    quake(L) { L.blip('sine', 45, 28, 1.6, 0.2); L.hiss('lowpass', 220, 0.6, 1.6, 0.25); },
  };

  Object.assign(IA.ENEMIES, ENEMIES);
  IA.drawVillainAvatar = drawAvatar;
  root.VillainArt = { ENEMIES, INFO, drawShot, drawBeam, expandFx, drawRock, drawAvatar, drawWorld, worldBusy, scales: { TH_K, DOOM_K, KANG_K, GAL_K, BOT_K } };
  root.HeroArts = root.HeroArts || {};
  root.HeroArts.villains = { sounds, villains: true }; // only here so sound.js finds these by name
})(typeof window !== 'undefined' ? window : globalThis);
