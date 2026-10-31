import * as C from './config.js';
import { sound } from './audio.js';
import * as R from './render.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const RING_LEN = 2 * Math.PI * 44;

const el = {
  canvas: $('game'),
  stage: $('stage'),
  lives: $('livesVal'),
  gold: $('goldVal'),
  wave: $('waveVal'),
  score: $('scoreVal'),
  speedBtn: $('speedBtn'),
  pauseBtn: $('pauseBtn'),
  soundBtn: $('soundBtn'),
  helpBtn: $('helpBtn'),
  waveBtn: $('waveBtn'),
  waveTitle: $('waveTitle'),
  waveSub: $('waveSub'),
  waveRing: $('waveRing'),
  cards: $('towerCards'),
  buildHint: $('buildHint'),
  placeBar: $('placeBar'),
  placeText: $('placeText'),
  placeConfirm: $('placeConfirm'),
  placeCancel: $('placeCancel'),
  panel: $('towerPanel'),
  panelName: $('tpName'),
  panelLevel: $('tpLevel'),
  panelDmg: $('tpDmg'),
  panelRange: $('tpRange'),
  panelRate: $('tpRate'),
  panelDps: $('tpDps'),
  panelSpecial: $('tpSpecial'),
  panelKills: $('tpKills'),
  upgradeBtn: $('upgradeBtn'),
  sellBtn: $('sellBtn'),
  panelClose: $('tpClose'),
  toasts: $('toasts'),
  banner: $('waveBanner'),
  titleScreen: $('titleScreen'),
  pauseScreen: $('pauseScreen'),
  helpScreen: $('helpScreen'),
  endScreen: $('endScreen'),
  endKicker: $('endKicker'),
  endTitle: $('endTitle'),
  endSub: $('endSub'),
  endScore: $('endScore'),
  endWave: $('endWave'),
  endKills: $('endKills'),
  endBest: $('endBest'),
  endlessBtn: $('endlessBtn'),
  bestTitle: $('bestTitle'),
};

const ctx = el.canvas.getContext('2d');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
el.canvas.width = C.W * dpr;
el.canvas.height = C.H * dpr;

const state = {
  mode: 'menu',
  dpr,
  time: 0,
  renderTime: 0,
  speed: 1,
  gold: C.START_GOLD,
  lives: C.START_LIVES,
  score: 0,
  wave: 1,
  maxWave: C.MAX_WAVE,
  endless: false,
  enemies: [],
  towers: [],
  projectiles: [],
  beams: [],
  particles: [],
  texts: [],
  shocks: [],
  dust: [],
  occupied: new Map(),
  prep: C.PREP_FIRST,
  prepTotal: C.PREP_FIRST,
  waveActive: false,
  waveTime: 0,
  spawnQueue: [],
  waveTotal: 0,
  waveSpawned: 0,
  buildType: null,
  selectedTower: null,
  hover: null,
  pendingCell: null,
  touch: false,
  shake: 0,
  flash: 0,
  corePulse: 0,
  portalPulse: 0,
  pausedByHelp: false,
  stats: { kills: 0, leaked: 0, built: 0, earned: 0, spent: 0, damage: 0 },
  best: 0,
  muted: false,
};

try {
  state.best = parseInt(localStorage.getItem('neon-defense-best') || '0', 10) || 0;
  state.muted = localStorage.getItem('neon-defense-muted') === '1';
} catch {}
sound.setEnabled(!state.muted);

const cardEls = new Map();

function setText(node, value) {
  const v = String(value);
  if (node.textContent !== v) node.textContent = v;
}

function makeDust() {
  state.dust = Array.from({ length: 34 }, () => ({
    x: Math.random() * C.W,
    y: Math.random() * C.H,
    r: 0.5 + Math.random() * 1.6,
    alpha: 0.04 + Math.random() * 0.16,
    vx: 4 + Math.random() * 10,
    vy: -2 + Math.random() * 4,
  }));
}

function buildCards() {
  for (const [id, def] of Object.entries(C.TOWERS)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tcard';
    btn.dataset.type = id;
    btn.setAttribute('aria-label', `Build ${def.name}, costs ${def.cost} gold`);
    btn.innerHTML = `
      <span class="tkey">${def.hotkey}</span>
      <canvas class="ticon" width="96" height="96"></canvas>
      <span class="tname">${def.name}</span>
      <span class="tcost"><i>◆</i>${def.cost}</span>`;
    el.cards.appendChild(btn);
    const icon = btn.querySelector('canvas');
    const ictx = icon.getContext('2d');
    ictx.setTransform(2, 0, 0, 2, 0, 0);
    R.drawTowerIcon(ictx, id);
    btn.addEventListener('click', () => {
      sound.init();
      sound.play('click');
      selectBuild(id);
    });
    cardEls.set(id, btn);
  }
}

