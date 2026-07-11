import type { Point } from './types';

export const MAP_W = 32;
export const MAP_H = 15;
export const TILE = 16;

/**
 * Legend:
 *   '#' border tree (blocked)   '.' grass        'T' choppable tree
 *   'Y' Trader Wyn              'f' flax         'F' fence
 *   '+' pen gateway (walkable)  'c' campfire     'b' bread table
 *   's' signpost (walkable)     'g' goblin spawn (walkable)
 *   'w' river water (blocked)   'B' bridge (walkable with pass)
 *   'l' toll sign (walkable)    'p' fishing spot (blocked, fish adjacent)
 *   'O' oak tree                'h' hobgoblin spawn (walkable)
 *
 * Columns 0..19 are the original west side — coordinates there are load-bearing
 * (tests, spawn points) and must not move. Column 19 opens at rows 2..6 toward
 * the river; everything east of x=22 is the far bank.
 */
export const MAP_ROWS: readonly string[] = [
  '################################',
  '#..................#..w........#',
  '#....T....T...........w..O.....#',
  '#.Y..........T........w....O...#',
  '#....................lB....h...#',
  '#.......T.............w........#',
  '#.....................w..O.....#',
  '#..ff.......FFFFFF.#..w....h...#',
  '#..ff..s....F....F.#..p........#',
  '#..ff.......F.g..F.#..w........#',
  '#...........+..g.F.#..w........#',
  '#...........F...gF.#..w........#',
  '#..c........FFFFFF.#..w........#',
  '#..b...............#..w........#',
  '################################',
];

export function tileChar(x: number, y: number): string {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return '#';
  return MAP_ROWS[y]?.charAt(x) ?? '#';
}

const STATIC_BLOCKED = new Set(['#', 'Y', 'f', 'F', 'c', 'b', 'w', 'p']);

/** Blocked by static terrain (trees and the bridge are handled by the sim). */
export function staticBlocked(x: number, y: number): boolean {
  return STATIC_BLOCKED.has(tileChar(x, y));
}

export function isTreeTile(x: number, y: number): boolean {
  const ch = tileChar(x, y);
  return ch === 'T' || ch === 'O';
}

export function isBridgeTile(x: number, y: number): boolean {
  return tileChar(x, y) === 'B';
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
export const OAK_TILES: readonly Point[] = findTiles('O');
export const FLAX_TILES: readonly Point[] = findTiles('f');
export const GOBLIN_SPAWNS: readonly Point[] = findTiles('g');
export const HOBGOBLIN_SPAWNS: readonly Point[] = findTiles('h');
export const TRADER_TILE: Point = findTiles('Y')[0] ?? { x: 2, y: 3 };
export const CAMPFIRE_TILE: Point = findTiles('c')[0] ?? { x: 3, y: 12 };
export const BREAD_TILE: Point = findTiles('b')[0] ?? { x: 3, y: 13 };
export const BRIDGE_TILE: Point = findTiles('B')[0] ?? { x: 22, y: 4 };
export const FISHING_TILE: Point = findTiles('p')[0] ?? { x: 22, y: 8 };

/** Player respawn point, beside the campfire. */
export const SPAWN_TILE: Point = { x: 4, y: 12 };

/** First walkable tile on the far side of the bridge. */
export const BRIDGE_EAST_TILE: Point = { x: BRIDGE_TILE.x + 1, y: BRIDGE_TILE.y };
/** Bridge head on the near side, where the toll is paid. */
export const BRIDGE_WEST_TILE: Point = { x: BRIDGE_TILE.x - 1, y: BRIDGE_TILE.y };

export const EXAMINE_TEXTS = {
  goblin: 'It has a five-year plan. And poor impulse control.',
  hobgoblin: 'Like a goblin, but with ambition and a gym membership.',
  tree: 'Contains wood, allegedly. The economy runs on allegedly.',
  oak: 'Premium wood, allegedly. The allegations are fifteen gold strong.',
  stump: 'Past tense tree. Give it eight ticks.',
  flax: "The economy's favourite weed. Wyn pays 2gp. Inflation is a myth.",
  trader: "He's seen your spreadsheet. He's not impressed. He'll still buy your logs.",
  bread: 'Free healthcare. Mum would call this enabling.',
  campfire: 'Respawn-flavoured warmth. Smells like hope and old socks.',
  sign: 'GOBLIN PEN — enter at own risk. Management accepts no liability.',
  fence: 'Goblin containment infrastructure. Mostly decorative. Mostly.',
  water: 'The River Mud. Somehow both shallow and unknowable.',
  bridge: 'Sturdy enough. The planks only scream a little.',
  toll: "BRIDGE TOLL: 10gp. The troll under this bridge unionised in '02.",
  fishingSpot: 'Shrimp congregate here to discuss their futures. Briefly.',
  gravestone: 'Here lies your stuff. It misses you. Sixty seconds, tops.',
  ground: 'Dirt. Premium dirt. Some say the real Mudwick was the dirt we walked on.',
} as const;
