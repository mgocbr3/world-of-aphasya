// Body proportions by BONE SCALE, the way a shared-rig MMO does it.
//
// A character creator that only paints faces reads as a costume shop: two
// players pick different hair and still stand in the same body. Real variety is
// proportion, and on a rig this size it is nearly free, because the skeleton is
// already there. Scaling a bone moves the skin bound to it, so a wider chest, a
// longer arm or a bigger head cost no geometry, no morph targets, and no new
// file, and every one of the 84 clips keeps playing over the result.
//
// Three rules the shape of this module comes from:
//
//   1. SCALE PROPAGATES DOWN THE CHAIN. A bone's scale multiplies into every
//      descendant, so widening the chest also inflates the arms hanging off it
//      and doubles up along a limb. Each entry therefore names the children that
//      must be UNDONE, and the caller applies the reciprocal there. Without that
//      compensation the sliders fight each other and the extremes look melted.
//
//   2. A BONE'S LENGTH IS ITS LOCAL +Y. Measured on this rig from the wrist to
//      knuckle vector, which lands 0.996 along the hand bone's own +Y. So a
//      limb grows on Y and thickens on X and Z, and nothing here needs a
//      per-bone axis table.
//
//   3. VISUAL ONLY, AND MODEST. Collision capsules, reach, interact ranges and
//      every sim number keep reading the unscaled body: this changes what a
//      player looks like, never what they can do. The ranges are deliberately
//      narrow (a tenth either way, a fifth for the head, which is the one place
//      a small change reads loudest) because a slider that can make a monster
//      is a slider that will.

/** Per-axis player input, each in -1..1, where 0 is the sculpted default. */
export type BodyAxis =
  | 'height'
  | 'build'
  | 'shoulders'
  | 'armLength'
  | 'armWidth'
  | 'legLength'
  | 'hips'
  | 'hands'
  | 'feet'
  | 'headSize';

export const BODY_AXES: readonly BodyAxis[] = [
  'height',
  'build',
  'shoulders',
  'armLength',
  'armWidth',
  'legLength',
  'hips',
  'hands',
  'feet',
  'headSize',
];

export type BodyAxes = Partial<Record<BodyAxis, number>>;

/**
 * How far each axis travels at full slider, as a fraction. Read these as "the
 * most a player can be": a tenth taller, a fifth of a head bigger. An MMO with
 * a shared rig lives or dies on this table being conservative, because the
 * animations are authored for the neutral body and every clip has to keep
 * reading on the extremes.
 */
export const AXIS_RANGE: Record<BodyAxis, number> = {
  height: 0.06,
  build: 0.1,
  shoulders: 0.12,
  armLength: 0.08,
  armWidth: 0.12,
  legLength: 0.08,
  hips: 0.1,
  hands: 0.14,
  feet: 0.12,
  headSize: 0.16,
};

/** One bone to scale, plus the children whose inherited scale must be undone. */
export interface BoneScale {
  bone: string;
  scale: [number, number, number];
  /** Children that should NOT inherit this scale (rule 1 in the header). */
  compensate: readonly string[];
}

const clamp = (v: number): number => Math.min(1, Math.max(-1, v));

/** The multiplier an axis contributes: 1 at neutral, 1 +/- its range at full. */
function factor(axes: BodyAxes, axis: BodyAxis): number {
  return 1 + clamp(axes[axis] ?? 0) * AXIS_RANGE[axis];
}

const ARMS = ['upperarm_l', 'upperarm_r'] as const;
const FOREARMS = ['lowerarm_l', 'lowerarm_r'] as const;
const LEGS = ['thigh_l', 'thigh_r'] as const;
const SHINS = ['calf_l', 'calf_r'] as const;

/**
 * The full plan for one look: every bone that moves, with what to undo beneath
 * it. Pure and order-independent; a caller walks it once against a skeleton and
 * multiplies. An axis left at 0 still emits its entry, at scale 1, so the plan
 * is a complete description of the body rather than a diff, and re-applying it
 * over a rig someone already shaped puts that rig back where it belongs.
 */
