export interface Point {
  x: number;
  y: number;
}

export type ItemKind = 'log' | 'flax';

export interface Goblin {
  id: string;
  /** Home spawn tile. */
  home: Point;
  pos: Point;
  hp: number;
  alive: boolean;
  /** Tick at which a dead goblin respawns. */
  respawnTick: number;
  aggro: boolean;
  /** Whose swing lands next while this goblin is in melee with the player. */
  nextAttacker: 'player' | 'goblin';
}

export interface Tree {
  id: string;
  pos: Point;
  chopped: boolean;
  regrowTick: number;
}

export interface PlayerState {
  pos: Point;
  hp: number;
  maxHp: number;
  coins: number;
  inventory: ItemKind[];
  /** Remaining tiles to walk, first entry is the next step. */
  path: Point[];
  intent: Intent | null;
}

export type Intent =
  | { kind: 'attack'; goblinId: string }
  | { kind: 'chop'; treeId: string }
  | { kind: 'pick'; pos: Point }
  | { kind: 'trade' }
  | { kind: 'eat' };

export type SimEvent =
  | { type: 'playerSwing'; damage: number; goblinId: string }
  | { type: 'goblinSwing'; damage: number; goblinId: string }
  | { type: 'goblinDied'; goblinId: string; coins: number }
  | { type: 'playerDied'; coinsLost: number; whileAway: boolean }
  | { type: 'chop' }
  | { type: 'log' }
  | { type: 'flax' }
  | { type: 'eat' }
  | { type: 'trade'; sold: number; gained: number; item: ItemKind }
  | { type: 'openTrade' }
  | { type: 'invFull' }
  | { type: 'objectiveHit' };

export interface SimStats {
  deaths: number;
  deathsWhileAway: number;
  kills: number;
  logsSold: number;
  flaxSold: number;
  objectiveHit: boolean;
}

/** What a tile resolves to for clicks / hover / context menus. */
export type TileThing =
  | { kind: 'goblin'; goblin: Goblin }
  | { kind: 'tree'; tree: Tree }
  | { kind: 'stump'; tree: Tree }
  | { kind: 'flax'; pos: Point }
  | { kind: 'trader'; pos: Point }
  | { kind: 'bread'; pos: Point }
  | { kind: 'campfire'; pos: Point }
  | { kind: 'fence'; pos: Point }
  | { kind: 'ground'; pos: Point };

export interface MenuOption {
  /** Shown in hover text / context menu, e.g. "Attack Goblin". */
  label: string;
  /** What invoking the option does. */
  act:
    | { kind: 'walk'; to: Point }
    | { kind: 'intent'; intent: Intent; approach: Point }
    | { kind: 'examine'; text: string }
    | { kind: 'none' };
}
