// Neon Defense — game data, map, path and balance.
export const CELL = 48;
export const COLS = 20;
export const ROWS = 12;
export const W = COLS * CELL;
export const H = ROWS * CELL;

const GRID_PATH = [
  [-1, 1], [5, 1], [5, 5], [2, 5], [2, 9], [8, 9],
  [8, 4], [12, 4], [12, 9], [16, 9], [16, 3], [19, 3],
];

export const PATH_POINTS = GRID_PATH.map(([x, y]) => ({
  x: (x + 0.5) * CELL,
  y: (y + 0.5) * CELL,
}));

export const CORE = PATH_POINTS[PATH_POINTS.length - 1];
export const PORTAL = { x: 26, y: PATH_POINTS[1].y };

export const cellKey = (x, y) => `${x},${y}`;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;

export const PATH_CELLS = new Set();
for (let i = 0; i < GRID_PATH.length - 1; i++) {
  const [x0, y0] = GRID_PATH[i];
  const [x1, y1] = GRID_PATH[i + 1];
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let x = x0;
  let y = y0;
  if (inBounds(x, y)) PATH_CELLS.add(cellKey(x, y));
  while (x !== x1 || y !== y1) {
    x += dx;
    y += dy;
    if (inBounds(x, y)) PATH_CELLS.add(cellKey(x, y));
  }
}

export const isBuildable = (x, y) => inBounds(x, y) && !PATH_CELLS.has(cellKey(x, y));

