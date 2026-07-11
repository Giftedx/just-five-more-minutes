export interface Point {
  x: number;
  y: number;
}

export type ItemKind = 'log' | 'flax' | 'oakLog' | 'shrimpRaw' | 'shrimpCooked' | 'shrimpBurnt' | 'bread';

export type SkillName = 'woodcutting' | 'attack' | 'foraging' | 'fishing';

export type QuestKind = 'logs' | 'flax' | 'goblins' | 'shrimp' | 'oakLogs' | 'hobgoblins';

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
  fishing: number;
}

export type GoblinTier = 'goblin' | 'hobgoblin';

export interface Goblin {
  id: string;
  tier: GoblinTier;
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

export type TreeKind = 'normal' | 'oak';

export interface Tree {
  id: string;
  kind: TreeKind;
  pos: Point;
  chopped: boolean;
  regrowTick: number;
}

/** Standing orders executed while the player is away from the keyboard. */
export interface AwayPlan {
  keepWorking: boolean;
  eatBread: boolean;
  runHome: boolean;
  autoSell: boolean;
}

export interface Gravestone {
  pos: Point;
  items: ItemKind[];
  expiresAtTick: number;
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
  | { kind: 'eat' }
  | { kind: 'fish'; pos: Point }
  | { kind: 'cook' }
  | { kind: 'cross' }
  | { kind: 'reclaim' };

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
  | { type: 'allSkills99' }
  | { type: 'levelUp'; skill: SkillName; level: number }
  | { type: 'questProgress'; kind: QuestKind; progress: number; target: number }
  | { type: 'questReady' }
  | { type: 'questComplete'; reward: number; kind: QuestKind }
  | { type: 'questAssigned'; kind: QuestKind; target: number; reward: number }
  | { type: 'fishCaught' }
  | { type: 'shrimpCooked' }
  | { type: 'shrimpBurnt' }
  | { type: 'levelTooLow'; skill: SkillName; need: number }
  | { type: 'tooPoor'; need: number }
  | { type: 'tollPaid'; cost: number }
  | { type: 'gravestoneCreated'; itemCount: number }
  | { type: 'gravestoneReclaimed'; itemCount: number }
  | { type: 'gravestoneLost'; itemCount: number }
  | { type: 'breadBought'; cost: number }
  | { type: 'loggedOut' }
  | { type: 'loggedIn' }
  | { type: 'milestone'; id: MilestoneId };

/**
 * The felt-progress ladder between "logged in" and the absurd stretch goals.
 * All are session-scoped (earned tonight) except tollPaid, which fires on the
 * one session the toll is actually paid — the pass itself persists.
 */
export type MilestoneId =
  | 'firstBlood'
  | 'pocketMoney'
  | 'twoDinnersAhead'
  | 'dinnerFund'
  | 'theThousandaire'
  | 'contractor'
  | 'levelFive'
  | 'tollPaid'
  | 'bullyTheBully'
  | 'undertaker'
  | 'chefActually';

export interface SimStats {
  deaths: number;
  deathsWhileAway: number;
  kills: number;
  /** Hobgoblin kills (subset of kills). */
  hobKills: number;
  logsSold: number;
  flaxSold: number;
  oakLogsSold: number;
  shrimpSold: number;
  /** Coins earned this session (deaths do not subtract). */
  coinsEarned: number;
  shrimpCookedCount: number;
  shrimpBurntCount: number;
  /** Three consecutive burns happened at some point this session. */
  shrimpBurnt3: boolean;
  objectiveHit: boolean;
  /** All trainable stats hit 99 (OSRS bonus goal). */
  statsBonusHit: boolean;
  /** Consecutive goblin kills without dying — drives bonus coin drops. */
  killStreak: number;
  /** Best streak this session. */
  bestStreak: number;
  contractsCompleted: number;
  /** A second death replaced an unreclaimed gravestone. */
  doubleBereavement: boolean;
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
  | { kind: 'water'; pos: Point }
  | { kind: 'bridge'; pos: Point }
  | { kind: 'toll'; pos: Point }
  | { kind: 'fishingSpot'; pos: Point }
  | { kind: 'gravestone'; pos: Point }
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
