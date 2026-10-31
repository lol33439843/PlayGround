import * as C from './config.js';

const TAU = Math.PI * 2;
let bgCache = null;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function pathTrace(ctx) {
  const pts = C.PATH_POINTS;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

function buildBackground() {
  const scale = 2;
  const cv = document.createElement('canvas');
  cv.width = C.W * scale;
  cv.height = C.H * scale;
  const b = cv.getContext('2d');
  b.scale(scale, scale);

  const grad = b.createLinearGradient(0, 0, C.W, C.H);
  grad.addColorStop(0, '#070d1a');
  grad.addColorStop(0.5, '#081020');
  grad.addColorStop(1, '#0a0a18');
  b.fillStyle = grad;
  b.fillRect(0, 0, C.W, C.H);

  const portalGlow = b.createRadialGradient(C.PORTAL.x, C.PORTAL.y, 0, C.PORTAL.x, C.PORTAL.y, 300);
  portalGlow.addColorStop(0, 'rgba(48,180,255,0.16)');
  portalGlow.addColorStop(1, 'rgba(48,180,255,0)');
  b.fillStyle = portalGlow;
  b.fillRect(0, 0, C.W, C.H);

  const coreGlow = b.createRadialGradient(C.CORE.x, C.CORE.y, 0, C.CORE.x, C.CORE.y, 320);
  coreGlow.addColorStop(0, 'rgba(255,77,157,0.14)');
  coreGlow.addColorStop(1, 'rgba(255,77,157,0)');
  b.fillStyle = coreGlow;
  b.fillRect(0, 0, C.W, C.H);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 140; i++) {
    const x = rand() * C.W;
    const y = rand() * C.H;
    const r = rand() * 1.2 + 0.3;
    b.fillStyle = `rgba(150,200,255,${0.03 + rand() * 0.1})`;
    b.beginPath();
    b.arc(x, y, r, 0, TAU);
    b.fill();
  }

  b.strokeStyle = 'rgba(120,180,255,0.045)';
  b.lineWidth = 0.6;
  for (let x = 0; x <= C.W; x += C.CELL) {
    b.beginPath();
    b.moveTo(x, 0);
    b.lineTo(x, C.H);
    b.stroke();
  }
  for (let y = 0; y <= C.H; y += C.CELL) {
    b.beginPath();
    b.moveTo(0, y);
    b.lineTo(C.W, y);
    b.stroke();
  }
  b.strokeStyle = 'rgba(120,180,255,0.03)';
  b.lineWidth = 1;
  for (let x = 0; x <= C.W; x += C.CELL * 4) {
    b.beginPath();
    b.moveTo(x, 0);
    b.lineTo(x, C.H);
    b.stroke();
  }
  for (let y = 0; y <= C.H; y += C.CELL * 4) {
    b.beginPath();
    b.moveTo(0, y);
    b.lineTo(C.W, y);
    b.stroke();
  }

  // build sockets
  for (let cy = 0; cy < C.ROWS; cy++) {
    for (let cx = 0; cx < C.COLS; cx++) {
      if (!C.isBuildable(cx, cy)) continue;
      const x = (cx + 0.5) * C.CELL;
      const y = (cy + 0.5) * C.CELL;
      b.strokeStyle = 'rgba(130,190,255,0.08)';
      b.lineWidth = 1;
      b.beginPath();
      b.arc(x, y, 4.5, 0, TAU);
      b.stroke();
      b.fillStyle = 'rgba(160,210,255,0.05)';
      b.beginPath();
      b.arc(x, y, 1.6, 0, TAU);
      b.fill();
    }
  }

  b.lineJoin = 'round';
  b.lineCap = 'round';
  b.strokeStyle = 'rgba(45,120,255,0.16)';
  b.lineWidth = 58;
  pathTrace(b);
  b.stroke();
  b.strokeStyle = '#14213a';
  b.lineWidth = 46;
  pathTrace(b);
  b.stroke();
  b.strokeStyle = '#0b1526';
  b.lineWidth = 38;
  pathTrace(b);
  b.stroke();
  b.strokeStyle = 'rgba(77,232,255,0.10)';
  b.lineWidth = 40;
  pathTrace(b);
  b.stroke();
  b.strokeStyle = 'rgba(77,232,255,0.20)';
  b.lineWidth = 1;
  b.setLineDash([6, 18]);
  pathTrace(b);
  b.stroke();
  b.setLineDash([]);

  // direction chevrons
  b.strokeStyle = 'rgba(120,220,255,0.13)';
  b.lineWidth = 2;
  for (let d = 70; d < C.PATH_LENGTH - 30; d += 150) {
    const p = C.pathAt(d);
    b.save();
    b.translate(p.x, p.y);
    b.rotate(p.angle);
    b.beginPath();
    b.moveTo(-4, -5);
    b.lineTo(3, 0);
    b.lineTo(-4, 5);
    b.stroke();
    b.restore();
  }

  // corner framing
  b.strokeStyle = 'rgba(120,200,255,0.10)';
  b.lineWidth = 1;
  b.strokeRect(10.5, 10.5, C.W - 21, C.H - 21);

  return cv;
}

