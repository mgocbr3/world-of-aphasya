// Which skeleton a hand bone belongs to, and what that answer implies.
//
// Two questions used to be one. `isHandslotBone` asked "is this KayKit's
// handslot?" and every caller read the answer as "is this a hand at all",
// which was fine while one rig existed and wrong the moment a second arrived:
// a Quaternius `hand_r` is unmistakably a hand, yet it failed the test, so the
// per-weapon grip sizing and the sheathe-to-back path both skipped it silently.
//
// Splitting them lets a hand be a hand on any rig while the rig-SPECIFIC
// numbers stay attached to the rig that authored them: KayKit's per-accessory
// grip nodes are measured in its own hand frame and mean nothing here, and the
// bone a weapon sheathes onto is named differently in each skeleton.
//
// Pure and Node-tested: no three, no DOM, just names and numbers.

export type HandRig = 'kaykit' | 'quaternius';

/** Bone-name punctuation GLTFLoader strips (`handslot.r` becomes `handslotr`). */
function sanitize(name: string): string {
  return name.replace(/[[\].:/]/g, '');
}

/** The rig a hand bone belongs to, or null when the bone is not a hand. */
export function handRigOf(bone: string): HandRig | null {
  const n = sanitize(bone);
  if (n === 'handslotr' || n === 'handslotl') return 'kaykit';
  if (n === 'hand_r' || n === 'hand_l') return 'quaternius';
  return null;
}

/** True for a hand bone on ANY known rig. */
export function isHandBone(bone: string): boolean {
  return handRigOf(bone) !== null;
}

/** Which hand, for the mirrored grip. Defaults to the right on an unknown name. */
export function handSideOf(bone: string): 'r' | 'l' {
  return sanitize(bone).endsWith('l') ? 'l' : 'r';
}

/**
 * Uniform correction applied to the shared per-variant grip sizing, which
 * expresses its height clamps in KayKit bone units.
 *
 * The Quaternius bodies are authored at about 1.87 world units and normalized
 * UP to the class rigs' manifest height, so everything parented to one of their
 * bones inherits that factor. Without the reciprocal here, the same weapon rides
 * a Quaternius hand about 40% larger than a KayKit one, which is exactly the
 * blade-taller-than-its-owner this spike shipped once.
 */
export const QUATERNIUS_BODY_NORMALIZE = 1.39;

export function gripScaleFor(rig: HandRig): number {
  return rig === 'quaternius' ? 1 / QUATERNIUS_BODY_NORMALIZE : 1;
}

/**
 * The bone a sheathed weapon rides, per rig. KayKit carries it on `chest`;
 * the Quaternius skeleton has no bone by that name and its equivalent is the
 * top spine joint. A caller that cannot resolve the returned name should leave
 * the weapon in hand rather than guess.
 */
/**
 * Per-family fit for a variant-pack weapon in a QUATERNIUS hand. The KayKit
 * grip table cannot transfer (its lifts and quaternions are authored in the
 * KayKit handslot frame), so this rig carries its own two numbers per family:
 * `lift` seats the grip in the closed fist along the bone's +Y (down the
 * fingers on this skeleton), `scale` converts the pack's KayKit-fist sizing to
 * this body. Hand-tuned against creator screenshots, which is the same way the
 * KayKit rows were made.
 */
export interface QuaterniusFit {
  lift: number;
  scale: number;
}

export const QUATERNIUS_VARIANT_FIT: Record<string, QuaterniusFit> = {
  // Second tuning pass from the direction's high-res creator review: blades
  // and axe heads came down (they still brushed the ground at 0.55), and the
  // STAFF went the other way, up to a real walking-staff length held at
  // mid-shaft; 0.55 had cut it down to a drumstick.
  VAR_SWORD: { lift: 0.1, scale: 0.46 },
  VAR_DAGGER: { lift: 0.06, scale: 0.5 },
  VAR_STAFF: { lift: 0.34, scale: 0.78 },
  VAR_AXE: { lift: 0.08, scale: 0.44 },
  VAR_HAMMER: { lift: 0.08, scale: 0.44 },
  VAR_MACE: { lift: 0.08, scale: 0.44 },
  VAR_POLEARM: { lift: 0.3, scale: 0.62 },
  VAR_WAND: { lift: 0.05, scale: 0.5 },
  VAR_BOOK: { lift: 0.05, scale: 0.5 },
  VAR_CROSSBOW: { lift: 0.06, scale: 0.48 },
  VAR_BOW: { lift: 0.08, scale: 0.5 },
};

/** A weapon family this table does not know still needs a sane seat. */
export const QUATERNIUS_FALLBACK_FIT: QuaterniusFit = { lift: 0.1, scale: 0.55 };

/** Shields strap ALONG the forearm on this rig (measured for the base def):
 *  face parallel to the arm, pushed out past the fist along +Z. One row serves
 *  every shield; per-shield size differences ride the model itself. */
export const QUATERNIUS_SHIELD_FIT = {
  position: [0, 0.02, 0.07] as [number, number, number],
  scale: 0.27,
};

export function stowBoneFor(rig: HandRig): string {
  return rig === 'quaternius' ? 'spine_03' : 'chest';
}
