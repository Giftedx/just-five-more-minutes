/**
 * The School Week: five data-driven weeknights over one untouched director.
 * The director keeps its three abstract chore slots (mugs/wrappers/laundry
 * are SLOT ids with locked timing); each night maps those slots onto
 * physical chores and supplies the evening's script. Pure: no DOM, no timers.
 */
import type { ChoreId, LineId } from './director';

export type ChoreVerb = 'carry' | 'tug';

/** A physical chore as the room stages it. */
export interface PhysicalChore {
  /** Room identity: which prop set this uses. */
  id: 'mugs' | 'wrappers' | 'laundry' | 'bed' | 'curtains';
  verb: ChoreVerb;
  /** HUD noun, e.g. "the mugs". */
  label: string;
  /** How many carries / tug points complete it. */
  count: number;
}

export interface NightBeats {
  /** Mum takes Auntie Carol's call: the modem dies for this window. */
  phone?: { at: number; until: number };
  /** The knock: fires if suspicion has crossed the threshold by `at`. */
  inspection?: { at: number; minSuspicion: number };
  /** Mudwick double-XP evening (torture timing). */
  doubleXp?: boolean;
}

export type BarkTrigger =
  | 'choreDone'
  | 'lampOn'
  | 'phoneForeshadow'
  | 'modemReturn'
  | 'postWarnClicking'
  | 'inspectionDefused'
  | 'inspectionFailed';

/** [calm tier, onto-you tier] — scheduler picks by Mum's current mood. */
export type BarkPack = Partial<Record<BarkTrigger, [string, string]>>;

export interface NightLine {
  base: string;
  /** Variant once she's onto you (tier >= 2). */
  tier2: string;
}

export interface NightSpec {
  night: 0 | 1 | 2 | 3 | 4;
  title: string;
  card: string;
  slots: Record<ChoreId, PhysicalChore>;
  beats: NightBeats;
  lines: Record<LineId, NightLine>;
  barks: BarkPack;
}

const MUGS: PhysicalChore = { id: 'mugs', verb: 'carry', label: 'the mugs', count: 3 };
const WRAPPERS: PhysicalChore = { id: 'wrappers', verb: 'carry', label: 'the wrappers', count: 4 };
const WRAPPERS_FRIDAY: PhysicalChore = { id: 'wrappers', verb: 'carry', label: 'the wrappers', count: 5 };
const LAUNDRY: PhysicalChore = { id: 'laundry', verb: 'carry', label: 'the laundry', count: 3 };
const BED: PhysicalChore = { id: 'bed', verb: 'tug', label: 'the bed', count: 2 };
const CURTAINS: PhysicalChore = { id: 'curtains', verb: 'tug', label: 'the curtains', count: 2 };

const SHARED_BARKS: BarkPack = {
  choreDone: [
    'Thank you! See, that took eleven seconds.',
    'Thank you. Noted. Filed. Remembered.',
  ],
  lampOn: [
    "And turn a light on, you'll ruin your eyes.",
    "The dark isn't hiding the clicking, love.",
  ],
  postWarnClicking: [
    'I can hear you clicking.',
    'The clicking has been noted for the record.',
  ],
  inspectionDefused: [
    "Oh — homework. Well. Good. Carry on, I suppose.",
    "Homework. At speed. With sound effects. Fine.",
  ],
  inspectionFailed: [
    "Right. So that's what we're calling homework now.",
    'I stood here. We both know what I saw.',
  ],
};