function fitCanvas() {
  state.touch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 760;
  document.body.classList.toggle('touch', state.touch);
  const rect = el.stage.getBoundingClientRect();
  const compact = window.innerWidth < 760;
  const availW = Math.max(240, rect.width - (compact ? 10 : 44));
  const availH = Math.max(150, rect.height - (compact ? 6 : 16));
  const scale = Math.min(availW / C.W, availH / C.H);
  el.canvas.style.width = `${Math.round(C.W * scale)}px`;
  el.canvas.style.height = `${Math.round(C.H * scale)}px`;
}

function show(node) { node.hidden = false; }
function hide(node) { node.hidden = true; }

function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  el.toasts.appendChild(node);
  while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
  window.setTimeout(() => {
    node.classList.add('out');
    window.setTimeout(() => node.remove(), 260);
  }, 2500);
}

function banner(message) {
  el.banner.textContent = message;
  el.banner.classList.remove('show');
  void el.banner.offsetWidth;
  el.banner.classList.add('show');
}

function updateBest() {
  setText(el.bestTitle, state.best);
}

function commitBest() {
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem('neon-defense-best', String(state.best)); } catch {}
    updateBest();
  }
}

function resetGame() {
  state.time = 0;
  state.gold = C.START_GOLD;
  state.lives = C.START_LIVES;
  state.score = 0;
  state.wave = 1;
  state.maxWave = C.MAX_WAVE;
  state.endless = false;
  state.enemies = [];
  state.towers = [];
  state.projectiles = [];
  state.beams = [];
  state.particles = [];
  state.texts = [];
  state.shocks = [];
  state.occupied.clear();
  state.prep = C.PREP_FIRST;
  state.prepTotal = C.PREP_FIRST;
  state.waveActive = false;
  state.waveTime = 0;
  state.spawnQueue = [];
  state.waveTotal = 0;
  state.waveSpawned = 0;
  state.buildType = null;
  state.selectedTower = null;
  state.hover = null;
  state.pendingCell = null;
  state.shake = 0;
  state.flash = 0;
  state.corePulse = 0;
  state.portalPulse = 0;
  state.speed = 1;
  state.stats = { kills: 0, leaked: 0, built: 0, earned: 0, spent: 0, damage: 0 };
  makeDust();
  updateUI();
}

function startGame() {
  sound.init();
  resetGame();
  state.mode = 'playing';
  hide(el.titleScreen);
  hide(el.endScreen);
  hide(el.pauseScreen);
  hide(el.helpScreen);
  document.body.dataset.mode = 'playing';
  toast('Build your defenses — wave 1 incoming', 'info');
  updateUI();
}

function mainMenu() {
  state.mode = 'menu';
  resetGame();
  hide(el.endScreen);
  hide(el.pauseScreen);
  hide(el.helpScreen);
  show(el.titleScreen);
  document.body.dataset.mode = 'menu';
  updateUI();
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    show(el.pauseScreen);
    sound.play('click');
  } else if (state.mode === 'paused' && el.helpScreen.hidden) {
    state.mode = 'playing';
    hide(el.pauseScreen);
    sound.play('click');
  }
  document.body.dataset.mode = state.mode;
}

function openHelp() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    state.pausedByHelp = true;
    hide(el.pauseScreen);
  }
  show(el.helpScreen);
  sound.play('click');
}

function closeHelp() {
  hide(el.helpScreen);
  if (state.pausedByHelp) {
    state.pausedByHelp = false;
    state.mode = 'playing';
  }
  document.body.dataset.mode = state.mode;
}

function endGame(victory) {
  commitBest();
  state.mode = victory ? 'victory' : 'gameover';
  if (victory) {
    state.score += state.lives * 50;
    commitBest();
  }
  document.body.dataset.mode = state.mode;
  setText(el.endKicker, victory ? 'SIMULATION COMPLETE' : 'SIMULATION FAILED');
  setText(el.endTitle, victory ? 'VICTORY' : 'CORE BREACH');
  setText(el.endSub, victory
    ? `You held the core through ${C.MAX_WAVE} waves.`
    : state.endless
      ? `The endless run ended on wave ${state.wave}.`
      : `The core fell on wave ${state.wave}.`);
  setText(el.endScore, state.score);
  setText(el.endWave, state.wave);
  setText(el.endKills, state.stats.kills);
  setText(el.endBest, state.best);
  el.endlessBtn.hidden = !victory || state.endless;
  show(el.endScreen);
  hide(el.pauseScreen);
  sound.play(victory ? 'victory' : 'leak');
}

function continueEndless() {
  state.endless = true;
  state.maxWave = Infinity;
  state.wave = C.MAX_WAVE + 1;
  state.mode = 'playing';
  state.prep = C.PREP_NEXT;
  state.prepTotal = C.PREP_NEXT;
  hide(el.endScreen);
  document.body.dataset.mode = 'playing';
  banner('ENDLESS');
  toast('Endless mode — every wave hits harder', 'danger');
  sound.play('wave');
  updateUI();
}

