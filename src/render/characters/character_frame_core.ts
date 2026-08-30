// The player's FRAME: how big this character is, as one number.
//
// Not to be confused with two neighbours it deliberately does not touch:
//
//  - `character_world_scale.ts` is the CAST-WIDE proportion knob (0.7 of the
//    manifest height, direction call). It answers "how big is everybody
//    against the buildings". This module answers "how big is THIS character
//    against the rest of the cast", and the two multiply.
//  - `BodyShape` (modular.ts) is seven MORPH sliders: shoulders, chest, hips
//    and so on. Those are fitted against the armour at authoring time in the
//    Fit Studio, which is exactly why the creator does not offer them (see the
//    note above EYE_LABEL in appearance_customizer.ts). A frame is a UNIFORM
//    SCALE of the finished visual instead, so nothing has to be re-fitted: the
//    armour, the hair, the face and the held weapon all grow together, and a
//    towering barbarian is the same sculpt at a different size rather than a
//    second, contradictory set of proportions.
//
// RENDER-ONLY, like the cast-wide knob it multiplies. Collision, reach, and
// every interact range keep the sim's dimensions, so a big character is not a
// bigger target and a small one is not a harder one to hit: nothing
// deterministic moves. What DOES follow are the presentation readouts derived
// from the visual height (the click capsule, the nameplate anchor, the
// far-mesh offset), because those describe the drawn body.

/** The stored axis, -1 (slightest) through 0 (as sculpted) to +1 (towering). */
export const FRAME_MIN = -1;
export const FRAME_MAX = 1;

/** How far the ends of the axis move the body.
 *
 *  The ceiling is the interesting one. The KayKit rig is chibi: its head is a
 *  third of its height, so a body scaled far past the cast reads as a balloon
 *  rather than as a big person, and it starts clipping doorways the town kit
 *  authored for the standard silhouette. 1.35 is about where a barbarian still
 *  fits through the Eastbrook inn door and still reads as one of the cast. */
export const FRAME_SCALE_MIN = 0.82;
export const FRAME_SCALE_MAX = 1.35;

/** The size multiplier a stored frame value means. Out-of-range input clamps
 *  rather than throwing: this rides the untrusted `app` wire field, and every
 *  consumer already treats a bad appearance as one to clamp, never to refuse. */
export function frameScale(frame: number | undefined): number {
  if (typeof frame !== 'number' || !Number.isFinite(frame)) return 1;
  const t = Math.max(FRAME_MIN, Math.min(FRAME_MAX, frame));
  // Asymmetric on purpose: 0 must be exactly 1, so the sculpted body is the
  // untouched default and an existing character that never set a frame is
  // pixel-identical to what it was before this axis existed.
  return t >= 0 ? 1 + t * (FRAME_SCALE_MAX - 1) : 1 + t * (1 - FRAME_SCALE_MIN);
}
