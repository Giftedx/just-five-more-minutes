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

export const PLAYER_ATTACK_SPRITE: Sprite = {
  palette: {
    h: '#8a5a2b',
    s: '#e0b088',
    e: '#2e2218',
    b: '#3a5a9c',
    d: '#2c4377',
    l: '#5a4632',
    k: '#2e2218',
    w: '#d5d0c2',
    g: '#7a4d28',
  },
  rows: [
    '....hhhh........',
    '...hhhhhh.......',
    '...hssssh.......',
    '...sesse........',
    '....ssss......w.',
    '...bbbbbb....w..',
    '..bbbbbbbb..w...',
    '..sbbddbbs.w....',
    '..sbbddbbsg.....',
    '...bbbbbb.......',
    '...llllll.......',
    '...ll..ll.......',
    '...kk..kk.......',
    '...kk..kk.......',
  ],
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