function selectBuild(type) {
  if (state.mode !== 'playing') return;
  if (state.buildType === type) {
    state.buildType = null;
  } else {
    state.buildType = type;
    state.selectedTower = null;
  }
  state.pendingCell = null;
  updateUI();
}

function selectTower(tower) {
  state.selectedTower = tower;
  if (tower) state.buildType = null;
  state.pendingCell = null;
  updateUI();
}

function handleClick(cx, cy) {
  if (!C.inBounds(cx, cy)) return;
  const existing = state.occupied.get(C.cellKey(cx, cy));
  if (state.buildType) {
    if (existing) {
      selectTower(existing);
      return;
    }
    if (state.touch) {
      if (state.pendingCell && state.pendingCell.cx === cx && state.pendingCell.cy === cy) {
        tryBuild(cx, cy);
      } else {
        state.pendingCell = { cx, cy };
        state.hover = { cx, cy };
        sound.play('click');
        updateUI();
      }
      return;
    }
    tryBuild(cx, cy);
    return;
  }
  selectTower(existing || null);
}

function tryBuild(cx, cy) {
  const def = C.TOWERS[state.buildType];
  if (!def) return;
  if (!C.isBuildable(cx, cy)) {
    toast('Cannot build on the route', 'danger');
    sound.play('error');
    return;
  }
  if (state.occupied.has(C.cellKey(cx, cy))) return;
  if (state.gold < def.cost) {
    toast('Not enough gold', 'danger');
    sound.play('error');
    return;
  }
  const tower = {
    type: state.buildType,
    cx,
    cy,
    x: (cx + 0.5) * C.CELL,
    y: (cy + 0.5) * C.CELL,
    level: 0,
    cooldown: 0,
    angle: -Math.PI / 2,
    flash: 0,
    spent: def.cost,
    kills: 0,
    damage: 0,
    seed: Math.random() * 10,
  };
  state.towers.push(tower);
  state.occupied.set(C.cellKey(cx, cy), tower);
  state.gold -= def.cost;
  state.stats.built++;
  state.stats.spent += def.cost;
  burst(tower.x, tower.y, 14, def.color, 90, 0.45);
  ring(tower.x, tower.y, 34, def.color, 0.4);
  sound.play('place');
  state.pendingCell = null;
  if (state.gold < def.cost) state.buildType = null;
  updateUI();
}

function upgradeSelected() {
  const tower = state.selectedTower;
  if (!tower) return;
  const cost = C.upgradeCost(tower);
  if (cost === null) return;
  if (state.gold < cost) {
    toast('Not enough gold', 'danger');
    sound.play('error');
    return;
  }
  state.gold -= cost;
  tower.spent += cost;
  tower.level++;
  state.stats.spent += cost;
  burst(tower.x, tower.y - 6, 18, C.TOWERS[tower.type].color, 110, 0.6);
  ring(tower.x, tower.y, 40, C.TOWERS[tower.type].color, 0.5);
  sound.play('upgrade');
  updateUI();
}

function sellSelected() {
  const tower = state.selectedTower;
  if (!tower) return;
  const refund = C.sellValue(tower);
  state.gold += refund;
  state.towers = state.towers.filter((t) => t !== tower);
  state.occupied.delete(C.cellKey(tower.cx, tower.cy));
  state.stats.spent -= tower.spent;
  burst(tower.x, tower.y, 12, '#ffd166', 80, 0.4);
  sound.play('sell');
  toast(`Tower sold +${refund}g`, 'gold');
  state.selectedTower = null;
  updateUI();
}

