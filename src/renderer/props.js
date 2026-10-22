/*
 * Desktop Cat — props, icons, tools and particles (procedural canvas art).
 * All draw functions draw centred on the current origin, in "cat units".
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const { sin, cos, max, min, abs, PI, hypot } = Math;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // deterministic random from a seed
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return (s % 100000) / 100000;
    };
  }

  function rrect(ctx, x, y, w, h, r) {
    r = min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function heart(ctx, x, y, s) {
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
    ctx.closePath();
  }

  function star(ctx, x, y, r, points, inner) {
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * TAU - PI / 2;
      const rr = i % 2 ? r * inner : r;
      if (i === 0) ctx.moveTo(x + cos(a) * rr, y + sin(a) * rr);
      else ctx.lineTo(x + cos(a) * rr, y + sin(a) * rr);
    }
    ctx.closePath();
  }

  // ---------------------------------------------------------------- icons
  // Drawn centred at 0,0 roughly fitting a 22×22 box.
  const ICONS = {
    fish(ctx, T) {
      ctx.save();
      ctx.rotate(0.08 * sin(T * 4));
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-1, -9, 8, -1);
      ctx.lineTo(8, 1);
      ctx.quadraticCurveTo(-1, 9, -10, 0);
      ctx.closePath();
      ctx.fillStyle = '#6fb0f0'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#3a6ea8'; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 0); ctx.lineTo(12, -6); ctx.lineTo(11, 0); ctx.lineTo(12, 6); ctx.closePath();
      ctx.fillStyle = '#4f8fd6'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-5, -1.5, 1.6, 0, TAU); ctx.fillStyle = '#1d2a3a'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1, -5); ctx.quadraticCurveTo(1, 0, -1, 5);
      ctx.strokeStyle = 'rgba(30,70,120,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    },
    zzz(ctx, T) {
      ctx.fillStyle = '#5d7cf0';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const b = sin(T * 3) * 1.2;
      ctx.fillText('Z', -5, 4 + b);
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('z', 3, -1 - b);
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.fillText('z', 9, -6 + b);
    },
    bed(ctx, T) {
      // crescent moon (outer arc minus inner arc, as one path)
      ctx.beginPath();
      ctx.arc(-1, 0, 8, -0.95, 0.95 + PI * 2 - PI * 2 + PI * 1.15, false);
      ctx.arc(3.2, -2.6, 6.6, 1.95, -0.62 + PI * 2 - PI * 2 - PI * 0.05, true);
      ctx.closePath();
      ctx.fillStyle = '#ffd45c'; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = '#d9a72c'; ctx.stroke();
      ctx.fillStyle = '#5d7cf0';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('z', 8, -5 + sin(T * 3));
    },
    poop(ctx, T) {
      ctx.save();
      ctx.scale(0.62, 0.62);
      PROPS.poop(ctx, { seed: 3, age: 0 }, T, true);
      ctx.restore();
    },
    heart(ctx, T) {
      const s = 8.5 * (1 + 0.08 * sin(T * 6));
      ctx.beginPath(); heart(ctx, 0, 2, s);
      ctx.fillStyle = '#ff4f86'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#c42a5c'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-3.5, -2.5, 2, 1.3, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    },
    brokenHeart(ctx, T) {
      ICONS.heart(ctx, T);
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(-2, 0); ctx.lineTo(1.5, 2); ctx.lineTo(-0.5, 6);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    },
    yarn(ctx, T) {
      ctx.save(); ctx.scale(0.95, 0.95); PROPS.yarnBall(ctx, T * 2, 8.5); ctx.restore();
    },
    mouse(ctx, T) {
      ctx.save(); ctx.scale(0.85, 0.85); TOOLS.mouse(ctx, T, 0, true); ctx.restore();
    },
    note(ctx, T) {
      ctx.save();
      ctx.translate(0, sin(T * 4) * 1.2);
      ctx.fillStyle = '#8a6cf0';
      ctx.beginPath(); ctx.ellipse(-4, 5, 3.5, 2.6, -0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, 3, 3.5, 2.6, -0.4, 0, TAU); ctx.fill();
      ctx.fillRect(-1.2, -7, 1.8, 12);
      ctx.fillRect(8.8, -9, 1.8, 12);
      ctx.beginPath(); ctx.moveTo(-1.2, -7); ctx.lineTo(10.6, -9); ctx.lineTo(10.6, -6); ctx.lineTo(-1.2, -4); ctx.fill();
      ctx.restore();
    },
    sick(ctx, T) {
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#e0485a'; ctx.stroke();
      ctx.fillStyle = '#e0485a';
      ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
    },
    bang(ctx, T) {
      ctx.fillStyle = '#ff5a4f';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, 1 + abs(sin(T * 8)) * -1.5);
    },
    question(ctx, T) {
      ctx.fillStyle = '#7a7fa0';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.save(); ctx.rotate(0.15 * sin(T * 3)); ctx.fillText('?', 0, 1); ctx.restore();
    },
    angry(ctx, T) {
      const s = 6 * (1 + 0.15 * sin(T * 10));
      ctx.strokeStyle = '#ff3b4f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let q = 0; q < 4; q++) {
        const a = q * PI / 2 + PI / 4;
        const cx = cos(a) * s, cy = sin(a) * s;
        ctx.moveTo(cx + cos(a + PI / 2) * s * 0.6, cy + sin(a + PI / 2) * s * 0.6);
        ctx.quadraticCurveTo(cos(a) * s * 0.3, sin(a) * s * 0.3, cx + cos(a - PI / 2) * s * 0.6, cy + sin(a - PI / 2) * s * 0.6);
      }
      ctx.stroke();
    },
    milk(ctx, T) {
      ctx.beginPath(); rrect(ctx, -5, -6, 10, 14, 2.5);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#8aa0c8'; ctx.stroke();
      ctx.beginPath(); rrect(ctx, -3, -10, 6, 5, 1.5); ctx.fillStyle = '#7fb3ff'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7fb3ff'; ctx.fillRect(-5, 0, 10, 3);
    },
    sparkle(ctx, T) {
      ctx.beginPath(); star(ctx, 0, 0, 9, 4, 0.35);
      ctx.fillStyle = '#ffd84d'; ctx.fill();
      ctx.beginPath(); star(ctx, 8, -7, 4, 4, 0.35); ctx.fill();
    },
    brush(ctx, T) { ctx.save(); ctx.rotate(-0.6); ctx.scale(0.7, 0.7); TOOLS.brush(ctx, T, true); ctx.restore(); },
    sun(ctx, T) {
      ctx.save(); ctx.rotate(T * 0.8);
      ctx.strokeStyle = '#ffb02e'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.moveTo(cos(a) * 7.5, sin(a) * 7.5); ctx.lineTo(cos(a) * 10.5, sin(a) * 10.5); }
      ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, TAU); ctx.fillStyle = '#ffc93c'; ctx.fill();
    },
    gift(ctx, T) {
      // a little wrapped present
      ctx.save();
      ctx.rotate(0.06 * sin(T * 3));
      ctx.beginPath(); rrect(ctx, -8, -2, 16, 11, 1.5);
      ctx.fillStyle = '#ff5c8a'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#b82a57'; ctx.stroke();
      ctx.beginPath(); rrect(ctx, -9.5, -6, 19, 5, 1.5);
      ctx.fillStyle = '#ff7aa2'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd84d';
      ctx.fillRect(-1.6, -6, 3.2, 15);
      ctx.strokeStyle = '#c99a1c'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(-3.6, -8, 3.4, 2.2, -0.5, 0, TAU);
      ctx.moveTo(7, -8);
      ctx.ellipse(3.6, -8, 3.4, 2.2, 0.5, 0, TAU);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -7, 1.6, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    tomato(ctx, T) {
      // the focus-timer tomato
      ctx.save();
      ctx.translate(0, 1.5 + 0.5 * sin(T * 2));
      ctx.beginPath(); ctx.ellipse(0, 1, 9, 7.6, 0, 0, TAU);
      const g = ctx.createRadialGradient(-3, -2, 1, 0, 1, 10);
      g.addColorStop(0, '#ff8a7a'); g.addColorStop(1, '#e0362c');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.1; ctx.strokeStyle = '#9e1f17'; ctx.stroke();
      ctx.fillStyle = '#4caf50'; ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -PI / 2 + (i - 2) * 0.62;
        ctx.moveTo(0, -6); ctx.quadraticCurveTo(cos(a - 0.3) * 4, -6 + sin(a - 0.3) * 2.5, cos(a) * 5.5, -6 + sin(a) * 1.2 + 2.2);
        ctx.quadraticCurveTo(cos(a + 0.3) * 3, -6 + sin(a + 0.3) * 1.5, 0, -6);
      }
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0.8, -9.5); ctx.lineWidth = 1.4; ctx.strokeStyle = '#2e7d32'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-3.5, -1.5, 2, 1.2, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
      ctx.restore();
    },
    feather(ctx, T) {
      ctx.save();
      ctx.translate(0, -7);
      ctx.scale(0.9, 0.9);
      lureBody(ctx, T);
      ctx.restore();
    },
  };

  // The feathered lure of the wand toy: bead at the origin, three feathers hanging below it.
  function lureBody(ctx, T) {
    const fl = sin(T * 7.5);
    const feathers = [[-0.5, '#2ec4b6', '#178f84'], [0.45, '#ff5c93', '#c42a64'], [-0.02, '#ffd84d', '#c99a1c']];
    for (const [a0, col, edge] of feathers) {
      const a = a0 + 0.12 * fl * (a0 >= 0 ? 1 : -1);
      ctx.save();
      ctx.rotate(a);
      const L = a0 === -0.02 ? 17 : 14;
      ctx.beginPath();
      ctx.moveTo(0, 1);
      ctx.quadraticCurveTo(-4.6, L * 0.45, -0.6, L);
      ctx.quadraticCurveTo(0, L + 1.2, 0.6, L);
      ctx.quadraticCurveTo(4.6, L * 0.45, 0, 1);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = edge; ctx.stroke();
      // shaft and barbs
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(0, L - 1);
      for (let k = 0.3; k < 0.95; k += 0.17) { ctx.moveTo(0, L * k); ctx.lineTo(-2.4, L * k + 2); ctx.moveTo(0, L * k); ctx.lineTo(2.4, L * k + 2); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fillStyle = '#7a66ff'; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#4b3bb0'; ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.8, -0.8, 0.8, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  }

  // ---------------------------------------------------------------- gifts the cat brings
  // Small floor items, ~20 units wide, origin = bottom centre (on the floor).
  const GIFTS = [
    ['mouse', 'Toy mouse', '🐭'], ['feather', 'Feather', '🪶'], ['leaf', 'Leaf', '🍂'],
    ['flower', 'Flower', '🌼'], ['sock', 'Sock', '🧦'], ['bottlecap', 'Bottle cap', '🧢'],
    ['ribbon', 'Ribbon', '🎀'], ['button', 'Button', '🔘'], ['paperball', 'Paper ball', '📄'],
  ];

  // carried: in the cat's mouth (no floor shadow; lifted so its top meets the mouth when
  // placed like a carried file — translate(mouth.x + 3, mouth.y + 15), scale 0.62)
  function drawGift(ctx, kind, T, carried) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (carried) ctx.translate(0, -14);
    else { ctx.beginPath(); ctx.ellipse(0, 0, 10, 2.2, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fill(); }
    switch (kind) {
      case 'mouse': {
        ctx.translate(8, -3.9); ctx.scale(0.55, 0.55);
        TOOLS.mouse(ctx, 0.3, 0, true);
        break;
      }
      case 'feather': {
        ctx.translate(0, -2.5); ctx.rotate(-1.35);
        ctx.beginPath(); ctx.moveTo(-1, -9); ctx.quadraticCurveTo(-5, 0, -0.5, 9); ctx.quadraticCurveTo(0, 10, 0.5, 9); ctx.quadraticCurveTo(5, 0, 1, -9); ctx.closePath();
        const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#8fd8ff'); g.addColorStop(1, '#7a66ff');
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = '#4b3bb0'; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 8);
        for (let y = -6; y < 7; y += 3) { ctx.moveTo(0, y); ctx.lineTo(-2.6, y + 2); ctx.moveTo(0, y); ctx.lineTo(2.6, y + 2); }
        ctx.stroke();
        break;
      }
      case 'leaf': {
        ctx.translate(0, -3); ctx.rotate(-0.25);
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-2, -9, 9, -1); ctx.quadraticCurveTo(-1, 7, -10, 0); ctx.closePath();
        const g = ctx.createLinearGradient(-10, 0, 9, 0); g.addColorStop(0, '#ffb02e'); g.addColorStop(1, '#e0582c');
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#9a3a14'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, 1); ctx.lineTo(7, -1);
        for (const x of [-5, -1, 3]) { ctx.moveTo(x, -0.4); ctx.lineTo(x + 3, -3.5); ctx.moveTo(x, -0.4); ctx.lineTo(x + 3, 2.6); }
        ctx.lineWidth = 0.7; ctx.stroke();
        break;
      }
      case 'flower': {
        ctx.strokeStyle = '#4f9f4f'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-10, -1.5); ctx.quadraticCurveTo(-3, -1, 3, -4); ctx.stroke();
        ctx.fillStyle = '#5cae4f';
        ctx.beginPath(); ctx.ellipse(-4, -3.5, 2.6, 1.2, -0.5, 0, TAU); ctx.fill();
        ctx.translate(5, -5.5);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#b8b0c8'; ctx.lineWidth = 0.6;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.ellipse(cos(a) * 3.4, sin(a) * 3.4, 2.6, 1.3, a, 0, TAU); ctx.fill(); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fillStyle = '#ffc93c'; ctx.fill(); ctx.strokeStyle = '#c99a1c'; ctx.stroke();
        break;
      }
      case 'sock': {
        ctx.translate(0, -1);
        const sock = () => {
          ctx.beginPath();
          ctx.moveTo(-9, -12); ctx.lineTo(-2, -12); ctx.lineTo(-2, -5); ctx.quadraticCurveTo(-1, -3, 4, -4);
          ctx.quadraticCurveTo(10, -4, 10, -1); ctx.quadraticCurveTo(10, 1, 4, 1); ctx.lineTo(-6, 1); ctx.quadraticCurveTo(-9, 1, -9, -3); ctx.closePath();
        };
        sock(); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#ff6b6b'; for (const y of [-11, -7.5]) ctx.fillRect(-10, y, 9, 2);
        ctx.fillStyle = '#5d7cf0'; ctx.beginPath(); ctx.arc(9, -1.5, 3.4, 0, TAU); ctx.fill(); ctx.fillRect(-10, -1.4, 6, 3);
        ctx.restore();
        sock(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#6d7088'; ctx.stroke();
        break;
      }
      case 'bottlecap': {
        ctx.translate(0, -3);
        ctx.beginPath(); ctx.ellipse(0, 0.5, 7.5, 3.2, 0, 0, PI); ctx.lineTo(-7.5, -2); ctx.ellipse(0, -2, 7.5, 3.2, 0, PI, 0, true); ctx.closePath();
        ctx.fillStyle = '#b81f2a'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); for (let x = -6.5; x <= 6.5; x += 1.6) { ctx.moveTo(x, -1.2 + abs(x) * 0.05); ctx.lineTo(x, 1.6 - abs(x) * 0.1); } ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -2, 7.5, 3.2, 0, 0, TAU);
        ctx.fillStyle = '#e8343f'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#7d1418'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -2, 4.4, 1.8, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
        break;
      }
      case 'ribbon': {
        ctx.translate(0, -5);
        ctx.fillStyle = '#ff4f86'; ctx.strokeStyle = '#a3204f'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-1, 1); ctx.lineTo(-5, 5); ctx.lineTo(-3, 5.5); ctx.lineTo(-1.5, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(6, 5); ctx.lineTo(4, 5.6); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (const sd of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sd * 9, -8, sd * 8, 1); ctx.quadraticCurveTo(sd * 5, 3, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 2.6, 0, 0, TAU); ctx.fillStyle = '#e0306f'; ctx.fill(); ctx.stroke();
        break;
      }
      case 'button': {
        ctx.translate(0, -3.2);
        ctx.beginPath(); ctx.ellipse(0, 0.9, 7, 3.4, 0, 0, TAU); ctx.fillStyle = '#2f5fb8'; ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.4, 0, 0, TAU); ctx.fillStyle = '#5d8cf0'; ctx.fill();
        ctx.lineWidth = 0.9; ctx.strokeStyle = '#1f3f80'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.3, 0, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
        ctx.fillStyle = '#1f3f80';
        for (const [x, y] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]]) { ctx.beginPath(); ctx.ellipse(x, y, 0.75, 0.4, 0, 0, TAU); ctx.fill(); }
        break;
      }
      case 'paperball': {
        ctx.translate(0, -6);
        const R = rng(7);
        ctx.beginPath();
        for (let i = 0; i < 11; i++) { const a = i * TAU / 11, rr = 5.4 + R() * 1.8; i ? ctx.lineTo(cos(a) * rr, sin(a) * rr) : ctx.moveTo(cos(a) * rr, sin(a) * rr); }
        ctx.closePath();
        ctx.fillStyle = '#fbfbfe'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#8f93aa'; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,124,150,0.55)'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(0, 0.5); ctx.lineTo(3.5, -3); ctx.moveTo(0, 0.5); ctx.lineTo(1, 4.5); ctx.moveTo(-3.5, 3); ctx.lineTo(0, 0.5); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,140,230,0.5)';
        ctx.beginPath(); ctx.moveTo(-5, 0.8); ctx.lineTo(-1.5, 2.4); ctx.moveTo(1.5, -4.4); ctx.lineTo(4.5, -1.6); ctx.stroke();
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  function drawIcon(ctx, name, T) {
    const fn = ICONS[name];
    if (!fn) return;
    ctx.save();
    fn(ctx, T || 0);
    ctx.restore();
  }

  // ---------------------------------------------------------------- bubble
  // Thought bubble. (x,y) = anchor just above the cat's head (screen-upright).
  function drawBubble(ctx, x, y, icon, age, T, urgent, side) {
    side = side || 1;
    const pop = age < 0.28 ? easeOutBack(age / 0.28) : 1;
    const fade = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha *= fade;
    // trailing dots
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = urgent ? '#ff5a6a' : '#9a9cb3';
    ctx.lineWidth = 1.2;
    const dots = [[side * 3, -2, 2.1], [side * 8, -9, 3.1]];
    for (const [dx, dy, r] of dots) {
      ctx.beginPath(); ctx.arc(dx * pop, dy * pop, r * pop, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.translate(side * 20, -30);
    let sc = pop;
    if (urgent) sc *= 1 + 0.06 * sin(T * 9);
    ctx.scale(sc, sc);
    if (urgent) ctx.rotate(0.05 * sin(T * 13));
    // cloud
    const blobs = [[-9, 2, 9], [0, -4, 11], [10, 1, 9], [3, 6, 9], [-4, 6, 8]];
    ctx.beginPath();
    for (const [bx, by, r] of blobs) { ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU); }
    ctx.lineWidth = urgent ? 3.2 : 2.4;
    ctx.strokeStyle = urgent ? '#ff5a6a' : '#9a9cb3';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // soft inner shading
    ctx.beginPath(); ctx.ellipse(0, 7, 15, 4, 0, 0, TAU); ctx.fillStyle = 'rgba(160,165,200,0.12)'; ctx.fill();
    ctx.translate(0.5, 1.5);
    drawIcon(ctx, icon, T);
    ctx.restore();
  }

  function easeOutBack(k) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }

  // Speech-style label (used for little floating texts such as "+1").
  function drawLabel(ctx, text, x, y, color) {
    ctx.save();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color || '#4a4d68';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Mini status bars shown when hovering the cat.
  function drawStatus(ctx, x, y, stats, name, mood, alpha) {
    const rows = [
      ['food', '#ff9f43'], ['energy', '#5d7cf0'], ['fun', '#ff5fa2'], ['clean', '#2ec4b6'], ['health', '#4cd964'],
    ];
    const w = 78, h = 12 + rows.length * 8 + 16;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x - w / 2, y - h);
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.beginPath(); rrect(ctx, 0, 0, w, h, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3b3e56';
    ctx.fillText(name, 7, 9);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillStyle = '#7a7d98';
    ctx.textAlign = 'right';
    ctx.fillText(mood, w - 7, 9);
    rows.forEach(([k, col], i) => {
      const by = 19 + i * 8;
      ctx.fillStyle = 'rgba(60,64,90,0.1)';
      ctx.beginPath(); rrect(ctx, 7, by, w - 14, 4.5, 2.25); ctx.fill();
      const v = clamp((stats[k] || 0) / 100, 0, 1);
      ctx.fillStyle = v < 0.2 ? '#ff4d5e' : col;
      if (v > 0.01) { ctx.beginPath(); rrect(ctx, 7, by, (w - 14) * v, 4.5, 2.25); ctx.fill(); }
    });
    ctx.restore();
  }

  // ---------------------------------------------------------------- props
  const BOWL_COLORS = { fish: '#5b8def', kibble: '#ff8a5c', milk: '#9b7bf0', chicken: '#3fbf8f', water: '#4bb3e6' };

  const PROPS = {
    shadow(ctx, rx, ry, a) {
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
      ctx.fillStyle = `rgba(0,0,0,${a == null ? 0.16 : a})`; ctx.fill();
    },

    bowl(ctx, kind, amount, T) {
      const col = BOWL_COLORS[kind] || '#5b8def';
      PROPS.shadow(ctx, 22, 4.5);
      // body
      ctx.beginPath();
      ctx.moveTo(-19, -12);
      ctx.quadraticCurveTo(-17, 0, -11, 0);
      ctx.lineTo(11, 0);
      ctx.quadraticCurveTo(17, 0, 19, -12);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -12, 0, 0);
      g.addColorStop(0, col); g.addColorStop(1, shadeHex(col, -0.25));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = shadeHex(col, -0.45); ctx.stroke();
      // paw print decal
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(0, -5, 2.6, 2, 0, 0, TAU); ctx.fill();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 2.4, -8.4 + abs(i) * 0.6, 1, 0, TAU); ctx.fill(); }
      // rim
      ctx.beginPath(); ctx.ellipse(0, -12, 19, 5, 0, 0, TAU);
      ctx.fillStyle = shadeHex(col, 0.35); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -12, 15.5, 3.5, 0, 0, TAU);
      ctx.fillStyle = shadeHex(col, -0.35); ctx.fill();
      // contents
      const a = clamp(amount, 0, 1);
      if (a <= 0.01) return;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(0, -12, 15.5, 3.5, 0, 0, TAU); ctx.clip();
      if (kind === 'milk' || kind === 'water') {
        ctx.beginPath(); ctx.ellipse(0, -12 + (1 - a) * 2, 15 * (0.6 + 0.4 * a), 3.2 * (0.6 + 0.4 * a), 0, 0, TAU);
        ctx.fillStyle = kind === 'milk' ? '#fffdf6' : '#9fd8ff'; ctx.fill();
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(-5, -12.5, 3, 0.8, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
        return;
      }
      ctx.restore();
      if (kind === 'kibble') {
        const r = rng(7);
        const n = Math.round(4 + 12 * a);
        for (let i = 0; i < n; i++) {
          const px = (r() - 0.5) * 24 * (0.5 + 0.5 * a), py = -13 - r() * 4 * a;
          ctx.beginPath(); ctx.ellipse(px, py, 2.4, 1.8, r() * 3, 0, TAU);
          ctx.fillStyle = i % 3 ? '#a8692f' : '#c98642'; ctx.fill();
          ctx.lineWidth = 0.6; ctx.strokeStyle = '#6e3f18'; ctx.stroke();
        }
      } else if (kind === 'fish') {
        ctx.save();
        ctx.translate(0, -15);
        const s = 0.6 + 0.5 * a;
        ctx.scale(s, s);
        ctx.rotate(-0.2);
        ICONS.fish(ctx, 0);
        ctx.restore();
      } else if (kind === 'chicken') {
        ctx.save();
        ctx.translate(0, -15);
        const s = 0.6 + 0.4 * a;
        ctx.scale(s, s);
        ctx.rotate(-0.4);
        ctx.beginPath(); ctx.ellipse(-2, 0, 8, 5.5, 0, 0, TAU);
        ctx.fillStyle = '#d98a3a'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#8a4e14'; ctx.stroke();
        ctx.fillStyle = '#fff4e0';
        ctx.fillRect(5, -1.5, 6, 3);
        ctx.beginPath(); ctx.arc(11.5, -1.8, 1.8, 0, TAU); ctx.arc(11.5, 1.8, 1.8, 0, TAU); ctx.fill();
        ctx.restore();
      }
    },

    poop(ctx, e, T, iconMode) {
      const r = rng(e.seed || 1);
      if (!iconMode) PROPS.shadow(ctx, 15, 3.5, 0.18);
      const tiers = [[0, -5, 13, 5.5], [0.5, -11, 10, 4.8], [-0.5, -16, 6.8, 4], [1, -20, 3.2, 3]];
      const g = ctx.createLinearGradient(0, -24, 0, 0);
      g.addColorStop(0, '#a8743f'); g.addColorStop(1, '#6b4220');
      ctx.lineWidth = 1.4; ctx.strokeStyle = '#4a2c12';
      for (const [dx, dy, rx, ry] of tiers) {
        ctx.beginPath(); ctx.ellipse(dx + (r() - 0.5), dy, rx, ry, 0, 0, TAU);
        ctx.fillStyle = g; ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(1, -23); ctx.quadraticCurveTo(4, -26, 2, -27.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,200,0.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(-4, -7, 4, PI * 1.1, PI * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(-3, -12.5, 3, PI * 1.1, PI * 1.5); ctx.stroke();
      if (iconMode) return;
      // stink lines
      const age = e.age || 0;
      ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const ph = (T * 0.6 + i / 3) % 1;
        const x0 = -8 + i * 8;
        ctx.strokeStyle = `rgba(120,190,90,${0.7 * sin(ph * PI)})`;
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const yy = -26 - k * 1.6 - ph * 12;
          const xx = x0 + sin(k * 0.9 + T * 4 + i) * 2.2;
          if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      // flies when it has been left too long
      if (age > 90) {
        const n = age > 300 ? 3 : age > 180 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const a = T * (3 + i) + i * 2.1;
          const fx = cos(a) * (14 + i * 3), fy = -22 + sin(a * 1.3) * 7;
          ctx.fillStyle = 'rgba(200,220,255,0.8)';
          const flap = abs(sin(T * 60 + i)) * 2.2;
          ctx.beginPath(); ctx.ellipse(fx - 1.2, fy - 1.5, 1.6, flap + 0.3, -0.5, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(fx + 1.2, fy - 1.5, 1.6, flap + 0.3, 0.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#202028';
          ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, TAU); ctx.fill();
        }
      }
    },

    bed(ctx, T) {
      PROPS.shadow(ctx, 38, 7, 0.14);
      // rim (back)
      ctx.beginPath(); ctx.ellipse(0, -8, 36, 13, 0, 0, TAU);
      const g = ctx.createLinearGradient(0, -21, 0, 5);
      g.addColorStop(0, '#9fb4ff'); g.addColorStop(1, '#6d86e8');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.4; ctx.strokeStyle = '#4c63c4'; ctx.stroke();
      // cushion
      ctx.beginPath(); ctx.ellipse(0, -7, 28, 8.5, 0, 0, TAU);
      const c = ctx.createRadialGradient(-6, -10, 2, 0, -7, 30);
      c.addColorStop(0, '#fffaf0'); c.addColorStop(1, '#f1dfc2');
      ctx.fillStyle = c; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = '#d6bf9a'; ctx.stroke();
      // stitching
      ctx.setLineDash([2, 2.5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.ellipse(0, -8, 32.5, 10.5, 0, PI * 0.05, PI * 0.95); ctx.stroke();
      ctx.setLineDash([]);
      // tiny paw pattern on the rim
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (const [px, py] of [[-24, -2], [0, 3], [24, -2]]) {
        ctx.beginPath(); ctx.ellipse(px, py, 1.8, 1.4, 0, 0, TAU); ctx.fill();
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(px + i * 1.7, py - 2.3, 0.7, 0, TAU); ctx.fill(); }
      }
    },

    boxBack(ctx) {
      PROPS.shadow(ctx, 34, 6, 0.16);
      // back flap
      ctx.beginPath();
      ctx.moveTo(-22, -34); ctx.lineTo(-18, -46); ctx.lineTo(22, -46); ctx.lineTo(26, -34); ctx.closePath();
      ctx.fillStyle = '#c8955a'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#8a5f2e'; ctx.stroke();
      // interior
      ctx.beginPath();
      ctx.moveTo(-28, -30); ctx.lineTo(-22, -34); ctx.lineTo(26, -34); ctx.lineTo(28, -30); ctx.closePath();
      ctx.fillStyle = '#6e4a24'; ctx.fill(); ctx.stroke();
    },
    boxFront(ctx) {
      ctx.beginPath(); ctx.rect(-28, -30, 56, 30);
      const g = ctx.createLinearGradient(0, -30, 0, 0);
      g.addColorStop(0, '#e0ad6c'); g.addColorStop(1, '#c48f50');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.3; ctx.strokeStyle = '#8a5f2e'; ctx.stroke();
      // tape + side flaps
      ctx.fillStyle = 'rgba(255,240,200,0.55)';
      ctx.fillRect(-4, -30, 8, 30);
      ctx.beginPath(); ctx.moveTo(-28, -30); ctx.lineTo(-38, -40); ctx.lineTo(-34, -42); ctx.lineTo(-22, -34); ctx.closePath();
      ctx.fillStyle = '#d6a062'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28, -30); ctx.lineTo(38, -41); ctx.lineTo(34, -43); ctx.lineTo(26, -34); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // "fragile" style mark
      ctx.strokeStyle = 'rgba(120,70,30,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-12, -12); ctx.moveTo(-20, -8); ctx.lineTo(-14, -8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -18); ctx.lineTo(18, -10); ctx.lineTo(22, -18); ctx.stroke();
    },
    box(ctx) { PROPS.boxBack(ctx); PROPS.boxFront(ctx); },

    post(ctx, T, wear) {
      PROPS.shadow(ctx, 24, 5, 0.16);
      ctx.beginPath(); ctx.ellipse(0, -3, 22, 6.5, 0, 0, TAU);
      ctx.fillStyle = '#b892f0'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#7a56b8'; ctx.stroke();
      ctx.beginPath(); ctx.rect(-7, -66, 14, 63);
      const g = ctx.createLinearGradient(-7, 0, 7, 0);
      g.addColorStop(0, '#c9a36a'); g.addColorStop(0.5, '#e8cc95'); g.addColorStop(1, '#b88f55');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#8a6a3a'; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,90,45,0.55)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let y = -64; y < -4; y += 3) { ctx.moveTo(-7, y + 1.5); ctx.lineTo(7, y); }
      ctx.stroke();
      if (wear > 0) {
        const r = rng(11);
        ctx.strokeStyle = 'rgba(255,245,220,0.8)';
        ctx.beginPath();
        for (let i = 0; i < 6 * wear; i++) { const y = -50 + r() * 30; const x = -6 + r() * 12; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y + 3); }
        ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0, -67, 18, 6, 0, 0, TAU);
      ctx.fillStyle = '#c9a8ff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#7a56b8'; ctx.stroke();
      // dangling pom-pom
      const sw = 0.35 * sin(T * 2.2);
      const px = 14 + sin(sw) * 16, py = -67 + cos(sw) * 16;
      ctx.strokeStyle = '#7a56b8'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(14, -67); ctx.lineTo(px, py); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py + 3, 3.5, 0, TAU); ctx.fillStyle = '#ff7ab0'; ctx.fill();
    },

    yarnBall(ctx, rot, r) {
      r = r || 9;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
      g.addColorStop(0, '#ff9cc2'); g.addColorStop(1, '#e24f8a');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#b02d66'; ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.rotate(rot || 0);
      ctx.strokeStyle = 'rgba(160,30,90,0.55)'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.ellipse(i * r * 0.32, 0, r * 0.35, r * 1.1, 0.4, 0, TAU); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.35, -0.3, 0, TAU); ctx.stroke();
      ctx.restore();
    },

    yarn(ctx, e, T) {
      // e.trail: recent positions relative to the ball (for the loose thread)
      PROPS.shadow(ctx, 9, 2.4, 0.16);
      if (e.trail && e.trail.length > 1) {
        ctx.strokeStyle = '#e24f8a'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -4);
        for (const p of e.trail) ctx.lineTo(p.x, p.y - 1);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(0, -9 - (e.z || 0));
      PROPS.yarnBall(ctx, e.rot || 0, 9);
      ctx.restore();
    },

    catnip(ctx, T, life) {
      const r = rng(5);
      for (let i = 0; i < 9; i++) {
        const x = (r() - 0.5) * 26, y = -r() * 6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6);
        ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, 0, 0, TAU);
        ctx.fillStyle = i % 2 ? '#5fbf5f' : '#84d46a'; ctx.fill();
        ctx.strokeStyle = '#3f8f3f'; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.restore();
      }
      for (let i = 0; i < 3; i++) {
        const ph = (T * 0.8 + i / 3) % 1;
        ctx.globalAlpha = sin(ph * PI);
        ctx.beginPath(); star(ctx, -10 + i * 10, -8 - ph * 18, 2.5, 4, 0.4);
        ctx.fillStyle = '#b6ff8a'; ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    file(ctx, e, T) {
      const kind = e.kind || 'doc';
      ctx.save();
      ctx.rotate(e.rot || 0);
      PROPS.shadow(ctx, 14, 3, 0.15);
      ctx.translate(0, -2);
      if (kind === 'folder') {
        ctx.beginPath();
        ctx.moveTo(-15, -26); ctx.lineTo(-5, -26); ctx.lineTo(-2, -22); ctx.lineTo(15, -22); ctx.lineTo(15, 0); ctx.lineTo(-15, 0); ctx.closePath();
        ctx.fillStyle = '#ffc94d'; ctx.fill();
        ctx.lineWidth = 1.1; ctx.strokeStyle = '#c9931c'; ctx.stroke();
        ctx.beginPath(); rrect(ctx, -15, -18, 30, 18, 2); ctx.fillStyle = '#ffd86e'; ctx.fill(); ctx.stroke();
      } else {
        const band = { pdf: '#e5484d', doc: '#3e7bfa', xls: '#21a366', ppt: '#f0782f', txt: '#8a8fa8', img: '#9b5de5', zip: '#e3b505', code: '#2d3142', app: '#5b6ee1' }[kind] || '#8a8fa8';
        ctx.beginPath();
        ctx.moveTo(-12, -32); ctx.lineTo(5, -32); ctx.lineTo(12, -25); ctx.lineTo(12, 0); ctx.lineTo(-12, 0); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = 1.1; ctx.strokeStyle = '#a7abc0'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5, -32); ctx.lineTo(5, -25); ctx.lineTo(12, -25); ctx.fillStyle = '#e4e6f0'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(120,125,150,0.35)';
        for (let i = 0; i < 4; i++) ctx.fillRect(-8, -26 + i * 4, i === 3 ? 9 : 14, 1.6);
        ctx.beginPath(); rrect(ctx, -12, -8, 24, 8, 1.5); ctx.fillStyle = band; ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 6px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((e.ext || kind).toUpperCase().slice(0, 4), 0, -3.8);
        if (e.torn) {
          ctx.strokeStyle = '#a7abc0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(-12, -14); ctx.lineTo(-8, -16); ctx.lineTo(-5, -13); ctx.lineTo(-1, -16); ctx.stroke();
        }
      }
      ctx.restore();
      if (e.name) {
        let name = e.name;
        if (name.length > 18) name = name.slice(0, 15) + '…';
        ctx.save();
        ctx.font = '600 8.5px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const w = ctx.measureText(name).width + 8;
        ctx.beginPath(); rrect(ctx, -w / 2, 3, w, 11, 3);
        ctx.fillStyle = 'rgba(30,34,52,0.72)'; ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, 0, 4.5);
        ctx.restore();
      }
    },

    tombstone(ctx, e, T) {
      PROPS.shadow(ctx, 30, 5, 0.18);
      // grass
      ctx.fillStyle = '#6cc070';
      for (let i = -5; i <= 5; i++) {
        ctx.beginPath(); ctx.moveTo(i * 5 - 2, 0); ctx.lineTo(i * 5 + sin(T * 1.5 + i) * 0.8, -6 - (i % 2 ? 2 : 0)); ctx.lineTo(i * 5 + 2, 0); ctx.fill();
      }
      // stone with cat ears
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-20, -34);
      ctx.lineTo(-17, -50); ctx.lineTo(-9, -42);
      ctx.quadraticCurveTo(0, -46, 9, -42);
      ctx.lineTo(17, -50); ctx.lineTo(20, -34);
      ctx.lineTo(20, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(-20, -50, 20, 0);
      g.addColorStop(0, '#d8dae4'); g.addColorStop(1, '#9ea2b4');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#6e7286'; ctx.stroke();
      ctx.fillStyle = 'rgba(80,84,104,0.8)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px Georgia, serif';
      ctx.fillText('R.I.P', 0, -31);
      ctx.font = '600 7px system-ui, sans-serif';
      let n = e.name || 'Kitty';
      if (n.length > 10) n = n.slice(0, 9) + '…';
      ctx.fillText(n, 0, -20);
      ctx.font = '5.5px system-ui, sans-serif';
      ctx.fillText(e.subtitle || '', 0, -12.5, 36);
      // little paw engraving
      ctx.fillStyle = 'rgba(80,84,104,0.45)';
      ctx.beginPath(); ctx.ellipse(0, -5, 2.4, 1.8, 0, 0, TAU); ctx.fill();
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 2.2, -8.2, 0.9, 0, TAU); ctx.fill(); }
      // flowers
      const fl = e.flowers || 0;
      const r = rng(9);
      for (let i = 0; i < min(fl, 7); i++) {
        const fx = -24 + r() * 48, fy = -1 - r() * 3;
        const col = ['#ff7ab0', '#ffd84d', '#ffffff', '#b892f0', '#ff9f43'][i % 5];
        ctx.strokeStyle = '#4f9f4f'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 6); ctx.stroke();
        for (let k = 0; k < 5; k++) {
          const a = k * TAU / 5 + T * 0.2;
          ctx.beginPath(); ctx.arc(fx + cos(a) * 2, fy - 7 + sin(a) * 2, 1.6, 0, TAU); ctx.fillStyle = col; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(fx, fy - 7, 1.1, 0, TAU); ctx.fillStyle = '#ffb02e'; ctx.fill();
      }
    },

    // Claw marks on the "glass". e: { seed, progress (0..1), size, angle, fade }
    scratch(ctx, e, T, highlight) {
      const r = rng(e.seed || 1);
      const n = 3 + (r() > 0.6 ? 1 : 0);
      const L = (e.size || 1) * 34;
      const prog = clamp(e.progress == null ? 1 : e.progress, 0, 1);
      ctx.save();
      ctx.rotate(e.angle || 0);
      ctx.globalAlpha *= clamp(e.fade == null ? 1 : e.fade, 0, 1);
      if (highlight) {
        ctx.beginPath(); ctx.ellipse(0, 0, 26 * (e.size || 1), L * 0.7, 0, 0, TAU);
        ctx.fillStyle = 'rgba(120,200,255,0.18)'; ctx.fill();
        ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(70,150,230,0.8)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        const x0 = (i - (n - 1) / 2) * 7.5 + (r() - 0.5) * 2;
        const pts = [];
        const segs = 8;
        const len = L * (0.75 + r() * 0.35);
        const curve = (r() - 0.5) * 6;
        for (let k = 0; k <= segs; k++) {
          const f = k / segs;
          pts.push({ x: x0 + curve * f * f + (r() - 0.5) * 1.6, y: -len / 2 + len * f });
        }
        const upto = Math.max(1, Math.round(segs * prog));
        const trace = () => {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k <= upto; k++) ctx.lineTo(pts[k].x, pts[k].y);
        };
        trace(); ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(20,22,34,0.42)'; ctx.stroke();
        trace(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(70,74,96,0.7)'; ctx.stroke();
        ctx.save(); ctx.translate(-0.9, -0.6);
        trace(); ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.stroke();
        ctx.restore();
        // glass chips along the mark
        for (let k = 1; k < upto; k += 2) {
          const p = pts[k];
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath(); ctx.moveTo(p.x + 1.5, p.y); ctx.lineTo(p.x + 3.2, p.y + 1.2); ctx.lineTo(p.x + 1.4, p.y + 2.2); ctx.fill();
        }
      }
      ctx.restore();
    },

    // The lure alone, as held in the cat's mouth: the string's end at (0,-24),
    // the bead at (0,-14), feathers hanging down to the origin.
    featherLure(ctx, T) {
      ctx.save();
      ctx.strokeStyle = 'rgba(90,90,110,0.85)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.quadraticCurveTo(1.5, -19, 0, -14); ctx.stroke();
      ctx.translate(0, -14);
      lureBody(ctx, T);
      ctx.restore();
    },

    gift(ctx, kind, T, carried) { drawGift(ctx, kind, T, carried); },

    flowerBunch(ctx) {
      for (let i = 0; i < 3; i++) {
        const fx = (i - 1) * 4;
        ctx.strokeStyle = '#4f9f4f'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fx, -8); ctx.stroke();
        ctx.beginPath(); ctx.arc(fx, -9, 2.4, 0, TAU); ctx.fillStyle = ['#ff7ab0', '#ffd84d', '#b892f0'][i]; ctx.fill();
      }
    },
  };

  // ---------------------------------------------------------------- tools
  // Each tool is drawn with its "hot spot" at 0,0 (where the cursor tip is).
  const TOOLS = {
    scoop(ctx, T) {
      ctx.save();
      ctx.rotate(-0.5);
      // handle
      ctx.beginPath(); rrect(ctx, -3, 16, 6, 24, 3);
      ctx.fillStyle = '#2ec4b6'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#1a8a80'; ctx.stroke();
      // blade
      ctx.beginPath();
      ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.lineTo(10, 17); ctx.lineTo(-10, 17); ctx.closePath();
      ctx.fillStyle = '#49e0d0'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(10,90,85,0.5)';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); rrect(ctx, i * 4 - 1, 2, 2, 11, 1); ctx.fill(); }
      ctx.restore();
    },
    repair(ctx, T) {
      // spray bottle of "screen polish" — nozzle at hot spot
      ctx.save();
      ctx.translate(6, 4);
      ctx.beginPath(); rrect(ctx, 0, 8, 16, 22, 4);
      const g = ctx.createLinearGradient(0, 8, 16, 8);
      g.addColorStop(0, '#7ec8ff'); g.addColorStop(1, '#4f9df0');
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#2f6fb8'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); star(ctx, 8, 19, 4, 4, 0.35); ctx.fill();
      ctx.beginPath(); rrect(ctx, 3, 1, 10, 8, 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, 3); ctx.lineTo(-5, 1); ctx.lineTo(-5, -1); ctx.lineTo(4, 1); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 9); ctx.quadraticCurveTo(18, 14, 15, 20); ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.restore();
      // mist
      for (let i = 0; i < 4; i++) {
        const ph = (T * 2 + i / 4) % 1;
        ctx.globalAlpha = (1 - ph) * 0.7;
        ctx.beginPath(); ctx.arc(-ph * 10, -ph * 6 + (i - 1.5) * 2, 1.2 + ph * 2, 0, TAU);
        ctx.fillStyle = '#bfe4ff'; ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    brush(ctx, T, icon) {
      ctx.save();
      if (!icon) ctx.rotate(0.35);
      ctx.beginPath(); rrect(ctx, -13, -2, 26, 10, 4);
      ctx.fillStyle = '#c98a4b'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#80501f'; ctx.stroke();
      ctx.beginPath(); rrect(ctx, 11, 0, 22, 6, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -11; i <= 11; i += 2.5) { ctx.moveTo(i, -2); ctx.lineTo(i + sin(T * 10 + i) * 0.4, -7); }
      ctx.stroke();
      ctx.restore();
    },
    mouse(ctx, T, dir, icon) {
      // toy mouse, nose at hot spot, facing `dir` (radians)
      ctx.save();
      ctx.rotate(dir || 0);
      const wig = sin(T * 18) * 0.15;
      // tail
      ctx.strokeStyle = '#ff9cb6'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-20, 0);
      ctx.bezierCurveTo(-28, -5 + wig * 20, -32, 6 - wig * 20, -40, 2);
      ctx.stroke();
      // body
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-6, -8, -14, -7);
      ctx.quadraticCurveTo(-22, -5, -21, 0);
      ctx.quadraticCurveTo(-22, 5, -14, 6);
      ctx.quadraticCurveTo(-6, 7, 0, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -8, 0, 7);
      g.addColorStop(0, '#b8bccb'); g.addColorStop(1, '#8a8ea3');
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1.1; ctx.strokeStyle = '#5c6076'; ctx.stroke();
      // ear
      ctx.beginPath(); ctx.ellipse(-8, -6, 4, 3.4, -0.4, 0, TAU);
      ctx.fillStyle = '#ffb3c6'; ctx.fill(); ctx.stroke();
      // eye + nose
      ctx.beginPath(); ctx.arc(-4, -2, 1.2, 0, TAU); ctx.fillStyle = '#20202a'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, TAU); ctx.fillStyle = '#ff7a9c'; ctx.fill();
      // whiskers
      ctx.strokeStyle = 'rgba(80,80,100,0.6)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(4, -3); ctx.moveTo(-1, 0); ctx.lineTo(4, 2.5); ctx.stroke();
      ctx.restore();
    },
    laser(ctx, T) {
      const f = 1 + 0.12 * sin(T * 40);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * f);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.15, 'rgba(255,40,40,1)');
      g.addColorStop(0.4, 'rgba(255,0,0,0.35)');
      g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 16 * f, 0, TAU); ctx.fill();
    },
    treat(ctx, T) {
      ctx.save();
      ctx.translate(10, 10);
      ctx.rotate(-0.5 + 0.1 * sin(T * 3));
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.quadraticCurveTo(0, -6, 6, -1); ctx.lineTo(10, -4); ctx.lineTo(9, 0); ctx.lineTo(10, 4); ctx.lineTo(6, 1);
      ctx.quadraticCurveTo(0, 6, -8, 0); ctx.closePath();
      ctx.fillStyle = '#d9893c'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#8a4e14'; ctx.stroke();
      ctx.beginPath(); ctx.arc(-4, -1, 1, 0, TAU); ctx.fillStyle = '#4a2a10'; ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.6 + 0.4 * sin(T * 5);
      ctx.beginPath(); star(ctx, 22, 2, 3, 4, 0.4); ctx.fillStyle = '#ffd84d'; ctx.fill();
      ctx.globalAlpha = 1;
    },
    feather(ctx, T) {
      // the feather wand: lure at the hot spot, string up to the stick's tip, stick off to the upper right
      const sway = 2.2 * sin(T * 2.3);
      const tip = { x: 34 + sway, y: -44 };
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(80,80,100,0.85)'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(14 + sway * 2, -14, tip.x, tip.y); ctx.stroke();
      ctx.lineWidth = 3.4; ctx.strokeStyle = '#8a5a2e';
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + 26, tip.y - 14); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = '#c98a4b';
      ctx.beginPath(); ctx.moveTo(tip.x + 1, tip.y - 1); ctx.lineTo(tip.x + 26, tip.y - 14.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 1.8, 0, TAU); ctx.fillStyle = '#5a3a1e'; ctx.fill();
      lureBody(ctx, T);
      ctx.restore();
    },
    hand(ctx, T) {
      // petting hand hint (paw-shaped)
      ctx.beginPath(); ctx.ellipse(0, 4, 7, 6, 0, 0, TAU);
      ctx.fillStyle = '#ffe0d0'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#c98f7a'; ctx.stroke();
      for (let i = -1.5; i <= 1.5; i++) { ctx.beginPath(); ctx.ellipse(i * 3.6, -4 + abs(i) * 1.2, 2.2, 2.8, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
    },
  };

  // ---------------------------------------------------------------- particles
  const PARTICLES = {
    heart(ctx, p) {
      ctx.beginPath(); heart(ctx, 0, 0, 4.5 * p.size);
      ctx.fillStyle = '#ff5c93'; ctx.fill();
    },
    zzz(ctx, p) {
      ctx.fillStyle = '#6d86f0';
      ctx.font = `bold ${Math.round(9 + 6 * p.k)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText('z', 0, 0);
      ctx.fillText('z', 0, 0);
    },
    sparkle(ctx, p) {
      ctx.beginPath(); star(ctx, 0, 0, 4.5 * p.size, 4, 0.32);
      ctx.fillStyle = p.color || '#ffe066'; ctx.fill();
      ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    },
    fur(ctx, p) {
      ctx.beginPath(); ctx.ellipse(0, 0, 2.6 * p.size, 1.4 * p.size, p.rot, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(140,140,160,0.6)'; ctx.stroke();
    },
    dust(ctx, p) {
      ctx.beginPath(); ctx.arc(0, 0, 3 + 6 * p.k * p.size, 0, TAU);
      ctx.fillStyle = 'rgba(200,200,210,0.55)'; ctx.fill();
    },
    note(ctx, p) { ctx.scale(0.6 * p.size, 0.6 * p.size); ICONS.note(ctx, p.age); },
    crumb(ctx, p) {
      ctx.beginPath(); ctx.arc(0, 0, 1.4 * p.size, 0, TAU); ctx.fillStyle = p.color || '#a8692f'; ctx.fill();
    },
    text(ctx, p) { drawLabel(ctx, p.text, 0, 0, p.color); },
    star(ctx, p) {
      ctx.beginPath(); star(ctx, 0, 0, 3.6 * p.size, 5, 0.45);
      ctx.fillStyle = '#ffd84d'; ctx.fill(); ctx.lineWidth = 0.6; ctx.strokeStyle = '#c99a1c'; ctx.stroke();
    },
    paper(ctx, p) {
      ctx.rotate(p.rot);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-2.5, -2, 5, 4);
      ctx.strokeStyle = '#b0b3c6'; ctx.lineWidth = 0.5; ctx.strokeRect(-2.5, -2, 5, 4);
    },
    poof(ctx, p) {
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + p.rot;
        ctx.beginPath(); ctx.arc(cos(a) * 8 * p.k * p.size, sin(a) * 5 * p.k * p.size, (3 + 5 * p.k) * p.size, 0, TAU);
        ctx.fillStyle = 'rgba(235,236,245,0.8)'; ctx.fill();
      }
    },
    confetti(ctx, p) {
      // tumbling paper bits for level-ups (color from p.color, else picked from the spin)
      const cols = ['#ff5c93', '#ffd84d', '#2ec4b6', '#7a66ff', '#ff8a3d', '#5d8cf0'];
      const col = p.color || cols[Math.floor(abs(p.rot) * 997) % cols.length];
      ctx.rotate(p.rot + p.k * 7);
      ctx.scale(p.size, p.size * (0.25 + 0.75 * abs(cos(p.k * 18 + p.rot))));
      ctx.fillStyle = col;
      ctx.fillRect(-2.4, -1.4, 4.8, 2.8);
    },
    drop(ctx, p) {
      ctx.beginPath(); ctx.arc(0, 0, 1.5 * p.size, 0, TAU); ctx.fillStyle = p.color || '#ffffff'; ctx.fill();
      ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(150,160,190,0.7)'; ctx.stroke();
    },
  };

  function shadeHex(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  // Gallery entries (dev/gallery.html)
  const GALLERY = [
    { name: 'bubble fish', draw: (c, T) => drawBubble(c, -14, 10, 'fish', 1, T, false) },
    { name: 'bubble urgent', draw: (c, T) => drawBubble(c, -14, 10, 'fish', 1, T, true) },
    { name: 'bubble zzz', draw: (c, T) => drawBubble(c, -14, 10, 'zzz', 1, T, false) },
    { name: 'bubble bed', draw: (c, T) => drawBubble(c, -14, 10, 'bed', 1, T, false) },
    { name: 'bubble poop', draw: (c, T) => drawBubble(c, -14, 10, 'poop', 1, T, false) },
    { name: 'bubble heart', draw: (c, T) => drawBubble(c, -14, 10, 'heart', 1, T, false) },
    { name: 'bubble yarn', draw: (c, T) => drawBubble(c, -14, 10, 'yarn', 1, T, false) },
    { name: 'bubble mouse', draw: (c, T) => drawBubble(c, -14, 10, 'mouse', 1, T, false) },
    { name: 'bubble note', draw: (c, T) => drawBubble(c, -14, 10, 'note', 1, T, false) },
    { name: 'bubble sick', draw: (c, T) => drawBubble(c, -14, 10, 'sick', 1, T, true) },
    { name: 'bubble angry', draw: (c, T) => drawBubble(c, -14, 10, 'angry', 1, T, false) },
    { name: 'bubble ?', draw: (c, T) => drawBubble(c, -14, 10, 'question', 1, T, false) },
    { name: 'bubble !', draw: (c, T) => drawBubble(c, -14, 10, 'bang', 1, T, false) },
    { name: 'bubble milk', draw: (c, T) => drawBubble(c, -14, 10, 'milk', 1, T, false) },
    { name: 'bowl fish', draw: (c, T) => PROPS.bowl(c, 'fish', 1, T) },
    { name: 'bowl kibble', draw: (c, T) => PROPS.bowl(c, 'kibble', 1, T) },
    { name: 'bowl milk', draw: (c, T) => PROPS.bowl(c, 'milk', 0.8, T) },
    { name: 'bowl chicken', draw: (c, T) => PROPS.bowl(c, 'chicken', 1, T) },
    { name: 'poop', draw: (c, T) => PROPS.poop(c, { seed: 4, age: 0 }, T) },
    { name: 'poop old', draw: (c, T) => PROPS.poop(c, { seed: 8, age: 400 }, T) },
    { name: 'bed', draw: (c, T) => PROPS.bed(c, T) },
    { name: 'box', draw: (c, T) => PROPS.box(c, T) },
    { name: 'post', draw: (c, T) => PROPS.post(c, T, 1) },
    { name: 'yarn', draw: (c, T) => PROPS.yarn(c, { rot: T, trail: [{ x: -10, y: 2 }, { x: -20, y: -1 }, { x: -30, y: 3 }] }, T) },
    { name: 'catnip', draw: (c, T) => PROPS.catnip(c, T) },
    { name: 'file pdf', draw: (c, T) => PROPS.file(c, { kind: 'pdf', ext: 'pdf', name: 'taxes_2026.pdf', rot: 0.2 }, T) },
    { name: 'folder', draw: (c, T) => PROPS.file(c, { kind: 'folder', name: 'Very Important' }, T) },
    { name: 'tombstone', draw: (c, T) => PROPS.tombstone(c, { name: 'Mochi', subtitle: '3 days of love', flowers: 4 }, T) },
    { name: 'scratch', draw: (c, T) => { c.fillStyle = '#e8eaf2'; c.fillRect(-60, -70, 120, 90); PROPS.scratch(c, { seed: 3, progress: (T % 2) / 2 + 0.2 }, T); } },
    { name: 'scratch dark', draw: (c, T) => { c.fillStyle = '#1f2230'; c.fillRect(-60, -70, 120, 90); PROPS.scratch(c, { seed: 5, progress: 1 }, T, true); } },
    { name: 'tool scoop', draw: (c, T) => TOOLS.scoop(c, T) },
    { name: 'tool repair', draw: (c, T) => TOOLS.repair(c, T) },
    { name: 'tool brush', draw: (c, T) => TOOLS.brush(c, T) },
    { name: 'tool mouse', draw: (c, T) => TOOLS.mouse(c, T, 0.3) },
    { name: 'tool laser', draw: (c, T) => TOOLS.laser(c, T) },
    { name: 'tool treat', draw: (c, T) => TOOLS.treat(c, T) },
    { name: 'status', draw: (c, T) => drawStatus(c, 0, 10, { food: 30, energy: 70, fun: 50, clean: 90, health: 15 }, 'Mochi', 'hungry', 1) },
    { name: 'tool feather', draw: (c, T) => TOOLS.feather(c, T) },
    { name: 'feather lure', draw: (c, T) => PROPS.featherLure(c, T) },
    { name: 'bubble gift', draw: (c, T) => drawBubble(c, -14, 10, 'gift', 1, T, false) },
    { name: 'bubble tomato', draw: (c, T) => drawBubble(c, -14, 10, 'tomato', 1, T, false) },
    { name: 'bubble feather', draw: (c, T) => drawBubble(c, -14, 10, 'feather', 1, T, false) },
    ...GIFTS.map(([k]) => ({ name: 'gift ' + k, draw: (c, T) => { c.scale(1.6, 1.6); PROPS.gift(c, k, T); } })),
    { name: 'confetti', draw: (c, T) => { for (let i = 0; i < 14; i++) { c.save(); c.translate(-30 + (i % 7) * 10, -20 + Math.floor(i / 7) * 16); PARTICLES.confetti(c, { k: (T * 0.3 + i * 0.07) % 1, rot: i * 0.37, size: 1.4 }); c.restore(); } } },
  ];

  root.PropsArt = { ICONS, PROPS, TOOLS, PARTICLES, GIFTS, drawIcon, drawBubble, drawLabel, drawStatus, rng, GALLERY, star, heart, rrect };
})(typeof window !== 'undefined' ? window : globalThis);