export const NIGHTS: readonly NightSpec[] = [
  {
    night: 0,
    title: 'Casserole',
    card: 'MONDAY — Casserole',
    slots: { mugs: MUGS, wrappers: WRAPPERS, laundry: LAUNDRY },
    beats: {},
    lines: {
      intro: {
        base: "Dinner's in about five minutes. Give your room a quick tidy if you get a second.",
        tier2: "Dinner's in five minutes. The room, love. We've discussed the room.",
      },
      mugs: {
        base: 'Could you move those mugs before one of them starts paying rent?',
        tier2: "The mugs, love. I know you heard me. The door isn't that thick.",
      },
      wrappers: {
        base: 'Is the bin full, or are the wrappers just choosing not to participate?',
        tier2: 'Wrappers. Bin. I can smell the crisps from the landing.',
      },
      laundry: {
        base: "Laundry in the basket. I'm not asking you to defeat it, just contain it.",
        tier2: 'The laundry has achieved structure. Deal with it before it votes.',
      },
      warn: {
        base: "Dinner's ready in one minute. Save your goblin spreadsheet.",
        tier2: 'One minute. The casserole waits for no goblin.',
      },
      inspect: {
        base: 'What exactly is happening in here?',
        tier2: 'What exactly is happening in here?',
      },
    },
    barks: SHARED_BARKS,
  },
  {
    night: 1,
    title: 'Bins Night',
    card: 'TUESDAY — Bins Night',
    slots: { mugs: MUGS, wrappers: BED, laundry: WRAPPERS },
    beats: {},
    lines: {
      intro: {
        base: "Bins go out tonight. Also, yesterday's report card is on the fridge. We'll say no more.",
        tier2: 'Bins night. And after yesterday, consider this a fresh start with supervision.',
      },
      mugs: {
        base: 'Mugs again, love. They migrate. I don\'t know how. Bring them down.',
        tier2: 'The mugs are back. We both know this is a lifestyle now.',
      },
      wrappers: {
        base: 'Could you actually make the bed? It looks like it lost an argument.',
        tier2: 'The bed, love. It\'s been "airing" since Saturday.',
      },
      laundry: {
        base: "Wrappers in the bin before it goes out, please. All of them. Yes, even under the desk.",
        tier2: 'The bin lorry comes at seven. The wrappers go tonight, one way or another.',
      },
      warn: {
        base: 'One minute! And if you hear the bin lorry early, that\'s between you and your conscience.',
        tier2: 'One minute. The bins are out. You could learn from the bins.',
      },
      inspect: {
        base: 'What exactly is happening in here?',
        tier2: 'What exactly is happening in here?',
      },
    },
    barks: SHARED_BARKS,
  },
  {
    night: 2,
    title: 'Auntie Carol',
    card: 'WEDNESDAY — Auntie Carol',
    slots: { mugs: MUGS, wrappers: LAUNDRY, laundry: BED },
    beats: { phone: { at: 125, until: 155 } },
    lines: {
      intro: {
        base: "If the phone rings tonight it's Auntie Carol, and I am taking it. Plan accordingly.",
        tier2: "Auntie Carol is calling tonight. The phone line is mine. Whatever you're doing on there can cope.",
      },
      mugs: {
        base: 'Mugs down before the call, please — I am not narrating your crockery to Carol.',
        tier2: 'Bring the mugs down now, before Carol hears me ask twice.',
      },
      wrappers: {
        base: 'Laundry in the basket while you\'re up. It\'s becoming load-bearing.',
        tier2: 'The laundry, love. Carol asked how you were. I said "buried".',
      },
      laundry: {
        base: 'And straighten that bed — if Carol video-calls one day I want plausible deniability.',
        tier2: 'The bed. Now. I describe this house to people, you know.',
      },
      warn: {
        base: "One minute! Carol says hello, by the way. I said you were studying. Don't make me a liar.",
        tier2: 'One minute. I told Carol you were thriving. Evidence would help.',
      },
      inspect: {
        base: 'What exactly is happening in here?',
        tier2: 'What exactly is happening in here?',
      },
    },
    barks: {
      ...SHARED_BARKS,
      phoneForeshadow: [
        "That'll be Auntie Carol — off the internet, please!",
        'Phone! Carol! Off! Now!',
      ],
      modemReturn: [
        'Was that the computer screaming or you?',
        'The screaming box is yours again. Wonderful.',
      ],
    },
  },
  {
    night: 3,
    title: 'Inspection',
    card: 'THURSDAY — Inspection',
    slots: { mugs: WRAPPERS, wrappers: CURTAINS, laundry: LAUNDRY },
    beats: { inspection: { at: 180, minSuspicion: 6 } },
    lines: {
      intro: {
        base: "It's Thursday. I've noticed things. Tonight I'd like to un-notice them, together.",
        tier2: "It's Thursday. I have a list. It's laminated.",
      },
      mugs: {
        base: 'Wrappers first — including the ones under the bed. Yes, I know about those.',
        tier2: 'The under-bed wrappers, love. I hoovered around them out of respect. Once.',
      },
      wrappers: {
        base: 'Open those curtains! It looks like a burrow in there. A burrow with a modem.',
        tier2: 'Curtains. Open. Daylight is not your enemy, whatever the goblins say.',
      },
      laundry: {
        base: 'Laundry in the basket, please. The pile has a silhouette now.',
        tier2: 'The laundry. I saw it move. We move it first.',
      },
      warn: {
        base: 'One minute! And I may pop my head in, so let\'s all be doing what we claim to be doing.',
        tier2: 'One minute. Consider everything from here an open-book exam.',
      },
      inspect: {
        base: 'What exactly is happening in here?',
        tier2: 'What exactly is happening in here?',
      },
    },
    barks: SHARED_BARKS,
  },
  {
    night: 4,
    title: 'The Hendersons',
    card: 'FRIDAY — The Hendersons',
    slots: { mugs: MUGS, wrappers: WRAPPERS_FRIDAY, laundry: LAUNDRY },
    beats: { inspection: { at: 180, minSuspicion: 6 }, doubleXp: true },
    lines: {
      intro: {
        base: 'The Hendersons are here at seven. Whole room, best behaviour, and I mean the computer too.',
        tier2: 'The Hendersons. Seven o\'clock. If this room embarrasses me, the modem sleeps in the shed.',
      },
      mugs: {
        base: 'Mugs down — Janet Henderson counts them. She says she doesn\'t. She counts them.',
        tier2: 'Mugs. Down. Janet is bringing her own coasters. It\'s a statement.',
      },
      wrappers: {
        base: 'Every wrapper, love. All five food groups are represented on that floor.',
        tier2: 'The wrappers. All of them. I am not explaining the floor to Derek Henderson.',
      },
      laundry: {
        base: 'Laundry away, and quickly — I need the basket for the good towels.',
        tier2: 'Laundry. Basket. The good towels are waiting and they outrank you.',
      },
      warn: {
        base: "One minute! They're pulling into the drive. Save the goblins. SAVE THE GOBLINS FASTER.",
        tier2: 'One minute. The doorbell is about to outrank both of us.',
      },
      inspect: {
        base: 'What exactly is happening in here?',
        tier2: 'What exactly is happening in here?',
      },
    },
    barks: {
      ...SHARED_BARKS,
      postWarnClicking: [
        'I can hear clicking and the Hendersons can hear clicking.',
        'Derek asked what the clicking was. I said plumbing. Fix the plumbing.',
      ],
    },
  },
];