function updateUI() {
  setText(el.lives, state.lives);
  setText(el.gold, Math.floor(state.gold));
  setText(el.wave, state.endless ? `${state.wave} · ∞` : `${Math.min(state.wave, state.maxWave)}/${state.maxWave}`);
  setText(el.score, state.score);
  setText(el.speedBtn, `${state.speed}×`);
  el.soundBtn.classList.toggle('muted', state.muted);
  el.soundBtn.textContent = state.muted ? '×' : '♪';

  const active = state.waveActive;
  el.waveBtn.classList.toggle('active', active);
  el.waveBtn.disabled = active;
  if (active) {
    setText(el.waveTitle, `WAVE ${state.wave}`);
    setText(el.waveSub, `${state.enemies.length + state.spawnQueue.length} LEFT`);
    el.waveRing.style.strokeDashoffset = '0';
  } else {
    setText(el.waveTitle, 'SEND WAVE');
    setText(el.waveSub, `${Math.max(0, Math.ceil(state.prep))}s · +${Math.ceil(state.prep) * 2}g`);
    const pct = state.prepTotal > 0 ? 1 - state.prep / state.prepTotal : 0;
    el.waveRing.style.strokeDashoffset = String(RING_LEN * (1 - Math.max(0, Math.min(1, pct))));
  }

  for (const [id, btn] of cardEls) {
    const def = C.TOWERS[id];
    btn.classList.toggle('poor', state.gold < def.cost);
    btn.classList.toggle('selected', state.buildType === id);
  }

  if (state.buildType) {
    const def = C.TOWERS[state.buildType];
    const pending = state.pendingCell;
    if (state.touch) {
      el.buildHint.hidden = true;
      el.placeBar.hidden = false;
      const affordable = state.gold >= def.cost;
      if (pending) {
        const occupied = state.occupied.has(C.cellKey(pending.cx, pending.cy));
        const buildable = C.isBuildable(pending.cx, pending.cy);
        const ok = buildable && !occupied && affordable;
        setText(el.placeText, !buildable ? 'ROUTE BLOCKED' : occupied ? 'CELL OCCUPIED' : !affordable ? 'NOT ENOUGH GOLD' : `PLACE ${def.name.toUpperCase()} · ${def.cost}g`);
        el.placeBar.classList.toggle('bad', !ok);
        el.placeConfirm.disabled = !ok;
        el.placeConfirm.textContent = !affordable ? 'NEED GOLD' : 'BUILD';
      } else {
        setText(el.placeText, affordable ? `TAP A CELL · ${def.name.toUpperCase()} ${def.cost}g` : `NOT ENOUGH GOLD · ${def.cost}g`);
        el.placeBar.classList.toggle('bad', !affordable);
        el.placeConfirm.disabled = true;
        el.placeConfirm.textContent = 'BUILD';
      }
    } else {
      el.placeBar.hidden = true;
      el.buildHint.hidden = false;
      el.buildHint.innerHTML = `PLACING <b>${def.name.toUpperCase()}</b> · ${def.cost}g <span>tap a free cell · esc to cancel</span>`;
      el.buildHint.classList.toggle('poor', state.gold < def.cost);
    }
  } else {
    el.buildHint.hidden = true;
    el.placeBar.hidden = true;
  }

  updatePanel();
}

function updatePanel() {
  const t = state.selectedTower;
  if (!t || !state.towers.includes(t)) {
    el.panel.hidden = true;
    if (state.selectedTower && !state.towers.includes(state.selectedTower)) state.selectedTower = null;
    return;
  }
  const def = C.TOWERS[t.type];
  const lv = def.levels[t.level];
  el.panel.hidden = false;
  el.panel.style.setProperty('--tower-color', def.color);
  setText(el.panelName, def.name);
  setText(el.panelLevel, `LEVEL ${t.level + 1}`);
  setText(el.panelDmg, Math.round(lv.dmg));
  setText(el.panelRange, (lv.range / C.CELL).toFixed(1));
  setText(el.panelRate, lv.rate.toFixed(2));
  setText(el.panelDps, Math.round(lv.dmg * lv.rate * (lv.chains ? 1.6 : 1)));
  setText(el.panelSpecial, def.special);
  setText(el.panelKills, t.kills);

  const cost = C.upgradeCost(t);
  if (cost === null) {
    el.upgradeBtn.textContent = 'MAX LEVEL';
    el.upgradeBtn.disabled = true;
  } else {
    el.upgradeBtn.textContent = `UPGRADE · ${cost}g`;
    el.upgradeBtn.disabled = state.gold < cost;
  }
  el.sellBtn.textContent = `SELL +${C.sellValue(t)}g`;
}

function cycleSpeed() {
  if (state.mode !== 'playing' && state.mode !== 'paused') return;
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
  sound.play('click');
  updateUI();
}

function toggleSound() {
  state.muted = !state.muted;
  sound.setEnabled(!state.muted);
  try { localStorage.setItem('neon-defense-muted', state.muted ? '1' : '0'); } catch {}
  if (!state.muted) sound.play('click');
  updateUI();
}

function gamePoint(ev) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * C.W,
    y: ((ev.clientY - rect.top) / rect.height) * C.H,
  };
}

