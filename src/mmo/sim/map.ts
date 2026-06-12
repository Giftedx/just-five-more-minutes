import type { Point } from './types';

export const MAP_W = 20;
export const MAP_H = 15;
export const TILE = 16;

/**
 * Legend:
 *   '#' border tree (blocked)   '.' grass        'T' choppable tree
 *   'Y' Trader Wyn              'f' flax         'F' fence
 *   '+' pen gateway (walkable)  'c' campfire     'b' bread table
 *   'g' goblin spawn (walkable)
 */
export const MAP_ROWS: readonly string[] = [
  '####################',
  '#..................#',
  '#....T....T........#',
  '#.Y..........T.....#',
  '#..................#',
  '#.......T..........#',
  '#..................#',
  '#..ff.......FFFFFF.#',
  '#..ff.......F....F.#',
  '#..ff.......F.g..F.#',
  '#...........+..g.F.#',
  '#...........F...gF.#',
  '#..c........FFFFFF.#',
  '#..b...............#',
  '####################',
];

export function tileChar(x: number, y: number): string {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return '#';
  return MAP_ROWS[y]?.charAt(x) ?? '#';
}

const STATIC_BLOCKED = new Set(['#', 'Y', 'f', 'F', 'c', 'b']);

/** Blocked by static terrain (trees handled separately because they regrow). */
export function staticBlocked(x: number, y: number): boolean {
  return STATIC_BLOCKED.has(tileChar(x, y));
}

export function isTreeTile(x: number, y: number): boolean {
  return tileChar(x, y) === 'T';
}

export function findTiles(ch: string): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (tileChar(x, y) === ch) out.push({ x, y });
    }
  }
  return out;
}

export const TREE_TILES: readonly Point[] = findTiles('T');
export const FLAX_TILES: readonly Point[] = findTiles('f');
export const GOBLIN_SPAWNS: readonly Point[] = findTiles('g');
export const TRADER_TILE: Point = findTiles('Y')[0] ?? { x: 2, y: 3 };
export const CAMPFIRE_TILE: Point = findTiles('c')[0] ?? { x: 3, y: 12 };
export const BREAD_TILE: Point = findTiles('b')[0] ?? { x: 3, y: 13 };

/** Player respawn point, beside the campfire. */
export const SPAWN_TILE: Point = { x: 4, y: 12 };

export const EXAMINE_TEXTS = {
  goblin: 'It has a five-year plan.',
  tree: 'Contains wood, allegedly.',
  stump: 'Past tense tree.',
  flax: "The economy's favourite weed.",
  trader: "He's seen your spreadsheet. He's not impressed.",
  bread: 'Free healthcare.',
  campfire: 'Respawn-flavoured warmth.',
  fence: 'Goblin containment infrastructure. Mostly decorative.',
  ground: 'Dirt. Premium dirt.',
} as const;
