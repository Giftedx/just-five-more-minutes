/**
 * Tiny pixel-art sprites described as rows of palette keys.
 * '.' = transparent. Drawn with fillRect only — no image assets.
 */

export type Sprite = { rows: readonly string[]; palette: Readonly<Record<string, string>> };

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  px: number,
  py: number,
): void {
  for (let y = 0; y < sprite.rows.length; y++) {
    const row = sprite.rows[y];
    if (!row) continue;
    for (let x = 0; x < row.length; x++) {
      const ch = row.charAt(x);
      if (ch === '.') continue;
      const color = sprite.palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

export const PLAYER_SPRITE: Sprite = {
  palette: {
    h: '#8a5a2b', // hair
    s: '#e0b088', // skin
    e: '#2e2218', // eyes
    b: '#3a5a9c', // tunic
    d: '#2c4377', // tunic shade
    l: '#5a4632', // legs
    k: '#2e2218', // boots
  },
  rows: [
    '....hhhh....',
    '...hhhhhh...',
    '...hssssh...',
    '...sesse....',
    '....ssss....',
    '...bbbbbb...',
    '..bbbbbbbb..',
    '..sbbddbbs..',
    '..sbbddbbs..',
    '...bbbbbb...',
    '...llllll...',
    '...ll..ll...',
    '...kk..kk...',
    '...kk..kk...',
  ],
};

export type AttackDirection = 'north' | 'east' | 'south' | 'west';

export function attackDirectionForDelta(dx: number, dy: number): AttackDirection | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'west' : 'east';
  return dy < 0 ? 'north' : 'south';
}

const PLAYER_ATTACK_PALETTE: Sprite['palette'] = {
  ...PLAYER_SPRITE.palette,
  w: '#d5d0c2',
  g: '#7a4d28',
};

type WeaponPixel = readonly [x: number, y: number, key: 'w' | 'g'];

const ATTACK_WEAPON_PIXELS: Readonly<Record<AttackDirection, readonly WeaponPixel[]>> = {
  north: [[12, 3, 'w'], [12, 4, 'w'], [12, 5, 'w'], [12, 6, 'w'], [12, 7, 'g']],
  east: [[15, 4, 'w'], [14, 5, 'w'], [13, 6, 'w'], [12, 7, 'w'], [12, 8, 'g']],
  south: [[12, 8, 'g'], [12, 9, 'w'], [12, 10, 'w'], [12, 11, 'w'], [12, 12, 'w']],
  west: [[0, 4, 'w'], [1, 5, 'w'], [2, 6, 'w'], [3, 7, 'w'], [3, 8, 'g']],
};

function makePlayerAttackSprite(weapon: readonly WeaponPixel[]): Sprite {
  const rows = PLAYER_SPRITE.rows.map((row) => [...`..${row}..`]);
  for (const [x, y, key] of weapon) {
    const row = rows[y];
    if (!row || row[x] !== '.') throw new Error(`attack weapon overlaps body at ${x},${y}`);
    row[x] = key;
  }
  return { palette: PLAYER_ATTACK_PALETTE, rows: rows.map((row) => row.join('')) };
}

export const PLAYER_ATTACK_SPRITES: Readonly<Record<AttackDirection, Sprite>> = {
  north: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.north),
  east: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.east),
  south: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.south),
  west: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.west),
};

export const GOBLIN_SPRITE: Sprite = {
  palette: {
    g: '#5f8f3e', // skin
    e: '#456b2c', // skin shade / ears
    r: '#b03030', // loincloth
    y: '#e8d44f', // eyes
    k: '#222222',
  },
  rows: [
    '.e........e.',
    'ee.gggggg.ee',
    '.egggggggge.',
    '..gygggygg..',
    '..gkgggkgg..',
    '..gggggggg..',
    '...gggggg...',
    '...gggggg...',
    '..g.rrrr.g..',
    '....rrrr....',
    '....g..g....',
    '....g..g....',
    '...ee..ee...',
    '............',
  ],
};

export const GOBLIN_ANGRY_SPRITE: Sprite = {
  ...GOBLIN_SPRITE,
  palette: { ...GOBLIN_SPRITE.palette, y: '#ff6040' },
};

export const HOB_SPRITE: Sprite = {
  palette: {
    g: '#a8703c',
    e: '#7a4e26',
    r: '#5a3a7a',
    y: '#e8d44f',
    k: '#2a2018',
    a: '#5b5360',
    t: '#e6d9b8',
  },
  rows: [
    '.a........a.',
    'aa.gggggg.aa',
    '.aeggggggea.',
    '..gygggygg..',
    '..gtgggtgg..',
    '..gggkkggg..',
    '..aaggggaa..',
    '.aaaggggaaa.',
    '..a.rrrr.a..',
    '....rrrr....',
    '....g..g....',
    '...gg..gg...',
    '...aa..aa...',
    '............',
  ],
};

export const HOB_ANGRY_SPRITE: Sprite = {
  ...HOB_SPRITE,
  palette: { ...HOB_SPRITE.palette, y: '#ff6040' },
};

export const HP_FULL_SPRITE: Sprite = {
  palette: { r: '#c03030', l: '#e87a7a', d: '#7a2020' },
  rows: [
    '.rr.rr.',
    'lrrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
    '...d...',
  ],
};

export const HP_EMPTY_SPRITE: Sprite = {
  palette: { e: '#705848', d: '#4a3a26' },
  rows: [
    '.ee.ee.',
    'eeeeeee',
    'eeeeeee',
    '.eeeee.',
    '..eee..',
    '...e...',
    '...d...',
  ],
};

export const TRADER_SPRITE: Sprite = {
  palette: {
    h: '#d8d8d8', // hood
    s: '#caa37a', // skin
    e: '#3b2a1f', // eyes
    r: '#7a3b8f', // robe
    d: '#5b2c6b', // robe shade
    g: '#e8c33f', // coin trim
  },
  rows: [
    '....hhhh....',
    '...hhhhhh...',
    '...hssssh...',
    '...sesse....',
    '....ssss....',
    '...rrrrrr...',
    '..rrrrrrrr..',
    '..rrdggdrr..',
    '..rrrrrrrr..',
    '..rrrrrrrr..',
    '...rrrrrr...',
    '...rrrrrr...',
    '...dd..dd...',
    '............',
  ],
};