function bindEvents() {
  $('startBtn').addEventListener('click', () => { sound.init(); sound.play('click'); startGame(); });
  $('howBtn').addEventListener('click', openHelp);
  $('helpClose').addEventListener('click', closeHelp);
  el.helpBtn.addEventListener('click', openHelp);
  el.pauseBtn.addEventListener('click', togglePause);
  $('resumeBtn').addEventListener('click', togglePause);
  $('pauseRestart').addEventListener('click', startGame);
  $('pauseMenu').addEventListener('click', mainMenu);
  $('againBtn').addEventListener('click', startGame);
  $('menuBtn').addEventListener('click', mainMenu);
  el.endlessBtn.addEventListener('click', continueEndless);
  el.speedBtn.addEventListener('click', cycleSpeed);
  el.soundBtn.addEventListener('click', toggleSound);
  el.upgradeBtn.addEventListener('click', upgradeSelected);
  el.sellBtn.addEventListener('click', sellSelected);
  el.panelClose.addEventListener('click', () => selectTower(null));
  el.placeConfirm.addEventListener('click', () => {
    if (!state.pendingCell) return;
    sound.play('click');
    tryBuild(state.pendingCell.cx, state.pendingCell.cy);
  });
  el.placeCancel.addEventListener('click', () => {
    state.pendingCell = null;
    state.buildType = null;
    sound.play('click');
    updateUI();
  });
  el.waveBtn.addEventListener('click', () => {
    if (state.mode !== 'playing' || state.waveActive) return;
    sound.init();
    sound.play('click');
    startWave(true);
  });

  el.canvas.addEventListener('pointerdown', (ev) => {
    if (state.mode !== 'playing') return;
    ev.preventDefault();
    sound.init();
    const p = gamePoint(ev);
    handleClick(Math.floor(p.x / C.CELL), Math.floor(p.y / C.CELL));
  });
  el.canvas.addEventListener('pointermove', (ev) => {
    if (state.mode !== 'playing') return;
    const p = gamePoint(ev);
    const cx = Math.floor(p.x / C.CELL);
    const cy = Math.floor(p.y / C.CELL);
    state.hover = C.inBounds(cx, cy) ? { cx, cy } : null;
  });
  el.canvas.addEventListener('pointerleave', () => { state.hover = null; });

  window.addEventListener('keydown', (ev) => {
    if (ev.repeat) return;
    if (ev.key === 'Escape') {
      if (!el.helpScreen.hidden) { closeHelp(); return; }
      if (state.buildType) { state.buildType = null; updateUI(); return; }
      if (state.selectedTower) { selectTower(null); return; }
      if (state.mode === 'playing' || state.mode === 'paused') togglePause();
      return;
    }
    if (ev.key === ' ') {
      ev.preventDefault();
      if (el.helpScreen.hidden) togglePause();
      return;
    }
    if (ev.key === 'm' || ev.key === 'M') { toggleSound(); return; }
    if (ev.key === 'p' || ev.key === 'P') { togglePause(); return; }
    if (state.mode === 'playing') {
      const found = Object.values(C.TOWERS).find((d) => d.hotkey === ev.key);
      if (found) selectBuild(found.id);
    }
  });

  window.addEventListener('resize', fitCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(fitCanvas).observe(el.stage);
  document.addEventListener('pointerdown', () => sound.init(), { once: true });
}

// ---- simulation ----

let last = performance.now();

function loop(now) {
  const raw = Math.min((now - last) / 1000, 0.06);
  last = now;
  state.renderTime += raw;
  if (state.mode === 'playing') {
    let remain = raw * state.speed;
    let guard = 0;
    while (remain > 0.0001 && guard++ < 8) {
      const dt = Math.min(1 / 60, remain);
      simulate(dt);
      remain -= dt;
      if (state.mode !== 'playing') break;
    }
    updateUI();
  } else if (state.mode === 'menu') {
    updateAmbient(raw);
  }
  R.render(ctx, state);
  requestAnimationFrame(loop);
}

// ---- helpers ----

function addText(x, y, text, color, size = 12) {
  state.texts.push({ x, y, text: String(text), color, size, life: 0.85, maxLife: 0.85, vy: -30 });
}

function burst(x, y, count, color, speed = 100, life = 0.5) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const v = speed * (0.35 + Math.random() * 0.8);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      size: 1.4 + Math.random() * 2.2,
      color,
      type: Math.random() < 0.18 ? 'shard' : 'spark',
      drag: 3,
      gravity: 30,
    });
  }
}

function smoke(x, y, count, color = '#6f7f9a') {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 30,
      vy: -10 - Math.random() * 24,
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      size: 3 + Math.random() * 4,
      color,
      type: 'smoke',
      drag: 1,
      gravity: -8,
    });
  }
}

function ring(x, y, maxR, color, life = 0.45) {
  state.shocks.push({ x, y, r: 5, maxR, life, maxLife: life, color, width: 2.5 });
}

function explosion(x, y, color, size = 1) {
  burst(x, y, Math.round(18 * size), color, 150 * size, 0.55);
  burst(x, y, Math.round(6 * size), '#ffe3b0', 90 * size, 0.4);
  smoke(x, y, Math.round(4 * size));
  ring(x, y, 34 * size, color, 0.5);
  state.shake = Math.max(state.shake, 5 * size);
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

function segmentHit(x1, y1, x2, y2, px, py, pad) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1) <= pad;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)) <= pad;
}

// ---- ambient ----

function updateDust(dt) {
  for (const d of state.dust) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.x > C.W + 4) d.x = -4;
    if (d.y < -4) d.y = C.H + 4;
    if (d.y > C.H + 4) d.y = -4;
  }
}

