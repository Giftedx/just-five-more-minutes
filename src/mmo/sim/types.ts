export interface Point {
  x: number;
  y: number;
}

export type ItemKind = 'log' | 'flax';

export type SkillName = 'woodcutting' | 'attack' | 'foraging';

export type QuestKind = 'logs' | 'flax' | 'goblins';

export interface Quest {
  kind: QuestKind;
  target: number;
  progress: number;
  reward: number;
  /** True once the player has claimed the reward at the trader. */
  claimed: boolean;
}

export interface Skills {
  woodcutting: number;
  attack: number;
  foraging: number;
}

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
  skills: Skills;
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
  | { type: 'goblinDied'; goblinId: string; coins: number; streakBonus: number }
  | { type: 'playerDied'; coinsLost: number; whileAway: boolean }
  | { type: 'chop' }
  | { type: 'log' }
  | { type: 'flax' }
  | { type: 'eat' }
  | { type: 'trade'; sold: number; gained: number; item: ItemKind }
  | { type: 'openTrade' }
  | { type: 'invFull' }
  | { type: 'objectiveHit' }
  | { type: 'levelUp'; skill: SkillName; level: number }
  | { type: 'questProgress'; kind: QuestKind; progress: number; target: number }
  | { type: 'questReady' }
  | { type: 'questComplete'; reward: number; kind: QuestKind }
  | { type: 'questAssigned'; kind: QuestKind; target: number; reward: number };

export interface SimStats {
  deaths: number;
  deathsWhileAway: number;
  kills: number;
  logsSold: number;
  flaxSold: number;
  objectiveHit: boolean;
  /** Consecutive goblin kills without dying — drives bonus coin drops. */
  killStreak: number;
  /** Best streak this session. */
  bestStreak: number;
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
  | { kind: 'sign'; pos: Point }
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
