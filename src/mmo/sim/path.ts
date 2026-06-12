import type { Point } from './types';
import { MAP_H, MAP_W } from './map';

/**
 * BFS shortest path on a walkable predicate (4-directional).
 * Returns the steps to walk, excluding `from`, including `to`.
 * Returns null when unreachable.
 */
export function bfsPath(
  from: Point,
  to: Point,
  walkable: (x: number, y: number) => boolean,
): Point[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  if (!walkable(to.x, to.y)) return null;

  const key = (x: number, y: number) => y * MAP_W + x;
  const prev = new Map<number, number>();
  const visited = new Uint8Array(MAP_W * MAP_H);
  visited[key(from.x, from.y)] = 1;
  let frontier: Point[] = [from];

  const dirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  while (frontier.length > 0) {
    const next: Point[] = [];
    for (const cur of frontier) {
      for (const d of dirs) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const k = key(nx, ny);
        if (visited[k]) continue;
        if (!walkable(nx, ny)) continue;
        visited[k] = 1;
        prev.set(k, key(cur.x, cur.y));
        if (nx === to.x && ny === to.y) {
          const path: Point[] = [{ x: nx, y: ny }];
          let pk = prev.get(k);
          while (pk !== undefined && pk !== key(from.x, from.y)) {
            path.push({ x: pk % MAP_W, y: Math.floor(pk / MAP_W) });
            pk = prev.get(pk);
          }
          path.reverse();
          return path;
        }
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  return null;
}

/** Chebyshev distance — adjacency for melee/interactions (diagonals count). */
export function chebyshev(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function adjacent(a: Point, b: Point): boolean {
  return chebyshev(a, b) === 1;
}

/**
 * Nearest walkable tile orthogonally adjacent to `target`, by BFS distance
 * from `from`. Returns null when none reachable.
 */
export function nearestApproach(
  from: Point,
  target: Point,
  walkable: (x: number, y: number) => boolean,
): Point | null {
  const candidates: Point[] = [
    { x: target.x, y: target.y - 1 },
    { x: target.x, y: target.y + 1 },
    { x: target.x - 1, y: target.y },
    { x: target.x + 1, y: target.y },
  ].filter((p) => walkable(p.x, p.y));
  let best: Point | null = null;
  let bestLen = Infinity;
  for (const c of candidates) {
    if (c.x === from.x && c.y === from.y) return c;
    const p = bfsPath(from, c, walkable);
    if (p && p.length < bestLen) {
      bestLen = p.length;
      best = c;
    }
  }
  return best;
}