function updateAmbient(dt) {
  updateDust(dt);
}

// ---- waves ----

function startWave(early) {
  if (state.mode !== 'playing' || state.waveActive) return;
  if (early && state.prep > 0) {
    const bonus = Math.ceil(state.prep) * 2;
    state.gold += bonus;
    state.stats.earned += bonus;
    toast(`Early call bonus +${bonus}g`, 'gold');
  }
  state.prep = 0;
  state.waveActive = true;
  state.waveTime = 0;
  state.waveSpawned = 0;
  const groups = C.waveGroups(state.wave);
  const queue = [];
  for (const grp of groups) {
    for (let i = 0; i < grp.count; i++) {
      queue.push({ type: grp.type, at: grp.start + i * grp.gap });
    }
  }
  queue.sort((a, b) => a.at - b.at);
  state.spawnQueue = queue;
  state.waveTotal = queue.length;
  sound.play('wave');
  banner(`WAVE ${state.wave}`);
  if (groups.some((grp) => grp.type === 'boss')) {
    toast('Leviathan signature detected', 'danger');
    sound.play('boss');
  }
  updateUI();
}

function completeWave() {
  state.waveActive = false;
  const bonus = 30 + state.wave * 6;
  state.gold += bonus;
  state.stats.earned += bonus;
  state.score += state.wave * 100;
  toast(`Wave ${state.wave} cleared  +${bonus}g`, 'gold');
  banner('WAVE CLEAR');
  if (!state.endless && state.wave >= state.maxWave) {
    endGame(true);
    return;
  }
  state.wave++;
  state.prep = C.PREP_NEXT;
  state.prepTotal = C.PREP_NEXT;
  updateUI();
}

function spawnEnemy(type) {
  const def = C.ENEMIES[type];
  if (!def) return;
  const mul = C.waveHpMul(state.wave);
  const hp = def.hp * mul;
  const start = C.PATH_POINTS[0];
  state.enemies.push({
    type,
    def,
    hp,
    maxHp: hp,
    speed: def.speed * (1 + Math.min(0.25, (state.wave - 1) * 0.006)),
    dist: 0,
    x: start.x,
    y: start.y,
    angle: 0,
    radius: def.radius,
    slowTimer: 0,
    slowAmount: 0,
    flash: 0,
    dead: false,
    seed: Math.random() * 100,
    reward: Math.round(def.reward * (1 + (state.wave - 1) * 0.02)),
  });
  state.portalPulse = 1;
  burst(C.PORTAL.x, C.PORTAL.y, type === 'boss' ? 18 : 6, def.color, type === 'boss' ? 120 : 55, 0.4);
  if (type === 'boss') {
    state.shake = Math.max(state.shake, 7);
    banner('LEVIATHAN');
  }
}

// ---- combat ----

function findTarget(tower, range) {
  let best = null;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= range + e.radius * 0.4) {
      if (!best || e.dist > best.dist) best = e;
    }
  }
  return best;
}

function damage(e, amount, opts = {}) {
  if (e.dead) return;
  const armor = e.def.armor || 0;
  const dealt = Math.max(1, amount * (1 - armor));
  e.hp -= dealt;
  e.flash = 1;
  state.stats.damage += dealt;
  if (opts.tower) opts.tower.damage += dealt;
  if (dealt >= 45 || opts.text) {
    addText(e.x, e.y - e.radius - 14, Math.round(dealt), opts.color || '#ffffff', dealt >= 100 ? 14 : 11);
  }
  if (e.hp <= 0) killEnemy(e, opts.tower);
}

function killEnemy(e, tower) {
  if (e.dead) return;
  e.dead = true;
  state.gold += e.reward;
  state.score += e.reward * 2;
  state.stats.kills++;
  state.stats.earned += e.reward;
  if (tower) tower.kills++;
  if (e.reward >= 18 || Math.random() < 0.22) {
    addText(e.x, e.y - e.radius - 4, `+${e.reward}`, '#ffd166', 11);
  }
  burst(e.x, e.y, e.type === 'boss' ? 34 : 12, e.def.color, e.type === 'boss' ? 200 : 100, 0.55);
  ring(e.x, e.y, e.type === 'boss' ? 80 : 24, e.def.color, 0.45);
  sound.play('kill');
  if (e.type === 'boss') {
    explosion(e.x, e.y, '#ff6b8b', 1.8);
    state.shake = 16;
    sound.play('boss');
  }
}

function leak(e) {
  if (state.mode !== 'playing') return;
  e.dead = true;
  const dmg = e.def.leak;
  state.lives -= dmg;
  state.stats.leaked++;
  state.flash = 1;
  state.shake = 14;
  state.corePulse = 1;
  addText(C.CORE.x - 10, C.CORE.y - 34, `-${dmg}`, '#ff5b6e', 18);
  sound.play('leak');
  if (state.lives <= 0) {
    state.lives = 0;
    endGame(false);
  }
}