export function nightSpec(night: number): NightSpec {
  const spec = NIGHTS[Math.max(0, Math.min(4, night))];
  if (!spec) throw new Error('unreachable: NIGHTS covers 0..4');
  return spec;
}

// ----- Mum -----------------------------------------------------------------

/** Prompt-answer facts the host later folds into SessionData. */
export interface SessionFactFlags {
  technicallyTrue: boolean;
  evidenceBased: boolean;
  archivist: boolean;
}

export interface PromptContext {
  /** Sim reports live combat at the moment of the answer. */
  inCombat: boolean;
  /** A trade happened within the last 20 game-seconds. */
  tradedRecently: boolean;
  /** Career: "historical preservation" already used this week. */
  usedArchivistThisWeek: boolean;
}

export interface PromptJudgement {
  /** "One sec!" bought time: push the next chore back this many seconds. */
  graceExtendSeconds: number;
  facts: Partial<SessionFactFlags>;
  lieDebtDelta: number;
  /** The archivist line was spent this week (persist to career). */
  archivistSpent: boolean;
}

export const SUSPICION_MAX = 10;
export const ONE_SEC_GRACE = 15;
export const INSPECTION_DEFUSE_DELTA = -3;
export const INSPECTION_FAIL_DELTA = 2;

export type MumTier = 0 | 1 | 2 | 3;