export function bodyScalePlan(axes: BodyAxes): BoneScale[] {
  const build = factor(axes, 'build');
  const shoulders = factor(axes, 'shoulders');
  const armLength = factor(axes, 'armLength');
  const armWidth = factor(axes, 'armWidth');
  const legLength = factor(axes, 'legLength');
  const hips = factor(axes, 'hips');
  const hands = factor(axes, 'hands');
  const feet = factor(axes, 'feet');
  const headSize = factor(axes, 'headSize');

  const plan: BoneScale[] = [
    // Torso bulk: thicker through the chest and back, never taller, so a heavy
    // build does not also gain height. The neck and both clavicles undo it, or
    // a broad chest would carry a swollen head and arms up with it.
    {
      bone: 'spine_02',
      scale: [build, 1, build],
      compensate: ['spine_03'],
    },
    {
      bone: 'spine_03',
      scale: [build, 1, build],
      compensate: ['neck_01', 'clavicle_l', 'clavicle_r'],
    },
    // Shoulder width moves the clavicles OUT along their own length, which is
    // what widens a frame; the arms hanging off them are undone so they keep
    // their own thickness.
    {
      bone: 'clavicle_l',
      scale: [1, shoulders, 1],
      compensate: ['upperarm_l'],
    },
    {
      bone: 'clavicle_r',
      scale: [1, shoulders, 1],
      compensate: ['upperarm_r'],
    },
    // Hips widen the pelvis across and through, never up: taller hips would
    // just raise the whole upper body. Both thighs undo it, or wide hips give
    // tree-trunk legs.
    {
      bone: 'pelvis',
      scale: [hips, 1, hips],
      compensate: ['thigh_l', 'thigh_r', 'spine_01'],
    },
    // The head is the loudest small change on a humanoid, so it gets the widest
    // range and the simplest treatment: uniform, with nothing below it to undo.
    { bone: 'Head', scale: [headSize, headSize, headSize], compensate: [] },
    // Hands and feet are leaves, like the head: uniform, nothing beneath them.
    // A hand carries whatever it holds, so this is the one leaf whose scale a
    // player sees on their weapon too, which is why its range stays modest.
    { bone: 'hand_l', scale: [hands, hands, hands], compensate: [] },
    { bone: 'hand_r', scale: [hands, hands, hands], compensate: [] },
    { bone: 'foot_l', scale: [feet, feet, feet], compensate: [] },
    { bone: 'foot_r', scale: [feet, feet, feet], compensate: [] },
  ];

  for (const [i, bone] of ARMS.entries()) {
    plan.push({
      bone,
      scale: [armWidth, armLength, armWidth],
      compensate: [FOREARMS[i]],
    });
  }
  for (const [i, bone] of FOREARMS.entries()) {
    plan.push({
      bone,
      scale: [armWidth, armLength, armWidth],
      // The hand keeps its own size: a longer arm is a longer arm, not a
      // bigger fist, and a scaled hand drags every held weapon with it.
      compensate: [i === 0 ? 'hand_l' : 'hand_r'],
    });
  }
  for (const [i, bone] of LEGS.entries()) {
    plan.push({ bone, scale: [1, legLength, 1], compensate: [SHINS[i]] });
  }
  for (const [i, bone] of SHINS.entries()) {
    plan.push({
      bone,
      scale: [1, legLength, 1],
      compensate: [i === 0 ? 'foot_l' : 'foot_r'],
    });
  }
  return plan;
}

/**
 * Overall height, applied to the whole visual rather than to bones. A taller
 * person is a bigger person: scaling only the legs gives a wader, not a tall
 * character, and it drags the feet off the ground the renderer places them on.
 */
export function bodyHeightScale(axes: BodyAxes): number {
  return factor(axes, 'height');
}