function updateEnemies(dt) {
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) e.slowAmount = 0;
    }
    const factor = e.slowTimer > 0 ? 1 - e.slowAmount : 1;
    e.dist += e.speed * factor * dt;
    const p = C.pathAt(e.dist);
    e.x = p.x;
    e.y = p.y;
    e.angle = p.angle;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 5);
    if (e.type === 'boss' && Math.random() < dt * 14) {
      state.particles.push({
        x: e.x + (Math.random() - 0.5) * 20,
        y: e.y + (Math.random() - 0.5) * 20,
        vx: 0, vy: -14,
        life: 0.5, maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color: '#ff6b8b', type: 'spark', drag: 1, gravity: 0,
      });
    }
    if (e.slowTimer > 0 && Math.random() < dt * 9) {
      state.particles.push({
        x: e.x + (Math.random() - 0.5) * e.radius * 2,
        y: e.y + (Math.random() - 0.5) * e.radius,
        vx: (Math.random() - 0.5) * 20,
        vy: -8 - Math.random() * 12,
        life: 0.45, maxLife: 0.45,
        size: 1.4 + Math.random() * 1.6,
        color: '#a9e6ff', type: 'spark', drag: 2, gravity: 0,
      });
    }
    if (e.dist >= C.PATH_LENGTH - 1) leak(e);
  }
}

function fire(tower, def, lv, target) {
  const ox = tower.x;
  const oy = tower.y - 5;
  if (tower.type === 'pulse') {
    state.projectiles.push({
      kind: 'pulse', x: ox, y: oy, px: ox, py: oy,
      target, tx: target.x, ty: target.y,
      speed: 840, dmg: lv.dmg, color: def.color, tower, life: 2,
    });
    sound.play('shoot');
  } else if (tower.type === 'cannon') {
    const dist = Math.hypot(target.x - ox, target.y - oy);
    state.projectiles.push({
      kind: 'shell', sx: ox, sy: oy, x: ox, y: oy, px: ox, py: oy,
      tx: target.x, ty: target.y, t: 0, dur: Math.max(0.3, Math.min(0.95, dist / 540)),
      h: 46, dmg: lv.dmg, splash: lv.splash, color: def.color, tower,
    });
    sound.play('cannon');
  } else if (tower.type === 'cryo') {
    state.projectiles.push({
      kind: 'frost', x: ox, y: oy, px: ox, py: oy,
      target, tx: target.x, ty: target.y,
      speed: 660, dmg: lv.dmg, splash: lv.splash,
      slow: lv.slow, slowDur: lv.slowDur, color: def.color, tower, life: 2.2,
    });
    sound.play('frost');
  } else if (tower.type === 'arc') {
    const hit = [target];
    let cur = target;
    for (let i = 1; i < lv.chains; i++) {
      let next = null;
      let bestD = Infinity;
      for (const e of state.enemies) {
        if (e.dead || hit.includes(e)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < lv.chainRange && d < bestD) { bestD = d; next = e; }
      }
      if (!next) break;
      hit.push(next);
      cur = next;
    }
    const points = [{ x: ox, y: oy }];
    let dmg = lv.dmg;
    hit.forEach((e, i) => {
      points.push({ x: e.x, y: e.y });
      damage(e, dmg, { tower, text: i === 0, color: '#dcd2ff' });
      dmg *= 0.85;
    });
    state.beams.push({ points, life: 0.24, maxLife: 0.24, color: '#b9a6ff', width: 1.7 });
    sound.play('arc');
    tower.flash = 1;
  } else if (tower.type === 'rail') {
    const end = {
      x: ox + Math.cos(tower.angle) * lv.range,
      y: oy + Math.sin(tower.angle) * lv.range,
    };
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (segmentHit(ox, oy, end.x, end.y, e.x, e.y, e.radius + 7)) {
        damage(e, lv.dmg, { tower, text: true, color: '#ffd2ec' });
      }
    }
    state.beams.push({
      points: [{ x: ox, y: oy }, end],
      life: 0.32, maxLife: 0.32, color: '#ff8ad4', width: 3.4,
    });
    state.shake = Math.max(state.shake, 3);
    sound.play('rail');
    tower.flash = 1;
  }
}

function updateTowers(dt) {
  for (const tower of state.towers) {
    const def = C.TOWERS[tower.type];
    const lv = def.levels[tower.level];
    if (tower.flash > 0) tower.flash = Math.max(0, tower.flash - dt * 8);
    if (tower.cooldown > 0) tower.cooldown -= dt;
    if (!state.waveActive) {
      tower.angle = -Math.PI / 2 + Math.sin(state.renderTime * 0.6 + tower.seed) * 0.5;
      continue;
    }
    const target = findTarget(tower, lv.range);
    if (target) {
      const desired = Math.atan2(target.y - (tower.y - 5), target.x - tower.x);
      tower.angle = lerpAngle(tower.angle, desired, Math.min(1, dt * 14));
      if (tower.cooldown <= 0) {
        fire(tower, def, lv, target);
        tower.cooldown = 1 / lv.rate;
      }
    }
  }
}