const SEGMENTS = [];
let TOTAL = 0;
for (let i = 0; i < PATH_POINTS.length - 1; i++) {
  const a = PATH_POINTS[i];
  const b = PATH_POINTS[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEGMENTS.push({ a, b, len, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  TOTAL += len;
}
export const PATH_LENGTH = TOTAL;

export function pathAt(distance) {
  let d = Math.max(0, Math.min(distance, PATH_LENGTH));
  for (const seg of SEGMENTS) {
    if (d <= seg.len) {
      const t = seg.len === 0 ? 0 : d / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
        angle: seg.angle,
      };
    }
    d -= seg.len;
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  return { x: last.b.x, y: last.b.y, angle: last.angle };
}

export const TOWERS = {
  pulse: {
    id: 'pulse',
    name: 'Pulse',
    hotkey: '1',
    cost: 60,
    color: '#4de8ff',
    glow: 'rgba(77,232,255,',
    blurb: 'Rapid kinetic rounds.',
    special: 'Single target',
    levels: [
      { dmg: 14, range: 132, rate: 1.8 },
      { dmg: 24, range: 146, rate: 2.1 },
      { dmg: 40, range: 162, rate: 2.5 },
    ],
    upgrades: [45, 85],
  },
  cannon: {
    id: 'cannon',
    name: 'Mortar',
    hotkey: '2',
    cost: 110,
    color: '#ffa94d',
    glow: 'rgba(255,169,77,',
    blurb: 'Lobbed shells with blast.',
    special: 'Splash damage',
    levels: [
      { dmg: 46, range: 150, rate: 0.62, splash: 58 },
      { dmg: 78, range: 160, rate: 0.7, splash: 66 },
      { dmg: 124, range: 174, rate: 0.8, splash: 76 },
    ],
    upgrades: [95, 170],
  },
  cryo: {
    id: 'cryo',
    name: 'Cryo',
    hotkey: '3',
    cost: 90,
    color: '#8fd6ff',
    glow: 'rgba(143,214,255,',
    blurb: 'Freezes groups in place.',
    special: 'Slow 45% / 1.6s',
    levels: [
      { dmg: 7, range: 118, rate: 1.0, slow: 0.4, slowDur: 1.6, splash: 46 },
      { dmg: 12, range: 130, rate: 1.15, slow: 0.48, slowDur: 1.9, splash: 52 },
      { dmg: 19, range: 144, rate: 1.3, slow: 0.56, slowDur: 2.2, splash: 58 },
    ],
    upgrades: [75, 135],
  },
  arc: {
    id: 'arc',
    name: 'Arc',
    hotkey: '4',
    cost: 150,
    color: '#a78bff',
    glow: 'rgba(167,139,255,',
    blurb: 'Lightning that chains.',
    special: 'Chains x3',
    levels: [
      { dmg: 28, range: 138, rate: 0.85, chains: 3, chainRange: 96 },
      { dmg: 46, range: 150, rate: 1.0, chains: 4, chainRange: 105 },
      { dmg: 72, range: 164, rate: 1.15, chains: 5, chainRange: 115 },
    ],
    upgrades: [125, 210],
  },
  rail: {
    id: 'rail',
    name: 'Rail',
    hotkey: '5',
    cost: 220,
    color: '#ff6ec7',
    glow: 'rgba(255,110,199,',
    blurb: 'Long-range piercing beam.',
    special: 'Pierces a line',
    levels: [
      { dmg: 125, range: 260, rate: 0.42 },
      { dmg: 200, range: 285, rate: 0.5 },
      { dmg: 320, range: 310, rate: 0.6 },
    ],
    upgrades: [180, 300],
  },
};

export const ENEMIES = {
  drone: {
    name: 'Drone', hp: 58, speed: 86, reward: 8, radius: 13,
    color: '#59e6ff', leak: 1, armor: 0,
  },
  runner: {
    name: 'Runner', hp: 44, speed: 130, reward: 8, radius: 11,
    color: '#ffd166', leak: 1, armor: 0,
  },
  tank: {
    name: 'Tank', hp: 285, speed: 56, reward: 17, radius: 18,
    color: '#ff7d9c', leak: 2, armor: 0.05,
  },
  armor: {
    name: 'Warden', hp: 225, speed: 70, reward: 15, radius: 15,
    color: '#b79bff', leak: 2, armor: 0.4,
  },
  boss: {
    name: 'Leviathan', hp: 1650, speed: 42, reward: 210, radius: 30,
    color: '#ff4d6d', leak: 8, armor: 0.25, slowResist: 0.55,
  },
};

const g = (type, count, gap, start) => ({ type, count, gap, start });

export const WAVES = [
  [g('drone', 8, 0.9, 0.3)],
  [g('drone', 10, 0.8, 0.3), g('runner', 3, 0.6, 4)],
  [g('runner', 12, 0.55, 0.3)],
  [g('drone', 12, 0.7, 0.3), g('tank', 2, 2, 6)],
  [g('tank', 4, 1.6, 0.3), g('drone', 10, 0.5, 3)],
  [g('runner', 16, 0.45, 0.3), g('armor', 2, 2, 6)],
  [g('tank', 5, 1.5, 0.3), g('armor', 4, 1.4, 5)],
  [g('drone', 20, 0.4, 0.3), g('runner', 10, 0.4, 5)],
  [g('armor', 7, 1.1, 0.3), g('tank', 5, 1.3, 6)],
  [g('boss', 1, 1, 0.5), g('drone', 12, 0.6, 2)],
  [g('runner', 22, 0.3, 0.3), g('armor', 5, 1, 6)],
  [g('tank', 7, 1.1, 0.3), g('drone', 16, 0.35, 4)],
  [g('armor', 9, 0.9, 0.3), g('runner', 14, 0.3, 6)],
  [g('tank', 9, 1, 0.3), g('armor', 7, 0.9, 7)],
  [g('runner', 26, 0.25, 0.3), g('tank', 5, 1.2, 6)],
  [g('armor', 11, 0.8, 0.3), g('drone', 22, 0.25, 4)],
  [g('tank', 11, 0.9, 0.3), g('armor', 9, 0.7, 7)],
  [g('runner', 32, 0.22, 0.3), g('armor', 11, 0.7, 7)],
  [g('tank', 13, 0.8, 0.3), g('armor', 13, 0.7, 6), g('drone', 20, 0.25, 10)],
  [g('boss', 2, 4, 0.5), g('tank', 7, 1, 3), g('armor', 9, 0.8, 7)],
];

export const MAX_WAVE = WAVES.length;

export function waveHpMul(wave) {
  const n = wave - 1;
  return 1 + n * 0.16 + n * n * 0.022 + (wave > 20 ? (wave - 20) * 0.12 : 0);
}

export function endlessWave(n) {
  const groups = [
    g('runner', 12 + Math.floor(n * 1.2), 0.22, 0.3),
    g('armor', 4 + Math.floor(n * 0.5), 0.6, 4),
    g('tank', 3 + Math.floor(n * 0.4), 0.8, 7),
  ];
  if (n % 5 === 0) groups.push(g('boss', 1 + Math.floor((n - 20) / 10), 3, 2));
  return groups;
}

export function waveGroups(wave) {
  if (wave <= WAVES.length) return WAVES[wave - 1];
  return endlessWave(wave);
}

export function waveSize(wave) {
  return waveGroups(wave).reduce((sum, grp) => sum + grp.count, 0);
}

export function upgradeCost(tower) {
  const def = TOWERS[tower.type];
  if (tower.level >= def.levels.length - 1) return null;
  return def.upgrades[tower.level];
}

export function sellValue(tower) {
  return Math.floor(tower.spent * 0.7);
}

export const START_GOLD = 300;
export const START_LIVES = 20;
export const PREP_FIRST = 15;
export const PREP_NEXT = 12;