export const MUM_TIER_LABELS: readonly string[] = ['unbothered', 'curious', 'onto you', 'at the door'];

/**
 * Mum's evening mood: pure arithmetic over the spec table. The host feeds it
 * prompt closures and chore completions; it answers with suspicion, tier,
 * grace extensions, and comedy-fact flags.
 */
export class MumState {
  suspicion: number;
  lieDebt = 0;
  private usedOptionsTonight = new Set<number>();

  constructor(carry = 0) {
    this.suspicion = clampSuspicion(carry);
  }

  get tier(): MumTier {
    if (this.suspicion <= 2) return 0;
    if (this.suspicion <= 5) return 1;
    if (this.suspicion <= 8) return 2;
    return 3;
  }

  onPromptClosed(
    result: 'answered' | 'ignored',
    option: number | null,
    ctx: PromptContext,
  ): PromptJudgement {
    const judgement: PromptJudgement = {
      graceExtendSeconds: 0,
      facts: {},
      lieDebtDelta: 0,
      archivistSpent: false,
    };

    if (result === 'ignored') {
      this.bump(2);
      return judgement;
    }
    if (option === null) return judgement;

    if (this.usedOptionsTonight.has(option)) {
      this.bump(1); // she has heard this one tonight already
    }
    this.usedOptionsTonight.add(option);

    switch (option) {
      case 1: // "One sec!" — a lie with a receipt
        this.bump(1);
        judgement.lieDebtDelta = 1;
        judgement.graceExtendSeconds = ONE_SEC_GRACE;
        break;
      case 2: // "I'm in combat!" — horribly honest
        this.bump(-1);
        if (ctx.inCombat) judgement.facts.technicallyTrue = true;
        break;
      case 3: // "The economy needs me!"
        if (ctx.tradedRecently) judgement.facts.evidenceBased = true;
        else this.bump(1);
        break;
      case 4: // "It's basically historical preservation!"
        if (!ctx.usedArchivistThisWeek) {
          judgement.facts.archivist = true;
          judgement.archivistSpent = true;
        } else {
          this.bump(1);
        }
        break;
      default:
        break;
    }
    return judgement;
  }

  onChoreCompleted(): void {
    this.bump(-2);
  }

  onInspection(defused: boolean): void {
    this.bump(defused ? INSPECTION_DEFUSE_DELTA : INSPECTION_FAIL_DELTA);
  }

  private bump(delta: number): void {
    this.suspicion = clampSuspicion(this.suspicion + delta);
  }
}

function clampSuspicion(value: number): number {
  return Math.max(0, Math.min(SUSPICION_MAX, value));
}

// ----- Barks ----------------------------------------------------------------

export const BARK_COOLDOWN = 12;

/**
 * Ambient Mum lines: below prompts in the dialogue stack, rate-limited, tone
 * follows suspicion. One line per trigger per night keeps her human.
 */
export class BarkScheduler {
  private lastBarkAt = Number.NEGATIVE_INFINITY;
  private fired = new Set<BarkTrigger>();

  constructor(private pack: BarkPack) {}

  /** A line to say now, or null (cooldown, already said, or unscripted). */
  pick(trigger: BarkTrigger, tier: MumTier, t: number): string | null {
    const lines = this.pack[trigger];
    if (!lines) return null;
    if (this.fired.has(trigger)) return null;
    if (t - this.lastBarkAt < BARK_COOLDOWN) return null;
    this.fired.add(trigger);
    this.lastBarkAt = t;
    return tier >= 2 ? lines[1] : lines[0];
  }
}