function updateProjectiles(dt) {
  for (const p of state.projectiles) {
    if (p.dead) continue;
    p.px = p.x;
    p.py = p.y;
    if (p.kind === 'pulse') {
      if (p.target && !p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 7) {
        p.x = p.tx;
        p.y = p.ty;
        p.dead = true;
        if (p.target && !p.target.dead) {
          damage(p.target, p.dmg, { tower: p.tower });
          burst(p.x, p.y, 3, p.color, 50, 0.25);
        }
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    } else if (p.kind === 'shell') {
      p.t += dt / p.dur;
      if (p.t >= 1) {
        p.t = 1;
        p.x = p.tx;
        p.y = p.ty;
        p.dead = true;
        for (const e of state.enemies) {
          if (e.dead) continue;
          const d = Math.hypot(e.x - p.tx, e.y - p.ty);
          if (d <= p.splash + e.radius * 0.5) {
            const falloff = 1 - (d / p.splash) * 0.45;
            damage(e, p.dmg * falloff, { tower: p.tower });
          }
        }
        explosion(p.tx, p.ty, p.color, 1.05);
      } else {
        p.x = p.sx + (p.tx - p.sx) * p.t;
        p.y = p.sy + (p.ty - p.sy) * p.t;
      }
    } else if (p.kind === 'frost') {
      if (p.target && !p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 7) {
        p.x = p.tx;
        p.y = p.ty;
        p.dead = true;
        for (const e of state.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= p.splash + e.radius * 0.4) {
            damage(e, p.dmg, { tower: p.tower });
            const resist = e.def.slowResist || 0;
            e.slowTimer = Math.max(e.slowTimer, p.slowDur);
            e.slowAmount = Math.max(e.slowAmount, p.slow * (1 - resist));
          }
        }
        ring(p.x, p.y, p.splash + 6, '#a9e6ff', 0.4);
        burst(p.x, p.y, 8, '#cdf3ff', 70, 0.35);
      } else {
        p.x += (dx / d) * step;
        p.y += (dy / d) * step;
      }
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);
}

function updateEffects(dt) {
  for (const p of state.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - p.drag * dt);
    p.vy *= Math.max(0, 1 - p.drag * dt);
    p.vy += (p.gravity || 0) * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  for (const t of state.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
  }
  state.texts = state.texts.filter((t) => t.life > 0);

  for (const s of state.shocks) {
    s.life -= dt;
    s.r += (s.maxR - s.r) * Math.min(1, dt * 9);
  }
  state.shocks = state.shocks.filter((s) => s.life > 0);

  for (const b of state.beams) b.life -= dt;
  state.beams = state.beams.filter((b) => b.life > 0);

  updateDust(dt);
}

// ---- main simulation ----

function simulate(dt) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 34);
  state.flash = Math.max(0, state.flash - dt * 2.4);
  state.corePulse = Math.max(0, state.corePulse - dt * 1.8);
  state.portalPulse = Math.max(0, state.portalPulse - dt * 3);

  updateEffects(dt);
  updateProjectiles(dt);

  if (state.waveActive) {
    state.waveTime += dt;
    while (state.spawnQueue.length && state.spawnQueue[0].at <= state.waveTime) {
      const next = state.spawnQueue.shift();
      spawnEnemy(next.type);
      state.waveSpawned++;
    }
    updateEnemies(dt);
    if (state.mode !== 'playing') return;
    updateTowers(dt);
    if (state.mode !== 'playing') return;
    state.enemies = state.enemies.filter((e) => !e.dead);
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      completeWave();
    }
  } else {
    state.prep -= dt;
    if (state.prep <= 0) {
      startWave(false);
    } else {
      updateTowers(dt);
    }
  }
}

// Small debug/automation surface, also handy for tuning balance.
window.__TD = {
  state,
  startGame,
  startWave,
  selectBuild,
  tryBuild,
  upgradeSelected,
  sellSelected,
  endGame,
  continueEndless,
  addGold(amount) { state.gold += amount; updateUI(); },
  tick(seconds) {
    const step = 1 / 60;
    let left = Math.min(seconds, 600);
    while (left > 0 && state.mode === 'playing') {
      simulate(Math.min(step, left));
      left -= step;
    }
    updateUI();
    return { mode: state.mode, wave: state.wave, lives: state.lives, gold: Math.round(state.gold), score: state.score, enemies: state.enemies.length };
  },
};

buildCards();
bindEvents();
makeDust();
updateBest();
document.body.dataset.mode = 'menu';
requestAnimationFrame(() => { fitCanvas(); });
requestAnimationFrame(loop);