function drawBackground(ctx) {
  if (!bgCache) bgCache = buildBackground();
  ctx.drawImage(bgCache, 0, 0, C.W, C.H);
}

function drawPathFlow(ctx, time) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(77,232,255,0.15)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([8, 30]);
  ctx.lineDashOffset = -time * 46;
  pathTrace(ctx);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const d = (time * 74 + i * (C.PATH_LENGTH / 3)) % C.PATH_LENGTH;
    const p = C.pathAt(d);
    ctx.fillStyle = 'rgba(120,240,255,0.55)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPortal(ctx, s) {
  const t = s.renderTime;
  const { x, y } = C.PORTAL;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 70);
  glow.addColorStop(0, 'rgba(70,200,255,0.22)');
  glow.addColorStop(1, 'rgba(70,200,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 70, 0, TAU);
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(t * 0.6);
  ctx.strokeStyle = 'rgba(77,232,255,0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, TAU);
  ctx.stroke();
  ctx.rotate(-t * 1.5);
  ctx.strokeStyle = 'rgba(150,240,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(t * 0.9);
  const inner = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
  inner.addColorStop(0, 'rgba(200,250,255,0.9)');
  inner.addColorStop(0.5, 'rgba(60,180,255,0.4)');
  inner.addColorStop(1, 'rgba(20,60,120,0)');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();

  if (s.portalPulse > 0) {
    ctx.strokeStyle = `rgba(140,240,255,${s.portalPulse * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 28 + (1 - s.portalPulse) * 26, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCore(ctx, s) {
  const t = s.renderTime;
  const { x, y } = C.CORE;
  const danger = s.lives <= 5;
  const baseColor = danger ? '#ff5b6e' : '#ff4d9d';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.18 + Math.sin(t * 2.2) * 0.05 + s.corePulse * 0.3;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 78);
  glow.addColorStop(0, `rgba(255,90,170,${pulse})`);
  glow.addColorStop(1, 'rgba(255,90,170,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 78, 0, TAU);
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(t * 0.35);
  ctx.strokeStyle = rgba(baseColor, 0.55);
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.rotate(-t * 0.7);

  const hex = (r) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  const fill = ctx.createLinearGradient(0, -24, 0, 24);
  fill.addColorStop(0, '#3a0d2a');
  fill.addColorStop(1, '#150a1e');
  ctx.fillStyle = fill;
  hex(24);
  ctx.fill();
  ctx.strokeStyle = rgba(baseColor, 0.85);
  ctx.lineWidth = 2;
  hex(24);
  ctx.stroke();
  ctx.fillStyle = rgba(baseColor, 0.22);
  hex(13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,235,0.8)';
  ctx.lineWidth = 1.2;
  hex(13);
  ctx.stroke();

  const c = 5 + Math.sin(t * 3) * 1.6;
  ctx.fillStyle = '#fff0f7';
  ctx.shadowColor = baseColor;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, c, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (s.corePulse > 0) {
    ctx.strokeStyle = `rgba(255,110,180,${s.corePulse * 0.6})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 30 + (1 - s.corePulse) * 60, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDust(ctx, s) {
  ctx.save();
  for (const d of s.dust) {
    ctx.fillStyle = `rgba(140,210,255,${d.alpha})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawRange(ctx, x, y, range, color) {
  ctx.save();
  ctx.fillStyle = rgba(color, 0.055);
  ctx.beginPath();
  ctx.arc(x, y, range, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.42);
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(x, y, range, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGhost(ctx, s) {
  const cell = s.touch ? s.pendingCell : s.hover;
  if (!cell) return;
  const def = C.TOWERS[s.buildType];
  if (!def) return;
  const { cx, cy } = cell;
  const occupied = s.occupied.has(C.cellKey(cx, cy));
  const ok = C.isBuildable(cx, cy) && !occupied && s.gold >= def.cost;
  const color = ok ? '#6ef7a5' : '#ff5b6e';
  const x = (cx + 0.5) * C.CELL;
  const y = (cy + 0.5) * C.CELL;

  ctx.save();
  ctx.fillStyle = rgba(color, 0.08);
  ctx.strokeStyle = rgba(color, 0.7);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx * C.CELL + 3, cy * C.CELL + 3, C.CELL - 6, C.CELL - 6, 7);
  ctx.fill();
  ctx.stroke();
  drawRange(ctx, x, y, def.levels[0].range, color);
  ctx.globalAlpha = 0.55;
  drawTower(ctx, {
    type: s.buildType, x, y, level: 0, angle: -Math.PI / 2, flash: 0, spent: 0,
  }, { renderTime: s.renderTime, selectedTower: null });
  ctx.restore();
}

function drawHoverCell(ctx, s) {
  if (!s.hover || s.buildType) return;
  const { cx, cy } = s.hover;
  if (!C.inBounds(cx, cy)) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(180,225,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(cx * C.CELL + 4, cy * C.CELL + 4, C.CELL - 8, C.CELL - 8, 6);
  ctx.stroke();
  ctx.restore();
}

function drawTower(ctx, t, s) {
  const def = C.TOWERS[t.type];
  if (!def) return;
  const time = s.renderTime;
  ctx.save();
  ctx.translate(t.x, t.y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 23, 8, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#0b1526';
  ctx.strokeStyle = 'rgba(140,200,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-20, -20, 40, 40, 9);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = rgba(def.color, 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -4, 14, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i <= t.level ? def.color : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(-9 + i * 7, 15, 4.5, 3, 1);
    ctx.fill();
  }

  if (s.selectedTower === t) {
    ctx.strokeStyle = rgba(def.color, 0.65);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const recoil = t.flash > 0 ? t.flash * 3 : 0;
  ctx.save();
  ctx.translate(0, -5);

  if (t.type === 'pulse') {
    ctx.rotate(t.angle);
    ctx.translate(-recoil, 0);
    ctx.fillStyle = '#122033';
    ctx.strokeStyle = rgba(def.color, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (const sy of [-6, 4]) {
      ctx.fillStyle = '#1a3048';
      ctx.beginPath();
      ctx.roundRect(5, sy - 2, 17, 4, 2);
      ctx.fill();
      ctx.fillStyle = rgba(def.color, 0.9);
      ctx.beginPath();
      ctx.arc(21, sy, 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (t.type === 'cannon') {
    ctx.rotate(t.angle);
    ctx.translate(-recoil, 0);
    ctx.fillStyle = '#132338';
    ctx.strokeStyle = rgba(def.color, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d2c40';
    ctx.strokeStyle = rgba(def.color, 0.35);
    ctx.beginPath();
    ctx.roundRect(4, -7, 26, 14, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0c1725';
    ctx.beginPath();
    ctx.arc(28, 0, 6.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(def.color, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(28, 0, 4.5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = rgba(def.color, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, TAU);
    ctx.fill();
  } else if (t.type === 'cryo') {
    const bob = Math.sin(time * 2.4) * 2;
    ctx.strokeStyle = rgba(def.color, 0.4);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -2, 15, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = time * 1.1 + (i / 3) * TAU;
      const ox = Math.cos(a) * 12;
      const oy = -2 + Math.sin(a) * 5;
      ctx.fillStyle = rgba(def.color, 0.65);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3, 0);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.translate(0, -13 + bob);
    ctx.fillStyle = 'rgba(210,245,255,0.95)';
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, -1);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, -1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(def.color, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
  } else if (t.type === 'arc') {
    ctx.strokeStyle = rgba(def.color, 0.7);
    ctx.lineWidth = 2;
    for (const sx of [-8, 8]) {
      ctx.beginPath();
      ctx.moveTo(sx, 2);
      ctx.quadraticCurveTo(sx * 1.4, -8, sx * 0.6, -17);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1630';
    ctx.strokeStyle = rgba(def.color, 0.6);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -6, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const flicker = 0.5 + Math.sin(time * 14) * 0.2 + t.flash * 0.4;
    ctx.fillStyle = rgba('#e9e2ff', flicker);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, -10, 5, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (t.flash > 0) {
      ctx.strokeStyle = `rgba(220,210,255,${t.flash * 0.9})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(0, -10);
        const a = Math.random() * TAU;
        const r = 10 + Math.random() * 8;
        ctx.lineTo(Math.cos(a) * r, -10 + Math.sin(a) * r);
        ctx.stroke();
      }
    }
  } else if (t.type === 'rail') {
    ctx.rotate(t.angle);
    ctx.translate(-recoil * 1.4, 0);
    ctx.fillStyle = '#131c33';
    ctx.strokeStyle = rgba(def.color, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1a2440';
    ctx.beginPath();
    ctx.roundRect(3, -4, 30, 8, 2);
    ctx.fill();
    ctx.strokeStyle = rgba(def.color, 0.35);
    ctx.stroke();
    ctx.strokeStyle = rgba(def.color, 0.9);
    ctx.lineWidth = 1.6;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#22305a';
    ctx.beginPath();
    ctx.roundRect(-2, -11, 10, 6, 2);
    ctx.fill();
  }

  if (t.flash > 0) {
    const fx = t.type === 'cryo' ? 0 : t.type === 'arc' ? 0 : 27;
    const fy = t.type === 'cryo' ? -13 : t.type === 'arc' ? -10 : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(def.color, t.flash * 0.55);
    ctx.beginPath();
    ctx.arc(fx, fy, 5 + t.flash * 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', t.flash * 0.7);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + time;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3);
      ctx.lineTo(fx + Math.cos(a) * (7 + t.flash * 8), fy + Math.sin(a) * (7 + t.flash * 8));
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

export function drawTowerIcon(ctx, type) {
  const fake = { type, x: 24, y: 27, level: 0, angle: -Math.PI / 2, flash: 0, spent: 0 };
  ctx.save();
  ctx.scale(0.86, 0.86);
  ctx.translate(3, 3);
  drawTower(ctx, fake, { renderTime: 0, selectedTower: null });
  ctx.restore();
}

function drawEnemy(ctx, e, s) {
  const r = e.radius;
  const time = s.renderTime;
  const bob = Math.sin(time * 7 + e.seed) * 1.2;
  const flash = e.flash;
  const body = mix(e.def.color, '#ffffff', flash * 0.85);

  ctx.save();
  ctx.translate(e.x, e.y + bob);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.95, r * 0.9, r * 0.32, 0, 0, TAU);
  ctx.fill();

  if (e.slowTimer > 0) {
    ctx.strokeStyle = 'rgba(130,225,255,0.45)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -time * 26;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (e.type === 'boss') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.4);
    glow.addColorStop(0, 'rgba(255,70,110,0.24)');
    glow.addColorStop(1, 'rgba(255,70,110,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  if (e.type === 'drone' || e.type === 'runner') {
    ctx.rotate(e.angle);
    if (e.type === 'drone') {
      ctx.fillStyle = '#0a1a26';
      ctx.strokeStyle = body;
      ctx.lineWidth = 2;
      ctx.shadowColor = e.def.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(r * 1.15, 0);
      ctx.lineTo(-r * 0.75, r * 0.85);
      ctx.lineTo(-r * 0.25, 0);
      ctx.lineTo(-r * 0.75, -r * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e8fbff';
      ctx.beginPath();
      ctx.arc(r * 0.35, 0, 2.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(e.def.color, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.5);
      ctx.lineTo(-r * 1.15, -r * 0.2);
      ctx.moveTo(-r * 0.6, r * 0.5);
      ctx.lineTo(-r * 1.15, r * 0.2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#241c10';
      ctx.strokeStyle = body;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r * 1.1, 0);
      ctx.lineTo(0, r * 0.65);
      ctx.lineTo(-r * 0.9, 0);
      ctx.lineTo(0, -r * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, 2.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(e.def.color, 0.35);
      ctx.lineWidth = 1.2;
      for (const oy of [-3, 3]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, oy);
        ctx.lineTo(-r * 2, oy * 2);
        ctx.stroke();
      }
    }
  } else if (e.type === 'tank') {
    ctx.rotate(e.angle);
    ctx.fillStyle = '#241826';
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.68, r * 2, r * 1.36, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#120c16';
    for (const sy of [-r * 0.78, r * 0.62]) {
      ctx.beginPath();
      ctx.roundRect(-r * 0.92, sy, r * 1.84, r * 0.16, 3);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(e.def.color, 0.5);
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.32, -r * 0.78);
      ctx.lineTo(i * r * 0.32, -r * 0.62);
      ctx.moveTo(i * r * 0.32, r * 0.62);
      ctx.lineTo(i * r * 0.32, r * 0.78);
      ctx.stroke();
    }
    ctx.fillStyle = '#33203a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.46, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = body;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(0, -2.5, r * 1.25, 5, 2);
    ctx.fill();
  } else if (e.type === 'armor') {
    ctx.strokeStyle = rgba(e.def.color, 0.35);
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = time * 20;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#161226';
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.85, -r * 0.2);
    ctx.lineTo(r * 0.6, r * 0.8);
    ctx.lineTo(0, r * 1.05);
    ctx.lineTo(-r * 0.6, r * 0.8);
    ctx.lineTo(-r * 0.85, -r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = rgba(e.def.color, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, 0);
    ctx.lineTo(r * 0.5, 0);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(0, r * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#e6ddff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, TAU);
    ctx.fill();
  } else if (e.type === 'boss') {
    ctx.save();
    ctx.rotate(time * 0.4);
    ctx.fillStyle = '#2a0a14';
    ctx.strokeStyle = body;
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const a2 = a + TAU / 20;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      ctx.lineTo(Math.cos(a2) * r * 1.25, Math.sin(a2) * r * 1.25);
      ctx.lineTo(Math.cos(a2 + TAU / 20) * r * 0.8, Math.sin(a2 + TAU / 20) * r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.8);
    core.addColorStop(0, '#ffe3ea');
    core.addColorStop(0.3, body);
    core.addColorStop(1, '#3a0b18');
    ctx.fillStyle = core;
    ctx.strokeStyle = rgba('#ff9db3', 0.8);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.78, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.rotate(-time * 1.2);
    ctx.fillStyle = '#ffd4de';
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45, 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();

  const w = Math.max(30, r * 2.5);
  const h = e.type === 'boss' ? 6 : 4;
  const hpY = e.y - r - 13 + bob;
  const pct = clamp01(e.hp / e.maxHp);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(e.x - w / 2, hpY, w, h, h / 2);
  ctx.fill();
  const hpColor = pct > 0.55 ? '#6ef7a5' : pct > 0.28 ? '#ffd166' : '#ff5b6e';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  ctx.roundRect(e.x - w / 2 + 1, hpY + 1, Math.max(0, (w - 2) * pct), h - 2, (h - 2) / 2);
  ctx.fill();
  if (e.type === 'boss') {
    ctx.strokeStyle = 'rgba(255,170,195,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(e.x - w / 2, hpY, w, h, h / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectiles(ctx, s) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of s.projectiles) {
    if (p.kind === 'pulse') {
      ctx.strokeStyle = rgba(p.color, 0.4);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = rgba(p.color, 0.9);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.8, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.kind === 'shell') {
      const arc = Math.sin(Math.PI * Math.min(1, p.t)) * p.h;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5, 2.4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(p.color, 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py - arc * 0.6);
      ctx.lineTo(p.x, p.y - arc);
      ctx.stroke();
      ctx.fillStyle = '#ffd9a0';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y - arc, 3.6, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.kind === 'frost') {
      ctx.strokeStyle = rgba(p.color, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.renderTime * 9);
      ctx.fillStyle = '#e8fbff';
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(0, 4.5);
      ctx.lineTo(-3.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawBeams(ctx, s) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const b of s.beams) {
    const a = clamp01(b.life / b.maxLife);
    ctx.strokeStyle = rgba(b.color, a * 0.35);
    ctx.lineWidth = b.width * 4;
    ctx.beginPath();
    ctx.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) ctx.lineTo(b.points[i].x, b.points[i].y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.85})`;
    ctx.lineWidth = b.width;
    ctx.beginPath();
    ctx.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) ctx.lineTo(b.points[i].x, b.points[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, s) {
  for (const p of s.particles) {
    const a = clamp01(p.life / p.maxLife);
    if (a <= 0) continue;
    if (p.type === 'smoke') {
      ctx.fillStyle = `rgba(120,140,170,${a * 0.22})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
      ctx.fill();
    } else if (p.type === 'shard') {
      ctx.strokeStyle = rgba(p.color, a * 0.9);
      ctx.lineWidth = p.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(p.color, a * 0.85);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, TAU);
      ctx.fill();
    }
  }
}

function drawShocks(ctx, s) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const sh of s.shocks) {
    const a = clamp01(sh.life / sh.maxLife);
    ctx.strokeStyle = rgba(sh.color, a * 0.55);
    ctx.lineWidth = 1 + a * sh.width;
    ctx.beginPath();
    ctx.arc(sh.x, sh.y, sh.r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTexts(ctx, s) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of s.texts) {
    const a = clamp01(t.life / t.maxLife);
    ctx.globalAlpha = Math.min(1, a * 1.6);
    ctx.font = `800 ${t.size}px ui-monospace, "SF Mono", Menlo, monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

function drawVignette(ctx, s) {
  const g = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.28, C.W / 2, C.H / 2, C.H * 0.82);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.W, C.H);

  if (s.lives <= 5 && s.mode === 'playing') {
    const pulse = 0.12 + Math.sin(s.renderTime * 4) * 0.06;
    const r = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.3, C.W / 2, C.H / 2, C.H * 0.85);
    r.addColorStop(0, 'rgba(255,40,70,0)');
    r.addColorStop(1, `rgba(255,40,70,${pulse})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, C.W, C.H);
  }

  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,50,80,${s.flash * 0.28})`;
    ctx.fillRect(0, 0, C.W, C.H);
  }
}

export function render(ctx, s) {
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, C.W, C.H);
  ctx.save();
  if (s.shake > 0.3) {
    ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
  }

  drawBackground(ctx);
  drawPathFlow(ctx, s.renderTime);
  drawPortal(ctx, s);
  drawCore(ctx, s);
  drawDust(ctx, s);

  if (s.buildType && s.hover) drawGhost(ctx, s);
  if (s.selectedTower) {
    const def = C.TOWERS[s.selectedTower.type];
    const lv = def.levels[s.selectedTower.level];
    drawRange(ctx, s.selectedTower.x, s.selectedTower.y, lv.range, def.color);
  }

  const towers = [...s.towers].sort((a, b) => a.y - b.y);
  for (const t of towers) drawTower(ctx, t, s);

  const enemies = [...s.enemies].sort((a, b) => a.y - b.y);
  for (const e of enemies) drawEnemy(ctx, e, s);

  drawProjectiles(ctx, s);
  drawBeams(ctx, s);
  drawParticles(ctx, s);
  drawShocks(ctx, s);
  drawTexts(ctx, s);
  drawHoverCell(ctx, s);

  ctx.restore();
  drawVignette(ctx, s);
}
